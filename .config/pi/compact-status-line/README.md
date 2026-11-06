# Compact pi status line

Load after `better-claude-code-ui` and before `@pi-plugins/fast-mode`. Keep pi-usage before the UI package when using its `inlineFooter` placement.

The footer shows the model, inline fast-mode indicator, context usage, and turn count on the left, with account usage aligned to the right. Session duration is omitted. Project paths, Git status, and branch names are omitted because the multiplexer already shows them. The footer no longer polls Git or directory metadata.

Fast mode appears as `` (`nf-fa-bolt`, U+F0E7) next to the model while the plugin reports it active. For `gpt-auto`, the router's fast-mode bridge checks the concrete route for both requests and `/fast` status updates. Before the first route, `/fast on` reports that it is waiting; the bolt appears once an eligible route is selected. Its separate widget is suppressed without changing `/fast` or provider requests. The adapter targets fast-mode 0.1.13's shared statusline registry and preserves other plugins' segments.

```text
gpt-auto (gpt-6.1-sol)  · ctx 12%/200k · 3 turns                     70% (󰔛5d1h)
```

GPT Auto's parenthesized model is read from the router's live status on every render, so it follows route changes within the same session. Before routing, only `gpt-auto` is shown.

Context is muted below 65% used, warning-colored at 65%, and error-colored at 85%. Turns are muted below 10, warning-colored at 10, and error-colored at 15 (session-length reminders, not failures).

Token speed is not displayed and the token-speed package is not required.

The standalone Git/path helpers and their tests are retained but are not used by the current footer.

## Checks

With Node 22.18 or newer:

```bash
npm test
```

Tests use synthetic Git records and temporary directory trees, never real credentials. Run `/reload` after editing this extension.
