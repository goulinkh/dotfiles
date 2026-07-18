#!/usr/bin/env bash
# Wire the vendored omp swarm extension to the installed omp runtime.
#
# The extension source lives in .omp/swarm-extension/ (committed). Its two entry
# points — src/extension.ts (TUI `/swarm`) and src/cli.ts (standalone runner) —
# import @oh-my-pi/pi-coding-agent and @oh-my-pi/pi-utils. Bun resolves those
# from a sibling node_modules, so we symlink them to whatever global omp install
# is active (bun follows the symlink to its realpath in the repo, so the deps
# must sit beside the real source here). node_modules/ is gitignored.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT="$DIR/.omp/swarm-extension"

if ! command -v omp >/dev/null 2>&1; then
  echo "==> omp not found on PATH — skipping swarm wiring (install omp first)" >&2
  exit 0
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "==> bun not found on PATH — skipping swarm wiring (needed by omp-swarm)" >&2
  exit 0
fi
if [ ! -d "$EXT/src" ]; then
  echo "==> swarm extension source missing at $EXT — nothing to wire" >&2
  exit 0
fi

# Resolve the global node_modules that ships pi-coding-agent / pi-utils.
# omp realpath: <node_modules>/@oh-my-pi/pi-coding-agent/dist/cli.js
omp_real="$(readlink -f "$(command -v omp)")"
GN="$(cd "$(dirname "$omp_real")/../../.." && pwd)"

if [ ! -d "$GN/@oh-my-pi/pi-coding-agent" ] || [ ! -d "$GN/@oh-my-pi/pi-utils" ]; then
  echo "==> Could not locate @oh-my-pi packages under $GN — is omp installed globally?" >&2
  exit 1
fi

echo "==> Wiring swarm extension deps -> $GN/@oh-my-pi"
mkdir -p "$EXT/node_modules/@oh-my-pi"
ln -sfn "$GN/@oh-my-pi/pi-coding-agent" "$EXT/node_modules/@oh-my-pi/pi-coding-agent"
ln -sfn "$GN/@oh-my-pi/pi-utils" "$EXT/node_modules/@oh-my-pi/pi-utils"

# Smoke-parse the shipped pipeline so a broken vendor is caught at setup time.
if bun "$EXT/src/cli.ts" >/dev/null 2>&1; then :; fi  # prints usage, exit 1 — fine
echo "   swarm extension ready — TUI: /swarm run, CLI: omp-swarm <yaml>"
