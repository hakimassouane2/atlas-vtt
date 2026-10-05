import type { StoreApi } from 'zustand';
import type { GridSystem } from '../grid/GridSystem';
import type { ResourceDefinition } from '../resources/resourceTypes';
import type { ViewAtlasState } from '../storeFactory';
import type { Character } from '../types';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import { applyPlayerCommand, parsePlayerCommand } from './playerCommands';
import { isPlayerControlled } from './playerTokens';
import { PlayerHolds } from './playerHolds';

/** Rolls `formula` with the DM's dice engine, for `token` when given; returns whether it rolled. */
export type RollDice = (formula: string, token: Character | undefined) => boolean;

/** The presented scene as players' commands change it: its store, grid and collection rules. */
export interface CommandSource {
  store: StoreApi<ViewAtlasState>;
  grid(): GridSystem | null;
  /** The conditions the scene's collection defines. */
  conditions(): ConditionDefinition[];
  /** The resources the scene's collection gives tokens. */
  resources(): ResourceDefinition[];
}

/**
 * Applies players' commands to the presented scene. Only while the scene is live: while the DM
 * works on another tab, the view's store holds that tab, so commands are refused until the DM
 * presents or returns to it. While a player drags a token, nobody else may drag or drop it.
 */
export class PlayerControls {
  private source: CommandSource | null = null;
  private readonly holds = new PlayerHolds();

  constructor(private readonly rollDice: RollDice) {}

  /** The live scene, or null while it is held or gone. */
  setSource(source: CommandSource | null): void {
    this.source = source;
  }

  /** The map view owning `store` is closing. */
  releaseSource(store: StoreApi<ViewAtlasState>): void {
    if (this.source?.store === store) this.setSource(null);
  }

  /** Applies a command of the player `playerId` (null for a page that has not said who it is). */
  apply(body: unknown, playerId: string | null): boolean {
    const command = parsePlayerCommand(body);
    const source = this.source;
    if (!command || !source || source.store.getState().isMapLoading) return false;
    if (command.type === 'roll') {
      const token = command.id ? source.store.getState().objects.tokens[command.id] : undefined;
      return this.rollDice(command.formula, isPlayerControlled(token) ? token : undefined);
    }
    const isDrag = command.type === 'drag' || command.type === 'move';
    if (isDrag && !this.holds.allows(command.id, playerId)) return false;
    const applied = applyPlayerCommand(source.store, source.grid(), command, {
      conditions: source.conditions(),
      resources: source.resources(),
    });
    if (applied && command.type === 'drag') this.holds.take(command.id, playerId);
    if (applied && command.type === 'move') this.holds.release(command.id);
    return applied;
  }

  /** The player left: tokens they were dragging are free again. */
  playerLeft(playerId: string): void {
    this.holds.releasePlayer(playerId);
  }
}
