/**
 * UI Visibility State Slice
 * Manages ephemeral per-view UI panel visibility so that multiple Atlas views
 * (e.g. two maps side-by-side) have independent panel states.
 *
 * NOT persisted — the partialize whitelist in storeFactory.ts excludes these.
 */

import { DEFAULT_EXPLORED_BRUSH, type ExploredBrushOptions } from '../lighting/exploredEdits';
import type { HeldTokens } from '../lighting/sightOnDrop';
import type { RulerPath, SharedRulers } from '../canvas/sharedRulers';
import type { LaserPiece, SharedLaserPieces, SharedLasers } from '../canvas/sharedLasers';

/** State fields added to ViewAtlasState */
export interface UISlice {
  // Panel visibility
  isGridSettingsOpen: boolean;
  isDMScreenOpen: boolean;
  isGridAlignmentOpen: boolean;
  isDiceLogOpen: boolean;
  isAssetManagerOpen: boolean;
  assetManagerInitialTab?: 'scenes' | 'maps' | 'encounters' | 'tokens' | undefined;
  isCommandPaletteOpen: boolean;
  isDiceTrayOpen: boolean;
  /** The placed light whose popover is open, with its range rings on the map. */
  lightPopover: string | null;
  /** The light zone whose popover is open; never together with a light's. */
  lightZonePopover: string | null;
  /** The scene lighting settings panel, opened from the lighting tool's menu. */
  isSceneLightingPanelOpen: boolean;
  /** The tokens the pointer holds (pressed or dragged), each where it stood when taken; set through `holdTokens`. */
  heldTokens: HeldTokens;
  /** What the lighting tool's explored-memory mode does with a stroke: the one place the menu and the tool read it from. */
  exploredBrush: ExploredBrushOptions;
  /** The toolbar editor is open in this view: tray, hide and show, inert tools. Never saved. */
  isToolbarEditing: boolean;
  /** The drag ruler this view draws now, shared with the other people at an online table. */
  localRuler: RulerPath | null;
  /** The drag rulers of the others at an online table, drawn over the map (`SharedDragRulers`). */
  sharedRulers: SharedRulers;
  /** The latest piece of this view's laser, shared with the other people at an online table. */
  localLaser: LaserPiece | null;
  /** The lasers of the others at an online table, drawn over the map (`RemoteLasers`). */
  sharedLasers: SharedLasers;

  // Actions
  setGridSettingsOpen: (open: boolean) => void;
  setDMScreenOpen: (open: boolean) => void;
  setGridAlignmentOpen: (open: boolean) => void;
  setDiceLogOpen: (open: boolean) => void;
  openAssetManager: (tab?: UISlice['assetManagerInitialTab']) => void;
  closeAssetManager: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDiceTrayOpen: (open: boolean) => void;
  openLightPopover: (lightId: string) => void;
  closeLightPopover: () => void;
  openLightZonePopover: (zoneId: string) => void;
  closeLightZonePopover: () => void;
  setSceneLightingPanelOpen: (open: boolean) => void;
  setHeldTokens: (held: HeldTokens) => void;
  setLocalRuler: (ruler: RulerPath | null) => void;
  setSharedRulers: (rulers: SharedRulers) => void;
  setLocalLaser: (piece: LaserPiece | null) => void;
  /** Takes in new pieces of others' lasers; null takes that laser away. */
  setSharedLasers: (pieces: SharedLaserPieces) => void;
  setExploredBrush: (changes: Partial<ExploredBrushOptions>) => void;
  /** Starting the toolbar editor closes the dice tray, which hangs where the tray goes. */
  setToolbarEditing: (on: boolean) => void;
}

/** Default state — all panels closed */
export function createInitialUIState(): Pick<
  UISlice,
  | 'isGridSettingsOpen'
  | 'isDMScreenOpen'
  | 'isGridAlignmentOpen'
  | 'isDiceLogOpen'
  | 'isAssetManagerOpen'
  | 'assetManagerInitialTab'
  | 'isCommandPaletteOpen'
  | 'isDiceTrayOpen'
  | 'lightPopover'
  | 'lightZonePopover'
  | 'isSceneLightingPanelOpen'
  | 'heldTokens'
  | 'exploredBrush'
  | 'isToolbarEditing'
  | 'localRuler'
  | 'sharedRulers'
  | 'localLaser'
  | 'sharedLasers'
> {
  return {
    isGridSettingsOpen: false,
    isDMScreenOpen: false,
    isGridAlignmentOpen: false,
    isDiceLogOpen: false,
    isAssetManagerOpen: false,
    assetManagerInitialTab: undefined,
    isCommandPaletteOpen: false,
    isDiceTrayOpen: false,
    lightPopover: null,
    lightZonePopover: null,
    isSceneLightingPanelOpen: false,
    heldTokens: {},
    exploredBrush: DEFAULT_EXPLORED_BRUSH,
    isToolbarEditing: false,
    localRuler: null,
    sharedRulers: {},
    localLaser: null,
    sharedLasers: {},
  };
}

/** Action creators — `set` comes from the immer middleware in the store */
export function createUIActions(
  set: (fn: (draft: UISlice) => void) => void,
): Pick<
  UISlice,
  | 'setGridSettingsOpen'
  | 'setDMScreenOpen'
  | 'setGridAlignmentOpen'
  | 'setDiceLogOpen'
  | 'openAssetManager'
  | 'closeAssetManager'
  | 'setCommandPaletteOpen'
  | 'setDiceTrayOpen'
  | 'openLightPopover'
  | 'closeLightPopover'
  | 'openLightZonePopover'
  | 'closeLightZonePopover'
  | 'setSceneLightingPanelOpen'
  | 'setHeldTokens'
  | 'setLocalRuler'
  | 'setSharedRulers'
  | 'setLocalLaser'
  | 'setSharedLasers'
  | 'setExploredBrush'
  | 'setToolbarEditing'
> {
  return {
    setGridSettingsOpen: (open) => set((draft) => { draft.isGridSettingsOpen = open; }),
    setDMScreenOpen: (open) => set((draft) => { draft.isDMScreenOpen = open; }),
    setGridAlignmentOpen: (open) => set((draft) => { draft.isGridAlignmentOpen = open; }),
    setDiceLogOpen: (open) => set((draft) => { draft.isDiceLogOpen = open; }),
    // The palette, the dice tray and the asset manager open where the toolbar editor's tray sits, or over the map: each ends edit mode.
    openAssetManager: (tab) => set((draft) => {
      draft.isAssetManagerOpen = true;
      draft.assetManagerInitialTab = tab;
      draft.isToolbarEditing = false;
    }),
    closeAssetManager: () => set((draft) => {
      draft.isAssetManagerOpen = false;
      draft.assetManagerInitialTab = undefined;
    }),
    setCommandPaletteOpen: (open) => set((draft) => {
      draft.isCommandPaletteOpen = open;
      if (open) draft.isToolbarEditing = false;
    }),
    setDiceTrayOpen: (open) => set((draft) => {
      draft.isDiceTrayOpen = open;
      if (open) draft.isToolbarEditing = false;
    }),
    openLightPopover: (lightId) => set((draft) => {
      draft.lightPopover = lightId;
      draft.lightZonePopover = null;
    }),
    openLightZonePopover: (zoneId) => set((draft) => {
      draft.lightZonePopover = zoneId;
      draft.lightPopover = null;
    }),
    closeLightZonePopover: () => set((draft) => { draft.lightZonePopover = null; }),
    closeLightPopover: () => set((draft) => { draft.lightPopover = null; }),
    setSceneLightingPanelOpen: (open) => set((draft) => { draft.isSceneLightingPanelOpen = open; }),
    setHeldTokens: (held) => set((draft) => { draft.heldTokens = held; }),
    setLocalRuler: (ruler) => set((draft) => { draft.localRuler = ruler; }),
    setSharedRulers: (rulers) => set((draft) => { draft.sharedRulers = rulers; }),
    setLocalLaser: (piece) => set((draft) => { draft.localLaser = piece; }),
    setSharedLasers: (pieces) => set((draft) => {
      const lasers = draft.sharedLasers as Record<string, SharedLasers[string]>;
      for (const [who, laser] of Object.entries(pieces)) {
        if (laser) lasers[who] = laser;
        else delete lasers[who];
      }
    }),
    setExploredBrush: (changes) => set((draft) => { draft.exploredBrush = { ...draft.exploredBrush, ...changes }; }),
    setToolbarEditing: (on) => set((draft) => {
      draft.isToolbarEditing = on;
      if (on) draft.isDiceTrayOpen = false;
    }),
  };
}
