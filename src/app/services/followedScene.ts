import type { Plugin } from 'obsidian';
import type { AtlasView } from '../atlas-view';
import { getLoadedAtlasView } from '../plugin/atlasLeaves';
import { rendersOnChange, requestRender, setBeforeRender } from '../pixi/RenderScheduler';
import { showsScene, type PlayerFrameSource } from './PlayerFrameMirror';

/** The scene every player screen shows: the Atlas view, whose active scene tab it is, and its canvas. */
export interface FollowedScene {
  view: AtlasView;
  source: PlayerFrameSource;
}

type Listener = (scene: FollowedScene | null) => void;

let current: FollowedScene | null = null;
/** The Atlas view being followed, also while its first scene still loads. */
let followedView: AtlasView | null = null;
const listeners = new Set<Listener>();
/** Views that already stop being followed when they close. */
const viewsReleasingOnClose = new WeakSet<AtlasView>();

/**
 * Players follow the GM: online players and the local player window always show the scene of
 * the Atlas view's active tab. All tabs share one store and one canvas, so a scene switch reaches
 * them through that store, held while it loads; nothing is presented by hand. Closing the view
 * leaves players without a scene until one opens again.
 */
export function registerFollowedScene(plugin: Plugin): void {
  const check = (): void => followView(getLoadedAtlasView(plugin.app));
  plugin.app.workspace.onLayoutReady(check);
  plugin.registerEvent(plugin.app.workspace.on('layout-change', check));
  plugin.register(() => {
    followedView = null;
    current = null;
    listeners.clear();
  });
}

/** The scene players see now, or null while no Atlas view shows one. */
export function followedScene(): FollowedScene | null {
  return current;
}

/** Calls `listener` whenever players are given another scene, or none; returns what stops it. */
export function onFollowedScene(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Resolves with the followed scene as soon as there is one. */
export function nextFollowedScene(): Promise<FollowedScene> {
  if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    const stop = onFollowedScene((scene) => {
      if (!scene) return;
      stop();
      resolve(scene);
    });
  });
}

function followView(view: AtlasView | null): void {
  if (view === followedView) return;
  followedView = view;
  setCurrent(null);
  if (!view) return;
  if (!viewsReleasingOnClose.has(view)) {
    viewsReleasingOnClose.add(view);
    // A closed view's store and renderer must not stay reachable from the player screens
    view.register(() => {
      if (followedView === view) followView(null);
    });
  }
  void untilSceneShown(view).then(() => {
    if (followedView !== view) return;
    const source = frameSourceOf(view);
    if (source) setCurrent({ view, source });
  });
}

function setCurrent(scene: FollowedScene | null): void {
  if (scene === current) return;
  current = scene;
  listeners.forEach((listener) => listener(scene));
}

/** Resolves once the view's store first holds a whole scene, then after two drawn frames. */
async function untilSceneShown(view: AtlasView): Promise<void> {
  const store = view.atlasStore;
  if (!showsScene(store.getState())) {
    await new Promise<void>((resolve) => {
      const unsubscribe = store.subscribe((state) => {
        if (!showsScene(state) && followedView === view) return;
        unsubscribe();
        resolve();
      });
    });
  }
  await nextAnimationFrames(2);
}

/** What the player window mirrors and the online session reads: the view's canvas and store. */
function frameSourceOf(view: AtlasView): PlayerFrameSource | null {
  const renderer = view.serviceManager.getRendererService().getRenderer();
  const app = renderer?.getAppInstance();
  const canvas = app?.canvas;
  if (!renderer || !app || !canvas?.instanceOf(HTMLCanvasElement)) return null;
  return {
    canvas,
    store: view.atlasStore,
    withPlayerSafeFrame: (capture, settings, camera) => renderer.withPlayerSafeFrame(capture, settings, camera),
    ...(rendersOnChange(app) ? {
      beforeRender: {
        listen: (listener) => setBeforeRender(app, listener),
        requestRender: () => requestRender(app),
        withPlayerSafeFrame: (capture, settings, camera) => renderer.withPlayerSafeFrame(capture, settings, camera, true),
      },
    } : {}),
    getCamera: () => {
      const viewport = view.serviceManager.getRendererService().getViewport();
      return viewport ? { centerX: viewport.center.x, centerY: viewport.center.y, scale: viewport.scale.x } : undefined;
    },
  };
}

function nextAnimationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number): void => {
      if (remaining === 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}
