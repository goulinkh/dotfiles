# Aliases & functions. Sourced from .zshrc.

# Launchpad username (override in ~/.zsh.local).
: ${LAUNCHPAD_USERNAME:=goulinkh}

# --- git ---
alias gpf="git push --force-with-lease"
alias gpu="git pull"
alias push_lp='git push git+ssh://$LAUNCHPAD_USERNAME@git.launchpad.net/~$LAUNCHPAD_USERNAME/$(basename $(git rev-parse --show-toplevel)) $(git branch --show-current)'

# Git branch delete locally + remotely
function gbd() {
  git branch -D $1
  git push origin --delete $1
}

# Reset branch to remote, pull, then re-merge unpushed commits
function git-refresh-pushed() {
  local current_branch
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  local stash_branch="tmp-stash-${current_branch}-$(date +%s)"
  git branch "$stash_branch"
  git reset --hard "origin/${current_branch}"
  git pull
  git merge "$stash_branch"
  git branch -d "$stash_branch"
}

# --- editors / tools (alias only when the tool exists) ---
if command -v nvim &>/dev/null; then
  alias vi=nvim
  alias vim=nvim
fi
command -v code   &>/dev/null && alias c="code"
command -v zoxide &>/dev/null && alias zz="zi"
command -v lsd &>/dev/null && alias ls="lsd --group-dirs first --color always --human-readable --hyperlink auto"
# bat ships as `batcat` on Debian/Ubuntu.
if command -v bat &>/dev/null; then
  alias bat="bat --paging never"
elif command -v batcat &>/dev/null; then
  alias bat="batcat --paging never"
fi

if [[ $(uname -s) == Linux ]]; then
  function pbcopy() {
    if command -v wl-copy &>/dev/null; then
      wl-copy "$@"
    elif command -v xclip &>/dev/null; then
      xclip -selection clipboard "$@"
    elif command -v xsel &>/dev/null; then
      xsel --clipboard --input "$@"
    else
      echo "pbcopy: install wl-clipboard, xclip, or xsel" >&2
      return 1
    fi
  }
fi

# --- package managers ---
if command -v pnpx &>/dev/null; then
  alias x=pnpx
  alias npx=pnpx
fi
if command -v pnpm &>/dev/null; then
  alias pn="pnpm"
  alias start="pnpm start"
  alias dev="pnpm dev"
fi
command -v bun &>/dev/null && alias sb="bun run storybook"
command -v php &>/dev/null && alias art="php artisan"

# --- k8s / juju ---
command -v kubectl &>/dev/null && alias k="kubectl"
if command -v juju &>/dev/null; then
  alias jsft="juju status"
  alias js="juju status"
  alias jsw="juju status --watch 1s"
fi

# --- dotfiles ---
alias dotsync="$HOME/dotfiles/sync.sh"
function dotpkg() {
  case "$(uname -s)" in
    Darwin) "$HOME/dotfiles/packages/macos.sh" ;;
    Linux)  "$HOME/dotfiles/packages/ubuntu.sh" ;;
    *)      echo "unknown OS: $(uname -s)" >&2 ; return 1 ;;
  esac
}

# --- ssh ---
alias ubuntu="ssh ubuntu@${ORBSTACK_MAIN_VM_HOST}"
alias ps6="ssh $LAUNCHPAD_USERNAME@webdesign-bastion-ps6.internal"
alias ps5="ssh $LAUNCHPAD_USERNAME@webdesign-bastion-ps5.internal"

# --- claude variants (tokens come from ~/.zsh.local) ---
alias klaude='ANTHROPIC_BASE_URL=https://api.kimi.com/coding ANTHROPIC_AUTH_TOKEN=$KIMI_API_TOKEN ANTHROPIC_MODEL=kimi-k2.6 ANTHROPIC_DEFAULT_OPUS_MODEL=kimi-k2.6 ANTHROPIC_DEFAULT_SONNET_MODEL=kimi-k2.6 ANTHROPIC_DEFAULT_HAIKU_MODEL=kimi-k2.6 CLAUDE_CODE_SUBAGENT_MODEL=kimi-k2.6 ENABLE_TOOL_SEARCH=false claude'
alias clodex="ANTHROPIC_BASE_URL=http://localhost:8080 ANTHROPIC_API_KEY=pwd ANTHROPIC_DEFAULT_OPUS_MODEL=gpt-5.5 ANTHROPIC_DEFAULT_SONNET_MODEL=gpt-5.5-codex ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-5.5-mini ANTHROPIC_MODEL='gpt-5.5' claude"
alias orc='ANTHROPIC_BASE_URL=$CLAUDE_OR_BASE_URL ANTHROPIC_AUTH_TOKEN=$OPENROUTER_API_KEY ANTHROPIC_MODEL=$CLAUDE_OR_MODEL_MAIN ANTHROPIC_DEFAULT_OPUS_MODEL=$CLAUDE_OR_MODEL_MAIN ANTHROPIC_DEFAULT_SONNET_MODEL=$CLAUDE_OR_MODEL_FAST ANTHROPIC_DEFAULT_HAIKU_MODEL=$CLAUDE_OR_MODEL_LIGHT CLAUDE_CODE_SUBAGENT_MODEL=$CLAUDE_OR_MODEL_FAST ENABLE_TOOL_SEARCH=false claude'

# --- python venv helpers ---
# usage: venv [--clean] [path]  (default path: .venv)
function venv() {
  local clean=false
  if [[ ${1:-} == "--clean" ]]; then
    clean=true
    shift
  fi
  local venv_path=${1:-.venv}
  if $clean; then
    venv-clean $venv_path
  fi
  echo "Creating virtual environment at $venv_path"
  echo "Python version: $(python3 --version)"
  python3 -m venv $venv_path
  source $venv_path/bin/activate
  $venv_path/bin/pip install -r requirements.txt
}

function poetry-venv() {
  local venv_path=${1:-.venv}
  echo "Creating virtual environment at $venv_path"
  python3 -m venv $venv_path
  source $venv_path/bin/activate
  poetry install --no-interaction
}

function venv-clean() {
  local venv_path=${1:-.venv}
  if [[ $venv_path == /* ]]; then
    echo "Invalid path: $venv_path"
    return 1
  fi
  echo "Removing virtual environment at $venv_path"
  rm -rf $venv_path
}

# Load .env / .env.local into the environment
function load_dotenv() {
  if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
  fi
  if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
  fi
}

# Add latest version of a package to requirements.txt and install
function pip-add() {
  if [[ -z "$1" ]]; then
    echo "Usage: pip-add package-name [requirements-file]"
    return 1
  fi
  local package_name="$1"
  local req_file="${2:-requirements.txt}"
  local latest_version=$(pip index versions "$package_name" 2>/dev/null | grep -m1 "Available versions:" | cut -d' ' -f3 | tr -d ',')
  if [[ -z "$latest_version" ]]; then
    echo "Error: Could not find package '$package_name' or its version information"
    return 1
  fi
  [[ -f "$req_file" ]] || touch "$req_file"
  if grep -q "^${package_name}==" "$req_file"; then
    sed -i.bak "s/^${package_name}==.*/${package_name}==${latest_version}/" "$req_file"
    rm "${req_file}.bak"
    echo "Updated ${package_name} to version ${latest_version} in ${req_file}"
  else
    echo "${package_name}==${latest_version}" >>"$req_file"
    echo "Added ${package_name}==${latest_version} to ${req_file}"
    venv
  fi
}

# Kill process listening on a TCP port. usage: killport 8002
function killport() {
  if [[ -z "$1" ]]; then
    echo "Usage: killport <port>"
    return 1
  fi
  local pids
  pids="$(lsof -ti tcp:"$1")"
  if [[ -z "$pids" ]]; then
    echo "No process on port $1"
    return 0
  fi
  echo "$pids" | xargs kill -9
  echo "Killed port $1: $pids"
}
