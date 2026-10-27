/**
 * The custom properties that draw a portrait's ring: `image` over Atlas' ring, tinted in
 * `color`. Undefined when neither is set.
 */
export function portraitRingStyle(image: string | undefined, color: string | undefined): Record<string, string> | undefined {
  if (!image && !color) return undefined;
  return {
    ...(color && { '--atlas-token-ring-color': color }),
    ...(image && { '--atlas-token-ring-image': `url("${image.replace(/"/g, '%22')}")` }),
  };
}
