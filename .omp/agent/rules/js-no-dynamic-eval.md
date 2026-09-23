---
description: Avoid evaluating strings as JavaScript code.
astCondition:
  - "eval($ARG)"
  - "new Function($$$ARGS)"
scope: "tool:edit(*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}), tool:write(*.{js,jsx,mjs,cjs,ts,tsx,mts,cts})"
interruptMode: always
---

`eval` and `new Function` execute strings as code, bypassing static analysis and potentially turning input into an injection path. Prefer a closed dispatch table for known operations or a parser for a deliberately limited expression language. If the task actually requires a JavaScript interpreter, define and enforce its trust boundary rather than feeding untrusted strings to these APIs.
