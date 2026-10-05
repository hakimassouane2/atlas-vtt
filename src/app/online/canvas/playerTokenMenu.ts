import type { CanvasPlayer, TokenMenu, TokenMenuCanvas } from '../../canvas/canvasHost';
import type { TokenEntity } from '../../types';
import type { ContextMenuEntry } from '../../ui/contextMenus';
import { openContextMenuGlobal } from '../../ui/contextMenus';
import { conditionsSubmenu } from '../../react/components/context-menu/conditionsMenu';
import { resourceUpdate, withCurrent } from '../../resources/resourceValues';
import { visibleResources } from '../../resources/visibleResources';

/** How far a step of the menu turns a token, in degrees. */
const ROTATION_STEP = 45;

/**
 * A player's token menu: what the player may change on a token they control (its resources,
 * conditions and rotation). Every choice edits the page's own store, which sends it on to the
 * DM's Atlas; a token the player does not control opens no menu.
 */
export function playerTokenMenu(player: CanvasPlayer): (canvas: TokenMenuCanvas) => TokenMenu {
  return (canvas) => (token, at) => {
    if (!player.controls(token)) return;
    openContextMenuGlobal(playerTokenMenuEntries(canvas, token.id), at);
  };
}

function playerTokenMenuEntries(canvas: TokenMenuCanvas, tokenId: string): ContextMenuEntry[] {
  const { store } = canvas;
  const entries: ContextMenuEntry[] = [];
  const subscribe = (onChange: () => void): (() => void) =>
    store.subscribe((state, previous) => {
      if (state.objects.tokens !== previous.objects.tokens) onChange();
    });
  const current = (): TokenEntity | undefined => store.getState().objects.tokens[tokenId];

  const token = current();
  if (token && visibleResources(token, canvas.resources(), 'player').some(({ definition }) => definition.direction !== 'static')) {
    entries.push({ type: 'submenu', label: 'Resources', icon: 'heart', children: () => resourceEntries(canvas, current()), subscribe });
  }
  const conditions = canvas.conditions();
  if (conditions.length > 0) entries.push(conditionsSubmenu(store, conditions, [tokenId]));

  const turn = (degrees: number): void => {
    const rotation = ((current()?.rotation ?? 0) + degrees + 360) % 360;
    store.getState().updateToken(tokenId, { rotation });
  };
  entries.push({
    type: 'submenu',
    label: 'Rotate',
    icon: 'rotate-cw',
    children: [
      { type: 'item', label: `${ROTATION_STEP}° left`, icon: 'rotate-ccw', keepOpen: true, onClick: () => turn(-ROTATION_STEP) },
      { type: 'item', label: `${ROTATION_STEP}° right`, icon: 'rotate-cw', keepOpen: true, onClick: () => turn(ROTATION_STEP) },
    ],
  });
  return entries;
}

/** One row per resource the player sees and spends, with − value + to step it. */
function resourceEntries({ store, resources }: TokenMenuCanvas, token: TokenEntity | undefined): ContextMenuEntry[] {
  if (!token) return [];
  return visibleResources(token, resources(), 'player')
    .filter(({ definition }) => definition.direction !== 'static')
    .map(({ definition, value }) => {
      const step = (delta: number): void => {
        const latest = store.getState().objects.tokens[token.id];
        if (!latest) return;
        store.getState().updateToken(token.id, resourceUpdate(latest, definition.key, withCurrent(value, value.current + delta), false));
      };
      return {
        type: 'item' as const,
        label: definition.name,
        keepOpen: true,
        onClick: () => undefined,
        stepper: {
          value: `${value.current}/${value.max}`,
          label: definition.name,
          canDecrement: value.current > 0,
          onDecrement: () => step(-1),
          onIncrement: () => step(1),
        },
      };
    });
}
