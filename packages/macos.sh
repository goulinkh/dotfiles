#!/usr/bin/env bash
# macOS tools via Homebrew (+ colorls gem), then shared mise tools. Idempotent.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v brew >/dev/null 2>&1; then
  echo "==> Homebrew missing — install from https://brew.sh then re-run" >&2
  exit 1
fi

echo "==> brew install"
brew install fzf zoxide bat neovim jq mise

# Shared global runtimes/CLIs via mise.
bash "$DIR/common.sh"
