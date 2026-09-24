#!/usr/bin/env bash
# Deploy HireOS to a server reached through a jump host, by uploading
# git-tracked source over SSH and building/running it there with Docker
# Compose.
#
# Connection format (confirmed against this org's real JumpServer -- see
# JumpServer生产服务器连接说明.md): the SSH *host* argument is the jump
# host's own IP, and the login name is a compound string
# "<jump user>@<asset ssh user>@<asset ip>" passed via `-l`. A naive
# "user@bastion@ip1@ip2" positional destination (what earlier drafts of this
# script used) gets mis-parsed by a standard SSH client -- it splits on the
# *rightmost* `@`, so it ends up dialing the asset IP directly instead of
# going through the jump host. Do not revert to that form.
#
# NOT WIRED TO ANY REAL SERVER BY DEFAULT. REMOTE_ASSET_HOST/REMOTE_JUMP_HOST
# etc. have no defaults and must be set explicitly.
#
# Usage:
#   REMOTE_JUMP_USER=jumpuser REMOTE_ASSET_USER=assetuser \
#   REMOTE_ASSET_HOST=1.2.3.4 REMOTE_JUMP_HOST=5.6.7.8 REMOTE_SSH_PORT=2222 \
#   REMOTE_APP_DIR=/home/ops/jenkins_job/hireos_prod_job \
#   scripts/deploy/deploy.sh check       # read-only: ssh in, check docker/compose, list running containers
#   scripts/deploy/deploy.sh bootstrap   # one-time: install docker-compose-plugin, create REMOTE_APP_DIR + shared/env
#   scripts/deploy/deploy.sh push-env    # upload local .env.production files into REMOTE_APP_DIR/shared/env (never via git)
#   scripts/deploy/deploy.sh deploy      # upload source, docker compose build && up -d
#   scripts/deploy/deploy.sh status      # docker compose ps on the remote release
#   scripts/deploy/deploy.sh logs <service>
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REMOTE_JUMP_USER="${REMOTE_JUMP_USER:-}"
REMOTE_ASSET_USER="${REMOTE_ASSET_USER:-}"
REMOTE_ASSET_HOST="${REMOTE_ASSET_HOST:-}"
REMOTE_JUMP_HOST="${REMOTE_JUMP_HOST:-}"
REMOTE_SSH_PORT="${REMOTE_SSH_PORT:-2222}"
REMOTE_PASS="${REMOTE_PASS:-}"
REMOTE_PASS_FILE="${REMOTE_PASS_FILE:-$SCRIPT_DIR/.deploy-hireos-remote.password}"
REMOTE_KEY_PATH="${REMOTE_KEY_PATH:-}"

# Where releases live on the remote host, and the Compose project name --
# distinct from anything already deployed there (this host runs many
# unrelated production stacks), so this never touches other containers by
# accident.
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/hireos}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-hireos}"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"

fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

command -v ssh >/dev/null 2>&1 || fail 'ssh is required'
for v in REMOTE_JUMP_USER REMOTE_ASSET_USER REMOTE_ASSET_HOST REMOTE_JUMP_HOST; do
  [[ -n "${!v}" ]] || fail "$v is required, no default is set on purpose"
done
[[ "$REMOTE_JUMP_USER" =~ ^[A-Za-z0-9._-]+$ ]] || fail 'invalid REMOTE_JUMP_USER'
[[ "$REMOTE_ASSET_USER" =~ ^[A-Za-z0-9._-]+$ ]] || fail 'invalid REMOTE_ASSET_USER'
[[ "$REMOTE_ASSET_HOST" =~ ^[A-Za-z0-9.:-]+$ ]] || fail 'invalid REMOTE_ASSET_HOST'
[[ "$REMOTE_JUMP_HOST" =~ ^[A-Za-z0-9.:-]+$ ]] || fail 'invalid REMOTE_JUMP_HOST'
[[ "$REMOTE_SSH_PORT" =~ ^[0-9]+$ ]] || fail 'invalid REMOTE_SSH_PORT'

LOGIN_NAME="${REMOTE_JUMP_USER}@${REMOTE_ASSET_USER}@${REMOTE_ASSET_HOST}"

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

# Runs a command on the remote asset, through the jump host, via the
# confirmed `-l compound_login jump_host` form. StrictHostKeyChecking stays
# `yes` -- the jump host's fingerprint must already be trusted in this
# machine's known_hosts (verified out-of-band once; see PORTS.md).
ssh_run() {
  local remote_cmd="$1"
  load_auth
  local opts=(-p "$REMOTE_SSH_PORT" -o StrictHostKeyChecking=yes -o ConnectTimeout=60 -o ServerAliveInterval=10 -o ServerAliveCountMax=6 "${AUTH[@]}" -l "$LOGIN_NAME")
  if [[ -n "$REMOTE_PASS" ]]; then
    SSHPASS="$REMOTE_PASS" sshpass -e ssh "${opts[@]}" "$REMOTE_JUMP_HOST" "$remote_cmd"
  else
    ssh "${opts[@]}" "$REMOTE_JUMP_HOST" "$remote_cmd"
  fi
}

# Pipes stdin to a remote command (used for the source tar upload). Same
# connection form as ssh_run, just without a captured remote_cmd string.
ssh_pipe_in() {
  local remote_cmd="$1"
  load_auth
  local opts=(-p "$REMOTE_SSH_PORT" -o StrictHostKeyChecking=yes "${AUTH[@]}" -l "$LOGIN_NAME")
  if [[ -n "$REMOTE_PASS" ]]; then
    SSHPASS="$REMOTE_PASS" sshpass -e ssh "${opts[@]}" "$REMOTE_JUMP_HOST" "$remote_cmd"
  else
    ssh "${opts[@]}" "$REMOTE_JUMP_HOST" "$remote_cmd"
  fi
}

cmd_check() {
  printf '[deploy] connecting via %s -> %s:%s (read-only check)\n' "$LOGIN_NAME" "$REMOTE_JUMP_HOST" "$REMOTE_SSH_PORT"
  ssh_run 'set -Eeuo pipefail
    printf "[deploy-check] host=%s user=%s\n" "$(hostname)" "$(id -un)"
    command -v docker >/dev/null || { echo "[deploy-check] docker NOT found"; exit 1; }
    sudo docker compose version >/dev/null 2>&1 || echo "[deploy-check] WARNING: docker compose plugin not found (run: deploy.sh bootstrap)"
    sudo docker info --format "[deploy-check] docker_server={{.ServerVersion}}"
    echo "[deploy-check] existing '\''hireos'\'' compose projects (label com.docker.compose.project):"
    sudo docker ps --format "{{.Label \"com.docker.compose.project\"}}" | sort -u | grep -i hireos || echo "  (none found)"'
}

cmd_bootstrap() {
  printf '[deploy] one-time server setup: docker compose plugin + %s\n' "$REMOTE_APP_DIR"
  ssh_run "set -Eeuo pipefail
    # Only the v2 plugin (\`docker compose\`, space-separated) is checked --
    # a standalone v1 \`docker-compose\` binary being present is not
    # sufficient (this script uses v2 syntax throughout) and must not
    # short-circuit this install.
    sudo docker compose version >/dev/null 2>&1 || {
      sudo apt-get update -y && sudo apt-get install -y --no-install-recommends docker-compose-plugin
    }
    sudo docker compose version
    sudo mkdir -p '$REMOTE_APP_DIR/releases' '$REMOTE_APP_DIR/shared/env'
    sudo chown -R '$REMOTE_ASSET_USER:$REMOTE_ASSET_USER' '$REMOTE_APP_DIR'
    chmod 700 '$REMOTE_APP_DIR/shared/env'
    echo '[deploy] bootstrap done'"
}

# Uploads *.env.production (per backend) + scripts/docker/postgres.env.production
# into REMOTE_APP_DIR/shared/env, flattened and never through git/tar. This
# JumpServer channel may not carry plain scp/sftp (see
# JumpServer生产服务器连接说明.md 第 7 节), so this pipes each file's bytes
# through the same `ssh -l ...` channel used everywhere else instead.
cmd_push_env() {
  cd "$ROOT"
  local files=(
    "hireos-interview/job-Interview-backend/.env.production"
    "hireos-screening/hireos-screening-backend/.env.production"
    "hireos-core-record/.env.production"
    "hireos-jd/hireos-jd-backend/.env.production"
    "hireos-written/hireos-written-backend/.env.production"
    "scripts/docker/postgres.env.production"
  )
  local f flat
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || fail "missing local $f -- create it from the matching .env.production.example first"
    flat="$(echo "$f" | tr '/' '__')"
    printf '[deploy] pushing %s -> %s/shared/env/%s\n' "$f" "$REMOTE_APP_DIR" "$flat"
    ssh_pipe_in "cat > '$REMOTE_APP_DIR/shared/env/$flat' && chmod 600 '$REMOTE_APP_DIR/shared/env/$flat'" < "$f"
  done
  echo '[deploy] all env files pushed'
}

# Several subsystem dirs (hireos-interview, hireos-screening, hireos-jd,
# hireos-core-record -- discovered dynamically, not hardcoded) each carry
# their own standalone `.git` from earlier in this project's history. They
# are NOT registered as real git submodules (no .gitmodules), so the root
# repo's `git ls-files -o` treats each as an opaque "nested repo" and emits
# only the bare directory path, not its contents. Piping that path straight
# into `tar -T -` makes tar (which has no idea about .gitignore) recurse
# into the whole directory as-is -- node_modules, dist, .env, everything --
# blowing an upload that should be a few MB up to multiple GB. Collect each
# nested repo's own file list separately (its own .gitignore is correct)
# and union with the root's, instead of trusting one root-level `git
# ls-files` to cover everything.
collect_upload_list() {
  local nested_git_dirs=()
  while IFS= read -r -d '' d; do
    nested_git_dirs+=("$(dirname "$d")")
  done < <(find . -mindepth 2 -maxdepth 3 -name .git -print0)

  # macOS ships bash 3.2 (last GPLv2 release Apple will bundle), where
  # `"${arr[@]}"` on a *zero-length* array under `set -u` throws "unbound
  # variable" -- fixed in bash 4.4+, but this script has to run correctly
  # on the stock `/bin/bash` too. Guard every expansion of these arrays
  # with a length check instead of expanding directly.
  local exclude_args=()
  local d
  if [[ ${#nested_git_dirs[@]} -gt 0 ]]; then
    for d in "${nested_git_dirs[@]}"; do
      exclude_args+=(":(exclude)${d#./}")
    done
  fi
  if [[ ${#exclude_args[@]} -gt 0 ]]; then
    git ls-files -zco --exclude-standard -- . "${exclude_args[@]}"
  else
    git ls-files -zco --exclude-standard -- .
  fi

  [[ ${#nested_git_dirs[@]} -gt 0 ]] || return 0
  for d in "${nested_git_dirs[@]}"; do
    # NUL-safe prefixing -- BSD sed (macOS) has no -z/--null, so this uses
    # perl -0 instead of `sed -z`, which silently produced nothing here.
    (cd "$d" && git ls-files -zco --exclude-standard) | perl -0ne "print \"${d#./}/\$_\""
  done
}

cmd_deploy() {
  command -v git >/dev/null 2>&1 || fail 'git is required to determine what to upload (git ls-files)'
  cd "$ROOT"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "$ROOT is not a git repo"
  local release
  release="$(date +%Y%m%d%H%M%S)"
  local release_dir="$REMOTE_APP_DIR/releases/$release"
  printf '[deploy] uploading git-tracked source (release %s) to %s\n' "$release" "$release_dir"
  ssh_run "mkdir -p '$release_dir'"
  # -z/--null throughout: git quotes non-ASCII (e.g. Chinese) filenames as
  # octal escapes by default, which breaks a plain `tar -T -` (it tries to
  # stat the escaped string literally); NUL-separated names avoid that.
  collect_upload_list | tar --null -cf - -T - | ssh_pipe_in "tar -xf - -C '$release_dir'"

  printf '[deploy] linking persisted secrets from %s/shared/env, then building + starting\n' "$REMOTE_APP_DIR"
  ssh_run "set -Eeuo pipefail
    cd '$release_dir'
    while IFS= read -r rel; do
      dest=\"$release_dir/\$rel\"
      src=\"$REMOTE_APP_DIR/shared/env/\$(echo \"\$rel\" | tr '/' '__')\"
      [[ -f \"\$src\" ]] || { echo \"[deploy] missing \$src on server -- run 'deploy.sh push-env' first\" >&2; exit 1; }
      ln -sf \"\$src\" \"\$dest\"
    done < <(grep -oE '\\./[A-Za-z0-9_./-]+\\.env\\.production' docker-compose.yml | sed 's#^\\./##' | sort -u)
    ln -sf '$REMOTE_APP_DIR/shared/env/scripts_docker_postgres.env.production' scripts/docker/postgres.env.production
    ln -sfn '$release_dir' '$REMOTE_APP_DIR/current'
    cd '$REMOTE_APP_DIR/current'
    sudo docker compose $COMPOSE_FILES -p '$COMPOSE_PROJECT_NAME' build
    sudo docker compose $COMPOSE_FILES -p '$COMPOSE_PROJECT_NAME' up -d
    sudo docker compose $COMPOSE_FILES -p '$COMPOSE_PROJECT_NAME' ps"
}

cmd_status() {
  ssh_run "cd '$REMOTE_APP_DIR/current' 2>/dev/null && sudo docker compose $COMPOSE_FILES -p '$COMPOSE_PROJECT_NAME' ps || echo '[deploy] no current release on this host yet'"
}

cmd_logs() {
  local service="${1:?usage: deploy.sh logs <service>}"
  ssh_run "cd '$REMOTE_APP_DIR/current' && sudo docker compose $COMPOSE_FILES -p '$COMPOSE_PROJECT_NAME' logs --tail=200 '$service'"
}

case "${1:-}" in
  check) cmd_check ;;
  bootstrap) cmd_bootstrap ;;
  push-env) cmd_push_env ;;
  deploy) cmd_deploy ;;
  status) cmd_status ;;
  logs) cmd_logs "${2:-}" ;;
  *)
    cat >&2 <<EOF
usage: scripts/deploy/deploy.sh <check|bootstrap|push-env|deploy|status|logs> [args]

env vars (all required except noted):
  REMOTE_JUMP_USER     JumpServer login user, e.g. jsunsu
  REMOTE_ASSET_USER    asset's own SSH user, e.g. ubuntu
  REMOTE_ASSET_HOST    asset IP
  REMOTE_JUMP_HOST     jump host's own IP (the real SSH target)
  REMOTE_SSH_PORT      default 2222
  REMOTE_KEY_PATH      SSH key auth (preferred over password if set)
  REMOTE_PASS / REMOTE_PASS_FILE   password auth via sshpass (falls back to $SCRIPT_DIR/.deploy-hireos-remote.password)
  REMOTE_APP_DIR       default /opt/hireos
  COMPOSE_PROJECT_NAME default hireos -- keep distinct from any pre-existing stack on the same host
EOF
    exit 1
    ;;
esac
