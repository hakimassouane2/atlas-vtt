import { EventEmitter } from 'events';
import { expect, it } from 'vitest';
import { Container, Sprite, type Graphics } from 'pixi.js';
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { SelectionManager } from '../../src/app/pixi/SelectionManager';

function tokenGroup(x: number, y: number, size: number): Container {
  const group = new Container();
  const sprite = group.addChild(new Sprite());
  sprite.width = size;
  sprite.height = size;
  group.position.set(x, y);
  return group;
}

function frameBounds(groups: Record<string, Container>): { minX: number; maxX: number; minY: number; maxY: number } {
  const viewport = Object.assign(new Container(), { toWorld: (point: { x: number; y: number }) => point });
  const store = createStore(subscribeWithSelector(() => ({
    selectedIds: Object.keys(groups), activeTool: 'select', selectionMode: 'box',
    objects: { tokens: Object.fromEntries(Object.keys(groups).map((id) => [id, { id }])), drawings: {} },
  })));
  const manager = new SelectionManager(viewport as never, () => groups, () => ({}), store as never, new EventEmitter());
  manager.updateSelectionOverlay();
  return (manager.getPlayerViewLayers()[0]!.layer as Graphics).bounds;
}

it('frames a selected token by its footprint on the grid, its bars and nameplate outside', () => {
  // A medium token on a 70 px grid, centred in the cell from (70, 70) to (140, 140)
  const { minX, maxX, minY, maxY } = frameBounds({ goblin: tokenGroup(105, 105, 70) });
  expect([minX, minY, maxX, maxY]).toEqual([70, 70, 140, 140]);
});

it('frames a large token by its whole footprint, at any grid size', () => {
  const { minX, maxX, minY, maxY } = frameBounds({ ogre: tokenGroup(300, 300, 240) });
  expect([minX, minY, maxX, maxY]).toEqual([180, 180, 420, 420]);
});

it('frames several tokens by the cells they cover together', () => {
  const { minX, maxX, minY, maxY } = frameBounds({ a: tokenGroup(35, 35, 70), b: tokenGroup(175, 105, 70) });
  expect([minX, minY, maxX, maxY]).toEqual([0, 0, 210, 140]);
});
