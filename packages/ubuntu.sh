#!/usr/bin/env bash
# Ubuntu/Debian tools via apt (+ mise installer), then shared mise tools.
# Idempotent.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v apt-get >/dev/null 2>&1; then
  echo "==> apt install (sudo)"
  sudo apt-get update -qq
  # bat installs as `batcat` on Ubuntu; .alias.zsh handles that.
  # build-* + lib*-dev: needed for mise to compile Python from source.
  # zoxide comes from mise (common.sh) — not in older Ubuntu apt repos.
  sudo apt-get install -y \
    zsh fzf bat neovim jq curl git xclip wl-clipboard unzip \
    build-essential libssl-dev zlib1g-dev libbz2-dev libreadline-dev \
    libsqlite3-dev libffi-dev liblzma-dev tk-dev
else
  echo "==> Non-apt Linux — install manually: fzf zoxide bat neovim jq" >&2
fi

# mise has no apt package; use the official installer.
command -v mise >/dev/null 2>&1 || curl -fsSL https://mise.run | sh

# Shared global runtimes/CLIs via mise.
bash "$DIR/common.sh"
