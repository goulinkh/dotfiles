# dotfiles

```sh
git clone https://github.com/goulinkh/dotfiles.git ~/dotfiles && ~/dotfiles/install.sh
```

After install:

```sh
dotsync    # pull, re-link, and update installed tools
dotpkg     # install packages for this OS
```

VS Code config lives in `.config/Code/User/` and is linked by `setup-vscode.sh`
(run by `install.sh` / `dotsync`): `settings.json` is shared, `keybindings.json`
points at `keybindings.macos.json` or `keybindings.linux.json` depending on the
OS. Machine-specific paths (interpreters, toolchains) stay out of the repo —
set them in workspace settings.

## Pi

`dotpkg` installs the official `@earendil-works/pi-coding-agent` CLI alongside OMP.
Start it with `pi`. `dotsync` updates Pi; pinned plugin versions stay fixed.

Only `pi-notify@1.4.0` is added: Ghostty notifications when Pi finishes and waits
for input. Pi installs it from the linked `.pi/agent/settings.json` on first
startup if missing. Allow Ghostty notifications in macOS for desktop banners.

Settings use Codex `gpt-6.1-sol`, `xhigh` thinking, quiet startup, hidden
thinking blocks, and `tuiMode: "regular"` for native terminal scrollback instead
of fullscreen scrolling. No custom system instructions, model overrides,
web-search, subagent, LSP, or Playwright packages are added.

Credentials stay in `~/.pi/agent/auth.json` (mode `0600`), never in dotfiles.
Only the active Codex credential was copied from OMP on this machine; use
`/login openai-codex` in Pi on another machine. OMP remains installed and its
configuration and credential store are unchanged.
