/**
 * Page served to players. Plain HTML and JavaScript so it runs in any browser
 * without a build. It asks for frames the size of the window, at the frame rate
 * and quality the player picked, and shows each one full page.
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
  #status { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  body.live #status { inset: auto auto 12px 12px; padding: 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.7); font-size: 13px; }
  body.live #status:empty { display: none; }
  #settings-button { position: fixed; top: 12px; right: 12px; width: 36px; height: 36px; border: 0; border-radius: 8px;
    background: rgba(0, 0, 0, 0.6); color: #ddd; font-size: 20px; cursor: pointer; opacity: 0.5; }
  #settings-button:hover { opacity: 1; }
  #settings { position: fixed; top: 56px; right: 12px; display: none; flex-direction: column; gap: 12px; padding: 12px;
    border-radius: 12px; background: rgba(20, 20, 20, 0.95); border: 1px solid #333; }
  #settings.open { display: flex; }
  #settings label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  #settings select { padding: 4px; border-radius: 8px; background: #222; color: #ddd; border: 1px solid #444; }
</style>
</head>
<body>
<img id="scene" alt="">
<div id="status">Connexion à la partie...</div>
<button id="settings-button" aria-label="Réglages">⚙</button>
<div id="settings">
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
  const status = document.getElementById('status');
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

  // Decode frames one at a time and skip the ones superseded meanwhile.
  let latest = null;
  let decoding = false;
  function showLatest() {
    if (decoding || !latest) return;
    const src = latest;
    latest = null;
    decoding = true;
    const next = new Image();
    next.src = src;
    next.decode().then(() => {
      scene.src = src;
      document.body.classList.add('live');
      status.textContent = '';
    }).catch(() => {}).finally(() => {
      decoding = false;
      showLatest();
    });
  }

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
      latest = 'data:image/jpeg;base64,' + event.data;
      showLatest();
    });
    events.onopen = () => {
      status.textContent = document.body.classList.contains('live') ? '' : 'En attente de la scène du MJ...';
    };
    events.onerror = () => { status.textContent = 'Connexion perdue, nouvelle tentative...'; };
  }

  let resizeTimer = null;
  addEventListener('resize', () => {
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
