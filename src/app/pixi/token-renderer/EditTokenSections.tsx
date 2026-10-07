import React, { useId } from 'react';
import { ToggleSwitch } from '../../packages/components/primitives/Toggle';
import type { BarsAudience, ResourceDefinition, ResourceValue } from '../../resources/resourceTypes';
import { Select, type SelectOption } from '../../packages/components/primitives/Select';
import { NumberOverrideField } from './NumberOverrideField';
import type { PlayerProfile } from '../../types/collectionSettingsTypes';
import { PlayerDot } from '../../players/PlayerDot';
import { t } from '../../i18n';

interface EditTokenSectionProps {
  title: string;
  children: React.ReactNode;
}

/** A section of the Edit Token dialog: its heading, and its fields below it at one spacing. */
export function EditTokenSection({ title, children }: EditTokenSectionProps): React.ReactElement {
  const headingId = useId();
  return (
    <section className="atlas-edit-token__section" aria-labelledby={headingId}>
      <h4 id={headingId} className="atlas-edit-token__section-label">{title}</h4>
      {children}
    </section>
  );
}

interface SwitchRowProps {
  label: string;
  /** A line under the label that says what the switch does. */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Drawn before the label, e.g. a player's colour. */
  leading?: React.ReactNode;
}

/** A switch at the end of the row that names it. */
export function SwitchRow({ label, hint, value, onChange, leading }: SwitchRowProps): React.ReactElement {
  const labelId = useId();
  const hintId = useId();
  return (
    <div className="atlas-edit-token__switch-row">
      <div className="atlas-edit-token__field">
        <span className="atlas-edit-token__label-row">
          {leading}
          <span id={labelId} className="atlas-edit-token__label">{label}</span>
        </span>
        {hint && <span id={hintId} className="atlas-edit-token__hint">{hint}</span>}
      </div>
      <ToggleSwitch labelledBy={labelId} {...(hint && { 'aria-describedby': hintId })} value={value} onChange={() => onChange(!value)} />
    </div>
  );
}

interface TokenIdentitySectionProps {
  name: string;
  onNameChange: (name: string) => void;
  showNameplate: boolean;
  onShowNameplateChange: (show: boolean) => void;
  /** The name field, which takes the focus when the dialog opens. */
  nameRef: React.Ref<HTMLInputElement>;
  /** Whether the character's resources and conditions are the same on every map. */
  linked: boolean;
  onLinkedChange: (linked: boolean) => void;
}

export function TokenIdentitySection({ name, onNameChange, showNameplate, onShowNameplateChange, nameRef, linked, onLinkedChange }: TokenIdentitySectionProps): React.ReactElement {
  const nameId = useId();
  return (
    <EditTokenSection title="Token">
      <div className="atlas-edit-token__field">
        <label className="atlas-edit-token__label" htmlFor={nameId}>{t('editToken.name')}</label>
        <input
          id={nameId}
          ref={nameRef}
          type="text"
          className="atlas-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('editToken.namePlaceholder')}
        />
      </div>
      <SwitchRow label={t('editToken.showNameplate')} value={showNameplate} onChange={onShowNameplateChange} />
      <SwitchRow
        label="Linked character"
        hint="Same resources and conditions on every map, like a player character"
        value={linked}
        onChange={onLinkedChange}
      />
    </EditTokenSection>
  );
}

interface TokenPlayersSectionProps {
  /** The player profiles of the map's collection. */
  players: readonly PlayerProfile[];
  /** The profiles the token is given to. */
  controlledBy: readonly string[];
  onChange: (controlledBy: string[]) => void;
}

/** Which players move the token and change it from the online player page: one switch each. */
export function TokenPlayersSection({ players, controlledBy, onChange }: TokenPlayersSectionProps): React.ReactElement {
  return (
    <EditTokenSection title="Players">
      {players.map((player) => (
        <SwitchRow
          key={player.id}
          leading={<PlayerDot player={player} />}
          label={player.name || 'Unnamed player'}
          value={controlledBy.includes(player.id)}
          onChange={(controls) => onChange(controls
            ? [...controlledBy, player.id]
            : controlledBy.filter((id) => id !== player.id))}
        />
      ))}
    </EditTokenSection>
  );
}

/** What an empty field says: the maximum the linked statblock gives the resource, if any. */
function defaultPlaceholder(max: number | undefined): string {
  return max === undefined ? t('editToken.none') : t('editToken.statblockDefault', { value: max });
}

interface TokenResourcesSectionProps {
  /** The resources of the map's collection, in the order they show. */
  definitions: readonly ResourceDefinition[];
  /** What each field holds, as typed, by resource key. */
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** What the linked statblock gives each resource. */
  defaults: Record<string, ResourceValue>;
  /** Which players see the token's resources. */
  barsShownTo: BarsAudience;
  onBarsShownToChange: (audience: BarsAudience) => void;
}

const BARS_AUDIENCES: SelectOption<BarsAudience>[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'controllers', label: 'Its players only' },
  { value: 'nobody', label: 'Nobody' },
];

/** Who among the players sees the resources, then the maximum of each, two to a row; a static resource's field is its value. */
export function TokenResourcesSection({ definitions, values, onChange, defaults, barsShownTo, onBarsShownToChange }: TokenResourcesSectionProps): React.ReactElement {
  const audienceId = useId();
  return (
    <EditTokenSection title={t('editToken.resources')}>
      <div className="atlas-edit-token__switch-row">
        <span id={audienceId} className="atlas-edit-token__label">Players see its bars</span>
        <Select value={barsShownTo} options={BARS_AUDIENCES} labelledBy={audienceId} onChange={onBarsShownToChange} />
      </div>
      <div className="atlas-edit-token__fields">
        {definitions.map(({ key, name, direction }) => (
          <NumberOverrideField
            key={key}
            label={direction === 'static' ? name : `Max ${name}`}
            value={values[key] ?? ''}
            onChange={(value) => onChange(key, value)}
            placeholder={defaultPlaceholder(defaults[key]?.max)}
            resetLabel={t('editToken.resetStatblock')}
          />
        ))}
      </div>
    </EditTokenSection>
  );
}
