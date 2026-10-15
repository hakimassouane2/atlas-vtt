import type { DiceCrit } from '../tools/diceCrit';
import type { RolledDie } from '../tools/diceFormula';
import type { AdvantageSide, RolledWithSet } from './diceSetTypes';
import type { RollLook } from '../dice3d/diceLook';

/** An online player as they were when they rolled; no profile for one who has not chosen one. */
export interface DiceRoller {
  profileId?: string;
  name: string;
  /** `#rrggbb`, the profile's colour. */
  color?: string;
}

/** What a roll records of whoever made it. */
export interface RollStamp {
  /** Unset for the DM's own rolls. */
  roller?: DiceRoller;
  look: RollLook;
  /** Whether players see the roll: their own always, the DM's while the player view shows dice rolls. */
  shownToPlayers: boolean;
}

export interface DiceRollResult {
  id: string;
  timestamp: number;
  formula: string;
  rolls: RolledDie[];
  /** The constants added to the dice; 0 where the formula is no plain sum (`linear`). */
  modifiers: number;
  total: number;
  /** The formula multiplies, divides or counts dice, so its constants are no modifier; unset for a plain sum. */
  linear?: false;
  /** Decided by the collection's critical rule when rolled; missing on rolls logged before rules existed. */
  crit?: DiceCrit;
  /** The dice set a bare bonus rolled with, where it was not the collection's own (a statblock template's). */
  diceSet?: RolledWithSet;
  /** The side of advantage the roll was made with, where the set's rule changed it; the dice it dropped are marked `dropped`. */
  advantage?: AdvantageSide;
  player?: string;
  /** Who rolled, when it was an online player. Unset on the DM's rolls and on rolls logged before. */
  roller?: DiceRoller;
  /** The look the dice are thrown in, whoever watches. Unset on rolls logged before. */
  look?: RollLook;
  /** Whether players were shown the roll. Unset on rolls logged before. */
  shownToPlayers?: boolean;
  source?: {
    type: 'toolbar' | 'statblock';
    /** Let the roll follow its token's or statblock's current artwork. */
    tokenId?: string;
    statblockPath?: string;
    tokenName?: string;
    tokenImagePath?: string;
    abilityName?: string;
  };
}
