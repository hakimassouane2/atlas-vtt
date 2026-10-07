import type { App } from 'obsidian';
import type { EventEmitter } from 'events';
import type { Viewport } from 'pixi-viewport';
import type { ViewAtlasStore } from '../../storeFactory';
import type { TokenRenderer } from '../TokenRenderer';
import { AudioTool } from '../../tools/AudioTool';
import { SoundRegistry } from '../../audio/SoundRegistry';
import { AudioBufferCache } from '../../audio/AudioBufferCache';
import { SpatialAudioEngine } from '../../audio/SpatialAudioEngine';
import { runInBackground } from '../../utils/backgroundTask';
import { AudioRenderer } from './AudioRenderer';
import { openAudioConfigPanel } from './AudioConfigPanel';
import { t } from '../../i18n';

/** What the ambient audio of one map view draws on. */
export interface AudioFeatureDeps {
  viewport: Viewport;
  store: ViewAtlasStore;
  eventBus: EventEmitter;
  obsApp: App;
  /** The canvas the map is drawn on, for placing the source's settings panel. */
  canvas: () => HTMLCanvasElement | null;
}

/**
 * The ambient audio of one map view: its sources on the map, the tool that places them, the
 * panel that sets them up, and the engine that plays them as tokens move.
 */
export class AudioFeature {
  private readonly renderer: AudioRenderer;
  private readonly tool: AudioTool;
  private readonly registry: SoundRegistry;
  private readonly bufferCache: AudioBufferCache;
  private readonly engine: SpatialAudioEngine;

  constructor(private readonly deps: AudioFeatureDeps) {
    this.renderer = new AudioRenderer(deps.viewport, deps.store);
    this.tool = new AudioTool(deps.eventBus);
    const pluginDir = deps.store.getState().plugin?.manifest?.dir ?? `${deps.obsApp.vault.configDir}/plugins/atlas-vtt`;
    this.registry = new SoundRegistry(deps.obsApp, pluginDir);
    void this.registry.scanCustomSounds();
    this.bufferCache = new AudioBufferCache(new AudioContext(), deps.obsApp, this.registry);
    this.engine = new SpatialAudioEngine(deps.store, this.bufferCache);
  }

  /** Lets the audio tool's presses through the token renderer's viewport dispatch. */
  wire(tokens: TokenRenderer): void {
    tokens.setAudioPointerDownHandler((worldX, worldY) => this.pointerDown(worldX, worldY));
    tokens.setAudioPointerMoveHandler(() => {
      // Future: hover feedback for audio sources
    });
  }

  destroy(): void {
    this.renderer.destroy();
    this.engine.dispose();
    this.bufferCache.dispose();
  }

  /** A click selects the source under it, or places a new one; either opens the source's panel. */
  private pointerDown(worldX: number, worldY: number): boolean {
    const hitId = this.renderer.hitTestAudioSources(worldX, worldY);
    const id = hitId ?? this.placeSource(worldX, worldY);
    this.renderer.setSelectedAudio(id);
    this.openPanel(id, worldX, worldY);
    return true;
  }

  private placeSource(worldX: number, worldY: number): string {
    const settings = this.tool.getSettings();
    const grid = this.deps.store.getState().grid;
    const gridSize = grid?.size ?? 70;
    const unitDist = grid?.unitDistance ?? 5;
    return this.deps.store.getState().addAudio({
      x: worldX,
      y: worldY,
      innerRadius: (10 / unitDist) * gridSize, // Default 10 game units
      outerRadius: (30 / unitDist) * gridSize, // Default 30 game units
      volume: settings.defaultVolume,
      soundId: settings.defaultSoundId,
      loop: true,
    });
  }

  private openPanel(audioId: string, worldX: number, worldY: number): void {
    const screenPos = this.deps.viewport.toScreen(worldX, worldY);
    const canvasRect = this.deps.canvas()?.getBoundingClientRect();
    openAudioConfigPanel(
      audioId,
      this.deps.store,
      this.registry,
      (soundId) => this.previewSound(soundId),
      (canvasRect?.left ?? 0) + screenPos.x,
      (canvasRect?.top ?? 0) + screenPos.y,
    );
  }

  private previewSound(soundId: string): void {
    runInBackground(this.engine.previewSound(soundId), `Previewing sound ${soundId}`, t('light.previewFailed'));
  }
}
