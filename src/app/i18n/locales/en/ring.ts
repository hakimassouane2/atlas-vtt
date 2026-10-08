import type { Message } from '../../types';

export const ring = {
  'ring.role': 'Role',
  'ring.role.none': 'No role',
  'ring.role.pc': 'Player character',
  'ring.role.npc': 'Non-player character',
  'ring.style': 'Ring',
  'ring.style.role': 'Ring of its role',
  'ring.style.atlas': 'Atlas ring',
  'ring.tab': 'Tokens',
  'ring.hint': 'Frame each kind of token with a ring and a colour. A token takes the ring of its role (set it in the asset manager, the token creator or the token\'s menu); a colour picked on the token itself wins over its role\'s.',
  'ring.roles': 'Rings by role',
  'ring.colour': 'Colour',
  'ring.colour.white': 'White',
  'ring.files': 'Ring images',
  'ring.filesHint': 'Square images over the token, its art showing through their transparent middle, like Atlas\' own ring (1024 × 1024 px, the hole 90 % as wide). Put them in {folder} or import them here. A grey ring takes the colour of its role; a coloured one shows as drawn.',
  'ring.noFiles': 'No ring images yet',
  'ring.import': 'Import ring',
  'ring.tints': 'Takes the role\'s colour',
  'ring.importNotSquare': '{name} is not square, so it cannot frame a token.',
  'ring.importFailed': 'The ring {name} could not be imported.',
  'ring.imported': 'Ring {name} imported.',
} as const satisfies Record<string, Message>;
