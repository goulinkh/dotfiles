#!/usr/bin/env bash
# macOS tools via Homebrew (+ colorls gem), then shared mise tools. Idempotent.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v brew >/dev/null 2>&1; then
  echo "==> Homebrew missing — install from https://brew.sh then re-run" >&2
  exit 1
fi

echo "==> brew install"
brew install fzf bat neovim jq mise gh tmux
# Posts Herdr agent alerts as macOS notifications (mods/system-notify).
brew install terminal-notifier

# Shared global runtimes/CLIs via mise.
bash "$DIR/common.sh"

# Herdr app and herdr-core.
bash "$DIR/herdr.sh"

# SF Pro Text, for Herdr's UI font.
bash "$DIR/sf-pro.sh"
