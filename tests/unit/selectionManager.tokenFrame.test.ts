import { expect, it } from 'vitest';
import { Container, Sprite } from 'pixi.js';
import { NO_BARS, selectionTargets } from '../../src/app/pixi/selection/selectionTargets';
import { tokenFootprintSize } from '../../src/app/pixi/token-renderer/tokenSizing';

function tokenGroup(x: number, y: number, size: number): Container {
  const group = new Container();
  const sprite = group.addChild(new Sprite());
  sprite.label = 'tokenSprite';
  sprite.width = size;
  sprite.height = size;
  group.position.set(x, y);
  return group;
}

/** The outline a selected token gets, framed as the fork does: by the cells it covers (FORK.md). */
function outlineOf(group: Container, sizeInCells: number, gridSize = 70): { x: number; y: number; outline: unknown } {
  const [target] = selectionTargets(['token'], {
    world: new Container(),
    tokens: { token: group },
    drawings: {},
    fog: {},
    bars: () => NO_BARS,
    footprint: () => tokenFootprintSize(gridSize, sizeInCells),
  });
  return { x: target!.x, y: target!.y, outline: target!.outline };
}

// Sprites are inset from their cells by the grid's stroke (4 px at 70 px), as `computeTokenPixelSize` makes them
it('frames a selected token by the cell it covers, not by its inset sprite', () => {
  expect(outlineOf(tokenGroup(105, 105, 62), 1)).toEqual({ x: 105, y: 105, outline: { kind: 'rect', width: 70, height: 70, rotation: 0, cornerRadius: 0 } });
});

it('frames a large token by all the cells it covers, at any grid size', () => {
  // Size 2 covers three cells of 100 px
  expect(outlineOf(tokenGroup(350, 350, 276), 2, 100).outline).toMatchObject({ kind: 'rect', width: 300, height: 300 });
});

it('falls back to the ring where no footprint is known', () => {
  const [target] = selectionTargets(['token'], {
    world: new Container(), tokens: { token: tokenGroup(35, 35, 62) }, drawings: {}, fog: {}, bars: () => NO_BARS,
  });
  expect(target!.outline).toMatchObject({ kind: 'circle' });
});
