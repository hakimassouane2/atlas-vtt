import type { Message } from '../../types';

export const token = {
  'token.unknownCreature': 'Unknown Creature',
  'token.clickToName': 'Click to name',
  'token.size.medium': 'Medium (1×1)',
  'token.size.large': 'Large (2×2)',
  'token.size.huge': 'Huge (3×3)',
  'token.size.gargantuan': 'Gargantuan (4×4)',
  'token.kill': 'Kill',
  'token.show': 'Show',
  'token.hide': 'Hide',
  'token.saveEncounter': 'Save as Encounter',
  'token.addInitiative': 'Add to Initiative',
  'token.statblock': 'Statblock',
  'token.openStatblock': 'Open',
  'token.unlinkStatblock': 'Unlink',
  'token.linkFailed': 'Could not link the statblock',
  'token.ringColor': 'Ring Color',
  'token.appearance': 'Appearance',
  'token.reset': 'Reset (Full HP, Clear Status)',
} as const satisfies Record<string, Message>;
