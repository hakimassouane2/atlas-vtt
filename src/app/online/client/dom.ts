/** An element of the player page (`playerPage.ts`), which always has it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The player page has no #${id}`);
  return element as T;
}

/** A new element with a class and optional text (Obsidian's `createEl`, see `obsidianDom.ts`). */
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  return createEl(tag, { ...(className && { cls: className }), ...(text !== undefined && { text }) });
}

/** A small button in the page's style. */
export function button(text: string, onClick: () => void, label?: string): HTMLButtonElement {
  const created = element('button', 'online-button', text);
  created.type = 'button';
  if (label) created.setAttribute('aria-label', label);
  created.addEventListener('click', onClick);
  return created;
}

const status = (): HTMLElement => byId('status');

/** A short message at the bottom of the page; empty hides it. */
export function setStatus(text: string): void {
  status().textContent = text;
}
