#!/usr/bin/env bash
# Set up Pi's long-term memory (pi-jev-wiki) on this machine:
#   1. clone the private vault (goulinkh/pi-wiki-vault) to ~/pi-wiki-vault, seeding it if empty
#   2. write ~/.pi/agent/jev-wiki.json from the template (absolute paths differ per OS)
#   3. install a 15-minute background sync: launchd on macOS, a systemd user timer on Ubuntu
# The jev-wiki-vault Pi extension does the rest at session start: per-project pointers,
# the OpenRouter key file (from /login openrouter), and syncing after work.
# Safe to re-run; install.sh and sync.sh call it.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT="$DIR/.pi/agent/extensions/jev-wiki-vault"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
VAULT="${PI_WIKI_VAULT:-$HOME/pi-wiki-vault}"
REMOTE="${PI_WIKI_VAULT_REMOTE:-git@github.com:goulinkh/pi-wiki-vault.git}"
SYNC="$AGENT_DIR/extensions/jev-wiki-vault/vault-sync.sh"
LABEL="com.goulinkh.pi-wiki-vault-sync"

echo "==> Pi memory vault (pi-jev-wiki)"

if [ ! -d "$VAULT/.git" ]; then
  if ! GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15" git clone -q "$REMOTE" "$VAULT" 2>/dev/null; then
    echo "   could not clone $REMOTE — check SSH access to GitHub, then re-run: ./setup-pi-wiki.sh" >&2
    exit 1
  fi
  echo "   cloned $REMOTE -> $VAULT"
fi

# Seed a fresh vault with its README, ignore rules, merge rules, and project aliases.
for f in README.md .gitignore .gitattributes projects.json; do
  [ -e "$VAULT/$f" ] || { cp "$EXT/vault-template/$f" "$VAULT/$f"; echo "   seeded $f"; }
done
mkdir -p "$VAULT/global" "$VAULT/projects"

# Background commits must not need a signing key or a prompt.
git -C "$VAULT" symbolic-ref -q HEAD >/dev/null || git -C "$VAULT" checkout -q main
git -C "$VAULT" rev-parse -q --verify HEAD >/dev/null || git -C "$VAULT" symbolic-ref HEAD refs/heads/main
git -C "$VAULT" config commit.gpgsign false
git -C "$VAULT" config branch.main.remote origin
git -C "$VAULT" config branch.main.merge refs/heads/main

# pi-jev-wiki config: resolve paths for this machine.
escape() { printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'; }
rendered="$(sed -e "s|\${PI_AGENT_DIR}|$(escape "$AGENT_DIR")|g" \
                -e "s|\${PI_WIKI_VAULT}|$(escape "$VAULT")|g" "$EXT/jev-wiki.template.json")"
mkdir -p "$AGENT_DIR"
# Compare as JSON when jq is available: pi-jev-wiki reformats the file when it saves settings.
same_config() {
  [ -e "$AGENT_DIR/jev-wiki.json" ] || return 1
  if command -v jq >/dev/null 2>&1; then
    [ "$(jq -S . "$AGENT_DIR/jev-wiki.json" 2>/dev/null)" = "$(printf '%s' "$rendered" | jq -S .)" ]
  else
    [ "$(cat "$AGENT_DIR/jev-wiki.json")" = "$rendered" ]
  fi
}
if ! same_config; then
  [ -e "$AGENT_DIR/jev-wiki.json" ] && cp "$AGENT_DIR/jev-wiki.json" "$AGENT_DIR/jev-wiki.json.bak"
  printf '%s\n' "$rendered" >"$AGENT_DIR/jev-wiki.json"
  echo "   wrote $AGENT_DIR/jev-wiki.json (edit the template in dotfiles, not this file)"
fi
chmod +x "$EXT/vault-sync.sh"

case "$(uname -s)" in
  Darwin)
    plist="$HOME/Library/LaunchAgents/$LABEL.plist"
    mkdir -p "$(dirname "$plist")"
    content="$(cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$SYNC</string><string>sync</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>PI_WIKI_VAULT</key><string>$VAULT</string>
  </dict>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>/dev/null</string>
  <key>StandardErrorPath</key><string>/dev/null</string>
</dict>
</plist>
EOF
)"
    if [ "$(cat "$plist" 2>/dev/null)" != "$content" ] || ! launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
      printf '%s\n' "$content" >"$plist"
      launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
      if launchctl bootstrap "gui/$(id -u)" "$plist" 2>/dev/null; then
        echo "   launchd: $LABEL syncs every 15 minutes"
      else
        echo "   launchd: could not load $plist (log in to a GUI session and re-run)" >&2
      fi
    fi
    ;;
  Linux)
    if systemctl --user show-environment >/dev/null 2>&1; then
      units="$HOME/.config/systemd/user"
      mkdir -p "$units"
      cat >"$units/pi-wiki-vault-sync.service" <<EOF
[Unit]
Description=Sync the Pi memory vault (pi-jev-wiki)
After=network-online.target

[Service]
Type=oneshot
Environment=PI_WIKI_VAULT=$VAULT
ExecStart=/bin/bash $SYNC sync
EOF
      cat >"$units/pi-wiki-vault-sync.timer" <<EOF
[Unit]
Description=Sync the Pi memory vault every 15 minutes

[Timer]
OnCalendar=*:0/15
RandomizedDelaySec=60
Persistent=true

[Install]
WantedBy=timers.target
EOF
      systemctl --user daemon-reload
      systemctl --user enable --now pi-wiki-vault-sync.timer >/dev/null 2>&1 \
        && echo "   systemd: pi-wiki-vault-sync.timer syncs every 15 minutes" \
        || echo "   systemd: could not enable pi-wiki-vault-sync.timer" >&2
    else
      echo "   no systemd user session — Pi still syncs on session start, after work, and at exit" >&2
    fi
    ;;
esac

if ! jq -e '.openrouter.key // empty' "$AGENT_DIR/auth.json" >/dev/null 2>&1; then
  echo "   next: run /login openrouter in Pi so the wiki can reach Jev"
fi
