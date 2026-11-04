# General prose checks

Install Vale (`brew install vale` on macOS), then run `install.sh` from the dotfiles repository to link the configuration and custom rule.

Download the external styles after installation or package changes:

```sh
vale --config ~/.config/vale-general/.vale.ini sync
```

Check Markdown or plain text:

```sh
vale --config ~/.config/vale-general/.vale.ini path/to/file.md
pbpaste | vale --config ~/.config/vale-general/.vale.ini --ext=.md
```

This configuration is separate from `~/.config/vale` and does not replace an ADR setup. Downloaded style packages are not stored in dotfiles.
