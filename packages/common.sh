#!/usr/bin/env bash
# Shared global tool setup via mise (macOS + Ubuntu). Idempotent.
# Requires mise on PATH (installed by packages/macos.sh or ubuntu.sh).
set -euo pipefail

# mise installed via mise.run lands in ~/.local/bin, maybe not yet on PATH.
command -v mise >/dev/null 2>&1 || export PATH="$HOME/.local/bin:$PATH"
if ! command -v mise >/dev/null 2>&1; then
  echo "==> mise missing — run packages/<os>.sh first" >&2
  exit 1
fi

echo "==> mise global tools"
mise use -g node@26
mise use -g python@3.14
mise use -g go@latest
mise use -g kubectl@latest
mise use -g terraform@latest
mise use -g vault@latest
mise use -g ubi:ajeetdsouza/zoxide@latest
mise use -g ubi:lsd-rs/lsd@latest

mise exec node@26 -- npm install -g pnpm

# GitHub Copilot CLI (npm global; binary downloaded on postinstall).
if ! command -v copilot >/dev/null 2>&1; then
  echo "==> installing GitHub Copilot CLI (@github/copilot)"
  mise exec node@26 -- npm install -g @github/copilot
else
  echo "==> GitHub Copilot CLI already installed"
fi
# Install Bun (required by omp) and oh-my-pi (omp) CLI
if ! command -v bun >/dev/null 2>&1; then
  echo "==> installing bun"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
else
  echo "==> bun already installed"
fi

if ! command -v omp >/dev/null 2>&1; then
  echo "==> installing oh-my-pi (omp)"
  curl -fsSL https://omp.sh/install | sh
else
  echo "==> oh-my-pi (omp) already installed"
fi
mise reshim

JUJU_VERSION="3.6.8"
JUJU_SERIES="${JUJU_VERSION%.*}"
if [ "$(juju version 2>/dev/null | cut -d- -f1)" = "$JUJU_VERSION" ]; then
  echo "==> juju $JUJU_VERSION already installed"
else
  echo "==> juju $JUJU_VERSION via Launchpad"
  case "$(uname -s)" in
    Darwin) JUJU_OS="darwin" ;;
    Linux)  JUJU_OS="linux" ;;
    *) echo "==> unsupported OS for juju" >&2; JUJU_OS="" ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) JUJU_ARCH="arm64" ;;
    x86_64|amd64)  JUJU_ARCH="amd64" ;;
    *) echo "==> unsupported arch for juju" >&2; JUJU_ARCH="" ;;
  esac
  if [ -n "$JUJU_OS" ] && [ -n "$JUJU_ARCH" ]; then
    JUJU_TARBALL="juju-${JUJU_VERSION}-${JUJU_OS}-${JUJU_ARCH}.tar.xz"
    JUJU_URL="https://launchpad.net/juju/${JUJU_SERIES}/${JUJU_VERSION}/+download/${JUJU_TARBALL}"
    JUJU_TMP="$(mktemp -d)"
    curl -fsSL "$JUJU_URL" -o "$JUJU_TMP/$JUJU_TARBALL"
    tar -xJf "$JUJU_TMP/$JUJU_TARBALL" -C "$JUJU_TMP"
    mkdir -p "$HOME/.local/bin"
    install -m 0755 "$JUJU_TMP/juju" "$HOME/.local/bin/juju"
    rm -rf "$JUJU_TMP"
  fi
fi

