#!/usr/bin/env bash
# SF Pro Text, Apple's system font in its small-size cut, installed as a named
# family. Herdr's UI uses it (ui_font in .config/herdr-app/settings.json):
# Herdr draws ".SystemUIFont" with tighter spacing than native macOS apps.
#
# Installs into ~/Library/Fonts from Apple's download, without sudo (Homebrew's
# font-sf-pro cask runs a pkg installer, which needs it). macOS only; skipped
# once installed.
set -euo pipefail

[ "$(uname -s)" = Darwin ] || exit 0

FONTS="$HOME/Library/Fonts"
URL=https://devimages-cdn.apple.com/design/resources/download/SF-Pro.dmg

if [ -e "$FONTS/SF-Pro-Text-Regular.otf" ]; then
  echo "==> SF Pro Text already installed"
  exit 0
fi

echo "==> Installing SF Pro Text into $FONTS"
tmp="$(mktemp -d)"
trap 'hdiutil detach -quiet "$tmp/mnt" 2>/dev/null || true; rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/SF-Pro.dmg" "$URL"
# hdiutil warns that attach is deprecated; show its errors only on failure.
if ! hdiutil attach -quiet -nobrowse -readonly -mountpoint "$tmp/mnt" "$tmp/SF-Pro.dmg" 2>"$tmp/err"; then
  grep -v deprecated "$tmp/err" >&2
  exit 1
fi
pkgutil --expand-full "$tmp"/mnt/*.pkg "$tmp/pkg" >/dev/null
mkdir -p "$FONTS"
find "$tmp/pkg" -name 'SF-Pro-Text-*.otf' -exec cp {} "$FONTS/" \;
echo "   installed $(ls "$FONTS"/SF-Pro-Text-*.otf | wc -l | tr -d ' ') font files"
