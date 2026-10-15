import { installDomHost } from '../../host/dom';
import { setLocale } from '../../i18n';
import { pluginDomHost } from '../../plugin/host/dom';
import { installObsidianDom } from './obsidianDom';

/**
 * What the plugin's `initializeHost` does for Obsidian, for the player page: Obsidian's DOM
 * helpers, the DOM host and the language. Imported first by `main.ts`, so modules that read them
 * when they load find them.
 */
installObsidianDom();
installDomHost(pluginDomHost);
/** Where Obsidian keeps its language on this computer (`getLanguage()` reads it there); a player's browser has none. */
const OBSIDIAN_LANGUAGE_KEY = 'language';
try {
  setLocale(window.localStorage.getItem(OBSIDIAN_LANGUAGE_KEY) || 'en');
} catch {
  setLocale('en');
}
