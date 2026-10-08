import { describe, expect, it } from 'vitest';
import { readTokenRingSettings, ringChoiceOf, ringTints, savedTokenRingSettings } from '../../src/app/tokenRings/tokenRingChoice';
import { isTokenRingPath, ringDisplayName, tokenRingPath, tokenRingStyleOfPath } from '../../src/app/tokenRings/tokenRingFiles';
import { isGreyscale } from '../../src/app/tokenRings/ringTint';
import { isReservedCollectionPath } from '../../src/app/services/vault-sync/reservedPaths';
import { bundleFormatFor } from '../../src/app/services/collectionBundle/bundleFormat';
import { portraitRingStyle } from '../../src/app/packages/components/shared/tokenPortraitElement';
import { sharedRole } from '../../src/app/react/components/context-menu/tokenRoleMenu';
import type { TokenRingSettings } from '../../src/app/tokenRings/tokenRingTypes';

const settings: TokenRingSettings = {
  roles: { pc: { style: 'gold.webp', color: '#086ddd' }, npc: { color: '#e93147' }, none: { style: 'plain.webp' } },
};

describe('the ring a token is drawn with', () => {
  it('takes its role\'s ring and colour', () => {
    expect(ringChoiceOf({ role: 'pc' }, settings)).toEqual({ style: 'gold.webp', color: '#086ddd' });
    expect(ringChoiceOf({ role: 'npc' }, settings)).toEqual({ style: undefined, color: '#e93147' });
    expect(ringChoiceOf({}, settings)).toEqual({ style: 'plain.webp', color: undefined });
  });

  it('lets the token\'s own colour and its library token\'s ring win over its role\'s', () => {
    expect(ringChoiceOf({ role: 'pc', ringColor: '#ffffff', ringStyle: 'boss.webp' }, settings)).toEqual({ style: 'boss.webp', color: '#ffffff' });
  });

  it('draws Atlas\' ring in white where the collection says nothing', () => {
    expect(ringChoiceOf({ role: 'pc' }, {})).toEqual({ style: undefined, color: undefined });
    expect(ringChoiceOf({ role: 'villain' as never }, settings)).toEqual({ style: 'plain.webp', color: undefined });
  });

  it('tints a ring file as the GM set it, else as it was found, and Atlas\' ring always', () => {
    expect(ringTints(undefined, false, {})).toBe(true);
    expect(ringTints('gold.webp', false, {})).toBe(false);
    expect(ringTints('gold.webp', undefined, {})).toBe(true);
    expect(ringTints('gold.webp', false, { tint: { 'gold.webp': true } })).toBe(true);
  });
});

describe('a collection\'s ring settings', () => {
  it('reads only rings, colours and tints that are such', () => {
    expect(readTokenRingSettings({ tokenRings: {
      roles: { pc: { style: 'gold.webp', color: 'blue' }, npc: { style: 3 }, villain: { color: '#000000' } },
      tint: { 'gold.webp': false, 'other.webp': 'yes' },
    } as never })).toEqual({ roles: { pc: { style: 'gold.webp' } }, tint: { 'gold.webp': false } });
    expect(readTokenRingSettings({ tokenRings: 'nonsense' as never })).toEqual({});
    expect(readTokenRingSettings(null)).toEqual({});
  });

  it('stores nothing once they say nothing', () => {
    expect(savedTokenRingSettings({ roles: { pc: { style: undefined, color: undefined } } })).toBeUndefined();
    expect(savedTokenRingSettings({ roles: { npc: { color: '#e93147' } } })).toEqual({ roles: { npc: { color: '#e93147' } } });
  });
});

describe('ring files', () => {
  it('are the images right inside a collection\'s ring folder', () => {
    const path = tokenRingPath('goblins', 'gold.webp');
    expect(path).toBe('atlas-vtt/collections/goblins/token-rings/gold.webp');
    expect(tokenRingStyleOfPath(path)).toBe('gold.webp');
    expect(isTokenRingPath('atlas-vtt/collections/goblins/token-rings/nested/gold.webp')).toBe(false);
    expect(isTokenRingPath('atlas-vtt/collections/goblins/token-rings/notes.md')).toBe(false);
    expect(isTokenRingPath('atlas-vtt/collections/goblins/tokens/gold.webp')).toBe(false);
    expect(ringDisplayName('gold leaf.webp')).toBe('gold leaf');
  });

  it('are never assets', () => {
    expect(isReservedCollectionPath('atlas-vtt/collections/goblins/token-rings/gold.webp')).toBe(true);
  });

  it('make a bundle say the format that reads them', () => {
    expect(bundleFormatFor([{ vaultPath: 'a.webp', role: 'token-ring' }, { vaultPath: 'p.json', role: 'system-preset' }])).toBe(9);
    expect(bundleFormatFor([{ vaultPath: 'p.json', role: 'system-preset' }])).toBe(8);
    expect(bundleFormatFor([{ vaultPath: 't.webp', role: 'token-image' }])).toBe(6);
  });
});

describe('whether a ring takes a colour', () => {
  const pixels = (...rgba: number[][]): Uint8ClampedArray => new Uint8ClampedArray(rgba.flat());

  it('is so for a grey drawing and not for a coloured one', () => {
    expect(isGreyscale(pixels([255, 255, 255, 255], [120, 120, 124, 255], [0, 0, 0, 0]))).toBe(true);
    expect(isGreyscale(pixels([212, 175, 55, 255], [200, 160, 40, 255]))).toBe(false);
  });

  it('leaves out the faint edge pixels', () => {
    expect(isGreyscale(pixels([255, 255, 255, 255], [255, 0, 0, 10]))).toBe(true);
  });
});

describe('a portrait\'s ring', () => {
  it('sets the image and colour it is drawn with, and nothing when neither is set', () => {
    expect(portraitRingStyle('app://ring.webp', '#086ddd')).toEqual({
      '--atlas-token-ring-color': '#086ddd',
      '--atlas-token-ring-image': 'url("app://ring.webp")',
    });
    expect(portraitRingStyle(undefined, undefined)).toBeUndefined();
  });
});

describe('the role menu', () => {
  it('ticks the role every token has, and none where they differ', () => {
    expect(sharedRole([{ role: 'pc' }, { role: 'pc' }])).toBe('pc');
    expect(sharedRole([{ role: 'pc' }, {}])).toBeNull();
    expect(sharedRole([{}, {}])).toBeUndefined();
  });
});
