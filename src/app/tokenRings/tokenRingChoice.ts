import type { CollectionSettings } from '../types/collectionSettingsTypes';
import {
  RING_ROLE_KEYS,
  TOKEN_ROLES,
  type RingChoice,
  type RingRoleKey,
  type RingSubject,
  type RoleRing,
  type TokenRingSettings,
  type TokenRole,
} from './tokenRingTypes';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** `value` as a role, or undefined when it is none. */
export function readRole(value: unknown): TokenRole | undefined {
  return (TOKEN_ROLES as readonly unknown[]).includes(value) ? value as TokenRole : undefined;
}

/** The key a role's ring is stored under. */
export function ringRoleKey(role: TokenRole | undefined): RingRoleKey {
  return role ?? 'none';
}

function readRoleRing(value: unknown): RoleRing | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { style, color } = value as Record<string, unknown>;
  const ring: RoleRing = {
    ...(typeof style === 'string' && style !== '' && { style }),
    ...(typeof color === 'string' && HEX_COLOR.test(color) && { color }),
  };
  return ring.style !== undefined || ring.color !== undefined ? ring : undefined;
}

/** A collection's ring settings as stored ones are read: what is no ring or no colour is passed over. */
export function readTokenRingSettings(settings: Pick<CollectionSettings, 'tokenRings'> | null | undefined): TokenRingSettings {
  const stored = settings?.tokenRings;
  if (typeof stored !== 'object' || stored === null) return {};
  const roles: Partial<Record<RingRoleKey, RoleRing>> = {};
  const storedRoles = (stored as Record<string, unknown>).roles;
  if (typeof storedRoles === 'object' && storedRoles !== null) {
    for (const key of RING_ROLE_KEYS) {
      const ring = readRoleRing((storedRoles as Record<string, unknown>)[key]);
      if (ring) roles[key] = ring;
    }
  }
  const tint: Record<string, boolean> = {};
  const storedTint = (stored as Record<string, unknown>).tint;
  if (typeof storedTint === 'object' && storedTint !== null) {
    for (const [name, value] of Object.entries(storedTint)) if (typeof value === 'boolean') tint[name] = value;
  }
  return {
    ...(Object.keys(roles).length > 0 && { roles }),
    ...(Object.keys(tint).length > 0 && { tint }),
  };
}

/** Ring settings as they are stored: undefined once they say nothing, so the collection keeps no empty record. */
export function savedTokenRingSettings(settings: TokenRingSettings): TokenRingSettings | undefined {
  const read = readTokenRingSettings({ tokenRings: settings });
  return read.roles || read.tint ? read : undefined;
}

/**
 * The ring `subject` is drawn with. The style is the token's own, else its role's; the colour
 * the token's own, else its role's. Unset fields are Atlas' ring and white.
 */
export function ringChoiceOf(subject: RingSubject, settings: TokenRingSettings): RingChoice {
  const roleRing = settings.roles?.[ringRoleKey(readRole(subject.role))];
  return {
    style: subject.ringStyle || roleRing?.style,
    color: subject.ringColor || roleRing?.color,
  };
}

/**
 * Whether the ring file `style` is tinted in its colour: as the GM set it, else as `detected`
 * found it (a grey ring tints), else (not yet looked at) it does. Atlas' own ring always tints.
 */
export function ringTints(style: string | undefined, detected: boolean | undefined, settings: TokenRingSettings): boolean {
  if (style === undefined) return true;
  return settings.tint?.[style] ?? detected ?? true;
}
