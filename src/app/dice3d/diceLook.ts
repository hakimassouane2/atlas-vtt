/** How the dice look: the colour of their body and the face of their numerals. */

/** `light` is card stock with graphite numerals, `dark` the reverse, `accent` Obsidian's accent colour. */
export type DiceColour = 'light' | 'dark' | 'accent';
/** `medieval` is the pencil-drawn numeral sheet, `scifi` numerals set in Oxanium. */
export type DiceFont = 'medieval' | 'scifi';

export interface DiceLook {
  colour: DiceColour;
  font: DiceFont;
}

/** The look a roll is thrown in, with the colour its accent stands for, so every window paints it alike. */
export interface RollLook extends DiceLook {
  /** `#rrggbb`: Obsidian's accent for the DM's dice, the profile's colour for a player's. */
  accent?: string;
}

export const DEFAULT_DICE_LOOK: Readonly<DiceLook> = { colour: 'light', font: 'medieval' };

export const DICE_COLOUR_OPTIONS: readonly { value: DiceColour; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'accent', label: 'Accent' },
];

export const DICE_FONT_OPTIONS: readonly { value: DiceFont; label: string }[] = [
  { value: 'medieval', label: 'Medieval' },
  { value: 'scifi', label: 'Sci-fi' },
];

export function isDiceColour(value: unknown): value is DiceColour {
  return DICE_COLOUR_OPTIONS.some((option) => option.value === value);
}

export function isDiceFont(value: unknown): value is DiceFont {
  return DICE_FONT_OPTIONS.some((option) => option.value === value);
}

export type Rgb = readonly [number, number, number];

/** Numerals on a dark body. */
export const LIGHT_INK = '#e2e8f0';
/** Numerals on a light body, where no pencil drawing supplies its own tone. */
export const DARK_INK = '#1c1714';

/**
 * Perceived brightness (the YIQ weighting), 0 to 255. Chosen over the WCAG
 * contrast ratio, which prefers black on every saturated mid-tone: it would
 * write black numerals on Obsidian's own purple, where Obsidian writes white.
 */
function brightness([r, g, b]: Rgb): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Above this a body reads as light and takes dark numerals. */
const LIGHT_BODY = 150;

/** The numeral colour that reads best on a body of this colour: dark ink on light bodies, light ink otherwise. */
export function readableInk(body: Rgb): string {
  return brightness(body) > LIGHT_BODY ? DARK_INK : LIGHT_INK;
}

/** Channels to `#rrggbb`. */
export function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** A look read from the network or a file: what is no look of this Atlas reads as the default. */
export function readDiceLook(value: unknown): DiceLook {
  const look = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return {
    colour: isDiceColour(look.colour) ? look.colour : DEFAULT_DICE_LOOK.colour,
    font: isDiceFont(look.font) ? look.font : DEFAULT_DICE_LOOK.font,
  };
}

/** `#rrggbb` to channels; null for anything else. */
export function parseHex(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)] : null;
}
