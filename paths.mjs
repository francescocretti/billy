// Where Billy keeps its own things.
//
// ~/.billy holds everything Billy writes and manages: the account list and its
// settings. Content you author and other tools may read too — skills,
// commands, agents, CLAUDE.md, mcp.json — stays in ~/.agents, which Billy only
// ever reads.

import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

export const BILLY_DIR = resolve(process.env.BILLY_DIR || join(homedir(), '.billy'));
export const ACCOUNTS_FILE = join(BILLY_DIR, 'accounts.json');
export const SETTINGS_FILE = join(BILLY_DIR, 'settings.json');

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
