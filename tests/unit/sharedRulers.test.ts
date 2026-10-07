import { describe, expect, test, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import type { SharedRulers } from '../../src/app/canvas/sharedRulers';
import { readRulerPath } from '../../src/app/canvas/sharedRulers';
import { parsePlayerCommand } from '../../src/app/online/playerCommands';
import { PlayerControls, type CommandSource } from '../../src/app/online/PlayerControls';
import { DM_RULER, PlayerRulers } from '../../src/app/online/PlayerRulers';
import type { PlayerProfile } from '../../src/app/types/collectionSettingsTypes';

const alice: PlayerProfile = { id: 'alice', name: 'Alice', color: '#3b82f6' };
const path = { tokenId: 'hero', waypoints: [{ x: 35, y: 35 }] };

function sceneStore(): StoreApi<ViewAtlasState> {
  return createStore((set) => ({
    isMapLoading: false,
    objects: { tokens: { hero: { id: 'hero', controlledBy: ['alice'] }, orc: { id: 'orc' } } },
    localRuler: null,
    sharedRulers: {},
    sharedLasers: {},
    setSharedRulers: (sharedRulers: SharedRulers) => set({ sharedRulers }),
  })) as unknown as StoreApi<ViewAtlasState>;
}

function source(store: StoreApi<ViewAtlasState>): CommandSource {
  return { store, grid: () => null, conditions: () => [], resources: () => [], players: () => [alice], updateProfile: vi.fn() };
}

describe('ruler paths from the network', () => {
  test('a path is a token and finite points; anything else is none', () => {
    expect(readRulerPath(null)).toBeNull();
    expect(readRulerPath(path)).toEqual(path);
    expect(readRulerPath({ tokenId: 'hero', waypoints: [] })).toBeUndefined();
    expect(readRulerPath({ tokenId: 'hero', waypoints: [{ x: Infinity, y: 0 }] })).toBeUndefined();
    expect(parsePlayerCommand({ type: 'ruler', ruler: path })).toEqual({ type: 'ruler', ruler: path });
    expect(parsePlayerCommand({ type: 'ruler', ruler: 'x' })).toBeNull();
  });
});

describe("a player's ruler", () => {
  test('shows on the DM map in their colour while they drag a token of theirs, and goes when they let go or leave', () => {
    const store = sceneStore();
    const controls = new PlayerControls(() => true);
    controls.setSource(source(store));
    expect(controls.apply({ type: 'ruler', ruler: { ...path, tokenId: 'orc' } }, 'page', 'alice')).toBe(false);
    expect(controls.apply({ type: 'ruler', ruler: path }, 'page', 'alice')).toBe(true);
    expect(store.getState().sharedRulers).toEqual({ page: { ...path, color: alice.color } });
    controls.apply({ type: 'ruler', ruler: null }, 'page', 'alice');
    expect(store.getState().sharedRulers).toEqual({});
    controls.apply({ type: 'ruler', ruler: path }, 'page', 'alice');
    controls.playerLeft('page');
    expect(store.getState().sharedRulers).toEqual({});
  });
});

describe('the rulers players are sent', () => {
  test("hold the DM's ruler and the players', whenever one changes, and go to a page that joins", () => {
    const store = sceneStore();
    const toAll = vi.fn();
    const toPlayer = vi.fn();
    const rulers = new PlayerRulers({ toAll, toPlayer });
    rulers.setStore(store);
    expect(toAll).toHaveBeenLastCalledWith('rulers', {});
    store.setState({ localRuler: path });
    expect(toAll).toHaveBeenLastCalledWith('rulers', { [DM_RULER]: path });
    store.getState().setSharedRulers({ page: { ...path, color: alice.color } });
    rulers.sendTo('late');
    expect(toPlayer).toHaveBeenCalledWith('late', 'rulers', { page: { ...path, color: alice.color }, [DM_RULER]: path });
  });
});
