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
    zsh fzf bat neovim jq curl git xclip wl-clipboard unzip screen htop fontconfig \
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

# Maple Mono Nerd Font: Zed's buffer + terminal font (.config/zed/settings.json).
# Not in apt — pull the patched "NF" build from the maple-font releases into the
# user font dir. Idempotent: skip when fontconfig already sees the family.
if command -v fc-list >/dev/null 2>&1 && fc-list | grep -qi "Maple Mono NF"; then
  echo "==> Maple Mono NF already installed"
else
  echo "==> installing Maple Mono Nerd Font"
  FONT_DIR="$HOME/.local/share/fonts/MapleMonoNF"
  FONT_TMP="$(mktemp -d)"
  FONT_URL="https://github.com/subframe7536/maple-font/releases/latest/download/MapleMono-NF.zip"
  if curl -fsSL "$FONT_URL" -o "$FONT_TMP/MapleMono-NF.zip"; then
    mkdir -p "$FONT_DIR"
    unzip -oq "$FONT_TMP/MapleMono-NF.zip" -d "$FONT_DIR"
    fc-cache -f "$FONT_DIR" >/dev/null
    echo "   installed Maple Mono NF -> $FONT_DIR"
  else
    echo "   Maple Mono NF download failed — install manually from https://github.com/subframe7536/maple-font/releases" >&2
  fi
  rm -rf "$FONT_TMP"
fi

# mise has no apt package; use the official installer.
command -v mise >/dev/null 2>&1 || curl -fsSL https://mise.run | sh

# Shared global runtimes/CLIs via mise.
bash "$DIR/common.sh"
