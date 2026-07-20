#!/usr/bin/env bash
# Update dotfiles to latest:
#   1. pull the repo
#   2. re-link any new files (via install.sh, no shell exec)
#   3. update zsh4humans + plugins
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FORCE=0
for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=1 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

# Guard: repo .zsh.local is a template only. Abort if a credential-named var
# (TOKEN/SECRET/KEY/PASS/CREDENTIAL/AUTH) carries a real literal value, so no
# secret gets pulled into / pushed from version control. Non-secret config
# (usernames, hosts, URLs, model slugs) may keep literal values.
# A value is "real" if, stripped of quotes, it is non-empty and not a $VAR ref.
leaked="$(awk '
  /^export [A-Z_]+=/ {
    eq = index($0, "=")
    key = substr($0, 8, eq - 8)
    if (key !~ /(TOKEN|SECRET|KEY|PASS|CREDENTIAL|AUTH)/) next
    v = substr($0, eq + 1)
    sub(/[[:space:]]*#.*$/, "", v)
    gsub(/^["'\'']|["'\'']$/, "", v)
    if (v != "" && v !~ /^\$\{?[A-Za-z_]/) print NR": "$0
  }' "$DIR/.zsh.local" 2>/dev/null)"
if [ -n "$leaked" ]; then
  echo "ERROR: repo .zsh.local has non-empty values — secrets belong in ~/.zsh.local, not the repo:" >&2
  echo "$leaked" | sed 's/^/   /' >&2
  exit 1
fi

echo "==> Pulling repo"
if [ "$FORCE" -eq 1 ]; then
  branch="$(git -C "$DIR" rev-parse --abbrev-ref HEAD)"
  git -C "$DIR" fetch origin
  echo "   force: discarding local changes"
  git -C "$DIR" reset --hard "origin/$branch"
else
  git -C "$DIR" pull --ff-only
fi

echo "==> Re-linking dotfiles"
source "$DIR/files.sh"
for f in "${FILES[@]}"; do
  src="$DIR/$f"
  dst="$HOME/$f"
  [ -e "$src" ] || continue
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    mv "$dst" "$dst.bak"
    echo "   backup: $dst -> $dst.bak"
  fi
  mkdir -p "$(dirname "$dst")"
  ln -sfn "$src" "$dst"
done
echo "   done"

bash "$DIR/remove-caveman.sh" || echo "   caveman cleanup failed — re-run: ./remove-caveman.sh" >&2

# Surface new secret keys added to the example since last sync.
if [ -e "$HOME/.zsh.local" ]; then
  missing="$(grep -oE '^export [A-Z_]+' "$DIR/.zsh.local" 2>/dev/null \
    | awk '{print $2}' \
    | while read -r k; do grep -q "^export $k" "$HOME/.zsh.local" || echo "$k"; done)"
  if [ -n "$missing" ]; then
    echo "==> New keys in repo .zsh.local missing from ~/.zsh.local:"
    echo "$missing" | sed 's/^/   /'
  fi
fi

# Register the local SSH signing key with GitHub when gh is authenticated.
bash "$DIR/setup-git-signing.sh" || echo "   git signing setup failed — re-run: ./setup-git-signing.sh" >&2

# Re-wire the vendored omp swarm extension (deps symlinks, smoke check).
bash "$DIR/setup-swarm.sh" || echo "   swarm wiring failed — re-run: ./setup-swarm.sh" >&2


echo "==> Updating zsh4humans + plugins"
if command -v zsh >/dev/null 2>&1; then
  zsh -ic 'z4h update' || echo "   z4h update needs an interactive shell; run 'z4h update' manually"
fi
