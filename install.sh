#!/usr/bin/env bash
# Bootstrap this machine:
#   1. symlink dotfiles into $HOME (backing up real files to *.bak)
#   2. seed ~/.zsh.local from the example
#   3. install zsh4humans + oh-my-zsh plugins on first interactive zsh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Files to symlink into $HOME (shared list).
source "$DIR/files.sh"

echo "==> Linking dotfiles"
for f in "${FILES[@]}"; do
  src="$DIR/$f"
  dst="$HOME/$f"
  [ -e "$src" ] || continue
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    mv "$dst" "$dst.bak"
    echo "   backup: $dst -> $dst.bak"
  fi
  ln -sfn "$src" "$dst"
  echo "   link:   $dst -> $src"
done

echo "==> Seeding ~/.zsh.local"
if [ ! -e "$HOME/.zsh.local" ]; then
  cp "$DIR/.zsh.local" "$HOME/.zsh.local"
  echo "   created ~/.zsh.local — fill in secrets: \$EDITOR ~/.zsh.local"
else
  echo "   ~/.zsh.local exists, leaving it"
fi

# Make zsh the login shell if it isn't.
ZSH_BIN="$(command -v zsh || true)"
if [ -n "$ZSH_BIN" ] && [ "${SHELL:-}" != "$ZSH_BIN" ]; then
  echo "==> Default shell is $SHELL, not $ZSH_BIN"
  echo "   run: chsh -s $ZSH_BIN"
fi

# Trigger z4h bootstrap + oh-my-zsh plugin install.
# .zshenv downloads z4h; .zshrc runs `z4h install ohmyzsh/ohmyzsh` + `z4h init`.
echo "==> Bootstrapping zsh4humans + oh-my-zsh plugins"
if [ -t 0 ] && [ -t 1 ]; then
  exec "$ZSH_BIN" -l
else
  echo "   no TTY — open a new terminal (or run: zsh -l) to finish z4h setup"
fi
