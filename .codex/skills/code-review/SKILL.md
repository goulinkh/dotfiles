---
name: code-review
description: Review code changes or pull requests with behavioral verification, evidence-backed findings, and working-tree protection. Use for requested reviews, not routine implementation.
---

# Code review

Review requested changes by inspecting intent and exercising relevant behavior.
Report findings; do not apply fixes or post to external services unless explicitly requested.

## 1. Understand the intent

- State what the change is trying to accomplish and the behavior it is
  expected to change. Use commit messages, the PR description, and any linked
  plan, spec, or issue.
- Find how this project builds, type-checks, lints, and tests. Check
  `AGENTS.md`, `CLAUDE.md`, `README`, `CONTRIBUTING`, `Makefile`/`justfile`,
  `package.json` scripts, `pyproject.toml`/`tox.ini`, `go.mod`, `Cargo.toml`,
  and the CI workflows. Use the commands CI uses.

## 2. Verify by running

Do every step that applies to the change:

1. **Baseline.** Before touching anything, record `git status --porcelain` and
   `git diff HEAD | shasum`. You will prove at the end that the tree is
   unchanged.
2. **Build and check.** Build, type-check, and lint the touched code.
3. **Test.** Run the tests for the touched code first, then the wider suite if
   it finishes in a few minutes. If a test fails, check whether it also fails
   without the change, so you can tell a regression from a pre-existing
   failure.
4. **Exercise the behavior.** Call the changed function, run the CLI, or hit
   the endpoint with realistic input. Then try edge cases: empty, null, and
   boundary values; very large input; unicode; concurrent calls; and error
   paths such as missing files, malformed input, timeouts, and failed network
   calls.
5. **Mutation probes.** When a meaningful new condition or guard warrants
   deeper verification, probe it: drop a negation, swap `&&` and `||`, shift a boundary by
   one, or remove the new guard. Run the relevant tests, then restore. A
   mutation that stays green warrants investigation; report a missing test only
   when the mutation changes required behavior and is reachable.
6. **Bug fixes.** Temporarily revert the fix lines and confirm the regression
   test fails without them and passes with them. A regression test that
   passes either way is a finding.
7. **Confirm suspicions.** When reading suggests a bug, write a small
   reproduction before reporting it. Prefer confirmed findings over
   speculative ones.

## 3. Rules for experimental edits

Temporary edits to the working tree are expected. Keep them reversible:

- Put scratch scripts in a temporary directory (`mktemp -d`). If a script must
  live inside the repo to import project code, delete it afterwards.
- Before editing a file, copy it into the temporary directory and restore it
  from that copy. Never undo experiments with `git checkout`, `git restore`,
  `git stash`, or `git reset`. They would also discard the uncommitted changes
  under review.
- Apply one mutation at a time and restore it before the next.
- Do not commit, push, or switch branches. Do not change manifests or
  lockfiles; installing dependencies exactly as pinned is fine when tests need
  them. Do not run migrations against real databases or call production or
  shared services. Use only local, throwaway resources.
- Put a timeout on long-running commands and stop any server or background
  process you start.
- When you finish, re-run `git status --porcelain` and `git diff HEAD | shasum`
  and confirm they match the baseline. If they don't, report it prominently.

## 4. What to examine

- **Correctness:** the change does what its intent says. Check edge cases,
  error paths, off-by-one errors, races, and state that can go inconsistent.
  Tests should check behavior, not implementation details.
- **Simplicity:** could it be done in fewer lines? Does a refactor reduce the
  number of concepts a reader must hold, or only move them around? Flag new
  conditionals bolted onto unrelated flows, repeated conditionals on the same
  shape, and dead code left behind (now-unused functions, compatibility shims,
  `// removed` comments).
- **Architecture:** the change follows existing patterns. Flag feature logic
  in shared modules, near-duplicates of an existing canonical helper,
  dependency cycles, and vague type boundaries (gratuitous `any`, casts,
  optionals, silent fallbacks). Flag a change that grows an already-large file
  (around 1000 lines) instead of splitting it.
- **Security:** no secrets in code or logs. Authorization is checked where
  needed. External data (APIs, files, config, user content) is validated at
  the boundary, and output is encoded.
- **Performance:** look for N+1 queries, unbounded loops or fetches, missing
  pagination, blocking work in async or hot paths, and large allocations in
  hot paths. When a suspicion is cheap to measure, measure it and give the
  numbers.
- **Dependencies:** a new dependency must beat the standard library and
  existing utilities. For upgrades, read the changelog and review the lockfile
  diff, not just the version number.

## 5. Reporting findings

- Before reporting a finding, check it against the callers, guards, and tests
  that reach the changed code. Drop it if they rule it out.
- Mark each finding's evidence as **Confirmed**, with the command or
  experiment and what you observed, or **From reading**, with the reason it
  could not be exercised.
- When you flag a structural problem, propose the remedy: replace a
  conditional chain with a typed model, collapse duplicate branches, separate
  orchestration from logic, move feature logic to the module that owns it,
  reuse the canonical helper, delete a pass-through wrapper, or make a type
  boundary explicit.
- Lead with what matters. A few high-conviction findings beat a long list of
  nits. Zero findings is a valid result; never invent one.
- Do not rubber-stamp and do not soften real bugs. Quantify impact when you
  can.

## 6. Verification report

Add a `## Verification` section after the findings and before the overall
verdict. If a Human Reviewer Callouts section is used, keep it last. Include:

- each command you ran and its result (pass/fail, test counts);
- the experiments and edge-case probes you tried and what you observed;
- the mutation probes you tried, marking each one that stayed green;
- anything you could not verify, and why (missing service, credentials,
  platform);
- whether the working tree matches the baseline.

Only give the verdict "correct" if the relevant build and tests actually ran
and passed. If they could not run, say so next to the verdict.

---

Adapted from the `code-review-and-quality` skill in
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT).
