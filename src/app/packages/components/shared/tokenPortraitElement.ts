import './token-portrait.scss';

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

interface TokenPortraitElementOptions {
  src: string;
  alt: string;
  showRing: boolean;
  /** Tints the ring like the canvas does; untinted (white) when omitted. */
  ringColor?: string | undefined;
  /** A ring file drawn instead of Atlas' ring. */
  ringImage?: string | undefined;
  cls?: string | undefined;
}

/** `TokenPortrait` for panels built with the DOM instead of React: the same elements and classes. */
export function createTokenPortrait(parent: HTMLElement, { src, alt, showRing, ringColor, ringImage, cls }: TokenPortraitElementOptions): HTMLElement {
  const portrait = parent.createDiv({ cls: 'atlas-token-portrait' });
  if (!showRing) portrait.addClass('atlas-token-portrait--unframed');
  if (cls) portrait.addClass(cls);
  portrait.createDiv({ cls: 'atlas-token-image-wrapper' })
    .createEl('img', { attr: { src, alt, draggable: 'false', decoding: 'async' } });
  if (showRing) {
    const ring = portrait.createDiv({ cls: 'atlas-token-ring' });
    for (const [property, value] of Object.entries(portraitRingStyle(ringImage, ringColor) ?? {})) ring.style.setProperty(property, value);
  }
  return portrait;
}
