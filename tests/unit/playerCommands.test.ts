import { describe, expect, test, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GridSystem } from '../../src/app/grid/GridSystem';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import type { Character, TokenEntity } from '../../src/app/types';
import { applyPlayerCommand, isSafeDiceFormula, parsePlayerCommand } from '../../src/app/online/playerCommands';
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
    setTokensCondition: vi.fn(),
    changeTokensConditionValue: vi.fn(),
  })) as unknown as StoreApi<ViewAtlasState>;
}

const grid = { snapToCellCenter: (x: number, y: number) => ({ x: Math.floor(x / 70) * 70 + 35, y: Math.floor(y / 70) * 70 + 35 }) } as unknown as GridSystem;

describe('parsePlayerCommand', () => {
  test('accepts moves and resource changes', () => {
    expect(parsePlayerCommand({ type: 'move', id: 'hero', x: 1, y: 2 })).toEqual({ type: 'move', id: 'hero', x: 1, y: 2 });
    expect(parsePlayerCommand({ type: 'resource', id: 'hero', kind: 'hp', current: 4.6 })).toEqual({ type: 'resource', id: 'hero', kind: 'hp', current: 5 });
  });

  test('accepts dice rolls, for a token or not', () => {
    expect(parsePlayerCommand({ type: 'roll', formula: ' 1d20+5 ', id: 'hero' })).toEqual({ type: 'roll', formula: '1d20+5', id: 'hero' });
    expect(parsePlayerCommand({ type: 'roll', formula: '2d6' })).toEqual({ type: 'roll', formula: '2d6' });
    expect(parsePlayerCommand({ type: 'roll', formula: 'drop table' })).toBeNull();
  });

  test('rejects anything else', () => {
    expect(parsePlayerCommand(null)).toBeNull();
    expect(parsePlayerCommand({ type: 'move', id: 'hero', x: 'far', y: 2 })).toBeNull();
    expect(parsePlayerCommand({ type: 'resource', id: 'hero', kind: 'gold', current: 3 })).toBeNull();
    expect(parsePlayerCommand({ type: 'delete', id: 'hero' })).toBeNull();
  });
});

describe('isSafeDiceFormula', () => {
  test.each(['d20', '1d20+5', '2d6 + 1d8 - 1', '4D6', '100d6'])('accepts %s', (formula) => {
    expect(isSafeDiceFormula(formula)).toBe(true);
  });

  test.each(['', '5', '101d6', '1d0', '1d1001', '1d20*2', '1d20+', 'd20; alert(1)'])('rejects %s', (formula) => {
    expect(isSafeDiceFormula(formula)).toBe(false);
  });
});

describe('applyPlayerCommand', () => {
  test('moves a player token to the centre of the cell it was dropped in', () => {
    const store = sceneStore({ hero });
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'hero', x: 150, y: 80 }, [])).toBe(true);
    expect(store.getState().moveToken).toHaveBeenCalledWith('hero', 175, 105);
  });

  test('keeps the exact drop point when the scene does not snap', () => {
    const store = sceneStore({ hero }, false);
    applyPlayerCommand(store, grid, { type: 'move', id: 'hero', x: 150, y: 80 }, []);
    expect(store.getState().moveToken).toHaveBeenCalledWith('hero', 150, 80);
  });

  test('refuses tokens players do not control', () => {
    const goblin: Character = { ...hero, id: 'goblin', playerLinked: false };
    const hidden: Character = { ...hero, id: 'hidden', isHidden: true };
    const store = sceneStore({ goblin, hidden });
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'goblin', x: 0, y: 0 }, [])).toBe(false);
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'hidden', x: 0, y: 0 }, [])).toBe(false);
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'missing', x: 0, y: 0 }, [])).toBe(false);
    expect(store.getState().moveToken).not.toHaveBeenCalled();
  });

  test('sets hit points within zero and the maximum', () => {
    const store = sceneStore({ hero });
    applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', kind: 'hp', current: 99 }, []);
    expect(store.getState().updateToken).toHaveBeenCalledWith('hero', { hp: { current: 20, max: 20 } });
    applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', kind: 'hp', current: -3 }, []);
    expect(store.getState().updateToken).toHaveBeenLastCalledWith('hero', { hp: { current: 0, max: 20 } });
  });

  test('refuses a resource the token does not have', () => {
    const store = sceneStore({ hero });
    expect(applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', kind: 'stress', current: 2 }, [])).toBe(false);
  });
});

describe('applyPlayerCommand with conditions', () => {
  const poisoned = { id: 'poisoned', name: 'Poisoned', color: '#0f0' };
  const frightened = { id: 'frightened', name: 'Frightened', color: '#f00', valued: true };

  test('puts on and takes off conditions the collection defines', () => {
    const store = sceneStore({ hero });
    expect(applyPlayerCommand(store, grid, { type: 'condition', id: 'hero', conditionId: 'poisoned', active: true }, [poisoned])).toBe(true);
    expect(store.getState().setTokensCondition).toHaveBeenCalledWith(['hero'], 'poisoned', true);
    expect(applyPlayerCommand(store, grid, { type: 'condition', id: 'hero', conditionId: 'invented', active: true }, [poisoned])).toBe(false);
  });

  test('steps the value of an active valued condition only', () => {
    const store = sceneStore({ hero: { ...hero, conditions: ['frightened', 'poisoned'] } });
    expect(applyPlayerCommand(store, grid, { type: 'conditionValue', id: 'hero', conditionId: 'frightened', delta: 1 }, [frightened, poisoned])).toBe(true);
    expect(store.getState().changeTokensConditionValue).toHaveBeenCalledWith(['hero'], 'frightened', 1);
    expect(applyPlayerCommand(store, grid, { type: 'conditionValue', id: 'hero', conditionId: 'poisoned', delta: 1 }, [frightened, poisoned])).toBe(false);
  });

  test('parses condition commands', () => {
    expect(parsePlayerCommand({ type: 'condition', id: 'hero', conditionId: 'poisoned', active: false }))
      .toEqual({ type: 'condition', id: 'hero', conditionId: 'poisoned', active: false });
    expect(parsePlayerCommand({ type: 'conditionValue', id: 'hero', conditionId: 'frightened', delta: 5 })).toBeNull();
  });
});

describe('playerTokens', () => {
  test('lists only the visible tokens players control, with their resources', () => {
    const goblin: Character = { ...hero, id: 'goblin', playerLinked: false };
    const [token, ...others] = playerTokens({ hero, goblin }, 70);
    expect(others).toEqual([]);
    expect(token).toMatchObject({ id: 'hero', name: 'Hero', x: 35, y: 35, hp: { current: 10, max: 20 }, stress: null, conditions: [] });
    expect(token?.radius).toBeGreaterThan(0);
  });
});
