import type { NavigationInputMode } from '../../services/SettingsService';

const STORAGE_KEY = 'atlas-vtt:input-device';

// The page runs in a browser without Obsidian's App, so it keeps this in the browser's storage
/** The device this player navigates the map with, remembered by their browser; a mouse until they choose. */
export function storedInputDevice(): NavigationInputMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'mouse' || stored === 'trackpad') return stored;
  } catch {
    // Storage blocked (private window): fall back to the default
  }
  return 'mouse';
}

export function storeInputDevice(mode: NavigationInputMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage blocked: the choice lasts until the page reloads
  }
}
