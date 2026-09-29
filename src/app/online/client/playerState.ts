import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ViewAtlasState } from '../../storeFactory';
import type { PlayerScene, PlayerState } from '../protocol';

/** The presented scene, a stand-in for the view store Atlas' player overlays read. */
export const sceneStore = createStore<PlayerScene>(() => ({
  objects: { tokens: {} },
  initiative: undefined,
  initiativeTrackerOpen: false,
}));

/** `sceneStore` as the overlays type it: they only read the fields `PlayerScene` holds. */
export const overlayStore = sceneStore as unknown as StoreApi<ViewAtlasState>;

/** What the DM's Atlas last sent about the scene; null until the first update. */
export const playerStateStore = createStore<PlayerState | null>(() => null);

export function applyPlayerState(state: PlayerState): void {
  sceneStore.setState(state.scene, true);
  playerStateStore.setState(state, true);
}
