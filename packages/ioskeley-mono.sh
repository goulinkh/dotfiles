#!/usr/bin/env bash
# Ioskeley Mono Nerd Font (no-ligatures build), from the latest GitHub release.
# The code and terminal font for Zed, VS Code, and Herdr, as the family
# "IoskeleyMonoNL Nerd Font Mono" (Mono keeps Nerd Font icons one cell wide).
#
# Installs every TTF (Normal + SemiCondensed widths, proportional and Mono
# Nerd Font variants) into the user font dir, without sudo:
#   macOS: ~/Library/Fonts
#   Linux: ~/.local/share/fonts/IoskeleyMono (then refreshes fontconfig)
# Skipped once installed.
set -euo pipefail

URL=https://github.com/ahatem/IoskeleyMono/releases/latest/download/IoskeleyMono-NL-NerdFont.zip
MARKER=IoskeleyMonoNLNerdFontMono-Regular.ttf

case "$(uname -s)" in
  Darwin) FONTS="$HOME/Library/Fonts" ;;
  Linux)  FONTS="$HOME/.local/share/fonts/IoskeleyMono" ;;
  *)      exit 0 ;;
esac

if [ -e "$FONTS/$MARKER" ]; then
  echo "==> Ioskeley Mono NL Nerd Font already installed"
  exit 0
fi

echo "==> Installing Ioskeley Mono NL Nerd Font into $FONTS"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/font.zip" "$URL"
unzip -q "$tmp/font.zip" -d "$tmp/font"
mkdir -p "$FONTS"
find "$tmp/font" -name '*.ttf' -exec cp {} "$FONTS/" \;
if [ "$(uname -s)" = Linux ] && command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$FONTS" >/dev/null
fi
echo "   installed $(ls "$FONTS"/IoskeleyMono*.ttf | wc -l | tr -d ' ') font files"
