---
alwaysApply: true
description: Validate potentially missing or untrusted values before relying on them.
---
## Check uncertain values at boundaries

When a value can be missing or has an untrusted shape, verify it before relying on its presence or structure. Type assertions and non-null assertions only change static types; they do not validate values at runtime, so do not use them to bypass an unchecked boundary.

For a required value, validate it and fail explicitly when it is missing or invalid. For an optional value, preserve absence or choose a fallback that is meaningful for that value; never invent a default just to satisfy the type checker. Reuse the narrowed value downstream instead of repeating the lookup and asserting its result. Use a small guard for a simple value or the project's existing validator for structured input.

Do not revalidate or add defensive defaults when an earlier check or a trusted contract already guarantees the value. An assertion is appropriate when an already-checked invariant or inaccurate library type justifies it; keep that reason local.
