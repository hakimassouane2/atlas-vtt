import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { installObsidianDom } from './obsidianDom';
import { byId } from './dom';
import { post } from './session';
import { mapResources } from '../../resources/collectionResources';
import { connectToScene } from './sceneConnection';
import { InitiativeOverlay } from './initiativeOverlay';
import { PlayerCanvas } from './PlayerCanvas';
import { PagePlayer, SentCollection, pageCanvasHost } from './pageCanvasHost';
import { installPageMenus } from './pageMenus';
import { installPageDice } from './pageDice';
import { PageCamera } from './pageCamera';
import { PlayerHud } from './PlayerHud';
// Bundled into the page's stylesheet (`/styles.css`) by `vite/player-client.mts`
import './playerPage.css';

/**
 * The online canvas page (served by `OnlineSessionServer` at `/play`): Atlas' own canvas shows
 * the scene the DM's Atlas sends, as players see it, with the initiative order and the dice
 * rolls over it, and the player moves, turns and changes their tokens there as the GM does.
 */
async function start(): Promise<void> {
  installObsidianDom();
  installPageMenus();
  const content = byId('content');
  const collection = new SentCollection();
  const player = new PagePlayer();
  const canvas = new PlayerCanvas(pageCanvasHost(collection, player), (command) => post('/command', command));
  await canvas.mount(content);
  const camera = new PageCamera(() => canvas.viewport);
  const initiative = new InitiativeOverlay(content, canvas.store, collection);
  const showRoll = installPageDice(content, canvas.store);
  const resources = (): ReturnType<typeof mapResources> => mapResources(collection, canvas.store.getState().mapPath);

  const hud = content.createDiv({ cls: 'atlas-player-hud' });
  createRoot(hud).render(createElement(PlayerHud, {
    store: canvas.store,
    camera,
    controls: (token) => player.controls(token),
    resources,
    roll: (formula, tokenId) => void post('/command', { type: 'roll', formula, ...(tokenId && { id: tokenId }) }),
    focus: (token) => {
      canvas.store.getState().setSelection([token.id]);
      canvas.viewport?.animate({ position: { x: token.x, y: token.y }, time: 300, ease: 'easeInOutSine', removeOnInterrupt: true });
    },
  }));

  connectToScene({
    context: (context) => {
      collection.set(context.collectionId, context.collection);
      initiative.setContext(context);
      player.set(context.playerView);
      canvas.setPlayerView(context.playerView);
    },
    scene: (scene) => void canvas.showScene(scene).then(() => {
      if (camera.isFollowing()) camera.recenter();
    }),
    changes: (changes) => canvas.applyChanges(changes),
    camera: (dm) => camera.setDmCamera(dm),
    following: (isFollowing) => camera.setFollowing(isFollowing),
    recenter: () => camera.recenter(),
    roll: showRoll,
  });
  addEventListener('resize', () => canvas.resize(window.innerWidth, window.innerHeight));
}

void start();
