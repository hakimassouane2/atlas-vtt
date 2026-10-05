import type { App } from 'obsidian';
import type AtlasVTTPlugin from '../../main';
import { createAtlasStorage } from './services/MapPersistence';
import { createSceneStore, type PersistedViewState, type ViewAtlasState, type ViewAtlasStore } from './storeFactory';

/** The store of a map view in Obsidian, which reads and saves its scene file in the vault. */
export function createViewAtlasStore(app: App, viewId: string, plugin?: AtlasVTTPlugin, isPlayerView: boolean = false): ViewAtlasStore {
  return createSceneStore(viewId, {
    ...(plugin && { plugin }),
    isPlayerView,
    storage: (store) => createAtlasStorage<ViewAtlasState, PersistedViewState>(app, store, plugin),
  });
}
