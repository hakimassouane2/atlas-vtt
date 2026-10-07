import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { createStore } from 'zustand/vanilla';
import type { Application } from 'pixi.js';
import { SettingsService } from '../../src/app/services/SettingsService';
import { RenderScheduler } from '../../src/app/pixi/RenderScheduler';
import { fakeApp, fakeGroup } from '../mocks/schedulerApp';

vi.mock('../../src/app/atlas-view', () => ({ AtlasView: class AtlasView {}, ATLAS_VIEW_TYPE: 'atlas-vtt' }));

import { AtlasView } from '../../src/app/atlas-view';
import { followedScene, onFollowedScene, registerFollowedScene, type FollowedScene } from '../../src/app/services/followedScene';

interface SceneState { isMapLoading: boolean; mapLoaded: boolean; mapPath: string | null }

/** An Atlas view whose canvas belongs to `app`, by default one that renders on every tick. */
function fakeView(state: Partial<SceneState> = {}, app?: Application) {
  const atlasStore = createStore<SceneState>(() => ({ isMapLoading: false, mapLoaded: true, mapPath: 'tavern.atlasmap', ...state }));
  const canvas = document.createElement('canvas');
  const withPlayerSafeFrame = vi.fn((capture: () => void) => capture());
  const renderer = { getAppInstance: () => (app ? Object.assign(app, { canvas }) : { canvas }), withPlayerSafeFrame };
  const closers: Array<() => void> = [];
  const view = {
    atlasStore,
    serviceManager: { getRendererService: () => ({ getRenderer: () => renderer, getViewport: () => undefined }) },
    register: (closer: () => void) => closers.push(closer),
  };
  Object.setPrototypeOf(view, AtlasView.prototype);
  return { view, canvas, withPlayerSafeFrame, atlasStore, close: () => closers.forEach((closer) => closer()) };
}

/** A plugin whose workspace holds `views`; `layoutChanged` tells it the layout changed. */
function fakePlugin() {
  const leaves: Array<{ view: unknown }> = [];
  let onLayoutChange = (): void => {};
  const cleanups: Array<() => void> = [];
  const plugin = {
    app: { workspace: {
      onLayoutReady: (callback: () => void) => callback(),
      on: (_name: string, callback: () => void) => { onLayoutChange = callback; return {}; },
      getLeavesOfType: () => leaves,
    } },
    registerEvent: vi.fn(),
    register: (cleanup: () => void) => cleanups.push(cleanup),
  };
  return {
    plugin: plugin as unknown as Plugin,
    open: (view: unknown) => { leaves.splice(0, leaves.length, { view }); onLayoutChange(); },
    closeAll: () => { leaves.length = 0; onLayoutChange(); },
    unload: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

const settings = (): ReturnType<SettingsService['getLocalPlayerViewSettings']> => new SettingsService({} as never).getLocalPlayerViewSettings();

describe('followed scene', () => {
  let workspace: ReturnType<typeof fakePlugin>;
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    workspace = fakePlugin();
    registerFollowedScene(workspace.plugin);
  });
  afterEach(() => {
    workspace.unload();
    vi.unstubAllGlobals();
  });

  test('follows the Atlas view once its scene is shown, capturing through the renderer', async () => {
    const { view, canvas, withPlayerSafeFrame } = fakeView();
    workspace.open(view);
    expect(followedScene()).toBeNull();

    await vi.waitFor(() => expect(followedScene()?.view).toBe(view));
    const { source } = followedScene()!;
    expect(source.canvas).toBe(canvas);
    // Frames are captured through the renderer so DM-only layers stay out of the player view.
    const capture = vi.fn();
    source.withPlayerSafeFrame(capture, settings());
    expect(withPlayerSafeFrame).toHaveBeenCalledWith(capture, settings(), undefined);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(source.beforeRender).toBeUndefined();
  });

  test('waits for the first scene of a view that is still loading', async () => {
    const { view, atlasStore } = fakeView({ isMapLoading: true, mapLoaded: false });
    workspace.open(view);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(followedScene()).toBeNull();

    atlasStore.setState({ isMapLoading: false, mapLoaded: true });
    await vi.waitFor(() => expect(followedScene()?.view).toBe(view));
  });

  test('gives players no scene once the view closes, and the next view that opens', async () => {
    const seen: Array<FollowedScene | null> = [];
    onFollowedScene((scene) => seen.push(scene));
    const first = fakeView();
    workspace.open(first.view);
    await vi.waitFor(() => expect(followedScene()?.view).toBe(first.view));

    first.close();
    expect(followedScene()).toBeNull();
    expect(seen.at(-1)).toBeNull();

    const next = fakeView();
    workspace.open(next.view);
    await vi.waitFor(() => expect(followedScene()?.view).toBe(next.view));
    workspace.closeAll();
    expect(followedScene()).toBeNull();
  });

  test('offers captures right before the renders of a canvas that renders on change', async () => {
    const { app, ticker } = fakeApp(fakeGroup());
    new RenderScheduler(app);
    ticker.update(16);
    const { view, withPlayerSafeFrame } = fakeView({}, app);
    workspace.open(view);
    await vi.waitFor(() => expect(followedScene()).not.toBeNull());
    const beforeRender = followedScene()!.source.beforeRender!;
    const listener = vi.fn();
    const stop = beforeRender.listen(listener);

    ticker.update(32);
    expect(listener).not.toHaveBeenCalled();
    beforeRender.requestRender();
    ticker.update(48);
    expect(listener).toHaveBeenCalledWith(48);

    const capture = vi.fn();
    beforeRender.withPlayerSafeFrame(capture, settings());
    expect(withPlayerSafeFrame).toHaveBeenCalledWith(capture, settings(), undefined, true);

    stop();
    beforeRender.requestRender();
    ticker.update(64);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
