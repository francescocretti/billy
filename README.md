# Billy

> Named after Billy Milligan — the man of many identities.

Billy is a minimal CLI tool for managing multiple [Claude Code](https://claude.ai/code) accounts. It lets you pick which account to use at launch, keeping each account's credentials and settings fully isolated.

## How it works

Each account gets its own configuration directory (`~/.claude-<name>`), passed to Claude Code via the `CLAUDE_CONFIG_DIR` environment variable. The first time you launch a new account, Claude Code will walk you through login. After that, credentials are persisted in that directory and login is never asked again. An account adopted from an existing `~/.claude` keeps that directory and its login, so it never asks.

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

Creates a symlink from the global npm bin to this project folder. Source changes take effect immediately without reinstalling. If you move or delete the project folder, the command breaks.

**Option B — `npm install -g .` (recommended for stable use)**

```bash
npm install -g .
```

Installs billy as a proper global package, independent of the project folder's location. After any future source change, re-run this command to update.

## Usage

```bash
billy
```

### First run

What you see depends on whether you already use Claude Code.

**If you already have a `~/.claude`** — the common case, since that setup is usually why you want a switcher — Billy finds it, shows what it found, and asks the one thing it cannot know:

```
◇  Existing Claude Code setup found ──────────────────╮
│                                                     │
│  Directory    /Users/you/.claude                    │
│  Logged in as you@example.com                       │
│  Projects     21                                    │
│                                                     │
├─────────────────────────────────────────────────────╯

◆ What should Billy call this account?
│ personal
└
```

Nothing is moved and nothing is lost: `~/.claude` stays where it is, keeps its history and credentials, and plain `claude` still reaches it. Billy just records it as an account so it shows up in the list. See [Migrating from the default Claude Code setup](#migrating-from-the-default-claude-code-setup) for the details.

**On a clean machine**, there is nothing to adopt and you only get the option to add an account:

```
◆ Which account do you want to use?
│ ○ + Add account
│ ○ ⚙ Settings
└
```

Enter a name (e.g. `work` or `personal`). Billy creates an isolated config directory for it and launches Claude Code. Complete the login flow once — Billy remembers it from then on.

### Every run after that

Your accounts appear in the list:

```
Billy — Claude Code Switch

◆ Which account do you want to use?
│ ● work        ~/.claude-work · shared
│ ○ personal    ~/.claude
│ ○ + Add account
│ ○ ⚙ Settings
└
```

Select one and Claude Code starts immediately, no login required.

## Settings

Everything that isn't "launch an account" lives behind **⚙ Settings**, so the main screen stays a list of accounts however many knobs Billy grows. Each entry shows its current state as a hint:

```
◆ Settings
│ ● Shared resources     on for 1 of 4 accounts
│ ○ Delete account       the profile and, if you want, its config dir
│ ○ Language             English
│ ○ Where everything lives
│ ○ ← Back
└
```

`← Back` and Escape do the same thing, and returning from settings drops you back on the account list with the updated state — so you can change something and launch in the same run.

**Where everything lives** answers the question a tool like this keeps raising, since it juggles directories across two config trees:

```
◇  Where everything lives ────────────────────────────────────────╮
│                                                                 │
│  Accounts             4                                         │
│  Account list         /Users/you/.config/billy/accounts.json    │
│  Billy settings       /Users/you/.config/billy/settings.json    │
│  Shared resources     /Users/you/.agents                        │
│  Shared plugins       warp                                      │
│  Shared MCP servers   none                                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────╯
```

### Deleting an account

**Delete account** asks two separate questions, because they are two separate decisions:

1. Remove the account from Billy's list — this only rewrites `accounts.json`.
2. Delete its config directory — this erases the account's credentials, history and settings.

The second defaults to **no**, so answering through with Enter leaves the directory untouched and you can re-add the account later without logging in again. Billy refuses to delete any directory outside your home, and warns you explicitly if the directory happens to be `~/.claude`, Claude Code's own default config dir.

### Language

Billy speaks English and Italian. Pick one from **Language**; the choice is saved in `~/.config/billy/settings.json` and applies from the next screen onwards.

The language is never guessed from your system locale, so Billy stays in the language you chose on every machine you carry your dotfiles to. English is the default until you pick otherwise.

Adding a language means adding one entry to `MESSAGES` and one to `LANGUAGES` in `i18n.mjs`. Any key you leave out falls back to English rather than showing a raw key.

## Shared resources (skills, commands, agents, CLAUDE.md)

Some Claude Code resources are things _you_ author and want identical across every identity — your skills, slash commands, subagents, and your global `CLAUDE.md`. Billy can keep these in sync via symlinks so you maintain a single source of truth instead of copying them into each account.

The source of truth is `~/.agents/`:

| Source | Linked into each account as |
|---|---|
| `~/.agents/skills/*` | `<config dir>/skills/*` |
| `~/.agents/commands/*` | `<config dir>/commands/*` |
| `~/.agents/agents/*` | `<config dir>/agents/*` |
| `~/.agents/CLAUDE.md` | `<config dir>/CLAUDE.md` |

**Turning it on.** Billy asks when you add an account, and stores the answer per account (`sharedResources` in `accounts.json`). To change it later — or to enable it on an account created before the option existed — go to **⚙ Settings → Shared resources**, pick the account, and answer the same question. Turning it *off* only stops future syncs: symlinks already in that config dir are left where they are.

**When it runs.** At every launch, for the account you are launching — not for all of them at once. Each account picks up a new skill the next time you open it.

**What it does.** Adds links for new resources, fixes outdated ones, and prunes broken links that point into the source, such as a skill you deleted from `~/.agents`. Broken links pointing anywhere else are yours, and are left alone. A source folder that doesn't exist is skipped silently — if you have no `~/.agents/commands`, nothing happens for commands. Real (non-symlink) files already in an account are never overwritten; they are reported as skipped.

The sync is best-effort: any error is reported and never blocks launching Claude Code. To relocate the source of truth, set the `BILLY_AGENTS_DIR` environment variable.

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

- A plugin the account **already installed itself** is skipped rather than injected. Loading both copies would register every hook twice — for Warp, that means duplicate notifications on every event. Installed-but-disabled counts as installed: the account disabled it on purpose.
- The injected plugin appears as `<name>@inline` instead of `<name>@<marketplace>`; check with `claude plugin list`.
- Link the marketplace checkout, not `plugins/cache/<marketplace>/<name>/<version>/` — the cache path changes on every version bump.
- The Warp plugin needs `jq` on your `PATH`.

## Running two accounts simultaneously

Open two terminal windows and run `billy` in each. Select a different account in each window — they run fully independently.

## Data

| Path | Contents |
|---|---|
| `~/.config/billy/accounts.json` | Account list (name, config dir path, shared-resources flag) |
| `~/.config/billy/settings.json` | Billy's own settings — currently just the UI language |
| `~/.agents/skills,commands,agents,CLAUDE.md` | Shared resources, symlinked into opted-in accounts |
| `~/.agents/mcp.json` | Shared MCP servers, passed with `--mcp-config` |
| `~/.agents/plugins/*` | Plugins loaded into every account via `--plugin-dir` |
| `~/.claude-<name>/` | Claude Code config, credentials, and settings for that account — `~/.claude` for an adopted one |

## Migrating from the default Claude Code setup

If you used Claude Code before installing Billy, your history, projects, settings and credentials live in `~/.claude`. The first time you run Billy with no accounts yet, it finds that setup, shows you what it found, and asks the one thing it cannot know — what to call it:

```
◇  Existing Claude Code setup found ──────────────────╮
│                                                     │
│  Directory    /Users/you/.claude                    │
│  Logged in as you@example.com                       │
│  Projects     21                                    │
│                                                     │
├─────────────────────────────────────────────────────╯

◆ What should Billy call this account?
│ personal
└
```

Then the usual account list takes over, now with that account in it.

There is nothing else to decide, because adopting the directory costs nothing and takes nothing away: `~/.claude` stays exactly where it is, and anything that runs `claude` without Billy — a script, an IDE extension, a `claude -p` in a pipeline — keeps reaching it. Billy simply records it as an account so it appears in the list alongside the ones you add later.

Cancelling the name prompt adopts nothing, and the offer comes back on the next launch since Billy still has no accounts.

If you would rather set this up by hand, add the account to `~/.config/billy/accounts.json` before the first launch, with `configDir` pointing wherever you want.
