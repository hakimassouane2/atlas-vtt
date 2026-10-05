/** An element of the player page (`playerPage.ts`), which always has it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The player page has no #${id}`);
  return element as T;
}

const status = (): HTMLElement => byId('status');

/** A short message at the bottom of the page; empty hides it. */
export function setStatus(text: string): void {
  status().textContent = text;
}
