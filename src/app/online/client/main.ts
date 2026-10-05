import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { installObsidianDom } from './obsidianDom';
import { byId } from './dom';
import { post } from './session';
import { connectToScene } from './sceneConnection';
import { InitiativeOverlay } from './initiativeOverlay';
import { PlayerCanvas } from './PlayerCanvas';
import { PagePlayer, SentCollection, pageCanvasHost } from './pageCanvasHost';
import { installPageMenus } from './pageMenus';
import { installPageDice } from './pageDice';
import { storedInputDevice } from './inputDevice';
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
  await canvas.mount(content, storedInputDevice());
  const initiative = new InitiativeOverlay(content, canvas.store, collection);
  const showRoll = installPageDice(content, canvas.store);

  const hud = content.createDiv({ cls: 'atlas-player-hud' });
  createRoot(hud).render(createElement(PlayerHud, {
    store: canvas.store,
    controls: (token) => player.controls(token),
    roll: (formula, tokenId) => void post('/command', { type: 'roll', formula, ...(tokenId && { id: tokenId }) }),
    setInputDevice: (mode) => canvas.setInputDevice(mode),
  }));

  connectToScene({
    context: (context) => {
      collection.set(context.collectionId, context.collection);
      initiative.setContext(context);
      player.set(context.playerView);
      canvas.setPlayerView(context.playerView);
    },
    scene: (scene) => void canvas.showScene(scene),
    changes: (changes) => canvas.applyChanges(changes),
    roll: showRoll,
  });
  addEventListener('resize', () => canvas.resize(window.innerWidth, window.innerHeight));
}

void start();
