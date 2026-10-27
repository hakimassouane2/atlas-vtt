/**
 * Token drag ruler: while a token is dragged, measures the path from where it
 * started to the cell it would land in and labels the distance at the path's middle.
 * Space adds a waypoint at the current landing cell; the distance adds up
 * across waypoints, and difficult terrain on the way costs what the rules say
 * (`movementCostInCells`). The token still drops where the pointer is released. The path
 * goes to `publish` (a view's `localRuler`), so an online table sees it too.
 */

import type { StoreApi } from 'zustand';
import type { GridSystem } from '../../grid/GridSystem';
import type { GridGeometry } from '../../grid/gridDistance';
import { movementCostInCells } from '../../grid/movementCost';
import { tokenCenterShift } from '../../grid/gridPlacement';
import type { Point } from '../../grid/hexGeometry';
import { formatDistance, type MeasurementSettings } from '../../grid/measurementFormat';
import type { ViewAtlasState } from '../../storeFactory';
import type { LayerVisibility } from '../playerSafeFrame';
import type { RulerPath } from '../../canvas/sharedRulers';
import type { DragRulerView } from './DragRulerView';
import { levelObjects } from '../../levels/levelObjects';
import { computeTokenPixelSize, tokenDiameterInCells } from './tokenSizing';
import { difficultCells } from '../../mapFeatures/featureIndex';
import { mapFeatureList } from '../../mapFeatures/mapFeatures';
import { mapTokens } from '../../tokens/offMap';

/** What a drag ruler measures: the token and the points it runs through (its start, each waypoint, its landing). */
export interface DragRulerPath {
  readonly tokenId: string;
  readonly points: readonly Point[];
}

export class DragRuler {
  private tokenId: string | null = null;
  /** The snapped start followed by every waypoint. */
  private waypoints: Point[] = [];
  private landing: Point | null = null;
  /** Where the dragged token is drawn now: the line ends under its centre, wherever it snaps to. */
  private tip: Point | null = null;
  private keyWindow: Window | null = null;

  constructor(
    private readonly view: DragRulerView,
    private readonly gridSystem: GridSystem,
    private readonly store: Pick<StoreApi<ViewAtlasState>, 'getState'>,
    private readonly settingsProvider: () => MeasurementSettings,
    private readonly tokenVisible: (tokenId: string) => boolean = () => true,
    private readonly publishRuler: (ruler: RulerPath | null) => void = () => undefined,
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

  /** Measures to the cell a token at `position` would snap to, and draws the line to `position` itself. */
  update(position: Point): void {
    if (!this.tokenId) return;
    this.landing = this.snap(position);
    this.tip = { x: position.x, y: position.y };
    this.redraw();
  }

  end(): void {
    this.keyWindow?.removeEventListener('keydown', this.onKeyDown, true);
    this.keyWindow = null;
    const measured = this.tokenId !== null;
    this.tokenId = null;
    this.waypoints = [];
    this.landing = null;
    this.tip = null;
    this.view.clear();
    if (measured) this.publishRuler(null);
  }

  /** The path the ruler shows now, or null while it shows none (no drag, or one that has not left its start). */
  path(): DragRulerPath | null {
    const landing = this.landing;
    if (!this.tokenId || !landing || this.waypoints.every(point => samePoint(point, landing))) return null;
    return { tokenId: this.tokenId, points: [...this.waypoints, landing] };
  }

  /** Players never see the ruler of a token hidden from them, or of one they do not see (`isSeen`, with dynamic lighting). */
  getPlayerViewLayers(isSeen: (tokenId: string) => boolean = () => true): LayerVisibility[] {
    const token = this.tokenId ? mapTokens(levelObjects(this.store.getState()))[this.tokenId] : undefined;
    const shown = !token || (!token.isHidden && isSeen(token.id));
    return shown ? [] : this.view.layers.map(layer => ({ layer, visible: false }));
  }

  /** A held token can enter fog without ending its measured drag. */
  refreshVisibility(): void {
    const landing = this.landing;
    if (!this.tokenId || !landing) return;
    const visible = this.tokenVisible(this.tokenId) && this.waypoints.some((point) => !samePoint(point, landing));
    for (const layer of this.view.layers) layer.visible = visible;
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
    if (this.tokenId) this.publishRuler({ tokenId: this.tokenId, waypoints: [...this.waypoints] });
  }

  private redraw(): void {
    if (!this.landing || !this.tokenId) return;
    drawRuler(this.view, this.gridSystem, this.settingsProvider(), this.store.getState(), this.tokenId, [...this.waypoints, this.landing], this.tip);
    this.refreshVisibility();
  }

  private snap(point: Point): Point {
    return this.tokenId ? snapRulerPoint(this.store.getState(), this.gridSystem, this.tokenId, point) : point;
  }
}

/** Where a ruler of `tokenId` ends for the token at `point`: the cell it would land in. */
export function snapRulerPoint(state: RulerState, gridSystem: GridSystem, tokenId: string, point: Point): Point {
  if (!snapsToGrid(state)) return { x: point.x, y: point.y };
  return gridSystem.snapTokenCenter(point.x, point.y, tokenSize(state, tokenId));
}

/** What a ruler reads of the scene: the grid, and the tokens and map features of the level shown. */
type RulerState = Pick<ViewAtlasState, 'grid' | 'objects' | 'levels' | 'viewedLevel'>;

/**
 * Draws a ruler of `tokenId` through `points` (start, waypoints, landing) with its distance, or nothing
 * while it has not moved. The line ends at `tip` (where the token is drawn now) when given, and takes
 * `color` (`#rrggbb`) or the accent.
 */
export function drawRuler(
  view: DragRulerView,
  gridSystem: GridSystem,
  settings: MeasurementSettings,
  state: RulerState,
  tokenId: string,
  points: readonly Point[],
  tip?: Point | null,
  color?: string,
): void {
  const landing = points[points.length - 1];
  if (!landing || points.every(point => samePoint(point, landing))) {
    view.clear();
    return;
  }
  const grid = gridSystem.getOptions();
  const features = mapFeatureList(levelObjects(state).mapFeatures);
  const rules = { diagonalRule: settings.diagonalRule, difficultTerrain: settings.difficultTerrain, difficult: difficultCells(features) };
  const size = tokenSize(state, tokenId);
  const footprint = snapsToGrid(state) ? tokenDiameterInCells(size) : 1;
  const cells = movementCostInCells(grid, cellPath(state, tokenId, points, grid), rules, footprint);
  const drawn = tip ? [...points.slice(0, -1), tip] : points;
  const distance = formatDistance(cells, settings);
  const tokenRadius = computeTokenPixelSize(grid.size, size) / 2;
  // A ruler of one's own takes the accent
  if (color) view.draw(drawn, distance, tokenRadius, grid.size, color);
  else view.draw(drawn, distance, tokenRadius, grid.size);
}

/**
 * The snapped path as the cells the token's footprint starts from. An even footprint snaps to where
 * cells meet, and on a hex grid that point lies in none of the three hexes around it: which one the
 * rounding picks differs from place to place, so the same drag measured a hex more or less.
 */
function cellPath(state: RulerState, tokenId: string, points: readonly Point[], grid: GridGeometry): readonly Point[] {
  if (!snapsToGrid(state)) return points;
  const shift = tokenCenterShift(grid.type, grid.size, tokenSize(state, tokenId));
  return points.map(point => ({ x: point.x - shift.x, y: point.y - shift.y }));
}

function snapsToGrid(state: Pick<ViewAtlasState, 'grid'>): boolean {
  return state.grid?.snapToGrid ?? true;
}

function tokenSize(state: RulerState, tokenId: string): number {
  return mapTokens(levelObjects(state))[tokenId]?.size || 1;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}
