#!/usr/bin/env node
import { intro, outro, select, text, confirm, log, isCancel, cancel } from '@clack/prompts';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { homedir } from 'os';
import { syncSharedResources, sharedMcpConfig, sharedPlugins } from './sync.mjs';

const CONFIG_DIR = join(homedir(), '.config', 'billy');
const ACCOUNTS_FILE = join(CONFIG_DIR, 'accounts.json');

function loadAccounts() {
  if (!existsSync(ACCOUNTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch {
    console.error('Warning: accounts.json is malformed. Starting with an empty account list.');
    return [];
  }
}

function saveAccounts(accounts) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

function bail(message) {
  cancel(message ?? 'Annullato.');
  process.exit(0);
}

const SHARED_PROMPT =
  'Importare le risorse condivise (skills, commands, agents, CLAUDE.md) da ~/.agents come symlink';

async function createAccount(accounts) {
  const name = await text({
    message: 'Nome account (es. work, personal)',
    validate: v => (!v.trim() ? 'Il nome non può essere vuoto.' : undefined),
  });
  if (isCancel(name)) bail();

  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (accounts.find(a => a.id === id)) {
    bail(`Esiste già un account chiamato "${name.trim()}".`);
  }

  const share = await confirm({ message: `${SHARED_PROMPT}?`, initialValue: true });
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
    message: 'Risorse condivise: per quale account?',
    options: accounts.map(a => ({
      value: a.id,
      label: a.name,
      hint: a.sharedResources ? 'attive' : 'non attive',
    })),
  });
  if (isCancel(selected)) return;

  const account = accounts.find(a => a.id === selected);
  const share = await confirm({
    message: `${SHARED_PROMPT} in "${account.name}"?`,
    initialValue: account.sharedResources === true,
  });
  if (isCancel(share) || share === Boolean(account.sharedResources)) return;

  account.sharedResources = share;
  saveAccounts(accounts);

  if (share) {
    log.success(`"${account.name}": risorse condivise attive, sincronizzate al prossimo avvio.`);
  } else {
    // Turning it off only stops future syncs — links already in the config dir
    // are left alone, so say so instead of implying a cleanup happened.
    log.success(`"${account.name}": sync disattivato. I symlink già in ${account.configDir} restano.`);
  }
}

async function pickAccount(accounts) {
  for (;;) {
    const options = [
      ...accounts.map(a => ({
        value: a.id,
        label: a.name,
        hint: a.sharedResources ? `${a.configDir} · condivise` : a.configDir,
      })),
      { value: '__new__', label: '+ Aggiungi account' },
    ];

    if (accounts.length) {
      options.push({ value: '__shared__', label: '⚙ Risorse condivise' });
    }

    const selected = await select({ message: 'Quale account vuoi usare?', options });
    if (isCancel(selected)) bail();

    if (selected === '__shared__') {
      await editSharedResources(accounts);
      continue; // back to the account list, now showing the updated state
    }

    if (selected === '__new__') return createAccount(accounts);

    const account = accounts.find(a => a.id === selected);
    if (!account) bail(`Account "${selected}" non trovato in accounts.json.`);
    return account;
  }
}

async function main() {
  intro('Billy — Claude Code Switch');

  const accounts = loadAccounts();
  const account = await pickAccount(accounts);

  const claudeArgs = [];

  if (account.sharedResources) {
    const { added, pruned, skipped, error } = syncSharedResources(account.configDir);
    if (error) {
      log.warn(`Sync risorse condivise saltato: ${error.message}`);
    } else if (added || pruned) {
      log.step(`Risorse condivise: ${added} symlink aggiornati, ${pruned} rimossi.`);
    }
    if (skipped?.length) {
      log.warn(`Saltati (file reali, non symlink): ${skipped.join(', ')}`);
    }

    const mcpConfig = sharedMcpConfig();
    if (mcpConfig) {
      claudeArgs.push('--mcp-config', mcpConfig);
      log.step(`Server MCP condivisi caricati da ${mcpConfig}`);
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
    log.step(`Plugin condivisi: ${plugins.map(p => basename(p)).join(', ')}`);
  }

  outro(`Avvio Claude Code come "${account.name}"...`);

  const child = spawn('claude', claudeArgs, {
    env: { ...process.env, CLAUDE_CONFIG_DIR: account.configDir },
    stdio: 'inherit',
  });

  child.on('error', err => {
    console.error(`Errore: impossibile avviare claude. ${err.message}`);
    process.exit(1);
  });

  child.on('exit', code => process.exit(code ?? 0));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
