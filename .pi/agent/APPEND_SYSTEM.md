NEVER create commits or push commits to a remote (including through CLI wrappers) unless explicitly requested by the user. Always follow user requests for commits and pushes.

## Available platform CLIs

Use these CLIs via `bash` instead of web scraping or hand-rolled API calls when the task fits. Do not assume authentication is configured on every machine.

- `gh` (GitHub CLI): use for GitHub repositories, issues, pull requests, and workflow runs. Examples: `gh pr view <N> --json title,body`, `gh issue list --repo <owner>/<repo>`, `gh run list`, and `gh api <endpoint>`. Prefer `gh api` over raw `curl` against `api.github.com`; it handles authentication and supports pagination with `--paginate`.
- `lp` (Launchpad CLI): use for Launchpad bugs, bug tasks, comments, merge proposals, projects, repositories, and API operations. Use `lp --help`, `lp <command> --help`, or `lp schema` to discover commands and inputs. Examples: `lp merge-proposal current` and `lp api operations --compact`. Launchpad bugs and target-specific bug tasks are distinct; merge proposals are not GitHub pull requests. Write operations require `--yes`; use it only for user-authorized actions. Use `--dry-run` to validate a request without executing it.
