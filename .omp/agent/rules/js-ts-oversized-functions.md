---
description: Notice oversized JavaScript and TypeScript functions.
condition: '(?:[^\r\n]*\r?\n){60}'
question: >-
  Does any complete function body in this JavaScript/TypeScript code clearly
  span around 60 or more nonblank code lines? Judge by the visible extent of a
  single body, not by total file length; answer no for fragments.
scope: "tool:edit(*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}), tool:write(*.{js,jsx,mjs,cjs,ts,tsx,mts,cts})"
---

Consider extracting cohesive responsibilities from the oversized function without changing its behavior. Prefer meaningful helpers over splitting solely to meet a line limit; keep a cohesive function intact if splitting would obscure its control flow. Inspect the full file before acting on a partial edit.
