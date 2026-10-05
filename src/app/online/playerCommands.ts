import type { StoreApi } from 'zustand';
import type { GridSystem } from '../grid/GridSystem';
import type { ViewAtlasState } from '../storeFactory';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { ResourceDefinition } from '../resources/resourceTypes';
import { resourceUpdate, withCurrent } from '../resources/resourceValues';
import { visibleResources } from '../resources/visibleResources';
import { isPlayerControlled } from './playerTokens';
import { runUntracked } from '../stores/history';

/** Dice a player may roll at once, and the largest die: the dice engine rolls each die one by one. */
const MAX_DICE = 100;
const MAX_SIDES = 1000;
/** Dice terms and flat modifiers joined by + or -, e.g. `1d20+5` or `2d6 + 1d8 - 1`. */
const DICE_FORMULA = /^\s*(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*\s*$/i;

/** What a player's page asks the DM's Atlas to do. Positions are world pixels. */
export type PlayerCommand =
  /** Drops the token there, on its grid cell as a DM's drop does. */
  | { type: 'move'; id: string; x: number; y: number }
  /** Where a token the player drags is now, for everyone to see it move; the drop is a `move`. */
  | { type: 'drag'; id: string; x: number; y: number }
  /** Turns the token to `rotation` degrees, as the rotation handle does. */
  | { type: 'rotate'; id: string; rotation: number }
  /** Sets the current value of the resource `key`, one the collection shows players. */
  | { type: 'resource'; id: string; key: string; current: number }
  /** Rolled by the DM's dice engine, for the token `id` when given. */
  | { type: 'roll'; formula: string; id?: string }
  | { type: 'condition'; id: string; conditionId: string; active: boolean }
  /** Steps a valued condition by one; stepping below 1 removes it. */
  | { type: 'conditionValue'; id: string; conditionId: string; delta: 1 | -1 };

/** Accepts only well-formed commands: the body comes from the network. */
export function parsePlayerCommand(value: unknown): PlayerCommand | null {
  if (typeof value !== 'object' || value === null) return null;
  const command = value as Record<string, unknown>;
  const { type, id } = command;
  if (type === 'roll' && typeof command.formula === 'string' && isSafeDiceFormula(command.formula)) {
    return { type, formula: command.formula.trim(), ...(typeof id === 'string' && { id }) };
  }
  if (typeof id !== 'string') return null;
  if ((type === 'move' || type === 'drag') && isFiniteNumber(command.x) && isFiniteNumber(command.y)) {
    return { type, id, x: command.x, y: command.y };
  }
  if (type === 'rotate' && isFiniteNumber(command.rotation)) {
    return { type, id, rotation: ((command.rotation % 360) + 360) % 360 };
  }
  if (type === 'resource' && typeof command.key === 'string' && isFiniteNumber(command.current)) {
    return { type, id, key: command.key, current: Math.round(command.current) };
  }
  const { conditionId } = command;
  if (type === 'condition' && typeof conditionId === 'string' && typeof command.active === 'boolean') {
    return { type, id, conditionId, active: command.active };
  }
  if (type === 'conditionValue' && typeof conditionId === 'string' && (command.delta === 1 || command.delta === -1)) {
    return { type, id, conditionId, delta: command.delta };
  }
  return null;
}

/** A formula the dice engine rolls quickly: plain dice and modifiers, a sane number of them. */
export function isSafeDiceFormula(formula: string): boolean {
  if (formula.length > 60 || !DICE_FORMULA.test(formula)) return false;
  const dice = [...formula.matchAll(/(\d*)d(\d+)/gi)];
  const count = dice.reduce((total, [, number]) => total + (number ? Number(number) : 1), 0);
  return dice.length > 0 && count <= MAX_DICE && dice.every(([, , sides]) => Number(sides) >= 1 && Number(sides) <= MAX_SIDES);
}

/** What the scene's collection lets players change on their tokens. */
export interface PlayerRules {
  conditions: readonly ConditionDefinition[];
  resources: readonly ResourceDefinition[];
}

/**
 * Applies `command` to the presented scene when the token is one players control and
 * the scene's collection defines the condition, or shows the resource to players.
 * Drops snap like a DM drag does. What players change is no step of the DM's undo history,
 * so the DM never undoes it by undoing their own edit. Returns whether anything was applied.
 */
export function applyPlayerCommand(
  store: StoreApi<ViewAtlasState>,
  grid: GridSystem | null,
  command: Exclude<PlayerCommand, { type: 'roll' }>,
  rules: PlayerRules,
): boolean {
  return runUntracked(store, () => applyToToken(store, grid, command, rules));
}

function applyToToken(
  store: StoreApi<ViewAtlasState>,
  grid: GridSystem | null,
  command: Exclude<PlayerCommand, { type: 'roll' }>,
  { conditions, resources }: PlayerRules,
): boolean {
  const state = store.getState();
  const token = state.objects.tokens[command.id];
  if (!isPlayerControlled(token)) return false;

  if (command.type === 'drag') {
    state.setTokenPositions([{ id: token.id, x: command.x, y: command.y }]);
    return true;
  }

  if (command.type === 'rotate') {
    state.updateToken(token.id, { rotation: command.rotation });
    return true;
  }

  if (command.type === 'move') {
    const snap = (state.grid?.snapToGrid ?? true) && grid;
    const position = snap ? grid.snapToCellCenter(command.x, command.y) : { x: command.x, y: command.y };
    state.moveToken(token.id, position.x, position.y);
    return true;
  }

  if (command.type === 'condition' || command.type === 'conditionValue') {
    const condition = conditions.find((definition) => definition.id === command.conditionId);
    if (!condition) return false;
    if (command.type === 'condition') {
      state.setTokensCondition([token.id], condition.id, command.active);
    } else {
      if (!condition.valued || !token.conditions?.includes(condition.id)) return false;
      state.changeTokensConditionValue([token.id], condition.id, command.delta);
    }
    return true;
  }

  const shown = visibleResources(token, resources, 'player').find(({ definition }) => definition.key === command.key);
  if (!shown) return false;
  state.updateToken(token.id, resourceUpdate(token, command.key, withCurrent(shown.value, command.current), false));
  return true;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
