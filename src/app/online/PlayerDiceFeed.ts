import type { SettingsService } from '../services/SettingsService';
import type { DiceRollResult, DiceTool } from '../tools/DiceTool';
import { diceRollForPlayers } from '../tools/diceRollForPlayers';
import type { TokenEntity } from '../types';

/**
 * Sends dice rolls to players: every roll a player makes, and the DM's rolls while
 * the player view settings show them (`showDiceRolls`), masked like in the local
 * player window. Rolls reach it through the `atlas-dice-rolled` event every dice
 * engine dispatches; players' rolls go through the DM's engine, so the DM's toasts
 * and dice log show them too. Players' pages show them with the same toasts.
 */
export class PlayerDiceFeed {
  /** Set while a player's roll is dispatched, so the event handler knows who rolled. */
  private isRollingForPlayer = false;
  private readonly handleRoll = (event: Event): void => {
    const result = (event as CustomEvent<DiceRollResult>).detail;
    if (!this.isRollingForPlayer && !this.settingsService.getLocalPlayerViewSettings().showDiceRolls) return;
    this.publish(diceRollForPlayers(result, this.getTokens()));
  };

  constructor(
    private readonly settingsService: SettingsService,
    /** Tokens of the presented scene, to mask rolls made for hidden ones. */
    private readonly getTokens: () => Record<string, TokenEntity> | undefined,
    private readonly publish: (roll: DiceRollResult) => void,
  ) {}

  start(): void {
    document.addEventListener('atlas-dice-rolled', this.handleRoll);
  }

  stop(): void {
    document.removeEventListener('atlas-dice-rolled', this.handleRoll);
  }

  /** Rolls a player's `formula` with the DM's `diceTool`, for `token` when given. */
  rollForPlayer(diceTool: DiceTool, formula: string, token: TokenEntity | undefined): void {
    const tokenName = token?.kind === 'character' ? token.name || token.statblockName : undefined;
    this.isRollingForPlayer = true;
    try {
      // Atlas' toasts and dice log show who rolled (name and portrait) for statblock rolls
      diceTool.rollDice(formula, {
        type: token ? 'statblock' : 'toolbar',
        ...(token && { tokenId: token.id, tokenImagePath: token.imagePath }),
        ...(tokenName && { tokenName }),
      });
    } finally {
      this.isRollingForPlayer = false;
    }
  }
}
