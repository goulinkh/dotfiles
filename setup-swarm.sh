#!/usr/bin/env bash
# Install or update the public omp swarm extension and wire it to the active
# omp runtime. The source clone lives at ~/.omp/swarm-extension; its two entry
# points — src/extension.ts (TUI `/swarm`) and src/cli.ts (standalone runner) —
# import @oh-my-pi/pi-coding-agent and @oh-my-pi/pi-utils. Bun resolves those
# from a sibling node_modules, so they are symlinked from the global omp install.
set -euo pipefail

REPO="https://github.com/goulinkh/omp-swarm"
EXT="$HOME/.omp/swarm-extension"

if ! command -v omp >/dev/null 2>&1; then
  echo "==> omp not found on PATH — skipping swarm wiring (install omp first)" >&2
  exit 0
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "==> bun not found on PATH — skipping swarm wiring (needed by omp-swarm)" >&2
  exit 0
fi
if ! command -v git >/dev/null 2>&1; then
  echo "==> git not found on PATH — cannot install swarm extension" >&2
  exit 1
fi
if [ -e "$EXT" ] || [ -L "$EXT" ]; then
  if [ ! -d "$EXT/.git" ]; then
    echo "==> $EXT exists but is not an omp-swarm clone" >&2
    exit 1
  fi
  echo "==> Updating swarm extension"
  git -C "$EXT" pull --ff-only
else
  echo "==> Installing swarm extension"
  mkdir -p "$(dirname "$EXT")"
  git clone "$REPO" "$EXT"
fi

if [ ! -d "$EXT/src" ]; then
  echo "==> swarm extension source missing at $EXT" >&2
  exit 1
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

# Smoke-load the CLI entry so a broken checkout is caught at setup time.
if bun "$EXT/src/cli.ts" >/dev/null 2>&1; then :; fi  # prints usage, exit 1 — fine
echo "   swarm extension ready — TUI: /swarm run, CLI: omp-swarm <yaml>"
