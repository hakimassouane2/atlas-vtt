/**
 * Page served to players. Plain HTML and JavaScript so it runs in any browser
 * without a build. It asks for frames the size of the window, at the frame rate
 * and quality the player picked, and shows each one full page. Players drag the
 * tokens the DM gave them and change their hit points; the DM's Atlas applies it
 * and the next frame shows the result.
 */
export const PLAYER_PAGE_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas VTT</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #ddd; font-family: system-ui, sans-serif; overflow: hidden; }
  #scene { position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: contain; display: none; }
  body.live #scene { display: block; }
  #overlay { position: fixed; inset: 0; width: 100vw; height: 100vh; touch-action: none; }
  #status { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; pointer-events: none; }
  body.live #status { inset: auto 12px 12px auto; padding: 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.7); font-size: 13px; }
  body.live #status:empty { display: none; }
  .surface { position: fixed; padding: 12px; border-radius: 12px; background: rgba(20, 20, 20, 0.92); border: 1px solid #333; }
  #settings-button { position: fixed; top: 12px; right: 12px; width: 36px; height: 36px; border: 0; border-radius: 8px;
    background: rgba(0, 0, 0, 0.6); color: #ddd; font-size: 20px; cursor: pointer; opacity: 0.5; }
  #settings-button:hover { opacity: 1; }
  #settings { top: 56px; right: 12px; display: none; flex-direction: column; gap: 12px; }
  #settings.open { display: flex; }
  #settings label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  select, input { padding: 4px; border-radius: 8px; background: #222; color: #ddd; border: 1px solid #444; font: inherit; }
  #party { left: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 12px; }
  #party:empty { display: none; }
  .member { display: flex; flex-direction: column; gap: 8px; }
  .member-name { font-weight: 600; font-size: 14px; }
  .resource { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .resource-label { width: 48px; color: #aaa; }
  .resource button { width: 28px; height: 28px; border: 0; border-radius: 8px; background: #333; color: #ddd; font-size: 16px; cursor: pointer; }
  .resource button:hover { background: #444; }
  .resource input { width: 48px; text-align: center; }
</style>
</head>
<body>
<img id="scene" alt="">
<canvas id="overlay"></canvas>
<div id="status">Connexion à la partie...</div>
<div id="party" class="surface"></div>
<button id="settings-button" aria-label="Réglages">⚙</button>
<div id="settings" class="surface">
  <label>Images par seconde
    <select id="fps">
      <option value="5">5</option>
      <option value="10">10</option>
      <option value="15">15</option>
      <option value="30">30</option>
      <option value="60">60</option>
    </select>
  </label>
  <label>Qualité
    <select id="quality">
      <option value="high">Haute</option>
      <option value="medium">Moyenne</option>
      <option value="low">Basse (connexion lente)</option>
    </select>
  </label>
</div>
<script>
  const key = new URLSearchParams(location.search).get('k') || '';
  const scene = document.getElementById('scene');
  const overlay = document.getElementById('overlay');
  const context = overlay.getContext('2d');
  const status = document.getElementById('status');
  const party = document.getElementById('party');
  const fpsSelect = document.getElementById('fps');
  const qualitySelect = document.getElementById('quality');

  function readPref(name, fallback) {
    try { return localStorage.getItem('atlas-' + name) || fallback; } catch { return fallback; }
  }
  function writePref(name, value) {
    try { localStorage.setItem('atlas-' + name, value); } catch {}
  }
  fpsSelect.value = readPref('fps', '30');
  qualitySelect.value = readPref('quality', 'high');

  // ---- Frames -------------------------------------------------------------
  /** Camera and size of the frame on screen: turns pointer positions into map positions. */
  let view = null;
  let latest = null;
  let decoding = false;
  function showLatest() {
    if (decoding || !latest) return;
    const frame = latest;
    latest = null;
    decoding = true;
    const next = new Image();
    next.src = frame.src;
    next.decode().then(() => {
      scene.src = frame.src;
      view = frame.view;
      document.body.classList.add('live');
      status.textContent = '';
      draw();
    }).catch(() => {}).finally(() => {
      decoding = false;
      showLatest();
    });
  }

  // The frame fills the window like object-fit: contain.
  function frameRect() {
    const fit = Math.min(innerWidth / view.width, innerHeight / view.height);
    return { fit, left: (innerWidth - view.width * fit) / 2, top: (innerHeight - view.height * fit) / 2 };
  }
  function toWorld(clientX, clientY) {
    const rect = frameRect();
    return {
      x: view.centerX + ((clientX - rect.left) / rect.fit - view.width / 2) / view.scale,
      y: view.centerY + ((clientY - rect.top) / rect.fit - view.height / 2) / view.scale,
    };
  }
  function toScreen(x, y) {
    const rect = frameRect();
    return {
      x: rect.left + ((x - view.centerX) * view.scale + view.width / 2) * rect.fit,
      y: rect.top + ((y - view.centerY) * view.scale + view.height / 2) * rect.fit,
    };
  }
  function screenLength(worldLength) {
    return worldLength * view.scale * frameRect().fit;
  }

  // ---- Tokens the player controls ----------------------------------------
  let tokens = [];
  let hovered = null;
  /** The token being dragged: its id, where the pointer grabbed it, where it would land. */
  let drag = null;
  /** Dropped tokens, shown where they land until the DM's Atlas moved them. */
  const landing = new Map();

  function tokenAt(clientX, clientY) {
    if (!view) return null;
    const point = toWorld(clientX, clientY);
    return tokens.find((token) => Math.hypot(point.x - token.x, point.y - token.y) <= token.radius) || null;
  }

  function draw() {
    const ratio = window.devicePixelRatio || 1;
    if (overlay.width !== Math.round(innerWidth * ratio) || overlay.height !== Math.round(innerHeight * ratio)) {
      overlay.width = Math.round(innerWidth * ratio);
      overlay.height = Math.round(innerHeight * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, innerWidth, innerHeight);
    if (!view) return;
    for (const token of tokens) {
      const target = drag && drag.id === token.id ? drag.to : landing.get(token.id);
      if (target) {
        drawRing(token, token.x, token.y, 'rgba(255, 255, 255, 0.35)', [6, 6]);
        drawRing(token, target.x, target.y, 'rgba(120, 200, 255, 0.95)', []);
      } else if (hovered === token.id) {
        drawRing(token, token.x, token.y, 'rgba(120, 200, 255, 0.8)', []);
      }
    }
  }
  function drawRing(token, x, y, color, dash) {
    const center = toScreen(x, y);
    context.beginPath();
    context.setLineDash(dash);
    context.lineWidth = 3;
    context.strokeStyle = color;
    context.arc(center.x, center.y, screenLength(token.radius) + 2, 0, Math.PI * 2);
    context.stroke();
  }

  overlay.addEventListener('pointerdown', (event) => {
    const token = tokenAt(event.clientX, event.clientY);
    if (!token) return;
    const point = toWorld(event.clientX, event.clientY);
    drag = { id: token.id, dx: token.x - point.x, dy: token.y - point.y, to: { x: token.x, y: token.y } };
    overlay.setPointerCapture(event.pointerId);
    draw();
  });
  overlay.addEventListener('pointermove', (event) => {
    if (drag) {
      const point = toWorld(event.clientX, event.clientY);
      drag.to = { x: point.x + drag.dx, y: point.y + drag.dy };
    } else {
      const token = tokenAt(event.clientX, event.clientY);
      hovered = token ? token.id : null;
      overlay.style.cursor = token ? 'grab' : 'default';
    }
    draw();
  });
  overlay.addEventListener('pointerup', () => {
    if (!drag) return;
    const { id, to } = drag;
    drag = null;
    landing.set(id, to);
    setTimeout(() => { landing.delete(id); draw(); }, 1500);
    send({ type: 'move', id, x: to.x, y: to.y });
    draw();
  });
  overlay.addEventListener('pointercancel', () => { drag = null; draw(); });

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
    const minus = document.createElement('button');
    minus.textContent = '−';
    // Step from the field, so quick clicks add up before the DM's Atlas answers
    minus.addEventListener('click', () => step(-1));
    const field = document.createElement('input');
    field.type = 'number';
    field.value = String(value.current);
    field.dataset.resource = token.id + ':' + kind;
    field.addEventListener('change', () => sendResource(token.id, kind, Number(field.value)));
    field.addEventListener('keydown', (event) => { if (event.key === 'Enter') field.blur(); });
    const max = document.createElement('span');
    max.textContent = '/ ' + value.max;
    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.addEventListener('click', () => step(1));
    function step(delta) {
      field.value = String(Math.min(value.max, Math.max(0, Number(field.value) + delta)));
      sendResource(token.id, kind, Number(field.value));
    }
    row.append(text, minus, field, max, plus);
    return row;
  }
  function sendResource(id, kind, current) {
    if (Number.isFinite(current)) send({ type: 'resource', id, kind, current });
  }

  function send(command) {
    fetch('/command?k=' + encodeURIComponent(key), { method: 'POST', body: JSON.stringify(command) })
      .then((response) => {
        if (response.status === 409) status.textContent = 'Action refusée : le MJ est peut-être sur une autre scène.';
      })
      .catch(() => { status.textContent = 'Action non envoyée, connexion perdue.'; });
  }

  // ---- Connection --------------------------------------------------------
  let events = null;
  function connect() {
    if (events) events.close();
    const ratio = window.devicePixelRatio || 1;
    const query = new URLSearchParams({
      k: key,
      w: String(Math.round(innerWidth * ratio)),
      h: String(Math.round(innerHeight * ratio)),
      cw: String(innerWidth),
      fps: fpsSelect.value,
      q: qualitySelect.value,
    });
    events = new EventSource('/events?' + query);
    events.addEventListener('frame', (event) => {
      const split = event.data.indexOf('\\n');
      latest = { view: JSON.parse(event.data.slice(0, split)), src: 'data:image/jpeg;base64,' + event.data.slice(split + 1) };
      showLatest();
    });
    events.addEventListener('state', (event) => {
      tokens = JSON.parse(event.data).tokens;
      for (const token of tokens) {
        const target = landing.get(token.id);
        if (target && Math.hypot(target.x - token.x, target.y - token.y) < token.radius) landing.delete(token.id);
      }
      renderParty();
      draw();
    });
    events.onopen = () => {
      status.textContent = document.body.classList.contains('live') ? '' : 'En attente de la scène du MJ...';
    };
    events.onerror = () => { status.textContent = 'Connexion perdue, nouvelle tentative...'; };
  }

  let resizeTimer = null;
  addEventListener('resize', () => {
    draw();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(connect, 300);
  });
  fpsSelect.addEventListener('change', () => { writePref('fps', fpsSelect.value); connect(); });
  qualitySelect.addEventListener('change', () => { writePref('quality', qualitySelect.value); connect(); });
  document.getElementById('settings-button').addEventListener('click', () => {
    document.getElementById('settings').classList.toggle('open');
  });
  connect();
</script>
</body>
</html>
`;
