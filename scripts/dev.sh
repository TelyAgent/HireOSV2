#!/usr/bin/env bash
# HireOS local dev orchestrator: start/stop/status for every subsystem + the two
# unified gateways (see PORTS.md "本地统一网关"). Replaces the ad hoc
# `nohup npm run start:dev > log 2>&1 & disown` pattern used everywhere until now --
# in particular, `stop` here kills the whole process *group* (via bash job-control
# groups, `set -m`), not just the top-level pid, so a `nest start --watch` child
# (`dist/main`) never survives its parent being killed the way it repeatedly did
# with the old manual pattern.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.local/logs"
PID_DIR="$ROOT/.local/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

NAMES=(interview-backend interview-frontend screening-backend screening-frontend core-record jd-backend jd-frontend written-backend written-frontend gateway-frontend gateway-backend)
DIRS=(
  "$ROOT/hireos-interview/job-Interview-backend"
  "$ROOT/hireos-interview/job-Interview-front"
  "$ROOT/hireos-screening/hireos-screening-backend"
  "$ROOT/hireos-screening/hireos-screening-front"
  "$ROOT/hireos-core-record"
  "$ROOT/hireos-jd/hireos-jd-backend"
  "$ROOT/hireos-jd/hireos-jd-front"
  "$ROOT/hireos-written/hireos-written-backend"
  "$ROOT/hireos-written/hireos-written-front"
  "$ROOT/gateway"
  "$ROOT/gateway"
)
CMDS=(
  "npm run start:dev"
  "npm run dev"
  "npm run start:dev"
  "npm run dev"
  "npm run start:dev"
  "npm run start:dev"
  "npm run dev"
  "npm run start:dev"
  "npm run dev"
  "npm run frontend"
  "npm run backend"
)
PORTS=(3001 5173 3002 5174 3004 3005 5175 3008 5178 8080 8090)
BACKENDS=(interview-backend screening-backend core-record jd-backend written-backend)
FRONTENDS=(interview-frontend screening-frontend jd-frontend written-frontend)
GATEWAYS=(gateway-frontend gateway-backend)

find_index() {
  local target="$1" i
  for i in "${!NAMES[@]}"; do
    [[ "${NAMES[$i]}" == "$target" ]] && { echo "$i"; return 0; }
  done
  return 1
}

start_one() {
  local name="$1" idx
  idx=$(find_index "$name") || { echo "unknown service: $name" >&2; return 1; }
  local dir="${DIRS[$idx]}" cmd="${CMDS[$idx]}" port="${PORTS[$idx]}"
  local pidfile="$PID_DIR/$name.pid"
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "already running: $name (pid $(cat "$pidfile"), port $port)"
    return 0
  fi
  echo "starting $name   $dir -> $cmd   (port $port)"
  set -m
  ( cd "$dir" && exec $cmd ) > "$LOG_DIR/$name.log" 2>&1 < /dev/null &
  local pid=$!
  set +m
  disown "$pid" 2>/dev/null || true
  echo "$pid" > "$pidfile"
  sleep 1.5
  if kill -0 "$pid" 2>/dev/null; then
    echo "  pid(group): $pid   log: $LOG_DIR/$name.log"
  else
    rm -f "$pidfile"
    echo "  FAILED -- process exited immediately (often EADDRINUSE: something else already on port $port). See $LOG_DIR/$name.log:" >&2
    tail -n 8 "$LOG_DIR/$name.log" >&2
  fi
}

stop_one() {
  local name="$1"
  local pidfile="$PID_DIR/$name.pid"
  if [[ ! -f "$pidfile" ]]; then
    echo "not tracked: $name (never started via this script, or already stopped)"
    return 0
  fi
  local pid; pid=$(cat "$pidfile")
  if kill -0 "$pid" 2>/dev/null; then
    echo "stopping $name (pgid $pid)"
    kill -TERM "-$pid" 2>/dev/null || true
    sleep 0.5
    kill -0 "$pid" 2>/dev/null && { echo "  still up, sending KILL"; kill -KILL "-$pid" 2>/dev/null || true; }
  else
    echo "$name not running (stale pidfile)"
  fi
  rm -f "$pidfile"
}

status_all() {
  printf "%-20s %-6s %s\n" "SERVICE" "PORT" "STATE"
  local i
  for i in "${!NAMES[@]}"; do
    local name="${NAMES[$i]}" port="${PORTS[$i]}" state="down"
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && state="UP"
    printf "%-20s %-6s %s\n" "$name" "$port" "$state"
  done
}

resolve_group() {
  case "$1" in
    all) echo "${BACKENDS[@]} ${FRONTENDS[@]} ${GATEWAYS[@]}" ;;
    backends) echo "${BACKENDS[@]}" ;;
    frontends) echo "${FRONTENDS[@]}" ;;
    gateway|gateways) echo "${GATEWAYS[@]}" ;;
    *) echo "$1" ;;
  esac
}

cmd="${1:-}"
target="${2:-}"

case "$cmd" in
  start)
    [[ -z "$target" ]] && { echo "usage: dev.sh start <name|all|backends|frontends|gateway>" >&2; exit 1; }
    for n in $(resolve_group "$target"); do start_one "$n"; done
    ;;
  stop)
    [[ -z "$target" ]] && { echo "usage: dev.sh stop <name|all|backends|frontends|gateway>" >&2; exit 1; }
    for n in $(resolve_group "$target"); do stop_one "$n"; done
    ;;
  restart)
    [[ -z "$target" ]] && { echo "usage: dev.sh restart <name|all|backends|frontends|gateway>" >&2; exit 1; }
    for n in $(resolve_group "$target"); do stop_one "$n"; done
    sleep 0.5
    for n in $(resolve_group "$target"); do start_one "$n"; done
    ;;
  status)
    status_all
    ;;
  *)
    cat >&2 <<EOF
usage: dev.sh <start|stop|restart> <name|all|backends|frontends|gateway>
       dev.sh status

names: ${NAMES[*]}

examples:
  scripts/dev.sh start all              # everything, including both gateways
  scripts/dev.sh start screening-backend
  scripts/dev.sh start gateway          # just the two gateways
  scripts/dev.sh stop all
  scripts/dev.sh status
EOF
    exit 1
    ;;
esac
