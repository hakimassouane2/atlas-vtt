import { describe, expect, test, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GridSystem } from '../../src/app/grid/GridSystem';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import type { Character, TokenEntity } from '../../src/app/types';
import { applyPlayerCommand, isSafeDiceFormula, parsePlayerCommand } from '../../src/app/online/playerCommands';
import { playerTokens } from '../../src/app/online/playerTokens';
import { HP_RESOURCE, STRESS_RESOURCE } from '../../src/app/resources/resourceDefinitions';

const hero: Character = {
  id: 'hero', kind: 'character', name: 'Hero', x: 35, y: 35, imagePath: 'hero.png',
  playerLinked: true, resources: { hp: { current: 10, max: 20 }, stress: { current: 1, max: 6 } },
};

/** HP is shown to players, stress is not. */
const rules = { conditions: [], resources: [{ ...HP_RESOURCE, visibleToPlayers: true }, STRESS_RESOURCE] };

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
    expect(parsePlayerCommand({ type: 'resource', id: 'hero', key: 'hp', current: 4.6 })).toEqual({ type: 'resource', id: 'hero', key: 'hp', current: 5 });
  });

  test('accepts dice rolls, for a token or not', () => {
    expect(parsePlayerCommand({ type: 'roll', formula: ' 1d20+5 ', id: 'hero' })).toEqual({ type: 'roll', formula: '1d20+5', id: 'hero' });
    expect(parsePlayerCommand({ type: 'roll', formula: '2d6' })).toEqual({ type: 'roll', formula: '2d6' });
    expect(parsePlayerCommand({ type: 'roll', formula: 'drop table' })).toBeNull();
  });

  test('rejects anything else', () => {
    expect(parsePlayerCommand(null)).toBeNull();
    expect(parsePlayerCommand({ type: 'move', id: 'hero', x: 'far', y: 2 })).toBeNull();
    expect(parsePlayerCommand({ type: 'resource', id: 'hero', key: 7, current: 3 })).toBeNull();
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
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'hero', x: 150, y: 80 }, rules)).toBe(true);
    expect(store.getState().moveToken).toHaveBeenCalledWith('hero', 175, 105);
  });

  test('keeps the exact drop point when the scene does not snap', () => {
    const store = sceneStore({ hero }, false);
    applyPlayerCommand(store, grid, { type: 'move', id: 'hero', x: 150, y: 80 }, rules);
    expect(store.getState().moveToken).toHaveBeenCalledWith('hero', 150, 80);
  });

  test('refuses tokens players do not control', () => {
    const goblin: Character = { ...hero, id: 'goblin', playerLinked: false };
    const hidden: Character = { ...hero, id: 'hidden', isHidden: true };
    const store = sceneStore({ goblin, hidden });
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'goblin', x: 0, y: 0 }, rules)).toBe(false);
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'hidden', x: 0, y: 0 }, rules)).toBe(false);
    expect(applyPlayerCommand(store, grid, { type: 'move', id: 'missing', x: 0, y: 0 }, rules)).toBe(false);
    expect(store.getState().moveToken).not.toHaveBeenCalled();
  });

  test('sets hit points within zero and the maximum', () => {
    const store = sceneStore({ hero });
    applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', key: 'hp', current: 99 }, rules);
    expect(store.getState().updateToken).toHaveBeenCalledWith('hero', { resources: { ...hero.resources, hp: { current: 20, max: 20 } } });
    applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', key: 'hp', current: -3 }, rules);
    expect(store.getState().updateToken).toHaveBeenLastCalledWith('hero', { resources: { ...hero.resources, hp: { current: 0, max: 20 } } });
  });

  test('refuses a resource the collection hides from players or the token does not have', () => {
    const store = sceneStore({ hero });
    expect(applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', key: 'stress', current: 2 }, rules)).toBe(false);
    expect(applyPlayerCommand(store, grid, { type: 'resource', id: 'hero', key: 'mana', current: 2 }, rules)).toBe(false);
    expect(store.getState().updateToken).not.toHaveBeenCalled();
  });
});

describe('applyPlayerCommand with conditions', () => {
  const poisoned = { id: 'poisoned', name: 'Poisoned', color: '#0f0' };
  const frightened = { id: 'frightened', name: 'Frightened', color: '#f00', valued: true };

  test('puts on and takes off conditions the collection defines', () => {
    const store = sceneStore({ hero });
    expect(applyPlayerCommand(store, grid, { type: 'condition', id: 'hero', conditionId: 'poisoned', active: true }, { ...rules, conditions: [poisoned] })).toBe(true);
    expect(store.getState().setTokensCondition).toHaveBeenCalledWith(['hero'], 'poisoned', true);
    expect(applyPlayerCommand(store, grid, { type: 'condition', id: 'hero', conditionId: 'invented', active: true }, { ...rules, conditions: [poisoned] })).toBe(false);
  });

  test('steps the value of an active valued condition only', () => {
    const store = sceneStore({ hero: { ...hero, conditions: ['frightened', 'poisoned'] } });
    expect(applyPlayerCommand(store, grid, { type: 'conditionValue', id: 'hero', conditionId: 'frightened', delta: 1 }, { ...rules, conditions: [frightened, poisoned] })).toBe(true);
    expect(store.getState().changeTokensConditionValue).toHaveBeenCalledWith(['hero'], 'frightened', 1);
    expect(applyPlayerCommand(store, grid, { type: 'conditionValue', id: 'hero', conditionId: 'poisoned', delta: 1 }, { ...rules, conditions: [frightened, poisoned] })).toBe(false);
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
    const [token, ...others] = playerTokens({ hero, goblin }, 70, rules.resources);
    expect(others).toEqual([]);
    expect(token).toMatchObject({
      id: 'hero', name: 'Hero', x: 35, y: 35, conditions: [],
      resources: [{ key: 'hp', name: 'HP', value: { current: 10, max: 20 } }],
    });
    expect(token?.radius).toBeGreaterThan(0);
  });
});

describe('dragging and turning a token', () => {
  test('parses drags and turns, a turn kept within a full circle', () => {
    expect(parsePlayerCommand({ type: 'drag', id: 'hero', x: 1, y: 2 })).toEqual({ type: 'drag', id: 'hero', x: 1, y: 2 });
    expect(parsePlayerCommand({ type: 'rotate', id: 'hero', rotation: -45 })).toEqual({ type: 'rotate', id: 'hero', rotation: 315 });
    expect(parsePlayerCommand({ type: 'rotate', id: 'hero', rotation: 'north' })).toBeNull();
  });

  test('shows a drag where the pointer is, unsnapped, and turns the token', () => {
    const store = sceneStore({ hero });
    const setTokenPositions = vi.fn();
    store.setState({ setTokenPositions } as never);
    expect(applyPlayerCommand(store, grid, { type: 'drag', id: 'hero', x: 100, y: 101 }, rules)).toBe(true);
    expect(setTokenPositions).toHaveBeenCalledWith([{ id: 'hero', x: 100, y: 101 }]);
    expect(applyPlayerCommand(store, grid, { type: 'rotate', id: 'hero', rotation: 90 }, rules)).toBe(true);
    expect(store.getState().updateToken).toHaveBeenCalledWith('hero', { rotation: 90 });
  });
});

describe('player commands and the DM undo history', () => {
  test('a player command is no step the DM can undo', async () => {
    const { createSceneStore } = await import('../../src/app/storeFactory');
    const { getHistoryStore } = await import('../../src/app/stores/history');
    const store = createSceneStore(`player-undo-${Math.random()}`);
    store.getState().setPersistenceEnabled(false);
    store.setState({ objects: { ...store.getState().objects, tokens: { hero } } });
    const steps = getHistoryStore(store)!.getState().pastStates.length;
    applyPlayerCommand(store, grid, { type: 'move', id: 'hero', x: 200, y: 200 }, rules);
    expect(store.getState().objects.tokens.hero).toMatchObject({ x: 175, y: 175 });
    expect(getHistoryStore(store)!.getState().pastStates.length).toBe(steps);
  });
});
