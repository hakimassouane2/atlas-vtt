const IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

/** The MIME type of an image file by its extension (`png`, `.PNG`), or undefined for a file that is no image. */
export function imageMimeType(extension: string): string | undefined {
  return IMAGE_MIME_TYPES[extension.replace(/^\./, '').toLowerCase()];
}

/** The MIME type of the image file at `path`, or undefined for a file that is no image. */
export function imageMimeTypeOfPath(path: string): string | undefined {
  const dot = path.lastIndexOf('.');
  return dot < 0 ? undefined : imageMimeType(path.slice(dot + 1));
}
