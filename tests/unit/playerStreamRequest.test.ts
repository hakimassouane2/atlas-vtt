import { describe, expect, test } from 'vitest';
import { parseCameraRequest, parseStreamRequest } from '../../src/app/online/playerStreamRequest';

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

describe('parseCameraRequest', () => {
  test('reads a camera and keeps its zoom within limits', () => {
    expect(parseCameraRequest({ centerX: 10, centerY: 20, scale: 1.5 })).toEqual({ centerX: 10, centerY: 20, scale: 1.5 });
    expect(parseCameraRequest({ centerX: 0, centerY: 0, scale: 1000 })).toEqual({ centerX: 0, centerY: 0, scale: 20 });
  });

  test('reads a request to go back to the DM framing', () => {
    expect(parseCameraRequest({ recenter: true })).toBe('recenter');
  });

  test('rejects anything else', () => {
    expect(parseCameraRequest(null)).toBeNull();
    expect(parseCameraRequest({ centerX: 0, centerY: 0, scale: 0 })).toBeNull();
    expect(parseCameraRequest({ centerX: 'left', centerY: 0, scale: 1 })).toBeNull();
  });
});
