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
  echo "==> Non-apt Linux — install manually: fzf zoxide bat neovim jq gh" >&2
fi

# GitHub CLI (gh): not in default Ubuntu repos — add GitHub's official apt repo.
# Used by setup-git-signing.sh to verify the SSH signing key on GitHub.
if command -v apt-get >/dev/null 2>&1 && ! command -v gh >/dev/null 2>&1; then
  echo "==> installing GitHub CLI (gh)"
  sudo mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y gh
fi

# mise has no apt package; use the official installer.
command -v mise >/dev/null 2>&1 || curl -fsSL https://mise.run | sh

# Shared global runtimes/CLIs via mise.
bash "$DIR/common.sh"
