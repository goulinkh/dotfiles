#!/usr/bin/env bash
# Shared global tool setup via mise (macOS + Ubuntu). Idempotent.
# Requires mise on PATH (installed by packages/macos.sh or ubuntu.sh).
set -euo pipefail

# mise installed via mise.run lands in ~/.local/bin, maybe not yet on PATH.
command -v mise >/dev/null 2>&1 || export PATH="$HOME/.local/bin:$PATH"
if ! command -v mise >/dev/null 2>&1; then
  echo "==> mise missing — run packages/<os>.sh first" >&2
  exit 1
fi

echo "==> mise global tools"
mise use -g node@26
mise use -g pnpm@latest
mise use -g python@3.14
mise use -g go@latest
mise use -g kubectl@latest
mise use -g ubi:ajeetdsouza/zoxide@latest
mise use -g ubi:lsd-rs/lsd@latest

echo "==> juju via go install"
mise exec go@latest -- go install github.com/juju/juju/cmd/juju@latest
