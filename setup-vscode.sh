#!/usr/bin/env bash
# Link the VS Code user config in this repo into the OS-specific user dir:
#   macOS  ~/Library/Application Support/Code/User
#   Linux  ${XDG_CONFIG_HOME:-~/.config}/Code/User
# settings.json is shared; keybindings.json is picked per OS (cmd vs ctrl).
# Real files found in place are moved aside to *.bak before linking.
# Extensions listed in EXTENSIONS below are installed if missing — only ones
# that pair with something else in this repo; the rest stay per-machine.
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

# Client half of the omp-send-context plugin (see setup-omp-plugins.sh): it
# captures the selection that Cmd/Ctrl+Alt+K hands to the omp bridge.
EXTENSIONS=(klondikemarlen.omp-send-context)

# macOS ships no `code` on PATH unless the user ran "Install 'code' command".
code_bin() {
  if command -v code >/dev/null 2>&1; then
    command -v code
    return 0
  fi
  app="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
  [ -x "$app" ] && echo "$app"
}

CODE="$(code_bin || true)"
if [ -z "$CODE" ]; then
  echo "   code CLI not found — skipping extensions"
  exit 0
fi

installed="$("$CODE" --list-extensions 2>/dev/null | tr '[:upper:]' '[:lower:]')"
for ext in "${EXTENSIONS[@]}"; do
  if printf '%s\n' "$installed" | grep -qxF "$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"; then
    echo "   ext:    $ext (present)"
  elif "$CODE" --install-extension "$ext" --force >/dev/null 2>&1; then
    echo "   ext:    $ext installed"
  else
    echo "   ext:    $ext FAILED — re-run: code --install-extension $ext" >&2
    exit 1
  fi
done
