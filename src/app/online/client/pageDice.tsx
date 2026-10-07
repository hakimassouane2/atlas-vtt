import React, { createElement, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import type { ViewAtlasStore } from '../../storeFactory';
import type { DiceRollResult } from '../../tools/DiceTool';
import { DiceRollDisplay } from '../../react/components/dice/DiceRollDisplay';
import { DiceEnvironmentContext, type DiceEnvironment } from '../../react/components/dice/diceEnvironment';
import { ReadableViewStoreProvider } from '../../react/ViewStoreContext';
import { diceRollForPlayers } from '../../tools/diceRollForPlayers';
import { DEFAULT_DICE_LOOK } from '../../dice3d/diceLook';
import type { DiceDisplay } from '../../dice3d/diceDisplay';
import { sceneImageUrl } from './session';

/** How rolls show on the page: as the DM set it for the whole table (`PlayerCanvasContext.diceDisplay`). */
class PageDiceSettings {
  private display: DiceDisplay = 'full';
  private readonly listeners = new Set<() => void>();

  setDisplay(display: DiceDisplay): void {
    if (display === this.display) return;
    this.display = display;
    this.listeners.forEach((listener) => listener());
  }

  getDiceDisplay = (): DiceDisplay => this.display;
  getDiceLook = (): typeof DEFAULT_DICE_LOOK => ({ ...DEFAULT_DICE_LOOK });

  onChange = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const pageDiceSettings = new PageDiceSettings();

/** Dice on a player's page: shown as the DM set it, avatars from the DM's Atlas, and no sound: its samples stay in the plugin (`vite/player-client.mts`). */
export const PAGE_DICE: DiceEnvironment = {
  settings: pageDiceSettings,
  art: { src: sceneImageUrl, statblockImage: () => null, libraryShowsRing: () => true },
};

function PageDiceRolls({ store, container }: { store: ViewAtlasStore; container: HTMLElement }): React.ReactElement {
  // A roll for a token players cannot see keeps its result but not who rolled it
  const forPlayers = useCallback((result: DiceRollResult): DiceRollResult => diceRollForPlayers(result, store.getState().objects.tokens), [store]);
  return (
    <DiceEnvironmentContext.Provider value={PAGE_DICE}>
      <ReadableViewStoreProvider store={store}>
        <DiceRollDisplay container={container} prepare={forPlayers} muted />
      </ReadableViewStoreProvider>
    </DiceEnvironmentContext.Provider>
  );
}

/** Shows the rolls the DM's Atlas sends as Atlas shows rolls: thrown dice at the top of the map. */
export function installPageDice(parent: HTMLElement, store: ViewAtlasStore): (result: DiceRollResult) => void {
  const host = parent.createDiv({ cls: 'atlas-player-dice-rolls' });
  createRoot(host).render(createElement(PageDiceRolls, { store, container: host }));
  return (result) => document.dispatchEvent(new CustomEvent('atlas-dice-rolled', { detail: result }));
}
