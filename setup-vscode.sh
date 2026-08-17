#!/usr/bin/env bash
# Link the VS Code user config in this repo into the OS-specific user dir:
#   macOS  ~/Library/Application Support/Code/User
#   Linux  ${XDG_CONFIG_HOME:-~/.config}/Code/User
# settings.json is shared; keybindings.json is picked per OS (cmd vs ctrl).
# Real files found in place are moved aside to *.bak before linking.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$DIR/.config/Code/User"

case "$(uname -s)" in
  Darwin)
    USER_DIR="$HOME/Library/Application Support/Code/User"
    KEYMAP="keybindings.macos.json"
    ;;
  Linux)
    USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Code/User"
    KEYMAP="keybindings.linux.json"
    ;;
  *)
    echo "==> Unknown OS $(uname -s) — skipping VS Code config" >&2
    exit 0
    ;;
esac

link() {
  src="$1"
  dst="$2"
  if [ ! -e "$src" ]; then
    echo "==> missing $src" >&2
    return 1
  fi
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    mv "$dst" "$dst.bak"
    echo "   backup: $dst -> $dst.bak"
  fi
  ln -sfn "$src" "$dst"
  echo "   link:   $dst -> $src"
}

echo "==> Linking VS Code config"
mkdir -p "$USER_DIR"
link "$SRC/settings.json" "$USER_DIR/settings.json"
link "$SRC/$KEYMAP" "$USER_DIR/keybindings.json"
