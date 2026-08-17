# zsh4humans config. Docs: https://github.com/romkatv/zsh4humans/blob/v5/README.md

# Periodic auto-update: 'ask' or 'no'.
zstyle ':z4h:'                auto-update      'no'
zstyle ':z4h:'                auto-update-days '28'

# Don't prompt to change login shell — install.sh runs chsh.
zstyle ':z4h:'                chsh             'no'

# Keyboard type: 'mac' or 'pc'.
zstyle ':z4h:bindkey'         keyboard         'mac'

# Semantic terminal integration.
zstyle ':z4h:'                term-shell-integration 'yes'

# Right-arrow accepts one char of autosuggestion.
zstyle ':z4h:autosuggestions' forward-char     'accept'

# Don't recurse dirs on TAB-complete (faster).
zstyle ':z4h:fzf-complete'    recurse-dirs     'no'

# Pull oh-my-zsh so we can load its plugins below.
z4h install ohmyzsh/ohmyzsh || return

# Init z4h (fzf, autosuggestions, syntax-highlighting, completions).
z4h init || return

# --- oh-my-zsh plugins via z4h ---
z4h load ohmyzsh/ohmyzsh/plugins/git
z4h load ohmyzsh/ohmyzsh/plugins/aws

# --- PATH ---
path=(
  ~/.local/bin
  ~/.npm-global/bin
  ~/go/bin
  "$HOME/.bun/bin"
  "${KREW_ROOT:-$HOME/.krew}/bin"
  "/Users/goulin/Library/pnpm"
  "/Users/goulin/.opencode/bin"
  $path
)
export PNPM_HOME="/Users/goulin/Library/pnpm"
export BUN_INSTALL="$HOME/.bun"

# --- env ---
export GPG_TTY=$TTY
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# --- macOS-specific env ---
if [[ $OSTYPE == darwin* ]]; then
  # Puppeteer: use system Chrome if present
  _chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [[ -x $_chrome ]] && export PUPPETEER_EXECUTABLE_PATH=$_chrome
  unset _chrome

  # VS Code keeps its `code` CLI inside the app bundle; macOS only puts it on
  # PATH if "Shell Command: Install 'code' command" was run (needs sudo).
  _vscode_bin="/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
  [[ -d $_vscode_bin ]] && path+=($_vscode_bin)
  unset _vscode_bin

  # Homebrew openssl (Apple Silicon prefix)
  [[ -d /opt/homebrew/opt/openssl ]] && \
    export LDFLAGS="-I/opt/homebrew/opt/openssl/include -L/opt/homebrew/opt/openssl/lib"

  # OrbStack docker socket
  [[ -S "$HOME/.orbstack/run/docker.sock" ]] && \
    export DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock"
fi

# --- editor ---
# Runs after the PATH tweaks above so `code` is resolvable when it exists.
# `--wait` is required: without it `code` returns immediately and git (or any
# tool that waits on $EDITOR) reads an empty buffer.
# A VS Code Remote-SSH terminal exports VSCODE_IPC_HOOK_CLI and puts the
# server's remote-cli `code` on PATH, so it edits in the attached window; a
# plain SSH login has no window to attach to and gets vim.
if [[ -n $SSH_CONNECTION && -z $VSCODE_IPC_HOOK_CLI ]]; then
  export EDITOR='vim'
elif (( $+commands[code] )); then
  export EDITOR='code --wait'
else
  export EDITOR='vim'
fi

# --- completion ---
# Configure Oh My Zsh-style horizontal (rows-first) tab completion.
zmodload -i zsh/complist
setopt LIST_ROWS_FIRST
setopt LIST_PACKED
zstyle ':completion:*' menu select
bindkey '^I' expand-or-complete

# --- tool init (load only if installed) ---
# Use upstream fzf completion so TAB stays native unless the trigger is present.
if command -v fzf &>/dev/null; then
  export FZF_COMPLETION_TRIGGER='**'
  _fzf_init="$(fzf --zsh 2>/dev/null)" && eval "$_fzf_init"
  unset _fzf_init
fi
command -v mise   &>/dev/null && eval "$(mise activate zsh)"
command -v zoxide &>/dev/null && eval "$(zoxide init zsh)"
[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"
[ -f ~/.deno/env ] && source ~/.deno/env

# --- key bindings ---
# iTerm2 cmd+delete -> delete to line start
bindkey "^X\x7f" backward-kill-line

# --- functions / aliases ---
z4h source ~/.alias.zsh
z4h source ~/.mp.zsh
z4h source ~/.vpn.zsh

# --- machine-local secrets & overrides (NOT in git) ---
z4h source ~/.zsh.local
