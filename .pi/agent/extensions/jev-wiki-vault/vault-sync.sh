#!/usr/bin/env bash
# Sync the pi-jev-wiki memory vault with its git remote.
#
#   vault-sync.sh [sync]   commit local changes, rebase onto the remote, push (default)
#   vault-sync.sh status   print the last result and any pending conflict
#
# Runs from the jev-wiki-vault Pi extension and from a launchd/systemd timer, so it
# never prompts and never force-pushes. Append-only files merge by union (see the
# vault's .gitattributes); generated files take the remote copy and are rebuilt by
# pi-jev-wiki. Any other conflict aborts the rebase, keeps the local commit, and
# leaves a note in .git/vault-sync-conflict that the extension shows in Pi.
# After a sync that moved HEAD it brings this machine's semantic index up to date
# (reindex.ts), so pages other machines wrote are found by meaning, not just keywords.
# Bash 3.2 compatible (macOS /bin/bash).
set -uo pipefail

VAULT="${PI_WIKI_VAULT:-$HOME/pi-wiki-vault}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-sync}"
BRANCH="main"
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes -o ConnectTimeout=15}"
export GIT_TERMINAL_PROMPT=0
export GIT_EDITOR=true

if [ ! -d "$VAULT/.git" ]; then
  echo "vault-sync: no vault at $VAULT (run ~/dotfiles/setup-pi-wiki.sh)" >&2
  exit 2
fi

GITDIR="$VAULT/.git"
LOCK="$GITDIR/vault-sync.lock"
CONFLICT="$GITDIR/vault-sync-conflict"
STATUS="$GITDIR/vault-sync-status"
LOG="$GITDIR/vault-sync.log"
INDEXED="$GITDIR/vault-index-head"
PAUSED="$GITDIR/vault-sync-paused"

# A local reset must not be automatically committed, pushed, or repopulated.
# Remove this marker only when the user authorizes resuming synchronization.
if [ -f "$PAUSED" ]; then
  case "$MODE" in
    sync | status) echo "vault-sync: paused ($PAUSED)"; exit 0 ;;
  esac
fi

# Background commits (including the ones rebase re-creates) must not need a signing key.
g() { git -C "$VAULT" -c commit.gpgsign=false "$@"; }
log() {
  local line
  line="$(date -u +%FT%TZ) $*"
  echo "$line"
  echo "$line" >>"$LOG"
}
finish() { # finish <exit code> <status message>
  echo "$(date -u +%FT%TZ) $2" >"$STATUS"
  log "$2"
  refresh_index
  exit "$1"
}

# The timers run without the login shell's PATH, where mise puts node.
find_node() {
  local candidate
  for candidate in "${PI_WIKI_NODE:-}" "$HOME/.local/share/mise/shims/node" "$(command -v node 2>/dev/null)"; do
    [ -n "$candidate" ] && [ -x "$candidate" ] && { echo "$candidate"; return 0; }
  done
  return 1
}

# 3. Re-embed what changed since the last indexed HEAD: pages pulled from other machines,
#    new project wikis, deleted ones. A failure is retried on the next run.
refresh_index() {
  local head node out code
  head="$(g rev-parse -q --verify HEAD 2>/dev/null)" || return 0
  [ "$head" = "$(cat "$INDEXED" 2>/dev/null)" ] && return 0
  if ! node="$(find_node)"; then
    log "index: skipped, node not found (set PI_WIKI_NODE)"
    echo "$head" >"$INDEXED"
    return 0
  fi
  out="$("$node" "$HERE/reindex.ts" 2>&1)"
  code=$?
  [ -n "$out" ] && printf '%s\n' "$out" | while IFS= read -r line; do log "index: $line"; done
  case "$code" in
    0 | 3) echo "$head" >"$INDEXED" ;;
    *) [ -n "$out" ] || log "index: failed (exit $code)" ;;
  esac
  return 0
}

if [ "$MODE" = "status" ]; then
  echo "vault:  $VAULT"
  echo "last:   $(cat "$STATUS" 2>/dev/null || echo 'never synced')"
  echo "ahead:  $(g rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo '?') local commit(s) not pushed"
  if [ "$(cat "$INDEXED" 2>/dev/null)" = "$(g rev-parse -q --verify HEAD 2>/dev/null)" ]; then
    echo "index:  up to date with the vault"
  else
    echo "index:  refreshes after the next sync"
  fi
  [ -f "$CONFLICT" ] && { echo "CONFLICT:"; sed 's/^/  /' "$CONFLICT"; }
  exit 0
fi
[ "$MODE" = "sync" ] || { echo "usage: vault-sync.sh [sync|status]" >&2; exit 64; }

# Keep the log small.
if [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt 262144 ]; then
  tail -n 500 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

# One run at a time; mkdir is atomic on macOS and Linux. Break locks older than 10 min.
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then
    rm -rf "$LOCK"
    mkdir "$LOCK" 2>/dev/null || exit 0
  else
    exit 0
  fi
fi
trap 'rm -rf "$LOCK"' EXIT

# Leave the vault alone while pi-jev-wiki holds a write lock (it breaks stale ones at 30 s).
if [ -n "$(find "$VAULT" -path '*/.jev-wiki/lock' -mmin -2 2>/dev/null | head -n 1)" ]; then
  log "a wiki write is in progress; skipping this run"
  exit 0
fi

in_rebase() { [ -d "$GITDIR/rebase-merge" ] || [ -d "$GITDIR/rebase-apply" ]; }
unmerged() { g diff --name-only --diff-filter=U; }

# Resolve conflicts in generated files by taking the remote copy. During a rebase
# "ours" is the branch being rebased onto, i.e. the remote. Returns 1 when other
# conflicted files remain.
resolve_generated() {
  local file remaining=""
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    case "$file" in
      */wiki/index.md | */wiki/toc.md | */wiki/toc/* | */.jev-wiki/toc.json | */.jev-wiki/raw-index.json)
        if g checkout --ours -- "$file" 2>/dev/null; then
          g add -- "$file"
        else
          g rm -q -- "$file" >/dev/null 2>&1 || true
        fi
        ;;
      *) remaining="$remaining $file" ;;
    esac
  done <<EOF
$(unmerged)
EOF
  [ -z "$remaining" ]
}

rebase_onto_remote() {
  g rev-parse -q --verify "refs/remotes/origin/$BRANCH" >/dev/null || return 0 # remote still empty
  g rebase -q "origin/$BRANCH" >/dev/null 2>&1 && return 0
  local rounds=0
  while in_rebase && [ "$rounds" -lt 100 ]; do
    rounds=$((rounds + 1))
    if [ -n "$(unmerged)" ]; then
      resolve_generated || break
    fi
    if ! g rebase --continue >/dev/null 2>&1; then
      # A commit that became empty after resolution is skipped; new conflicts loop.
      [ -z "$(unmerged)" ] && g rebase --skip >/dev/null 2>&1
    fi
  done
  if in_rebase; then
    local files
    files="$(unmerged | tr '\n' ' ')"
    g rebase --abort >/dev/null 2>&1
    {
      echo "Another machine changed the same lines in: $files"
      echo "Local work is safe in a local commit. Fix it with:"
      echo "  cd $VAULT && git pull --rebase   # resolve, then: git rebase --continue && git push"
      echo "or ask Pi to resolve it, then run /vault-sync."
    } >"$CONFLICT"
    return 1
  fi
  return 0
}

g symbolic-ref -q HEAD >/dev/null || finish 2 "error: detached HEAD in $VAULT; check out $BRANCH"
in_rebase && finish 1 "error: a rebase is already in progress in $VAULT; resolve it first"

# 1. Commit local changes.
g add -A
if ! g diff --cached --quiet; then
  projects="$(g diff --cached --name-only | awk -F/ '$1 == "projects" && NF > 2 { print $2; next } { print $1 }' | sort -u | paste -sd, - | sed 's/,/, /g')"
  host="$(hostname -s 2>/dev/null || hostname)"
  g commit -q -m "sync($host): $projects" || finish 2 "error: commit failed"
  log "committed: $projects"
fi
g rev-parse -q --verify HEAD >/dev/null || finish 0 "ok: nothing to sync yet"

# 2. Fetch, rebase, push. Retry once if another machine pushed in between.
attempt=0
while :; do
  attempt=$((attempt + 1))
  g fetch -q origin 2>>"$LOG" || finish 0 "offline: fetch failed; local commits kept for the next run"
  rebase_onto_remote || finish 1 "conflict: see $CONFLICT"
  rm -f "$CONFLICT"
  ahead="$(g rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || g rev-list --count HEAD)"
  [ "$ahead" = "0" ] && finish 0 "ok: up to date"
  if g push -q origin "HEAD:refs/heads/$BRANCH" 2>>"$LOG"; then
    finish 0 "ok: pushed $ahead commit(s)"
  fi
  [ "$attempt" -lt 2 ] || finish 0 "offline: push failed; local commits kept for the next run"
done
