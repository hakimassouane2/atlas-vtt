/**
 * Party panel of the player page (`playerPage.ts`): one entry per token the player
 * controls, with its resources and conditions. Runs in the same script as
 * `playerPageScript.ts`, which sets `conditionDefinitions` and calls `renderParty`.
 */
export const PLAYER_PARTY_SCRIPT = `
  // ---- Hit points and conditions -----------------------------------------
  function renderParty() {
    const focused = document.activeElement;
    const editing = focused && focused.dataset && focused.dataset.resource;
    const shown = tokens.filter((token) => token.hp || token.stress || conditionDefinitions.length > 0);
    party.replaceChildren(...shown.map((token) => {
      const member = document.createElement('div');
      member.className = 'member';
      const name = document.createElement('div');
      name.className = 'member-name';
      name.textContent = token.name;
      member.append(name);
      if (token.hp) member.append(resourceRow(token, 'hp', 'PV', token.hp));
      if (token.stress) member.append(resourceRow(token, 'stress', 'Stress', token.stress));
      if (conditionDefinitions.length > 0) member.append(conditionRow(token));
      return member;
    }));
    // Keep the field the player is typing in
    if (editing) {
      const field = party.querySelector('[data-resource="' + editing + '"]');
      if (field) { field.value = focused.value; field.focus(); }
    }
  }
  function resourceRow(token, kind, label, value) {
    const row = document.createElement('div');
    row.className = 'resource';
    const text = document.createElement('span');
    text.className = 'resource-label';
    text.textContent = label;
    const field = document.createElement('input');
    field.type = 'number';
    field.value = String(value.current);
    field.dataset.resource = token.id + ':' + kind;
    field.addEventListener('change', () => sendResource(Number(field.value)));
    field.addEventListener('keydown', (event) => { if (event.key === 'Enter') field.blur(); });
    // Step from the field, so quick clicks add up before the DM's Atlas answers
    const step = (delta) => {
      field.value = String(Math.min(value.max, Math.max(0, Number(field.value) + delta)));
      sendResource(Number(field.value));
    };
    const minus = document.createElement('button');
    minus.textContent = '−';
    minus.addEventListener('click', () => step(-1));
    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.addEventListener('click', () => step(1));
    const max = document.createElement('span');
    max.textContent = '/ ' + value.max;
    row.append(text, minus, field, max, plus);
    return row;
    function sendResource(current) {
      if (Number.isFinite(current)) post('/command', { type: 'resource', id: token.id, kind, current });
    }
  }

  function conditionRow(token) {
    const row = document.createElement('div');
    row.className = 'conditions';
    const setCondition = (id, active) => post('/command', { type: 'condition', id: token.id, conditionId: id, active });
    const step = (id, delta) => post('/command', { type: 'conditionValue', id: token.id, conditionId: id, delta });
    for (const active of token.conditions) {
      const definition = conditionDefinitions.find((condition) => condition.id === active.id);
      if (!definition) continue;
      const chip = document.createElement('span');
      chip.className = 'condition';
      chip.style.borderColor = definition.color;
      const label = document.createElement('span');
      label.textContent = definition.name + (definition.valued ? ' ' + active.value : '');
      chip.append(label);
      if (definition.valued) chip.append(smallButton('−', () => step(definition.id, -1)), smallButton('+', () => step(definition.id, 1)));
      chip.append(smallButton('✕', () => setCondition(definition.id, false)));
      row.append(chip);
    }
    const inactive = conditionDefinitions.filter((condition) => !token.conditions.some((active) => active.id === condition.id));
    if (inactive.length > 0) {
      const add = document.createElement('select');
      add.append(new Option('+ Condition', ''), ...inactive.map((condition) => new Option(condition.name, condition.id)));
      add.addEventListener('change', () => { if (add.value) setCondition(add.value, true); });
      row.append(add);
    }
    return row;
  }
  function smallButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }
`;
