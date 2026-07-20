# Changelog

## [Unreleased]

### Added

- Capture multi-line pipeline requests in the native TUI editor and echo them to
  the session transcript.
- Accept standalone requests through `--request`/`-r` or stdin, with the
  configured request file as a fallback.

### Fixed

- Always clear live swarm status and stream surfaces when pipeline execution
  throws.

## [16.3.7] - 2026-07-05

### Fixed

- Fixed the peer dependency range for @oh-my-pi/pi-coding-agent to match the current ^16 major version.

## [15.9.0] - 2026-06-04

### Fixed

- Fixed swarm `/swarm run` failing with authStorage/modelRegistry identity error ([#1472](https://github.com/can1357/oh-my-pi/issues/1472))
