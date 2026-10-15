/**
 * SystemTab: the game system as a tab of its own, for the dialogs that keep it there (a
 * campaign's): the vault's systems (`GameSystemList`) and saving the rules as a new one. A
 * collection's settings choose it in the header instead (`GameSystemPicker`).
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../packages/components/primitives/button';
import { findActivePreset, sameSystemRules } from '../../../gameSystems/systemRules';
import type { SystemPresetService } from '../../../services/SystemPresetService';
import type { SystemPreset, SystemRules } from '../../../types/systemPresetTypes';
import { GameSystemList, type NoSystemChoice } from './GameSystemList';
import { PresetNameInput } from './PresetNameInput';
import { t } from '../../../i18n';

export type { NoSystemChoice } from './GameSystemList';

interface SystemTabProps {
  service: SystemPresetService;
  presets: readonly SystemPreset[];
  rules: SystemRules;
  presetId: string | undefined;
  onApplyPreset: (preset: SystemPreset) => void;
  onPresetIdChange: (presetId: string | undefined) => void;
  /** Deletes a user preset; the rules that use it lose their game system. */
  onDeletePreset: (preset: SystemPreset) => Promise<void>;
  /** A choice of no game system at all, first in the list, for rules that may have none. */
  none?: NoSystemChoice;
}

export function SystemTab({
  service, presets, rules, presetId, onApplyPreset, onPresetIdChange, onDeletePreset, none,
}: SystemTabProps): React.ReactElement {
  const [naming, setNaming] = useState(false);
  const hasNone = none?.isActive === true;
  const active = hasNone ? undefined : findActivePreset(presets, presetId, rules);
  const isEdited = active !== undefined && !sameSystemRules(active.rules, rules);

  const save = (name: string): void => {
    // A copy of a system keeps the widgets it adds, such as Shadowdark's torch timer.
    const widgets = active?.rules.widgets;
    onPresetIdChange(service.create(name, { ...rules, ...(widgets && { widgets }) }).id);
    setNaming(false);
  };

  return (
    <>
      <GameSystemList
        service={service}
        presets={presets}
        rules={rules}
        active={active}
        isEdited={isEdited}
        onApply={onApplyPreset}
        onDeletePreset={onDeletePreset}
        {...(none && { none })}
      />
      {hasNone ? null : naming ? (
        <PresetNameInput
          initialName=""
          confirmLabel={t('csm.system.savePreset')}
          validate={(name) => service.nameError(name)}
          onConfirm={save}
          onCancel={() => setNaming(false)}
        />
      ) : (
        <Button variant="ghost" className="atlas-csm-add-btn" onClick={() => setNaming(true)}>
          <Plus />
          {t('csm.system.saveAs')}
        </Button>
      )}
    </>
  );
}
