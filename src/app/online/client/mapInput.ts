import type { PlayerToken } from '../playerTokens';
import { clampZoom, playerCamera, type Camera } from './camera';
import { byId } from './dom';
import { playerStateStore } from './playerState';
import { post } from './session';

interface Point {
  x: number;
  y: number;
}

/** A token being dragged: where the pointer grabbed it and where it would land. */
interface TokenDrag {
  id: string;
  offset: Point;
  to: Point;
}

/** The camera being panned: where the pointer and the camera started. */
interface Pan {
  from: Point;
  camera: Camera;
}

/** Dropped tokens stay drawn where they land until the DM's Atlas has moved them, at most this long. */
const LANDING_MS = 1500;
const WHEEL_ZOOM_SPEED = 0.0015;

const overlay = (): HTMLCanvasElement => byId<HTMLCanvasElement>('overlay');
let hovered: string | null = null;
let drag: TokenDrag | null = null;
let pan: Pan | null = null;
const landing = new Map<string, Point>();

const tokens = (): PlayerToken[] => playerStateStore.getState()?.tokens ?? [];

function tokenAt(clientX: number, clientY: number, camera: Camera): PlayerToken | undefined {
  const point = playerCamera.toWorld(clientX, clientY, camera);
  return tokens().find((token) => Math.hypot(point.x - token.x, point.y - token.y) <= token.radius);
}

/** Draws the hover ring, and the start and landing rings of dragged and dropped tokens. */
export function drawOverlay(): void {
  const canvas = overlay();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(innerWidth * ratio);
  const height = Math.round(innerHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  const camera = playerCamera.current;
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, innerWidth, innerHeight);
  if (!camera) return;
  const ring = (token: PlayerToken, at: Point, color: string, dash: number[]): void => {
    const center = playerCamera.toScreen(at.x, at.y, camera);
    context.beginPath();
    context.setLineDash(dash);
    context.lineWidth = 3;
    context.strokeStyle = color;
    context.arc(center.x, center.y, token.radius * camera.zoom + 2, 0, Math.PI * 2);
    context.stroke();
  };
  for (const token of tokens()) {
    const target = drag?.id === token.id ? drag.to : landing.get(token.id);
    if (target) {
      ring(token, token, 'rgba(255, 255, 255, 0.35)', [6, 6]);
      ring(token, target, 'rgba(120, 200, 255, 0.95)', []);
    } else if (hovered === token.id) {
      ring(token, token, 'rgba(120, 200, 255, 0.8)', []);
    }
  }
}

/** Forgets landing rings once the DM's Atlas moved the token there. */
export function settleLandings(): void {
  for (const token of tokens()) {
    const target = landing.get(token.id);
    if (target && Math.hypot(target.x - token.x, target.y - token.y) < token.radius) landing.delete(token.id);
  }
}

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

function pointerDown(event: PointerEvent): void {
  const camera = playerCamera.current;
  if (!camera) return;
  const token = event.button === LEFT_BUTTON ? tokenAt(event.clientX, event.clientY, camera) : undefined;
  if (token) {
    const point = playerCamera.toWorld(event.clientX, event.clientY, camera);
    drag = { id: token.id, offset: { x: token.x - point.x, y: token.y - point.y }, to: { x: token.x, y: token.y } };
  } else if (event.button === RIGHT_BUTTON && !playerCamera.isFollowingDm) {
    pan = { from: { x: event.clientX, y: event.clientY }, camera: { ...camera } };
    overlay().classList.add('is-panning');
  } else {
    return;
  }
  overlay().setPointerCapture(event.pointerId);
  drawOverlay();
}

function pointerMove(event: PointerEvent): void {
  const camera = playerCamera.current;
  if (!camera) return;
  if (drag) {
    const point = playerCamera.toWorld(event.clientX, event.clientY, camera);
    drag.to = { x: point.x + drag.offset.x, y: point.y + drag.offset.y };
  } else if (pan) {
    playerCamera.move({
      centerX: pan.camera.centerX - (event.clientX - pan.from.x) / camera.zoom,
      centerY: pan.camera.centerY - (event.clientY - pan.from.y) / camera.zoom,
      zoom: camera.zoom,
    });
    return;
  } else {
    const token = tokenAt(event.clientX, event.clientY, camera);
    hovered = token?.id ?? null;
    overlay().classList.toggle('is-over-token', token !== undefined);
  }
  drawOverlay();
}

function pointerUp(): void {
  if (drag) {
    const { id, to } = drag;
    landing.set(id, to);
    window.setTimeout(() => {
      landing.delete(id);
      drawOverlay();
    }, LANDING_MS);
    post('/command', { type: 'move', id, x: to.x, y: to.y });
  }
  drag = null;
  pan = null;
  overlay().classList.remove('is-panning');
  drawOverlay();
}

function wheel(event: WheelEvent): void {
  event.preventDefault();
  const camera = playerCamera.current;
  if (!camera || playerCamera.isFollowingDm) return;
  const point = playerCamera.toWorld(event.clientX, event.clientY, camera);
  const zoom = clampZoom(camera.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED));
  // Keep the point under the cursor in place
  playerCamera.move({
    centerX: point.x - (event.clientX - innerWidth / 2) / zoom,
    centerY: point.y - (event.clientY - innerHeight / 2) / zoom,
    zoom,
  });
}

/** The left button drags the player's tokens, the right button pans the map, the wheel zooms. */
export function installMapInput(): void {
  const canvas = overlay();
  // The right button pans: no browser "save image" menu on the map
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', () => {
    drag = null;
    pointerUp();
  });
  canvas.addEventListener('wheel', wheel, { passive: false });
}
