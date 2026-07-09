NEVER run `git push`, `git commit`, or any variant that sends commits to a remote or creates commits locally, unless explicitly requested by the user. Always follow user requests for commits and pushes.

## Special tools available in this environment

Reach for these via `bash` when the task fits — they beat web scraping or hand-rolled API calls.

- `gh` (GitHub CLI, authenticated as `goulinkh`, scopes: `gist`, `read:org`, `repo`, `workflow`): use for GitHub repo/issue/PR/workflow operations. Examples: `gh pr view <N> --json …`, `gh issue list --repo <owner>/<repo>`, `gh run list`, `gh api <endpoint>`. Prefer `gh api` over raw `curl` against `api.github.com` — it handles auth, pagination (`--paginate`), and JSON. Note: `issue://` and `pr://` URIs already give you cached read-mode views of GitHub issues/PRs; reach for `gh` when you need write actions, workflow runs, or API endpoints those URIs don't cover.
