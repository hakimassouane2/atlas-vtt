import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { UIManager } from '../../src/app/pixi/token-renderer/UIManager';
import type { TokenGroupContainer } from '../../src/app/pixi/token-renderer/types';
import { computeTokenPixelSize, tokenUIScale } from '../../src/app/pixi/token-renderer/tokenSizing';
import { createViewAtlasStore } from '../../src/app/viewStore';
import type { Character } from '../../src/app/types';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { HP } from '../mocks/resourceFixtures';

const hero: Character = { id: 'hero', kind: 'character', name: '', imagePath: 'hero.png', x: 0, y: 0, size: 1, rotation: 0,
  resources: { hp: { current: 5, max: 10 } } };

const medium = computeTokenPixelSize(70, 1);
const gargantuan = computeTokenPixelSize(70, 2.5);

/** World-space length of `units` along `target`'s local x axis. */
function worldLength(target: Container, root: Container, units: number): number {
  return root.toLocal(target.toGlobal({ x: units, y: 0 })).x - root.toLocal(target.toGlobal({ x: 0, y: 0 })).x;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('token UI scale', () => {
  it('keeps a medium token on a 70px grid at the design size and grows linearly with the token', () => {
    expect(tokenUIScale(medium)).toBe(1);
    expect(tokenUIScale(gargantuan)).toBe(4);
  });

  /** A DM view with `hero` as a `spriteWidth` px token at world (100, 100), with its UI and +/- controls. */
  function buildView(spriteWidth: number, zoom = 1): {
    store: ReturnType<typeof createViewAtlasStore>; viewport: Container; uiManager: UIManager; tokenGroup: Container;
    barWorldWidth: () => number; barScreenWidth: () => number; controlsScale: () => number;
  } {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createLinearGradient: () => ({ addColorStop: vi.fn() }), fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const { app } = createInMemoryApp({ files: {} });
    const store = createViewAtlasStore(app, 'token-ui-scale');
    const token = { ...hero, size: spriteWidth === medium ? 1 : 2.5 };
    store.setState({ persistenceEnabled: false, objects: { ...store.getState().objects, tokens: { hero: token } } });
    const viewport = new Container();
    viewport.scale.set(zoom);
    const tokenLayer = new Container({ label: 'tokenContainer' });
    const tokenGroup = Object.assign(new Container(), { tokenId: 'hero', tokenSize: spriteWidth });
    const sprite = new Graphics().rect(-spriteWidth / 2, -spriteWidth / 2, spriteWidth, spriteWidth).fill(0xffffff);
    sprite.label = 'tokenSprite';
    tokenGroup.addChild(sprite);
    tokenGroup.position.set(100, 100);
    tokenLayer.addChild(tokenGroup);
    viewport.addChild(tokenLayer);
    const uiManager = new UIManager(viewport as unknown as Viewport, store, 'token-ui-scale');
    uiManager.resourceDefsProvider = () => [HP];
    uiManager.setTokenSpriteProvider(() => tokenGroup as unknown as TokenGroupContainer);
    uiManager.createTokenUI('hero', tokenGroup as unknown as TokenGroupContainer, token);
    const belowToken = uiManager.getTokenUIs().hero!.getContainer().children[0] as Container;
    const barWorldWidth = (): number => worldLength(belowToken, viewport, 64);
    return {
      store, viewport, uiManager, tokenGroup, barWorldWidth,
      barScreenWidth: () => barWorldWidth() * viewport.scale.x,
      // The controls scale in their anchor on the token's bottom edge, the container's first child
      controlsScale: () => uiManager.getControlsUI()!.getContainer().children[0]!.scale.x,
    };
  }

  it.each([medium, gargantuan])('keeps an unselected %i px token\'s bars at the grid\'s resting size just below it', (spriteWidth) => {
    const { uiManager, viewport, barWorldWidth } = buildView(spriteWidth);
    try {
      const belowToken = uiManager.getTokenUIs().hero!.getContainer().children[0] as Container;
      // The HP bar starts 2 UI units below the token edge and is 64 UI units wide
      expect(viewport.toLocal(belowToken.toGlobal({ x: 0, y: 2 })).y).toBeCloseTo(100 + spriteWidth / 2 + 2, 6);
      expect(barWorldWidth()).toBeCloseTo(64, 6);
    } finally { uiManager.destroyAll(); }
  });

  it.each([
    [medium, 0.5], [medium, 1], [gargantuan, 0.5], [gargantuan, 1.5],
  ])("keeps a selected %i px token's bars and controls at the resting size at zoom %d", (spriteWidth, zoom) => {
    const { store, uiManager, barWorldWidth, controlsScale } = buildView(spriteWidth, zoom);
    try {
      store.getState().setSelection(['hero']);
      expect(barWorldWidth()).toBeCloseTo(64, 6);
      expect(controlsScale()).toBeCloseTo(1, 6);
    } finally { uiManager.destroyAll(); }
  });

  it("keeps a selected token's bars at the resting size while the map zooms, so they zoom with the token", () => {
    const { store, viewport, uiManager, barWorldWidth, controlsScale } = buildView(gargantuan);
    try {
      store.getState().setSelection(['hero']);
      viewport.scale.set(0.4);
      const zoomedViewport = viewport as unknown as Viewport;
      zoomedViewport.emit('zoomed', { viewport: zoomedViewport, type: 'wheel' });
      expect(barWorldWidth()).toBeCloseTo(64, 6);
      expect(controlsScale()).toBeCloseTo(1, 6);
    } finally { uiManager.destroyAll(); }
  });

  it("lays the +/- controls out for a selected token's new size", () => {
    const { store, uiManager, barWorldWidth, controlsScale } = buildView(gargantuan);
    const controls = uiManager.getControlsUI()!;
    try {
      store.getState().setSelection(['hero']);
      uiManager.syncUIScale('hero', medium);
      expect(controls.getContainer().visible).toBe(true);
      expect(controls.getContainer().position.y + controls.getContainer().children[0]!.position.y).toBe(100 + medium / 2);
      expect(controlsScale()).toBeCloseTo(barWorldWidth() / 64, 6);
    } finally { uiManager.destroyAll(); }
  });
});
