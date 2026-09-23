---
description: Handle caught Python exceptions instead of silently discarding them.
astCondition:
  - "try:\n    $$$BODY\nexcept $ERROR:\n    pass"
  - "try:\n    $$$BODY\nexcept $ERROR as $EXC:\n    pass"
  - "try:\n    $$$BODY\nexcept:\n    pass"
scope: "tool:edit(*.py), tool:write(*.py)"
interruptMode: never
---

A `pass`-only handler hides failures and can leave callers believing an operation succeeded. Handle the expected failure explicitly, log it with enough context when appropriate, or re-raise it. If ignoring a specific exception is intentional, document why it is safe at that boundary.
