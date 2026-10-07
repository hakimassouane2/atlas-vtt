import React, { createElement, useCallback, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import type { DiceRollResult } from '../../tools/DiceTool';
import { DiceRollLogPanel } from '../../react/components/dice-log/DiceRollLogPanel';
import { DiceEnvironmentContext } from '../../react/components/dice/diceEnvironment';
import { PAGE_DICE } from './pageDice';

/** Longer than a press and its click, shorter than any second press. */
const REOPEN_GUARD_MS = 300;

interface PageDiceLogState {
  /** The table's log as the DM's Atlas sent it, newest first. */
  entries: readonly DiceRollResult[];
  open: boolean;
}

/** The dice log on a player's page: the table's, sent by the DM's Atlas, opened from the toolbar or with Enter. */
export class PageDiceLog {
  private state: PageDiceLogState = { entries: [], open: false };
  private readonly listeners = new Set<() => void>();
  /** When the panel last closed: a press outside it closes it before the toolbar button's click toggles. */
  private closedAt = 0;

  setEntries(entries: readonly DiceRollResult[]): void {
    this.update({ ...this.state, entries });
  }

  setOpen(open: boolean): void {
    if (open === this.state.open) return;
    if (!open) this.closedAt = performance.now();
    this.update({ ...this.state, open });
  }

  /** Opens or closes the panel; the press on the button that just closed it does not open it again. */
  toggle = (): void => {
    if (!this.state.open && performance.now() - this.closedAt < REOPEN_GUARD_MS) return;
    this.setOpen(!this.state.open);
  };

  getState = (): PageDiceLogState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(next: PageDiceLogState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
}

interface PageDiceLogPanelProps {
  log: PageDiceLog;
  /** How to roll an entry again: only the player's own rolls; null for the others. */
  repeatOf: (result: DiceRollResult) => (() => void) | null;
}

function PageDiceLogPanel({ log, repeatOf }: PageDiceLogPanelProps): React.ReactElement | null {
  const { entries, open } = useSyncExternalStore(log.subscribe, log.getState);
  const close = useCallback(() => log.setOpen(false), [log]);
  return (
    <DiceEnvironmentContext.Provider value={PAGE_DICE}>
      <DiceRollLogPanel isOpen={open} onClose={close} history={entries} repeatOf={repeatOf} />
    </DiceEnvironmentContext.Provider>
  );
}

/** Whether a key press is meant for a field the player types in. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Mounts the log's panel in `parent`; Enter opens and closes it, as on the DM's map. */
export function installPageDiceLog(parent: HTMLElement, log: PageDiceLog, repeatOf: PageDiceLogPanelProps['repeatOf']): void {
  createRoot(parent.createDiv()).render(createElement(PageDiceLogPanel, { log, repeatOf }));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isTyping(event)) return;
    event.preventDefault();
    log.toggle();
  });
}
