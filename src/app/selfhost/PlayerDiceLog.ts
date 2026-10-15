import type { StoreApi } from 'zustand';
import type { ViewAtlasState } from '../storeFactory';
import type { DiceRollResult } from '../tools/DiceTool';
import { diceRollForPlayers } from '../tools/diceRollForPlayers';

interface DiceLogSink {
  toAll(event: 'diceLog', data: DiceRollResult[]): void;
  toPlayer(playerId: string, event: 'diceLog', data: DiceRollResult[]): void;
}

/**
 * The table's dice log as players see it: the followed scene's log (`diceLog`, kept in its file),
 * without the DM's rolls players were not shown and masked like the rolls themselves. Sent whole
 * whenever it changes (a roll, the DM clearing it, another scene), and to every page that joins.
 */
export class PlayerDiceLog {
  private store: StoreApi<ViewAtlasState> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly sink: DiceLogSink,
    /** Told of every roll sent, so the page may load its portrait. */
    private readonly onSent: (roll: DiceRollResult) => void,
  ) {}

  /** Follows the log of `store`; none while no scene is open. */
  setStore(store: StoreApi<ViewAtlasState> | null): void {
    if (store === this.store) return;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store = store;
    if (store) {
      this.unsubscribe = store.subscribe((state, previous) => {
        if (state.diceLog !== previous.diceLog) this.sink.toAll('diceLog', this.entries());
      });
    }
    this.sink.toAll('diceLog', this.entries());
  }

  sendTo(playerId: string): void {
    this.sink.toPlayer(playerId, 'diceLog', this.entries());
  }

  private entries(): DiceRollResult[] {
    const state = this.store?.getState();
    if (!state) return [];
    const entries = state.diceLog.filter((roll) => roll.shownToPlayers).map((roll) => diceRollForPlayers(roll, state.objects.tokens));
    entries.forEach(this.onSent);
    return entries;
  }
}
