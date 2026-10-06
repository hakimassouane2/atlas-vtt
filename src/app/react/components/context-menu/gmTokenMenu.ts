import React from 'react';
import type { App } from 'obsidian';
import type { TokenMenu, TokenMenuCanvas } from '../../../canvas/canvasHost';
import type { Character, TokenEntity } from '../../../types';
import type { ContextMenuEntry } from './AtlasContextMenu';
import { openContextMenuGlobal, closeContextMenuGlobal } from '../../../ui/contextMenus';
import { conditionsSubmenu } from './conditionsMenu';
import { tokenSizeSubmenu } from './tokenSizeMenu';
import { playersSubmenu } from './playersMenu';
import { mapPlayers } from '../../../players/playerProfiles';
import { AssetService } from '../../../services/AssetService';
import { tokenLightingEntries } from './tokenLightingMenu';
import { isKillable, resetLabel } from '../../../resources/resourceValues';
import { visibleResources } from '../../../resources/visibleResources';
import { initiativeEntryForToken } from '../../../stores/initiativeEntries';
import { dynamicLightingOn } from '../../../experimental/experimentalFeatures';
import { mapLightPresets } from '../../../services/mapCollectionRules';
import { saveMapTokensAsEncounter } from '../../../encounters/saveMapTokensAsEncounter';
import { copyMapObjects } from '../../../clipboard/mapClipboardActions';
import { StatblockDialogService } from '../../../services/StatblockDialogService';
import { TokenStatblockLinkService } from '../../../services/TokenStatblockLinkService';
import { runInBackground } from '../../../utils/backgroundTask';
import { openEditTokenModal } from '../../../pixi/token-renderer/EditTokenModal';
import { STATBLOCK_UNLINK_UPDATES } from '../../../pixi/token-renderer/statblockFrontmatter';
import { DestructiveActionRow } from '../../../pixi/token-renderer/DestructiveActionRow';

const RING_COLORS: ReadonlyArray<{ name: string; value: string | null }> = [
  { name: 'Default', value: null },
  { name: 'Blue', value: '#086ddd' },
  { name: 'Orange', value: '#ec7500' },
  { name: 'Red', value: '#e93147' },
  { name: 'Yellow', value: '#e0ac00' },
  { name: 'Brown', value: '#a97142' },
  { name: 'Purple', value: '#7852ee' },
  { name: 'Green', value: '#08b94e' },
  { name: 'Pink', value: '#d53984' },
  { name: 'Cyan', value: '#00bfbc' },
  { name: 'Gray', value: '#ababab' },
  { name: 'White', value: '#ffffff' },
];

/** The GM's token menu: everything Atlas can do to a token on the map. */
export function gmTokenMenu(app: App): (canvas: TokenMenuCanvas) => TokenMenu {
  return (canvas) => (token, at) => openContextMenuGlobal(gmTokenMenuEntries(app, canvas, token), at);
}

/** The selected tokens when the right-clicked token is one of them, otherwise that token alone. */
function menuTargets({ store }: TokenMenuCanvas, tokenId: string): string[] {
  const { selectedIds, objects } = store.getState();
  if (!selectedIds.includes(tokenId)) return [tokenId];
  return selectedIds.filter((id) => objects.tokens[id] !== undefined);
}

function gmTokenMenuEntries(app: App, canvas: TokenMenuCanvas, token: TokenEntity): ContextMenuEntry[] {
  const { store, gridSystem } = canvas;
  const character = token.kind === 'character' ? token : undefined;
  const targets = menuTargets(canvas, token.id);
  const entries: ContextMenuEntry[] = [];

  const conditionDefs = canvas.conditions();
  if (conditionDefs.length > 0) entries.push(conditionsSubmenu(store, conditionDefs, targets));

  entries.push(tokenSizeSubmenu(token.size, (size) => store.getState().updateToken(token.id, { size })));

  // Hide/Show the selection in one undo step; the clicked token decides which way
  const isHidden = store.getState().objects.tokens[token.id]?.isHidden || false;
  entries.push({
    type: 'item',
    label: isHidden ? 'Show' : 'Hide',
    icon: isHidden ? 'eye' : 'eye-off',
    onClick: () => store.getState().updateTokens(targets.map((id) => ({ id, changes: { isHidden: !isHidden } }))),
  });

  // Vision and carried light, for the selection the token belongs to
  if (dynamicLightingOn(app)) {
    entries.push(...tokenLightingEntries(store, token.id, targets, mapLightPresets(app, store.getState())));
  }

  const selectedIds = store.getState().selectedIds;
  const groupIds = selectedIds.includes(token.id) ? selectedIds : [token.id];
  entries.push(
    { type: 'item', label: 'Duplicate', icon: 'files', onClick: () => store.getState().duplicateMapObjects(groupIds) },
    { type: 'item', label: 'Copy', icon: 'copy', onClick: () => copyMapObjects(store, groupIds) },
    {
      type: 'item',
      label: 'Save as Encounter',
      icon: 'swords',
      onClick: () => { void saveMapTokensAsEncounter(app, store, gridSystem, groupIds); },
    },
    {
      type: 'item',
      label: 'Edit Token',
      icon: 'edit',
      onClick: () => openEditTokenModal(token, store, app, canvas.resources()),
    },
  );

  // Which online players move the selection
  const players = mapPlayers(AssetService.getInstance(app), store.getState().mapPath);
  if (players.length > 0) entries.push(playersSubmenu(store, players, targets));

  // Initiative, for the selection the token belongs to; the clicked token decides which way
  const isInInitiative = (store.getState().initiative?.entries || []).some((entry) => entry.tokenId === token.id);
  entries.push({
    type: 'item',
    label: isInInitiative ? 'Remove from Initiative' : 'Add to Initiative',
    icon: 'swords',
    onClick: () => toggleInitiative(canvas, targets, isInInitiative),
  });

  entries.push(...statblockEntries(app, canvas, token, character));

  entries.push({
    type: 'submenu',
    label: 'Ring Color',
    icon: 'circle',
    children: RING_COLORS.map((color) => ({
      type: 'item' as const,
      label: color.name,
      checked: color.value === token.ringColor || (color.value === null && !token.ringColor),
      onClick: () => store.getState().setTokenRing(token.id, color.value),
    })),
  });

  // Reset (only if the token tracks resources)
  if (hasResources(canvas, character)) {
    entries.push({
      type: 'item',
      label: resetLabel(canvas.resources()),
      icon: 'rotate-ccw',
      onClick: () => store.getState().resetTokens([token.id], canvas.resources()),
    });
  }

  // Destructive actions row (Kill + Delete side by side)
  entries.push({
    type: 'custom',
    render: () => React.createElement(DestructiveActionRow, {
      tokenId: token.id,
      store,
      canKill: token.kind === 'character' && isKillable(token, canvas.resources()),
      definitions: canvas.resources(),
      onClose: () => closeContextMenuGlobal(),
    }),
  });

  return entries;
}

function statblockEntries(app: App, { store }: TokenMenuCanvas, token: TokenEntity, character: Character | undefined): ContextMenuEntry[] {
  const statblockPath = character?.statblockPath;
  if (statblockPath) {
    return [
      {
        type: 'item',
        label: 'Edit Statblock',
        icon: 'file-text',
        onClick: async () => {
          const file = app.vault.getAbstractFileByPath(statblockPath);
          if (file) await app.workspace.openLinkText(file.path, '', true);
        },
      },
      {
        type: 'item',
        label: 'Unlink Statblock',
        icon: 'unlink',
        onClick: async () => {
          if (!token.imagePath) return;
          await TokenStatblockLinkService.getInstance(app).unlinkToken(token.imagePath);
          store.getState().updateToken(token.id, STATBLOCK_UNLINK_UPDATES);
        },
      },
    ];
  }
  return [{
    type: 'item',
    label: 'Link Statblock',
    icon: 'link',
    onClick: () => {
      if (!token.imagePath) return;
      const linkService = TokenStatblockLinkService.getInstance(app);
      new StatblockDialogService(app).showStatblockDialog(
        null,
        (path: string | null) => {
          if (!path) return;
          runInBackground(
            linkService.linkTokenToStatblock(token.imagePath, path).then(() => {
              store.getState().updateToken(token.id, { statblockPath: path });
            }),
            `Linking statblock ${path}`,
            'Could not link the statblock',
          );
        },
        character?.name || 'Token',
        { imagePath: token.imagePath, showRing: token.showRing },
      );
    },
  }];
}

function hasResources(canvas: TokenMenuCanvas, character: Character | undefined): boolean {
  return character !== undefined && visibleResources(character, canvas.resources(), 'dm').length > 0;
}

function toggleInitiative({ store }: TokenMenuCanvas, tokenIds: string[], remove: boolean): void {
  if (!store.getState().initiativeTrackerOpen) store.getState().setInitiativeTrackerOpen(true);
  for (const tokenId of tokenIds) {
    const { initiative, objects, addToInitiative, removeFromInitiative } = store.getState();
    const entry = initiative.entries.find((e) => e.tokenId === tokenId);
    const token = objects.tokens[tokenId];
    if (remove && entry) removeFromInitiative(entry.id);
    else if (!remove && !entry && token) addToInitiative(initiativeEntryForToken(token));
  }
}
