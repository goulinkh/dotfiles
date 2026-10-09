# Compact pi status line

Load after `better-claude-code-ui` and before `@pi-plugins/fast-mode`. Keep pi-usage before the UI package when using its `inlineFooter` placement.

Fast mode appears as `` (`nf-fa-bolt`, U+F0E7) next to the model only while the plugin reports it active. Its separate widget is suppressed without changing `/fast` or provider requests. The adapter targets fast-mode 0.1.13's shared statusline registry and preserves other plugins' segments.

## Git

The Git segment uses Oh My Zsh-inspired colors and counters, for example:

```text
 main +2 ~3 ?1 !1 ↑2 ↓1
```

| Marker | Meaning | Theme color |
| --- | --- | --- |
| `+N` | Staged files | Success (green) |
| `~N` | Unstaged files | Warning (yellow) |
| `?N` | Untracked files | Accent |
| `!N` | Conflicted files | Error (red) |
| `↑N` / `↓N` | Commits ahead / behind upstream | Success / warning |
| `✓` | Clean working tree | Success |

Zero counts are hidden. The branch is green when clean, yellow with changes, and red with conflicts. A partially staged file contributes to both staged and unstaged counts; conflicted files contribute only to conflicts. Detached HEAD shows a short commit identifier. Upstream counts come from local Git metadata, without fetching.

## Directory

Directory shortening follows the current Powerlevel10k settings in `~/dotfiles/.p10k.zsh`:

- Replace the home-directory prefix with `~`, preserving path boundaries.
- Keep full paths while they fit, up to 80 columns.
- Shorten intermediate directories to their shortest unique sibling prefixes when space is needed, without an ellipsis or suffix.
- Preserve the first absolute-path directory, project/marker directories, and final directory.
- Reserve space for the model, Git, context, session details, and appended usage before shortening the path.

Only directory-entry metadata is read, asynchronously outside rendering. Prefixes refresh every five seconds; unreadable directories retain full names. Extremely narrow terminals still clip the final footer to their width.

## Checks

With Node 22.18 or newer:

```bash
npm test
```

Tests use synthetic Git records and temporary directory trees, never real credentials. Run `/reload` after editing this extension.
