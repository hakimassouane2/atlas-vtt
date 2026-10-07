import { describe, expect, it } from 'vitest';
import { guardNativeContextMenu } from '../../src/app/online/client/pageContextMenuGuard';

function rightClick(target: HTMLElement): boolean {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('guardNativeContextMenu', () => {
  it("keeps the browser's menu off the page, but not off text fields", () => {
    guardNativeContextMenu();
    const canvas = document.body.appendChild(document.createElement('canvas'));
    const input = document.body.appendChild(document.createElement('input'));
    expect(rightClick(canvas)).toBe(true);
    expect(rightClick(input)).toBe(false);
  });
});
