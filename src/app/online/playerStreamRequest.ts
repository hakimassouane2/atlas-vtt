import type { PlayerScreen } from './PlayerFrameRenderer';

/** Frames larger than this are scaled down: encoding cost grows with the pixel count. */
const MAX_FRAME_WIDTH = 2560;
const MAX_FRAME_HEIGHT = 1600;
const MIN_FPS = 1;
const MAX_FPS = 60;
const DEFAULT_FPS = 30;

export const FRAME_QUALITIES = { low: 0.6, medium: 0.8, high: 0.92 } as const;
export type FrameQuality = keyof typeof FRAME_QUALITIES;

/** What one player's browser asks for, from the query of its event stream. */
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

/**
 * One stream serves every player: the largest screen, the highest frame rate and
 * quality asked for. Each player then receives frames at its own rate.
 */
export function combineStreamRequests(requests: readonly PlayerStreamRequest[]): PlayerStreamRequest | null {
  if (requests.length === 0) return null;
  const largest = requests.reduce((best, request) =>
    request.screen.width * request.screen.height > best.screen.width * best.screen.height ? request : best);
  const best = requests.reduce((top, request) =>
    FRAME_QUALITIES[request.quality] > FRAME_QUALITIES[top] ? request.quality : top, requests[0]!.quality);
  return {
    screen: largest.screen,
    fps: Math.max(...requests.map((request) => request.fps)),
    quality: best,
  };
}

function positiveInteger(value: string | null, fallback: number): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
