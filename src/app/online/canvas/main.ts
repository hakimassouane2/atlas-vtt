import { installObsidianDom } from '../client/obsidianDom';
import { byId } from '../client/dom';
import { connectToScene } from './sceneConnection';
import { InitiativeOverlay } from './initiativeOverlay';
import { PlayerCanvas } from './PlayerCanvas';
import { PagePlayer, SentCollection, pageCanvasHost } from './pageCanvasHost';
import { installPageMenus } from './pageMenus';
import { post } from '../client/session';
// Bundled into the page's stylesheet (`/canvas.css`) by `vite/player-client.mts`
import '../client/pageBase.css';
import './canvasPage.css';

/**
 * The online canvas page (served by `OnlineSessionServer` at `/play`): Atlas' own canvas shows
 * the scene the DM's Atlas sends, as players see it, with the initiative order over it, and the
 * player moves, turns and changes their tokens there as the GM does.
 */
async function start(): Promise<void> {
  installObsidianDom();
  const content = byId('content');
  installPageMenus();
  const collection = new SentCollection();
  const player = new PagePlayer();
  const canvas = new PlayerCanvas(pageCanvasHost(collection, player), (command) => post('/command', command));
  await canvas.mount(content);
  const initiative = new InitiativeOverlay(content, canvas.store, collection);

  connectToScene({
    context: (context) => {
      collection.set(context.collectionId, context.collection);
      initiative.setContext(context);
      player.set(context.playerView);
      canvas.setPlayerView(context.playerView);
    },
    scene: (scene) => void canvas.showScene(scene),
    changes: (changes) => canvas.applyChanges(changes),
  });
  addEventListener('resize', () => canvas.resize(window.innerWidth, window.innerHeight));
}

void start();
