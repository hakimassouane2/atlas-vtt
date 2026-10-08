/**
 * GameSystemList — The vault's game systems, in the header picker's panel:
 * choose one, reset an edited one, rename or delete your own.
 */

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../../packages/components/primitives/button';
import { ActionsMenuButton } from '../../../packages/components/shared/ActionsMenuButton';
import type { ContextMenuEntry } from '../context-menu/AtlasContextMenu';
import type { SystemPresetService } from '../../../services/SystemPresetService';
import type { SystemPreset, SystemRules } from '../../../types/systemPresetTypes';
import { runInBackground } from '../../../utils/backgroundTask';
import { PresetNameInput } from './PresetNameInput';
import { SystemPresetRow } from './SystemPresetRow';
import { t } from '../../../i18n';

interface GameSystemListProps {
  service: SystemPresetService;
  presets: readonly SystemPreset[];
  rules: SystemRules;
  /** The game system the collection follows, if any. */
  active: SystemPreset | undefined;
  /** The collection's rules differ from the active game system's. */
  isEdited: boolean;
  /** Applies a game system, also to reset the active one. */
  onApply: (preset: SystemPreset) => void;
  /** Deletes a user preset; the collections that use it, this one included, lose their game system. */
  onDeletePreset: (preset: SystemPreset) => Promise<void>;
}

type PendingEdit = { kind: 'rename' | 'delete'; presetId: string };

export function GameSystemList({
  service, presets, rules, active, isEdited, onApply, onDeletePreset,
}: GameSystemListProps): React.ReactElement {
  const [pending, setPending] = useState<PendingEdit | null>(null);

  const rename = (preset: SystemPreset, name: string): void => {
    service.rename(preset.id, name);
    setPending(null);
  };

  const remove = (preset: SystemPreset): void => {
    setPending(null);
    runInBackground(onDeletePreset(preset), `Delete game system preset "${preset.name}"`, t('csm.system.deleteFailed', { name: preset.name }));
  };

  const menuEntries = (preset: SystemPreset): ContextMenuEntry[] => [
    { type: 'item', label: t('common.rename'), icon: 'pencil', onClick: () => setPending({ kind: 'rename', presetId: preset.id }) },
    { type: 'item', label: t('common.delete'), icon: 'trash-2', destructive: true, onClick: () => setPending({ kind: 'delete', presetId: preset.id }) },
  ];

  const replacementFor = (preset: SystemPreset): React.ReactNode => {
    if (pending?.kind === 'rename' && pending.presetId === preset.id) {
      return (
        <PresetNameInput
          initialName={preset.name}
          confirmLabel={t('common.rename')}
          validate={(name) => service.nameError(name, preset.id)}
          onConfirm={(name) => rename(preset, name)}
          onCancel={() => setPending(null)}
        />
      );
    }
    if (pending?.kind === 'delete' && pending.presetId === preset.id) {
      return (
        <div className="atlas-csm-preset-confirm" role="alertdialog" aria-label={t('csm.system.deleteNamed', { name: preset.name })}>
          <span className="atlas-csm-preset-confirm__text">
            {t('csm.system.deleteConfirm', { name: preset.name })}
          </span>
          <div className="atlas-csm-preset-confirm__actions">
            <Button variant="outline" size="sm" onClick={() => setPending(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={() => remove(preset)}>{t('common.delete')}</Button>
          </div>
        </div>
      );
    }
    return undefined;
  };

  return (
    <>
      <p className="atlas-csm-hint">
        {t('csm.system.intro')}
      </p>

      {active && isEdited && (
        <Button variant="ghost" className="atlas-csm-system-reset" onClick={() => onApply(active)}>
          <RotateCcw />
          {t('csm.system.resetTo', { name: active.name })}
        </Button>
      )}

      <div className="atlas-csm-preset-list" role="radiogroup" aria-label={t('csm.system.group')}>
        {presets.map((preset) => (
          <SystemPresetRow
            key={preset.id}
            name={preset.name}
            rules={preset.rules}
            isActive={preset.id === active?.id}
            isEdited={preset.id === active?.id && isEdited}
            isBuiltIn={preset.builtIn}
            onSelect={() => onApply(preset)}
            actions={!preset.builtIn && (
              <ActionsMenuButton label={t('csm.system.actions')} entries={menuEntries(preset)} className="atlas-csm-preset-icon-btn" />
            )}
            replacement={replacementFor(preset)}
          />
        ))}
        {!active && <SystemPresetRow name={t('csm.system.custom')} rules={rules} isActive />}
      </div>
    </>
  );
}
