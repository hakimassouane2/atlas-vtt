import type { SettingsService } from '../services/SettingsService';
import type { DiceRollResult, DiceTool } from '../tools/DiceTool';
import { diceRollForPlayers } from '../tools/diceRollForPlayers';
import type { Character, TokenEntity } from '../types';

/** A roll as players' pages receive it. The portrait comes from `/image?token=`. */
export interface PlayerRoll {
  id: string;
  formula: string;
  total: number;
  rolls: Array<{ die: string; value: number }>;
  modifiers: number;
  /** Who rolled: the token's name, the ability, or neither for a hidden token. */
  label: string | null;
  tokenId: string | null;
  /** Rolled by a player from their page, rather than by the DM. */
  byPlayer: boolean;
}

/**
 * Sends dice rolls to players: every roll a player makes, and the DM's rolls while
 * the player view settings show them (`showDiceRolls`), masked like in the local
 * player window. Rolls reach it through the `atlas-dice-rolled` event every dice
 * engine dispatches; players' rolls go through the DM's engine, so the DM's toasts
 * and dice log show them too.
 */
export class PlayerDiceFeed {
  /** Set while a player's roll is dispatched, so the event handler knows who rolled. */
  private isRollingForPlayer = false;
  private readonly handleRoll = (event: Event): void => {
    const result = (event as CustomEvent<DiceRollResult>).detail;
    if (!this.isRollingForPlayer && !this.settingsService.getLocalPlayerViewSettings().showDiceRolls) return;
    this.publish(toPlayerRoll(diceRollForPlayers(result, this.getTokens()), this.isRollingForPlayer));
  };

  constructor(
    private readonly settingsService: SettingsService,
    /** Tokens of the presented scene, to mask rolls made for hidden ones. */
    private readonly getTokens: () => Record<string, TokenEntity> | undefined,
    private readonly publish: (roll: PlayerRoll) => void,
  ) {}

  start(): void {
    document.addEventListener('atlas-dice-rolled', this.handleRoll);
  }

  stop(): void {
    document.removeEventListener('atlas-dice-rolled', this.handleRoll);
  }

  /** Rolls a player's `formula` with the DM's `diceTool`, for `token` when given. */
  rollForPlayer(diceTool: DiceTool, formula: string, token: Character | undefined): void {
    const tokenName = token && (token.name || token.statblockName);
    this.isRollingForPlayer = true;
    try {
      diceTool.rollDice(formula, {
        type: 'toolbar',
        ...(token && { tokenId: token.id, tokenImagePath: token.imagePath }),
        ...(tokenName && { tokenName }),
      });
    } finally {
      this.isRollingForPlayer = false;
    }
  }
}

function toPlayerRoll(result: DiceRollResult, byPlayer: boolean): PlayerRoll {
  const source = result.source;
  return {
    id: result.id,
    formula: result.formula,
    total: result.total,
    rolls: result.rolls.map(({ die, value }) => ({ die, value })),
    modifiers: result.modifiers,
    label: source?.tokenName ?? source?.abilityName ?? null,
    tokenId: source?.tokenId ?? null,
    byPlayer,
  };
}
