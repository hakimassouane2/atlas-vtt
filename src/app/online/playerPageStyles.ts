/** Styles of the player page (`playerPage.ts`). */
export const PLAYER_PAGE_STYLES = `
  html, body { margin: 0; height: 100%; background: #000; color: #ddd; font-family: system-ui, sans-serif; overflow: hidden; }
  #scene { position: fixed; display: none; max-width: none; user-select: none; pointer-events: none; }
  body.live #scene { display: block; }
  #overlay { position: fixed; inset: 0; width: 100vw; height: 100vh; touch-action: none; cursor: grab; }
  body.following #overlay { cursor: default; }
  #status { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; pointer-events: none; }
  body.live #status { inset: auto 12px 12px auto; padding: 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.7); font-size: 13px; }
  body.live #status:empty { display: none; }
  .badge { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); padding: 8px; border-radius: 8px;
    background: rgba(0, 0, 0, 0.7); font-size: 13px; display: none; pointer-events: none; }
  body.following #following { display: block; }
  .surface { position: fixed; padding: 12px; border-radius: 12px; background: rgba(20, 20, 20, 0.92); border: 1px solid #333; }
  #corner { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
  .corner-button { width: 36px; height: 36px; border: 0; border-radius: 8px; background: rgba(0, 0, 0, 0.6); color: #ddd;
    font-size: 20px; cursor: pointer; opacity: 0.5; }
  .corner-button:hover { opacity: 1; }
  body.following #recenter { display: none; }
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
`;
