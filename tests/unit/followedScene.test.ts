import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { createStore } from 'zustand/vanilla';

vi.mock('../../src/app/atlas-view', () => ({ AtlasView: class AtlasView {}, ATLAS_VIEW_TYPE: 'atlas-vtt' }));

import { AtlasView } from '../../src/app/atlas-view';
import { followedScene, onFollowedScene, registerFollowedScene, type FollowedScene } from '../../src/app/services/followedScene';

interface SceneState { isMapLoading: boolean; mapLoaded: boolean; mapPath: string | null }

/** An Atlas view with its store. */
function fakeView(state: Partial<SceneState> = {}) {
  const atlasStore = createStore<SceneState>(() => ({ isMapLoading: false, mapLoaded: true, mapPath: 'tavern.atlasmap', ...state }));
  const closers: Array<() => void> = [];
  const view = {
    atlasStore,
    register: (closer: () => void) => closers.push(closer),
  };
  Object.setPrototypeOf(view, AtlasView.prototype);
  return { view, atlasStore, close: () => closers.forEach((closer) => closer()) };
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

  test('follows the Atlas view once its scene is shown, with its store', async () => {
    const { view, atlasStore } = fakeView();
    workspace.open(view);
    expect(followedScene()).toBeNull();

    await vi.waitFor(() => expect(followedScene()?.view).toBe(view));
    expect(followedScene()!.store).toBe(atlasStore);
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
});
