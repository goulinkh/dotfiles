---
description: Do not silently discard errors in Go error branches.
astCondition:
  - "if err != nil {}"
  - "if err != nil { _ = err }"
  - 'if err != nil { return nil }'
  - 'if err != nil { return nil, nil }'
  - 'if err != nil { return "", nil }'
  - 'if err != nil { return 0, nil }'
  - 'if err != nil { return false, nil }'
scope: "tool:edit(*.go), tool:write(*.go)"
interruptMode: never
---

An empty error branch or a success-shaped return can hide a failed operation from callers. Propagate or wrap the error with context, handle it explicitly, or document a deliberate best-effort fallback; do not silently turn a failure into success.
