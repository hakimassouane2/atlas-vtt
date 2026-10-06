import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { installObsidianDom } from './obsidianDom';
import { byId } from './dom';
import { announceProfile, post } from './session';
import { connectToScene } from './sceneConnection';
import { InitiativeOverlay } from './initiativeOverlay';
import { PlayerCanvas } from './PlayerCanvas';
import { PagePlayer, SentCollection, pageCanvasHost } from './pageCanvasHost';
import { installPageMenus } from './pageMenus';
import { installPageDice } from './pageDice';
import { storedInputDevice } from './inputDevice';
import { guardPageZoom } from './pageZoomGuard';
import { PlayerHud } from './PlayerHud';
import { ProfileChoice } from './profileChoice';
import { ProfileChooser } from './ProfileChooser';
import { collectionPlayers } from '../../players/playerProfiles';
// Bundled into the page's stylesheet (`/styles.css`) by `vite/player-client.mts`
import './playerPage.css';

/**
 * The online canvas page (served by `OnlineSessionServer` at `/play`): Atlas' own canvas shows
 * the scene the DM's Atlas sends, as players see it, with the initiative order and the dice
 * rolls over it, and the player, once they chose who they are, moves, turns and changes their
 * tokens there as the GM does.
 */
async function start(): Promise<void> {
  installObsidianDom();
  guardPageZoom();
  installPageMenus();
  const content = byId('content');
  const collection = new SentCollection();
  const choice = new ProfileChoice();
  const player = new PagePlayer(() => choice.profileId());
  const canvas = new PlayerCanvas(pageCanvasHost(collection, player), (command) => post('/command', command));
  await canvas.mount(content, storedInputDevice());
  const initiative = new InitiativeOverlay(content, canvas.store, collection, (token) => player.controls(token));
  const showRoll = installPageDice(content, canvas.store);

  // Another profile acts on other tokens: what was selected for the last one goes
  let announced = choice.profileId();
  choice.subscribe(() => {
    const profileId = choice.profileId();
    if (profileId === announced) return;
    announced = profileId;
    canvas.store.getState().clearSelection();
    canvas.refreshTokenUI();
    announceProfile(profileId);
  });

  const hud = content.createDiv({ cls: 'atlas-player-hud' });
  createRoot(hud).render(createElement(PlayerHud, {
    store: canvas.store,
    choice,
    controls: (token) => player.controls(token),
    roll: (formula, tokenId) => void post('/command', { type: 'roll', formula, ...(tokenId && { id: tokenId }) }),
    setInputDevice: (mode) => canvas.setInputDevice(mode),
  }));

  createRoot(content.createDiv()).render(createElement(ProfileChooser, { choice }));

  connectToScene({
    hello: () => announceProfile(choice.profileId()),
    context: (context) => {
      collection.set(context.collectionId, context.collection);
      choice.setCollection(context.collectionId, collectionPlayers(context.collection));
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
