# Changelog

All notable changes to Billy are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Billy uses [Semantic Versioning](https://semver.org/). How to cut a release is described in the README, under [Releasing](README.md#releasing).

## [Unreleased]

### Fixed

- The first run now finds an existing Claude Code setup. Billy looked for `~/.claude/.claude.json`, but a default setup keeps that file in your home as `~/.claude.json`, so the offer to adopt `~/.claude` never appeared.
- An account adopted from `~/.claude` launches with `CLAUDE_CONFIG_DIR` unset, like a plain `claude`. Setting it made Claude Code look for its account file inside `~/.claude`, missing what the default setup recorded in `~/.claude.json`. Uninstalling a private plugin copy from that account follows the same rule.
- A shared plugin whose manifest name isn't a plain folder name (such as `../../x`) is refused, instead of being linked outside `~/.billy/plugins/`.
- Two different repositories with the same `owner/repo` name, such as a fork on another host, no longer share one clone in `~/.billy/repos/`. Billy reuses a clone only when its origin is the repository asked for, and treats `https://` and `git@` URLs of the same repository as the same. A URL ending in `.git/` now maps to the same clone as one without.

## [1.0.1] - 2026-11-05

### Added

- Billy is on npm: `npm install -g @francescocretti/billy`. The command is still `billy`.
- MIT license.

## [1.0.0] - 2026-11-05

### Added

- **Shared plugins screen** (⚙ Settings → Shared plugins). It lists the plugins loaded into every account and adds new ones, either from a plugin one of your accounts already installed or from any git repository. Each one can be updated (`git pull`) or removed. After adding a plugin, Billy offers to uninstall the private copies accounts already had, so every account runs the same one.
- `BILLY_DIR` environment variable, to keep Billy's folder somewhere other than `~/.billy`.
- GIFs of Billy in action in the README, recorded with VHS. Regenerate them with `docs/demo/record.sh`.
- This changelog.

### Changed

- Billy's own data now lives in `~/.billy/`: the account list, settings, and the shared plugins' clones and links. `~/.config/billy/` is migrated automatically on first launch. Content you author stays in `~/.agents/`.
- Paths under your home are shown as `~/…` in menus and messages.

### Removed

- Plugins in `~/.agents/plugins/` are no longer loaded. The Shared plugins screen lists anything left there so you can add it again.

## [0.3.0] - 2026-09-09

### Added

- Shared plugins: every plugin in `~/.agents/plugins/` is loaded into every account with `--plugin-dir`, which restores terminal integrations like Warp's on accounts that never installed them.
- ⚙ Settings screen, keeping the account list a list of accounts. It holds:
  - the shared-resources setting of each account, which could only be chosen at creation before;
  - account deletion, with the config dir kept by default;
  - the language choice;
  - a "Where everything lives" summary.
- English and Italian UI. English is the default, and the choice is never guessed from the system locale.
- First run adopts an existing `~/.claude` as an account, asking only for its name.

### Fixed

- A plugin an account already installed itself is no longer loaded a second time, which fired every hook twice.

## [0.2.0] - 2026-08-20

### Added

- Shared resources: skills, commands, agents and `CLAUDE.md` in `~/.agents/` are symlinked into each account that opts in, at every launch. `BILLY_AGENTS_DIR` relocates the source.
- Shared MCP servers: `~/.agents/mcp.json` is passed with `--mcp-config` to accounts using shared resources.

### Fixed

- The sync recognises equivalent absolute symlinks instead of rewriting them, and only prunes broken links that point into `~/.agents`.

## [0.1.0] - 2026-04-08

### Added

- Pick a Claude Code account at launch, or add a new one.
- Each account runs with its own config dir (`~/.claude-<name>`) through `CLAUDE_CONFIG_DIR`, keeping credentials and settings isolated.

[Unreleased]: https://github.com/francescocretti/billy/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/francescocretti/billy/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/francescocretti/billy/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/francescocretti/billy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/francescocretti/billy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/francescocretti/billy/releases/tag/v0.1.0
