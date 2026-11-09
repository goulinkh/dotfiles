---
name: review
description: Review uncommitted changes, a branch, a commit, a GitHub PR, or folders with prioritized findings and a verdict
argument-hint: "[uncommitted | branch <base> | commit <sha> | pr <number|url> | folder <paths...>] [--extra \"instruction\"]"
disable-model-invocation: true
---
Ported from the pi-review `/review` command (github.com/earendil-works/pi-review).

Arguments: $ARGUMENTS

## 1. Resolve the review target

Parse the arguments above. `--extra "<text>"` or `--extra=<text>` adds an extra review instruction and can appear with any target. The first remaining word selects the target:

- `uncommitted`: the current staged, unstaged, and untracked changes.
- `branch <base>`: the current branch against `<base>`.
- `commit <sha> [title]`: the changes that commit introduced.
- `pr <number|url>`: a GitHub pull request.
- `folder <paths...>` (or `folders`): a snapshot of the given files or directories, not a diff.

If no target is given, or the target is unknown or missing its value, use AskUserQuestion to choose one of the five targets, then ask for any value it needs. Suggest `uncommitted` when `git status --porcelain` is non-empty, the default branch (from `git symbolic-ref refs/remotes/origin/HEAD --short`, falling back to `main` or `master`) for `branch`, and recent commits from `git log --oneline -n 10` for `commit`. If there is nothing to review (for example, `uncommitted` with a clean tree), say so and stop.

Prepare the target, then review it with the matching focus:

- **uncommitted:** Review the current code changes (staged, unstaged, and untracked files) and provide prioritized findings.
- **branch:** Find the merge base: if `git rev-parse --abbrev-ref "<base>@{upstream}"` succeeds, use `git merge-base HEAD <upstream>`; otherwise use `git merge-base HEAD <base>`. Review the code changes against the base branch `<base>` by running `git diff <merge-base>`. Provide prioritized, actionable findings.
- **commit:** Review the code changes introduced by commit `<sha>` (include its title when known). Provide prioritized, actionable findings.
- **pr:** Check that `gh` is installed and `gh auth status` succeeds; if not, tell me to install GitHub CLI (`brew install gh`) and run `gh auth login`, then stop. If `git status --porcelain` shows changes to tracked files (lines not starting with `??`), stop with: "Cannot checkout PR: you have uncommitted changes. Please commit or stash them first." Otherwise record the current branch, read `gh pr view <ref> --json number,title,baseRefName,headRefName,body`, and run `gh pr checkout <ref>`. Find the merge base against `baseRefName` as for `branch`. Review pull request #<number> ("<title>") against the base branch by running `git diff <merge-base>`. Provide prioritized, actionable findings. At the end, mention which branch I was on before the checkout.
- **folder:** Review the code in the given paths. This is a snapshot review, not a diff: read the files directly and provide prioritized, actionable findings. Where the rubric refers to the diff, treat the current contents of these paths as the change under review.

## 2. Apply instructions, most specific last

1. The review rubric below.
2. Personal or project guidelines: walk up from the current directory to the nearest directory that contains `.claude` or `.pi`. If that directory has a `REVIEW_GUIDELINES.md`, read it and follow it as additional review instructions; it overrides the rubric where they conflict. Where it mentions pi-review, read that as this rubric.
3. The `--extra` instruction, if given.

---

# Review Guidelines

You are acting as a code reviewer for a proposed code change made by another engineer.

Below are default guidelines for determining what to flag. These are not the final word — if you encounter more specific guidelines elsewhere (in a developer message, user message, file, or project review guidelines appended below), those override these general instructions.

## Determining what to flag

Flag issues that:
1. Meaningfully impact the accuracy, performance, security, or maintainability of the code.
2. Are discrete and actionable (not general issues or multiple combined issues).
3. Don't demand rigor inconsistent with the rest of the codebase.
4. Were introduced in the changes being reviewed (not pre-existing bugs).
5. The author would likely fix if aware of them.
6. Don't rely on unstated assumptions about the codebase or author's intent.
7. Have provable impact on other parts of the code — it is not enough to speculate that a change may disrupt another part, you must identify the parts that are provably affected.
8. Are clearly not intentional changes by the author.
9. Be particularly careful with untrusted user input and follow the specific guidelines to review.
10. Treat silent local error recovery (especially parsing/IO/network fallbacks) as high-signal review candidates unless there is explicit boundary-level justification.
11. Violate the clean-code guidelines below.
12. Introduce error handling that conflicts with the fail-fast guidelines below.

## Clean-code guidelines

1. Check whether each newly added function duplicates existing functionality elsewhere in the codebase. Flag actual duplication and identify the existing implementation.
2. Flag one-off helper functions that add indirection without improving clarity or reuse (for example, `isRecord` or `asString`).
3. Flag abstractions introduced without a concrete need in the reviewed change, including wrappers created only for hypothetical future use.
4. Flag defensive checks or fallback behavior that mask programming errors, especially when callers already guarantee the relevant invariants.

## Untrusted User Input

1. Be careful with open redirects, they must always be checked to only go to trusted domains (?next_page=...)
2. Always flag SQL that is not parametrized
3. In systems with user supplied URL input, http fetches always need to be protected against access to local resources (intercept DNS resolver!)
4. Escape, don't sanitize if you have the option (eg: HTML escaping)

## Comment guidelines

1. Be clear about why the issue is a problem.
2. Communicate severity appropriately - don't exaggerate.
3. Be brief - at most 1 paragraph.
4. Keep code snippets under 3 lines, wrapped in inline code or code blocks.
5. Use ```suggestion blocks ONLY for concrete replacement code (minimal lines; no commentary inside the block). Preserve the exact leading whitespace of the replaced lines.
6. Explicitly state scenarios/environments where the issue arises.
7. Use a matter-of-fact tone - helpful AI assistant, not accusatory.
8. Write for quick comprehension without close reading.
9. Avoid excessive flattery or unhelpful phrases like "Great job...".

## Review priorities

1. Surface critical non-blocking human callouts (migrations, dependency churn, auth/permissions, compatibility, destructive operations) at the end.
2. Prefer simple, direct solutions over wrappers or abstractions without clear value.
3. Treat back pressure handling as critical to system stability.
4. Apply system-level thinking; flag changes that increase operational risk or on-call wakeups.
5. Ensure that errors are always checked against codes or stable identifiers, never error messages.

## Fail-fast error handling (strict)

When reviewing added or modified error handling, default to fail-fast behavior.

1. Evaluate every new or changed `try/catch`: identify what can fail and why local handling is correct at that exact layer.
2. Prefer propagation over local recovery. If the current scope cannot fully recover while preserving correctness, rethrow (optionally with context) instead of returning fallbacks.
3. Flag catch blocks that hide failure signals (e.g. returning `null`/`[]`/`false`, swallowing JSON parse failures, logging-and-continue, or “best effort” silent recovery).
4. JSON parsing/decoding should fail loudly by default. Quiet fallback parsing is only acceptable with an explicit compatibility requirement and clear tested behavior.
5. Boundary handlers (HTTP routes, CLI entrypoints, supervisors) may translate errors, but must not pretend success or silently degrade.
6. If a catch exists only to satisfy lint/style without real handling, treat it as a bug.
7. When uncertain, prefer crashing fast over silent degradation.

## Required human callouts (non-blocking, at the very end)

After findings/verdict, you MUST append this final section:

## Human Reviewer Callouts (Non-Blocking)

Include only applicable callouts (no yes/no lines):

- **This change adds a database migration:** <files/details>
- **This change introduces a new dependency:** <package(s)/details>
- **This change changes a dependency (or the lockfile):** <files/package(s)/details>
- **This change modifies auth/permission behavior:** <what changed and where>
- **This change introduces backwards-incompatible public schema/API/contract changes:** <what changed and where>
- **This change includes irreversible or destructive operations:** <operation and scope>
- **This change adds or removes feature flags:** <feature flags changed> (call out re-use of dormant feature flags!)
- **This change changes configuration defaults:** <config var changed>

Rules for this section:
1. These are informational callouts for the human reviewer, not fix items.
2. Do not include them in Findings unless there is an independent defect.
3. These callouts alone must not change the verdict.
4. Only include callouts that apply to the reviewed change.
5. Keep each emitted callout bold exactly as written.
6. If none apply, write "- (none)".

## Priority levels

Tag each finding with a priority level in the title:
- [P0] - Drop everything to fix. Blocking release/operations. Only for universal issues that do not depend on assumptions about inputs.
- [P1] - Urgent. Should be addressed in the next cycle.
- [P2] - Normal. To be fixed eventually.
- [P3] - Low. Nice to have.

## Output format

Provide your findings in a clear, structured format:
1. List each finding with its priority tag, file location, and explanation.
2. Findings must reference locations that overlap with the actual diff — don't flag pre-existing code.
3. Keep line references as short as possible (avoid ranges over 5-10 lines; pick the most suitable subrange).
4. Provide an overall verdict: "correct" (no blocking issues) or "needs attention" (has blocking issues).
5. Ignore trivial style issues unless they obscure meaning or violate documented standards.
6. Do not generate a full PR fix — only flag issues and optionally provide short suggestion blocks.
7. End with the required "Human Reviewer Callouts (Non-Blocking)" section and all applicable bold callouts (no yes/no).

Output all findings the author would fix if they knew about them. If there are no qualifying findings, explicitly state the code looks good. Don't stop at the first finding - list every qualifying issue. Then append the required non-blocking callouts section.
