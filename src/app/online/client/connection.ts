import type { DiceRollResult } from '../../tools/DiceTool';
import type { PlayerState } from '../protocol';
import { showRoll } from './atlasOverlays';
import { playerCamera } from './camera';
import { setStatus } from './dom';
import { receiveFrame } from './frames';
import { applyPlayerState } from './playerState';
import { sessionUrl, setPlayerId } from './session';
import { streamParams } from './streamSettings';

let events: EventSource | null = null;

/** Opens (or reopens, e.g. after a resize) the event stream from the DM's Atlas. */
export function connect(): void {
  events?.close();
  const stream = new EventSource(sessionUrl('/events', streamParams()));
  events = stream;
  stream.addEventListener('hello', (event) => {
    setPlayerId((JSON.parse(event.data as string) as { id: string }).id);
    // A new connection starts on the DM's camera: carry the player's own over
    playerCamera.sendNow();
  });
  stream.addEventListener('frame', (event) => receiveFrame(event.data as string));
  stream.addEventListener('state', (event) => applyPlayerState(JSON.parse(event.data as string) as PlayerState));
  stream.addEventListener('mode', (event) => {
    const { isFollowingDm } = JSON.parse(event.data as string) as { isFollowingDm: boolean };
    document.body.classList.toggle('online-following', isFollowingDm);
    playerCamera.setFollowingDm(isFollowingDm);
  });
  stream.addEventListener('recenter', () => playerCamera.forget());
  stream.addEventListener('roll', (event) => showRoll(JSON.parse(event.data as string) as DiceRollResult));
  stream.onopen = (): void => {
    setStatus(document.body.classList.contains('online-live') ? '' : 'En attente de la scène du MJ...');
  };
  stream.onerror = (): void => setStatus('Connexion perdue, nouvelle tentative...');
}
