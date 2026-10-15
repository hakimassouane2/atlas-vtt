import type { DiceRollResult } from '../types/diceTypes';

type RollListener = (result: DiceRollResult) => void;

const listeners = new Set<RollListener>();

/**
 * Every roll of every view's dice tool, for what follows the whole table rather than one
 * view: the online session's feed to the players' pages (`PlayerDiceFeed`). A view's own
 * displays, log and sounds listen on its event bus instead.
 */
export function onAnyDiceRoll(listener: RollListener): () => void {
  listeners.add(listener);
  return (): void => { listeners.delete(listener); };
}

/** Announces a roll a dice tool made. */
export function announceDiceRoll(result: DiceRollResult): void {
  for (const listener of listeners) listener(result);
}
