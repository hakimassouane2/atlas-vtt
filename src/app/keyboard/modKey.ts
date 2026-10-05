import { runtimePlatform } from './runtimePlatform';

/**
 * Whether Obsidian's "Mod" key is held: Cmd on macOS, Ctrl elsewhere. Ctrl
 * never counts on macOS, where Ctrl+click is a right click and fires no click.
 */
export function isModHeld(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return runtimePlatform.isMacOS ? event.metaKey : event.ctrlKey;
}

/** Whether a key event is for the Mod key itself, e.g. its release. */
export function isModKey(event: { key: string }): boolean {
  return event.key === (runtimePlatform.isMacOS ? 'Meta' : 'Control');
}
