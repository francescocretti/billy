# SKILL — Billy

## What this project is

Billy is a Node.js CLI tool that manages multiple Claude Code accounts on the same machine. It solves the problem of developers who have more than one Claude account (e.g. work and personal) and need to switch between them or run them simultaneously in separate terminals.

## How it works

Claude Code reads its configuration and credentials from a directory that defaults to `~/.claude`. By setting the `CLAUDE_CONFIG_DIR` environment variable to a different path, each instance of Claude Code operates with a fully independent identity.

Billy wraps this mechanism with an interactive account selector. It stores a list of named account profiles in `~/.config/billy/accounts.json`. Each profile holds a name and a config directory path (e.g. `~/.claude-work`). When the user picks an account, Billy launches `claude` with `CLAUDE_CONFIG_DIR` set to that profile's path.

The first time an account is selected, Claude Code prompts for login. Credentials are persisted in the config directory, so subsequent launches skip authentication entirely.

## Key files

- `index.mjs` — entry point and all application logic
- `package.json` — declares the `billy` bin entry and the single dependency
- `~/.config/billy/accounts.json` — runtime data: the user's account list

## Tech stack

- **Runtime**: Node.js (ESM, v18+)
- **Interactive UI**: `@clack/prompts` — provides the account selector, text input, intro/outro, and cancel handling
- **Process management**: Node.js built-in `child_process.spawn` — launches `claude` with an overridden environment
- **Config persistence**: plain JSON file read/written with Node.js built-in `fs`
- **Installation**: `npm link` or `npm install -g .` — exposes `billy` as a global shell command

## Design decisions

- No external config format (YAML, TOML, etc.) — plain JSON is sufficient for a list of name/path pairs
- No sub-commands or flags — the tool does exactly one thing, launched with `billy` and nothing else
- `CLAUDE_CONFIG_DIR` is the only mechanism used — no patching of Claude Code internals
- Accounts are append-only through the CLI; removal is done by editing `accounts.json` directly

## What an LLM should know when working on this codebase

- The entire logic lives in `index.mjs` (~90 lines). There is no build step, no TypeScript, no bundler.
- `@clack/prompts` uses async iterators internally; all prompts must be awaited and checked with `isCancel()` before use.
- The `bail()` helper calls `cancel()` (which prints a styled message) then exits — it is the single exit path for user-facing errors.
- Adding features (e.g. rename account, delete account) means extending the `options` array in `main()` and adding the corresponding branch in the conditional after the select.
- The project has no tests. Changes should be verified by running `billy` directly in a terminal.
