import type { ContextMenuEntry } from './AtlasContextMenu';
import { TOKEN_ROLES, type TokenRole } from '../../../tokenRings/tokenRingTypes';
import { t } from '../../../i18n';

/**
 * "Role" submenu shared by the map token menu and the asset manager. `current` is the role every
 * token picked has, null when they differ; choosing one gives it to them all, "No role" takes it away.
 */
export function tokenRoleSubmenu(current: TokenRole | undefined | null, onSelect: (role: TokenRole | undefined) => void): ContextMenuEntry {
  const choices: Array<TokenRole | undefined> = [undefined, ...TOKEN_ROLES];
  const children: ContextMenuEntry[] = choices.map((role) => ({
    type: 'item',
    label: t(role ? `ring.role.${role}` : 'ring.role.none'),
    checked: current !== null && current === role,
    onClick: () => onSelect(role),
  }));
  return { type: 'submenu', label: t('ring.role'), icon: 'user-round', children };
}

/** The role every one of `tokens` has; null when they differ. */
export function sharedRole(tokens: ReadonlyArray<{ role?: TokenRole | undefined }>): TokenRole | undefined | null {
  const first = tokens[0]?.role;
  return tokens.every((token) => token.role === first) ? first : null;
}
