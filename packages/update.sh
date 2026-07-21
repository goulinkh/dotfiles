#!/usr/bin/env bash
# Update package managers and CLI tools installed by packages/<os>.sh.
# Best effort: try every updater, then report a failure to the caller.
set -u

failures=0

run_update() {
  local label="$1"
  shift

  echo "==> $label"
  if ! "$@"; then
    echo "   failed: $*" >&2
    failures=$((failures + 1))
  fi
}

case "$(uname -s)" in
  Darwin)
    if command -v brew >/dev/null 2>&1; then
      run_update "Updating Homebrew metadata" brew update
      run_update "Upgrading Homebrew packages" brew upgrade
    fi
    ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then
      run_update "Updating apt metadata" sudo apt-get update -qq
      run_update "Upgrading apt packages" sudo apt-get upgrade -y
    fi
    ;;
esac

# mise.run installs into ~/.local/bin, which may not be on PATH in a fresh shell.
export PATH="$HOME/.local/bin:$PATH"
if command -v mise >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Linux" ]; then
    run_update "Updating mise" mise self-update --yes
  fi
  run_update "Upgrading mise tools" mise upgrade --yes
  run_update "Updating global Node CLIs" mise exec node@26 -- npm install --global pnpm@latest @github/copilot@latest
  run_update "Refreshing mise shims" mise reshim
fi

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
if command -v bun >/dev/null 2>&1; then
  run_update "Updating Bun" bun upgrade
fi

if command -v omp >/dev/null 2>&1; then
  run_update "Updating oh-my-pi" omp update
  run_update "Updating oh-my-pi plugins" omp update --plugins
fi

if [ "$failures" -ne 0 ]; then
  echo "==> $failures package update(s) failed" >&2
  exit 1
fi
