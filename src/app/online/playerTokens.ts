import type { Character, TokenEntity } from '../types';
import type { ResourceValue } from '../pixi/tokenValueEditor';
import { computeTokenPixelSize } from '../pixi/token-renderer/tokenSizing';
import { tokenHp, tokenStress } from '../pixi/token-renderer/tokenResources';
import { conditionValue } from '../utils/conditionValues';

/** A token players may move, as their page receives it. Positions are world pixels. */
export interface PlayerToken {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  hp: ResourceValue | null;
  stress: ResourceValue | null;
  /** Active conditions with their number (1 for conditions without one). */
  conditions: Array<{ id: string; value: number }>;
}

/** Players control tokens the DM marked "Controlled by players", while they are visible. */
export function isPlayerControlled(token: TokenEntity | undefined): token is Character {
  return !!token && token.kind === 'character' && token.playerLinked === true && !token.isHidden;
}

export function playerTokens(tokens: Record<string, TokenEntity>, gridSize: number): PlayerToken[] {
  return Object.values(tokens).filter(isPlayerControlled).map((token) => ({
    id: token.id,
    name: token.name || token.statblockName || 'Token',
    x: token.x,
    y: token.y,
    radius: computeTokenPixelSize(gridSize, token.size ?? 1) / 2,
    hp: tokenHp(token),
    stress: tokenStress(token),
    conditions: (token.conditions ?? []).map((id) => ({ id, value: conditionValue(token, id) })),
  }));
}
