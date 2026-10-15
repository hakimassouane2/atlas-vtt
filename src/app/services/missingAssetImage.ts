/** Side of the image that stands in for a missing asset, in pixels. */
export const MISSING_ASSET_SIZE = 128;

/** The grey question mark that stands in for a missing asset, or null where no canvas can be drawn. */
export function drawMissingAssetImage(): HTMLCanvasElement | null {
  const canvas = createEl('canvas');
  canvas.width = MISSING_ASSET_SIZE;
  canvas.height = MISSING_ASSET_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#404040';
  ctx.fillRect(0, 0, MISSING_ASSET_SIZE, MISSING_ASSET_SIZE);
  ctx.fillStyle = '#808080';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 64);
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 124);
  return canvas;
}
