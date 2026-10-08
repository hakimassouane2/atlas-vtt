/** Side the ring is scaled to before its pixels are looked at: enough to tell grey from colour. */
const SAMPLE_SIZE = 64;
/** Pixels fainter than this are left out: their colour is mostly the edge's antialiasing. */
const MIN_ALPHA = 32;
/** How far a pixel's channels may stray from each other and still count as grey. */
const GREY_TOLERANCE = 24;
/** Share of the visible pixels that may be coloured in a grey ring (a stray highlight). */
const COLOURED_SHARE = 0.02;

/**
 * Whether RGBA pixels are a grey drawing, which a tint colours: Atlas' own ring is white and
 * tinted by multiplying. A ring with colours of its own is drawn as it is.
 */
export function isGreyscale(pixels: Uint8ClampedArray): boolean {
  let visible = 0;
  let coloured = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < MIN_ALPHA) continue;
    visible += 1;
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    if (Math.max(r, g, b) - Math.min(r, g, b) > GREY_TOLERANCE) coloured += 1;
  }
  return visible === 0 || coloured / visible <= COLOURED_SHARE;
}

/** Whether the ring image in `blob` tints (`isGreyscale`); true when it cannot be read, as Atlas' own ring. */
export async function detectTintable(blob: Blob): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(blob, { resizeWidth: SAMPLE_SIZE, resizeHeight: SAMPLE_SIZE, resizeQuality: 'medium' });
    const canvas = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
    const context = canvas.getContext('2d');
    if (!context) return true;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return isGreyscale(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
  } catch {
    return true;
  }
}
