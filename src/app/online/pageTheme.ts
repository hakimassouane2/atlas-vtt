import type { PageTheme } from './OnlineSessionServer';

/** The popout player window's body classes: its own styles in Atlas' stylesheet key off them. */
const PLAYER_WINDOW_CLASSES = ['atlas-player-window', 'atlas-player-window--live'];

/**
 * Everything the DM's window styles with (Obsidian, the theme, CSS snippets, Atlas)
 * and its theme classes, so players' pages style Atlas' overlays exactly as the
 * local player window does. Read when a page loads, so theme changes carry over.
 */
export function pageTheme(doc: Document): PageTheme {
  const rules: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) rules.push(rule.cssText);
    } catch {
      // A stylesheet from another origin cannot be read; the page does without it
    }
  }
  const themeClasses = Array.from(doc.body.classList).filter((name) => name.startsWith('theme-'));
  return { css: rules.join('\n'), bodyClass: [...themeClasses, ...PLAYER_WINDOW_CLASSES].join(' ') };
}
