---
description: Guard variable-derived targets before recursive shell removal.
condition: '(?m)^[ \t]*rm[ \t]+(?:-rf|-fr|-r[ \t]+-f|-f[ \t]+-r)[ \t]+(?:--[ \t]+)?(?:\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})|[^\s"$;#]*/\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})|"\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})"/|"\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})/)'
scope: "tool:edit(*.{sh,bash,zsh}), tool:write(*.{sh,bash,zsh})"
interruptMode: never
---

An unchecked variable in `rm -rf` can expand to an empty, unexpected, or option-like target; joining it to `/` can turn an empty value into an unrelated absolute path. Before removal, validate the canonical target against the intended directory and reject empty, root, or out-of-bounds paths. Quote expansions and pass `--` before the target. A verified temporary directory, such as one created by `mktemp -d` and removed as `rm -rf "$tmp"`, is not inherently unsafe.
