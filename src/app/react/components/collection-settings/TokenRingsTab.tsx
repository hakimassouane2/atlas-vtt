/**
 * TokenRingsTab: the ring and colour each token role is framed with, and the collection's ring
 * images (put in its `token-rings` folder or imported here), with whether each takes a colour.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { Upload } from 'lucide-react';
import { Button } from '../../../packages/components/primitives/button';
import { DropdownSwatchGrid } from '../../../packages/components/primitives/DropdownSwatchGrid';
import { Select, type SelectOption } from '../../../packages/components/primitives/Select';
import { ToggleSwitch } from '../../../packages/components/primitives/Toggle';
import { TokenPortrait } from '../../../packages/components/shared/TokenPortrait';
import { TokenRingContext, type PortraitRingOf } from '../../../packages/components/shared/tokenRingContext';
import { importTokenRing } from '../../../tokenRings/importTokenRing';
import { ringColors } from '../../../tokenRings/ringColors';
import { ringTints } from '../../../tokenRings/tokenRingChoice';
import { ringDisplayName, tokenRingFolder } from '../../../tokenRings/tokenRingFiles';
import { TokenRingLibrary, type RingFile } from '../../../tokenRings/TokenRingLibrary';
import { RING_ROLE_KEYS, type RingRoleKey, type RoleRing, type TokenRingSettings } from '../../../tokenRings/tokenRingTypes';
import { useTokenRingRevision } from '../../../tokenRings/usePortraitRings';
import fighterArt from '../../../assets/starter-tokens/fighter.webp?inline';
import { t } from '../../../i18n';

const ATLAS_RING = '';
const WHITE = '#ffffff';

interface TokenRingsTabProps {
  app: App;
  collectionId: string;
  settings: TokenRingSettings;
  onChange: (settings: TokenRingSettings) => void;
}

const roleLabel = (key: RingRoleKey): string => t(key === 'none' ? 'ring.role.none' : `ring.role.${key}`);

function RoleRow({ roleKey, ring, styles, onChange }: {
  roleKey: RingRoleKey;
  ring: RoleRing | undefined;
  styles: SelectOption<string>[];
  onChange: (ring: RoleRing) => void;
}): React.JSX.Element {
  const labelId = useId();
  const style = ring?.style && styles.some((option) => option.value === ring.style) ? ring.style : ATLAS_RING;
  return (
    <div className="atlas-csm-condition">
      <div className="atlas-csm-condition-row">
        <TokenPortrait className="atlas-csm-ring-preview" src={fighterArt} alt="" ring={{ role: roleKey === 'none' ? undefined : roleKey }} />
        {/* The role's name stands over its ring, so a long name never runs under the select */}
        <div className="atlas-csm-field atlas-csm-ring-field">
          <span id={labelId} className="atlas-csm-label">{roleLabel(roleKey)}</span>
          <Select
            value={style}
            options={styles}
            labelledBy={labelId}
            onChange={(next) => onChange({ ...ring, style: next || undefined })}
          />
        </div>
      </div>
      <DropdownSwatchGrid
        label={t('ring.colour')}
        swatches={ringColors()}
        value={ring?.color ?? WHITE}
        // White is what an unset colour draws, so it stores nothing
        onChange={(color) => onChange({ ...ring, color: color === WHITE ? undefined : color })}
      />
    </div>
  );
}

function RingFileRow({ file, tints, onTintsChange }: { file: RingFile; tints: boolean; onTintsChange: (tints: boolean) => void }): React.JSX.Element {
  const labelId = useId();
  return (
    <div className="atlas-csm-condition-row atlas-csm-ring-file">
      <img className="atlas-csm-ring-file-image" src={file.url} alt="" draggable={false} />
      <span className="atlas-csm-ring-role">{ringDisplayName(file.style)}</span>
      <span id={labelId} className="atlas-csm-toggle-label">{t('ring.tints')}</span>
      <ToggleSwitch value={tints} onChange={() => onTintsChange(!tints)} labelledBy={labelId} />
    </div>
  );
}

export function TokenRingsTab({ app, collectionId, settings, onChange }: TokenRingsTabProps): React.ReactElement {
  // Ring files and their tints are read anew whenever the library changes
  useTokenRingRevision(app);
  const library = TokenRingLibrary.forApp(app);
  const files = library?.rings(collectionId) ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const styles: SelectOption<string>[] = [
    { value: ATLAS_RING, label: t('ring.style.atlas') },
    ...files.map((file) => ({ value: file.style, label: ringDisplayName(file.style) })),
  ];
  // The previews show the rings as they would be saved
  const previewRing = useMemo<PortraitRingOf>(
    () => (subject) => library?.portraitRing(collectionId, subject, settings) ?? {},
    [library, collectionId, settings],
  );

  const setRole = (key: RingRoleKey, ring: RoleRing): void =>
    onChange({ ...settings, roles: { ...settings.roles, [key]: ring } });
  const setTint = (style: string, tints: boolean): void =>
    onChange({ ...settings, tint: { ...settings.tint, [style]: tints } });

  const importFiles = async (picked: readonly File[]): Promise<void> => {
    setImporting(true);
    try {
      for (const file of picked) {
        const result = await importTokenRing(app, collectionId, file);
        if ('style' in result) new Notice(t('ring.imported', { name: ringDisplayName(result.style) }));
        else new Notice(t(result.problem === 'not-square' ? 'ring.importNotSquare' : 'ring.importFailed', { name: file.name }));
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <TokenRingContext.Provider value={previewRing}>
      <p className="atlas-csm-hint">{t('ring.hint')}</p>

      <span className="atlas-csm-label">{t('ring.roles')}</span>
      <div className="atlas-csm-condition-list">
        {RING_ROLE_KEYS.map((key) => (
          <RoleRow key={key} roleKey={key} ring={settings.roles?.[key]} styles={styles} onChange={(ring) => setRole(key, ring)} />
        ))}
      </div>

      <span className="atlas-csm-label">{t('ring.files')}</span>
      <p className="atlas-csm-hint">{t('ring.filesHint', { folder: tokenRingFolder(collectionId) })}</p>
      {files.length > 0 ? (
        <div className="atlas-csm-condition-list">
          {files.map((file) => (
            <RingFileRow
              key={file.path}
              file={file}
              tints={ringTints(file.style, library?.detectedTint(file.path), settings)}
              onTintsChange={(tints) => setTint(file.style, tints)}
            />
          ))}
        </div>
      ) : (
        <div className="atlas-csm-empty">{t('ring.noFiles')}</div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        multiple
        hidden
        onChange={(event) => {
          const picked = [...(event.target.files ?? [])];
          event.target.value = '';
          if (picked.length > 0) void importFiles(picked);
        }}
      />
      <Button variant="ghost" className="atlas-csm-add-btn" disabled={importing} onClick={() => input.current?.click()}>
        <Upload />
        {t('ring.import')}
      </Button>
    </TokenRingContext.Provider>
  );
}
