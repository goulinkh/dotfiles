#!/usr/bin/env bash
# macOS tools via Homebrew (+ colorls gem). Idempotent.
set -euo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "==> Homebrew missing — install from https://brew.sh then re-run" >&2
  exit 1
fi

echo "==> brew install"
brew install fzf zoxide bat neovim jq mise

# colorls is a Ruby gem, not a formula.
command -v colorls >/dev/null 2>&1 || gem install colorls
