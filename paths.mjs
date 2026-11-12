// Where Billy keeps its own things.
//
// ~/.billy holds everything Billy writes and manages: the account list, its
// settings, and the shared plugins it clones and links. Content you author and
// other tools may read too — skills, commands, agents, CLAUDE.md, mcp.json —
// stays in ~/.agents, which Billy only ever reads.

import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

export const BILLY_DIR = resolve(process.env.BILLY_DIR || join(homedir(), '.billy'));
export const ACCOUNTS_FILE = join(BILLY_DIR, 'accounts.json');
export const SETTINGS_FILE = join(BILLY_DIR, 'settings.json');
// One entry per shared plugin, loaded into every account with --plugin-dir.
export const PLUGINS_DIR = join(BILLY_DIR, 'plugins');
// The git clones those entries point into: Billy clones, pulls and deletes them.
export const REPOS_DIR = join(BILLY_DIR, 'repos');

const LEGACY_CONFIG_DIR = join(homedir(), '.config', 'billy');

// Billy used to keep accounts.json and settings.json in ~/.config/billy. Move
// them over once, file by file, never overwriting anything already in
// ~/.billy, and drop the old directory only if that left it empty. Never
// throws: at worst the old files stay put and Billy starts with defaults.
function migrateLegacyConfig() {
  if (process.env.BILLY_DIR || !existsSync(LEGACY_CONFIG_DIR)) return;
  try {
    mkdirSync(BILLY_DIR, { recursive: true });
    for (const entry of readdirSync(LEGACY_CONFIG_DIR)) {
      const target = join(BILLY_DIR, entry);
      if (!existsSync(target)) renameSync(join(LEGACY_CONFIG_DIR, entry), target);
    }
    if (!readdirSync(LEGACY_CONFIG_DIR).length) rmdirSync(LEGACY_CONFIG_DIR);
  } catch {
    // leave whatever could not be moved where it is
  }
}

// Runs on import, before i18n reads settings.json or the menu reads accounts.
migrateLegacyConfig();

// Claude Code's own default config dir, where a plain `claude` keeps things.
export const CLAUDE_DEFAULT_DIR = join(homedir(), '.claude');

/**
 * The environment to run `claude` with for the account at `configDir`.
 *
 * The default config dir is reached exactly like a plain `claude` — with
 * CLAUDE_CONFIG_DIR unset. Setting it to ~/.claude, even though that is the
 * same directory, makes Claude Code look for its account file inside it
 * instead of at ~/.claude.json: a fresh state, out of step with
 * every IDE extension and script that runs `claude` on this machine.
 */
export function claudeEnv(configDir) {
  const env = { ...process.env };
  if (resolve(configDir) === CLAUDE_DEFAULT_DIR) delete env.CLAUDE_CONFIG_DIR;
  else env.CLAUDE_CONFIG_DIR = configDir;
  return env;
}
