import { PlayerDiceRolls } from '../../services/PlayerDiceRolls';
import { PlayerInitiativePanel, type InitiativeCollection } from '../../services/PlayerInitiativePanel';
import type { DiceRollResult } from '../../tools/DiceTool';
import { DEFAULT_INITIATIVE_RULES } from '../../gameSystems/initiativeRules';
import { byId } from './dom';
import { overlayStore, playerStateStore } from './playerState';
import { PageSettings, pageApp } from './pageStandIns';

/**
 * What the DM's Atlas decided from the scene's collection: the scene it sends holds HP only
 * where players may see them, and the collection's initiative rules come with it.
 */
const sentCollection: InitiativeCollection = {
  showsHp: () => true,
  rules: () => playerStateStore.getState()?.initiativeRules ?? { ...DEFAULT_INITIATIVE_RULES },
};

/**
 * Mounts the local player window's own overlays (initiative order, dice roll toasts)
 * on the page, bound to the scene the DM's Atlas sends, so they look and behave the same.
 */
export function installAtlasOverlays(): void {
  const settings = new PageSettings();
  const settingsService = settings.asSettingsService();
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
