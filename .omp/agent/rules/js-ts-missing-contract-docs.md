---
description: Notice missing JSDoc or TSDoc on APIs with non-obvious contracts.
condition: '(?m)\b(?:export|function|class|interface|type|public|protected)\b|=>|^[ \t]*(?:async[ \t]+|static[ \t]+)*(?:get[ \t]+|set[ \t]+)?[A-Za-z_$][\w$]*[ \t]*\('
question: >-
  Does this JavaScript or TypeScript edit/write show a complete public, exported,
  or non-obvious API declaration whose contract needs details not conveyed by
  its name and types (such as absence, errors, units, side effects, or lifecycle),
  but visibly lacks relevant JSDoc or TSDoc immediately above it? Answer no
  for self-evident APIs or if adjacent comments might be outside the snapshot.
scope: "tool:edit(*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}), tool:write(*.{js,jsx,mjs,cjs,ts,tsx,mts,cts})"
---

Document caller-visible behavior and obligations that the signature does not express. Inspect the surrounding source for existing comments before adding JSDoc/TSDoc; avoid boilerplate, duplicated type information, and claims that the implementation does not support. Follow the project's conventions and `rule://jsdoc-tsdoc-contracts`.
