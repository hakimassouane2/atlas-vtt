/**
 * The page served to players: Atlas' own canvas draws the scene the DM's Atlas sends. It takes the
 * DM's stylesheets and theme classes (`/styles.css`) and Atlas' style root (`atlas-vtt-plugin`), so
 * Atlas' controls look as in Obsidian, and runs `/client.js`, built from `src/app/online/client/`.
 */
export function playerPageHtml(key: string, bodyClass: string): string {
  const query = `?k=${encodeURIComponent(key)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas VTT</title>
<link rel="stylesheet" href="/styles.css${query}">
</head>
<body class="${escapeAttribute(`${bodyClass} atlas-vtt-plugin`)}">
<div id="content" class="atlas-local-player-content"></div>
<div id="status" class="online-hud">Joining the game…</div>
<div id="disconnected" class="online-disconnected" role="alertdialog" aria-modal="true" aria-labelledby="disconnected-title">
<div class="online-disconnected__panel">
<div class="online-disconnected__spinner" aria-hidden="true"></div>
<div id="disconnected-title" class="online-disconnected__title">Connection lost</div>
<div class="online-disconnected__hint">Trying again… Wait here; the game comes back as soon as the GM's Atlas answers.</div>
</div>
</div>
<script src="/client.js${query}"></script>
</body>
</html>
`;
}

/** `value` safe inside a double-quoted HTML attribute. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
