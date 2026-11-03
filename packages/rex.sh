#!/usr/bin/env bash
# Rex server on Linux: install it, or update the copy that's already there.
#
#   packages/rex.sh           install Rex if it's missing, otherwise update it
#   packages/rex.sh --update  update only; skip machines without Rex
#
# macOS is skipped: the Rex app ships and runs its own server.
#
# An existing install keeps its layout:
#   ~/.local/bin/rex   standalone binary, replaced from the release archive
#                      without sudo
#   /usr/bin/rex       apt package from the Rex repository (used for new
#                      installs on apt systems)
# New installs also get a personal server: the systemd user unit rex.service,
# serving the local socket and the built-in Tailscale node. An existing unit
# is left alone.
#
# REX_CHANNEL picks the release channel: snapshot (default), preview, stable.
set -euo pipefail

UPDATE_ONLY=0
case "${1:-}" in
  --update) UPDATE_ONLY=1 ;;
  "") ;;
  *) echo "usage: $0 [--update]" >&2; exit 2 ;;
esac

if [ "$(uname -s)" != Linux ]; then
  echo "==> Rex: skipped, the Rex app manages the server on $(uname -s)"
  exit 0
fi

CHANNEL="${REX_CHANNEL:-snapshot}"
LOCAL_BIN="$HOME/.local/bin/rex"
APT_SOURCE=/etc/apt/sources.list.d/rex.sources
UNIT="$HOME/.config/systemd/user/rex.service"

# Print the version a rex binary reports, such as 0.0.1793420730-g6d0d9a.
rex_version() { "$1" version 2>/dev/null | awk 'NR == 1 { print $2 }'; }

# Install or replace ~/.local/bin/rex with the channel's newest Linux build.
# Runs in a subshell so the trap cleans up only its own download.
install_local_binary() (
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) echo "   Rex has no build for $(uname -m)" >&2; exit 1 ;;
  esac
  file="rex-linux-$arch.tar.gz"
  release="$(curl -fsSL "https://blob.superlogical.com/api/releases/rex/$CHANNEL")"
  latest="$(jq -r .version <<<"$release")"
  if [ -x "$LOCAL_BIN" ] && [ "$(rex_version "$LOCAL_BIN")" = "$latest" ]; then
    echo "   $LOCAL_BIN is up to date ($latest)"
    exit 0
  fi
  url="$(jq -r --arg f "$file" '.artifacts[] | select(.filename == $f) | .downloadUrl' <<<"$release")"
  sha="$(jq -r --arg f "$file" '.artifacts[] | select(.filename == $f) | .sha256' <<<"$release")"
  if [ -z "$url" ] || [ -z "$sha" ]; then
    echo "   the $CHANNEL release has no $file" >&2
    exit 1
  fi

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "$url" -o "$tmp/$file"
  echo "$sha  $tmp/$file" | sha256sum -c - >/dev/null
  tar -xzf "$tmp/$file" -C "$tmp"
  # Rename into place so a running server keeps its old binary intact.
  mkdir -p "${LOCAL_BIN%/*}"
  install -m 0755 "$tmp/rex" "$LOCAL_BIN.new"
  mv -f "$LOCAL_BIN.new" "$LOCAL_BIN"
  echo "   installed Rex $latest into $LOCAL_BIN"
)

# Install the rex package with Rex's own script, which adds the repository,
# its signing key, and the pin above Debian's unrelated (R)?ex package.
install_apt_package() {
  curl -fsSL https://pkgs.superlogical.com/rex/install.sh | sh -s -- --channel "$CHANNEL"
}

update_apt_package() {
  sudo apt-get update -qq
  sudo apt-get install -y --only-upgrade rex
}

# Create and start the personal server unit, matching the one on existing hosts.
create_user_service() {
  local bin="$1"
  [ "$bin" = "$LOCAL_BIN" ] && bin='%h/.local/bin/rex'
  echo "   creating $UNIT"
  mkdir -p "${UNIT%/*}"
  cat >"$UNIT" <<EOF
[Unit]
Description=Personal Rex server (Tailscale-only remote access)
Documentation=https://www.superlogical.com/rex/docs/linux/remote-access

[Service]
Type=notify
NotifyAccess=main
WorkingDirectory=%h
Environment=GODEBUG=
ExecStart=$bin server run --listen %t/rex/server.sock --state-dir %h/.local/state/rex --extra-listen tailnet://:7297 --log-format text
Restart=on-failure
RestartSec=5s
RuntimeDirectory=rex
RuntimeDirectoryMode=0700
RuntimeDirectoryPreserve=yes
UMask=0077

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now rex.service
  # Keep the server running while logged out.
  if [ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null)" != yes ]; then
    loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER"
  fi
  echo "   started rex.service; sign its Tailscale node in with: rex server tailscale login"
}

# A server keeps running the binary it started with. Say so instead of
# restarting it here.
report_running_version() {
  local bin="$1" installed running
  systemctl --user is-active --quiet rex.service 2>/dev/null || return 0
  installed="$(rex_version "$bin")"
  running="$("$bin" --autostart=false server status 2>/dev/null | awk '/^version:/ { print $2 }')"
  if [ -n "$running" ] && [ "$running" != "$installed" ]; then
    echo "   rex.service still runs $running; restart it to use $installed:"
    echo "     systemctl --user restart rex   # may end programs running in Rex panes"
  fi
}

if [ -x "$LOCAL_BIN" ]; then
  echo "==> Updating Rex ($LOCAL_BIN, $CHANNEL)"
  install_local_binary
  bin="$LOCAL_BIN"
elif [ -e "$APT_SOURCE" ]; then
  echo "==> Updating Rex (apt package, $(awk '/^Suites:/ { print $2 }' "$APT_SOURCE"))"
  update_apt_package
  bin=/usr/bin/rex
elif [ "$UPDATE_ONLY" = 1 ]; then
  echo "==> Rex not installed; skipping (install with packages/rex.sh)"
  exit 0
else
  echo "==> Installing Rex ($CHANNEL)"
  if command -v apt-get >/dev/null 2>&1; then
    install_apt_package
    bin=/usr/bin/rex
  else
    install_local_binary
    bin="$LOCAL_BIN"
  fi
  [ -e "$UNIT" ] || create_user_service "$bin"
fi

report_running_version "$bin"
