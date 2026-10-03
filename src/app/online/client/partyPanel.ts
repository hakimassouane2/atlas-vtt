import type { PlayerResource, PlayerToken } from '../playerTokens';
import type { PlayerState } from '../protocol';
import { button, byId, element } from './dom';
import { playerStateStore } from './playerState';
import { post } from './session';

type ConditionDefinitions = PlayerState['conditions'];

const party = (): HTMLElement => byId('party');

/**
 * One entry per token the player controls: the resources the collection shows players
 * and its conditions, which the player changes here. The DM's Atlas applies each change and
 * sends the token back, so the panel is redrawn from the scene; a field being typed
 * in keeps its value.
 */
function renderParty(state: PlayerState | null): void {
  if (!state) return;
  const focused = document.activeElement;
  const editing = focused instanceof HTMLInputElement ? focused.dataset.resource : undefined;
  const shown = state.tokens.filter((token) => token.resources.length > 0 || state.conditions.length > 0);
  party().replaceChildren(...shown.map((token) => {
    const member = element('div', 'online-member');
    member.append(element('div', 'online-member-name', token.name));
    for (const resource of token.resources) member.append(resourceRow(token, resource));
    if (state.conditions.length > 0) member.append(conditionRow(token, state.conditions));
    return member;
  }));
  if (editing && focused instanceof HTMLInputElement) {
    const field = party().querySelector<HTMLInputElement>(`[data-resource="${editing}"]`);
    if (field) {
      field.value = focused.value;
      field.focus();
    }
  }
}

function resourceRow(token: PlayerToken, { key, name: label, value }: PlayerResource): HTMLElement {
  const row = element('div', 'online-row online-resource');
  const field = element('input');
  field.type = 'number';
  field.value = String(value.current);
  field.dataset.resource = `${token.id}:${key}`;
  const send = (): void => {
    const current = Number(field.value);
    if (Number.isFinite(current)) post('/command', { type: 'resource', id: token.id, key, current });
  };
  field.addEventListener('change', send);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') field.blur();
  });
  // Step from the field, so quick clicks add up before the DM's Atlas answers
  const step = (delta: number): void => {
    field.value = String(Math.min(value.max, Math.max(0, Number(field.value) + delta)));
    send();
  };
  row.append(
    element('span', 'online-resource-label', label),
    button('−', () => step(-1), `${label} −1`),
    field,
    element('span', undefined, `/ ${value.max}`),
    button('+', () => step(1), `${label} +1`),
  );
  return row;
}

function conditionRow(token: PlayerToken, definitions: ConditionDefinitions): HTMLElement {
  const row = element('div', 'online-conditions');
  const setCondition = (conditionId: string, active: boolean): void =>
    post('/command', { type: 'condition', id: token.id, conditionId, active });
  const step = (conditionId: string, delta: 1 | -1): void =>
    post('/command', { type: 'conditionValue', id: token.id, conditionId, delta });
  for (const active of token.conditions) {
    const definition = definitions.find((condition) => condition.id === active.id);
    if (!definition) continue;
    const chip = element('span', 'online-condition');
    chip.style.borderColor = definition.color;
    chip.append(element('span', undefined, definition.valued ? `${definition.name} ${active.value}` : definition.name));
    if (definition.valued) {
      chip.append(button('−', () => step(definition.id, -1), `${definition.name} −1`), button('+', () => step(definition.id, 1), `${definition.name} +1`));
    }
    chip.append(button('✕', () => setCondition(definition.id, false), `Retirer ${definition.name}`));
    row.append(chip);
  }
  const inactive = definitions.filter((condition) => !token.conditions.some((active) => active.id === condition.id));
  if (inactive.length > 0) {
    const add = element('select');
    add.append(new Option('+ Condition', ''), ...inactive.map((condition) => new Option(condition.name, condition.id)));
    add.addEventListener('change', () => {
      if (add.value) setCondition(add.value, true);
    });
    row.append(add);
  }
  return row;
}

export function installPartyPanel(): void {
  playerStateStore.subscribe(renderParty);
}
