import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILT_IN_SYSTEM_PRESETS } from '../../src/app/gameSystems/builtInPresets';
import { rulesOfPreset } from '../../src/app/gameSystems/systemRules';
import { GameSystemPicker } from '../../src/app/react/components/collection-settings/GameSystemPicker';
import { SystemPresetService } from '../../src/app/services/SystemPresetService';
import type { SystemRules } from '../../src/app/types/systemPresetTypes';
import { memoryPresets } from '../mocks/memoryPresets';

const [daggerheart, dnd5e] = BUILT_IN_SYSTEM_PRESETS;

/** The picker with the collection draft the settings modal keeps around it. */
function Harness({ service, initial, initialPresetId }: { service: SystemPresetService; initial: SystemRules; initialPresetId?: string }): React.ReactElement {
  const [rules, setRules] = useState(initial);
  const [presetId, setPresetId] = useState<string | undefined>(initialPresetId);
  const [, setRevision] = useState(0);
  return (
    <>
      <GameSystemPicker
        service={service}
        presets={service.list()}
        rules={rules}
        presetId={presetId}
        onApplyPreset={(preset) => { setRules(rulesOfPreset(preset)); setPresetId(preset.id); }}
        onPresetIdChange={setPresetId}
        onDeletePreset={async (preset) => { service.delete(preset.id); }}
      />
      <button type="button" onClick={() => setRules({ ...rules, conditions: rules.conditions.slice(1) })}>Edit rules</button>
      <button type="button" onClick={() => setRevision((n) => n + 1)}>Refresh</button>
      <output data-testid="preset-id">{presetId ?? ''}</output>
    </>
  );
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: /^Game system/ });
const radio = (name: string): HTMLElement => screen.getByRole('radio', { name: new RegExp(`^${name}`) });

function saveAs(name: string): void {
  const input = screen.getByPlaceholderText('System name');
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

afterEach(cleanup);

describe('GameSystemPicker', () => {
  it('names custom rules, and applies a game system chosen in its panel', () => {
    const service = new SystemPresetService(memoryPresets());
    render(<Harness service={service} initial={{ gridDefaults: structuredClone(dnd5e!.rules.gridDefaults), conditions: [] }} />);

    expect(within(trigger()).getByText('Custom')).toBeTruthy();
    fireEvent.click(trigger());
    expect(radio('Custom').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio('Daggerheart'));

    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(within(trigger()).getByText('Daggerheart')).toBeTruthy();
    expect(screen.getByTestId('preset-id').textContent).toBe(daggerheart!.id);
  });

  it('closes its panel on Escape without letting the dialog see the key', () => {
    const service = new SystemPresetService(memoryPresets());
    render(<Harness service={service} initial={structuredClone(dnd5e!.rules)} initialPresetId={dnd5e!.id} />);
    let dialogSaw = false;
    const listener = (): void => { dialogSaw = true; };
    document.addEventListener('keydown', listener);

    fireEvent.click(trigger());
    fireEvent.keyDown(radio('D&D 5e'), { key: 'Escape' });

    document.removeEventListener('keydown', listener);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(dialogSaw).toBe(false);
  });

  it('marks an edited system and resets it from the panel', () => {
    const service = new SystemPresetService(memoryPresets());
    render(<Harness service={service} initial={structuredClone(dnd5e!.rules)} initialPresetId={dnd5e!.id} />);
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
    fireEvent.click(screen.getByText('Edit rules'));

    expect(within(trigger()).getByText('Edited')).toBeTruthy();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Reset to D&D 5e' }));
    expect(within(trigger()).queryByText('Edited')).toBeNull();
  });

  it('saves edited built-in rules as a new game system and selects it', () => {
    const service = new SystemPresetService(memoryPresets());
    render(<Harness service={service} initial={structuredClone(daggerheart!.rules)} initialPresetId={daggerheart!.id} />);
    fireEvent.click(screen.getByText('Edit rules'));

    fireEvent.click(screen.getByRole('button', { name: /Save as system/ }));
    saveAs('Daggerheart');
    expect(screen.getByRole('alert').textContent).toBe('A preset with this name already exists');
    saveAs('Homebrew');

    const saved = service.list().find((preset) => preset.name === 'Homebrew');
    expect(saved?.rules.conditions).toHaveLength(2);
    expect(screen.getByTestId('preset-id').textContent).toBe(saved?.id);
  });

  it('saves edited rules of your own game system back into it', () => {
    const service = new SystemPresetService(memoryPresets());
    const homebrew = service.create('Homebrew', structuredClone(daggerheart!.rules));
    render(<Harness service={service} initial={structuredClone(homebrew.rules)} initialPresetId={homebrew.id} />);
    fireEvent.click(screen.getByText('Edit rules'));

    fireEvent.click(screen.getByRole('button', { name: 'Save to Homebrew' }));
    fireEvent.click(screen.getByText('Refresh'));

    expect(service.list().find((preset) => preset.id === homebrew.id)?.rules.conditions).toHaveLength(2);
    expect(within(trigger()).queryByText('Edited')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
  });
});
