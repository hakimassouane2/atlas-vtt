import { escapeAttribute } from './playerPage';

/**
 * The canvas page served to players (`/play`): Atlas' own canvas draws the scene the DM's Atlas
 * sends. It takes the DM's stylesheets and theme classes (`/canvas.css`), so Atlas' overlays look
 * as in the local player window, and runs `/canvas.js`, built from `src/app/online/canvas/`.
 */
export function playerCanvasPageHtml(key: string, bodyClass: string): string {
  const query = `?k=${encodeURIComponent(key)}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas VTT</title>
<link rel="stylesheet" href="/canvas.css${query}">
</head>
<body class="${escapeAttribute(bodyClass)}">
<div id="content" class="atlas-local-player-content"></div>
<div id="status" class="online-hud">Connexion à la partie...</div>
<script src="/canvas.js${query}"></script>
</body>
</html>
`;
}
