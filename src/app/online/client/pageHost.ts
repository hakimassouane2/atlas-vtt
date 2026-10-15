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
// The language Obsidian uses on this computer, where `getLanguage()` reads it (none on another computer)
try {
  // eslint-disable-next-line obsidianmd/prefer-get-language -- the player page has no `obsidian` module
  setLocale(window.localStorage.getItem('language') || 'en');
} catch {
  setLocale('en');
}
