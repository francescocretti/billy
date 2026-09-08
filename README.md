# Billy

> Named after Billy Milligan — the man of many identities.

Billy is a minimal CLI tool for managing multiple [Claude Code](https://claude.ai/code) accounts. It lets you pick which account to use at launch, keeping each account's credentials and settings fully isolated.

## How it works

Each account gets its own configuration directory (`~/.claude-<name>`), passed to Claude Code via the `CLAUDE_CONFIG_DIR` environment variable. The first time you launch an account, Claude Code will walk you through login. After that, credentials are persisted in that directory and login is never asked again.

Account profiles are stored in `~/.config/billy/accounts.json`.

## Requirements

- [Node.js](https://nodejs.org) v18+
- [Claude Code](https://claude.ai/code) installed and available as `claude` in your PATH

## Installation

```bash
git clone https://github.com/francescocretti/billy.git
cd billy
npm install
```

Then choose how to install the `billy` command globally:

**Option A — `npm link` (recommended while developing)**

```bash
npm link
```

Creates a symlink from the global npm bin to this project folder. Changes to `index.mjs` take effect immediately without reinstalling. If you move or delete the project folder, the command breaks.

**Option B — `npm install -g .` (recommended for stable use)**

```bash
npm install -g .
```

Installs billy as a proper global package, independent of the project folder's location. After any future changes to `index.mjs`, re-run this command to update.

## Usage

```bash
billy
```

On first run, you'll only see the option to add a new account:

```
Billy — Claude Code Switch

◆ Which account do you want to use?
│ ○ + Add account
└
```

Enter a name (e.g. `work` or `personal`). Billy will create an isolated config directory for it and launch Claude Code. Complete the login flow once — Billy will remember it from then on.

On subsequent runs, your saved accounts appear in the list:

```
Billy — Claude Code Switch

◆ Which account do you want to use?
│ ● work        ~/.claude-work
│ ○ personal    ~/.claude-personal
│ ○ + Add account
└
```

Select one and Claude Code starts immediately, no login required.

## Shared resources (skills, commands, agents, CLAUDE.md)

Some Claude Code resources are things _you_ author and want identical across every identity — your skills, slash commands, subagents, and your global `CLAUDE.md`. Billy can keep these in sync via symlinks so you maintain a single source of truth instead of copying them into each account.

The source of truth is `~/.agents/`:

| Source | Linked into each account as |
|---|---|
| `~/.agents/skills/*` | `~/.claude-<name>/skills/*` |
| `~/.agents/commands/*` | `~/.claude-<name>/commands/*` |
| `~/.agents/agents/*` | `~/.claude-<name>/agents/*` |
| `~/.agents/CLAUDE.md` | `~/.claude-<name>/CLAUDE.md` |

When you **add a new account**, Billy asks whether to import these as symlinks. Your choice is stored per account (`sharedResources` in `accounts.json`). To change it later — or to enable it on an account created before this option existed — pick **⚙ Risorse condivise** from the main menu, choose the account, and answer the same question. Turning it *off* only stops future syncs: symlinks already in that config dir are left where they are. For every account that opted in, Billy **re-syncs at each launch**: it adds links for new resources, fixes outdated ones, and prunes broken links that point into the source (e.g. a skill you removed from `~/.agents`) — broken links you created towards anywhere else are left alone. Any source folder that doesn't exist is simply skipped, and real (non-symlink) files already present in an account are never overwritten. The sync is best-effort — it never blocks launching Claude Code.

To enable it for an existing account, set `"sharedResources": true` on its entry in `accounts.json`. To relocate the source of truth, set the `BILLY_AGENTS_DIR` environment variable.

### Shared MCP servers

MCP servers can't be shared by symlinking: user-scoped servers live inside each account's `.claude.json`, which also holds per-account state (login, org, per-project toggles). Instead, Billy uses Claude Code's `--mcp-config` flag.

Put your shared servers in `~/.agents/mcp.json`, using the same format as a project `.mcp.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "some-mcp-server"]
    }
  }
}
```

For every account with `sharedResources` enabled, Billy launches Claude Code with `--mcp-config ~/.agents/mcp.json`. These servers are loaded **in addition to** any servers the account configured on its own. Notes:

- The shared servers only apply when launching through `billy` — running `claude` directly won't load them.
- OAuth-authenticated remote servers still require logging in once per account: tokens are stored per config dir and can't be shared.
- Project-scoped servers (`.mcp.json` in a repo) already work across accounts with no help from Billy.

### Shared plugins (and terminal integration)

Plugins are installed per config dir (`~/.claude/plugins/`), so a plugin installed on your main account is invisible to every other identity. That's what breaks terminal integrations: Warp, for instance, only recognises a session as Claude Code because the `warp` plugin emits OSC notifications from its hooks. Launch another account and the plugin isn't there, so the terminal sees a plain process and none of its special features light up.

Billy fixes this with Claude Code's `--plugin-dir` flag: every directory in `~/.agents/plugins/` that contains a `.claude-plugin/plugin.json` is loaded at launch, for **every** account (unlike the resources above, this isn't gated on `sharedResources` — `--plugin-dir` is session-only and writes no state anywhere).

Symlinks are fine, so you can point at a marketplace checkout and keep getting updates:

```bash
mkdir -p ~/.agents/plugins
ln -s ~/.claude/plugins/marketplaces/claude-code-warp/plugins/warp ~/.agents/plugins/warp
```

Notes:

- The plugin appears as `<name>@inline` instead of `<name>@<marketplace>`; check with `claude plugin list`.
- Link the marketplace checkout, not `plugins/cache/<marketplace>/<name>/<version>/` — the cache path changes on every version bump.
- The Warp plugin needs `jq` on your `PATH`.

## Running two accounts simultaneously

Open two terminal windows and run `billy` in each. Select a different account in each window — they run fully independently.

## Data

| Path | Contents |
|---|---|
| `~/.config/billy/accounts.json` | Account list (name, config dir path, shared-resources flag) |
| `~/.agents/plugins/*` | Plugins loaded into every account via `--plugin-dir` |
| `~/.claude-<name>/` | Claude Code config, credentials, and settings for that account |

To remove an account, delete its entry from `accounts.json` and optionally remove its config directory.

## Migrating from the default Claude Code setup

If you were already using Claude Code before installing Billy, your existing configuration, memory, settings, and credentials live in `~/.claude`. Creating a new account in Billy would start from scratch and lose access to all of that.

To avoid this, manually add your existing directory to `~/.config/billy/accounts.json` before running Billy for the first time:

```json
[
  {
    "id": "personal",
    "name": "personal",
    "configDir": "/Users/your-username/.claude"
  }
]
```

This account will inherit everything from your previous Claude Code setup. Any additional accounts added through Billy will get their own fresh directory.
