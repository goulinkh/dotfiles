#!/bin/bash
# caveman — statusline badge script for Claude Code
# Reads the caveman mode flag file and outputs a colored badge,
# plus token usage from the JSON input on stdin.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/caveman-statusline.sh" }
#
# Plugin users: Claude will offer to set this up on first session.
# Standalone users: install.sh wires this automatically.

# Read JSON input from stdin (Claude Code passes session data here)
INPUT=$(cat)

# --- Token usage ---
USED_PCT=$(printf '%s' "$INPUT" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)
TOTAL=$(printf '%s' "$INPUT" | jq -r '.context_window.total_input_tokens // empty' 2>/dev/null)
CTX_SIZE=$(printf '%s' "$INPUT" | jq -r '.context_window.context_window_size // empty' 2>/dev/null)

TOKEN_PART=""
if [ -n "$USED_PCT" ] && [ -n "$TOTAL" ] && [ -n "$CTX_SIZE" ]; then
  # Format total tokens: show as k (e.g. 42k) for readability
  TOTAL_K=$(awk "BEGIN { printf \"%.0fk\", $TOTAL/1000 }")
  PCT_INT=$(printf '%.0f' "$USED_PCT")

  # Pick color based on usage percentage
  if [ "$PCT_INT" -ge 80 ]; then
    COLOR='\033[38;5;196m'   # red
  elif [ "$PCT_INT" -ge 50 ]; then
    COLOR='\033[38;5;214m'   # orange
  else
    COLOR='\033[38;5;71m'    # green
  fi

  TOKEN_PART=$(printf "${COLOR}[%s/%s %s%%]\033[0m" "$TOTAL_K" "$(awk "BEGIN { printf \"%.0fk\", $CTX_SIZE/1000 }")" "$PCT_INT")
fi

# --- Caveman badge ---
FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.caveman-active"

CAVEMAN_PART=""
# Refuse symlinks — security hardening
if [ ! -L "$FLAG" ] && [ -f "$FLAG" ]; then
  # Hard-cap the read at 64 bytes and strip anything outside [a-z0-9-]
  MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
  MODE=$(printf '%s' "$MODE" | tr -cd 'a-z0-9-')

  # Whitelist only known modes
  case "$MODE" in
    off|lite|full|ultra|wenyan-lite|wenyan|wenyan-full|wenyan-ultra|commit|review|compress)
      if [ -z "$MODE" ] || [ "$MODE" = "full" ]; then
        CAVEMAN_PART=$(printf '\033[38;5;172m[CAVEMAN]\033[0m')
      else
        SUFFIX=$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')
        CAVEMAN_PART=$(printf '\033[38;5;172m[CAVEMAN:%s]\033[0m' "$SUFFIX")
      fi
      ;;
  esac
fi

# --- Assemble output ---
OUTPUT=""
[ -n "$TOKEN_PART" ] && OUTPUT="$TOKEN_PART"
if [ -n "$CAVEMAN_PART" ]; then
  [ -n "$OUTPUT" ] && OUTPUT="$OUTPUT "
  OUTPUT="$OUTPUT$CAVEMAN_PART"
fi

[ -n "$OUTPUT" ] && printf '%s' "$OUTPUT"
