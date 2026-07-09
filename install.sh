#!/usr/bin/env bash
# Bootstrap this machine:
#   1. symlink dotfiles into $HOME (backing up real files to *.bak)
#   2. seed ~/.zsh.local from the example
#   3. install per-OS CLI tools (packages.sh)
#   4. install zsh4humans + oh-my-zsh plugins on first interactive zsh
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
  mkdir -p "$(dirname "$dst")"
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

# Install per-OS CLI tools (packages/<os>.sh). Set SKIP_PACKAGES=1 to skip.
if [ "${SKIP_PACKAGES:-0}" != "1" ]; then
  case "$(uname -s)" in
    Darwin) pkg=macos ;;
    Linux)  pkg=ubuntu ;;
    *)      pkg="" ; echo "==> Unknown OS $(uname -s) — skipping packages" >&2 ;;
  esac
  if [ -n "$pkg" ]; then
    echo "==> Installing packages ($pkg)"
    bash "$DIR/packages/$pkg.sh" || echo "   package install failed — re-run: ./packages/$pkg.sh" >&2
  fi
fi

# Register the local SSH signing key with GitHub when gh is authenticated.
bash "$DIR/setup-git-signing.sh" || echo "   git signing setup failed — re-run: ./setup-git-signing.sh" >&2


# Make zsh the login shell if it isn't.
ZSH_BIN="$(command -v zsh || true)"
if [ -n "$ZSH_BIN" ] && [ "${SHELL:-}" != "$ZSH_BIN" ]; then
  echo "==> Switching default shell to $ZSH_BIN"
  # zsh must be listed in /etc/shells before chsh accepts it.
  if [ -w /etc/shells ] || sudo -n true 2>/dev/null; then
    grep -qxF "$ZSH_BIN" /etc/shells 2>/dev/null || echo "$ZSH_BIN" | sudo tee -a /etc/shells >/dev/null
  fi
  if chsh -s "$ZSH_BIN"; then
    echo "   default shell now $ZSH_BIN — log out/in to take effect"
  else
    echo "   chsh failed — run manually: chsh -s $ZSH_BIN" >&2
  fi
fi

# Trigger z4h bootstrap + oh-my-zsh plugin install.
# .zshenv downloads z4h; .zshrc runs `z4h install ohmyzsh/ohmyzsh` + `z4h init`.
echo "==> Bootstrapping zsh4humans + oh-my-zsh plugins"
if [ -t 0 ] && [ -t 1 ]; then
  exec "$ZSH_BIN" -l
else
  echo "   no TTY — open a new terminal (or run: zsh -l) to finish z4h setup"
fi
