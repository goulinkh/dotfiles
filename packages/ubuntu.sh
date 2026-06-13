#!/usr/bin/env bash
# Ubuntu/Debian tools via apt (+ mise installer). Idempotent.
set -euo pipefail

if command -v apt-get >/dev/null 2>&1; then
  echo "==> apt install (sudo)"
  sudo apt-get update -qq
  # bat installs as `batcat` on Ubuntu; .alias.zsh handles that.
  sudo apt-get install -y fzf zoxide bat neovim jq curl git
else
  echo "==> Non-apt Linux — install manually: fzf zoxide bat neovim jq" >&2
fi

# mise has no apt package; use the official installer.
command -v mise >/dev/null 2>&1 || curl -fsSL https://mise.run | sh
