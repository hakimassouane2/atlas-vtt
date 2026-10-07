import React, { useCallback, useMemo } from 'react';
import { useAtlasUI } from '../../root/AtlasUIContext';
import { useAtlasStore } from '../../ViewStoreContext';
import { useDiceHistory } from './useDiceHistory';
import { DiceRollLogPanel } from './DiceRollLogPanel';
import type { DiceRollResult, DiceTool } from '../../../tools/DiceTool';

interface DiceRollLogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The DM's dice log: every roll of the map, kept in its file. */
export function DiceRollLog({ isOpen, onClose }: DiceRollLogProps): React.ReactElement | null {
  const { view } = useAtlasUI();

  // Store bindings for persistence
  const diceLog = useAtlasStore(state => state.diceLog);
  const addDiceLogEntry = useAtlasStore(state => state.addDiceLogEntry);
  const clearDiceLog = useAtlasStore(state => state.clearDiceLog);

  const storeActions = useMemo(() => ({
    diceLog, addDiceLogEntry, clearDiceLog,
  }), [diceLog, addDiceLogEntry, clearDiceLog]);

  const getDiceTool = useCallback((): DiceTool | null => {
    try {
      return view?.serviceManager?.getToolController?.()?.getDiceTool?.() ?? null;
    } catch {
      return null;
    }
  }, [view]);

  const { history, clearHistory, repeatRoll } = useDiceHistory(getDiceTool, storeActions);
  const repeatOf = useCallback((result: DiceRollResult) => () => repeatRoll(result.formula, result.source), [repeatRoll]);

  return <DiceRollLogPanel isOpen={isOpen} onClose={onClose} history={history} onClear={clearHistory} repeatOf={repeatOf} />;
}
