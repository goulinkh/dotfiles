#!/usr/bin/env bash
# Remove caveman leftovers from an environment that previously ran this dotfiles repo.
set -euo pipefail

removed=0

remove_path() {
  local path="$1"
  if [ -e "$path" ] || [ -L "$path" ]; then
    rm -rf "$path"
    echo "   removed: $path"
    removed=1
  fi
}

scrub_claude_settings() {
  local settings="$HOME/.claude/settings.json"
  [ -f "$settings" ] || return 0
  command -v node >/dev/null 2>&1 || return 0

  set +e
  CLAUDE_SETTINGS="$settings" node <<'NODE'
const fs = require('fs');
const path = process.env.CLAUDE_SETTINGS;
let data;
try {
  data = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch {
  process.exit(0);
}
let changed = false;

function scrubHookList(list) {
  if (!Array.isArray(list)) return list;
  const next = list
    .map(entry => {
      if (!entry || !Array.isArray(entry.hooks)) return entry;
      const hooks = entry.hooks.filter(h => !String(h && h.command || '').includes('caveman'));
      if (hooks.length !== entry.hooks.length) changed = true;
      return hooks.length ? { ...entry, hooks } : null;
    })
    .filter(Boolean);
  if (next.length !== list.length) changed = true;
  return next;
}

if (data.hooks && typeof data.hooks === 'object') {
  for (const event of Object.keys(data.hooks)) {
    data.hooks[event] = scrubHookList(data.hooks[event]);
    if (Array.isArray(data.hooks[event]) && data.hooks[event].length === 0) {
      delete data.hooks[event];
      changed = true;
    }
  }
  if (Object.keys(data.hooks).length === 0) {
    delete data.hooks;
    changed = true;
  }
}

if (data.statusLine && String(data.statusLine.command || '').includes('caveman')) {
  delete data.statusLine;
  changed = true;
}

if (data.extraKnownMarketplaces && data.extraKnownMarketplaces.caveman) {
  delete data.extraKnownMarketplaces.caveman;
  changed = true;
  if (Object.keys(data.extraKnownMarketplaces).length === 0) delete data.extraKnownMarketplaces;
}

if (changed) fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
process.exit(changed ? 2 : 0);
NODE
  local status=$?
  set -e
  if [ "$status" = 2 ]; then
    echo "   scrubbed: $settings"
    removed=1
  elif [ "$status" != 0 ]; then
    return "$status"
  fi
}

echo "==> Removing caveman leftovers"
remove_path "$HOME/.claude/hooks/caveman-activate.js"
remove_path "$HOME/.claude/hooks/caveman-config.js"
remove_path "$HOME/.claude/hooks/caveman-mode-tracker.js"
remove_path "$HOME/.claude/hooks/caveman-statusline.sh"
remove_path "$HOME/.claude/skills/caveman"
remove_path "$HOME/.claude/skills/caveman-compress"
remove_path "$HOME/.claude/.caveman-active"
remove_path "$HOME/.agents/skills/caveman"
remove_path "${XDG_CONFIG_HOME:-$HOME/.config}/caveman"
scrub_claude_settings

if [ "$removed" = 0 ]; then
  echo "   none found"
fi
