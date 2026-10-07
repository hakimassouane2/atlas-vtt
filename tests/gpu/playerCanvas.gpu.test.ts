import { Rectangle } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../../src/app/online/client/obsidianDom';
import { PlayerCanvas } from '../../src/app/online/client/PlayerCanvas';
import { PagePlayer, SentCollection, pageCanvasHost } from '../../src/app/online/client/pageCanvasHost';
import type { ReplicatedScene } from '../../src/app/online/scene/sceneReplica';
import type { AtlasSettings } from '../../src/app/services/SettingsService';
import type { TokenEntity } from '../../src/app/types';

const GRID = 70;
const PLAYER_VIEW: AtlasSettings['localPlayerView'] = {
  showToolbar: false, showTokenNameplates: true, showNotePreviews: false, showGrid: false,
  showWidgets: false, showInitiative: true, showDiceRolls: true, showCommandPalette: false,
};

/** A solid square image, as a data URL: the canvas loads such art without asking the DM's Atlas. */
async function solidImage(color: string): Promise<string> {
  const canvas = new OffscreenCanvas(64, 64);
  const context = canvas.getContext('2d')!;
  context.fillStyle = color;
  context.fillRect(0, 0, 64, 64);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function scene(tokens: TokenEntity[]): ReplicatedScene {
  return {
    mapPath: 'atlas-vtt/maps/cave.atlasmap',
    background: null,
    grid: { enabled: true, visible: false, size: GRID, offsetX: 0, offsetY: 0, opacity: 0.7 },
    objects: { tokens: Object.fromEntries(tokens.map((token) => [token.id, token])), fog: {}, pins: {}, texts: {}, drawings: {}, walls: {}, lights: {}, audios: {} },
    tokenSettings: { showNameplates: false, hiddenResources: [], showInstanceBadges: true, tokenRingSize: 1 },
    initiative: { entries: [], round: 1, isActive: false },
    initiativeTrackerOpen: false,
  } as ReplicatedScene;
}

describe('the player canvas', () => {
  let container: HTMLElement;
  let canvas: PlayerCanvas;
  let red: string;
  let blue: string;

  beforeEach(async () => {
    installObsidianDom();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0';
    document.body.appendChild(container);
    canvas = new PlayerCanvas(pageCanvasHost(new SentCollection(), new PagePlayer(() => null), () => null), async () => true);
    await canvas.mount(container);
    canvas.setPlayerView(PLAYER_VIEW);
    [red, blue] = await Promise.all([solidImage('#ff0000'), solidImage('#0000ff')]);
  });

  afterEach(() => {
    canvas.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  /** The colour drawn at a point of the map. */
  function colourAt(worldX: number, worldY: number): [number, number, number] {
    const { app, viewport } = canvas;
    app.render();
    const screen = viewport!.toScreen(worldX, worldY);
    const pixels = app.renderer.extract.pixels({ target: app.stage, frame: new Rectangle(Math.round(screen.x), Math.round(screen.y), 1, 1) });
    return [pixels.pixels[0]!, pixels.pixels[1]!, pixels.pixels[2]!];
  }

  const isRed = ([r, g, b]: [number, number, number]): boolean => r > 200 && g < 60 && b < 60;
  const isBlue = ([r, g, b]: [number, number, number]): boolean => b > 200 && r < 60 && g < 60;

  it('draws the tokens the players may see, and not a hidden one', async () => {
    await canvas.showScene(scene([
      { id: 'hero', kind: 'token', imagePath: red, x: 105, y: 105 } as TokenEntity,
      { id: 'lurker', kind: 'token', imagePath: blue, x: 315, y: 105, isHidden: true } as TokenEntity,
    ]));

    expect(isRed(colourAt(105, 105))).toBe(true);
    expect(isBlue(colourAt(315, 105))).toBe(false);
  });

  it('follows the changes the DM makes after the scene was sent', async () => {
    await canvas.showScene(scene([
      { id: 'hero', kind: 'token', imagePath: red, x: 105, y: 105 } as TokenEntity,
      { id: 'lurker', kind: 'token', imagePath: blue, x: 315, y: 105, isHidden: true } as TokenEntity,
    ]));

    canvas.applyChanges([
      { kind: 'tokens', id: 'hero', value: { id: 'hero', kind: 'token', imagePath: red, x: 175, y: 245 } },
      { kind: 'tokens', id: 'lurker', value: { id: 'lurker', kind: 'token', imagePath: blue, x: 315, y: 105, isHidden: false } },
    ]);
    await vi.waitFor(() => expect(isRed(colourAt(175, 245))).toBe(true));

    expect(isRed(colourAt(105, 105))).toBe(false);
    expect(isBlue(colourAt(315, 105))).toBe(true);
  });

  it('takes a token off the map when the DM removes it', async () => {
    await canvas.showScene(scene([{ id: 'hero', kind: 'token', imagePath: red, x: 105, y: 105 } as TokenEntity]));

    canvas.applyChanges([{ kind: 'tokens', id: 'hero', value: null }]);

    await vi.waitFor(() => expect(isRed(colourAt(105, 105))).toBe(false));
  });
});
