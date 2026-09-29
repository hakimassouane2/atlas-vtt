import type { AtlasSettings } from '../../services/SettingsService';
import type { TokenEntity } from '../../types';
import { isNameplateVisible } from './nameplateVisibility';

export type PlayerTokenUISettings = Pick<AtlasSettings['localPlayerView'], 'showTokenHP' | 'showTokenStress' | 'showTokenNameplates'>;

/**
 * What players see of one token's UI. Tokens players control always show their bars,
 * so players see their own hit points as the DM does; the player view settings decide
 * for every other token. A nameplate the DM shows on a token shows for players too.
 */
export function playerTokenUISettings(token: TokenEntity, settings: PlayerTokenUISettings): PlayerTokenUISettings {
  const isPlayers = token.kind === 'character' && token.playerLinked === true;
  return {
    showTokenHP: isPlayers || settings.showTokenHP,
    showTokenStress: isPlayers || settings.showTokenStress,
    showTokenNameplates: isNameplateVisible(token, settings.showTokenNameplates),
  };
}
