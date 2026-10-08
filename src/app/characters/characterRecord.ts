import type { TokenUpdates } from '../storeFactory';
import type { TokenEntity } from '../types';
import type { ResourceValue } from '../resources/resourceTypes';
import { sameValue } from '../utils/sameValue';
import type { TokenRole } from '../tokenRings/tokenRingTypes';

/** The settings of a character that follow it to every map, whatever happens there. */
const CONFIG_FIELDS = ['controlledBy', 'showNameplate', 'ringColor', 'vision', 'light', 'side', 'linked', 'barsShownTo'] as const;

type ConfigField = typeof CONFIG_FIELDS[number];

/** Who the character is, on every map: its players, look, senses, light and side, and the maxima set by hand. */
export type CharacterConfig = { [F in ConfigField]?: TokenEntity[F] } & {
  /** Maxima set by hand (`overriddenMax`), by resource key. */
  maxima?: Record<string, number>;
};

/** Where a linked character stands: the same on every map. */
export interface CharacterState {
  resources?: Record<string, ResourceValue>;
  conditions?: string[];
  conditionValues?: Record<string, number>;
}

/**
 * What a library character holds of its placements: its settings, and, while it is linked,
 * its resources and conditions. Placements are recognised by the character's artwork.
 */
export interface CharacterRecord {
  config: CharacterConfig;
  /** Only while `config.linked`. */
  state?: CharacterState;
}

/**
 * What the library token itself says of every placement: its footprint (unset is 1×1), its role and
 * its ring. Placements take it as the record's settings, and a placement's edit writes it back.
 */
export interface LibraryLook {
  size?: number | undefined;
  role?: TokenRole | undefined;
  ringStyle?: string | undefined;
}

/** Fields of the library look that every placement follows, record or not (`followLook`). */
const LOOK_FIELDS = ['role', 'ringStyle'] as const;

/** Whether `updates` change a field of the library look every placement follows. */
export function changesLook(updates: object): boolean {
  return LOOK_FIELDS.some((field) => field in updates);
}

/** The library look `token` has. */
export function lookOf(token: TokenEntity): LibraryLook {
  return { size: token.size ?? 1, role: token.role, ringStyle: token.ringStyle };
}

/** Whether two library looks say the same. */
export function sameLook(a: LibraryLook, b: LibraryLook): boolean {
  return (a.size ?? 1) === (b.size ?? 1) && a.role === b.role && a.ringStyle === b.ringStyle;
}

/** The changes that give `token` the role and ring of `look`; null when it has them. An unset field is removed. */
export function followLook(token: TokenEntity, look: LibraryLook): TokenUpdates | null {
  const updates: Record<string, unknown> = {};
  for (const field of LOOK_FIELDS) if (token[field] !== look[field]) updates[field] = look[field];
  return Object.keys(updates).length > 0 ? updates : null;
}

/** The character's settings as `token` has them. */
export function configOf(token: TokenEntity): CharacterConfig {
  const config: Record<string, unknown> = {};
  for (const field of CONFIG_FIELDS) if (token[field] !== undefined) config[field] = token[field];
  const maxima = Object.fromEntries((token.overriddenMax ?? []).flatMap((key) => {
    const value = token.resources?.[key];
    return value ? [[key, value.max]] : [];
  }));
  if (Object.keys(maxima).length > 0) config.maxima = maxima;
  return config;
}

/** Where `token` stands: its resources and conditions. */
export function stateOf(token: TokenEntity): CharacterState {
  return {
    ...(token.resources && { resources: token.resources }),
    ...(token.conditions && { conditions: token.conditions }),
    ...(token.conditionValues && { conditionValues: token.conditionValues }),
  };
}

/** The record `token` gives its character: its settings, and its state while it is linked. */
export function recordOf(token: TokenEntity): CharacterRecord {
  const config = configOf(token);
  return config.linked ? { config, state: stateOf(token) } : { config };
}

/** Whether `token` already is what `record` and the library's `look` say. */
export function followsRecord(token: TokenEntity, record: CharacterRecord, look: LibraryLook): boolean {
  return followRecord(token, record, look) === null;
}

/**
 * The changes that make `token` the character `record` describes, with the library's `look`
 * (size unset is 1×1); null when it already is. A field the record leaves unset is removed.
 */
export function followRecord(token: TokenEntity, record: CharacterRecord, look: LibraryLook): TokenUpdates | null {
  const { size } = look;
  const updates: Record<string, unknown> = { ...followLook(token, look) };
  const { config, state } = record;
  for (const field of CONFIG_FIELDS) {
    if (!sameValue(token[field], config[field])) updates[field] = config[field];
  }
  if ((token.size ?? 1) !== (size ?? 1)) updates.size = size ?? 1;

  const maxima = config.maxima ?? {};
  const overridden = Object.keys(maxima);
  const nextOverridden = overridden.length > 0 ? overridden : undefined;
  if (!sameValue(token.overriddenMax ?? [], overridden)) updates.overriddenMax = nextOverridden;

  if (config.linked && state) {
    // A linked character's resources are its own on every map, maxima included
    if (!sameValue(token.resources, state.resources)) updates.resources = state.resources;
    if (!sameValue(token.conditions, state.conditions)) updates.conditions = state.conditions;
    if (!sameValue(token.conditionValues, state.conditionValues)) updates.conditionValues = state.conditionValues;
  } else {
    const resources = withMaxima(token.resources, maxima);
    if (resources !== token.resources) updates.resources = resources;
  }
  return Object.keys(updates).length > 0 ? updates : null;
}

/** `resources` with the maxima set by hand, each current value kept within its new maximum. */
function withMaxima(resources: TokenEntity['resources'], maxima: Record<string, number>): TokenEntity['resources'] {
  if (!resources) return resources;
  let next = resources;
  for (const [key, max] of Object.entries(maxima)) {
    const value = resources[key];
    if (!value || value.max === max) continue;
    next = next === resources ? { ...resources } : next;
    next[key] = { current: Math.min(Math.max(value.current, 0), max), max };
  }
  return next;
}
