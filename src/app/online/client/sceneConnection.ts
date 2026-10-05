import type { PlayerCanvasContext, PlayerSceneMessage } from '../scene/sceneProtocol';
import type { ReplicatedScene, SceneChange } from '../scene/sceneReplica';
import type { PlayerCameraState } from '../../local-player-view';
import type { DiceRollResult } from '../../tools/DiceTool';
import { setStatus } from './dom';
import { sessionUrl, setPlayerId } from './session';

/** What the canvas page does with the messages of the DM's Atlas. */
export interface SceneListener {
  context(context: PlayerCanvasContext): void;
  scene(scene: ReplicatedScene): void;
  changes(changes: SceneChange[]): void;
  /** Where the DM looks. */
  camera(camera: PlayerCameraState): void;
  /** The DM presented another scene: players start from the DM's framing. */
  recenter(): void;
  /** A roll players may see. */
  roll(result: DiceRollResult): void;
}

/** Opens the event stream of the presented scene; the browser reopens it after a lost connection. */
export function connectToScene(listener: SceneListener): EventSource {
  const stream = new EventSource(sessionUrl('/events'));
  const on = <M extends PlayerSceneMessage>(event: M['event'], handle: (data: M['data']) => void): void => {
    stream.addEventListener(event, (message) => handle(JSON.parse((message as MessageEvent<string>).data) as M['data']));
  };
  // The DM's Atlas names the page's connection; commands carry the name (`post`)
  stream.addEventListener('hello', (message) => setPlayerId((JSON.parse((message as MessageEvent<string>).data) as { id: string }).id));
  on<Extract<PlayerSceneMessage, { event: 'context' }>>('context', (data) => listener.context(data));
  on<Extract<PlayerSceneMessage, { event: 'scene' }>>('scene', (data) => {
    document.body.classList.add('online-live');
    setStatus('');
    listener.scene(data);
  });
  on<Extract<PlayerSceneMessage, { event: 'changes' }>>('changes', (data) => listener.changes(data));
  const json = <T>(message: Event): T => JSON.parse((message as MessageEvent<string>).data) as T;
  stream.addEventListener('camera', (message) => listener.camera(json<PlayerCameraState>(message)));
  stream.addEventListener('recenter', () => listener.recenter());
  stream.addEventListener('roll', (message) => listener.roll(json<DiceRollResult>(message)));
  stream.onopen = (): void => {
    setStatus(document.body.classList.contains('online-live') ? '' : "Waiting for the GM's scene…");
  };
  stream.onerror = (): void => setStatus('Connection lost, trying again…');
  return stream;
}
