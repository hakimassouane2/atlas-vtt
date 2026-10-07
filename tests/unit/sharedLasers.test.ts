import { describe, expect, test, vi } from 'vitest';
import { createSceneStore, type ViewAtlasState } from '../../src/app/storeFactory';
import type { StoreApi } from 'zustand';
import { readLaserPiece, type LaserPiece } from '../../src/app/canvas/sharedLasers';
import { parsePlayerCommand } from '../../src/app/online/playerCommands';
import { PlayerControls, type CommandSource } from '../../src/app/online/PlayerControls';
import { DM_LASER, PlayerLasers } from '../../src/app/online/PlayerLasers';
import { CommandBridge } from '../../src/app/online/client/commandBridge';
import { LaserPublisher } from '../../src/app/pixi/laser/LaserPublisher';
import { DEFAULT_LASER_POINTER_SETTINGS, LASER_FADE_TIME } from '../../src/app/tools/laserPointerSettings';
import type { PlayerProfile } from '../../src/app/types/collectionSettingsTypes';

const alice: PlayerProfile = { id: 'alice', name: 'Alice', color: '#3b82f6' };
const piece: LaserPiece = { points: [{ x: 10, y: 20, age: 5 }], pressing: true };
const aliceLaser = { ...piece, color: alice.color, size: DEFAULT_LASER_POINTER_SETTINGS.size, name: 'Alice' };

function sceneStore(): StoreApi<ViewAtlasState> {
  const store = createSceneStore(`lasers-${Math.random()}`);
  store.getState().setPersistenceEnabled(false);
  return store;
}

function source(store: StoreApi<ViewAtlasState>): CommandSource {
  return { store, grid: () => null, conditions: () => [], resources: () => [], players: () => [alice], updateProfile: vi.fn() };
}

describe('laser pieces from the network', () => {
  test('a piece is finite points and whether it is pressed; ages stay within the fade', () => {
    expect(readLaserPiece(piece)).toEqual(piece);
    expect(readLaserPiece({ points: [{ x: 0, y: 0, age: -4 }, { x: 1, y: 1, age: 1e9 }], pressing: false }))
      .toEqual({ points: [{ x: 0, y: 0, age: 0 }, { x: 1, y: 1, age: LASER_FADE_TIME }], pressing: false });
    expect(readLaserPiece({ points: [{ x: NaN, y: 0, age: 0 }], pressing: true })).toBeUndefined();
    expect(readLaserPiece({ points: [], pressing: 'yes' })).toBeUndefined();
    expect(readLaserPiece({ points: Array.from({ length: 65 }, () => ({ x: 0, y: 0, age: 0 })), pressing: true })).toBeUndefined();
    expect(parsePlayerCommand({ type: 'laser', piece })).toEqual({ type: 'laser', piece });
    expect(parsePlayerCommand({ type: 'laser', piece: null })).toBeNull();
  });
});

describe("a player's laser", () => {
  test('shows on the DM map in their colour and name once they chose who they play, and goes when they leave', () => {
    const store = sceneStore();
    const controls = new PlayerControls(() => true);
    controls.setSource(source(store));
    expect(controls.apply({ type: 'laser', piece }, 'page', null)).toBe(false);
    expect(store.getState().sharedLasers).toEqual({});
    expect(controls.apply({ type: 'laser', piece }, 'page', 'alice')).toBe(true);
    expect(store.getState().sharedLasers).toEqual({ page: aliceLaser });
    controls.playerLeft('page');
    expect(store.getState().sharedLasers).toEqual({});
  });
});

describe('the lasers players are sent', () => {
  test("relay the DM's laser in the DM's colour and size, each new piece of a player's, and a player who left as null", () => {
    const store = sceneStore();
    const toAll = vi.fn();
    const lasers = new PlayerLasers({ toAll }, () => ({ color: '#00a9ff', size: 30 }));
    lasers.setStore(store);
    store.getState().setLocalLaser(piece);
    expect(toAll).toHaveBeenLastCalledWith('lasers', { [DM_LASER]: { ...piece, color: '#00a9ff', size: 30 } });
    store.getState().setSharedLasers({ page: aliceLaser });
    expect(toAll).toHaveBeenLastCalledWith('lasers', { page: aliceLaser });
    store.getState().setSharedLasers({ page: null });
    expect(toAll).toHaveBeenLastCalledWith('lasers', { page: null });
    toAll.mockClear();
    store.getState().setSelection([]);
    expect(toAll).not.toHaveBeenCalled();
  });
});

describe("the page's laser", () => {
  test('goes to the DM as pieces, and a refused piece puts nothing back', async () => {
    const store = sceneStore();
    const send = vi.fn(async () => false);
    const resync = vi.fn();
    new CommandBridge(store, () => false, send, resync);
    store.getState().setLocalLaser(piece);
    expect(send).toHaveBeenCalledWith({ type: 'laser', piece });
    await Promise.resolve();
    expect(resync).not.toHaveBeenCalled();
  });
});

describe('LaserPublisher', () => {
  test('sends at most one piece per interval while pressed, and what is left at once on release', () => {
    const publish = vi.fn();
    const publisher = new LaserPublisher(publish);
    publisher.setPressing(true, 0);
    publisher.add({ x: 1, y: 1, timestamp: 0 });
    publisher.flush(0);
    expect(publish).toHaveBeenLastCalledWith({ points: [{ x: 1, y: 1, age: 0 }], pressing: true });
    publisher.add({ x: 2, y: 2, timestamp: 10 });
    publisher.flush(20);
    expect(publish).toHaveBeenCalledTimes(1);
    publisher.add({ x: 3, y: 3, timestamp: 30 });
    publisher.flush(40);
    expect(publish).toHaveBeenLastCalledWith({ points: [{ x: 2, y: 2, age: 30 }, { x: 3, y: 3, age: 10 }], pressing: true });
    publisher.flush(100);
    expect(publish).toHaveBeenCalledTimes(2);
    publisher.add({ x: 4, y: 4, timestamp: 101 });
    publisher.setPressing(false, 102);
    expect(publish).toHaveBeenLastCalledWith({ points: [{ x: 4, y: 4, age: 1 }], pressing: false });
  });
});
