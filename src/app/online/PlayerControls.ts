import type { SettingsService } from '../services/SettingsService';
import type { Character } from '../types';
import type { OnlineFrameSource } from './OnlineFrameStream';
import { applyPlayerCommand, parsePlayerCommand } from './playerCommands';
import { playerScene } from './playerScene';
import type { PlayerState } from './protocol';
import { isPlayerControlled, playerTokens } from './playerTokens';

/** Rolls `formula` with the DM's dice engine, for `token` when given; returns whether it rolled. */
export type RollDice = (formula: string, token: Character | undefined) => boolean;

/**
 * Lets players act on the presented scene: publishes what they see of it (the tokens
 * they control, the initiative order, what the player view settings show), and applies
 * their commands. Only while the scene is live: a held
 * frame shows a scene the view no longer holds (its store then shows the DM's other
 * tab), so commands are refused until the DM presents or returns to it.
 */
export class PlayerControls {
  private source: OnlineFrameSource | null = null;
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly settingsService: SettingsService,
    private readonly publishState: (state: PlayerState) => void,
    private readonly rollDice: RollDice,
  ) {}

  /** The live scene, or null while it is held or gone: players then keep what they saw last. */
  setSource(source: OnlineFrameSource | null): void {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.source = source;
    if (source) {
      // Player view settings decide whether players see initiative, names and hit points
      this.unsubscribers.push(this.settingsService.onChange(() => this.publish()));
      this.unsubscribers.push(source.store.subscribe((state, previous) => {
        if (state.isMapLoading) return;
        const changed = previous.isMapLoading
          || state.objects.tokens !== previous.objects.tokens
          || state.grid?.size !== previous.grid?.size
          || state.initiative !== previous.initiative
          || state.initiativeTrackerOpen !== previous.initiativeTrackerOpen;
        if (changed) this.publish();
      }));
      this.publish();
    }
  }

  /** The map view owning `store` is closing. */
  releaseSource(store: OnlineFrameSource['store']): void {
    if (this.source?.store === store) this.setSource(null);
  }

  apply(body: unknown): boolean {
    const command = parsePlayerCommand(body);
    const source = this.source;
    if (!command || !source || source.store.getState().isMapLoading) return false;
    if (command.type === 'roll') {
      const token = command.id ? source.store.getState().objects.tokens[command.id] : undefined;
      return this.rollDice(command.formula, isPlayerControlled(token) ? token : undefined);
    }
    return applyPlayerCommand(source.store, source.renderer.getGridSystem(), command, source.getConditions());
  }

  private publish(): void {
    const source = this.source;
    const state = source?.store.getState();
    if (!source || !state || state.isMapLoading) return;
    const settings = this.settingsService.getLocalPlayerViewSettings();
    this.publishState({
      tokens: playerTokens(state.objects.tokens, state.grid?.size ?? 70),
      conditions: source.getConditions().map(({ id, name, color, valued }) => ({ id, name, color, valued: valued === true })),
      scene: playerScene(state, settings),
      settings,
    });
  }
}
