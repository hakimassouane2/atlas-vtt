import type { ContextMenuEntry } from '../react/components/context-menu/AtlasContextMenu';

export type { ContextMenuEntry };

export interface ContextMenuOptions {
  /**
   * Where focus goes when the menu closes and nothing else took it (a menu
   * opened from the keyboard, closed with Escape): the menu's own trigger is
   * a point and cannot hold focus.
   */
  returnFocus?: HTMLElement | null;
  /** Called once the menu closes, however it closed. */
  onClose?: (() => void) | undefined;
}

/** What a mounted menu provider (`ContextMenuProvider`) answers to. */
export interface ContextMenuController {
  open: (entries: ContextMenuEntry[], position: { x: number; y: number }, options?: ContextMenuOptions) => void;
  close: () => void;
}

/** A provider serving callers outside React. */
export interface RegisteredContextMenuController extends ContextMenuController {
  /** The document the provider opens its menus in, once it is rendered. */
  doc: () => Document | null;
}

/**
 * Every mounted provider registers here. The newest one serves callers outside
 * React, so a provider that unmounts never disables the ones still on screen.
 */
const controllers: RegisteredContextMenuController[] = [];

/** Lets `controller` serve menus until the function it returns is called. */
export function registerContextMenuController(controller: RegisteredContextMenuController): () => void {
  controllers.push(controller);
  return () => {
    controllers.splice(controllers.indexOf(controller), 1);
  };
}

export interface GlobalContextMenuOptions extends ContextMenuOptions {
  /** Opens the menu in this document (a popout's), served by the newest provider rendered there. */
  doc?: Document | undefined;
}

/**
 * Opens a menu of `entries` at a point of the window, in the newest mounted provider (of `options.doc` when given);
 * false where no provider is rendered (in that document) to open it.
 */
export function openContextMenuGlobal(entries: ContextMenuEntry[], position: { x: number; y: number }, options?: GlobalContextMenuOptions): boolean {
  const inDoc = options?.doc === undefined ? controllers : controllers.filter((controller) => controller.doc() === options.doc);
  const controller = inDoc[inDoc.length - 1];
  controller?.open(entries, position, options);
  return controller !== undefined;
}

export function closeContextMenuGlobal(): void {
  for (const controller of controllers) controller.close();
}
