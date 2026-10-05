import React, { createElement, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import type { ViewAtlasStore } from '../../storeFactory';
import type { DiceRollResult } from '../../tools/DiceTool';
import { DiceRollDisplay } from '../../react/components/dice/DiceRollDisplay';
import { DiceEnvironmentContext, type DiceEnvironment } from '../../react/components/dice/diceEnvironment';
import { ReadableViewStoreProvider } from '../../react/ViewStoreContext';
import { diceRollForPlayers } from '../../tools/diceRollForPlayers';
import { DEFAULT_DICE_LOOK } from '../../dice3d/diceLook';
import { sceneImageUrl } from './session';

/** Dice on a player's page: thrown in 3D with Atlas' default look, avatars from the DM's Atlas, and no sound: its samples stay in the plugin (`vite/player-client.mts`). */
const PAGE_DICE: DiceEnvironment = {
  settings: { getDiceDisplay: () => 'full', getDiceLook: () => ({ ...DEFAULT_DICE_LOOK }), onChange: () => () => undefined },
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
