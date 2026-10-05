/**
 * The page served to players. It takes the DM's stylesheets (`/styles.css`) and theme
 * classes, so Atlas' player overlays look as in the local player window, and runs the
 * page's script (`/client.js`, built from `src/app/online/client/`).
 */
export function playerPageHtml(key: string, bodyClass: string): string {
  const query = `?k=${encodeURIComponent(key)}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas VTT</title>
<link rel="stylesheet" href="/styles.css${query}">
</head>
<body class="${escapeAttribute(bodyClass)}">
<div id="content" class="atlas-local-player-content">
  <img id="scene" alt="">
  <canvas id="overlay"></canvas>
</div>
<div id="status" class="online-hud">Connexion à la partie...</div>
<div id="following" class="online-hud">Caméra guidée par le MJ</div>
<div id="party" class="online-surface"></div>
<div id="corner">
  <button id="recenter" class="online-button" aria-label="Recentrer sur la vue du MJ">⌖</button>
  <button id="settings-button" class="online-button" aria-label="Réglages">⚙</button>
</div>
<div id="settings" class="online-surface">
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
<form id="dice" class="online-surface">
  <div class="online-row">
    <button type="button" class="online-button" data-die="d4">d4</button>
    <button type="button" class="online-button" data-die="d6">d6</button>
    <button type="button" class="online-button" data-die="d8">d8</button>
    <button type="button" class="online-button" data-die="d10">d10</button>
    <button type="button" class="online-button" data-die="d12">d12</button>
    <button type="button" class="online-button" data-die="d20">d20</button>
    <button type="button" class="online-button" data-die="d100">d100</button>
  </div>
  <div class="online-row">
    <input id="formula" placeholder="1d20+5" autocomplete="off">
    <select id="roll-target" aria-label="Lancer pour"></select>
    <button type="submit" class="online-button mod-cta">Lancer</button>
  </div>
</form>
<script src="/client.js${query}"></script>
</body>
</html>
`;
}

/** `value` safe inside a double-quoted HTML attribute. */
export function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
