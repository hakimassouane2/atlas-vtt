import { App, Notice, type Plugin } from 'obsidian';
import type { LocalPlayerView } from '../local-player-view';
import { t } from '../i18n';
import { PlayerWindowService } from './PlayerWindowService';
import { followedScene, nextFollowedScene, onFollowedScene } from './followedScene';

/** Open the player window on the scene players follow: the one the DM has open. */
export async function presentActiveTabInPlayerWindow(app: App): Promise<void> {
  const scene = followedScene();
  if (!scene) {
    new Notice(t('present.noMap'));
    return;
  }
  const service =
    PlayerWindowService.getInstance() ??
    new PlayerWindowService(app, scene.view.atlasStore, scene.view.serviceManager.getSettingsService());
  if (!service.isWindowOpen()) await service.openPlayerWindow(scene.source);
}

/** Reconnect a restored workspace leaf without opening another popout, once a scene is open. */
export async function restorePlayerWindow(app: App, player: LocalPlayerView): Promise<void> {
  if (player.isClosed || PlayerWindowService.getInstance()?.ownsView(player)) return;
  const session = player.getState();
  const { view, source } = await nextFollowedScene();
  if (player.isClosed || PlayerWindowService.getInstance()?.ownsView(player)) return;
  const service = PlayerWindowService.getInstance() ?? new PlayerWindowService(
    app, view.atlasStore, view.serviceManager.getSettingsService(),
  );
  const viewport = view.serviceManager.getRendererService().getViewport();
  // A frozen camera is rendered on its own, so only a live presentation moves the DM viewport.
  if (session.camera && viewport && !session.frozen) {
    viewport.setZoom(session.camera.scale);
    viewport.moveCenter(session.camera.centerX, session.camera.centerY);
  }
  // Freeze before attaching so the first mirrored frame already uses the saved camera.
  if (session.frozen) service.freezeCamera(session.camera ?? source.getCamera?.());
  service.attachToView(player, source);
}

/** The open player window shows the scene players follow, and keeps its last frame while none is open. */
export function registerPlayerWindowFollow(plugin: Plugin): void {
  plugin.register(onFollowedScene((scene) => PlayerWindowService.getInstance()?.follow(scene?.source ?? null)));
}
