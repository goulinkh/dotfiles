#!/usr/bin/env bash
# Install (or update) the omp plugins listed in omp-plugins.txt.
# `omp plugin install` is idempotent — the same command installs a missing
# plugin and updates one already installed — so this runs from install.sh and
# dotsync alike. Plugins land in ~/.omp/plugins, which stays out of the repo.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIST="$DIR/omp-plugins.txt"

[ -e "$LIST" ] || exit 0

if ! command -v omp >/dev/null 2>&1; then
  echo "==> omp not found on PATH — skipping omp plugins" >&2
  exit 0
fi

echo "==> Installing omp plugins"
failed=0
while IFS= read -r spec; do
  spec="${spec%%#*}"
  spec="$(echo "$spec" | xargs)"
  [ -n "$spec" ] || continue
  if omp plugin install "$spec" >/dev/null 2>&1; then
    echo "   plugin: $spec"
  else
    echo "   plugin: $spec FAILED — re-run: omp plugin install $spec" >&2
    failed=1
  fi
done <"$LIST"

omp plugin list 2>/dev/null | sed -n 's/^● /   active: /p'
exit "$failed"
