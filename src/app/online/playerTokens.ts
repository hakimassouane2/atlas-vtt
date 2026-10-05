import type { Character, TokenEntity } from '../types';

/** Players control tokens the DM marked "Controlled by players", while they are visible. */
export function isPlayerControlled(token: TokenEntity | undefined): token is Character {
  return !!token && token.kind === 'character' && token.playerLinked === true && !token.isHidden;
}
