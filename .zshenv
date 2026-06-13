# Loaded for all Zsh instances. Bootstraps zsh4humans (z4h).
# Docs: https://github.com/romkatv/zsh4humans

: ${ZDOTDIR:=~}
[[ -o interactive ]] || return

Z4H_URL="https://raw.githubusercontent.com/romkatv/zsh4humans/v5"
: "${Z4H:=${XDG_CACHE_HOME:-$HOME/.cache}/zsh4humans/v5}"

umask o-w

# Download z4h.zsh on first run.
if [ ! -e "$Z4H"/z4h.zsh ]; then
  mkdir -p -- "$Z4H" || return
  >&2 printf '\033[33mz4h\033[0m: bootstrapping \033[4m%s\033[0m\n' z4h.zsh
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -- "$Z4H_URL"/z4h.zsh >"$Z4H"/z4h.zsh.$$ || return
  elif command -v wget >/dev/null 2>&1; then
    wget -O- -- "$Z4H_URL"/z4h.zsh >"$Z4H"/z4h.zsh.$$ || return
  else
    >&2 echo 'z4h: please install curl or wget'
    return 1
  fi
  mv -- "$Z4H"/z4h.zsh.$$ "$Z4H"/z4h.zsh || return
fi

. "$Z4H"/z4h.zsh || return
