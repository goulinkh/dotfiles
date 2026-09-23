---
description: Bind SQL data values instead of interpolating them into query text.
condition:
  - '(?i)\b(?:WHERE|HAVING|SET)\b[^\r\n]{0,160}(?:=|<>|!=|<=|>=|<|>|\bLIKE\b)\s*(?:\x27)?(?:\$\{\s*[A-Za-z_$]|\{\s*[A-Za-z_])'
  - '(?i)\bVALUES\s*\(\s*(?:\x27)?(?:\$\{\s*[A-Za-z_$]|\{\s*[A-Za-z_])'
  - '(?i)\b(?:WHERE|HAVING|SET)\b[^\r\n]{0,160}(?:=|<>|!=|<=|>=|<|>|\bLIKE\b)\s*(?:\x27)?["\x27`]\s*(?:\+|\|\|)\s*[A-Za-z_$]'
  - '(?i)\bVALUES\s*\(\s*(?:\x27)?["\x27`]\s*(?:\+|\|\|)\s*[A-Za-z_$]'
  - '(?i)\bfmt\.Sprintf\s*\(\s*["\x27`][^\r\n]{0,240}\b(?:WHERE|HAVING|SET|VALUES)\b[^\r\n]{0,160}(?:=\s*|\bLIKE\s*|\(\s*)%(?:\d+\$)?[sdv]'
scope: "tool:edit(*.{go,py,js,jsx,mjs,cjs,ts,tsx,mts,cts,java,kt,rb,php,rs,cs,sql}), tool:write(*.{go,py,js,jsx,mjs,cjs,ts,tsx,mts,cts,java,kt,rb,php,rs,cs,sql})"
interruptMode: never
---

Putting data values into SQL text can change the query's syntax and allow injection. Keep values in driver-bound parameters (`?`, `$1`, `:name`, etc.) rather than concatenation or string formatting. Identifiers cannot usually be bound: select dynamic table or column names from a fixed allowlist, then bind the remaining data values.
