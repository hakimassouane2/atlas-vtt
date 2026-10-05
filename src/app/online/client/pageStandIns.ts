import type { App } from 'obsidian';
import type { AtlasSettings, SettingsService } from '../../services/SettingsService';
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
 * What Atlas' player overlays read of `SettingsService` on a player's page: the player view
 * settings the DM's Atlas sends. Dice rolls always show: the DM's Atlas only sends those
 * players may see.
 */
export class PageSettings {
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

  /** As the overlays take it: they read only the methods above. */
  asSettingsService(): SettingsService {
    return this as unknown as SettingsService;
  }
}

/** The only part of Obsidian's `App` the overlays use: where the page loads token artwork. */
export const pageApp = { vault: { adapter: { getResourcePath: imageUrl } } } as unknown as App;
