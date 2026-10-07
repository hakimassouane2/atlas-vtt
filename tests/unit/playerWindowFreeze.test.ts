import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LocalPlayerSession, LocalPlayerView, PlayerCameraState } from '../../src/app/local-player-view';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import type { PlayerFrameSource } from '../../src/app/services/PlayerFrameMirror';
import { PlayerWindowService } from '../../src/app/services/PlayerWindowService';
import { SettingsService } from '../../src/app/services/SettingsService';
import { playerWindowStore } from '../../src/app/stores/playerWindowStore';
import { createInMemoryApp } from '../mocks/inMemoryVault';

vi.mock('../../src/app/atlas-view', () => ({ AtlasView: class {}, ATLAS_VIEW_TYPE: 'atlas-vtt' }));
// jsdom cannot animate the crossfade into another scene
vi.mock('../../src/app/pixi/sceneTransition', () => ({
  freezeCanvasFrame: () => ({ play: vi.fn(), cancel: vi.fn(), paintInto: vi.fn() }),
}));
afterEach(() => { PlayerWindowService.getInstance()?.destroy(); vi.restoreAllMocks(); });

interface Harness {
  service: PlayerWindowService;
  source: PlayerFrameSource & { withPlayerSafeFrame: ReturnType<typeof vi.fn> };
  store: StoreApi<ViewAtlasState>;
  session: LocalPlayerSession;
  drawImage: ReturnType<typeof vi.fn>;
  setDmCamera(camera: PlayerCameraState): void;
  nextFrame(): void;
}

function setup(): Harness {
  let frame: FrameRequestCallback | null = null;
  const requestAnimationFrame = (callback: FrameRequestCallback): number => { frame = callback; return 1; };
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage } as never);
  const { app } = createInMemoryApp();
  const store = createStore(() => ({ mapLoaded: true, isMapLoading: false, mapPath: 'a.atlasmap' })) as unknown as StoreApi<ViewAtlasState>;
  const service = new PlayerWindowService(app, store, new SettingsService(app));
  const doc = document.implementation.createHTMLDocument();
  Object.defineProperty(doc, 'readyState', { value: 'complete' });
  Object.defineProperty(doc.body, 'win', { value: {
    document: doc, closed: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), close: vi.fn(),
    requestAnimationFrame, cancelAnimationFrame: vi.fn(),
  } });
  let dmCamera: PlayerCameraState = { centerX: 0, centerY: 0, scale: 1 };
  const source = {
    canvas: createEl('canvas'),
    withPlayerSafeFrame: vi.fn((capture: () => void) => capture()),
    getCamera: (): PlayerCameraState => dmCamera,
    store,
  };
  const session: LocalPlayerSession = { frozen: false };
  const view = {
    contentEl: doc.body,
    getState: (): LocalPlayerSession => ({ ...session }),
    updateSession: (state: Partial<LocalPlayerSession>): void => { Object.assign(session, state); },
  };
  service.attachToView(view as unknown as LocalPlayerView, source);
  return {
    service, source, store, session, drawImage,
    setDmCamera: (camera) => { dmCamera = camera; },
    nextFrame: () => frame?.(0),
  };
}

describe('player camera freeze', () => {
  it('keeps rendering the live scene through the camera players saw when frozen', () => {
    const { service, source, session, setDmCamera, nextFrame } = setup();
    setDmCamera({ centerX: 100, centerY: 200, scale: 1.5 });
    nextFrame();
    service.toggleCameraFreeze();
    expect(playerWindowStore.getState().isFrozen).toBe(true);
    expect(session).toMatchObject({ frozen: true, camera: { centerX: 100, centerY: 200, scale: 1.5 } });

    setDmCamera({ centerX: 900, centerY: 900, scale: 3 });
    source.withPlayerSafeFrame.mockClear();
    nextFrame();
    nextFrame();

    // Every frame is still rendered, so token moves and fog reveals reach players.
    expect(source.withPlayerSafeFrame).toHaveBeenCalledTimes(2);
    expect(source.withPlayerSafeFrame).toHaveBeenLastCalledWith(
      expect.any(Function), expect.anything(), { centerX: 100, centerY: 200, scale: 1.5 },
    );
    expect(session.camera).toEqual({ centerX: 100, centerY: 200, scale: 1.5 });

    service.toggleCameraFreeze();
    nextFrame();
    expect(source.withPlayerSafeFrame).toHaveBeenLastCalledWith(expect.any(Function), expect.anything(), undefined);
    expect(session).toMatchObject({ frozen: false, camera: { centerX: 900, centerY: 900, scale: 3 } });
  });

  it('holds a still frame while no scene is open and goes live with the next one', () => {
    const { service, source, drawImage, nextFrame } = setup();
    nextFrame();

    source.withPlayerSafeFrame.mockClear();
    drawImage.mockClear();
    service.follow(null);
    nextFrame();
    nextFrame();
    expect(source.withPlayerSafeFrame).not.toHaveBeenCalled();
    // The copy of what players saw, then that copy once into the window
    expect(drawImage).toHaveBeenCalledTimes(2);

    // At once, then on every frame
    service.follow(source);
    expect(source.withPlayerSafeFrame).toHaveBeenCalledTimes(1);
    nextFrame();
    expect(source.withPlayerSafeFrame).toHaveBeenCalledTimes(2);
  });

  it('another map lifts the freeze', () => {
    const { service, store, nextFrame } = setup();
    nextFrame();
    service.toggleCameraFreeze();
    store.setState({ isMapLoading: true });
    expect(service.isFrozen()).toBe(true);
    store.setState({ isMapLoading: false, mapPath: 'b.atlasmap' });
    expect(service.isFrozen()).toBe(false);
    expect(playerWindowStore.getState().isFrozen).toBe(false);
  });
});
