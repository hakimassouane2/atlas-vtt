import { DEFAULT_DICE_LOOK, type DiceLook } from '../../dice3d/diceLook';
import type { DiceDisplay } from '../../dice3d/diceDisplay';

/** The settings Atlas' dice display reads on the page: rolls on result cards, in the default look. */
const pageSettings = {
  getDiceDisplay: (): DiceDisplay => 'card',
  getDiceLook: (): DiceLook => ({ ...DEFAULT_DICE_LOOK }),
  onChange: (): (() => void) => () => undefined,
};

/**
 * Stands in for `SettingsService` in the player page's bundle (see `vite/player-client.mts`):
 * the page has no vault settings, and shows no thrown 3D dice in players' browsers.
 */
export class SettingsService {
  static forApp(): typeof pageSettings {
    return pageSettings;
  }
}
