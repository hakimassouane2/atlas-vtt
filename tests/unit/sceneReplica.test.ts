import { describe, expect, it } from 'vitest';
import { createSceneStore } from '../../src/app/storeFactory';
import { sceneChanges, sceneOf, withSceneChanges, replicatedImagePaths } from '../../src/app/online/scene/sceneReplica';
import type { TokenEntity } from '../../src/app/types';

const token = (id: string, x: number, extra: Partial<TokenEntity> = {}): TokenEntity => ({ id, kind: 'token', imagePath: `${id}.png`, x, y: 0, ...extra } as TokenEntity);

function store() {
  const created = createSceneStore(`replica-${Math.random()}`);
  created.getState().setPersistenceEnabled(false);
  return created;
}

describe('scene replication', () => {
  it('carries every store edit to a copy, which ends equal to the store', () => {
    const source = store();
    source.getState().addTokens([{ ...token('a', 0) }, { ...token('b', 70) }] as never);
    const copy = sceneOf(source.getState());
    let sent = copy;
    let replica = copy;

    const edits = [
      () => source.getState().moveToken(Object.keys(source.getState().objects.tokens)[0]!, 140, 0),
      () => source.getState().deleteTokens([Object.keys(source.getState().objects.tokens)[1]!]),
      () => source.getState().setGrid({ ...source.getState().grid, size: 50 }),
      () => source.getState().setInitiativeTrackerOpen(true),
      () => source.getState().addNotePin(1, 2, 'n.md'),
    ];
    for (const edit of edits) {
      edit();
      const next = sceneOf(source.getState());
      replica = withSceneChanges(replica, sceneChanges(sent, next));
      sent = next;
    }

    expect(JSON.parse(JSON.stringify(replica))).toEqual(JSON.parse(JSON.stringify(sceneOf(source.getState()))));
  });

  it('sends only the objects that changed', () => {
    const source = store();
    const [a] = source.getState().addTokens([{ ...token('a', 0) }, { ...token('b', 70) }] as never);
    const before = sceneOf(source.getState());
    source.getState().moveToken(a!, 140, 0);

    const changes = sceneChanges(before, sceneOf(source.getState()));

    expect(changes).toEqual([{ kind: 'tokens', id: a, value: source.getState().objects.tokens[a!] }]);
  });

  it('keeps the identity of every object a change does not touch', () => {
    const scene = sceneOf(store().getState());
    const withTokens = withSceneChanges(scene, [
      { kind: 'tokens', id: 'a', value: token('a', 0) },
      { kind: 'tokens', id: 'b', value: token('b', 0) },
    ]);
    const moved = withSceneChanges(withTokens, [{ kind: 'tokens', id: 'a', value: token('a', 70) }]);

    expect(moved.objects.tokens.b).toBe(withTokens.objects.tokens.b);
    expect(moved.objects.fog).toBe(withTokens.objects.fog);
    expect(moved.grid).toBe(withTokens.grid);
    expect(withTokens.objects.tokens.a).not.toBe(moved.objects.tokens.a);
  });

  it('removes an object sent as null', () => {
    const scene = withSceneChanges(sceneOf(store().getState()), [{ kind: 'tokens', id: 'a', value: token('a', 0) }]);
    expect(withSceneChanges(scene, [{ kind: 'tokens', id: 'a', value: null }]).objects.tokens).toEqual({});
  });

  it('names the images a canvas loads: the map, the tokens and the initiative turns', () => {
    const scene = withSceneChanges(sceneOf(store().getState()), [
      { field: 'background', value: 'maps/cave.webp' },
      { kind: 'tokens', id: 'a', value: token('a', 0) },
      { field: 'initiative', value: { entries: [{ id: 'e', tokenId: 'x', imagePath: 'x.png' }], round: 1, isActive: false } },
    ]);
    expect([...replicatedImagePaths(scene)].sort()).toEqual(['a.png', 'maps/cave.webp', 'x.png']);
  });
});
