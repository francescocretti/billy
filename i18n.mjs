// UI strings for Billy, in every supported language.
//
// The active language is a deliberate choice, saved in
// ~/.billy/settings.json — it is never guessed from the system locale,
// so Billy speaks the same language on every machine you carry your dotfiles
// to. English is the default until you pick otherwise (⚙ Language in the menu).
//
// Adding a language means adding one entry to MESSAGES and one to LANGUAGES;
// any key you leave out falls back to English rather than showing a raw key.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { SETTINGS_FILE } from './paths.mjs';

export { SETTINGS_FILE };

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

    'adopt.title': 'Existing Claude Code setup found',
    'adopt.dir': 'Directory',
    'adopt.account': 'Logged in as',
    'adopt.projects': 'Projects',
    'adopt.name': 'What should Billy call this account?',
    'adopt.adopted': 'Added "{name}" — it keeps using {dir}.',

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
    'plugins.installed': 'Already installed in this account, not injected: {list}',

    'settings.plugins': 'Shared plugins',
    'info.billyDir': 'Billy folder',

    'plugins.title': 'Shared plugins — loaded into every account',
    'plugins.add': '+ Add shared plugin',
    'plugins.addFrom': 'Where from?',
    'plugins.fromAccount': 'From one of your accounts',
    'plugins.fromAccountHint': 'a plugin you already installed somewhere',
    'plugins.fromRepo': 'From a git repository',
    'plugins.fromRepoHint': 'owner/repo or a git URL',
    'plugins.whichInstalled': 'Which plugin?',
    'plugins.repoPrompt': 'GitHub owner/repo or git URL',
    'plugins.repoEmpty': 'Enter a repository.',
    'plugins.whichInRepo': 'This repository offers several plugins. Which one?',
    'plugins.cloning': 'Cloning {url}',
    'plugins.cloneError': 'Clone failed: {message}',
    'plugins.noSource': 'Billy can\'t find where marketplace "{marketplace}" comes from. Add it from its git repository instead.',
    'plugins.notInRepo': 'The repository has no plugin named "{plugin}" left to share.',
    'plugins.noneInRepo': 'No plugin to share in {url} (or they are all shared already).',
    'plugins.exists': '"{name}" is already a shared plugin.',
    'plugins.noManifest': 'That folder has no .claude-plugin/plugin.json.',
    'plugins.badName': 'The plugin\'s name, "{name}", isn\'t a valid folder name. Billy didn\'t add it.',
    'plugins.added': '"{plugin}" is now shared: every account loads it from the next launch.',
    'plugins.uninstallOwn': '"{account}" also has {plugin} installed on its own. Uninstall it there, so it uses the shared copy?',
    'plugins.uninstalling': 'Uninstalling from "{account}"',
    'plugins.uninstalled': '"{account}": own copy of {plugin} removed.',
    'plugins.uninstallError': '"{account}": uninstall failed: {message}',
    'plugins.update': 'Update',
    'plugins.updateHint': 'git pull',
    'plugins.updating': 'Updating {plugin}',
    'plugins.updated': '{plugin} updated. Accounts pick it up at their next launch.',
    'plugins.upToDate': '{plugin} is already up to date.',
    'plugins.updateError': 'Update failed: {message}',
    'plugins.remove': 'Remove',
    'plugins.removeHint': 'stop loading it into every account',
    'plugins.removeConfirm': 'Stop sharing {plugin}? Accounts that didn\'t install it on their own will lose it.',
    'plugins.removed': '{plugin} is no longer shared.',
    'plugins.removeNotLink': '{path} is a real folder, not a link Billy made: remove it by hand if you mean to.',
    'plugins.removeError': 'Removal failed: {message}',
    'plugins.legacy': 'Billy no longer loads plugins from {dir} ({list}). Add them again here; then you can delete that folder.',

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

    'adopt.title': 'Trovata una configurazione Claude Code esistente',
    'adopt.dir': 'Cartella',
    'adopt.account': 'Account',
    'adopt.projects': 'Progetti',
    'adopt.name': 'Come vuoi chiamare questo account?',
    'adopt.adopted': 'Aggiunto "{name}" — continua a usare {dir}.',

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
    'plugins.installed': 'Già installati in questo account, non iniettati: {list}',

    'settings.plugins': 'Plugin condivisi',
    'info.billyDir': 'Cartella Billy',

    'plugins.title': 'Plugin condivisi: caricati in ogni account',
    'plugins.add': '+ Aggiungi plugin condiviso',
    'plugins.addFrom': 'Da dove?',
    'plugins.fromAccount': 'Da uno dei tuoi account',
    'plugins.fromAccountHint': 'un plugin che hai già installato da qualche parte',
    'plugins.fromRepo': 'Da un repository git',
    'plugins.fromRepoHint': 'owner/repo o un URL git',
    'plugins.whichInstalled': 'Quale plugin?',
    'plugins.repoPrompt': 'owner/repo GitHub o URL git',
    'plugins.repoEmpty': 'Inserisci un repository.',
    'plugins.whichInRepo': 'Questo repository offre più plugin. Quale?',
    'plugins.cloning': 'Clone di {url}',
    'plugins.cloneError': 'Clone fallito: {message}',
    'plugins.noSource': 'Billy non trova da dove viene il marketplace "{marketplace}". Aggiungilo dal suo repository git.',
    'plugins.notInRepo': 'Nel repository non c\'è un plugin "{plugin}" ancora da condividere.',
    'plugins.noneInRepo': 'Nessun plugin da condividere in {url} (o sono già tutti condivisi).',
    'plugins.exists': '"{name}" è già un plugin condiviso.',
    'plugins.noManifest': 'Quella cartella non ha .claude-plugin/plugin.json.',
    'plugins.badName': 'Il nome del plugin, "{name}", non è un nome di cartella valido. Billy non l\'ha aggiunto.',
    'plugins.added': '"{plugin}" ora è condiviso: ogni account lo carica dal prossimo avvio.',
    'plugins.uninstallOwn': '"{account}" ha anche una sua copia di {plugin}. La disinstallo da lì, così usa quella condivisa?',
    'plugins.uninstalling': 'Disinstallazione da "{account}"',
    'plugins.uninstalled': '"{account}": copia propria di {plugin} rimossa.',
    'plugins.uninstallError': '"{account}": disinstallazione fallita: {message}',
    'plugins.update': 'Aggiorna',
    'plugins.updateHint': 'git pull',
    'plugins.updating': 'Aggiornamento di {plugin}',
    'plugins.updated': '{plugin} aggiornato. Gli account lo usano dal prossimo avvio.',
    'plugins.upToDate': '{plugin} è già aggiornato.',
    'plugins.updateError': 'Aggiornamento fallito: {message}',
    'plugins.remove': 'Rimuovi',
    'plugins.removeHint': 'non caricarlo più negli account',
    'plugins.removeConfirm': 'Smettere di condividere {plugin}? Gli account che non l\'hanno installato per conto loro lo perdono.',
    'plugins.removed': '{plugin} non è più condiviso.',
    'plugins.removeNotLink': '{path} è una cartella vera, non un link creato da Billy: rimuovila a mano se è quello che vuoi.',
    'plugins.removeError': 'Rimozione fallita: {message}',
    'plugins.legacy': 'Billy non carica più i plugin da {dir} ({list}). Aggiungili di nuovo da qui, poi puoi eliminare quella cartella.',

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
