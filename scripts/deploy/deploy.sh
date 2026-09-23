#!/usr/bin/env bash
# Deploy HireOS to a server reached through a jump host, by uploading
# git-tracked source over SSH and building/running it there with Docker
# Compose. Modeled on the jumpserver connection pattern used elsewhere in
# this org for jump-host-gated deploys (compound SSH destination, port 2222,
# three-tier auth) -- reimplemented fresh here, not copied, since this
# project's services (5x NestJS backend, 4x Vite frontend, one nginx
# gateway) are a completely different shape from whatever that pattern was
# originally written against.
#
# NOT WIRED TO ANY REAL SERVER BY DEFAULT. REMOTE_SSH_DESTINATION has no
# default and must be set explicitly -- this script refuses to guess a
# target. Nothing here has been run against a real host yet.
#
# Usage:
#   REMOTE_SSH_DESTINATION=user@bastionuser@bastionip@targetip \
#   REMOTE_SSH_PORT=2222 \
#   scripts/deploy/deploy.sh check     # read-only: ssh in, check docker is present, list running containers
#   scripts/deploy/deploy.sh deploy    # upload source, docker compose build && up -d
#   scripts/deploy/deploy.sh status    # docker compose ps on the remote release
#   scripts/deploy/deploy.sh logs <service>
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REMOTE_SSH_DESTINATION="${REMOTE_SSH_DESTINATION:-}"
REMOTE_SSH_PORT="${REMOTE_SSH_PORT:-22}"
REMOTE_PASS="${REMOTE_PASS:-}"
REMOTE_PASS_FILE="${REMOTE_PASS_FILE:-$SCRIPT_DIR/.deploy-hireos-remote.password}"
REMOTE_KEY_PATH="${REMOTE_KEY_PATH:-}"

# Where releases live on the remote host, and the Compose project name --
# distinct from anything already deployed there (e.g. an older, unrelated
# stack), so this never touches other containers/networks by accident.
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/hireos}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-hireos}"

fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

command -v ssh >/dev/null 2>&1 || fail 'ssh is required'
[[ -n "$REMOTE_SSH_DESTINATION" ]] || fail 'REMOTE_SSH_DESTINATION is required, e.g. user@bastionuser@bastionip@targetip -- no default is set on purpose'
[[ "$REMOTE_SSH_DESTINATION" =~ ^[A-Za-z0-9@._:-]+$ ]] || fail 'invalid REMOTE_SSH_DESTINATION'
[[ "$REMOTE_SSH_PORT" =~ ^[0-9]+$ ]] || fail 'invalid REMOTE_SSH_PORT'

load_auth() {
  if [[ -n "$REMOTE_KEY_PATH" ]]; then
    [[ -r "$REMOTE_KEY_PATH" ]] || fail 'REMOTE_KEY_PATH is not readable'
    AUTH=(-i "$REMOTE_KEY_PATH" -o IdentitiesOnly=yes)
  elif [[ -n "$REMOTE_PASS" || -s "$REMOTE_PASS_FILE" ]]; then
    command -v sshpass >/dev/null 2>&1 || fail 'sshpass is required for password login'
    [[ -n "$REMOTE_PASS" ]] || REMOTE_PASS="$(<"$REMOTE_PASS_FILE")"
    AUTH=(-o PreferredAuthentications=password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1)
  else
    AUTH=(-o BatchMode=yes)
  fi
}

ssh_run() {
  local remote_cmd="$1"
  load_auth
  local opts=(-p "$REMOTE_SSH_PORT" -o StrictHostKeyChecking=yes -o ConnectTimeout=60 -o ServerAliveInterval=10 -o ServerAliveCountMax=6 "${AUTH[@]}")
  if [[ -n "$REMOTE_PASS" ]]; then
    SSHPASS="$REMOTE_PASS" sshpass -e ssh "${opts[@]}" "$REMOTE_SSH_DESTINATION" "$remote_cmd"
  else
    ssh "${opts[@]}" "$REMOTE_SSH_DESTINATION" "$remote_cmd"
  fi
}

cmd_check() {
  printf '[deploy] connecting through %s:%s (read-only check)\n' "$REMOTE_SSH_DESTINATION" "$REMOTE_SSH_PORT"
  ssh_run 'set -Eeuo pipefail
    printf "[deploy-check] host=%s user=%s\n" "$(hostname)" "$(id -un)"
    command -v docker >/dev/null || { echo "[deploy-check] docker NOT found"; exit 1; }
    docker compose version >/dev/null 2>&1 || echo "[deploy-check] WARNING: docker compose plugin not found"
    docker info --format "[deploy-check] docker_server={{.ServerVersion}}"
    echo "[deploy-check] currently running containers:"
    docker ps --format "  {{.Names}}  {{.Status}}  ports={{.Ports}}"
    echo "[deploy-check] existing '\''hireos'\'' compose projects (label com.docker.compose.project):"
    docker ps --format "{{.Label \"com.docker.compose.project\"}}" | sort -u | grep -i hireos || echo "  (none found)"'
}

cmd_deploy() {
  command -v git >/dev/null 2>&1 || fail 'git is required to determine what to upload (git ls-files)'
  cd "$ROOT"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "$ROOT is not a git repo -- run 'git init' first (see docs)"
  local release
  release="$(date +%Y%m%d%H%M%S)"
  local release_dir="$REMOTE_APP_DIR/releases/$release"
  printf '[deploy] uploading git-tracked source (release %s) to %s\n' "$release" "$release_dir"
  ssh_run "mkdir -p '$release_dir'"
  # Ship tracked + staged files only -- excludes node_modules/dist/.env* per
  # each subsystem's own .gitignore, and never uploads anything not checked in.
  git ls-files -co --exclude-standard | tar -cf - -T - \
    | { load_auth; if [[ -n "$REMOTE_PASS" ]]; then SSHPASS="$REMOTE_PASS" sshpass -e ssh -p "$REMOTE_SSH_PORT" -o StrictHostKeyChecking=yes "${AUTH[@]}" "$REMOTE_SSH_DESTINATION" "tar -xf - -C '$release_dir'"; else ssh -p "$REMOTE_SSH_PORT" -o StrictHostKeyChecking=yes "${AUTH[@]}" "$REMOTE_SSH_DESTINATION" "tar -xf - -C '$release_dir'"; fi; }

  printf '[deploy] linking persisted secrets from %s/shared/env into the release, then building + starting\n' "$REMOTE_APP_DIR"
  ssh_run "set -Eeuo pipefail
    mkdir -p '$REMOTE_APP_DIR/shared/env'
    cd '$release_dir'
    # Each *.env.production path the compose file expects gets symlinked in
    # from the persistent shared/env dir (created once per server, outside
    # any release, never re-uploaded).
    while IFS= read -r rel; do
      dest=\"$release_dir/\$rel\"
      src=\"$REMOTE_APP_DIR/shared/env/\$(echo \"\$rel\" | tr '/' '__')\"
      [[ -f \"\$src\" ]] || { echo \"[deploy] missing \$src on server -- create it (see docs) before first deploy\" >&2; exit 1; }
      ln -sf \"\$src\" \"\$dest\"
    done < <(grep -oE '\\./[A-Za-z0-9_./-]+\\.env\\.production' docker-compose.yml | sed 's#^\\./##' | sort -u)
    ln -sfn '$release_dir' '$REMOTE_APP_DIR/current'
    cd '$REMOTE_APP_DIR/current'
    docker compose -p '$COMPOSE_PROJECT_NAME' build
    docker compose -p '$COMPOSE_PROJECT_NAME' up -d
    docker compose -p '$COMPOSE_PROJECT_NAME' ps"
}

cmd_status() {
  ssh_run "cd '$REMOTE_APP_DIR/current' 2>/dev/null && docker compose -p '$COMPOSE_PROJECT_NAME' ps || echo '[deploy] no current release on this host yet'"
}

cmd_logs() {
  local service="${1:?usage: deploy.sh logs <service>}"
  ssh_run "cd '$REMOTE_APP_DIR/current' && docker compose -p '$COMPOSE_PROJECT_NAME' logs --tail=200 '$service'"
}

case "${1:-}" in
  check) cmd_check ;;
  deploy) cmd_deploy ;;
  status) cmd_status ;;
  logs) cmd_logs "${2:-}" ;;
  *)
    cat >&2 <<EOF
usage: REMOTE_SSH_DESTINATION=user@bastionuser@bastionip@targetip scripts/deploy/deploy.sh <check|deploy|status|logs> [args]

env vars:
  REMOTE_SSH_DESTINATION   required, no default. e.g. user@bastionuser@bastionip@targetip
  REMOTE_SSH_PORT          default 22
  REMOTE_KEY_PATH          SSH key auth (preferred over password if set)
  REMOTE_PASS / REMOTE_PASS_FILE   password auth via sshpass (falls back to $SCRIPT_DIR/.deploy-hireos-remote.password)
  REMOTE_APP_DIR           default /opt/hireos
  COMPOSE_PROJECT_NAME     default hireos -- keep distinct from any pre-existing stack on the same host
EOF
    exit 1
    ;;
esac
