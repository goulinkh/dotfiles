#!/usr/bin/env bash
# Verify the local SSH signing key is already registered as a signing key
# on GitHub. Read-only: never uploads, never refreshes scopes, never prompts.
#
# Silent no-op when gh is missing, not authenticated, or the key file is absent.
# Exits 0 in all skip/found paths; non-zero only on hard error reading GitHub.
set -euo pipefail

KEY_FILE="${SIGNING_KEY_FILE:-$HOME/.ssh/id_ed25519.pub}"

if ! command -v gh >/dev/null 2>&1; then
  echo "==> git signing: gh not installed, skipping GitHub key check"
  exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "==> git signing: gh not authenticated, skipping (run: gh auth login)"
  exit 0
fi

if [ ! -r "$KEY_FILE" ]; then
  echo "==> git signing: $KEY_FILE not readable, skipping" >&2
  exit 0
fi

echo "==> git signing: checking GitHub for $KEY_FILE"

# Match on the base64 body (field 2 of an OpenSSH pubkey line). Title and the
# trailing comment drift across machines; the body is the identity.
local_body="$(awk '{print $2}' "$KEY_FILE")"
if [ -z "$local_body" ]; then
  echo "   $KEY_FILE has no key body, skipping" >&2
  exit 0
fi

# /user/ssh_signing_keys requires read:ssh_signing_key (read) or
# admin:ssh_signing_key (read+write). gh's default login does not include either.
if ! remote_bodies="$(gh api -H 'Accept: application/vnd.github+json' /user/ssh_signing_keys \
  --jq '.[].key' 2>&1)"; then
  if printf '%s\n' "$remote_bodies" | grep -qiE 'scope|admin:ssh_signing_key|read:ssh_signing_key'; then
    echo "   gh token lacks read:ssh_signing_key scope; cannot verify GitHub-side registration" >&2
    echo "   to enable read-only check: gh auth refresh -h github.com -s read:ssh_signing_key" >&2
    exit 0
  fi
  echo "   gh api /user/ssh_signing_keys failed:" >&2
  printf '%s\n' "$remote_bodies" | sed 's/^/   /' >&2
  exit 1
fi

if printf '%s\n' "$remote_bodies" | awk '{print $2}' | grep -qxF "$local_body"; then
  echo "   ok: $KEY_FILE is registered as a GitHub signing key"
  exit 0
fi

echo "   warning: $KEY_FILE is NOT registered as a GitHub signing key" >&2
echo "   commits will sign locally but show 'Unverified' on github.com" >&2
echo "   to fix: upload the public key at https://github.com/settings/ssh/new (key type: Signing Key)" >&2
exit 0
