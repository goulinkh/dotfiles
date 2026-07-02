#!/usr/bin/env bash
# Install caveman mode into Claude Code from the vendored copies in this repo.
#   - hook scripts + skills are symlinked by install.sh/sync.sh (see files.sh)
#   - this script makes the statusline executable and idempotently wires the
#     caveman hooks + statusline into ~/.claude/settings.json
# Safe to re-run: existing caveman entries are detected and left untouched.
# No network access — everything comes from ~/.claude/hooks (repo-vendored).
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"

if ! command -v node >/dev/null 2>&1; then
  echo "   caveman: node not found — skipping settings wiring" >&2
  exit 0
fi

if [ ! -e "$HOOKS_DIR/caveman-activate.js" ]; then
  echo "   caveman: $HOOKS_DIR not linked yet — run install.sh first" >&2
  exit 0
fi

# Statusline must be executable (chmod follows the symlink to the repo file).
chmod +x "$HOOKS_DIR/caveman-statusline.sh" 2>/dev/null || true

# Ensure a settings file exists before merging.
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

CAVEMAN_SETTINGS="$SETTINGS" CAVEMAN_HOOKS_DIR="$HOOKS_DIR" node -e '
  const fs = require("fs");
  const path = process.env.CAVEMAN_SETTINGS;
  const hooks = process.env.CAVEMAN_HOOKS_DIR;
  const statusCmd = "bash \"" + hooks + "/caveman-statusline.sh\"";
  const s = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!s.hooks) s.hooks = {};
  let changed = false;

  const has = (arr) => (arr || []).some(e =>
    e.hooks && e.hooks.some(h => h.command && h.command.includes("caveman")));

  if (!has(s.hooks.SessionStart)) {
    (s.hooks.SessionStart = s.hooks.SessionStart || []).push({
      hooks: [{ type: "command", command: "node \"" + hooks + "/caveman-activate.js\"", timeout: 5, statusMessage: "Loading caveman mode..." }]
    });
    changed = true;
  }
  if (!has(s.hooks.UserPromptSubmit)) {
    (s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit || []).push({
      hooks: [{ type: "command", command: "node \"" + hooks + "/caveman-mode-tracker.js\"", timeout: 5, statusMessage: "Tracking caveman mode..." }]
    });
    changed = true;
  }
  if (!s.statusLine) {
    s.statusLine = { type: "command", command: statusCmd };
    changed = true;
  } else {
    const cmd = typeof s.statusLine === "string" ? s.statusLine : (s.statusLine.command || "");
    if (!cmd.includes("caveman-statusline.sh"))
      console.log("   caveman: existing statusline kept — badge not added");
  }

  if (changed) {
    fs.writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
    console.log("   caveman: hooks wired into settings.json");
  } else {
    console.log("   caveman: already installed");
  }
'
