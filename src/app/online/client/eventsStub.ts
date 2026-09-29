/**
 * Stands in for Node's `events` module in the player page's bundle. Nothing the page
 * runs emits events through it; the class only has to exist for imports to resolve.
 */
export class EventEmitter {
  on(): this { return this; }
  off(): this { return this; }
  emit(): boolean { return false; }
}
