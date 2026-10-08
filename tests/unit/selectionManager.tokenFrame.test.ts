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

function frameBounds(groups: Record<string, Container>, sizes: Record<string, number> = {}, gridSize = 70): { minX: number; maxX: number; minY: number; maxY: number } {
  const viewport = Object.assign(new Container(), { toWorld: (point: { x: number; y: number }) => point });
  const store = createStore(subscribeWithSelector(() => ({
    selectedIds: Object.keys(groups), activeTool: 'select', selectionMode: 'box',
    grid: { size: gridSize },
    objects: { tokens: Object.fromEntries(Object.keys(groups).map((id) => [id, { id, size: sizes[id] }])), drawings: {} },
  })));
  const manager = new SelectionManager(viewport as never, () => groups, () => ({}), store as never, new EventEmitter());
  manager.updateSelectionOverlay();
  return (manager.getPlayerViewLayers()[0]!.layer as Graphics).bounds;
}

// Sprites are inset from their cells by the grid's stroke (4 px at 70 px), as `computeTokenPixelSize` makes them
it('frames a selected token by the cell it covers, not by its inset sprite', () => {
  const { minX, maxX, minY, maxY } = frameBounds({ goblin: tokenGroup(105, 105, 62) });
  expect([minX, minY, maxX, maxY]).toEqual([70, 70, 140, 140]);
});

it('frames a large token by all the cells it covers, at any grid size', () => {
  // Size 2 covers three cells of 100 px
  const { minX, maxX, minY, maxY } = frameBounds({ ogre: tokenGroup(350, 350, 276) }, { ogre: 2 }, 100);
  expect([minX, minY, maxX, maxY]).toEqual([200, 200, 500, 500]);
});

it('frames several tokens by the cells they cover together', () => {
  const { minX, maxX, minY, maxY } = frameBounds({ a: tokenGroup(35, 35, 62), b: tokenGroup(175, 105, 62) });
  expect([minX, minY, maxX, maxY]).toEqual([0, 0, 210, 140]);
});
