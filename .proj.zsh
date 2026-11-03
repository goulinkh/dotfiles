# Project picker. Sourced from .zshrc; .zlogin opens it in new Rex and Herdr
# panes.
#
#   proj            pick a project, then run the chosen action in this shell
#   proj --here     choose what to run in the project this shell is in
#                   (the full picker when it isn't in one)
#
# Keys: enter  pi in the project (--here: the highlighted action)
#       ctrl-o cd into the project (plain shell)
#       ctrl-r pi --resume in the project
#       ctrl-e open the project in Zed and keep the menu open (needs zed)
#       ctrl-g lazygit in the project (needs lazygit)
#       esc    plain shell where the terminal started
#
# Projects are git/jj repos found $PROJ_DEPTH levels under each of
# $PROJ_ROOTS, plus any repo zoxide knows about. The repo this shell is in
# comes first (a new Herdr space starts in the focused terminal's folder).
# Then come repos zoxide has seen, by frecency: the scores of every folder
# zoxide tracks in the repo, its subfolders included, added up. The rest
# follow by path. ~/Lab and ~/lab are listed separately because a symlinked
# root isn't followed from $HOME.

: ${PROJ_ROOTS:="$HOME $HOME/Lab $HOME/lab"}
: ${PROJ_DEPTH:=4}

# Set REPLY to the repo (the nearest folder with .git or .jj) that the
# folder $1 is in. Fail outside a repo.
function _proj_repo_root() {
  emulate -L zsh
  [[ -n $1 ]] || return 1
  REPLY=$1
  until [[ -e $REPLY/.git || -e $REPLY/.jj ]]; do
    [[ $REPLY == / ]] && return 1
    REPLY=${REPLY:h}
  done
}

# Print "display<TAB>path" for every project, best first. Both go through
# the configured root, so a symlinked root keeps its short form in $PWD.
function _proj_list() {
  emulate -L zsh
  local root real dir key disp score
  local -i milli
  local -a roots ranked rest
  local -A disp_of root_of score_of
  roots=(${=PROJ_ROOTS})

  # Show paths through the root as configured (~/Lab), not the resolved
  # symlink target (/Volumes/Disk1/Lab). Skip hidden, dependency, and build
  # directories, plus the macOS folders that trigger privacy prompts.
  for root in $roots; do
    [[ -d $root ]] || continue
    real=${root:A}
    (( $+root_of[$real] )) && continue  # ~/lab is ~/Lab on macOS
    root_of[$real]=$root
    find "$real" -maxdepth $PROJ_DEPTH \
      \( -name .git -o -name .jj \) -print -prune -o \
      \( -name '.*' -o -name node_modules -o -name vendor -o -name venv \
         -o -name dist -o -name build -o -name target -o -name snap -o -name go \
         -o -name Library -o -name Applications -o -name Desktop -o -name Documents \
         -o -name Downloads -o -name Movies -o -name Music -o -name Pictures \) -prune \
      2>/dev/null |
    while IFS= read -r dir; do
      dir=${dir%/*}
      disp_of[$dir]=$root${dir#$real}
    done
  done

  # Add up zoxide's scores per repo, so visits to its subfolders count for
  # it, and rank repos by the total. Each score already weighs visit count by
  # recency. Totals are zero-padded integers (thousandths), which sort
  # correctly as text in any locale.
  if (( $+commands[zoxide] )); then
    zoxide query --list --score 2>/dev/null | while read -r score dir; do
      _proj_repo_root ${dir:A} || continue
      score_of[$REPLY]=$(( ${score_of[$REPLY]:-0} + score ))
    done
  fi
  for key score in ${(kv)score_of}; do
    (( milli = score * 1000 ))
    ranked+=("${(l:15::0:)milli} $key")
  done
  ranked=(${${(O)ranked}#* })

  # The repo this shell is in goes first.
  _proj_repo_root ${PWD:A} && ranked=($REPLY ${ranked:#${(b)REPLY}})

  # Ranked repos may sit outside the roots, where find didn't look.
  for key in $ranked; do
    [[ -n ${disp_of[$key]} ]] && continue
    disp=$key
    for real root in ${(kv)root_of}; do
      [[ $key == $real/* ]] && { disp=$root${key#$real}; break; }
    done
    disp_of[$key]=$disp
  done

  rest=(${(ko)disp_of})
  for key in $ranked ${rest:|ranked}; do
    print -r -- "${disp_of[$key]/#$HOME/~}"$'\t'"${disp_of[$key]}"
  done
}

# Set REPLY to the action a picker key runs (empty for enter).
function _proj_key_action() {
  case $1 in
    ctrl-o) REPLY=shell ;;
    ctrl-r) REPLY=resume ;;
    ctrl-e) REPLY=zed ;;
    ctrl-g) REPLY=lazygit ;;
    *)      REPLY= ;;
  esac
}

# cd into the project $2 and run action $1 there: pi, resume, lazygit or
# shell.
function _proj_open() {
  cd -- "$2" || return
  case $1 in
    resume)  pi --resume ;;
    lazygit) lazygit ;;
    shell)   ;;
    *)       pi ;;
  esac
}

# Ask what to run in the project $1, as a list with the picker's keys.
# Opening Zed brings the menu back; "another project" opens the picker.
function _proj_here() {
  emulate -L zsh
  local dir=$1 action
  local -a items out hints=('enter run' '^r pi resume') expect=(ctrl-o ctrl-r)
  items=($'pi\tpi' $'resume\tpi --resume')
  if (( $+commands[zed] )); then
    items+=$'zed\tZed'
    hints+='^e zed'
    expect+=ctrl-e
  fi
  if (( $+commands[lazygit] )); then
    items+=$'lazygit\tlazygit'
    hints+='^g lazygit'
    expect+=ctrl-g
  fi
  items+=($'shell\tshell' $'projects\tanother project…')
  hints+='esc shell'

  while true; do
    out=("${(@f)$(print -rl -- $items | fzf \
      --layout=reverse --info=hidden --no-sort --height=~100% \
      --delimiter=$'\t' --with-nth=2 \
      --prompt="${dir/#$HOME/~} › " \
      --header=${(j: · :)hints} \
      --expect=${(j:,:)expect})}")

    # out[1] is the key pressed (empty for enter), out[2] the selected line.
    (( $#out >= 2 )) || return 0
    _proj_key_action $out[1]
    action=${REPLY:-${out[2]%%$'\t'*}}
    [[ $action == zed ]] || break
    zed $dir
  done

  if [[ $action == projects ]]; then
    proj
  else
    _proj_open $action $dir
  fi
}

function proj() {
  emulate -L zsh
  (( $+commands[fzf] )) || { print -u2 'proj: fzf is not installed'; return 1 }

  # Keep $PWD's form (~/Lab, not the symlink target) for the prompt and cd.
  if [[ $1 == --here ]] && _proj_repo_root $PWD; then
    _proj_here $REPLY
    return
  fi

  # Offer Zed and lazygit only where they're installed.
  local -a hints=('enter pi' '^o cd' '^r pi resume') expect=(ctrl-o ctrl-r) binds=()
  if (( $+commands[zed] )); then
    hints+='^e zed'
    binds+=(--bind='ctrl-e:execute-silent(zed {2})')
  fi
  if (( $+commands[lazygit] )); then
    hints+='^g lazygit'
    expect+=ctrl-g
  fi
  hints+='esc shell'

  local -a out
  out=("${(@f)$(_proj_list | fzf \
    --layout=reverse --info=inline-right --no-sort --tiebreak=index \
    --delimiter=$'\t' --with-nth=1 --nth=1 \
    --prompt='project › ' \
    --header=${(j: · :)hints} \
    --expect=${(j:,:)expect} \
    $binds \
    --bind='ctrl-/:toggle-preview' \
    --preview-window='right,45%,border-left,<100(hidden)' \
    --preview='cd {2} 2>/dev/null || exit 0
      git -c color.status=always status -sb 2>/dev/null | head -n 12; echo
      git log -n 8 --color=always --format="%C(yellow)%h%C(reset) %s %C(dim)%cr%C(reset)" 2>/dev/null; echo
      ls -A | head -n 40')}")

  # out[1] is the key pressed (empty for enter), out[2] the selected line.
  (( $#out >= 2 )) || return 0
  _proj_key_action $out[1]
  _proj_open ${REPLY:-pi} ${out[2]#*$'\t'}
}
