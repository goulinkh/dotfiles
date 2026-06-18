# ~/.claupilot.zsh
# Launch Claude Code against a local copilot-api proxy, starting the proxy
# fully detached so it survives the shell/terminal that launched it.
# Portable across Linux and macOS.

# True if something is already listening on the proxy port.
_copilot_api_running() {
  node -e "require('net').connect(4141,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" \
    >/dev/null 2>&1
}

# Start copilot-api detached from the calling shell so closing the terminal or
# exiting the shell does not stop it. Robustness comes from four things:
#   * stdin from /dev/null   -> no controlling-terminal reads / SIGTTIN
#   * stdout/stderr to a log -> no terminal writes after it closes
#   * setsid when available  -> brand-new session, no controlling terminal,
#                               immune to the SIGHUP a closing terminal sends
#                               (Linux; macOS has no setsid, nohup covers it)
#   * nohup + disown         -> ignore SIGHUP and drop the job from the shell's
#                               table so zsh/bash won't signal it on exit
# The detached leader records its own PID (preserved across exec) so it and its
# children can be stopped later via the process group.
_copilot_api_start() {
  local dir="$HOME/.local/share/copilot-api"
  local log_path="$dir/proxy.log"
  local pid_path="$dir/proxy.pid"
  mkdir -p "$dir"
  rm -f "$log_path"

  local setsid_cmd=""
  command -v setsid >/dev/null 2>&1 && setsid_cmd="setsid"

  $setsid_cmd nohup sh -c 'echo $$ > "$1"; exec npx copilot-api start --port 4141' \
    _ "$pid_path" </dev/null >"$log_path" 2>&1 &
  disown 2>/dev/null
}

# Stop the detached proxy and its children. npx spawns node, so we signal the
# whole process group when we can prove the recorded PID leads its own group
# (true under setsid, and under job control). Otherwise we fall back to a
# single-PID kill so we never risk signalling the shell's own group. Works on
# Linux and macOS.
_copilot_api_stop() {
  local pid_path="$HOME/.local/share/copilot-api/proxy.pid"
  local pid
  pid=$(cat "$pid_path" 2>/dev/null)
  case "$pid" in ""|*[!0-9]*) rm -f "$pid_path"; return 0 ;; esac

  local pgid
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')

  local target
  if [ -n "$pgid" ] && [ "$pgid" = "$pid" ]; then
    target="-$pgid"   # confirmed group leader -> signal the whole group
  else
    target="$pid"     # not a leader -> signal just this process
  fi

  kill -TERM "$target" 2>/dev/null
  local i=0
  while kill -0 "$target" 2>/dev/null; do
    sleep 0.2
    i=$((i + 1))
    [ "$i" -ge 25 ] && { kill -KILL "$target" 2>/dev/null; break; }
  done
  rm -f "$pid_path"
}

function claupilot() {
  # 1. Check if copilot-api proxy is already running on port 4141
  if ! _copilot_api_running; then
    echo "==> copilot-api proxy is not running on port 4141."

    # 2. Check if GitHub Token exists for copilot-api
    local token_path="$HOME/.local/share/copilot-api/github_token"
    if [ ! -s "$token_path" ] || ! npx copilot-api debug 2>/dev/null | grep -q "Token exists: Yes"; then
      echo "==> GitHub Token not found or invalid."
      echo "==> Starting GitHub Copilot authentication flow..."
      npx copilot-api auth
      if [ ! -s "$token_path" ]; then
        echo "Error: Authentication failed."
        return 1
      fi
    fi

    # 3. Start the proxy detached so it outlives this shell
    local log_path="$HOME/.local/share/copilot-api/proxy.log"
    echo "==> Starting copilot-api proxy in the background on port 4141..."
    _copilot_api_start

    # Wait for the proxy to become healthy or catch redirect asks
    echo -n "==> Waiting for proxy to start..."
    local attempts=0
    local max_attempts=30
    while true; do
      # Check if port is open and listening
      if _copilot_api_running; then
        break
      fi

      # Check if background server is asking for login
      if grep -q -E "Please enter the code|Not logged in" "$log_path" 2>/dev/null; then
        echo ""
        echo "==> Session expired or authentication required. Stopping background server..."
        _copilot_api_stop

        echo "==> Launching interactive GitHub Copilot authentication flow..."
        npx copilot-api auth

        if [ ! -s "$token_path" ]; then
          echo "Error: Authentication failed."
          return 1
        fi

        echo "==> Restarting copilot-api proxy in the background..."
        _copilot_api_start
        attempts=0
      fi

      sleep 0.5
      attempts=$((attempts + 1))
      if [ "$attempts" -ge "$max_attempts" ]; then
        echo ""
        echo "Error: Proxy failed to start. Check logs at: $log_path"
        return 1
      fi
      echo -n "."
    done
    echo " Ready!"
  fi

  # 4. Invoke Claude Code with full environment setup mapping to Copilot
  ANTHROPIC_BASE_URL="http://127.0.0.1:4141" \
  ANTHROPIC_API_KEY="sk-dummy" \
  ANTHROPIC_AUTH_TOKEN="sk-dummy" \
  ANTHROPIC_MODEL="claude-sonnet-4.6" \
  ANTHROPIC_DEFAULT_OPUS_MODEL="claude-opus-4.8" \
  ANTHROPIC_DEFAULT_SONNET_MODEL="claude-sonnet-4.6" \
  ANTHROPIC_DEFAULT_HAIKU_MODEL="claude-haiku-4.5" \
  CLAUDE_CODE_SUBAGENT_MODEL="claude-haiku-4.5" \
  DISABLE_NON_ESSENTIAL_MODEL_CALLS="1" \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1" \
  claude "$@"
}
