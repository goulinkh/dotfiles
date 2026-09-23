---
description: Avoid unchecked TypeScript non-null and double-cast assertions.
astCondition:
  - "$VALUE!"
  - "$VALUE as unknown as $TYPE"
  - "$VALUE as any as $TYPE"
scope: "tool:edit(*.{ts,tsx,mts,cts}), tool:write(*.{ts,tsx,mts,cts})"
interruptMode: never
---

A non-null assertion (`value!`) skips a null check, while a double cast through `unknown` or `any` can claim a type without verifying its shape. Narrow nullable values with an explicit check or enforce a documented invariant; validate untrusted data at the boundary before assigning it a stronger type. Reserve assertions for proven invariants that the type system cannot express.
