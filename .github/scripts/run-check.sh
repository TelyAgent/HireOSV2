#!/usr/bin/env bash
# Usage: run-check.sh <project-dir> <npm-script> <known_failing: true|false>
# Known-failing checks still run; their failure is a warning, and an unexpected
# pass asks the author to remove the entry from .github/ci/projects.json.
set -uo pipefail
dir="$1"; script="$2"; known="$3"

(cd "$dir" && npm run "$script")
status=$?

if [ "$status" -eq 0 ]; then
  if [ "$known" = true ]; then
    echo "::warning title=$dir $script now passes::Remove \"$script\" from known_failing in .github/ci/projects.json"
  fi
  exit 0
fi

if [ "$known" = true ]; then
  echo "::warning title=$dir $script failed (known)::Tracked in .github/ci/projects.json known_failing; not blocking."
  exit 0
fi

echo "::error title=$dir $script failed::npm run $script exited $status"
exit "$status"
