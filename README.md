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

Native OMP agent rules in `.omp/agent/rules/` are listed in `files.sh` so
install and sync link them into `~/.omp/agent/rules/`.

Eleven TTSR rules guard dynamic JavaScript evaluation (interrupting); Python
mutable defaults and swallowed exceptions; weak TypeScript types and unsafe
assertions; ignored Go errors; interpolated SQL values; placeholder code; and
variable-derived recursive shell removal (advisory). Two judged warnings flag
missing JSDoc/TSDoc on APIs with non-obvious contracts and JavaScript/TypeScript
functions around 60+ code lines. They watch `edit`/`write` of matching source
files, not assistant prose. The judged rules require `ttsr.judge: "on"` and a
working judge; judge failures yield no warning. Run `python3 .omp/verify-ttsr.py`
for positive and negative regex/AST fixtures. It does not evaluate judged
rules; exercise those with live `edit`/`write` calls.

By default, TTSR reminds once per rule per session; it is not a security scanner.

Interactive `omp` runs inside tmux when installed, keeping resize replies out
of its input and providing session scrollback. `command omp` bypasses tmux for
CLI subcommands; piped calls and existing tmux panes also run OMP directly.
Its tmux status bar is hidden and OMP's own title is forwarded to the terminal,
without changing other tmux sessions.
The wrapper enables mouse-wheel history scrolling only in OMP's tmux window.
OSC 7 reports its starting directory to compatible terminals so new tabs can
inherit it.

The OMP pane starts at the terminal's size and retains 50,000 history rows
instead of tmux's 2,000-row default; other sessions are unaffected. OMP keeps
pre-compaction messages inline instead of clearing terminal scrollback. While
an answer is streaming, unfinished text may still be clipped until OMP
finalizes it.
