import { Application, Container, Text } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { StoreApi } from 'zustand';
import type { ViewAtlasState } from '../../storeFactory';
import { LASER_PIECE_INTERVAL, type SharedLaser } from '../../canvas/sharedLasers';
import { t } from '../../i18n';
import { destroyTree } from '../utils/destroyTree';
import { usesCanvasRenderer } from '../utils/rendererType';
import { MAX_TRAIL_SAMPLES } from './laserBeamGeometry';
import { LaserBeam, beamWidth, type LaserBeamView } from './LaserBeam';
import { CanvasLaserBeam } from './CanvasLaserBeam';
import { beamTrail, isLive, type TrailPoint } from './laserTrail';

/** The name's size on screen, in pixels at any zoom. */
const NAME_FONT_SIZE = 13;
/** Gap between the beam's glow and the name, in screen pixels. */
const NAME_GAP = 4;

/** One laser of someone else, played back as it was drawn. */
interface RemoteLaser {
  /** Points waiting for their time and points showing, oldest first. */
  trail: TrailPoint[];
  pressing: boolean;
  /** A change of `pressing` that takes effect with the points sent along with it. */
  pendingPress: { at: number; pressing: boolean } | null;
  /** The newest point shown, where a laser held still keeps its spot. */
  head: { x: number; y: number } | null;
  color: string;
  size: number;
  beam: LaserBeamView;
  name: Text;
}

/**
 * The lasers of the others at an online table (`sharedLasers`): the DM's and other players' on a
 * player's page, the players' on the DM's map (and so in the player window). Each is drawn as its
 * owner draws it, in their colour and size, played back `LASER_PIECE_INTERVAL` late so pieces join
 * smoothly, with their name by its tip. Lasers show over everything: pointing is meant to be seen.
 */
export class RemoteLasers {
  readonly container = new Container({ label: 'remote-lasers-layer' });
  private readonly lasers = new Map<string, RemoteLaser>();
  private readonly unsubscribe: () => void;
  private tickerCallback: (() => void) | null = null;
  /** A laser held still draws nothing new, but its width and name follow the zoom. */
  private readonly onZoomed = (): void => {
    if (this.lasers.size > 0) this.startTicker();
  };

  constructor(private readonly viewport: Viewport, private readonly pixiApp: Application, store: StoreApi<ViewAtlasState>) {
    this.container.eventMode = 'none';
    this.container.interactiveChildren = false;
    this.unsubscribe = store.subscribe((state, previous) => {
      if (state.sharedLasers !== previous.sharedLasers) this.take(state.sharedLasers, previous.sharedLasers);
    });
    viewport.on('zoomed', this.onZoomed);
  }

  destroy(): void {
    this.unsubscribe();
    this.viewport.off('zoomed', this.onZoomed);
    this.stopTicker();
    destroyTree(this.container);
    for (const laser of this.lasers.values()) laser.beam.destroy();
    this.lasers.clear();
  }

  private take(lasers: ViewAtlasState['sharedLasers'], previous: ViewAtlasState['sharedLasers']): void {
    const now = Date.now();
    for (const [who, piece] of Object.entries(lasers)) {
      if (piece !== previous[who]) this.receive(who, piece, now);
    }
    for (const who of Object.keys(previous)) {
      if (!lasers[who]) this.remove(who);
    }
    this.startTicker();
  }

  private receive(who: string, piece: SharedLaser, now: number): void {
    const laser = this.lasers.get(who) ?? this.add(who, piece);
    laser.color = piece.color;
    laser.size = piece.size;
    laser.name.text = piece.name ?? t('laser.gmName');
    laser.name.style.fill = piece.color;
    const shownAt = now + LASER_PIECE_INTERVAL;
    for (const { x, y, age } of piece.points) laser.trail.push({ x, y, timestamp: shownAt - age });
    if (laser.trail.length > MAX_TRAIL_SAMPLES) laser.trail.splice(0, laser.trail.length - MAX_TRAIL_SAMPLES);
    if (piece.pressing !== laser.pressing) laser.pendingPress = { at: shownAt, pressing: piece.pressing };
  }

  private add(who: string, piece: SharedLaser): RemoteLaser {
    const beam = usesCanvasRenderer(this.pixiApp.renderer) ? new CanvasLaserBeam() : new LaserBeam();
    const name = new Text({ text: '', style: { fontSize: NAME_FONT_SIZE, fontWeight: '600', fill: piece.color, stroke: { color: 0x000000, width: 3 } } });
    name.visible = false;
    this.container.addChild(beam.view, name);
    const laser: RemoteLaser = { trail: [], pressing: false, pendingPress: null, head: null, color: piece.color, size: piece.size, beam, name };
    this.lasers.set(who, laser);
    return laser;
  }

  private remove(who: string): void {
    const laser = this.lasers.get(who);
    if (!laser) return;
    destroyTree(laser.beam.view);
    laser.beam.destroy();
    destroyTree(laser.name);
    this.lasers.delete(who);
  }

  private startTicker(): void {
    if (this.tickerCallback) return;
    this.tickerCallback = (): void => this.tick();
    this.pixiApp.ticker.add(this.tickerCallback);
  }

  private stopTicker(): void {
    if (!this.tickerCallback) return;
    this.pixiApp.ticker.remove(this.tickerCallback);
    this.tickerCallback = null;
  }

  private tick(): void {
    const now = Date.now();
    let busy = false;
    for (const laser of this.lasers.values()) busy = this.draw(laser, now) || busy;
    if (!busy) this.stopTicker();
  }

  /** Draws `laser` as it stands at `now`; returns whether it still changes. */
  private draw(laser: RemoteLaser, now: number): boolean {
    if (laser.pendingPress && laser.pendingPress.at <= now) {
      laser.pressing = laser.pendingPress.pressing;
      laser.pendingPress = null;
    }
    laser.trail = laser.trail.filter((point) => isLive(point, now));
    const shown = laser.trail.filter((point) => point.timestamp <= now);
    const newest = shown[shown.length - 1];
    if (newest) laser.head = { x: newest.x, y: newest.y };
    if (!laser.pressing && shown.length === 0) laser.head = null;

    const zoom = this.viewport.scale.x || 1;
    const width = beamWidth(laser.size, zoom);
    const trail = beamTrail(shown, now);
    // While pressed, the beam runs up to its tip at full strength, as it does for its owner
    if (laser.pressing && laser.head) trail.push({ ...laser.head, life: 1 });
    const pointer = laser.pressing ? laser.head : null;
    laser.beam.draw({ trail, dot: null, pointer, color: laser.color, width, zoom });
    this.placeName(laser, zoom, width.halfWidth);

    return laser.trail.length > 0 || laser.pendingPress !== null;
  }

  private placeName(laser: RemoteLaser, zoom: number, halfWidth: number): void {
    const { name, head } = laser;
    name.visible = head !== null;
    if (!head) return;
    const offset = halfWidth + NAME_GAP / zoom;
    name.scale.set(1 / zoom);
    name.position.set(head.x + offset, head.y - offset - name.height);
  }
}
