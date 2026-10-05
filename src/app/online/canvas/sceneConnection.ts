import type { PlayerCanvasContext, PlayerSceneMessage } from '../scene/sceneProtocol';
import type { ReplicatedScene, SceneChange } from '../scene/sceneReplica';
import { setStatus } from '../client/dom';
import { sessionUrl } from '../client/session';

/** What the canvas page does with the messages of the DM's Atlas. */
export interface SceneListener {
  context(context: PlayerCanvasContext): void;
  scene(scene: ReplicatedScene): void;
  changes(changes: SceneChange[]): void;
}

/** Opens the event stream of the presented scene; the browser reopens it after a lost connection. */
export function connectToScene(listener: SceneListener): EventSource {
  const stream = new EventSource(sessionUrl('/scene-events'));
  const on = <M extends PlayerSceneMessage>(event: M['event'], handle: (data: M['data']) => void): void => {
    stream.addEventListener(event, (message) => handle(JSON.parse((message as MessageEvent<string>).data) as M['data']));
  };
  on<Extract<PlayerSceneMessage, { event: 'context' }>>('context', (data) => listener.context(data));
  on<Extract<PlayerSceneMessage, { event: 'scene' }>>('scene', (data) => {
    document.body.classList.add('online-live');
    setStatus('');
    listener.scene(data);
  });
  on<Extract<PlayerSceneMessage, { event: 'changes' }>>('changes', (data) => listener.changes(data));
  stream.onopen = (): void => {
    setStatus(document.body.classList.contains('online-live') ? '' : 'En attente de la scène du MJ...');
  };
  stream.onerror = (): void => setStatus('Connexion perdue, nouvelle tentative...');
  return stream;
}
