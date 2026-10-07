import type { Message } from '../../types';

export const switcher = {
  'switcher.current': 'Current',
  'switcher.jump': 'Jump',
  'switcher.navigate': 'Navigate',
  'switcher.open': 'Open',
  'switcher.search': 'Search open maps',
} as const satisfies Record<string, Message>;
