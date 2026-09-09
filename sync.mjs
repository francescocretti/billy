// Keep an account's config dir in sync with the central, shared resources in
// ~/.agents/ via relative symlinks — so skills, commands, agents and your
// global CLAUDE.md stay identical across every Billy identity.
//
// Inspired by the standalone `sync-skills` script, but scoped to a single
// account, reimplemented in Node (no external dependency) and never fatal:
// any error is reported, never thrown, so it can't block launching Claude.

import {
  existsSync,
  lstatSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { homedir } from 'os';

export const AGENTS_DIR = resolve(process.env.BILLY_AGENTS_DIR || join(homedir(), '.agents'));

// Source of truth lives at ~/.agents/<name>.
//  - kind 'dir':  link every (non-dotfile) entry of the source dir into
//                 <config>/<name>/. Covers skills (subdirs), commands and
//                 agents (.md files) alike.
//  - kind 'file': link the single source file to <config>/<name>.
const RESOURCES = [
  { kind: 'dir', name: 'skills' },
  { kind: 'dir', name: 'commands' },
  { kind: 'dir', name: 'agents' },
  { kind: 'file', name: 'CLAUDE.md' },
];

// Where a symlink actually points, as an absolute path — regardless of
// whether it was written in relative or absolute form.
function linkTarget(linkPath) {
  return resolve(dirname(linkPath), readlinkSync(linkPath));
}

function pointsIntoAgentsDir(linkPath) {
  const target = linkTarget(linkPath);
  return target === AGENTS_DIR || target.startsWith(AGENTS_DIR + sep);
}

// Create or fix a relative symlink at `linkPath` pointing to `targetPath`.
// Real (non-symlink) files are never clobbered — we record them as skipped.
function applyLink(linkPath, targetPath, result) {
  let stat = null;
  try {
    stat = lstatSync(linkPath);
  } catch {
    // nothing there yet
  }

  if (stat) {
    if (!stat.isSymbolicLink()) {
      result.skipped.push(linkPath);
      return;
    }
    if (linkTarget(linkPath) === targetPath) return; // already correct
    unlinkSync(linkPath);
  }

  symlinkSync(relative(dirname(linkPath), targetPath), linkPath);
  result.added++;
}

// Remove a symlink whose target no longer exists (existsSync follows links).
// Only links pointing into AGENTS_DIR are ours to prune — a broken link the
// user created towards somewhere else is left alone.
function pruneIfBroken(linkPath, result) {
  let stat = null;
  try {
    stat = lstatSync(linkPath);
  } catch {
    return;
  }
  if (stat.isSymbolicLink() && !existsSync(linkPath) && pointsIntoAgentsDir(linkPath)) {
    unlinkSync(linkPath);
    result.pruned++;
  }
}

// Drop broken symlinks in `dir` (e.g. a central skill that was deleted).
function pruneDir(dir, result) {
  for (const entry of readdirSync(dir)) {
    pruneIfBroken(join(dir, entry), result);
  }
}

/**
 * Path of the shared MCP servers file — same `{ "mcpServers": { ... } }`
 * format as a project `.mcp.json` — or null if none exists. Unlike the
 * resources above it is not symlinked into accounts: `.claude.json` holds
 * per-account state, so the file is handed to Claude Code via --mcp-config
 * at launch instead.
 */
export function sharedMcpConfig() {
  const file = join(AGENTS_DIR, 'mcp.json');
  return existsSync(file) ? file : null;
}

/**
 * Sync all shared resources into `configDir`.
 * Returns { added, pruned, skipped: string[] }. Never throws.
 */
export function syncSharedResources(configDir) {
  const result = { added: 0, pruned: 0, skipped: [] };

  try {
    if (!existsSync(AGENTS_DIR)) return result;
    mkdirSync(configDir, { recursive: true });

    for (const res of RESOURCES) {
      const src = join(AGENTS_DIR, res.name);

      if (res.kind === 'file') {
        const link = join(configDir, res.name);
        if (existsSync(src)) applyLink(link, src, result);
        else pruneIfBroken(link, result); // source gone → drop a stale link
        continue;
      }

      // kind === 'dir'
      const dest = join(configDir, res.name);
      if (!existsSync(src)) {
        if (existsSync(dest)) pruneDir(dest, result);
        continue;
      }

      mkdirSync(dest, { recursive: true });
      for (const entry of readdirSync(src)) {
        if (entry.startsWith('.')) continue; // skip .DS_Store & friends
        // Guard against a source entry that vanished between readdir and stat.
        try {
          statSync(join(src, entry));
        } catch {
          continue;
        }
        applyLink(join(dest, entry), join(src, entry), result);
      }
      pruneDir(dest, result);
    }
  } catch (err) {
    result.error = err;
  }

  return result;
}

/**
 * Absolute paths of the plugins shared across accounts, one per directory in
 * ~/.agents/plugins/ (symlinks to a marketplace checkout are fine). They are
 * handed to Claude Code via --plugin-dir at launch rather than installed into
 * each account: session-only, so no plugin registry is duplicated per identity.
 * Never throws.
 */
export function sharedPlugins() {
  const dir = join(AGENTS_DIR, 'plugins');
  try {
    return readdirSync(dir)
      .filter(entry => !entry.startsWith('.'))
      .map(entry => {
        const path = join(dir, entry);
        const manifest = join(path, '.claude-plugin', 'plugin.json');
        if (!existsSync(manifest)) return null;
        // Claude Code identifies a plugin by its manifest name, not by the
        // directory it sits in — and that name is what we match against the
        // account's own installed plugins.
        let name = entry;
        try {
          name = JSON.parse(readFileSync(manifest, 'utf8')).name || entry;
        } catch {
          // unreadable manifest: fall back to the directory name
        }
        return { name, path };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Names of the plugins an account has installed in its own config dir.
 *
 * A plugin that is already installed must not also be injected with
 * --plugin-dir: Claude Code would load both copies and fire every hook twice.
 * Installed-but-disabled counts as installed — the account disabled it on
 * purpose, and injecting it would quietly override that decision.
 */
export function installedPluginNames(configDir) {
  try {
    const file = join(configDir, 'plugins', 'installed_plugins.json');
    const { plugins } = JSON.parse(readFileSync(file, 'utf8'));
    return new Set(Object.keys(plugins ?? {}).map(id => id.split('@')[0]));
  } catch {
    return new Set();
  }
}
