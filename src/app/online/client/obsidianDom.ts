/** The part of Obsidian's `DomElementInfo` the page and the Atlas overlays pass. */
interface ElementInfo {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string | number | boolean | null>;
}

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

// The page runs in a plain browser: this shim is Obsidian's createEl, so it creates elements itself
function createElement(tag: string): HTMLElement {
  return document.createElementNS(HTML_NAMESPACE, tag);
}

function build(tag: string, info: ElementInfo | string | undefined): HTMLElement {
  const created = createElement(tag);
  if (typeof info === 'string') {
    created.className = info;
    return created;
  }
  if (info?.cls) created.classList.add(...(Array.isArray(info.cls) ? info.cls : info.cls.split(' ').filter(Boolean)));
  if (info?.text !== undefined) created.textContent = info.text;
  for (const [name, value] of Object.entries(info?.attr ?? {})) {
    if (value !== null && value !== false) created.setAttribute(name, String(value));
  }
  return created;
}

/**
 * Adds the DOM helpers Obsidian provides (the globals `createEl` and `activeWindow`, and
 * `createDiv`, `empty`, `win`… on every element) to the player page, so Atlas' player overlays and the
 * page's own code run there as they do in Obsidian.
 */
export function installObsidianDom(): void {
  const globals = window as unknown as Record<string, unknown>;
  globals.createEl = (tag: string, info?: ElementInfo | string): HTMLElement => build(tag, info);
  globals.createDiv = (info?: ElementInfo | string): HTMLElement => build('div', info);
  globals.createSpan = (info?: ElementInfo | string): HTMLElement => build('span', info);
  // The page is one window: Obsidian's window of the focused leaf is always this one
  globals.activeWindow = window;
  globals.activeDocument = document;
  Object.defineProperty(Node.prototype, 'win', { configurable: true, get: () => window });
  Object.defineProperty(Node.prototype, 'doc', { configurable: true, get: () => document });

  const element = HTMLElement.prototype as unknown as Record<string, unknown>;
  const append = (parent: HTMLElement, tag: string, info?: ElementInfo | string): HTMLElement => parent.appendChild(build(tag, info));
  element.createEl = function (this: HTMLElement, tag: string, info?: ElementInfo | string): HTMLElement {
    return append(this, tag, info);
  };
  element.createDiv = function (this: HTMLElement, info?: ElementInfo | string): HTMLElement {
    return append(this, 'div', info);
  };
  element.createSpan = function (this: HTMLElement, info?: ElementInfo | string): HTMLElement {
    return append(this, 'span', info);
  };
  element.empty = function (this: HTMLElement): void {
    this.replaceChildren();
  };
  element.addClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.add(...classes);
  };
}
