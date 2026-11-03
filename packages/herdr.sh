#!/usr/bin/env bash
# Herdr: install what's missing, update what's there.
#   macOS  the desktop app (Herdr.app) and its terminal runtime, herdr-core (hc)
#   Linux  herdr-core only, so Herdr on another machine can run terminals here
#          (hc machine add <host>). An app that's already installed is updated.
#
# Running terminals stay alive through updates. The app goes first, because
# Herdr warns when the app is older than its core.
set -euo pipefail

RELEASES=https://releases.herdr.dev
# Herdr installs into ~/.local/bin, which a non-interactive shell may lack.
export PATH="$HOME/.local/bin:$PATH"

has() { command -v "$1" >/dev/null 2>&1; }
# Print the version from "<name> X.Y.Z" --version output.
installed_version() { "$1" --version 2>/dev/null | awk 'NR == 1 { print $2 }'; }
# Print the newest release of "app" or "core".
latest_version() { curl -fsSL "$RELEASES/$1/latest.json" | jq -r .version; }

failed=0

if has herdr-app; then
  have="$(installed_version herdr-app)"
  want="$(latest_version app)"
  if [ "$have" = "$want" ]; then
    echo "==> Herdr app is up to date ($have)"
  else
    echo "==> Updating Herdr app ($have -> $want)"
    # Reinstalling is Herdr's update path. An open window keeps running the
    # old version until Herdr restarts.
    if curl -fsSL "$RELEASES/app/install.sh" | sh; then
      if pgrep -f 'Herdr.app/Contents/MacOS/Herdr|herdr-app/herdr-app' >/dev/null 2>&1; then
        echo "   Herdr is open; quit and reopen it to use $want (terminals keep running)"
      fi
    else
      failed=1
    fi
  fi
elif [ "$(uname -s)" = Darwin ]; then
  echo "==> Installing Herdr app"
  # Also installs herdr-core when there's none.
  curl -fsSL "$RELEASES/app/install.sh" | sh || failed=1
fi

if has herdr-core; then
  have="$(installed_version herdr-core)"
  want="$(latest_version core)"
  if [ "$have" = "$want" ]; then
    echo "==> herdr-core is up to date ($have)"
  else
    echo "==> Updating herdr-core ($have -> $want)"
    # Swaps the binary and restarts the core; terminals keep running. A
    # release from a new protocol generation fails here rather than being
    # forced in.
    herdr-core update --version "$want" || failed=1
  fi
else
  echo "==> Installing herdr-core"
  # Into ~/.local/bin, with `hc` beside it unless another hc exists.
  curl -fsSL "$RELEASES/core/install.sh" | sh || failed=1
fi

exit "$failed"
