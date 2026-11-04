#!/bin/sh
# Opens a Zed project in Herdr: shows the space for its folder (made if
# missing), and with a file, shows it in the Files panel (my-files) at a line.
# Zed tasks run it: herdr-open.sh "$ZED_WORKTREE_ROOT" ["$ZED_FILE" ["$ZED_ROW"]]
# Local projects only: in a Zed remote project, tasks run on the remote.
set -eu
root=${1:?usage: herdr-open.sh <folder> [file [line]]}
file=${2:-}
line=${3:-}
PATH=$HOME/.local/bin:$PATH

# Start the window if it isn't up, then bring it to the front.
if ! herdr-app status >/dev/null 2>&1; then
  open -a Herdr
  i=0
  until herdr-app status >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -gt 50 ] && { echo "Herdr did not start" >&2; exit 1; }
    sleep 0.2
  done
fi
open -a Herdr

# A space on this computer with this folder, else one named like it.
space=$(herdr-app ls | ROOT=$root python3 -c '
import json, os, sys
root = os.environ["ROOT"].rstrip("/")
spaces = [s for s in json.load(sys.stdin)["spaces"] if not s.get("machine")]
match = [s for s in spaces if (s.get("folder") or "").rstrip("/") == root] \
     or [s for s in spaces if s.get("name") == os.path.basename(root)]
print(match[0]["id"] if match else "")')

if [ -n "$space" ]; then
  herdr-app do space.select --id "$space" >/dev/null
else
  herdr-app do space.new --name "$(basename "$root")" --folder "$root" --machine "" >/dev/null
fi

if [ -n "$file" ]; then
  herdr-app do layout.select '{"stack":"panel-body","child":"files"}' >/dev/null
  herdr-app do layout.show '{"id":"panel"}' >/dev/null
  sleep 0.3 # the panel's mod receives commands once shown
  herdr-app do "my-files.open:$file${line:+:$line}" >/dev/null
fi
