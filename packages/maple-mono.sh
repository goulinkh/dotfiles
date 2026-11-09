#!/usr/bin/env bash
# Maple Mono Nerd Font, from the latest maple-font GitHub release.
# The code and terminal font for Zed, VS Code, Herdr, Ghostty, iTerm2, Rex,
# and GNOME Terminal, as the family "Maple Mono NF".
#
# Installs every TTF into the user font dir, without sudo:
#   macOS: ~/Library/Fonts
#   Linux: ~/.local/share/fonts/MapleMonoNF (then refreshes fontconfig)
# Skipped once installed.
set -euo pipefail

URL=https://github.com/subframe7536/maple-font/releases/latest/download/MapleMono-NF.zip
MARKER=MapleMono-NF-Regular.ttf

case "$(uname -s)" in
  Darwin) FONTS="$HOME/Library/Fonts" ;;
  Linux)  FONTS="$HOME/.local/share/fonts/MapleMonoNF" ;;
  *)      exit 0 ;;
esac

if [ -e "$FONTS/$MARKER" ]; then
  echo "==> Maple Mono NF already installed"
  exit 0
fi

echo "==> Installing Maple Mono NF into $FONTS"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/font.zip" "$URL"
unzip -q "$tmp/font.zip" -d "$tmp/font"
mkdir -p "$FONTS"
find "$tmp/font" -name '*.ttf' -exec cp {} "$FONTS/" \;
if [ "$(uname -s)" = Linux ] && command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$FONTS" >/dev/null
fi
echo "   installed $(ls "$FONTS"/MapleMono-NF-*.ttf | wc -l | tr -d ' ') font files"
