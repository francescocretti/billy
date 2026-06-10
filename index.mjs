#!/usr/bin/env node
import { intro, outro, select, text, confirm, log, isCancel, cancel } from '@clack/prompts';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { syncSharedResources } from './sync.mjs';

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

async function main() {
  intro('Billy — Claude Code Switch');

  const accounts = loadAccounts();

  const options = [
    ...accounts.map(a => ({ value: a.id, label: a.name, hint: a.configDir })),
    { value: '__new__', label: '+ Aggiungi account' },
  ];

  const selected = await select({
    message: 'Quale account vuoi usare?',
    options,
  });

  if (isCancel(selected)) bail();

  let account;

  if (selected === '__new__') {
    const name = await text({
      message: 'Nome account (es. work, personal)',
      validate: v => (!v.trim() ? 'Il nome non può essere vuoto.' : undefined),
    });
    if (isCancel(name)) bail();

    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (accounts.find(a => a.id === id)) {
      bail(`Esiste già un account chiamato "${name.trim()}".`);
    }

    const share = await confirm({
      message: 'Importare le risorse condivise (skills, commands, agents, CLAUDE.md) da ~/.agents come symlink?',
      initialValue: true,
    });
    if (isCancel(share)) bail();

    account = {
      id,
      name: name.trim(),
      configDir: join(homedir(), `.claude-${id}`),
      sharedResources: share,
    };

    accounts.push(account);
    saveAccounts(accounts);
  } else {
    account = accounts.find(a => a.id === selected);
  }

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
  }

  outro(`Avvio Claude Code come "${account.name}"...`);

  const child = spawn('claude', [], {
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
