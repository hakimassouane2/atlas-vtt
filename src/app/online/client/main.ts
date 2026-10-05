import { installAtlasOverlays } from './atlasOverlays';
import { playerCamera } from './camera';
import { connect } from './connection';
import { installDiceLauncher } from './diceLauncher';
import { byId } from './dom';
import { placeFrame } from './frames';
import { drawOverlay, installMapInput, settleLandings } from './mapInput';
import { installObsidianDom } from './obsidianDom';
import { installPartyPanel } from './partyPanel';
// Bundled into the page's stylesheet (`/styles.css`) by `vite/player-client.mts`
import './pageBase.css';
import './playerPage.css';
import { playerStateStore } from './playerState';
import { installStreamSettings } from './streamSettings';

/** Frames are asked for at the window's size: a resize reconnects once it settles. */
const RESIZE_SETTLE_MS = 300;

/**
 * The online player page (served by `OnlineSessionServer`): the presented scene under
 * the player's own camera, Atlas' player overlays, and the player's controls.
 */
function start(): void {
  installObsidianDom();

  installAtlasOverlays();
  installMapInput();
  installPartyPanel();
  installDiceLauncher();
  installStreamSettings(connect);
  byId('recenter').addEventListener('click', () => playerCamera.recenter());

  playerCamera.onChange(() => {
    placeFrame();
    drawOverlay();
  });
  playerStateStore.subscribe(() => {
    settleLandings();
    drawOverlay();
  });
  let resizeTimer: number | undefined;
  addEventListener('resize', () => {
    placeFrame();
    drawOverlay();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(connect, RESIZE_SETTLE_MS);
  });
  connect();
}

start();
