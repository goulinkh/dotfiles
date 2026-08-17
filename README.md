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
