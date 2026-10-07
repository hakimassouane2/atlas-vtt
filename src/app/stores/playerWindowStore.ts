import { createStore, type StoreApi } from 'zustand/vanilla';

export interface PlayerWindowState {
  isOpen: boolean;
  isFrozen: boolean;
}

export type PlayerWindowStore = StoreApi<PlayerWindowState>;

const INITIAL_STATE: PlayerWindowState = {
  isOpen: false,
  isFrozen: false,
};

/**
 * Reactive mirror of the player window's lifecycle, written by
 * `PlayerWindowService` and read by UI such as the command palette.
 * A single module-level store matches the service's singleton lifetime.
 */
export const playerWindowStore: PlayerWindowStore = createStore<PlayerWindowState>(() => INITIAL_STATE);

export function resetPlayerWindowStore(): void {
  playerWindowStore.setState(INITIAL_STATE);
}
