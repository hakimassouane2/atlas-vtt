import type { TokenEntity } from '../types';
import type { DiceRollResult } from './DiceTool';

/**
 * A roll as players see it. A roll made for a token hidden on the map keeps its
 * ability and result but not the token's name or portrait, so it does not give the token away.
 */
export function diceRollForPlayers(result: DiceRollResult, tokens: Record<string, TokenEntity> | undefined): DiceRollResult {
  const source = result.source;
  const tokenId = source?.tokenId;
  if (!source || !tokenId || !tokens?.[tokenId]?.isHidden) return result;
  const { type, abilityName } = source;
  return { ...result, source: abilityName ? { type, abilityName } : { type } };
}
