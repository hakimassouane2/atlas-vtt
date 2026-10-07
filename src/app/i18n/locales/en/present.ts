import type { Message } from '../../types';

export const present = {
  'present.noMap': 'Open a scene first: the player view shows the scene you have open',
} as const satisfies Record<string, Message>;
