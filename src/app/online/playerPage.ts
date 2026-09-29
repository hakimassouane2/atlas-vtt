import { PLAYER_PAGE_SCRIPT } from './playerPageScript';
import { PLAYER_PARTY_SCRIPT } from './playerPartyScript';
import { PLAYER_TABLE_SCRIPT } from './playerTableScript';
import { PLAYER_PAGE_STYLES } from './playerPageStyles';

/**
 * Page served to players. Plain HTML and JavaScript so it runs in any browser
 * without a build: it shows the frames of the presented scene under the player's
 * own camera, lets them drag the tokens the DM gave them, change their hit points,
 * follow the initiative order and roll dice.
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
<div id="initiative"></div>
<div id="party" class="surface"></div>
<div id="table">
  <div id="rolls"></div>
  <form id="dice-form" class="surface">
    <div class="dice-row">
      <button type="button" data-die="d4">d4</button>
      <button type="button" data-die="d6">d6</button>
      <button type="button" data-die="d8">d8</button>
      <button type="button" data-die="d10">d10</button>
      <button type="button" data-die="d12">d12</button>
      <button type="button" data-die="d20">d20</button>
      <button type="button" data-die="d100">d100</button>
    </div>
    <div class="dice-row">
      <input id="formula" placeholder="1d20+5" autocomplete="off">
      <select id="roll-target" aria-label="Lancer pour"></select>
      <button type="submit">Lancer</button>
    </div>
  </form>
</div>
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
<script>${PLAYER_PAGE_SCRIPT}${PLAYER_PARTY_SCRIPT}${PLAYER_TABLE_SCRIPT}</script>
</body>
</html>
`;
