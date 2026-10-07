import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Dices, Pin, PinOff, Trash2 } from 'lucide-react';
import { DiceRollEntry } from './DiceRollEntry';
import { LabelTooltip } from '../../../packages/components/primitives/tooltip';
import { CloseButton } from '../../../packages/components/primitives/CloseButton';
import type { DiceRollResult } from '../../../tools/DiceTool';
import { t } from '../../../i18n';

interface DiceRollLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Newest first. */
  history: readonly DiceRollResult[];
  /** Empties the log; no clear button without it. */
  onClear?: () => void;
  /** How to roll an entry again, or null where it may not be rolled again. */
  repeatOf: (result: DiceRollResult) => (() => void) | null;
}

/** The dice log as a panel on the left, for the DM's history (`DiceRollLog`) or the one a player's page is sent. */
export function DiceRollLogPanel({ isOpen, onClose, history, onClear, repeatOf }: DiceRollLogPanelProps): React.ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const [isPinned, setIsPinned] = useState(false);

  const handleClose = useCallback((): void => {
    setIsPinned(false);
    onClose();
  }, [onClose]);

  // Auto-scroll to top when new roll arrives (newest at top)
  useEffect(() => {
    if (history.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevLengthRef.current = history.length;
  }, [history.length]);

  // Close on click outside (disabled when pinned)
  useEffect(() => {
    if (!isOpen || isPinned) return;

    const handleClickOutside = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isPinned, onClose]);

  // Close on Escape (disabled when pinned)
  useEffect(() => {
    if (!isOpen || isPinned) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isPinned, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={panelRef} className="dice-roll-log">
      {/* Header */}
      <div className="dice-roll-log__header">
        <span className="dice-roll-log__title">{t('dice.log')}</span>
        <div className="dice-roll-log__actions">
          {onClear && history.length > 0 && (
            <LabelTooltip label={t('dice.clearHistory')}>
              <button
                className="btn btn--ghost btn--icon dice-roll-log__action-btn"
                onClick={onClear}
              >
                <Trash2 />
              </button>
            </LabelTooltip>
          )}
          <LabelTooltip label={isPinned ? t('dice.unpin') : t('dice.pin')}>
            <button
              className={`btn btn--ghost btn--icon dice-roll-log__action-btn ${isPinned ? 'dice-roll-log__action-btn--active' : ''}`}
              onClick={() => setIsPinned(prev => !prev)}
            >
              {isPinned ? <PinOff /> : <Pin />}
            </button>
          </LabelTooltip>
          <CloseButton onClick={handleClose} title={t('dice.closeHint')} />
        </div>
      </div>

      {/* Scrollable list */}
      <div ref={listRef} className="dice-roll-log__list">
        {history.length === 0 ? (
          <div className="dice-roll-log__empty">
            <Dices className="dice-roll-log__empty-icon" />
            <span>{t('dice.noRolls')}</span>
          </div>
        ) : (
          history.map((result, index) => {
            const repeat = repeatOf(result);
            return (
              <DiceRollEntry
                key={result.id}
                result={result}
                isNew={index === 0 && history.length > prevLengthRef.current}
                {...(repeat && { onRepeat: repeat })}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
