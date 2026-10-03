import type { AtlasSettings } from '../../services/SettingsService';
import type { TokenEntity } from '../../types';
import { isNameplateVisible } from './nameplateVisibility';

export type PlayerTokenUISettings = Pick<AtlasSettings['localPlayerView'], 'showTokenNameplates'>;

/**
 * What players see of one token's UI: a nameplate the DM shows on a token shows for players
 * too. Which resources they see is the collection's choice (`visibleToPlayers`).
 */
export function playerTokenUISettings(token: TokenEntity, settings: PlayerTokenUISettings): PlayerTokenUISettings {
  return { showTokenNameplates: isNameplateVisible(token, settings.showTokenNameplates) };
}
