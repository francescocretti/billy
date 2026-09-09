#!/usr/bin/env node
import { intro, outro, select, text, confirm, log, isCancel, cancel } from '@clack/prompts';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { basename, join, sep } from 'path';
import { homedir } from 'os';
import { syncSharedResources, sharedMcpConfig, sharedPlugins } from './sync.mjs';
import { LANGUAGES, getLanguage, setLanguage, t } from './i18n.mjs';

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

async function pickAccount(accounts) {
  for (;;) {
    const options = [
      ...accounts.map(a => ({
        value: a.id,
        label: a.name,
        hint: a.sharedResources ? `${a.configDir} · ${t('menu.hint.shared')}` : a.configDir,
      })),
      { value: '__new__', label: t('menu.new') },
    ];

    if (accounts.length) {
      options.push({ value: '__shared__', label: t('menu.shared') });
      options.push({ value: '__delete__', label: t('menu.delete') });
    }
    options.push({ value: '__language__', label: t('menu.language') });

    const selected = await select({ message: t('menu.pick'), options });
    if (isCancel(selected)) bail();

    // Every ⚙ entry loops back to the account list, which then shows the
    // updated state (and, after a language change, the new wording).
    if (selected === '__shared__') {
      await editSharedResources(accounts);
      continue;
    }
    if (selected === '__delete__') {
      await deleteAccount(accounts);
      continue;
    }
    if (selected === '__language__') {
      await chooseLanguage();
      continue;
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
  // Claude Code at all.
  const plugins = sharedPlugins();
  for (const plugin of plugins) {
    claudeArgs.push('--plugin-dir', plugin);
  }
  if (plugins.length) {
    log.step(t('plugins.step', { list: plugins.map(p => basename(p)).join(', ') }));
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
