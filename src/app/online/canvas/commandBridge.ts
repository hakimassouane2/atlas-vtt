import type { ViewAtlasStore } from '../../storeFactory';
import type { TokenEntity } from '../../types';
import { conditionValue } from '../../utils/conditionValues';
import type { PlayerCommand } from '../playerCommands';

/**
 * The commands that ask the DM's Atlas for what the player changed on `token`, from `before`:
 * where it is (`drag` while the pointer holds it, `move` on the drop), its rotation, the
 * current value of its resources and its conditions. Nothing else a player can change.
 */
export function commandsFor(before: TokenEntity, token: TokenEntity, held: boolean): PlayerCommand[] {
  const commands: PlayerCommand[] = [];
  const { id } = token;
  if (token.x !== before.x || token.y !== before.y) commands.push({ type: held ? 'drag' : 'move', id, x: token.x, y: token.y });
  if ((token.rotation ?? 0) !== (before.rotation ?? 0)) commands.push({ type: 'rotate', id, rotation: token.rotation ?? 0 });

  const resources = token.kind === 'character' ? token.resources ?? {} : {};
  const previous = before.kind === 'character' ? before.resources ?? {} : {};
  for (const [key, value] of Object.entries(resources)) {
    if (value.current !== previous[key]?.current) commands.push({ type: 'resource', id, key, current: value.current });
  }

  const had = new Set(before.conditions ?? []);
  const has = new Set(token.conditions ?? []);
  for (const conditionId of has) if (!had.has(conditionId)) commands.push({ type: 'condition', id, conditionId, active: true });
  for (const conditionId of had) if (!has.has(conditionId)) commands.push({ type: 'condition', id, conditionId, active: false });
  for (const conditionId of has) {
    if (!had.has(conditionId)) continue;
    const delta = conditionValue(token, conditionId) - conditionValue(before, conditionId);
    for (let step = 0; step < Math.abs(delta); step++) commands.push({ type: 'conditionValue', id, conditionId, delta: delta > 0 ? 1 : -1 });
  }
  return commands;
}

/**
 * Turns the player's edits on their canvas into commands for the DM's Atlas. The canvas edits
 * its own store as Atlas does (drags, the +/- controls, the rotation handle, the menu); the
 * bridge sends what changed on the tokens the player controls. The DM's Atlas decides: what it
 * accepts comes back with its changes, and a refused command puts the scene back as it sent it.
 */
export class CommandBridge {
  /** A write from the DM's Atlas is under way, which is no edit of the player's. */
  private applyingRemote = false;
  private readonly unsubscribe: () => void;

  constructor(
    store: ViewAtlasStore,
    controls: (token: TokenEntity) => boolean,
    private readonly send: (command: PlayerCommand) => Promise<boolean>,
    private readonly resync: () => void,
  ) {
    this.unsubscribe = store.subscribe((state, previous) => {
      if (this.applyingRemote || state.isMapLoading || state.objects.tokens === previous.objects.tokens) return;
      for (const [id, token] of Object.entries(state.objects.tokens)) {
        const before = previous.objects.tokens[id];
        if (!before || before === token || !controls(before)) continue;
        for (const command of commandsFor(before, token, id in state.heldTokens)) this.submit(command);
      }
    });
  }

  /** Runs `write`, a write from the DM's Atlas, without taking it for the player's edit. */
  applyRemote(write: () => void): void {
    this.applyingRemote = true;
    try {
      write();
    } finally {
      this.applyingRemote = false;
    }
  }

  destroy(): void {
    this.unsubscribe();
  }

  private submit(command: PlayerCommand): void {
    void this.send(command).then((accepted) => {
      if (!accepted) this.resync();
    });
  }
}
