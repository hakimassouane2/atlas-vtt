/** Draws the icon `name` (Obsidian's names, which are Lucide's) into `element`. */
export type IconRenderer = (element: HTMLElement, name: string) => void;

let renderer: IconRenderer = () => undefined;

/**
 * Makes `next` draw every icon until the function it returns is called: Obsidian's `setIcon` in
 * the plugin, the page's own on a player's page.
 */
export function setIconRenderer(next: IconRenderer): () => void {
  renderer = next;
  return () => {
    if (renderer === next) renderer = () => undefined;
  };
}

/** Draws the icon `name` into `element`; nothing where no renderer is set. */
export function renderIcon(element: HTMLElement, name: string): void {
  renderer(element, name);
}
