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

omp plugins are listed in `omp-plugins.txt` and installed by
`setup-omp-plugins.sh`; `~/.omp/plugins/` itself (lockfiles, `node_modules`)
is machine-local and untracked.

Interactive `omp` runs inside tmux when installed, keeping resize replies out
of its input and providing session scrollback. `command omp` bypasses tmux for
CLI subcommands; piped calls and existing tmux panes also run OMP directly.
Its tmux status bar is hidden and OMP's own title is forwarded to the terminal,
without changing other tmux sessions.
