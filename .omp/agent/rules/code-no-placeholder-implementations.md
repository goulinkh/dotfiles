---
description: Replace comment-line implementation placeholders with working code.
condition: '(?m)^[ \t]*(?://|#|/\*+|\*|--)[ \t]*(?:(?:TODO|FIXME)[ \t]*:[ \t]*implement\b|\.{3}[ \t]+(?:rest|existing)\b)'
scope: "tool:edit(*.{py,js,jsx,mjs,cjs,ts,tsx,mts,cts,go,rs,java,kt,kts,c,h,cc,cpp,cxx,hpp,cs,rb,php,swift,sh,bash,zsh,sql}), tool:write(*.{py,js,jsx,mjs,cjs,ts,tsx,mts,cts,go,rs,java,kt,kts,c,h,cc,cpp,cxx,hpp,cs,rb,php,swift,sh,bash,zsh,sql})"
interruptMode: never
---

A comment such as `TODO: implement` or `... existing` in place of requested behavior leaves the implementation incomplete. Write the actual code and preserve relevant existing behavior; if work is explicitly deferred, describe the real limitation rather than presenting an elision as a finished implementation.
