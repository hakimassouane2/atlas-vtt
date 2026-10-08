import React from 'react';
import type { App } from 'obsidian';
import { ObsidianMenuDropdown } from '../../shared/ObsidianMenuDropdown';
import { TOKEN_ROLES } from '../../../../tokenRings/tokenRingTypes';
import { readRole } from '../../../../tokenRings/tokenRingChoice';
import { ringDisplayName } from '../../../../tokenRings/tokenRingFiles';
import { TokenRingLibrary } from '../../../../tokenRings/TokenRingLibrary';
import { useTokenRingRevision } from '../../../../tokenRings/usePortraitRings';
import type { TokenPreview, TokenPreviewPatch } from './types';
import { t } from '../../../../i18n';

const NO_CHOICE = '';

const ROLE_OPTIONS: Record<string, string> = { [NO_CHOICE]: t('ring.role.none') };
for (const role of TOKEN_ROLES) ROLE_OPTIONS[role] = t(`ring.role.${role}`);

/**
 * The role and ring of the previews `targets` picks (the selection, or the token being edited):
 * the role frames the token with its collection's ring for it, and a ring file of the collection
 * may be chosen over that.
 */
export function TokenRingChoices({ app, collection, targets, onChange }: {
  app: App | null;
  collection: string;
  targets: readonly TokenPreview[];
  onChange: (patch: TokenPreviewPatch) => void;
}): React.JSX.Element {
  // Ring files dropped into the collection's folder show at once
  useTokenRingRevision(app);
  const rings = TokenRingLibrary.forApp(app)?.rings(collection) ?? [];
  const first = targets[0];
  const ringOptions: Record<string, string> = { [NO_CHOICE]: t('ring.style.role') };
  for (const ring of rings) ringOptions[ring.style] = ringDisplayName(ring.style);
  const disabled = targets.length === 0;

  return (
    <section className="atlas-token-creator__section">
      <div className="atlas-token-creator__label-row"><span>{t('ring.role')}</span></div>
      <ObsidianMenuDropdown
        className="atlas-setting-dropdown"
        disabled={disabled}
        value={first?.role ?? NO_CHOICE}
        options={ROLE_OPTIONS}
        onChange={(value) => onChange({ role: readRole(value) })}
      />
      <div className="atlas-token-creator__label-row"><span>{t('ring.style')}</span></div>
      <ObsidianMenuDropdown
        className="atlas-setting-dropdown"
        disabled={disabled}
        value={first?.ringStyle && first.ringStyle in ringOptions ? first.ringStyle : NO_CHOICE}
        options={ringOptions}
        onChange={(value) => onChange({ ringStyle: value || undefined })}
      />
    </section>
  );
}
