import type { FrameHeader } from '../protocol';
import { playerCamera } from './camera';
import { byId, setStatus } from './dom';

interface Frame {
  header: FrameHeader;
  src: string;
}

const scene = (): HTMLImageElement => byId<HTMLImageElement>('scene');
/** Where the frame on screen looks, to place it under the player's camera. */
let shown: FrameHeader | null = null;
let latest: Frame | null = null;
let isDecoding = false;

/**
 * Shows a frame from the DM's Atlas (the `frame` event: its header as JSON on the
 * first line, the JPEG in base64 on the next). Frames are decoded one at a time and
 * the ones superseded meanwhile are skipped.
 */
export function receiveFrame(data: string): void {
  const split = data.indexOf('\n');
  latest = { header: JSON.parse(data.slice(0, split)) as FrameHeader, src: `data:image/jpeg;base64,${data.slice(split + 1)}` };
  showLatest();
}

function showLatest(): void {
  if (isDecoding || !latest) return;
  const frame = latest;
  latest = null;
  isDecoding = true;
  const next = new Image();
  next.src = frame.src;
  next.decode()
    .then(() => {
      scene().src = frame.src;
      shown = frame.header;
      playerCamera.adopt(frame.header);
      document.body.classList.add('online-live');
      setStatus('');
      placeFrame();
    })
    .catch(() => undefined)
    .finally(() => {
      isDecoding = false;
      showLatest();
    });
}

/** Places the frame on screen under the player's camera, which may have moved since it was rendered. */
export function placeFrame(): void {
  const camera = playerCamera.current;
  if (!camera || !shown) return;
  const size = camera.zoom / shown.zoom;
  const topLeft = playerCamera.toScreen(
    shown.centerX - shown.cssWidth / 2 / shown.zoom,
    shown.centerY - shown.cssHeight / 2 / shown.zoom,
    camera,
  );
  const image = scene();
  image.style.left = `${topLeft.x}px`;
  image.style.top = `${topLeft.y}px`;
  image.style.width = `${shown.cssWidth * size}px`;
  image.style.height = `${shown.cssHeight * size}px`;
}
