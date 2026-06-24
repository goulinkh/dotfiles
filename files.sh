# Dotfiles symlinked into $HOME by install.sh and sync.sh.
# Single source of truth — edit here, both scripts pick it up.
FILES=(
  .zshenv
  .zshrc
  .p10k.zsh
  .alias.zsh
  .claupilot.zsh
  .mp.zsh
  .gitconfig
  .screenrc
  .gitallowedsigners
  .omp/agent/config.yml
  .omp/agent/models.yaml
  .omp/agent/APPEND_SYSTEM.md
  .config/zed/settings.json
  .config/zed/keymap.json
  .config/zed/AGENTS.md
  .config/htop/htoprc
  .copilot/settings.json
)
