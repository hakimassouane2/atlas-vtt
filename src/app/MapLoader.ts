import { App, TFile, normalizePath } from 'obsidian';
import { Assets, Texture } from 'pixi.js';
import type { MapFile } from './services/MapPersistence';
import { migrateMapFile, parseSceneFile } from './services/MapPersistence';
import { SceneFileError } from './services/sceneFileProblems';
import { AssetValidationService, type MissingAsset } from './services/AssetValidationService';
import { backgroundTextureCache } from './pixi/backgroundTextureCache';
import { mapPlaceholderTexture } from './pixi/mapDisplay';

export interface LoadedMap {
  mapData: MapFile;
  texture: InstanceType<typeof Texture>;
  hasBackground: boolean; // Indicate if this is a real background or placeholder
  /** URL acquired from the background texture cache; the caller releases it when the map is left. */
  backgroundUrl: string | null;
  missingAssets?: MissingAsset[]; // Track missing assets for reporting
}

/**
 * Pure helper that reads the .atlasmap JSON and preloads the background image as a PIXI texture.
 * All vault / IO logic lives here so AtlasView remains an orchestrator only.
 */
export class MapLoader {
  static async load(app: App, mapFilePath: string): Promise<LoadedMap> {
    const assetValidationService = new AssetValidationService({ app });
    // Read and parse the map JSON file from the vault
    const file = app.vault.getAbstractFileByPath(normalizePath(mapFilePath));
    if (!(file instanceof TFile)) {
      throw new Error(`[MapLoader] Map file not found: ${mapFilePath}`);
    }
    let raw: string;
    try {
      raw = await app.vault.read(file);
    } catch (error) {
      console.error(`[MapLoader] Error reading map file ${mapFilePath}:`, error);
      throw new SceneFileError('unreadable');
    }

    // The same check the store's storage makes, so a file never shows as a map that then loads empty.
    // Apply migration to convert app:// URLs to relative paths
    const mapData = migrateMapFile(parseSceneFile(raw).state);

    let texture: Texture;
    let hasBackground = false;
    let backgroundUrl: string | null = null;

    const validationResult = await assetValidationService.validateMapAssets(mapData);
    if (!validationResult.valid) {
      assetValidationService.showMissingAssetsNotice(validationResult.missingAssets);
    }
    
    if (mapData.background) {
      // Preload background image as a PIXI texture
      const imgFile = app.vault.getAbstractFileByPath(normalizePath(mapData.background));
      if (!(imgFile instanceof TFile)) {
        console.error(`[MapLoader] Background image not found: ${mapData.background}`);
        const placeholder = assetValidationService.getMissingAssetPlaceholder();
        texture = placeholder ? await Assets.load<Texture>(placeholder) : mapPlaceholderTexture(mapData.grid?.size || 70);
        hasBackground = false;
      } else {
        const url = app.vault.adapter.getResourcePath(imgFile.path);
        texture = await backgroundTextureCache.acquire(url);
        backgroundUrl = url;
        hasBackground = true;
      }
    } else {
      // Create a placeholder texture for maps without backgrounds
      texture = mapPlaceholderTexture(mapData.grid?.size || 70);
      hasBackground = false;
    }

    return { 
      mapData, 
      texture, 
      hasBackground,
      backgroundUrl,
      missingAssets: validationResult.missingAssets
    };
  }
}
