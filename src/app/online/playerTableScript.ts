/**
 * Initiative order and dice of the player page (`playerPage.ts`). Runs in the same
 * script as `playerPageScript.ts`, which calls `renderInitiative`, `renderDiceTargets`
 * and `showRoll` when the DM's Atlas sends them.
 */
export const PLAYER_TABLE_SCRIPT = `
  const initiativePanel = document.getElementById('initiative');
  const rollLog = document.getElementById('rolls');
  const formulaField = document.getElementById('formula');
  const rollTarget = document.getElementById('roll-target');
  const ROLLS_SHOWN = 5;
  const ROLL_LIFETIME_MS = 60000;

  function tokenImageUrl(tokenId) {
    return '/image?k=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(tokenId);
  }

  function portrait(tokenId, className) {
    const image = document.createElement('img');
    image.className = className;
    image.alt = '';
    image.src = tokenImageUrl(tokenId);
    image.addEventListener('error', () => image.remove());
    return image;
  }

  // ---- Initiative --------------------------------------------------------
  function renderInitiative(initiative) {
    if (!initiative) {
      initiativePanel.replaceChildren();
      return;
    }
    const cards = initiative.entries.map((entry) => {
      const card = document.createElement('div');
      card.className = 'turn' + (entry.isActive ? ' turn-active' : '');
      card.append(portrait(entry.tokenId, 'turn-portrait'));
      const value = document.createElement('span');
      value.className = 'turn-value';
      value.textContent = String(entry.initiative);
      card.append(value);
      if (entry.name) {
        const name = document.createElement('span');
        name.className = 'turn-name';
        name.textContent = entry.name;
        card.append(name);
      }
      if (entry.hp) {
        const hp = document.createElement('progress');
        hp.max = entry.hp.max;
        hp.value = Math.max(0, entry.hp.current);
        card.append(hp);
      }
      return card;
    });
    if (initiative.isActive) {
      const round = document.createElement('div');
      round.className = 'turn-round';
      round.textContent = 'Round ' + initiative.round;
      cards.push(round);
    }
    initiativePanel.replaceChildren(...cards);
  }

  // ---- Dice --------------------------------------------------------------
  /** Lists the player's tokens to roll for; hidden when there is at most one. */
  function renderDiceTargets() {
    const chosen = rollTarget.value;
    rollTarget.replaceChildren(...tokens.map((token) => {
      const option = document.createElement('option');
      option.value = token.id;
      option.textContent = token.name;
      return option;
    }));
    if (tokens.some((token) => token.id === chosen)) rollTarget.value = chosen;
    rollTarget.style.display = tokens.length > 1 ? '' : 'none';
  }

  function roll(formula) {
    const command = { type: 'roll', formula };
    if (rollTarget.value) command.id = rollTarget.value;
    post('/command', command);
  }

  document.querySelectorAll('[data-die]').forEach((button) => {
    button.addEventListener('click', () => roll('1' + button.dataset.die));
  });
  document.getElementById('dice-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (formulaField.value.trim()) roll(formulaField.value.trim());
  });

  function showRoll(result) {
    const entry = document.createElement('div');
    entry.className = 'roll' + (result.byPlayer ? ' roll-player' : '');
    if (result.tokenId) entry.append(portrait(result.tokenId, 'roll-portrait'));
    const text = document.createElement('div');
    text.className = 'roll-text';
    const title = document.createElement('div');
    title.className = 'roll-title';
    title.textContent = (result.label ? result.label + ' · ' : '') + result.formula;
    const detail = document.createElement('div');
    detail.className = 'roll-detail';
    detail.textContent = result.rolls.map((die) => die.value).join(' + ')
      + (result.modifiers ? (result.modifiers > 0 ? ' + ' : ' − ') + Math.abs(result.modifiers) : '');
    text.append(title, detail);
    const total = document.createElement('div');
    total.className = 'roll-total';
    total.textContent = String(result.total);
    entry.append(text, total);
    rollLog.prepend(entry);
    while (rollLog.children.length > ROLLS_SHOWN) rollLog.lastChild.remove();
    setTimeout(() => entry.remove(), ROLL_LIFETIME_MS);
  }
`;
