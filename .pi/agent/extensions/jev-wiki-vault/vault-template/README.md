# pi-wiki-vault

Pi's long-term project memory, written by [pi-jev-wiki](https://github.com/xAndreiLi/pi-jev-wiki)
and kept out of the project repositories themselves. Jev (TypeSafe's System One classifier, via
OpenRouter) decides what is worth keeping; pages are plain Markdown with evidence for each claim.

## Layout

```
global/                    wiki for sessions outside a git repository; searchable from every project
projects/<project>/        one wiki per project
  raw/  wiki/              sources and pages (the source of truth)
  .jev-wiki/               decision ledger, review queue, drafts (machine-local files are ignored)
  remotes.txt              every git remote that mapped to this project
projects.json              name overrides: { "aliases": { "<derived name>": "<folder>" } }
```

## How projects are named

The `jev-wiki-vault` Pi extension (in `goulinkh/dotfiles`) names a checkout after its `upstream`
remote, else `origin`, else the first remote:

| Remote | Folder |
|---|---|
| `github.com:owner/<repo>` (any host) | `<repo>` |
| Launchpad `<project>`, `~owner/<project>`, `~owner/<project>/+git/<repo>` | `<project>` |
| Launchpad `[~owner/]ubuntu/+source/<package>` | `<package>` |
| Launchpad `~owner/+git/<repo>` | `<repo>` |
| no remote | checkout directory name |

Clones, forks, and mirrors therefore share one wiki on every machine. When a project goes by two
names, or two projects collide, add an alias to `projects.json`.

## Sync

The extension commits and pushes in the background (session start, two minutes after work
settles, and shutdown), and a timer runs the same script every 15 minutes:
`~/.pi/agent/extensions/jev-wiki-vault/vault-sync.sh`. Append-only files merge by union; generated
files (`index.md`, `toc*`, `toc.json`, `raw-index.json`) take the remote copy and are rebuilt by
pi-jev-wiki. Any other conflict stops the sync with a notice in Pi; nothing is force-pushed.

- `/vault-sync` in Pi syncs now; `/vault-sync status` shows the last result.
- Logs: `.git/vault-sync.log`.

The semantic search index is per machine (`~/.pi/agent/jev-wiki/`) and is never synced; rebuild it
with `wiki_index action=rebuild all=true`.

## New machine

`dotsync` (or `~/dotfiles/setup-pi-wiki.sh`) clones this repository, writes the pi-jev-wiki config,
and installs the sync timer. Then run `/login openrouter` in Pi.
