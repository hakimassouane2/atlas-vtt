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
import { resizedTokenCenter } from '../../../grid/gridPlacement';
import { t } from '../../../i18n';

const ringColors = (): ReadonlyArray<{ name: string; value: string | null }> => [
  { name: t('color.default'), value: null },
  { name: t('color.blue'), value: '#086ddd' },
  { name: t('color.orange'), value: '#ec7500' },
  { name: t('color.red'), value: '#e93147' },
  { name: t('color.yellow'), value: '#e0ac00' },
  { name: t('color.brown'), value: '#a97142' },
  { name: t('color.purple'), value: '#7852ee' },
  { name: t('color.green'), value: '#08b94e' },
  { name: t('color.pink'), value: '#d53984' },
  { name: t('color.cyan'), value: '#00bfbc' },
  { name: t('color.gray'), value: '#ababab' },
  { name: t('color.white'), value: '#ffffff' },
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

/**
 * Grouped from what a fight uses most to what it never does: play, the token's own records and look,
 * who sees and moves it, copies, and the destructive row last.
 */
function gmTokenMenuEntries(app: App, canvas: TokenMenuCanvas, token: TokenEntity): ContextMenuEntry[] {
  const { store, gridSystem } = canvas;
  const character = token.kind === 'character' ? token : undefined;
  const targets = menuTargets(canvas, token.id);
  const separator: ContextMenuEntry = { type: 'separator' };
  const entries: ContextMenuEntry[] = [];

  // Play
  // Initiative, for the selection the token belongs to; the clicked token decides which way
  const isInInitiative = (store.getState().initiative?.entries || []).some((entry) => entry.tokenId === token.id);
  entries.push({
    type: 'item',
    label: isInInitiative ? t('initiative.remove') : t('token.addInitiative'),
    icon: 'swords',
    onClick: () => toggleInitiative(canvas, targets, isInInitiative),
  });

  const conditionDefs = canvas.conditions();
  if (conditionDefs.length > 0) entries.push(conditionsSubmenu(store, conditionDefs, targets));

  // Reset (only if the token tracks resources)
  if (hasResources(canvas, character)) {
    entries.push({
      type: 'item',
      label: resetLabel(canvas.resources()),
      icon: 'rotate-ccw',
      onClick: () => store.getState().resetTokens([token.id], canvas.resources()),
    });
  }

  // The token itself
  entries.push(
    separator,
    statblockEntry(app, canvas, token, character),
    {
      type: 'item',
      label: t('editToken.title'),
      icon: 'edit',
      onClick: () => openEditTokenModal(token, store, app, canvas.resources()),
    },
    appearanceSubmenu(canvas, token),
  );

  // Who sees it and who moves it
  entries.push(separator);
  // Hide/Show the selection in one undo step; the clicked token decides which way
  const isHidden = store.getState().objects.tokens[token.id]?.isHidden || false;
  entries.push({
    type: 'item',
    label: isHidden ? t('token.show') : t('token.hide'),
    icon: isHidden ? 'eye' : 'eye-off',
    onClick: () => store.getState().updateTokens(targets.map((id) => ({ id, changes: { isHidden: !isHidden } }))),
  });

  // Vision and carried light, for the selection the token belongs to
  if (dynamicLightingOn(app)) {
    entries.push(...tokenLightingEntries(store, token.id, targets, mapLightPresets(app, store.getState())));
  }

  // Which online players move the selection
  const players = mapPlayers(AssetService.getInstance(app), store.getState().mapPath);
  if (players.length > 0) entries.push(playersSubmenu(store, players, targets));

  // Copies
  const selectedIds = store.getState().selectedIds;
  const groupIds = selectedIds.includes(token.id) ? selectedIds : [token.id];
  entries.push(
    separator,
    { type: 'item', label: t('common.duplicate'), icon: 'files', onClick: () => store.getState().duplicateMapObjects(groupIds) },
    { type: 'item', label: t('common.copy'), icon: 'copy', onClick: () => copyMapObjects(store, groupIds) },
    {
      type: 'item',
      label: t('token.saveEncounter'),
      icon: 'swords',
      onClick: () => { void saveMapTokensAsEncounter(app, store, gridSystem, groupIds); },
    },
  );

  // Destructive actions row (Kill + Delete side by side)
  entries.push(separator, {
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

/** Size and ring colour of the clicked token. */
function appearanceSubmenu({ store }: TokenMenuCanvas, token: TokenEntity): ContextMenuEntry {
  const size = tokenSizeSubmenu(token.size, (newSize) => {
    const { grid, objects, updateToken } = store.getState();
    const current = objects.tokens[token.id];
    if (!current) return;
    const center = resizedTokenCenter(current, current.size || 1, newSize, grid);
    updateToken(token.id, { size: newSize, x: center.x, y: center.y });
  });
  const ringColor: ContextMenuEntry = {
    type: 'submenu',
    label: t('token.ringColor'),
    icon: 'circle',
    children: ringColors().map((color) => ({
      type: 'item' as const,
      label: color.name,
      checked: color.value === token.ringColor || (color.value === null && !token.ringColor),
      onClick: () => store.getState().setTokenRing(token.id, color.value),
    })),
  };
  return { type: 'submenu', label: t('token.appearance'), icon: 'paintbrush', children: [size, ringColor] };
}

/** A linked statblock opens or unlinks from its own submenu; an unlinked token offers to link one. */
function statblockEntry(app: App, { store }: TokenMenuCanvas, token: TokenEntity, character: Character | undefined): ContextMenuEntry {
  const statblockPath = character?.statblockPath;
  if (statblockPath) {
    return {
      type: 'submenu',
      label: t('token.statblock'),
      icon: 'file-text',
      children: [
        {
          type: 'item',
          label: t('token.openStatblock'),
          icon: 'file-text',
          onClick: async () => {
            const file = app.vault.getAbstractFileByPath(statblockPath);
            if (file) await app.workspace.openLinkText(file.path, '', true);
          },
        },
        {
          type: 'item',
          label: t('token.unlinkStatblock'),
          icon: 'unlink',
          onClick: async () => {
            if (!token.imagePath) return;
            await TokenStatblockLinkService.getInstance(app).unlinkToken(token.imagePath);
            store.getState().updateToken(token.id, STATBLOCK_UNLINK_UPDATES);
          },
        },
      ],
    };
  }
  return {
    type: 'item',
    label: t('am.menu.linkStatblock'),
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
            t('token.linkFailed'),
          );
        },
        character?.name || t('initiative.token'),
        { imagePath: token.imagePath, showRing: token.showRing },
      );
    },
  };
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
