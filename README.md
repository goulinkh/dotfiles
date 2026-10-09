# dotfiles

Personal configuration and machine bootstrap for macOS and Ubuntu.

## Setup

```sh
git clone https://github.com/goulinkh/dotfiles.git ~/dotfiles
~/dotfiles/install.sh
```

The installer links configuration into your home directory, backs up existing
files as `*.bak`, and runs the setup scripts. Open a new terminal to finish
shell initialization.

## Updates

```sh
dotsync    # pull changes, re-link configuration, and update installed tooling
dotpkg     # install packages for this OS
```

## Making changes

Edit the configuration files directly; they are the source of truth for
settings, plugins, and defaults. [files.sh](files.sh) controls which paths are
linked, and [packages/](packages/) contains package installation and update
logic. Keep tool inventories and configuration details in those files rather
than duplicating them here.

## Local settings

Keep secrets, credentials, and machine-specific overrides out of version
control. Use `~/.zsh.local` for local shell settings; the repository's
[.zsh.local](.zsh.local) is only a template. Put project-specific editor and
toolchain paths in workspace settings.
