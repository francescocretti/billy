// Shared plugins: Billy's own copies, loaded into every account.
//
// A shared plugin is an entry in ~/.billy/plugins/ — normally a symlink into a
// git clone in ~/.billy/repos/ that Billy made, pulls and deletes. Nothing
// here depends on any account's config dir, so uninstalling a plugin from one
// account can no longer take it away from the others.
//
// At launch each entry is handed to Claude Code with --plugin-dir: session-only,
// no registry duplicated per identity. Every function here reports failure in
// its return value instead of throwing, so the menu can always carry on.

import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'fs';
import { basename, dirname, join, relative, resolve, sep } from 'path';
import { PLUGINS_DIR, REPOS_DIR, claudeEnv } from './paths.mjs';
import { AGENTS_DIR } from './sync.mjs';

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function manifest(pluginDir) {
  return readJson(join(pluginDir, '.claude-plugin', 'plugin.json'));
}

function git(args, cwd) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.error) return { ok: false, out: res.error.message };
  return { ok: res.status === 0, out: (res.stdout + res.stderr).trim() };
}

// The clone in REPOS_DIR an entry points into, or null for anything else (a
// plain directory, or a link you made yourself towards somewhere else).
function repoOf(entryPath) {
  let target;
  try {
    target = resolve(dirname(entryPath), readlinkSync(entryPath));
  } catch {
    return null;
  }
  if (!target.startsWith(REPOS_DIR + sep)) return null;
  return join(REPOS_DIR, relative(REPOS_DIR, target).split(sep)[0]);
}

/**
 * The shared plugins: every entry of ~/.billy/plugins/ holding a plugin
 * manifest. `name` is the manifest name — that's how Claude Code identifies a
 * plugin, and what we match against the account's own installed plugins.
 */
export function sharedPlugins() {
  let entries;
  try {
    entries = readdirSync(PLUGINS_DIR);
  } catch {
    return [];
  }
  return entries
    .filter(entry => !entry.startsWith('.'))
    .map(entry => {
      const path = join(PLUGINS_DIR, entry);
      const data = manifest(path);
      if (!data) return null;
      return { name: data.name || entry, version: data.version ?? null, path, repo: repoOf(path) };
    })
    .filter(Boolean);
}

/** Where a shared plugin's clone came from, for display. */
export function pluginOrigin(plugin) {
  if (!plugin.repo) return null;
  const { ok, out } = git(['remote', 'get-url', 'origin'], plugin.repo);
  if (!ok) return null;
  return out.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
}

/** Plugins left in the old location, which Billy no longer loads. */
export function legacyAgentsPlugins() {
  try {
    return readdirSync(join(AGENTS_DIR, 'plugins')).filter(entry => !entry.startsWith('.'));
  } catch {
    return [];
  }
}

/**
 * Plugins an account installed in its own config dir, as
 * [{ id, name, marketplace, scopes }] — `id` being `name@marketplace`.
 */
export function installedPlugins(configDir) {
  const data = readJson(join(configDir, 'plugins', 'installed_plugins.json'));
  return Object.entries(data?.plugins ?? {}).map(([id, installs]) => {
    const [name, marketplace] = id.split('@');
    const scopes = Array.isArray(installs) ? installs.map(i => i.scope) : [];
    return { id, name, marketplace, scopes };
  });
}

/**
 * Names of the plugins an account installed itself.
 *
 * A plugin that is already installed must not also be injected with
 * --plugin-dir: Claude Code would load both copies and fire every hook twice.
 * Installed-but-disabled counts as installed — the account disabled it on
 * purpose, and injecting it would quietly override that decision.
 */
export function installedPluginNames(configDir) {
  return new Set(installedPlugins(configDir).map(p => p.name));
}

// A git URL for a marketplace source as Claude Code records it, or null when
// the source isn't something Billy can clone.
function sourceUrl(source) {
  if (!source || typeof source !== 'object') return null;
  if (source.source === 'github' && source.repo) return `https://github.com/${source.repo}.git`;
  if ((source.source === 'git' || source.source === 'url') && source.url) return source.url;
  return null;
}

/** The git URL of the marketplace an account installed a plugin from. */
export function marketplaceUrl(configDir, marketplace) {
  const known = readJson(join(configDir, 'plugins', 'known_marketplaces.json'));
  return sourceUrl(known?.[marketplace]?.source);
}

/** `owner/repo` means GitHub; anything else is taken as a git URL as is. */
export function normalizeRepoInput(input) {
  const value = input.trim();
  return /^[\w.-]+\/[\w.-]+$/.test(value) ? `https://github.com/${value}.git` : value;
}

// A repo's identity for comparing URLs: host/owner/repo, with the scheme, the
// user, the port, a trailing .git and slashes dropped and the host lowercased,
// so https://github.com/o/r and git@github.com:o/r.git come out the same.
function repoKey(url) {
  let s = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const scp = s.match(/^[\w.-]+@([^:/]+):(.+)$/); // git@host:owner/repo
  if (scp) s = `${scp[1]}/${scp[2]}`;
  else s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^@/]+@/, '');
  const [host, ...rest] = s.split('/');
  return [host.toLowerCase().replace(/:\d+$/, ''), ...rest].join('/');
}

function originOf(dir) {
  const { ok, out } = git(['remote', 'get-url', 'origin'], dir);
  return ok ? out : null;
}

// owner__repo, from the last two segments of a URL or path.
function repoSlug(url) {
  const parts = url
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .filter(Boolean);
  return parts.slice(-2).join('__').replace(/[^\w.-]/g, '-');
}

/**
 * Clone `url` into REPOS_DIR, or reuse the clone of that same repo already
 * there. Returns { dir, fresh } or { error }.
 *
 * The folder is owner__repo. Two different repos can share that name — the
 * same owner/repo on another host, say — so a folder is reused only when its
 * origin is the repo asked for; otherwise the new clone gets a short hash of
 * the URL as a suffix. Existing clones keep their names.
 */
export function cloneRepo(url) {
  const slug = repoSlug(url);
  const key = repoKey(url);
  const candidates = [
    join(REPOS_DIR, slug),
    join(REPOS_DIR, `${slug}-${createHash('sha256').update(key).digest('hex').slice(0, 8)}`),
  ];
  let dir = null;
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      dir = candidate;
      break;
    }
    const origin = originOf(candidate);
    if (origin && repoKey(origin) === key) return { dir: candidate, fresh: false };
  }
  if (!dir) return { error: `${candidates[1]} already holds a different repository` };
  mkdirSync(REPOS_DIR, { recursive: true });
  const { ok, out } = git(['clone', '--quiet', url, dir]);
  if (!ok) {
    rmSync(dir, { recursive: true, force: true });
    return { error: out };
  }
  return { dir, fresh: true };
}

/**
 * The plugins a cloned repo offers, as [{ name, path }] or [{ name, url }]
 * for a marketplace entry that lives in a repo of its own (clone that one,
 * then call this again). A repo with no marketplace.json but a plugin.json at
 * its root is a single plugin.
 */
export function pluginsInRepo(repoDir) {
  const market = readJson(join(repoDir, '.claude-plugin', 'marketplace.json'));
  if (!market) {
    const data = manifest(repoDir);
    return data ? [{ name: data.name || repoSlug(repoDir), path: repoDir }] : [];
  }
  return (market.plugins ?? [])
    .map(p => {
      if (typeof p.source === 'string') {
        const path = resolve(repoDir, p.source);
        return path === repoDir || path.startsWith(repoDir + sep) ? { name: p.name, path } : null;
      }
      const url = sourceUrl(p.source);
      return url ? { name: p.name, url } : null;
    })
    .filter(p => p && p.name);
}

// What a plugin name may look like before it becomes a path. Claude Code's
// plugin names are kebab-case, so this refuses nothing real — only a name like
// ../../x that would put the link outside PLUGINS_DIR.
const PLUGIN_NAME = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Share the plugin at `path` with every account by linking it into
 * PLUGINS_DIR under its manifest name. Returns { name } or { error, name? },
 * error being 'manifest', 'badName' or 'exists'.
 */
export function linkPlugin(path) {
  const data = manifest(path);
  if (!data) return { error: 'manifest' };
  // The name comes from someone else's repo: check it before using it as a path.
  const name = typeof data.name === 'string' && data.name ? data.name : basename(path);
  const link = join(PLUGINS_DIR, name);
  if (!PLUGIN_NAME.test(name) || dirname(link) !== PLUGINS_DIR) return { error: 'badName', name };
  let taken = false;
  try {
    lstatSync(link);
    taken = true;
  } catch {
    // free
  }
  if (taken) return { error: 'exists', name };
  mkdirSync(PLUGINS_DIR, { recursive: true });
  symlinkSync(relative(PLUGINS_DIR, path), link);
  return { name };
}

/**
 * Pull the latest commits into a shared plugin's clone.
 * Returns { changed } or { error }.
 */
export function updatePlugin(plugin) {
  if (!plugin.repo) return { error: 'notManaged' };
  const before = git(['rev-parse', 'HEAD'], plugin.repo).out;
  const { ok, out } = git(['pull', '--ff-only', '--quiet'], plugin.repo);
  if (!ok) return { error: out };
  return { changed: git(['rev-parse', 'HEAD'], plugin.repo).out !== before };
}

/**
 * Stop sharing a plugin: remove its entry, and its clone too once no other
 * shared plugin points into it (a marketplace repo can hold several).
 * Returns {} or { error } — 'notLink' for a real directory, left alone.
 */
export function removePlugin(plugin) {
  try {
    // Only ever unlink: a real directory dropped in here by hand is yours.
    if (!lstatSync(plugin.path).isSymbolicLink()) return { error: 'notLink' };
    unlinkSync(plugin.path);
    if (plugin.repo && !sharedPlugins().some(p => p.repo === plugin.repo)) {
      rmSync(plugin.repo, { recursive: true, force: true });
    }
    return {};
  } catch (err) {
    return { error: err.message };
  }
}

/** Remove a clone nothing links to — after an add that went nowhere. */
export function dropUnusedRepo(dir) {
  if (!sharedPlugins().some(p => p.repo === dir)) rmSync(dir, { recursive: true, force: true });
}

/**
 * Uninstall a plugin from one account's own config dir, so that account uses
 * the shared copy instead. Returns { ok, out }.
 */
export function uninstallFromAccount(configDir, id) {
  const res = spawnSync('claude', ['plugin', 'uninstall', id], {
    env: claudeEnv(configDir),
    encoding: 'utf8',
  });
  if (res.error) return { ok: false, out: res.error.message };
  return { ok: res.status === 0, out: (res.stdout + res.stderr).trim() };
}
