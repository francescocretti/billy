# Billy

> Named after Billy Milligan — the man of many identities.

Billy is a minimal CLI tool for managing multiple [Claude Code](https://claude.ai/code) accounts. It lets you pick which account to use at launch, keeping each account's credentials and settings fully isolated.

![Billy: picking an account, opening Settings, seeing where everything lives, and launching Claude Code](docs/media/billy.gif)

## How it works

Each account gets its own configuration directory (`~/.claude-<name>`), passed to Claude Code via the `CLAUDE_CONFIG_DIR` environment variable. The first time you launch a new account, Claude Code will walk you through login. After that, credentials are persisted in that directory and login is never asked again. An account adopted from an existing `~/.claude` keeps that directory and its login, so it never asks.

Account profiles are stored in `~/.billy/accounts.json`. Everything Billy writes and manages lives in `~/.billy/`; content you author — skills, commands, agents, `CLAUDE.md`, MCP servers — stays in `~/.agents/`, which Billy only reads. (Older versions used `~/.config/billy/`: Billy moves it over on first launch.) To keep Billy's folder elsewhere, set the `BILLY_DIR` environment variable — Billy then skips that migration.

## Requirements

- [Node.js](https://nodejs.org) v18+
- [Claude Code](https://claude.ai/code) installed and available as `claude` in your PATH
- `git`, to add and update [shared plugins](#shared-plugins-and-terminal-integration)

## Installation

```bash
npm install -g @francescocretti/billy
# or, with Yarn Classic (1.x)
yarn global add @francescocretti/billy
```

This installs the `billy` command. Update it later with the same command (`yarn global upgrade @francescocretti/billy` with Yarn); [CHANGELOG.md](CHANGELOG.md) says what changed.

Yarn 2 and later have no global installs: use npm there. With Yarn Classic, if your shell can't find `billy` afterwards, add the directory printed by `yarn global bin` to your `PATH`.

**From source**, to work on Billy itself:

```bash
git clone https://github.com/francescocretti/billy.git
cd billy
npm install
npm link
```

`npm link` points the global `billy` command at this folder, so source changes take effect immediately. If you move or delete the folder, the command breaks. Run `npm uninstall -g @francescocretti/billy` first if you had installed it from npm.

## Usage

```bash
billy
```

### First run

What you see depends on whether you already use Claude Code.

**If you already have a `~/.claude`** — the common case, since that setup is usually why you want a switcher — Billy finds it, shows what it found, and asks the one thing it cannot know:

![First run: Billy finds an existing ~/.claude, asks what to call it, and lists it as an account](docs/media/first-run.gif)

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
│ ○ Shared plugins       warp, sef
│ ○ Language             English
│ ○ Where everything lives
│ ○ ← Back
└
```

`← Back` and Escape do the same thing, and returning from settings drops you back on the account list with the updated state — so you can change something and launch in the same run.

**Where everything lives** answers the question a tool like this keeps raising, since it juggles directories across two config trees:

```
◇  Where everything lives ───────────────────────────╮
│                                                    │
│  Billy folder         ~/.billy                     │
│  Accounts             4                            │
│  Account list         ~/.billy/accounts.json       │
│  Billy settings       ~/.billy/settings.json       │
│  Shared resources     ~/.agents                    │
│  Shared plugins       sef, warp (~/.billy/plugins) │
│  Shared MCP servers   none                         │
│                                                    │
├────────────────────────────────────────────────────╯
```

### Deleting an account

**Delete account** asks two separate questions, because they are two separate decisions:

1. Remove the account from Billy's list — this only rewrites `accounts.json`.
2. Delete its config directory — this erases the account's credentials, history and settings.

The second defaults to **no**, so answering through with Enter leaves the directory untouched and you can re-add the account later without logging in again. Billy refuses to delete any directory outside your home, and warns you explicitly if the directory happens to be `~/.claude`, Claude Code's own default config dir.

### Language

Billy speaks English and Italian. Pick one from **Language**; the choice is saved in `~/.billy/settings.json` and applies from the next screen onwards.

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

## Shared plugins (and terminal integration)

Plugins are installed per config dir (`~/.claude/plugins/`), so a plugin installed on your main account is invisible to every other identity. That's what breaks terminal integrations: Warp, for instance, only recognises a session as Claude Code because the `warp` plugin emits OSC notifications from its hooks. Launch another account and the plugin isn't there, so the terminal sees a plain process and none of its special features light up.

Billy fixes this with shared plugins it manages itself. Go to **⚙ Settings → Shared plugins**:

![Sharing a plugin that one account installed on its own: Billy clones its repository, links it for every account, and removes the private copy](docs/media/plugins.gif)

**Adding** asks where the plugin comes from:

- **From one of your accounts** — lists the plugins your accounts installed on their own. Billy looks up the marketplace the plugin came from and clones *that* repository; it never links into an account's config dir, so uninstalling the plugin there can't take it away from the others.
- **From a git repository** — `owner/repo` for GitHub, or any git URL. If the repository is a marketplace offering several plugins, Billy asks which one.

The clone goes in `~/.billy/repos/`, and a link to the plugin's folder in `~/.billy/plugins/`. If some account also has the plugin installed on its own, Billy offers to uninstall it there (`claude plugin uninstall`, user scope only), so every account runs the same copy.

**Opening a plugin** offers **Update** (`git pull` in its clone — nothing updates on its own) and **Remove** (drops the link, and the clone once nothing else points into it).

At launch, every entry in `~/.billy/plugins/` with a `.claude-plugin/plugin.json` is loaded with Claude Code's `--plugin-dir` flag, for **every** account (unlike the resources above, this isn't gated on `sharedResources` — `--plugin-dir` is session-only and writes no state anywhere).

Notes:

- A plugin the account **already installed itself** is skipped rather than injected. Loading both copies would register every hook twice — for Warp, that means duplicate notifications on every event. Installed-but-disabled counts as installed: the account disabled it on purpose.
- The injected plugin appears as `<name>@inline` instead of `<name>@<marketplace>`; check with `claude plugin list`.
- Plugins in the old `~/.agents/plugins/` are no longer loaded; the Shared plugins screen points them out so you can add them again.
- The Warp plugin needs `jq` on your `PATH`.

## Running two accounts simultaneously

Open two terminal windows and run `billy` in each. Select a different account in each window — they run fully independently.

## Data

| Path | Contents |
|---|---|
| `~/.billy/accounts.json` | Account list (name, config dir path, shared-resources flag) |
| `~/.billy/settings.json` | Billy's own settings — currently just the UI language |
| `~/.billy/plugins/*` | Shared plugins, loaded into every account via `--plugin-dir` |
| `~/.billy/repos/*` | Git clones the shared plugins come from, managed by Billy |
| `~/.agents/skills,commands,agents,CLAUDE.md` | Shared resources, symlinked into opted-in accounts |
| `~/.agents/mcp.json` | Shared MCP servers, passed with `--mcp-config` |
| `~/.claude-<name>/` | Claude Code config, credentials, and settings for that account — `~/.claude` for an adopted one |

## Migrating from the default Claude Code setup

If you used Claude Code before installing Billy, your history, projects, settings and credentials live in `~/.claude`. The first time you run Billy with no accounts yet, it finds that setup, shows you what it found, and asks the one thing it cannot know — what to call it (see [First run](#first-run)).

Then the usual account list takes over, now with that account in it.

There is nothing else to decide, because adopting the directory costs nothing and takes nothing away: `~/.claude` stays exactly where it is, and anything that runs `claude` without Billy — a script, an IDE extension, a `claude -p` in a pipeline — keeps reaching it. Billy simply records it as an account so it appears in the list alongside the ones you add later.

Cancelling the name prompt adopts nothing, and the offer comes back on the next launch since Billy still has no accounts.

If you would rather set this up by hand, add the account to `~/.billy/accounts.json` before the first launch, with `configDir` pointing wherever you want.

## Regenerating the GIFs

The recordings in `docs/media/` are scripted with [VHS](https://github.com/charmbracelet/vhs): one `.tape` per GIF in `docs/demo/`. After changing a screen, re-record them with

```bash
brew install vhs
bash docs/demo/record.sh           # all of them
bash docs/demo/record.sh plugins   # just docs/demo/plugins.tape
```

The script runs Billy against a throwaway home with demo accounts and a stubbed `claude`, so your real setup never ends up in a recording — and is never touched. It clones the demo's shared plugins from GitHub, so it needs network access.

## Releasing

Billy follows [Semantic Versioning](https://semver.org/) and records every release in [CHANGELOG.md](CHANGELOG.md). Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:` means a minor bump, `fix:` a patch, and `BREAKING CHANGE:` a major.

1. While working, add each user-visible change under **Unreleased** in `CHANGELOG.md`.
2. To release, rename **Unreleased** to the new version with today's date, add an empty **Unreleased** above it, and update the comparison links at the bottom.
3. Bump the version and commit both files:

   ```bash
   npm version 1.2.0 --no-git-tag-version
   git commit -am "chore(release): 1.2.0"
   ```

4. Once that commit is on `main`, tag it, publish the release, and publish to npm from that same commit:

   ```bash
   git tag -a v1.2.0 -m "v1.2.0"
   git push origin v1.2.0
   gh release create v1.2.0 --title v1.2.0 --notes "<the version's section from CHANGELOG.md>"
   npm publish
   ```

   Check what will be published with `npm pack --dry-run` first: only the `.mjs` modules, README, changelog and license belong in the package.

