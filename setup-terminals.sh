#!/usr/bin/env bash
# Point terminals whose font lives outside a linkable config file at the shared
# code + terminal font (installed by packages/maple-mono.sh). Idempotent.
#   Ghostty  .config/ghostty/config is linked by files.sh; on macOS, move aside
#            the Application Support copy, which loads later and overrides it.
#   iTerm2   every profile's ASCII and non-ASCII font, keeping their sizes.
#   Rex      the workspace terminal font; no fading of unfocused split panes.
#   GNOME Terminal (Linux)  the default profile's font.
# Herdr's font is set in .config/herdr-app/settings*.json; herdr-core has none.
set -euo pipefail

FAMILY="Maple Mono NF"
POSTSCRIPT="MapleMono-NF-Regular" # iTerm2 stores "<PostScript name> <size>"
DEFAULT_SIZE=14

echo "==> Setting terminal fonts to $FAMILY"

ghostty_macos() {
  local cfg="$HOME/Library/Application Support/com.mitchellh.ghostty/config"
  if [ -f "$cfg" ] && [ ! -L "$cfg" ]; then
    mv "$cfg" "$cfg.bak"
    echo "   ghostty: moved $cfg -> $cfg.bak (repo config now applies)"
  fi
}

iterm2() {
  local domain=com.googlecode.iterm2
  defaults read "$domain" "New Bookmarks" >/dev/null 2>&1 || return 0
  # iTerm2 writes its in-memory preferences back on quit, undoing edits.
  if pgrep -xq iTerm2; then
    echo "   iterm2: running — quit it and re-run ./setup-terminals.sh" >&2
    return 0
  fi
  local tmp i key font size changed=0
  tmp="$(mktemp)"
  defaults export "$domain" "$tmp"
  i=0
  while plutil -extract "New Bookmarks.$i" xml1 -o /dev/null "$tmp" 2>/dev/null; do
    for key in "Normal Font" "Non Ascii Font"; do
      font="$(plutil -extract "New Bookmarks.$i.$key" raw -o - "$tmp" 2>/dev/null || true)"
      size="${font##* }"
      case "$size" in ''|*[!0-9.]*) size="$DEFAULT_SIZE" ;; esac
      if [ "$font" != "$POSTSCRIPT $size" ]; then
        plutil -replace "New Bookmarks.$i.$key" -string "$POSTSCRIPT $size" "$tmp"
        changed=1
      fi
    done
    i=$((i + 1))
  done
  if [ "$changed" -eq 1 ]; then
    defaults import "$domain" "$tmp"
    echo "   iterm2: updated $i profile(s)"
  else
    echo "   iterm2: already set"
  fi
  rm -f "$tmp"
}

rex() {
  local domain=com.superlogical.rex key=Workspace.terminalFontName
  defaults read "$domain" >/dev/null 2>&1 || return 0
  if [ "$(defaults read "$domain" "$key" 2>/dev/null || true)" = "$FAMILY" ]; then
    echo "   rex: already set"
  else
    defaults write "$domain" "$key" -string "$FAMILY"
    echo "   rex: updated (restart Rex to apply)"
  fi
  # Settings > Panes > Fade inactive panes > None (default fades surface & content).
  key=Workspace.inactivePaneFadeMode
  if [ "$(defaults read "$domain" "$key" 2>/dev/null || true)" != none ]; then
    defaults write "$domain" "$key" -string none
    echo "   rex: inactive pane fading disabled"
  fi
}

gnome_terminal() {
  command -v gsettings >/dev/null 2>&1 || return 0
  gsettings list-schemas 2>/dev/null | grep -qx org.gnome.Terminal.ProfilesList || return 0
  local id path size
  id="$(gsettings get org.gnome.Terminal.ProfilesList default | tr -d "'")"
  [ -n "$id" ] || return 0
  path="org.gnome.Terminal.Legacy.Profile:/org/gnome/terminal/legacy/profiles:/:$id/"
  size="$(gsettings get "$path" font | tr -d "'" | awk '{print $NF}')"
  case "$size" in ''|*[!0-9.]*) size="$DEFAULT_SIZE" ;; esac
  gsettings set "$path" font "$FAMILY $size"
  gsettings set "$path" use-system-font false
  echo "   gnome-terminal: default profile set"
}

case "$(uname -s)" in
  Darwin)
    ghostty_macos
    iterm2
    rex
    ;;
  Linux)
    gnome_terminal
    ;;
esac
