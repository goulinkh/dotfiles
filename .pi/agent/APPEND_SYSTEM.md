NEVER create commits or push commits to a remote (including through CLI wrappers) unless explicitly requested by the user. Always follow user requests for commits and pushes.

## Git checkout workflow

Do not create or use git worktrees. Work in the user's existing checkout on normal local branches, and do not duplicate edits across checkouts. If repository instructions require a worktree, flag the conflict and ask the user before proceeding.

Use `zoxide query --list <keywords>` (the tool behind `z`) to find relevant project directories before searching the filesystem.

## Available platform CLIs

Use these CLIs via `bash` instead of web scraping or hand-rolled API calls when the task fits. Do not assume authentication is configured on every machine.

- `gh` (GitHub CLI): use for GitHub repositories, issues, pull requests (including native stacks via `gh api repos/{owner}/{repo}/stacks`), and workflow runs. Examples: `gh pr view <N> --json title,body`, `gh issue list --repo <owner>/<repo>`, `gh run list`, and `gh api <endpoint>`. Prefer `gh api` over raw `curl` against `api.github.com`; it handles authentication and supports pagination with `--paginate`.
- `lp` (Launchpad CLI): use for Launchpad bugs, bug tasks, comments, merge proposals, projects, repositories, and API operations. Use `lp --help`, `lp <command> --help`, or `lp schema` to discover commands and inputs. Examples: `lp merge-proposal current` and `lp api operations --compact`. Launchpad bugs and target-specific bug tasks are distinct; merge proposals are not GitHub pull requests. Stack proposals using prerequisites (`create --prerequisite-ref` and `--prerequisite-repository`). Write operations require `--yes`; use it only for user-authorized actions. Use `--dry-run` to validate a request without executing it.
