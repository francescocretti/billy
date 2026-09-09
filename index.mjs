#!/usr/bin/env node
import { intro, outro, note, select, text, confirm, log, isCancel, cancel } from '@clack/prompts';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { join, sep } from 'path';
import { homedir } from 'os';
import {
  AGENTS_DIR,
  installedPluginNames,
  syncSharedResources,
  sharedMcpConfig,
  sharedPlugins,
} from './sync.mjs';
import { LANGUAGES, SETTINGS_FILE, getLanguage, setLanguage, t } from './i18n.mjs';

const CONFIG_DIR = join(homedir(), '.config', 'billy');
const ACCOUNTS_FILE = join(CONFIG_DIR, 'accounts.json');
const CLAUDE_DEFAULT_DIR = join(homedir(), '.claude');

function loadAccounts() {
  if (!existsSync(ACCOUNTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch {
    console.error(t('accounts.malformed'));
    return [];
  }
}

function saveAccounts(accounts) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

function bail(message) {
  cancel(message ?? t('cancelled'));
  process.exit(0);
}

async function createAccount(accounts) {
  const name = await text({
    message: t('new.name'),
    validate: v => (!v.trim() ? t('new.nameEmpty') : undefined),
  });
  if (isCancel(name)) bail();

  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (accounts.find(a => a.id === id)) {
    bail(t('new.exists', { name: name.trim() }));
  }

  const share = await confirm({ message: t('shared.prompt'), initialValue: true });
  if (isCancel(share)) bail();

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
    log.success(t('shared.disabled', { name: account.name, dir: account.configDir }));
  }
}

// Removing the account profile and erasing its config dir are two separate
// decisions: the profile is just a line in accounts.json, the directory holds
// credentials, history and settings. The second is asked on its own, defaults
// to "no", and is refused outright for anything outside your home directory.
async function deleteAccount(accounts) {
  const selected = await select({
    message: t('delete.which'),
    options: accounts.map(a => ({ value: a.id, label: a.name, hint: a.configDir })),
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

// Billy juggles half a dozen directories across two config trees, so the one
// screen that answers "where is all of this, actually?" earns its place.
function showInfo(accounts) {
  const plugins = sharedPlugins();
  const mcpConfig = sharedMcpConfig();

  const rows = [
    [t('info.accounts'), String(accounts.length)],
    [t('info.accountsFile'), ACCOUNTS_FILE],
    [t('info.settingsFile'), SETTINGS_FILE],
    [t('info.agentsDir'), existsSync(AGENTS_DIR) ? AGENTS_DIR : `${AGENTS_DIR} (${t('info.missing')})`],
    [t('info.plugins'), plugins.length ? plugins.map(p => p.name).join(', ') : t('info.none')],
    [t('info.mcp'), mcpConfig ?? t('info.none')],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));
  note(rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`).join('\n'), t('settings.info'));
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
        hint: a.sharedResources ? `${a.configDir} · ${t('menu.hint.shared')}` : a.configDir,
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
      log.step(t('mcp.step', { file: mcpConfig }));
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
    env: { ...process.env, CLAUDE_CONFIG_DIR: account.configDir },
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
