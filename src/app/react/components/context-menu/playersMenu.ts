import { createElement } from 'react';
import type { StoreApi } from 'zustand';
import type { ContextMenuEntry } from './AtlasContextMenu';
import type { ViewAtlasState } from '../../../storeFactory';
import type { PlayerProfile } from '../../../types/collectionSettingsTypes';
import { controllersOf, withController } from '../../../players/playerProfiles';
import { PlayerDot } from '../../../players/PlayerDot';

/**
 * "Players" submenu for one or several tokens: which online players move them. A player is
 * ticked when every token is theirs, and shows how many otherwise ("Alice (2/3)"). Choosing a
 * player takes the tokens from them when every token is theirs and gives every token to them
 * otherwise, in one undo step. The submenu stays open, so a token can go to several players.
 */
export function playersSubmenu(
  store: StoreApi<ViewAtlasState>,
  players: readonly PlayerProfile[],
  tokenIds: readonly string[],
): ContextMenuEntry {
  const children = (): ContextMenuEntry[] => {
    const tokens = store.getState().objects.tokens;
    return players.map((player) => {
      const count = tokenIds.filter((id) => tokens[id] && controllersOf(tokens[id]).includes(player.id)).length;
      const hasAll = count === tokenIds.length;
      const name = player.name || 'Unnamed player';
      return {
        type: 'item',
        label: count > 0 && !hasAll ? `${name} (${count}/${tokenIds.length})` : name,
        checked: hasAll,
        keepOpen: true,
        leading: createElement(PlayerDot, { player }),
        onClick: () => {
          const current = store.getState().objects.tokens;
          store.getState().updateTokens(tokenIds.flatMap((id) => {
            const token = current[id];
            return token ? [{ id, changes: { controlledBy: withController(token, player.id, !hasAll) } }] : [];
          }));
        },
      };
    });
  };
  const subscribe = (onChange: () => void): (() => void) =>
    store.subscribe((state, previous) => {
      if (state.objects.tokens !== previous.objects.tokens) onChange();
    });
  return { type: 'submenu', label: 'Players', icon: 'users', children, subscribe };
}
