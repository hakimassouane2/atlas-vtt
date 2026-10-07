import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { installObsidianDom } from './obsidianDom';
import { byId } from './dom';
import { announceProfile, currentPlayerId, post } from './session';
import { connectToScene } from './sceneConnection';
import { InitiativeOverlay } from './initiativeOverlay';
import { PlayerCanvas } from './PlayerCanvas';
import { PagePlayer, SentCollection, pageCanvasHost } from './pageCanvasHost';
import { installPageMenus } from './pageMenus';
import { installPageDice, pageDiceSettings } from './pageDice';
import { PageDiceLog, installPageDiceLog } from './pageDiceLog';
import { storedInputDevice } from './inputDevice';
import { guardPageZoom } from './pageZoomGuard';
import { guardNativeContextMenu } from './pageContextMenuGuard';
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
  guardNativeContextMenu();
  installPageMenus();
  const content = byId('content');
  const collection = new SentCollection();
  const choice = new ProfileChoice();
  const player = new PagePlayer(() => choice.profileId());
  // The player points in their profile's colour
  const laserColor = (): string | null => choice.getState().chosen?.color ?? null;
  const canvas = new PlayerCanvas(pageCanvasHost(collection, player, laserColor), (command) => post('/command', command));
  await canvas.mount(content, storedInputDevice());
  const initiative = new InitiativeOverlay(content, canvas.store, collection, (token) => player.controls(token));
  const showRoll = installPageDice(content, canvas.store);
  const roll = (formula: string, tokenId: string | undefined): void =>
    void post('/command', { type: 'roll', formula, ...(tokenId && { id: tokenId }) });
  const diceLog = new PageDiceLog();
  // The player rolls their own rolls again, for the same token while it is still theirs
  installPageDiceLog(content, diceLog, (result) => {
    const profileId = choice.profileId();
    if (!profileId || result.roller?.profileId !== profileId) return null;
    const token = result.source?.tokenId ? canvas.store.getState().objects.tokens[result.source.tokenId] : undefined;
    return () => roll(result.formula, token && player.controls(token) ? token.id : undefined);
  });

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
    roll,
    diceLog,
    setDiceLook: (look) => void post('/command', { type: 'diceLook', look }),
    setColor: (color) => void post('/command', { type: 'color', color }),
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
      pageDiceSettings.setDisplay(context.diceDisplay);
      canvas.setPlayerView(context.playerView);
    },
    scene: (scene) => void canvas.showScene(scene),
    changes: (changes) => canvas.applyChanges(changes),
    noScene: () => canvas.clearScene(),
    roll: showRoll,
    diceLog: (entries) => diceLog.setEntries(entries),
    // The page draws its own ruler as it drags
    rulers: (rulers) => {
      const own = currentPlayerId();
      canvas.store.getState().setSharedRulers(Object.fromEntries(Object.entries(rulers).filter(([key]) => key !== own)));
    },
    // The page draws its own laser as it points
    lasers: (pieces) => {
      const own = currentPlayerId();
      const others = Object.fromEntries(Object.entries(pieces).filter(([key]) => key !== own));
      if (Object.keys(others).length > 0) canvas.store.getState().setSharedLasers(others);
    },
  });
  addEventListener('resize', () => canvas.resize(window.innerWidth, window.innerHeight));
}

void start();
