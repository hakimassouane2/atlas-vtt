import type { TokenEntity } from '../types';
import { controllersOf } from '../players/playerProfiles';

/**
 * Whether the online player who chose `profileId` acts on `token`: the DM gave the token to that
 * profile, and it is visible. A page that chose no profile acts on none.
 */
export function isPlayerControlled(token: TokenEntity | undefined, profileId: string | null): token is TokenEntity {
  return !!token && !!profileId && !token.isHidden && controllersOf(token).includes(profileId);
}
