import { describe, expect, test, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GridSystem } from '../../src/app/grid/GridSystem';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import type { Character, TokenEntity } from '../../src/app/types';
import { applyPlayerCommand, parsePlayerCommand } from '../../src/app/online/playerCommands';
import { playerTokens } from '../../src/app/online/playerTokens';

const hero: Character = {
  id: 'hero', kind: 'character', name: 'Hero', x: 35, y: 35, imagePath: 'hero.png',
  playerLinked: true, hp: { current: 10, max: 20 },
};

function sceneStore(tokens: Record<string, TokenEntity>, snapToGrid = true): StoreApi<ViewAtlasState> {
  return createStore(() => ({
    objects: { tokens },
    grid: { size: 70, snapToGrid },
    isMapLoading: false,
    moveToken: vi.fn(),
    updateToken: vi.fn(),
  })) as unknown as StoreApi<ViewAtlasState>;
}

const grid = { snapToCellCenter: (x: number, y: number) => ({ x: Math.floor(x / 70) * 70 + 35, y: Math.floor(y / 70) * 70 + 35 }) } as unknown as GridSystem;

describe('parsePlayerCommand', () => {
  test('accepts moves and resource changes', () => {
    expect(parsePlayerCommand({ type: 'move', id: 'hero', x: 1, y: 2 })).toEqual({ type: 'move', id: 'hero', x: 1, y: 2 });
    expect(parsePlayerCommand({ type: 'resource', id: 'hero', kind: 'hp', current: 4.6 })).toEqual({ type: 'resource', id: 'hero', kind: 'hp', current: 5 });
  });

  test('rejects anything else', () => {
    expect(parsePlayerCommand(null)).toBeNull();
    expect(parsePlayerCommand({ type: 'move', id: 'hero', x: 'far', y: 2 })).toBeNull();
    expect(parsePlayerCommand({ type: 'resource', id: 'hero', kind: 'gold', current: 3 })).toBeNull();
    expect(parsePlayerCommand({ type: 'delete', id: 'hero' })).toBeNull();
  });
});

describe('applyPlayerCommand', () => {
  test('moves a player token to the centre of the cell it was dropped in', () => {
    const store = sceneStore({ hero });
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'hero', x: 150, y: 80 })).toBe(true);
    expect(store.getState().moveToken).toHaveBeenCalledWith('hero', 175, 105);
  });

  test('keeps the exact drop point when the scene does not snap', () => {
    const store = sceneStore({ hero }, false);
    applyPlayerCommand(store, grid, { type: 'move', id: 'hero', x: 150, y: 80 });
    expect(store.getState().moveToken).toHaveBeenCalledWith('hero', 150, 80);
  });

  test('refuses tokens players do not control', () => {
    const goblin: Character = { ...hero, id: 'goblin', playerLinked: false };
    const hidden: Character = { ...hero, id: 'hidden', isHidden: true };
    const store = sceneStore({ goblin, hidden });
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'goblin', x: 0, y: 0 })).toBe(false);
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'hidden', x: 0, y: 0 })).toBe(false);
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'missing', x: 0, y: 0 })).toBe(false);
    expect(store.getState().moveToken).not.toHaveBeenCalled();
  });

  test('sets hit points within zero and the maximum', () => {
    const store = sceneStore({ hero });
    applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', kind: 'hp', current: 99 });
    expect(store.getState().updateToken).toHaveBeenCalledWith('hero', { hp: { current: 20, max: 20 } });
    applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', kind: 'hp', current: -3 });
    expect(store.getState().updateToken).toHaveBeenLastCalledWith('hero', { hp: { current: 0, max: 20 } });
  });

  test('refuses a resource the token does not have', () => {
    const store = sceneStore({ hero });
    expect(applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', kind: 'stress', current: 2 })).toBe(false);
  });
});

describe('playerTokens', () => {
  test('lists only the visible tokens players control, with their resources', () => {
    const goblin: Character = { ...hero, id: 'goblin', playerLinked: false };
    const [token, ...others] = playerTokens({ hero, goblin }, 70);
    expect(others).toEqual([]);
    expect(token).toMatchObject({ id: 'hero', name: 'Hero', x: 35, y: 35, hp: { current: 10, max: 20 }, stress: null });
    expect(token?.radius).toBeGreaterThan(0);
  });
});
