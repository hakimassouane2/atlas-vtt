/**
 * Token drag ruler: while a token is dragged, measures the path from where it
 * started to the cell it would land in and labels the distance at the path's middle.
 * Space adds a waypoint at the current landing cell; the distance adds up
 * across waypoints. The token still drops where the pointer is released. The path
 * is published in the store (`localRuler`), so an online table sees it too.
 */

import type { StoreApi } from 'zustand';
import type { GridSystem } from '../../grid/GridSystem';
import { pathLengthInCells } from '../../grid/gridDistance';
import type { Point } from '../../grid/hexGeometry';
import { formatDistance, type MeasurementSettings } from '../../grid/measurementFormat';
import type { ViewAtlasState } from '../../storeFactory';
import type { LayerVisibility } from '../playerSafeFrame';
import type { DragRulerView } from './DragRulerView';

export class DragRuler {
  private tokenId: string | null = null;
  /** The snapped start followed by every waypoint. */
  private waypoints: Point[] = [];
  private landing: Point | null = null;
  private keyWindow: Window | null = null;

  constructor(
    private readonly view: DragRulerView,
    private readonly gridSystem: GridSystem,
    private readonly store: Pick<StoreApi<ViewAtlasState>, 'getState'>,
    private readonly settingsProvider: () => MeasurementSettings,
  ) {}

  /** Starts measuring a drag of `tokenId`, which started at `origin`. */
  begin(tokenId: string, origin: Point): void {
    this.end();
    this.tokenId = tokenId;
    this.waypoints = [this.snap(origin)];
    this.publish();
    this.keyWindow = activeWindow;
    this.keyWindow.addEventListener('keydown', this.onKeyDown, true);
  }

  /** Moves the ruler's end to the cell a token at `position` would snap to. */
  update(position: Point): void {
    if (!this.tokenId) return;
    this.landing = this.snap(position);
    this.redraw();
  }

  end(): void {
    this.keyWindow?.removeEventListener('keydown', this.onKeyDown, true);
    this.keyWindow = null;
    const measured = this.tokenId !== null;
    this.tokenId = null;
    this.waypoints = [];
    this.landing = null;
    this.view.clear();
    if (measured) this.store.getState().setLocalRuler(null);
  }

  /** Players never see the ruler of a token hidden from them, or of one they do not see (`isSeen`, with dynamic lighting). */
  getPlayerViewLayers(isSeen: (tokenId: string) => boolean = () => true): LayerVisibility[] {
    const token = this.tokenId ? this.store.getState().objects.tokens[this.tokenId] : undefined;
    const shown = !token || (!token.isHidden && isSeen(token.id));
    return shown ? [] : this.view.layers.map(layer => ({ layer, visible: false }));
  }

  destroy(): void {
    this.end();
    this.view.destroy();
  }

  /** Captures Space before the map hotkeys, which would open the command palette mid-drag. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    const last = this.waypoints[this.waypoints.length - 1];
    if (event.repeat || !this.landing || (last && samePoint(last, this.landing))) return;
    this.waypoints.push(this.landing);
    this.publish();
    this.redraw();
  };

  private publish(): void {
    if (this.tokenId) this.store.getState().setLocalRuler({ tokenId: this.tokenId, waypoints: [...this.waypoints] });
  }

  private redraw(): void {
    if (this.landing) drawRuler(this.view, this.gridSystem, this.settingsProvider(), [...this.waypoints, this.landing]);
  }

  private snap(point: Point): Point {
    return this.tokenId ? snapRulerPoint(this.store.getState(), this.gridSystem, this.tokenId, point) : point;
  }
}

/** Where a ruler of `tokenId` ends for the token at `point`: the cell it would land in. */
export function snapRulerPoint(state: Pick<ViewAtlasState, 'grid' | 'objects'>, gridSystem: GridSystem, tokenId: string, point: Point): Point {
  const snapToGrid = state.grid?.snapToGrid ?? true;
  if (!snapToGrid) return { x: point.x, y: point.y };
  const size = state.objects.tokens[tokenId]?.size;
  return gridSystem.snapTokenCenter(point.x, point.y, size || 1);
}

/** Draws a ruler through `points` (start, waypoints, landing) with its distance, or nothing while it has not moved. */
export function drawRuler(view: DragRulerView, gridSystem: GridSystem, settings: MeasurementSettings, points: readonly Point[], color?: string): void {
  const landing = points[points.length - 1];
  if (!landing || points.every(point => samePoint(point, landing))) {
    view.clear();
    return;
  }
  const distance = formatDistance(pathLengthInCells(gridSystem.getOptions(), [...points], settings.diagonalRule), settings);
  // A ruler of one's own takes the accent
  if (color) view.draw(points, distance, color);
  else view.draw(points, distance);
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}
