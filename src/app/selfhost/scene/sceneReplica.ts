import type { ViewAtlasState } from '../../storeFactory';

/** What a player's page holds of the presented scene: the parts of the GM's store its canvas draws. */
export type ReplicatedScene = Pick<
  ViewAtlasState,
  'mapPath' | 'background' | 'grid' | 'objects' | 'tokenSettings' | 'initiative' | 'initiativeTrackerOpen'
>;

type SceneField = Exclude<keyof ReplicatedScene, 'objects'>;
type ObjectKind = keyof ReplicatedScene['objects'];

const SCENE_FIELDS: readonly SceneField[] = ['mapPath', 'background', 'grid', 'tokenSettings', 'initiative', 'initiativeTrackerOpen'];

/**
 * One change of the presented scene: a field replaced whole, or one map object (a token, a
 * fog operation, a drawing…) added, changed (`value`) or removed (`value: null`).
 */
export type SceneChange =
  | { field: SceneField; value: unknown }
  | { kind: ObjectKind; id: string; value: unknown };

/** The replicated part of a store's state; the objects are the store's own, so unchanged ones keep their identity. */
export function sceneOf(state: ReplicatedScene): ReplicatedScene {
  const { mapPath, background, grid, objects, tokenSettings, initiative, initiativeTrackerOpen } = state;
  return { mapPath, background, grid, objects, tokenSettings, initiative, initiativeTrackerOpen };
}

/**
 * What changed from `previous` to `next`, compared by identity as the store's Immer drafts keep it:
 * a scene field that is another object, and each map object that is another, appeared or went.
 */
export function sceneChanges(previous: ReplicatedScene, next: ReplicatedScene): SceneChange[] {
  const changes: SceneChange[] = [];
  for (const field of SCENE_FIELDS) {
    if (next[field] !== previous[field]) changes.push({ field, value: next[field] ?? null });
  }
  if (next.objects === previous.objects) return changes;
  const kinds = new Set([...Object.keys(previous.objects), ...Object.keys(next.objects)]) as Set<ObjectKind>;
  for (const kind of kinds) {
    const before: Record<string, unknown> = previous.objects[kind] ?? {};
    const after: Record<string, unknown> = next.objects[kind] ?? {};
    if (before === after) continue;
    for (const [id, value] of Object.entries(after)) {
      if (before[id] !== value) changes.push({ kind, id, value });
    }
    for (const id of Object.keys(before)) {
      if (!(id in after)) changes.push({ kind, id, value: null });
    }
  }
  return changes;
}

/**
 * The scene with `changes` applied, as a new state for the store: every record a change touches is
 * a new object, every other keeps its identity, so the canvas redraws only what changed.
 */
export function withSceneChanges(scene: ReplicatedScene, changes: readonly SceneChange[]): ReplicatedScene {
  const next: Record<string, unknown> = { ...scene };
  let objects: Record<string, Record<string, unknown> | undefined> | null = null;
  const copied = new Set<ObjectKind>();
  for (const change of changes) {
    if ('field' in change) {
      next[change.field] = change.value;
      continue;
    }
    objects ??= { ...scene.objects };
    if (!copied.has(change.kind)) {
      objects[change.kind] = { ...objects[change.kind] };
      copied.add(change.kind);
    }
    const records = objects[change.kind]!;
    if (change.value === null) delete records[change.id];
    else records[change.id] = change.value;
  }
  if (objects) next.objects = objects;
  return next as ReplicatedScene;
}

/** Image files a player's canvas loads for `scene`: the map and the artwork of its tokens and initiative turns. */
export function replicatedImagePaths(scene: ReplicatedScene): Set<string> {
  const paths = new Set<string>();
  if (scene.background) paths.add(scene.background);
  for (const token of Object.values(scene.objects.tokens)) if (token.imagePath) paths.add(token.imagePath);
  for (const entry of scene.initiative?.entries ?? []) if (entry.imagePath) paths.add(entry.imagePath);
  return paths;
}
