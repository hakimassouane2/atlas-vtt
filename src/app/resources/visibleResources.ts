import { holdsValue } from './resourceValues';
import { slottedResources } from './resourceSlots';
import { BAR_SLOTS, type BarsAudience, type ResourceDefinition, type ResourceHolder, type ResourceShape, type ResourceViewer, type VisibleResource } from './resourceTypes';

/** The shape a resource takes on a token: its slot decides, never the resource. */
export function shapeOf(slot: number): ResourceShape {
  return slot < BAR_SLOTS ? 'bar' : 'wheel';
}

/** Whether `viewer` sees any resource of a token whose players are `audience`. */
export function seesResourcesOf(audience: BarsAudience | undefined, viewer: ResourceViewer): boolean {
  // The GM, and the player who plays the token as their character, see all of its own values.
  if (viewer === 'dm' || viewer === 'owner' || !audience || audience === 'everyone') return true;
  return audience === 'controllers' && viewer === 'controller';
}

/**
 * The resources a viewer sees on a token, in socket order. The only place that filters them:
 * players see the resources the collection shows them, on the tokens that show them to them.
 */
export function visibleResources(
  token: ResourceHolder,
  definitions: readonly ResourceDefinition[],
  viewer: ResourceViewer,
): VisibleResource[] {
  const shown: VisibleResource[] = [];
  if (!seesResourcesOf(token.barsShownTo, viewer)) return shown;
  for (const { definition, slot } of slottedResources(definitions)) {
    if ((viewer === 'player' || viewer === 'controller') && !definition.visibleToPlayers) continue;
    const value = token.resources?.[definition.key];
    if (!value || !holdsValue(definition, value)) continue;
    shown.push({ definition, value, slot });
  }
  return shown;
}
