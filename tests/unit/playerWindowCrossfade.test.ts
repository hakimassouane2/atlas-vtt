import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LocalPlayerSession, LocalPlayerView } from '../../src/app/local-player-view';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import { SettingsService } from '../../src/app/services/SettingsService';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const transitions = vi.hoisted(() => ({
  frozen: [] as Array<{ target: HTMLCanvasElement; play: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; previous: unknown }>,
}));

vi.mock('../../src/app/pixi/sceneTransition', () => ({
  freezeCanvasFrame: vi.fn((target: HTMLCanvasElement, _paint: unknown, previous: unknown) => {
    const transition = { target, play: vi.fn(), cancel: vi.fn(), paintInto: vi.fn(), previous };
    transitions.frozen.push(transition);
    return transition;
  }),
}));
vi.mock('../../src/app/atlas-view', () => ({ AtlasView: class {}, ATLAS_VIEW_TYPE: 'atlas-vtt' }));

import type { PlayerFrameSource } from '../../src/app/services/PlayerFrameMirror';
import { PlayerWindowService } from '../../src/app/services/PlayerWindowService';
import { freezeCanvasFrame } from '../../src/app/pixi/sceneTransition';

afterEach(() => {
  PlayerWindowService.getInstance()?.destroy();
  transitions.frozen.length = 0;
  vi.restoreAllMocks();
});

/** A view store showing `mapPath`, as the DM's view holds a loaded scene. */
const SHOWN = { mapLoaded: true, isMapLoading: false };

/** The view's store loads `mapPath`, as when the DM opens another scene. */
function load(store: StoreApi<ViewAtlasState>, mapPath: string): void {
  store.setState({ isMapLoading: true });
  store.setState({ ...SHOWN, mapPath });
}

function setup(): { service: PlayerWindowService; source: PlayerFrameSource; store: StoreApi<ViewAtlasState>; doc: Document } {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage: vi.fn() } as never);
  const { app } = createInMemoryApp();
  const store = createStore(() => ({ ...SHOWN, mapPath: 'a.atlasmap' })) as unknown as StoreApi<ViewAtlasState>;
  const service = new PlayerWindowService(app, store, new SettingsService(app));
  const doc = document.implementation.createHTMLDocument();
  Object.defineProperty(doc, 'readyState', { value: 'complete' });
  Object.defineProperty(doc.body, 'win', { value: {
    document: doc, closed: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), close: vi.fn(),
    requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn(),
  } });
  const session: LocalPlayerSession = { frozen: false };
  const view = {
    contentEl: doc.body,
    getState: (): LocalPlayerSession => ({ ...session }),
    updateSession: (state: Partial<LocalPlayerSession>): void => { Object.assign(session, state); },
  };
  const source = { canvas: createEl('canvas'), withPlayerSafeFrame: vi.fn(), store };
  service.attachToView(view as unknown as LocalPlayerView, source);
  return { service, source, store, doc };
}

describe('player window scene crossfade', () => {
  it('crossfades what players see into the scene the DM opens, once it has loaded', () => {
    const { store, doc } = setup();
    store.setState({ isMapLoading: true });
    expect(transitions.frozen).toHaveLength(0);
    store.setState({ ...SHOWN, mapPath: 'b.atlasmap' });

    expect(transitions.frozen).toHaveLength(1);
    expect(transitions.frozen[0]!.target).toBe(doc.getElementById('atlas-player-canvas'));
    expect(transitions.frozen[0]!.play).toHaveBeenCalledTimes(1);
    // The player canvas samples nearest-neighbour, where a scale settle would crawl
    expect(freezeCanvasFrame).toHaveBeenCalledWith(expect.anything(), expect.any(Function), null, { settle: false });
  });

  it('does not animate when the scene players already see loads again', () => {
    const { store } = setup();
    load(store, 'a.atlasmap');

    expect(transitions.frozen).toHaveLength(0);
  });

  it('carries a running crossfade into the next one and drops it when the window closes', () => {
    const { service, store } = setup();
    load(store, 'b.atlasmap');
    load(store, 'c.atlasmap');
    expect(transitions.frozen[1]!.previous).toBe(transitions.frozen[0]);

    service.destroy();
    expect(transitions.frozen[1]!.cancel).toHaveBeenCalled();
  });
});
