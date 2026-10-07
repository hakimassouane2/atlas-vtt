import type { DiceRollResult } from './DiceTool';

/** Who a roll is shown as made by: a name, and the player's colour when a player rolled it. */
export interface RollAuthor {
  name: string;
  color?: string;
}

/**
 * The character a roll was made for when it names one (a statblock or a player's token), else the
 * player who rolled it, else the DM. Rolls logged before rolls were signed name nobody.
 */
export function rollAuthor(result: DiceRollResult): RollAuthor | null {
  const color = result.roller?.color;
  const tokenName = result.source?.type === 'statblock' ? result.source.tokenName : undefined;
  if (tokenName) return color ? { name: tokenName, color } : { name: tokenName };
  if (result.roller) return color ? { name: result.roller.name, color } : { name: result.roller.name };
  return result.shownToPlayers === undefined ? null : { name: 'GM' };
}
