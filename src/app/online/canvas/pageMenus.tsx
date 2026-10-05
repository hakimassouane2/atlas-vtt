import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ContextMenuProvider } from '../../react/root/ContextMenuContext';
import { setIconRenderer } from '../../ui/icons';
import { renderPageIcon } from './pageIcons';

/** Mounts Atlas' context menus on the page, which the canvas opens (`openContextMenuGlobal`), with the page's icons. */
export function installPageMenus(): void {
  setIconRenderer(renderPageIcon);
  const host = document.body.createDiv({ cls: 'atlas-player-menus' });
  createRoot(host).render(createElement(ContextMenuProvider, null, null));
}
