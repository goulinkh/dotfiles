---
description: Avoid empty-object and Function types in TypeScript declarations.
astCondition:
  - "type $T = {}"
  - "type $T = Function"
  - "let $X: {}"
  - "const $X: {}"
  - "let $X: Function"
  - "const $X: Function"
  - "interface $I { $P: {} }"
  - "interface $I { $P: Function }"
  - "function $F($ARG: {}) { $$$BODY }"
  - "function $F($ARG: Function) { $$$BODY }"
  - "function $F($ARG: {}): $R { $$$BODY }"
  - "function $F($ARG: Function): $R { $$$BODY }"
  - "function $F($$$ARGS): {} { $$$BODY }"
  - "function $F($$$ARGS): Function { $$$BODY }"
  - "type $T = ($ARG: {}) => $R"
  - "type $T = ($ARG: Function) => $R"
  - "const $NAME = ($ARG: {}) => $BODY"
  - "const $NAME = ($ARG: Function) => $BODY"
scope: "tool:edit(*.{ts,tsx,mts,cts}), tool:write(*.{ts,tsx,mts,cts})"
interruptMode: never
---

`{}` admits every non-nullish value, and `Function` discards the argument and return contract. Use a type that describes the known properties, an explicit callable signature for a callback, or `unknown` with narrowing when the shape is genuinely untrusted. The lowercase `object` type is appropriate for an intentionally opaque non-primitive value.
