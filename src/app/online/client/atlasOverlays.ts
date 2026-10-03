import type { App } from 'obsidian';
import { PlayerDiceRolls } from '../../services/PlayerDiceRolls';
import { PlayerInitiativePanel, type InitiativeCollection } from '../../services/PlayerInitiativePanel';
import type { AtlasSettings, SettingsService } from '../../services/SettingsService';
import type { DiceRollResult } from '../../tools/DiceTool';
import { DEFAULT_INITIATIVE_RULES } from '../../gameSystems/initiativeRules';
import { byId } from './dom';
import { overlayStore, playerStateStore } from './playerState';
import { imageUrl } from './session';

type PlayerSettings = AtlasSettings['localPlayerView'];

const NOTHING_SHOWN: PlayerSettings = {
  showToolbar: false,
  showTokenNameplates: false,
  showNotePreviews: false,
  showGrid: false,
  showWidgets: false,
  showInitiative: false,
  showDiceRolls: false,
  showCommandPalette: false,
};

/**
 * What the overlays read of `SettingsService`: the player view settings the DM's Atlas
 * sends. Dice rolls always show: the DM's Atlas only sends those players may see.
 */
class PageSettings {
  private settings: PlayerSettings = NOTHING_SHOWN;
  private readonly listeners = new Set<(settings: AtlasSettings) => void>();

  getLocalPlayerViewSettings(): PlayerSettings {
    return { ...this.settings, showDiceRolls: true };
  }

  onChange(listener: (settings: AtlasSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(settings: PlayerSettings): void {
    this.settings = settings;
    const all = { localPlayerView: this.getLocalPlayerViewSettings() } as AtlasSettings;
    this.listeners.forEach((listener) => listener(all));
  }
}

/**
 * What the DM's Atlas decided from the scene's collection: the scene it sends holds HP only
 * where players may see them, and the collection's initiative rules come with it.
 */
const sentCollection: InitiativeCollection = {
  showsHp: () => true,
  rules: () => playerStateStore.getState()?.initiativeRules ?? { ...DEFAULT_INITIATIVE_RULES },
};

/** The only part of Obsidian's `App` the overlays use: where the page loads token artwork. */
const pageApp = { vault: { adapter: { getResourcePath: imageUrl } } } as unknown as App;

/**
 * Mounts the local player window's own overlays (initiative order, dice roll toasts)
 * on the page, bound to the scene the DM's Atlas sends, so they look and behave the same.
 */
export function installAtlasOverlays(): void {
  const settings = new PageSettings();
  const settingsService = settings as unknown as SettingsService;
  const content = byId('content');
  const overlays = [new PlayerInitiativePanel(pageApp, settingsService, sentCollection), new PlayerDiceRolls(pageApp, settingsService)];
  for (const overlay of overlays) {
    overlay.mount(content);
    overlay.present(overlayStore);
  }
  playerStateStore.subscribe((state) => {
    if (state) settings.set(state.settings);
  });
}

/** Shows a roll with Atlas' dice toast, which listens for this event as it does in Obsidian. */
export function showRoll(result: DiceRollResult): void {
  document.dispatchEvent(new CustomEvent('atlas-dice-rolled', { detail: result }));
}
