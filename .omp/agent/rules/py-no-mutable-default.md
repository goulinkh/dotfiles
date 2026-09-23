---
description: Avoid mutable Python function defaults shared between calls.
astCondition:
  - "def $F($$$BEFORE, $ARG=[$$$ITEMS]): $$$BODY"
  - "def $F($$$BEFORE, $ARG=[$$$ITEMS], $$$AFTER): $$$BODY"
  - "def $F($$$BEFORE, $ARG={$$$ITEMS}): $$$BODY"
  - "def $F($$$BEFORE, $ARG={}): $$$BODY"
  - "def $F($$$BEFORE, $ARG={$KEY: $VALUE}): $$$BODY"
  - "def $F($$$BEFORE, $ARG={$KEY: $VALUE, $$$REST}): $$$BODY"
  - "def $F($$$BEFORE, $ARG=list()): $$$BODY"
  - "def $F($$$BEFORE, $ARG=dict()): $$$BODY"
  - "def $F($$$BEFORE, $ARG=set()): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE=[$$$ITEMS]): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE=[$$$ITEMS], $$$AFTER): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE={$$$ITEMS}): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE={}): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE={$KEY: $VALUE}): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE={$KEY: $VALUE, $$$REST}): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE=list()): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE=dict()): $$$BODY"
  - "def $F($$$BEFORE, $ARG: $TYPE=set()): $$$BODY"
scope: "tool:edit(*.py), tool:write(*.py)"
interruptMode: never
---

A Python default is evaluated when the function is defined, so mutations to a list, dict, or set default persist across calls. For per-call state, default to `None` and construct the collection inside the function. Keep a shared mutable default only when shared state is intentional and explicit in the API contract.
