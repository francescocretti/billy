#!/usr/bin/env node
import {
  intro,
  outro,
  note,
  select,
  text,
  confirm,
  log,
  spinner,
  isCancel,
  cancel,
} from '@clack/prompts';
import { spawn } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join, sep } from 'path';
import { homedir } from 'os';
import {
  ACCOUNTS_FILE,
  BILLY_DIR,
  CLAUDE_DEFAULT_DIR,
  PLUGINS_DIR,
  claudeEnv,
} from './paths.mjs';
import { AGENTS_DIR, syncSharedResources, sharedMcpConfig } from './sync.mjs';
import {
  cloneRepo,
  dropUnusedRepo,
  installedPluginNames,
  installedPlugins,
  legacyAgentsPlugins,
  linkPlugin,
  marketplaceUrl,
  normalizeRepoInput,
  pluginOrigin,
  pluginsInRepo,
  removePlugin,
  sharedPlugins,
  uninstallFromAccount,
  updatePlugin,
} from './plugins.mjs';
import { LANGUAGES, SETTINGS_FILE, getLanguage, setLanguage, t } from './i18n.mjs';

// A file that exists but can't be read as a list of accounts stops Billy
// instead of reading as "no accounts". Carrying on with an empty list would
// let the next save — adopting ~/.claude, adding an account — overwrite the
// file, and every account in it would be lost over a stray comma. Billy writes
// nothing until the file is fixed by hand.
function loadAccounts() {
  if (!existsSync(ACCOUNTS_FILE)) return [];
  let accounts;
  try {
    accounts = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch (err) {
    malformedAccounts(err.message.replace(/\s+/g, ' ').trim());
  }
  if (!Array.isArray(accounts)) malformedAccounts(t('accounts.notList'));
  return accounts;
}

function malformedAccounts(message) {
  cancel(t('accounts.malformed', { file: tilde(ACCOUNTS_FILE), message }));
  process.exit(1);
}

function saveAccounts(accounts) {
  mkdirSync(BILLY_DIR, { recursive: true });
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

// A path for display, with the home directory shortened to ~.
function tilde(path) {
  const home = homedir();
  if (path === home) return '~';
  return path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path;
}

function bail(message) {
  cancel(message ?? t('cancelled'));
  process.exit(0);
}

// Label/value rows for a note() panel, padded into two columns.
function alignedRows(rows) {
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`).join('\n');
}

// The shared-resources question only means something when there is a ~/.agents
// to share from. Asking about a directory that doesn't exist is noise on the
// very first run, which is exactly when it would be asked.
async function askSharedResources() {
  if (!existsSync(AGENTS_DIR)) return false;
  const share = await confirm({ message: t('shared.prompt'), initialValue: true });
  return isCancel(share) ? null : share;
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function createAccount(accounts) {
  const name = await text({
    message: t('new.name'),
    validate: v => (!v.trim() ? t('new.nameEmpty') : undefined),
  });
  if (isCancel(name)) bail();

  const id = slugify(name);

  if (accounts.find(a => a.id === id)) {
    bail(t('new.exists', { name: name.trim() }));
  }

  const share = await askSharedResources();
  if (share === null) bail();

  const account = {
    id,
    name: name.trim(),
    configDir: join(homedir(), `.claude-${id}`),
    sharedResources: share,
  };

  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

// Flip the shared-resources flag on an account that already exists. Without
// this the choice is only ever offered while creating an account, so there is
// no way to change your mind later — and accounts created before the flag
// existed are stuck without it. Cancelling anywhere leaves everything as is.
async function editSharedResources(accounts) {
  const selected = await select({
    message: t('shared.which'),
    options: accounts.map(a => ({
      value: a.id,
      label: a.name,
      hint: a.sharedResources ? t('shared.on') : t('shared.off'),
    })),
  });
  if (isCancel(selected)) return;

  const account = accounts.find(a => a.id === selected);
  const share = await confirm({
    message: t('shared.promptFor', { name: account.name }),
    initialValue: account.sharedResources === true,
  });
  if (isCancel(share) || share === Boolean(account.sharedResources)) return;

  account.sharedResources = share;
  saveAccounts(accounts);

  if (share) {
    log.success(t('shared.enabled', { name: account.name }));
  } else {
    // Turning it off only stops future syncs — links already in the config dir
    // are left alone, so say so instead of implying a cleanup happened.
    log.success(t('shared.disabled', { name: account.name, dir: tilde(account.configDir) }));
  }
}

// Removing the account profile and erasing its config dir are two separate
// decisions: the profile is just a line in accounts.json, the directory holds
// credentials, history and settings. The second is asked on its own, defaults
// to "no", and is refused outright for anything outside your home directory.
async function deleteAccount(accounts) {
  const selected = await select({
    message: t('delete.which'),
    options: accounts.map(a => ({ value: a.id, label: a.name, hint: tilde(a.configDir) })),
  });
  if (isCancel(selected)) return;

  const index = accounts.findIndex(a => a.id === selected);
  const account = accounts[index];

  const sure = await confirm({
    message: t('delete.confirm', { name: account.name }),
    initialValue: false,
  });
  if (isCancel(sure) || !sure) return;

  const dir = account.configDir;
  const insideHome = dir.startsWith(homedir() + sep);
  let dirExists = false;
  try {
    dirExists = statSync(dir).isDirectory();
  } catch {
    // nothing there — only the profile is left to remove
  }

  let removeDir = false;
  if (dirExists) {
    if (!insideHome) {
      log.warn(t('delete.dirOutsideHome', { dir }));
    } else {
      if (dir === CLAUDE_DEFAULT_DIR) log.warn(t('delete.dirIsDefault', { dir }));
      const answer = await confirm({ message: t('delete.dir', { dir }), initialValue: false });
      if (isCancel(answer)) return;
      removeDir = answer;
    }
  }

  accounts.splice(index, 1);
  saveAccounts(accounts);

  if (!removeDir) {
    log.success(t('delete.done', { name: account.name, dir }));
    return;
  }

  try {
    rmSync(dir, { recursive: true, force: true });
    log.success(t('delete.doneWithDir', { name: account.name, dir }));
  } catch (err) {
    log.warn(t('delete.dirError', { dir, message: err.message }));
  }
}

async function chooseLanguage() {
  const selected = await select({
    message: t('language.which'),
    options: LANGUAGES,
    initialValue: getLanguage(),
  });
  if (isCancel(selected) || selected === getLanguage()) return;

  setLanguage(selected);
  log.success(t('language.saved', { label: LANGUAGES.find(l => l.value === selected).label }));
}

// Where the default setup keeps its account file. Without CLAUDE_CONFIG_DIR,
// Claude Code writes it next to ~/.claude, as ~/.claude.json in your home —
// only a custom config dir gets one inside. The second path covers a setup
// that was once run with CLAUDE_CONFIG_DIR=~/.claude.
function defaultConfigFile() {
  return [join(homedir(), '.claude.json'), join(CLAUDE_DEFAULT_DIR, '.claude.json')].find(f =>
    existsSync(f),
  );
}

// A summary of the default Claude Code setup, or null when there is none.
// `.claude.json` is the marker: the ~/.claude directory alone gets created by
// all sorts of things, an account file means Claude Code has been used.
function describeDefaultSetup() {
  const configFile = defaultConfigFile();
  if (!configFile) return null;

  let email = null;
  try {
    email = JSON.parse(readFileSync(configFile, 'utf8'))?.oauthAccount?.emailAddress ?? null;
  } catch {
    // unreadable or not JSON: the directory still counts, we just say less
  }

  let projects = 0;
  try {
    projects = readdirSync(join(CLAUDE_DEFAULT_DIR, 'projects')).length;
  } catch {
    // no projects yet
  }

  return { email, projects };
}

// Offered once, when Billy has no accounts yet and ~/.claude holds a real
// setup. There is nothing to decide here: adopting costs nothing and takes
// nothing away — ~/.claude stays where it is, and plain `claude` still reaches
// it — so Billy only asks the one thing it cannot know, the account's name.
// Afterwards the normal account list takes over.
async function adoptExistingSetup(accounts) {
  const found = describeDefaultSetup();
  if (!found) return;

  const rows = [[t('adopt.dir'), tilde(CLAUDE_DEFAULT_DIR)]];
  if (found.email) rows.push([t('adopt.account'), found.email]);
  rows.push([t('adopt.projects'), String(found.projects)]);
  note(alignedRows(rows), t('adopt.title'));

  const name = await text({
    message: t('adopt.name'),
    initialValue: 'personal',
    validate: v => (!v.trim() ? t('new.nameEmpty') : undefined),
  });
  // Cancelling adopts nothing and leaves the list empty; the offer comes back
  // on the next launch, since Billy still has no accounts.
  if (isCancel(name)) return;

  const share = await askSharedResources();
  if (share === null) return;

  accounts.push({
    id: slugify(name),
    name: name.trim(),
    configDir: CLAUDE_DEFAULT_DIR,
    sharedResources: share,
  });
  saveAccounts(accounts);

  log.success(t('adopt.adopted', { name: name.trim(), dir: tilde(CLAUDE_DEFAULT_DIR) }));
}

// Billy juggles half a dozen directories across two config trees, so the one
// screen that answers "where is all of this, actually?" earns its place.
function showInfo(accounts) {
  const plugins = sharedPlugins();
  const mcpConfig = sharedMcpConfig();

  const rows = [
    [t('info.billyDir'), tilde(BILLY_DIR)],
    [t('info.accounts'), String(accounts.length)],
    [t('info.accountsFile'), tilde(ACCOUNTS_FILE)],
    [t('info.settingsFile'), tilde(SETTINGS_FILE)],
    [
      t('info.agentsDir'),
      existsSync(AGENTS_DIR) ? tilde(AGENTS_DIR) : `${tilde(AGENTS_DIR)} (${t('info.missing')})`,
    ],
    [
      t('info.plugins'),
      plugins.length ? `${plugins.map(p => p.name).join(', ')} (${tilde(PLUGINS_DIR)})` : t('info.none'),
    ],
    [t('info.mcp'), mcpConfig ? tilde(mcpConfig) : t('info.none')],
  ];

  note(alignedRows(rows), t('settings.info'));
}

// Run `work` behind a spinner: cloning and pulling take long enough that a
// silent pause reads as a hang.
function withSpinner(message, work) {
  const s = spinner();
  s.start(message);
  const result = work();
  s.stop(message);
  return result;
}

// Once a plugin is shared, an account that also installed it on its own would
// keep its private copy (Billy never injects a plugin twice). Offer to drop
// those copies so every account runs the same, shared one. Only user-scope
// installs are offered: a project-scope install belongs to that project.
async function offerAccountCleanup(accounts, name) {
  for (const account of accounts) {
    const own = installedPlugins(account.configDir).find(
      p => p.name === name && p.scopes.includes('user'),
    );
    if (!own) continue;

    const answer = await confirm({
      message: t('plugins.uninstallOwn', { account: account.name, plugin: name }),
      initialValue: true,
    });
    if (isCancel(answer) || !answer) continue;

    const { ok, out } = withSpinner(t('plugins.uninstalling', { account: account.name }), () =>
      uninstallFromAccount(account.configDir, own.id),
    );
    if (ok) log.success(t('plugins.uninstalled', { account: account.name, plugin: name }));
    else log.warn(t('plugins.uninstallError', { account: account.name, message: out }));
  }
}

// Clone a repo and share one of its plugins. `wanted` picks the plugin by name
// (adding from an account); without it, a repo offering several plugins asks.
async function sharePluginFromRepo(accounts, url, wanted) {
  const cloned = withSpinner(t('plugins.cloning', { url }), () => cloneRepo(url));
  if (cloned.error) {
    log.error(t('plugins.cloneError', { message: cloned.error }));
    return;
  }

  const shared = new Set(sharedPlugins().map(p => p.name));
  let candidates = pluginsInRepo(cloned.dir);
  if (wanted) candidates = candidates.filter(p => p.name === wanted);
  candidates = candidates.filter(p => !shared.has(p.name));

  let chosen = candidates[0];
  if (!candidates.length) {
    log.error(t(wanted ? 'plugins.notInRepo' : 'plugins.noneInRepo', { plugin: wanted, url }));
  } else if (candidates.length > 1) {
    const pick = await select({
      message: t('plugins.whichInRepo'),
      options: candidates.map(p => ({ value: p.name, label: p.name })),
    });
    chosen = isCancel(pick) ? null : candidates.find(p => p.name === pick);
  }

  if (!chosen) {
    if (cloned.fresh) dropUnusedRepo(cloned.dir);
    return;
  }

  // A marketplace entry that lives in a repo of its own: clone that one too.
  if (chosen.url) {
    if (cloned.fresh) dropUnusedRepo(cloned.dir);
    return sharePluginFromRepo(accounts, chosen.url, chosen.name);
  }

  const linked = linkPlugin(chosen.path);
  if (linked.error) {
    if (cloned.fresh) dropUnusedRepo(cloned.dir);
    log.error(t(linked.error === 'exists' ? 'plugins.exists' : 'plugins.noManifest', linked));
    return;
  }

  log.success(t('plugins.added', { plugin: linked.name }));
  await offerAccountCleanup(accounts, linked.name);
}

async function addSharedPlugin(accounts) {
  // Plugins some account installed on its own and that aren't shared yet,
  // one row per plugin id with the accounts that have it.
  const shared = new Set(sharedPlugins().map(p => p.name));
  const fromAccounts = new Map();
  for (const account of accounts) {
    for (const plugin of installedPlugins(account.configDir)) {
      if (shared.has(plugin.name)) continue;
      const row = fromAccounts.get(plugin.id) ?? { ...plugin, accounts: [] };
      row.accounts.push(account);
      fromAccounts.set(plugin.id, row);
    }
  }

  let source = 'repo';
  if (fromAccounts.size) {
    source = await select({
      message: t('plugins.addFrom'),
      options: [
        { value: 'account', label: t('plugins.fromAccount'), hint: t('plugins.fromAccountHint') },
        { value: 'repo', label: t('plugins.fromRepo'), hint: t('plugins.fromRepoHint') },
      ],
    });
    if (isCancel(source)) return;
  }

  if (source === 'account') {
    const id = await select({
      message: t('plugins.whichInstalled'),
      options: [...fromAccounts.values()].map(p => ({
        value: p.id,
        label: p.name,
        hint: `${p.marketplace} · ${p.accounts.map(a => a.name).join(', ')}`,
      })),
    });
    if (isCancel(id)) return;

    const plugin = fromAccounts.get(id);
    const url = plugin.accounts.map(a => marketplaceUrl(a.configDir, plugin.marketplace)).find(Boolean);
    if (!url) {
      log.error(t('plugins.noSource', { marketplace: plugin.marketplace }));
      return;
    }
    return sharePluginFromRepo(accounts, url, plugin.name);
  }

  const input = await text({
    message: t('plugins.repoPrompt'),
    placeholder: 'owner/repo',
    validate: v => (!v.trim() ? t('plugins.repoEmpty') : undefined),
  });
  if (isCancel(input)) return;
  return sharePluginFromRepo(accounts, normalizeRepoInput(input), null);
}

async function sharedPluginActions(plugin) {
  const action = await select({
    message: plugin.name,
    options: [
      ...(plugin.repo ? [{ value: 'update', label: t('plugins.update'), hint: t('plugins.updateHint') }] : []),
      { value: 'remove', label: t('plugins.remove'), hint: t('plugins.removeHint') },
      { value: 'back', label: t('settings.back') },
    ],
  });
  if (isCancel(action) || action === 'back') return;

  if (action === 'update') {
    const res = withSpinner(t('plugins.updating', { plugin: plugin.name }), () => updatePlugin(plugin));
    if (res.error) log.error(t('plugins.updateError', { message: res.error }));
    else log.success(t(res.changed ? 'plugins.updated' : 'plugins.upToDate', { plugin: plugin.name }));
    return;
  }

  const sure = await confirm({
    message: t('plugins.removeConfirm', { plugin: plugin.name }),
    initialValue: false,
  });
  if (isCancel(sure) || !sure) return;
  const res = removePlugin(plugin);
  if (res.error === 'notLink') log.warn(t('plugins.removeNotLink', { path: plugin.path }));
  else if (res.error) log.error(t('plugins.removeError', { message: res.error }));
  else log.success(t('plugins.removed', { plugin: plugin.name }));
}

// Plugins Billy loads into every account. Listing, adding, updating and
// removing all happen here, so nobody has to hand-craft symlinks.
async function pluginsMenu(accounts) {
  const legacy = legacyAgentsPlugins();
  if (legacy.length) {
    log.warn(t('plugins.legacy', { dir: tilde(join(AGENTS_DIR, 'plugins')), list: legacy.join(', ') }));
  }

  for (;;) {
    const plugins = sharedPlugins();
    const choice = await select({
      message: t('plugins.title'),
      options: [
        ...plugins.map(p => ({
          value: p.path,
          label: p.name,
          hint: [p.version && `v${p.version}`, pluginOrigin(p) ?? tilde(p.path)].filter(Boolean).join(' · '),
        })),
        { value: '__add__', label: t('plugins.add') },
        { value: '__back__', label: t('settings.back') },
      ],
    });
    if (isCancel(choice) || choice === '__back__') return;

    if (choice === '__add__') await addSharedPlugin(accounts);
    else await sharedPluginActions(plugins.find(p => p.path === choice));
  }
}

// Everything that isn't "launch an account" lives behind one entry, so the
// main screen stays a list of accounts however many knobs Billy grows.
async function settingsMenu(accounts) {
  for (;;) {
    const options = [];

    if (accounts.length) {
      options.push({
        value: 'shared',
        label: t('settings.shared'),
        hint: t('settings.sharedHint', {
          on: accounts.filter(a => a.sharedResources).length,
          total: accounts.length,
        }),
      });
      options.push({
        value: 'delete',
        label: t('settings.delete'),
        hint: t('settings.deleteHint'),
      });
    }

    const plugins = sharedPlugins();
    options.push({
      value: 'plugins',
      label: t('settings.plugins'),
      hint: plugins.length ? plugins.map(p => p.name).join(', ') : t('info.none'),
    });
    options.push({
      value: 'language',
      label: t('settings.language'),
      hint: LANGUAGES.find(l => l.value === getLanguage())?.label,
    });
    options.push({ value: 'info', label: t('settings.info') });
    options.push({ value: 'back', label: t('settings.back') });

    const choice = await select({ message: t('settings.title'), options });
    // Escape and ← Back are the same thing: return to the account list.
    if (isCancel(choice) || choice === 'back') return;

    if (choice === 'shared') await editSharedResources(accounts);
    else if (choice === 'delete') await deleteAccount(accounts);
    else if (choice === 'plugins') await pluginsMenu(accounts);
    else if (choice === 'language') await chooseLanguage();
    else if (choice === 'info') showInfo(accounts);
  }
}

async function pickAccount(accounts) {
  for (;;) {
    const options = [
      ...accounts.map(a => ({
        value: a.id,
        label: a.name,
        hint: a.sharedResources ? `${tilde(a.configDir)} · ${t('menu.hint.shared')}` : tilde(a.configDir),
      })),
      { value: '__new__', label: t('menu.new') },
      { value: '__settings__', label: t('menu.settings') },
    ];

    const selected = await select({ message: t('menu.pick'), options });
    if (isCancel(selected)) bail();

    if (selected === '__settings__') {
      await settingsMenu(accounts);
      continue; // back to the account list, showing the updated state
    }

    if (selected === '__new__') return createAccount(accounts);

    const account = accounts.find(a => a.id === selected);
    if (!account) bail(t('menu.notFound', { id: selected }));
    return account;
  }
}

async function main() {
  intro(t('intro'));

  const accounts = loadAccounts();
  if (!accounts.length) await adoptExistingSetup(accounts);

  const account = await pickAccount(accounts);

  const claudeArgs = [];

  if (account.sharedResources) {
    const { added, pruned, skipped, error } = syncSharedResources(account.configDir);
    if (error) {
      log.warn(t('sync.error', { message: error.message }));
    } else if (added || pruned) {
      log.step(t('sync.step', { added, pruned }));
    }
    if (skipped?.length) {
      log.warn(t('sync.skipped', { list: skipped.join(', ') }));
    }

    const mcpConfig = sharedMcpConfig();
    if (mcpConfig) {
      claudeArgs.push('--mcp-config', mcpConfig);
      log.step(t('mcp.step', { file: tilde(mcpConfig) }));
    }
  }

  // Plugins are loaded for every account, whether or not it opted into the
  // shared resources: --plugin-dir is session-only and writes no state, and a
  // plugin like Warp's is what makes the terminal recognise the session as
  // Claude Code at all. One exception: a plugin this account already installed
  // is left to its own copy, or Claude Code would load both and run every hook
  // twice — for Warp that means duplicate notifications on every event.
  const installed = installedPluginNames(account.configDir);
  const plugins = sharedPlugins();
  const injected = plugins.filter(p => !installed.has(p.name));
  const alreadyInstalled = plugins.filter(p => installed.has(p.name));

  for (const plugin of injected) {
    claudeArgs.push('--plugin-dir', plugin.path);
  }
  if (injected.length) {
    log.step(t('plugins.step', { list: injected.map(p => p.name).join(', ') }));
  }
  if (alreadyInstalled.length) {
    log.step(t('plugins.installed', { list: alreadyInstalled.map(p => p.name).join(', ') }));
  }

  outro(t('launch', { name: account.name }));

  const child = spawn('claude', claudeArgs, {
    env: claudeEnv(account.configDir),
    stdio: 'inherit',
  });

  child.on('error', err => {
    console.error(t('launch.error', { message: err.message }));
    process.exit(1);
  });

  child.on('exit', code => process.exit(code ?? 0));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
