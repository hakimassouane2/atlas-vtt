import type { StoreApi } from 'zustand';
import type { ViewAtlasState } from '../../../storeFactory';
import type { ContextMenuEntry } from '../../../ui/contextMenus';

/** How far a step of the menu turns a token, in degrees. */
const ROTATION_STEP = 45;

/** "Rotate" submenu shared by the GM's and the players' token menus: each step turns every target from its own rotation, in one store write. */
export function tokenRotationSubmenu(store: StoreApi<ViewAtlasState>, targets: string[]): ContextMenuEntry {
  const turn = (degrees: number): void => {
    const { objects, updateTokens } = store.getState();
    updateTokens(targets.flatMap((id) => {
      const token = objects.tokens[id];
      return token ? [{ id, changes: { rotation: ((token.rotation ?? 0) + degrees + 360) % 360 } }] : [];
    }));
  };
  return {
    type: 'submenu',
    label: 'Rotate',
    icon: 'rotate-cw',
    children: [
      { type: 'item', label: `${ROTATION_STEP}° left`, icon: 'rotate-ccw', keepOpen: true, onClick: () => turn(-ROTATION_STEP) },
      { type: 'item', label: `${ROTATION_STEP}° right`, icon: 'rotate-cw', keepOpen: true, onClick: () => turn(ROTATION_STEP) },
    ],
  };
}
