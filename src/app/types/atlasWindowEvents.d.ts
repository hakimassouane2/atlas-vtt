import type { NotePin } from '../types';

/** Tokens affected by a drag or size change. */
export interface TokenGestureEventDetail {
  tokenIds: string[];
}

/** A pin interaction the note pin tool should act on. */
export interface PinActionEventDetail {
  action: 'open' | 'edit';
  pin: NotePin;
}

/** Asks the active renderer to convert a world position to client coordinates. */
export interface ViewportPositionRequestDetail {
  worldX?: number;
  worldY?: number;
  callback: (clientX: number, clientY: number) => void;
}

declare global {
  /** Custom events Atlas VTT dispatches on `window` to coordinate its PIXI layers. */
  interface WindowEventMap {
    'atlas-token-size-changing': CustomEvent<TokenGestureEventDetail>;
    'atlas-tokens-drag-update': CustomEvent<TokenGestureEventDetail>;
    'atlas-pin-action': CustomEvent<PinActionEventDetail>;
    'get-viewport-position': CustomEvent<ViewportPositionRequestDetail>;
  }
}
