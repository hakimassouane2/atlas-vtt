import type { ContextMenuEntry } from '../react/components/context-menu/AtlasContextMenu';

export type { ContextMenuEntry };

export interface ContextMenuOptions {
  /**
   * Where focus goes when the menu closes and nothing else took it (a menu
   * opened from the keyboard, closed with Escape): the menu's own trigger is
   * a point and cannot hold focus.
   */
  returnFocus?: HTMLElement | null;
}

/** What a mounted menu provider (`ContextMenuProvider`) answers to. */
export interface ContextMenuController {
  open: (entries: ContextMenuEntry[], position: { x: number; y: number }, options?: ContextMenuOptions) => void;
  close: () => void;
}

/**
 * Every mounted provider registers here. The newest one serves callers outside
 * React, so a provider that unmounts never disables the ones still on screen.
 */
const controllers: ContextMenuController[] = [];

/** Lets `controller` serve menus until the function it returns is called. */
export function registerContextMenuController(controller: ContextMenuController): () => void {
  controllers.push(controller);
  return () => {
    controllers.splice(controllers.indexOf(controller), 1);
  };
}

/** Opens a menu of `entries` at a point of the window, in the newest mounted provider. */
export function openContextMenuGlobal(entries: ContextMenuEntry[], position: { x: number; y: number }, options?: ContextMenuOptions): void {
  controllers[controllers.length - 1]?.open(entries, position, options);
}

export function closeContextMenuGlobal(): void {
  for (const controller of controllers) controller.close();
}
