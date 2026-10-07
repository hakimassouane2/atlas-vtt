import { isTyping } from './dom';

/**
 * Keeps the browser's own context menu off the page: it opened over Atlas' menus (a player's
 * token, the tray), mostly hiding them. Only its default is cancelled, so Atlas' menus still hear
 * the right-click. Text fields keep it, for pasting.
 */
export function guardNativeContextMenu(): void {
  window.addEventListener('contextmenu', (event) => {
    if (!isTyping(event)) event.preventDefault();
  });
}
