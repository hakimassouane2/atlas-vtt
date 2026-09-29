import { PLAYER_PAGE_SCRIPT } from './playerPageScript';
import { PLAYER_PARTY_SCRIPT } from './playerPartyScript';
import { PLAYER_PAGE_STYLES } from './playerPageStyles';

/**
 * Page served to players. Plain HTML and JavaScript so it runs in any browser
 * without a build: it shows the frames of the presented scene under the player's
 * own camera, lets them drag the tokens the DM gave them and change their hit points.
 */
export const PLAYER_PAGE_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas VTT</title>
<style>${PLAYER_PAGE_STYLES}</style>
</head>
<body>
<img id="scene" alt="">
<canvas id="overlay"></canvas>
<div id="status">Connexion à la partie...</div>
<div id="following" class="badge">Caméra guidée par le MJ</div>
<div id="party" class="surface"></div>
<div id="corner">
  <button id="recenter" class="corner-button" aria-label="Recentrer sur la vue du MJ">⌖</button>
  <button id="settings-button" class="corner-button" aria-label="Réglages">⚙</button>
</div>
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
<script>${PLAYER_PAGE_SCRIPT}${PLAYER_PARTY_SCRIPT}</script>
</body>
</html>
`;
