import { describe, expect, test } from 'vitest';
import { combineStreamRequests, parseStreamRequest } from '../../src/app/online/playerStreamRequest';

describe('parseStreamRequest', () => {
  test('reads the screen, frame rate and quality', () => {
    expect(parseStreamRequest(new URLSearchParams('w=1920&h=1080&cw=960&fps=15&q=medium'))).toEqual({
      screen: { width: 1920, height: 1080, cssWidth: 960 }, fps: 15, quality: 'medium',
    });
  });

  test('scales huge screens down and keeps their shape', () => {
    const { screen } = parseStreamRequest(new URLSearchParams('w=5120&h=2880&cw=2560'));
    expect(screen).toEqual({ width: 2560, height: 1440, cssWidth: 2560 });
  });

  test('falls back to defaults for missing or invalid values', () => {
    expect(parseStreamRequest(new URLSearchParams('fps=999&q=ultra'))).toEqual({
      screen: { width: 1280, height: 720, cssWidth: 1280 }, fps: 60, quality: 'high',
    });
  });
});

describe('combineStreamRequests', () => {
  test('serves the largest screen, the highest frame rate and quality', () => {
    const small = parseStreamRequest(new URLSearchParams('w=800&h=600&fps=60&q=low'));
    const large = parseStreamRequest(new URLSearchParams('w=1920&h=1080&fps=10&q=medium'));
    expect(combineStreamRequests([small, large])).toEqual({ screen: large.screen, fps: 60, quality: 'medium' });
  });

  test('is null when nobody is connected', () => {
    expect(combineStreamRequests([])).toBeNull();
  });
});
