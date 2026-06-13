#!/usr/bin/env bash
# Install CLI tools the dotfiles expect, per OS.
#   macOS  -> Homebrew (+ colorls gem)
#   Ubuntu -> apt (+ mise via mise.run)
# Aliases in .alias.zsh are guarded, so anything missing just degrades quietly;
# this script gets a fresh box to the full set. Safe to re-run (idempotent).
set -euo pipefail

# Core tools wired up in .zshrc / .alias.zsh.
#   fzf zoxide bat neovim jq mise  (+ colorls on macOS)
case "$(uname -s)" in
  Darwin)
    if ! command -v brew >/dev/null 2>&1; then
      echo "==> Homebrew missing — install from https://brew.sh then re-run" >&2
      exit 1
    fi
    echo "==> brew install"
    brew install fzf zoxide bat neovim jq mise
    # colorls is a Ruby gem, not a formula.
    command -v colorls >/dev/null 2>&1 || gem install colorls
    ;;
  Linux)
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
    ;;
  *)
    echo "==> Unknown OS $(uname -s) — skipping package install" >&2
    ;;
esac

echo "==> packages done"
