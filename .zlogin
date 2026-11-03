# Login shells. Linked into $HOME by install.sh and sync.sh, replacing any
# machine-local copy (the old one is kept as ~/.zlogin.bak).

# Open the project picker (proj, from .proj.zsh) once per Rex or Herdr pane,
# before the first prompt. The exported pane key stops nested shells in the
# same pane from opening it again. Set PROJ_AUTOSTART=0 to opt out.
#
# A pane opened beside others (a split, or a new tab in the same Herdr space
# or Rex session) starts in the focused pane's folder, so it asks what to run
# in that project (proj --here). A new space or session, or a pane outside a
# repo, gets the full picker. A new Herdr terminal beside one at ~ starts at
# ~ too and stays a plain shell, like the one it was opened from.

# Succeed if this shell should open the picker, with reply set to the pane
# key and the proj arguments. Return 2, with reply set to the pane key, if
# the pane should stay a plain shell.
function _proj_autostart_wanted() {
  emulate -L zsh
  [[ -o interactive && ${PROJ_AUTOSTART:-1} != 0 ]] && (( $+functions[proj] )) ||
    return 1
  local key info
  local -a ids
  if [[ -n ${REX_SESSION:-} && -n ${REX_BLOCK:-} ]]; then
    key=rex:$REX_BLOCK
  elif [[ -n ${HC_TERMINAL_ID:-} ]]; then
    key=herdr:$HC_TERMINAL_ID
  else
    return 1
  fi
  [[ ${PROJ_AUTOSTART_PANE:-} != $key ]] || return 1
  reply=($key)

  if [[ $key == rex:* ]]; then
    # Rex blocks in this session, this one included.
    (( $+commands[rex] )) &&
      ids=(${(f)"$(rex --autostart=false block ls -s $REX_SESSION -q --short=false 2>/dev/null)"})
  else
    # Every Herdr pane is a herdr-core terminal, but so is a shell an agent
    # starts with `hc run`, which must stay plain. Only open the picker in
    # terminals the Herdr app placed in a space and nothing else started.
    (( $+commands[hc] )) && info=$(hc get $HC_TERMINAL_ID --json 2>/dev/null) ||
      return 1
    [[ $info == *'"parent":null'* && $info =~ '"herdr\.space":"([^"]+)"' ]] ||
      return 1
    # Live terminals in this space, this one included.
    info=$(hc ls --json --label herdr.space=$match[1] 2>/dev/null)
    ids=(${(M)${(s:,:)info}:#*'"address":'*})
  fi
  if (( $#ids > 1 )); then
    [[ $key == herdr:* && $PWD -ef $HOME ]] && return 2
    reply+=(--here)
  fi
  return 0
}

_proj_autostart_wanted
case $? in
2)
  # Still mark the pane, so nested shells in it stay plain too.
  export PROJ_AUTOSTART_PANE=$reply[1]
  ;;
0)
  export PROJ_AUTOSTART_PANE=$reply[1]
  typeset -ga _proj_autostart_args=(${reply[2,-1]})
  function _proj_first_prompt() {
    add-zsh-hook -d precmd _proj_first_prompt
    unfunction _proj_first_prompt
    local -a args=($_proj_autostart_args)
    unset _proj_autostart_args
    # z4h may redirect output during startup; talk to the terminal directly.
    proj $args </dev/tty >/dev/tty 2>&1
  }
  autoload -Uz add-zsh-hook
  # Run before the prompt's own precmd hooks so the prompt shows the new
  # directory.
  precmd_functions=(_proj_first_prompt $precmd_functions)
  ;;
esac
unfunction _proj_autostart_wanted
