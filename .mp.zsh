# mp: print the Launchpad merge-proposal URL for a commit/branch.
# usage: mp [rev] [--edge]    (rev defaults to HEAD)
function mp() {
  emulate -L zsh
  setopt errexit nounset pipefail

  local use_edge=false
  local positional=()

  for arg in "$@"; do
    if [[ "$arg" == "--edge" ]]; then
      use_edge=true
    else
      positional+=("$arg")
    fi
  done

  local rev="${positional[1]:-HEAD}"
  local commit current_branch branches branch="" remote_url remote_path repo_name owner_link

  commit=$(git rev-parse --verify "${rev}^{commit}")
  current_branch=$(git branch --show-current)
  branches=(${(f)$(git for-each-ref --format='%(refname:short)' refs/heads --contains "$commit")})

  if (( ${#branches} == 0 )); then
    print -u2 "No local branch contains ${rev}."
    return 1
  fi

  if [[ -n "$current_branch" ]]; then
    for candidate in $branches; do
      if [[ "$candidate" == "$current_branch" ]]; then
        branch="$current_branch"
        break
      fi
    done
  fi

  [[ -z "$branch" ]] && branch="$branches[1]"

  remote_url=$(git remote get-url origin)
  remote_path="$remote_url"
  remote_path="${remote_path#git+ssh://}"
  remote_path="${remote_path#ssh://}"
  remote_path="${remote_path#https://}"
  remote_path="${remote_path#http://}"
  remote_path="${remote_path#*@}"
  remote_path="${remote_path#git.launchpad.net/}"
  remote_path="${remote_path%.git}"

  if [[ "$remote_path" == "$remote_url" ]]; then
    print -u2 "Unsupported Launchpad remote: ${remote_url}"
    return 1
  fi

  if [[ "$remote_path" != */* ]]; then
    owner_link=$(curl -fsSL "https://api.launchpad.net/devel/${remote_path}" | jq -r '.owner_link // empty')
    if [[ -z "$owner_link" ]]; then
      print -u2 "Could not determine Launchpad owner for ${remote_path}."
      return 1
    fi
    remote_path="${owner_link#https://api.launchpad.net/devel/}/${remote_path}"
  fi

  repo_name="${remote_path:t}"

  local encoded_branch api_url url
  encoded_branch=$(printf '%s' "$branch" | jq -sRr @uri)
  api_url="https://api.launchpad.net/devel/${remote_path}/+git/${repo_name}/+ref/${encoded_branch}/landing_targets"
  url=$(curl -fsSL "$api_url" | jq -r '.entries[0].web_link // empty')

  if [[ -z "$url" ]]; then
    print -u2 "No merge proposal found for ${branch}."
    return 1
  fi

  $use_edge && url="${url/code.launchpad.net/edge.launchpad.net}"

  print "$url"
}
