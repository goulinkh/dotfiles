# Compact pi status line

Load after `better-claude-code-ui` and before `@pi-plugins/fast-mode`. Keep pi-usage before the UI package when using its `inlineFooter` placement.

The footer shows the model, inline fast-mode indicator, token speed, context usage, and session duration/turn count. Project paths, Git status, and branch names are omitted because the multiplexer already shows them. The footer no longer polls Git or directory metadata.

Fast mode appears as `` (`nf-fa-bolt`, U+F0E7) next to the model only while the plugin reports it active. Its separate widget is suppressed without changing `/fast` or provider requests. The adapter targets fast-mode 0.1.13's shared statusline registry and preserves other plugins' segments.

## Token speed

Install the pinned `npm:pi-token-speed@0.12.0` package alongside this extension. The footer reads its `tokenSpeed` status entry on every render, preserving its colors and `/tps` display settings:

```text
model · ⚡ TPS: 25.0 tok/s · ctx 12%/200k              2m 10s · 3 turns
```

Pi requests a render when the token-speed extension updates its status. No extra polling or token counting is needed here. If the package is absent or its status is cleared, the segment is omitted.

The standalone Git/path helpers and their tests are retained but are not used by the current footer.

## Checks

With Node 22.18 or newer:

```bash
npm test
```

Tests use synthetic Git records and temporary directory trees, never real credentials. Run `/reload` after editing this extension.
