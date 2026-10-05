import { Notice } from 'obsidian';
import type { SettingsService } from '../services/SettingsService';
import type { AtlasSettingSection } from '../settings/settingSections';
import { OnlineSession } from './OnlineSession';

/** Where players reach the online session, and the key in their link. */
export function onlineSessionSettingsSection(settingsService: SettingsService): AtlasSettingSection {
  return {
    heading: 'Online session',
    rows: [
      {
        name: 'Public address',
        desc: "Your public IP address or domain, for players outside your home. Left empty, the link uses this computer's address on your local network.",
        aliases: ['online', 'ip', 'players', 'remote'],
        render: (setting) => {
          setting.addText((text) => {
            text
              .setPlaceholder('203.0.113.7')
              .setValue(settingsService.getOnlineSessionSettings().publicHost)
              .onChange((publicHost) => settingsService.setOnlineSessionSettings({ publicHost: publicHost.trim() }));
          });
        },
      },
      {
        name: 'Port',
        desc: 'Forward this TCP port on your router to this computer. Takes effect when the session starts.',
        aliases: ['online', 'port forward'],
        render: (setting) => {
          setting.addText((text) => {
            text
              .setValue(String(settingsService.getOnlineSessionSettings().port))
              .onChange((value) => {
                const port = Number(value);
                if (Number.isInteger(port) && port > 0 && port < 65536) settingsService.setOnlineSessionSettings({ port });
              });
          });
        },
      },
      {
        name: 'New player link',
        desc: 'Makes every link sent so far stop working.',
        aliases: ['online', 'secret', 'key'],
        render: (setting) => {
          setting.addButton((button) => {
            button.setButtonText('Reset link').onClick(() => {
              settingsService.setOnlineSessionSettings({ secret: '' });
              OnlineSession.getInstance()?.stop();
              new Notice('Player link reset. Start the online session again to copy the new one.');
            });
          });
        },
      },
    ],
  };
}
