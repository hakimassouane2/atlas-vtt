import type { PlayerCameraState } from '../local-player-view';
import type { PlayerScreen } from './PlayerFrameRenderer';

/** Frames larger than this are scaled down: encoding cost grows with the pixel count. */
const MAX_FRAME_WIDTH = 2560;
const MAX_FRAME_HEIGHT = 1600;
const MIN_FPS = 1;
const MAX_FPS = 60;
const DEFAULT_FPS = 30;
/** Zoom limits, in CSS pixels per world pixel. */
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 20;

export const FRAME_QUALITIES = { low: 0.6, medium: 0.8, high: 0.92 } as const;
export type FrameQuality = keyof typeof FRAME_QUALITIES;

/** What a player's browser asks for, from the query of its event stream. */
export interface PlayerStreamRequest {
  screen: PlayerScreen;
  fps: number;
  quality: FrameQuality;
}

/** Reads `w`, `h` (device pixels), `cw` (CSS width), `fps` and `q` from a player's query. */
export function parseStreamRequest(params: URLSearchParams): PlayerStreamRequest {
  const width = positiveInteger(params.get('w'), 1280);
  const height = positiveInteger(params.get('h'), 720);
  const cssWidth = positiveInteger(params.get('cw'), width);
  const fit = Math.min(1, MAX_FRAME_WIDTH / width, MAX_FRAME_HEIGHT / height);
  const quality = params.get('q');
  return {
    screen: { width: Math.round(width * fit), height: Math.round(height * fit), cssWidth },
    fps: Math.min(MAX_FPS, Math.max(MIN_FPS, positiveInteger(params.get('fps'), DEFAULT_FPS))),
    quality: quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'high',
  };
}

/** A camera a player moved to, or `recenter` to go back to the DM's framing. */
export type CameraRequest = PlayerCameraState | 'recenter';

/** Reads `{ centerX, centerY, scale }` or `{ recenter: true }` from a player's camera request. */
export function parseCameraRequest(value: unknown): CameraRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const body = value as Record<string, unknown>;
  if (body.recenter === true) return 'recenter';
  const { centerX, centerY, scale } = body;
  if (!isFiniteNumber(centerX) || !isFiniteNumber(centerY) || !isFiniteNumber(scale) || scale <= 0) return null;
  return { centerX, centerY, scale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)) };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positiveInteger(value: string | null, fallback: number): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
