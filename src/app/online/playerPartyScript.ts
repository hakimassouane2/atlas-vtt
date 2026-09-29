/**
 * Hit point panel of the player page (`playerPage.ts`): one entry per token the
 * player controls, with its resources. Runs in the same script as `playerPageScript.ts`.
 */
export const PLAYER_PARTY_SCRIPT = `
  // ---- Hit points --------------------------------------------------------
  function renderParty() {
    const focused = document.activeElement;
    const editing = focused && focused.dataset && focused.dataset.resource;
    party.replaceChildren(...tokens.filter((token) => token.hp || token.stress).map((token) => {
      const member = document.createElement('div');
      member.className = 'member';
      const name = document.createElement('div');
      name.className = 'member-name';
      name.textContent = token.name;
      member.append(name);
      if (token.hp) member.append(resourceRow(token, 'hp', 'PV', token.hp));
      if (token.stress) member.append(resourceRow(token, 'stress', 'Stress', token.stress));
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
`;
