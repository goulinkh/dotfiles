# Dotfiles symlinked into $HOME by install.sh and sync.sh.
# Single source of truth — edit here, both scripts pick it up.

# Resolve platform-specific sources without changing their destination names.
# The caller sets DIR to the dotfiles repository root.
dotfile_source() {
  case "$1:$(uname -s)" in
    .config/herdr-app/settings.json:Linux)
      printf '%s\n' "$DIR/.config/herdr-app/settings.linux.json" ;;
    *) printf '%s\n' "$DIR/$1" ;;
  esac
}
FILES=(
  .zshenv
  .zshrc
  .zlogin
  .p10k.zsh
  .alias.zsh
  .claupilot.zsh
  .mp.zsh
  .vpn.zsh
  .proj.zsh
  .gitconfig
  .screenrc
  .agents/skills/gohuman
  .agents/skills/visual-explain
  .codex/config.toml
  .codex/AGENTS.md
  .codex/hooks.json
  .codex/skills/code-review
  .omp/agent/config.yml
  .omp/agent/models.yaml
  .omp/agent/APPEND_SYSTEM.md
  .omp/agent/rules/boundary-value-validation.md
  .omp/agent/rules/code-no-placeholder-implementations.md
  .omp/agent/rules/go-no-ignored-errors.md
  .omp/agent/rules/jsdoc-tsdoc-contracts.md
  .omp/agent/rules/js-no-dynamic-eval.md
  .omp/agent/rules/js-ts-missing-contract-docs.md
  .omp/agent/rules/js-ts-oversized-functions.md
  .omp/agent/rules/py-no-mutable-default.md
  .omp/agent/rules/py-no-swallowed-exceptions.md
  .omp/agent/rules/sh-avoid-unsafe-recursive-removal.md
  .omp/agent/rules/sql-use-bound-parameters.md
  .omp/agent/rules/ts-avoid-unsafe-assertions.md
  .omp/agent/rules/ts-avoid-weak-types.md
  .omp/agent/extensions/inherit-subagent-model.ts
  .pi/agent/settings.json
  .pi/agent/models.json
  .pi/agent/pi-auto-title.json
  .pi/agent/APPEND_SYSTEM.md
  .pi/agent/prompts/explain.md
  .pi/agent/prompts/visual-explain.md
  .pi/agent/extensions/fast-mode.json
  .pi/agent/extensions/openrouter-vertex.ts
  .pi/agent/extensions/jev-wiki-vault
  # pi-review reads REVIEW_GUIDELINES.md beside the nearest .pi directory,
  # which is ~ for any project without its own .pi.
  REVIEW_GUIDELINES.md
  .config/vale-general/.vale.ini
  .config/vale-general/styles/Prose/LongSentence.yml
  .config/git/ignore
  .config/pi/compact-status-line
  .config/zed/settings.json
  .config/zed/keymap.json
  .config/zed/AGENTS.md
  .config/zed/tasks.json
  .config/htop/htoprc
  .config/ghostty/config
  .config/herdr-core/config.toml
  .config/herdr-app/settings.json
  .config/herdr-app/programs.json
  .config/herdr-app/layouts/my-main.json
  .config/herdr-app/mods/my-chrome
  .config/herdr-app/mods/my-changes
  .config/herdr-app/mods/my-file-links
  .config/herdr-app/mods/my-files
  .config/herdr-app/mods/my-tabs
  .config/herdr-app/mods/system-notify
  .config/herdr-app/themes/rex-one-dark-two.json
  .config/herdr-app/themes/rex-merino-light.json
  .copilot/settings.json
  .claude/settings.json
  .claude/skills/gohuman
  .claude/skills/visual-explain
  .claude/CLAUDE.md
  .claude/hooks
)
