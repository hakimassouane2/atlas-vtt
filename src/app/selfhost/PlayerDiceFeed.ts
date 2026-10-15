import type { DiceRollResult, DiceTool } from '../tools/DiceTool';
import { diceRollForPlayers } from '../tools/diceRollForPlayers';
import type { TokenEntity } from '../types';
import type { PlayerProfile } from '../types/collectionSettingsTypes';
import { playerRollStamp } from './rollStamps';
import { onAnyDiceRoll } from '../tools/diceRollFeed';

/**
 * Sends dice rolls to players: the rolls stamped as shown to them (every roll a player
 * makes, and the DM's rolls made while the player view settings show them), masked
 * like in the local player window. Rolls reach it through `onAnyDiceRoll`, which every dice
 * engine announces to; players' rolls go through the DM's engine, so the DM's toasts
 * and dice log show them too. Players' pages show them with the same toasts.
 */
export class PlayerDiceFeed {
  private stopListening: (() => void) | null = null;

  private readonly handleRoll = (result: DiceRollResult): void => {
    if (!result.shownToPlayers) return;
    this.publish(diceRollForPlayers(result, this.getTokens()));
  };

  constructor(
    /** Tokens of the presented scene, to mask rolls made for hidden ones. */
    private readonly getTokens: () => Record<string, TokenEntity> | undefined,
    private readonly publish: (roll: DiceRollResult) => void,
  ) {}

  start(): void {
    this.stopListening?.();
    this.stopListening = onAnyDiceRoll(this.handleRoll);
  }

  stop(): void {
    this.stopListening?.();
    this.stopListening = null;
  }

  /** Rolls a player's `formula` with the DM's `diceTool`, signed with their `profile`, for `token` when given. */
  rollForPlayer(diceTool: DiceTool, formula: string, token: TokenEntity | undefined, profile: PlayerProfile | null): void {
    const tokenName = token?.kind === 'character' ? token.name || token.statblockName : undefined;
    // Atlas' toasts and dice log show the character's name and portrait for statblock rolls
    diceTool.rollDice(formula, {
      type: token ? 'statblock' : 'toolbar',
      ...(token && { tokenId: token.id, tokenImagePath: token.imagePath }),
      ...(tokenName && { tokenName }),
    }, undefined, { stamp: playerRollStamp(profile) });
  }
}
