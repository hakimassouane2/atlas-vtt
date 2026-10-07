import type { Container } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { StoreApi } from 'zustand';
import type { GridSystem } from '../../grid/GridSystem';
import type { MeasurementSettings } from '../../grid/measurementFormat';
import type { ViewAtlasState } from '../../storeFactory';
import { DragRulerView } from './DragRulerView';
import { drawRuler, snapRulerPoint } from './DragRuler';

/**
 * The drag rulers of the others at an online table (`sharedRulers`): the DM's and other players'
 * on a player's page, the players' on the DM's map. Each is drawn as the one who drags sees it,
 * through their start and waypoints to the cell their token would land in now, in their colour.
 * Players never see the ruler of a token hidden from them; the fog covers what lies under it.
 */
export class SharedDragRulers {
  private readonly views = new Map<string, DragRulerView>();
  private readonly unsubscribe: () => void;
  private readonly redraw = (): void => this.sync(this.store.getState());

  constructor(
    private readonly viewport: Viewport,
    private readonly tokenLayer: Container,
    private readonly gridSystem: GridSystem,
    private readonly store: StoreApi<ViewAtlasState>,
    private readonly settingsProvider: () => MeasurementSettings,
  ) {
    this.unsubscribe = store.subscribe((state, previous) => {
      if (state.sharedRulers !== previous.sharedRulers || state.objects.tokens !== previous.objects.tokens) this.sync(state);
    });
    // The label keeps its size on screen
    viewport.on('zoomed', this.redraw);
    this.sync(store.getState());
  }

  destroy(): void {
    this.unsubscribe();
    this.viewport.off('zoomed', this.redraw);
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
  }

  private sync(state: ViewAtlasState): void {
    const { sharedRulers } = state;
    for (const [key, view] of this.views) {
      if (sharedRulers[key]) continue;
      view.destroy();
      this.views.delete(key);
    }
    if (Object.keys(sharedRulers).length === 0) return;
    const settings = this.settingsProvider();
    for (const [key, ruler] of Object.entries(sharedRulers)) {
      let view = this.views.get(key);
      if (!view) {
        view = new DragRulerView(this.viewport, this.tokenLayer);
        this.views.set(key, view);
      }
      const token = state.objects.tokens[ruler.tokenId];
      if (!token || (state.isPlayerView && token.isHidden)) {
        view.clear();
        continue;
      }
      const landing = snapRulerPoint(state, this.gridSystem, token.id, { x: token.x, y: token.y });
      drawRuler(view, this.gridSystem, settings, [...ruler.waypoints, landing], ruler.color);
    }
  }
}
