/**
 * Token rings: the frame drawn around a token's art. Atlas draws one ring of its own; a
 * collection may hold more as image files (`tokenRingFiles.ts`) and frames each role with
 * one of them, in one colour (`CollectionSettings.tokenRings`).
 */

/** What a token is at the table: a player character or a non-player character. Unset is neither. */
export type TokenRole = 'pc' | 'npc';

export const TOKEN_ROLES: readonly TokenRole[] = ['pc', 'npc'];

/** The roles a collection frames, `none` for tokens without a role. */
export type RingRoleKey = TokenRole | 'none';

export const RING_ROLE_KEYS: readonly RingRoleKey[] = ['pc', 'npc', 'none'];

/** How the tokens of one role are framed; an unset field takes Atlas' ring, or white. */
export interface RoleRing {
  /** The ring file's name in the collection's ring folder; unset is Atlas' own ring. */
  style?: string | undefined;
  /** `#rrggbb`; unset is white. */
  color?: string | undefined;
}

/** `CollectionSettings.tokenRings`; read with `readTokenRingSettings`. */
export interface TokenRingSettings {
  roles?: Partial<Record<RingRoleKey, RoleRing>>;
  /**
   * Ring files whose tint the GM set by hand, by file name: true tints the ring in its
   * colour, false draws it as drawn. A file without an entry tints when it is grey.
   */
  tint?: Record<string, boolean>;
}

/** What a token says of its ring. */
export interface RingSubject {
  role?: TokenRole | undefined;
  /** A ring file of the collection, chosen for this token over its role's. */
  ringStyle?: string | undefined;
  ringColor?: string | undefined;
}

/** The ring a token is drawn with: a style (unset is Atlas' ring) and a colour (unset is white). */
export interface RingChoice {
  style: string | undefined;
  color: string | undefined;
}
