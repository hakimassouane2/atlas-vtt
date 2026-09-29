import { byId } from './dom';

const fps = (): HTMLSelectElement => byId<HTMLSelectElement>('fps');
const quality = (): HTMLSelectElement => byId<HTMLSelectElement>('quality');

function readPreference(name: string, fallback: string): string {
  try {
    return window.localStorage.getItem(`atlas-${name}`) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePreference(name: string, value: string): void {
  try {
    window.localStorage.setItem(`atlas-${name}`, value);
  } catch {
    // Private windows may refuse storage; the choice then lasts until the page closes
  }
}

/** What the page asks the DM's Atlas for: its window size, frame rate and quality. */
export function streamParams(): Record<string, string> {
  const ratio = window.devicePixelRatio || 1;
  return {
    w: String(Math.round(innerWidth * ratio)),
    h: String(Math.round(innerHeight * ratio)),
    cw: String(innerWidth),
    fps: fps().value,
    q: quality().value,
  };
}

/** The frame rate and quality menu, remembered in the browser; a change reconnects. */
export function installStreamSettings(reconnect: () => void): void {
  const selects: Array<[string, HTMLSelectElement, string]> = [['fps', fps(), '30'], ['quality', quality(), 'high']];
  for (const [name, select, fallback] of selects) {
    select.value = readPreference(name, fallback);
    select.addEventListener('change', () => {
      writePreference(name, select.value);
      reconnect();
    });
  }
  byId('settings-button').addEventListener('click', () => byId('settings').classList.toggle('open'));
}
