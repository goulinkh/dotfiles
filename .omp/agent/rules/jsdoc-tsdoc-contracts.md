---
description: When writing JSDoc or TSDoc, explain API contracts without boilerplate or link-only comments.
---
## Document contracts, not syntax

Write or update JSDoc/TSDoc where a public or non-obvious API needs context beyond its signature; do not blanket-document every symbol. Explain observable behavior and caller obligations that names and types cannot express, such as meaningful absence or errors, units, side effects, lifecycle, and stability. Include only details relevant to that API, and keep claims synchronized with the implementation.

Use tags to add useful information, not to repeat parameter names or types. Explain the impact of stability or deprecation tags when it matters; do not invent migration advice. State the essential point in the comment itself and use links only for supplementary detail. File-level comments explain a module's purpose or invariants; symbol-level comments explain that symbol's contract. Avoid duplicating one with the other. Follow the project's JSDoc/TSDoc conventions and supported tag syntax.
