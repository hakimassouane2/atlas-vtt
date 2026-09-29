/**
 * Script of the player page (`playerPage.ts`). The player has their own camera: the
 * page places the latest frame under it at once, so panning and zooming answer
 * immediately, and tells the DM's Atlas, which renders the next frames through it.
 * While the DM makes players follow their camera, frames set the camera instead.
 */
export const PLAYER_PAGE_SCRIPT = `
  const key = new URLSearchParams(location.search).get('k') || '';
  const scene = document.getElementById('scene');
  const overlay = document.getElementById('overlay');
  const context = overlay.getContext('2d');
  const status = document.getElementById('status');
  const party = document.getElementById('party');
  const fpsSelect = document.getElementById('fps');
  const qualitySelect = document.getElementById('quality');
  const MIN_ZOOM = 0.02;
  const MAX_ZOOM = 20;

  function readPref(name, fallback) {
    try { return localStorage.getItem('atlas-' + name) || fallback; } catch { return fallback; }
  }
  function writePref(name, value) {
    try { localStorage.setItem('atlas-' + name, value); } catch {}
  }
  fpsSelect.value = readPref('fps', '30');
  qualitySelect.value = readPref('quality', 'high');

  // ---- Camera ------------------------------------------------------------
  /** What the player looks at: world centre and CSS pixels per world pixel; null until known. */
  let camera = null;
  let following = false;
  let playerId = null;
  /** Where the frame on screen looks, so it can be placed under the camera. */
  let frameView = null;

  function toWorld(clientX, clientY) {
    return { x: camera.centerX + (clientX - innerWidth / 2) / camera.zoom, y: camera.centerY + (clientY - innerHeight / 2) / camera.zoom };
  }
  function toScreen(x, y) {
    return { x: innerWidth / 2 + (x - camera.centerX) * camera.zoom, y: innerHeight / 2 + (y - camera.centerY) * camera.zoom };
  }

  function layout() {
    if (camera && frameView) {
      const size = camera.zoom / frameView.zoom;
      const topLeft = toScreen(frameView.centerX - frameView.cssWidth / 2 / frameView.zoom, frameView.centerY - frameView.cssHeight / 2 / frameView.zoom);
      scene.style.left = topLeft.x + 'px';
      scene.style.top = topLeft.y + 'px';
      scene.style.width = frameView.cssWidth * size + 'px';
      scene.style.height = frameView.cssHeight * size + 'px';
    }
    draw();
  }

  let cameraTimer = null;
  function cameraMoved() {
    layout();
    if (cameraTimer) return;
    cameraTimer = setTimeout(() => {
      cameraTimer = null;
      if (camera) post('/camera', { centerX: camera.centerX, centerY: camera.centerY, scale: camera.zoom });
    }, 50);
  }

  function recenter() {
    camera = null;
    post('/camera', { recenter: true });
  }

  // ---- Frames ------------------------------------------------------------
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
      frameView = frame.view;
      // A player without a camera (or following the DM) takes the DM's framing
      if (frame.view.isDmCamera && (following || !camera)) {
        camera = { centerX: frame.view.centerX, centerY: frame.view.centerY, zoom: frame.view.zoom };
      }
      document.body.classList.add('live');
      status.textContent = '';
      layout();
    }).catch(() => {}).finally(() => {
      decoding = false;
      showLatest();
    });
  }

  // ---- Tokens the player controls ----------------------------------------
  let tokens = [];
  let hovered = null;
  /** The token being dragged: where the pointer grabbed it and where it would land. */
  let drag = null;
  /** The camera being panned: where the pointer and the camera started. */
  let pan = null;
  /** Dropped tokens, shown where they land until the DM's Atlas moved them. */
  const landing = new Map();

  function tokenAt(clientX, clientY) {
    if (!camera) return null;
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
    if (!camera) return;
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
    context.arc(center.x, center.y, token.radius * camera.zoom + 2, 0, Math.PI * 2);
    context.stroke();
  }

  overlay.addEventListener('pointerdown', (event) => {
    if (!camera) return;
    const token = tokenAt(event.clientX, event.clientY);
    if (token) {
      const point = toWorld(event.clientX, event.clientY);
      drag = { id: token.id, dx: token.x - point.x, dy: token.y - point.y, to: { x: token.x, y: token.y } };
    } else if (!following) {
      pan = { x: event.clientX, y: event.clientY, centerX: camera.centerX, centerY: camera.centerY };
      overlay.style.cursor = 'grabbing';
    } else {
      return;
    }
    overlay.setPointerCapture(event.pointerId);
    draw();
  });
  overlay.addEventListener('pointermove', (event) => {
    if (drag) {
      const point = toWorld(event.clientX, event.clientY);
      drag.to = { x: point.x + drag.dx, y: point.y + drag.dy };
      draw();
    } else if (pan) {
      camera.centerX = pan.centerX - (event.clientX - pan.x) / camera.zoom;
      camera.centerY = pan.centerY - (event.clientY - pan.y) / camera.zoom;
      cameraMoved();
    } else {
      const token = tokenAt(event.clientX, event.clientY);
      hovered = token ? token.id : null;
      overlay.style.cursor = token ? 'pointer' : '';
      draw();
    }
  });
  function release() {
    if (drag) {
      const { id, to } = drag;
      landing.set(id, to);
      setTimeout(() => { landing.delete(id); draw(); }, 1500);
      post('/command', { type: 'move', id, x: to.x, y: to.y });
    }
    drag = null;
    pan = null;
    overlay.style.cursor = '';
    draw();
  }
  overlay.addEventListener('pointerup', release);
  overlay.addEventListener('pointercancel', () => { drag = null; release(); });

  overlay.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (following || !camera) return;
    const point = toWorld(event.clientX, event.clientY);
    camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * Math.exp(-event.deltaY * 0.0015)));
    // Keep the point under the cursor in place
    camera.centerX = point.x - (event.clientX - innerWidth / 2) / camera.zoom;
    camera.centerY = point.y - (event.clientY - innerHeight / 2) / camera.zoom;
    cameraMoved();
  }, { passive: false });

  function post(path, body) {
    const query = '?k=' + encodeURIComponent(key) + (playerId ? '&id=' + encodeURIComponent(playerId) : '');
    fetch(path + query, { method: 'POST', body: JSON.stringify(body) })
      .then((response) => {
        if (response.status === 409 && path === '/command') status.textContent = 'Action refusée : le MJ est peut-être sur une autre scène.';
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
    events.addEventListener('hello', (event) => {
      playerId = JSON.parse(event.data).id;
      // A new connection starts on the DM's camera: carry the player's own over
      if (camera && !following) post('/camera', { centerX: camera.centerX, centerY: camera.centerY, scale: camera.zoom });
    });
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
    events.addEventListener('mode', (event) => {
      const wasFollowing = following;
      following = JSON.parse(event.data).isFollowingDm;
      document.body.classList.toggle('following', following);
      // Released players keep looking where the DM left them
      if (wasFollowing && !following && camera) cameraMoved();
    });
    events.addEventListener('recenter', () => { camera = null; });
    events.onopen = () => {
      status.textContent = document.body.classList.contains('live') ? '' : 'En attente de la scène du MJ...';
    };
    events.onerror = () => { status.textContent = 'Connexion perdue, nouvelle tentative...'; };
  }

  let resizeTimer = null;
  addEventListener('resize', () => {
    layout();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(connect, 300);
  });
  fpsSelect.addEventListener('change', () => { writePref('fps', fpsSelect.value); connect(); });
  qualitySelect.addEventListener('change', () => { writePref('quality', qualitySelect.value); connect(); });
  document.getElementById('settings-button').addEventListener('click', () => {
    document.getElementById('settings').classList.toggle('open');
  });
  document.getElementById('recenter').addEventListener('click', recenter);
  connect();
`;
