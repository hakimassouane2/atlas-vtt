import React from 'react';
import { useStore } from 'zustand';
import { Minus, Plus } from 'lucide-react';
import type { ViewAtlasStore } from '../../storeFactory';
import type { ResourceDefinition } from '../../resources/resourceTypes';
import type { TokenEntity } from '../../types';
import { resourceUpdate, withCurrent } from '../../resources/resourceValues';
import { visibleResources } from '../../resources/visibleResources';
import { Button } from '../../packages/components/primitives/button';
import { LabelTooltip } from '../../packages/components/primitives/tooltip';

interface PartyPanelProps {
  store: ViewAtlasStore;
  /** The tokens the player controls. */
  controls: (token: TokenEntity) => boolean;
  resources: () => readonly ResourceDefinition[];
  /** Selects the token and brings it into view. */
  focus: (token: TokenEntity) => void;
}

/**
 * The tokens the player controls, with the resources they see of each: a glance at the party,
 * and − / + to spend or regain them. Edits go through the page's store, like those on the map.
 */
export function PartyPanel({ store, controls, resources, focus }: PartyPanelProps): React.ReactElement | null {
  const tokens = useStore(store, (state) => state.objects.tokens);
  const party = Object.values(tokens).filter(controls);
  if (party.length === 0) return null;

  return (
    <div className="atlas-player-party" role="region" aria-label="Party">
      {party.map((token) => {
        const name = (token.kind === 'character' && (token.name || token.statblockName)) || 'Token';
        const shown = visibleResources(token, resources(), 'player').filter(({ definition }) => definition.direction !== 'static');
        return (
          <div key={token.id} className="atlas-player-party__member">
            <button type="button" className="atlas-player-party__name" onClick={() => focus(token)}>{name}</button>
            {shown.map(({ definition, value }) => {
              const step = (delta: number): void => {
                const latest = store.getState().objects.tokens[token.id];
                if (!latest) return;
                store.getState().updateToken(token.id, resourceUpdate(latest, definition.key, withCurrent(value, value.current + delta), false));
              };
              return (
                <div key={definition.key} className="atlas-player-party__resource">
                  <span className="atlas-player-party__resource-name">{definition.name}</span>
                  <LabelTooltip label={`Lower ${definition.name}`}>
                    <Button variant="ghost" size="icon" disabled={value.current <= 0} onClick={() => step(-1)} aria-label={`Lower ${definition.name}`}>
                      <Minus aria-hidden="true" />
                    </Button>
                  </LabelTooltip>
                  <span className="atlas-player-party__value">{value.current}/{value.max}</span>
                  <LabelTooltip label={`Raise ${definition.name}`}>
                    <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label={`Raise ${definition.name}`}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </LabelTooltip>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
