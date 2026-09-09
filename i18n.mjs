// UI strings for Billy, in every supported language.
//
// The active language is a deliberate choice, saved in
// ~/.config/billy/settings.json — it is never guessed from the system locale,
// so Billy speaks the same language on every machine you carry your dotfiles
// to. English is the default until you pick otherwise (⚙ Language in the menu).
//
// Adding a language means adding one entry to MESSAGES and one to LANGUAGES;
// any key you leave out falls back to English rather than showing a raw key.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

export const SETTINGS_FILE = join(homedir(), '.config', 'billy', 'settings.json');

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
];

const MESSAGES = {
  en: {
    'intro': 'Billy — Claude Code Switch',
    'cancelled': 'Cancelled.',

    'menu.pick': 'Which account do you want to use?',
    'menu.new': '+ Add account',
    'menu.settings': '⚙ Settings',
    'menu.hint.shared': 'shared',
    'menu.notFound': 'Account "{id}" not found in accounts.json.',

    'accounts.malformed': 'Warning: accounts.json is malformed. Starting with an empty account list.',

    'new.name': 'Account name (e.g. work, personal)',
    'new.nameEmpty': 'The name cannot be empty.',
    'new.exists': 'An account named "{name}" already exists.',

    'shared.prompt': 'Import shared resources (skills, commands, agents, CLAUDE.md) from ~/.agents as symlinks?',
    'shared.promptFor': 'Import shared resources (skills, commands, agents, CLAUDE.md) from ~/.agents as symlinks into "{name}"?',
    'shared.which': 'Shared resources: for which account?',
    'shared.on': 'on',
    'shared.off': 'off',
    'shared.enabled': '"{name}": shared resources on, synced at next launch.',
    'shared.disabled': '"{name}": sync off. Symlinks already in {dir} are left alone.',

    'delete.which': 'Which account do you want to delete?',
    'delete.confirm': 'Remove "{name}" from Billy\'s account list?',
    'delete.dir': 'Also delete {dir}? It holds this account\'s credentials, history and settings.',
    'delete.dirIsDefault': '{dir} is Claude Code\'s own default config dir — deleting it wipes your main setup, not just this Billy account.',
    'delete.dirOutsideHome': '{dir} is outside your home directory: Billy will not delete it.',
    'delete.done': '"{name}" removed from the account list. {dir} is still on disk.',
    'delete.doneWithDir': '"{name}" removed, along with {dir}.',
    'delete.dirError': 'Account removed, but {dir} could not be deleted: {message}',

    'settings.title': 'Settings',
    'settings.shared': 'Shared resources',
    'settings.sharedHint': 'on for {on} of {total} accounts',
    'settings.delete': 'Delete account',
    'settings.deleteHint': 'the profile and, if you want, its config dir',
    'settings.language': 'Language',
    'settings.info': 'Where everything lives',
    'settings.back': '← Back',

    'info.accounts': 'Accounts',
    'info.accountsFile': 'Account list',
    'info.settingsFile': 'Billy settings',
    'info.agentsDir': 'Shared resources',
    'info.plugins': 'Shared plugins',
    'info.mcp': 'Shared MCP servers',
    'info.none': 'none',
    'info.missing': 'missing',

    'language.which': 'Language',
    'language.saved': 'Language set to {label}.',

    'sync.error': 'Shared resources sync skipped: {message}',
    'sync.step': 'Shared resources: {added} symlinks updated, {pruned} removed.',
    'sync.skipped': 'Skipped (real files, not symlinks): {list}',
    'mcp.step': 'Shared MCP servers loaded from {file}',
    'plugins.step': 'Shared plugins: {list}',

    'launch': 'Launching Claude Code as "{name}"...',
    'launch.error': 'Error: could not start claude. {message}',
  },

  it: {
    'intro': 'Billy — Claude Code Switch',
    'cancelled': 'Annullato.',

    'menu.pick': 'Quale account vuoi usare?',
    'menu.new': '+ Aggiungi account',
    'menu.settings': '⚙ Impostazioni',
    'menu.hint.shared': 'condivise',
    'menu.notFound': 'Account "{id}" non trovato in accounts.json.',

    'accounts.malformed': 'Attenzione: accounts.json è malformato. Riparto con una lista account vuota.',

    'new.name': 'Nome account (es. work, personal)',
    'new.nameEmpty': 'Il nome non può essere vuoto.',
    'new.exists': 'Esiste già un account chiamato "{name}".',

    'shared.prompt': 'Importare le risorse condivise (skills, commands, agents, CLAUDE.md) da ~/.agents come symlink?',
    'shared.promptFor': 'Importare le risorse condivise (skills, commands, agents, CLAUDE.md) da ~/.agents come symlink in "{name}"?',
    'shared.which': 'Risorse condivise: per quale account?',
    'shared.on': 'attive',
    'shared.off': 'non attive',
    'shared.enabled': '"{name}": risorse condivise attive, sincronizzate al prossimo avvio.',
    'shared.disabled': '"{name}": sync disattivato. I symlink già in {dir} restano.',

    'delete.which': 'Quale account vuoi eliminare?',
    'delete.confirm': 'Rimuovere "{name}" dalla lista account di Billy?',
    'delete.dir': 'Eliminare anche {dir}? Contiene credenziali, cronologia e impostazioni di questo account.',
    'delete.dirIsDefault': '{dir} è la config dir predefinita di Claude Code — eliminarla cancella la tua installazione principale, non solo questo account Billy.',
    'delete.dirOutsideHome': '{dir} è fuori dalla tua home: Billy non la elimina.',
    'delete.done': '"{name}" rimosso dalla lista account. {dir} resta sul disco.',
    'delete.doneWithDir': '"{name}" rimosso, insieme a {dir}.',
    'delete.dirError': 'Account rimosso, ma {dir} non è stata eliminata: {message}',

    'settings.title': 'Impostazioni',
    'settings.shared': 'Risorse condivise',
    'settings.sharedHint': 'attive su {on} account di {total}',
    'settings.delete': 'Elimina account',
    'settings.deleteHint': 'il profilo e, se vuoi, la sua config dir',
    'settings.language': 'Lingua',
    'settings.info': 'Dove sta ogni cosa',
    'settings.back': '← Indietro',

    'info.accounts': 'Account',
    'info.accountsFile': 'Lista account',
    'info.settingsFile': 'Impostazioni Billy',
    'info.agentsDir': 'Risorse condivise',
    'info.plugins': 'Plugin condivisi',
    'info.mcp': 'Server MCP condivisi',
    'info.none': 'nessuno',
    'info.missing': 'assente',

    'language.which': 'Lingua',
    'language.saved': 'Lingua impostata: {label}.',

    'sync.error': 'Sync risorse condivise saltato: {message}',
    'sync.step': 'Risorse condivise: {added} symlink aggiornati, {pruned} rimossi.',
    'sync.skipped': 'Saltati (file reali, non symlink): {list}',
    'mcp.step': 'Server MCP condivisi caricati da {file}',
    'plugins.step': 'Plugin condivisi: {list}',

    'launch': 'Avvio Claude Code come "{name}"...',
    'launch.error': 'Errore: impossibile avviare claude. {message}',
  },
};

const DEFAULT_LANGUAGE = 'en';

function readSettings() {
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    return settings && typeof settings === 'object' ? settings : {};
  } catch {
    return {};
  }
}

let current = (() => {
  const saved = readSettings().language;
  return typeof saved === 'string' && saved in MESSAGES ? saved : DEFAULT_LANGUAGE;
})();

export function getLanguage() {
  return current;
}

/** Persist the chosen language, preserving anything else in settings.json. */
export function setLanguage(language) {
  if (!(language in MESSAGES)) return;
  current = language;
  mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify({ ...readSettings(), language }, null, 2));
}

/** Translate `key`, substituting {placeholders} from `params`. */
export function t(key, params = {}) {
  const raw = MESSAGES[current]?.[key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Whether a settings file exists at all — used to keep first-run quiet. */
export function hasSettingsFile() {
  return existsSync(SETTINGS_FILE);
}
