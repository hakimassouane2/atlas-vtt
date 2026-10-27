import { t } from '../i18n';
import type { SceneLevel } from '../types/sceneLevelTypes';

/** What a level is called: its name, or its place among the scene's levels while it has none. */
export function levelLabel(levels: readonly SceneLevel[], level: SceneLevel): string {
  return level.name?.trim() || t('levels.newName', { n: levels.indexOf(level) + 1 });
}
