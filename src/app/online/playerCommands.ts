import type { StoreApi } from 'zustand';
import type { GridSystem } from '../grid/GridSystem';
import type { ViewAtlasState } from '../storeFactory';
import { resourceUpdates, tokenHp, tokenStress, type ResourceKind } from '../pixi/token-renderer/tokenResources';
import { isPlayerControlled } from './playerTokens';

/** What a player's page asks the DM's Atlas to do. Positions are world pixels. */
export type PlayerCommand =
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resource'; id: string; kind: ResourceKind; current: number };

/** Accepts only well-formed commands: the body comes from the network. */
export function parsePlayerCommand(value: unknown): PlayerCommand | null {
  if (typeof value !== 'object' || value === null) return null;
  const command = value as Record<string, unknown>;
  const { type, id } = command;
  if (typeof id !== 'string') return null;
  if (type === 'move' && isFiniteNumber(command.x) && isFiniteNumber(command.y)) {
    return { type, id, x: command.x, y: command.y };
  }
  if (type === 'resource' && (command.kind === 'hp' || command.kind === 'stress') && isFiniteNumber(command.current)) {
    return { type, id, kind: command.kind, current: Math.round(command.current) };
  }
  return null;
}

/**
 * Applies `command` to the presented scene when the token is one players control.
 * Moves snap like a DM drag does. Returns whether anything was applied.
 */
export function applyPlayerCommand(store: StoreApi<ViewAtlasState>, grid: GridSystem | null, command: PlayerCommand): boolean {
  const state = store.getState();
  const token = state.objects.tokens[command.id];
  if (!isPlayerControlled(token)) return false;

  if (command.type === 'move') {
    const snap = (state.grid?.snapToGrid ?? true) && grid;
    const position = snap ? grid.snapToCellCenter(command.x, command.y) : { x: command.x, y: command.y };
    state.moveToken(token.id, position.x, position.y);
    return true;
  }

  const shown = command.kind === 'hp' ? tokenHp(token) : tokenStress(token);
  if (!shown) return false;
  const current = Math.min(shown.max, Math.max(0, command.current));
  state.updateToken(token.id, resourceUpdates(token, command.kind, shown, { current, max: shown.max }));
  return true;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
