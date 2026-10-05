import { createContext, useContext } from 'react';
import type { DiceDisplay } from '../../../dice3d/diceDisplay';
import type { DiceLook } from '../../../dice3d/diceLook';

/** Where the dice read how rolls show and look: Atlas' settings. */
export interface DiceSettingsSource {
  getDiceDisplay(): DiceDisplay;
  getDiceLook(): DiceLook;
  /** Calls `listener` when the settings change; returns what stops it. */
  onChange(listener: () => void): () => void;
}

/** A picture for a roll's avatar, as the window showing rolls loads it. */
export interface DiceArt {
  /** The URL the image loads from; null for a path that names no image. */
  src(imagePath: string): string | null;
  /** The artwork of the token linked to the statblock at `statblockPath`, if any. */
  statblockImage(statblockPath: string): string | null;
  /** Whether the library token drawn with the image at `imagePath` shows a ring. */
  libraryShowsRing(imagePath: string): boolean;
}

/**
 * What dice rolls read from the application around them: the DM's Obsidian, or a player's page.
 * Without it rolls show as Atlas' defaults show them, without avatars.
 */
export interface DiceEnvironment {
  settings: DiceSettingsSource | undefined;
  art: DiceArt | undefined;
}

const NONE: DiceEnvironment = { settings: undefined, art: undefined };

export const DiceEnvironmentContext = createContext<DiceEnvironment>(NONE);

export function useDiceEnvironment(): DiceEnvironment {
  return useContext(DiceEnvironmentContext);
}
