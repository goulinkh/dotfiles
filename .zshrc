# zsh4humans config. Docs: https://github.com/romkatv/zsh4humans/blob/v5/README.md

# Periodic auto-update: 'ask' or 'no'.
zstyle ':z4h:'                auto-update      'no'
zstyle ':z4h:'                auto-update-days '28'

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

# --- editor ---
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='code'
fi

# --- env ---
export GPG_TTY=$TTY
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# --- macOS-specific env ---
if [[ $OSTYPE == darwin* ]]; then
  # Puppeteer: use system Chrome if present
  _chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [[ -x $_chrome ]] && export PUPPETEER_EXECUTABLE_PATH=$_chrome
  unset _chrome

  # Homebrew openssl (Apple Silicon prefix)
  [[ -d /opt/homebrew/opt/openssl ]] && \
    export LDFLAGS="-I/opt/homebrew/opt/openssl/include -L/opt/homebrew/opt/openssl/lib"

  # OrbStack docker socket
  [[ -S "$HOME/.orbstack/run/docker.sock" ]] && \
    export DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock"
fi

# --- tool init (load only if installed) ---
# z4h already wires fzf; `fzf --zsh` is a bonus for fzf >= 0.48 (older fzf
# lacks the flag and errors with "unknown option: --zsh").
if command -v fzf &>/dev/null; then
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

# --- machine-local secrets & overrides (NOT in git) ---
z4h source ~/.zsh.local
