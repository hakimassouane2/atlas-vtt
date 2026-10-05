import type { PlayerState } from '../protocol';
import { byId } from './dom';
import { playerStateStore } from './playerState';
import { post } from './session';

const target = (): HTMLSelectElement => byId<HTMLSelectElement>('roll-target');

/** The player's tokens to roll for; the choice shows only when there are several. */
function renderTargets(state: PlayerState | null): void {
  const tokens = state?.tokens ?? [];
  const select = target();
  const chosen = select.value;
  select.replaceChildren(...tokens.map((token) => new Option(token.name, token.id)));
  if (tokens.some((token) => token.id === chosen)) select.value = chosen;
  select.hidden = tokens.length <= 1;
}

/** Asks the DM's Atlas to roll `formula`; its dice engine rolls and every page shows the toast. */
function roll(formula: string): void {
  const id = target().value;
  void post('/command', { type: 'roll', formula, ...(id && { id }) });
}

/** Quick dice buttons and a formula field. */
export function installDiceLauncher(): void {
  playerStateStore.subscribe(renderTargets);
  document.querySelectorAll<HTMLButtonElement>('[data-die]').forEach((die) => {
    die.addEventListener('click', () => roll(`1${die.dataset.die ?? 'd20'}`));
  });
  const formula = byId<HTMLInputElement>('formula');
  byId<HTMLFormElement>('dice').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = formula.value.trim();
    if (text) roll(text);
  });
}
