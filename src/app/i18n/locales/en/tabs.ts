import type { Message } from '../../types';

export const tabs = {
  'tabs.allOpen': 'All open maps',
  'tabs.close': 'Close {name}',
  'tabs.openMaps': 'Open maps',
  'tabs.openScene': 'Open scene',
} as const satisfies Record<string, Message>;
