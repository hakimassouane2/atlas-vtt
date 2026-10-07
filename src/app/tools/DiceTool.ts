import { EventEmitter } from 'events';
import { DEFAULT_DICE_RULES } from '../gameSystems/diceRules';
import type { DiceRules } from '../types/diceRulesTypes';
import { getDiceCrit, type DiceCrit } from './diceCrit';
import { hasDiceTerm, rollFormula, type RolledDie } from './diceFormula';
import { t } from '../i18n';
import { DEFAULT_DICE_LOOK, type RollLook } from '../dice3d/diceLook';

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
  modifiers: number;
  total: number;
  /** Decided by the collection's critical rule when rolled; missing on rolls logged before rules existed. */
  crit?: DiceCrit;
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

export interface DiceToolState {
  isTrayOpen: boolean;
  rollHistory: DiceRollResult[];
  activeFormula: string;
  quickDice: string[]; // Quick access dice buttons
}

export class DiceTool {
  public state: DiceToolState;
  private eventBus: EventEmitter;
  private readonly getDiceRules: () => DiceRules;
  /** What the DM's own rolls record of the DM. */
  private readonly dmStamp: () => RollStamp;

  constructor(
    eventBus: EventEmitter,
    getDiceRules: () => DiceRules = () => DEFAULT_DICE_RULES,
    dmStamp: () => RollStamp = () => ({ look: { ...DEFAULT_DICE_LOOK }, shownToPlayers: false }),
  ) {
    this.eventBus = eventBus;
    this.getDiceRules = getDiceRules;
    this.dmStamp = dmStamp;
    this.state = {
      isTrayOpen: false,
      rollHistory: [],
      activeFormula: '',
      quickDice: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
    };
  }

  public toggleTray(): void {
    this.state.isTrayOpen = !this.state.isTrayOpen;
    this.eventBus.emit('dice-tray-toggled', this.state.isTrayOpen);
  }

  /** Rolls `formula` for the DM, or for whoever `stamp` names. */
  public rollDice(formula: string, source?: DiceRollResult['source'], stamp?: RollStamp): DiceRollResult {
    const result: DiceRollResult = { ...this.parseAndRoll(formula), ...(stamp ?? this.dmStamp()) };
    if (source) {
      result.source = source;
    }
    
    // Add to history
    this.state.rollHistory.unshift(result);
    
    // Keep only last 50 rolls
    if (this.state.rollHistory.length > 50) {
      this.state.rollHistory = this.state.rollHistory.slice(0, 50);
    }
    
    document.dispatchEvent(new CustomEvent('atlas-dice-rolled', { detail: result }));

    return result;
  }

  /** Rolls the formula; one without dice (`+3`) is added to the collection's default roll. */
  private parseAndRoll(formula: string): DiceRollResult {
    const rules = this.getDiceRules();
    const complete = hasDiceTerm(formula) ? formula : withDefaultRoll(formula, rules.defaultRoll);
    const { rolls, modifiers, total } = rollFormula(complete, Math.random, rules);

    return {
      id: `roll_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
      formula: complete,
      rolls,
      modifiers,
      total,
      crit: getDiceCrit(rolls, rules),
      player: t('dice.player') // TODO: Get actual player name from session
    };
  }

  public clearHistory(): void {
    this.state.rollHistory = [];
    this.eventBus.emit('dice-history-cleared');
    document.dispatchEvent(new CustomEvent('atlas-dice-history-cleared'));
  }

  public setActiveFormula(formula: string): void {
    this.state.activeFormula = formula;
  }

  public getQuickDice(): string[] {
    return this.state.quickDice;
  }

  public addQuickDie(die: string): void {
    if (!this.state.quickDice.includes(die)) {
      this.state.quickDice.push(die);
    }
  }

  public removeQuickDie(die: string): void {
    this.state.quickDice = this.state.quickDice.filter(d => d !== die);
  }

  // Get current state
  public getState(): DiceToolState {
    return { ...this.state };
  }
}

/** `+3` with `1d20` gives `1d20+3`; a bare number counts as a bonus. */
function withDefaultRoll(modifier: string, defaultRoll: string): string {
  const bonus = modifier.replace(/\s+/g, '');
  return bonus === '' || /^[+-]/.test(bonus) ? `${defaultRoll}${bonus}` : `${defaultRoll}+${bonus}`;
}
