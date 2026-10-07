import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Check, ChevronRight, Dices, Heart, Minus, Mouse, Palette, Plus, RotateCcw, RotateCw, Touchpad, UserRound, type LucideIcon } from 'lucide-react';
import type { IconRenderer } from '../../ui/icons';

/** The icons Atlas' menus show on a player's page, by their Obsidian (Lucide) name. */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  'check': Check,
  'chevron-right': ChevronRight,
  'dices': Dices,
  'heart': Heart,
  'minus': Minus,
  'mouse': Mouse,
  'palette': Palette,
  'plus': Plus,
  'rotate-ccw': RotateCcw,
  'rotate-cw': RotateCw,
  'touchpad': Touchpad,
  'user-round': UserRound,
};

/** Draws Lucide's icon as Obsidian's `setIcon` does, for the icons the page's menus use. */
export const renderPageIcon: IconRenderer = (element, name) => {
  const icon = ICONS[name];
  if (!icon) return;
  const markup = renderToStaticMarkup(createElement(icon, { size: 16, className: `svg-icon lucide-${name}` }));
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  element.replaceChildren(document.importNode(svg, true));
};
