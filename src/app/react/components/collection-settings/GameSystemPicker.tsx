/**
 * GameSystemPicker — The collection's game system, chosen in the settings
 * dialog's header since it sets what the tabs hold, and the button that saves
 * the collection's edited rules as a game system.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Save } from 'lucide-react';
import { Button } from '../../../packages/components/primitives/button';
import { findActivePreset, sameSystemRules } from '../../../gameSystems/systemRules';
import type { SystemPresetService } from '../../../services/SystemPresetService';
import type { SystemPreset, SystemRules } from '../../../types/systemPresetTypes';
import { GameSystemList } from './GameSystemList';
import { PresetNameInput } from './PresetNameInput';
import { t } from '../../../i18n';

interface GameSystemPickerProps {
  service: SystemPresetService;
  presets: readonly SystemPreset[];
  rules: SystemRules;
  presetId: string | undefined;
  onApplyPreset: (preset: SystemPreset) => void;
  onPresetIdChange: (presetId: string | undefined) => void;
  /** Deletes a user preset; the collections that use it, this one included, lose their game system. */
  onDeletePreset: (preset: SystemPreset) => Promise<void>;
}

type OpenPanel = 'list' | 'name' | null;

/** Menus the panel opens elsewhere in the dialog (a preset's actions): a press there stays in the picker. */
const OWN_MENUS = '.atlas-ctx-menu';

export function GameSystemPicker({
  service, presets, rules, presetId, onApplyPreset, onPresetIdChange, onDeletePreset,
}: GameSystemPickerProps): React.ReactElement {
  const [open, setOpen] = useState<OpenPanel>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const valueId = useId();

  const active = findActivePreset(presets, presetId, rules);
  const isEdited = active !== undefined && !sameSystemRules(active.rules, rules);
  // Edited rules of your own game system go back into it; any other rules become a new one.
  const saveTarget = active && !active.builtIn && isEdited ? active : undefined;
  const canSaveAs = active === undefined || (active.builtIn && isEdited);

  useEffect(() => {
    if (!open) return undefined;
    const doc = rootRef.current?.ownerDocument ?? document;
    const handlePress = (event: MouseEvent): void => {
      const target = event.target as Element | null;
      if (!target || rootRef.current?.contains(target) || target.closest(OWN_MENUS)) return;
      setOpen(null);
    };
    doc.addEventListener('mousedown', handlePress);
    return () => doc.removeEventListener('mousedown', handlePress);
  }, [open]);

  useEffect(() => {
    if (open !== 'list') return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]:enabled') ?? panel?.querySelector<HTMLElement>('[role="radio"]:enabled'))?.focus();
  }, [open]);

  const close = (): void => {
    setOpen(null);
    triggerRef.current?.focus();
  };

  // The dialog closes on Escape too, so the picker takes it first while a panel is open.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'Escape' || !open) return;
    if ((event.target as Element | null)?.closest?.(OWN_MENUS)) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  const apply = (preset: SystemPreset): void => {
    onApplyPreset(preset);
    close();
  };

  const saveAs = (name: string): void => {
    // A copy of a system keeps the widgets it adds, such as Shadowdark's torch timer.
    const widgets = active?.rules.widgets;
    onPresetIdChange(service.create(name, { ...rules, ...(widgets && { widgets }) }).id);
    setOpen(null);
  };

  return (
    <div ref={rootRef} className="atlas-csm-system-picker" onKeyDown={handleKeyDown}>
      {saveTarget && (
        <Button variant="outline" className="atlas-csm-system-save" onClick={() => service.update(saveTarget.id, rules)}>
          <Save />
          {t('csm.system.saveTo', { name: saveTarget.name })}
        </Button>
      )}
      {canSaveAs && (
        <Button
          variant="outline"
          className="atlas-csm-system-save"
          aria-expanded={open === 'name'}
          onClick={() => setOpen(open === 'name' ? null : 'name')}
        >
          <Save />
          {t('csm.system.saveAs')}
        </Button>
      )}

      <span id={labelId} hidden>{t('csm.system.group')}</span>
      <Button
        ref={triggerRef}
        variant="outline"
        className="atlas-csm-system-trigger"
        aria-haspopup="dialog"
        aria-expanded={open === 'list'}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => setOpen(open === 'list' ? null : 'list')}
      >
        <span id={valueId} className="atlas-csm-system-trigger__value">
          <span className="atlas-csm-system-trigger__name">{active?.name ?? t('csm.system.custom')}</span>
          {isEdited && <span className="atlas-csm-tag atlas-csm-tag--accent">{t('csm.system.edited')}</span>}
        </span>
        <ChevronDown />
      </Button>

      {open === 'list' && (
        <div ref={panelRef} className="atlas-csm-system-panel" role="dialog" aria-labelledby={labelId}>
          <GameSystemList
            service={service}
            presets={presets}
            rules={rules}
            active={active}
            isEdited={isEdited}
            onApply={apply}
            onDeletePreset={onDeletePreset}
          />
        </div>
      )}
      {open === 'name' && (
        <div className="atlas-csm-system-panel atlas-csm-system-panel--name" role="dialog" aria-label={t('csm.system.saveAs')}>
          <PresetNameInput
            initialName=""
            confirmLabel={t('csm.system.savePreset')}
            validate={(name) => service.nameError(name)}
            onConfirm={saveAs}
            onCancel={() => setOpen(null)}
          />
        </div>
      )}
    </div>
  );
}
