import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiceTray } from '../../src/app/react/components/dice/DiceTray';

afterEach(cleanup);

const formula = (): string => screen.getByRole('status').textContent ?? '';
const d6 = (): HTMLElement => screen.getAllByRole('button')[1]!;

describe('DiceTray', () => {
  it('adds a die on a click and takes one back on a right-click or Backspace', () => {
    render(<DiceTray onRoll={vi.fn()} />);
    fireEvent.click(d6());
    fireEvent.click(d6());
    expect(formula()).toBe('2d6');
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => { d6().dispatchEvent(menu); });
    expect(menu.defaultPrevented).toBe(true);
    expect(formula()).toBe('1d6');
    fireEvent.keyDown(d6(), { key: 'Backspace' });
    expect(formula()).toBe('The tray is empty.');
  });

  it('still takes a die back once a kind is full', () => {
    render(<DiceTray onRoll={vi.fn()} />);
    for (let i = 0; i < 21; i++) fireEvent.click(d6());
    expect(formula()).toBe('20d6');
    expect(d6().getAttribute('aria-disabled')).toBe('true');
    fireEvent.contextMenu(d6());
    expect(formula()).toBe('19d6');
  });
});
