NEVER create commits or push commits to a remote (including through CLI wrappers) unless explicitly requested by the user. Always follow user requests for commits and pushes.

## Selective automatic wiki memory

Keep memory automatic but exceptional: the normal outcome of a task is no wiki write. Do not treat "capture at the end of substantive work" as a quota or a mandatory tool call. Background task/compaction capture is deliberately disabled; the agent captures qualifying insights without asking for routine approval.

- Save only a consequential decision with explicit rationale, an enduring constraint or preference explicitly stated by the user, or a non-obvious gotcha that took real investigation and will prevent a repeat mistake.
- Every candidate must be new, useful beyond this task, and supported by evidence that states the claim. Exclude implementation summaries, configuration values, paths, command recipes, routine fixes, task outcomes, speculation, and facts cheaply recoverable from code or existing documentation. A one-off request is not automatically a lasting preference.
- Select at most two strong insights per task; zero is preferred to marginal knowledge. Consult existing memory to deduplicate only when there is a genuine candidate. Merge into an existing page whenever possible.
- Use wiki_insights in guided mode. File only recommended claims with grounded support at least 0.95 that also pass the rules above. Skip low-confidence, rejected, derivable, duplicate, or review-only candidates; do not override verdicts, rehabilitate rejections, or start a review/triage loop during normal work. Explicitly requested wiki maintenance is separate.
- Project knowledge belongs in the project's registered wiki. The global wiki is only for explicitly cross-project preferences or constraints, never a fallback for uncertain routing. If scope is unclear, skip capture.
- Keep routine wiki bookkeeping out of conversational prose: no capture announcements, completion summaries, or approval questions. Finish any necessary finalization before answering. Never delay a user decision for optional wiki work.
- Do not run periodic maintenance or browse unrelated wikis as a task-completion ritual. Consult relevant memory when it could change the answer; do not inject unrelated context.
- After a user-requested reset, do not refill the vault from old conversation history, pending captures, or the reset/configuration task itself. Start capturing new knowledge with subsequent work.

## Git checkout workflow

Use `zoxide query --list <keywords>` (the tool behind `z`) to find relevant project directories before searching the filesystem.

## Available platform CLIs

Use these CLIs via `bash` instead of web scraping or hand-rolled API calls when the task fits. Do not assume authentication is configured on every machine.

- `gh` (GitHub CLI): use for GitHub repositories, issues, pull requests (including native stacks via `gh api repos/{owner}/{repo}/stacks`), and workflow runs. Examples: `gh pr view <N> --json title,body`, `gh issue list --repo <owner>/<repo>`, `gh run list`, and `gh api <endpoint>`. Prefer `gh api` over raw `curl` against `api.github.com`; it handles authentication and supports pagination with `--paginate`.
- `lp` (Launchpad CLI): use for Launchpad bugs, bug tasks, comments, merge proposals, projects, repositories, and API operations. Use `lp --help`, `lp <command> --help`, or `lp schema` to discover commands and inputs. Examples: `lp merge-proposal current` and `lp api operations --compact`. Launchpad bugs and target-specific bug tasks are distinct; merge proposals are not GitHub pull requests. Stack proposals using prerequisites (`create --prerequisite-ref` and `--prerequisite-repository`). Write operations require `--yes`; use it only for user-authorized actions. Use `--dry-run` to validate a request without executing it.
