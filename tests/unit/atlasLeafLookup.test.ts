import { describe, expect, it } from 'vitest';
import { findAtlasLeafByViewId } from '../../src/app/utils/atlasLeafLookup';

function createLeaf(viewType: string, viewId?: string): any {
  return {
    view: {
      getViewType: () => viewType,
      viewId,
    },
  };
}

describe('findAtlasLeafByViewId', () => {
  it('returns the atlas leaf whose viewId matches the renderer source view', () => {
    const sourceLeaf = createLeaf('atlas-vtt', 'view-map-1');
    const otherLeaf = createLeaf('atlas-vtt', 'view-map-2');
    const workspace = {
      getLeavesOfType: (type: string) => (
        type === 'atlas-vtt'
          ? [otherLeaf, sourceLeaf]
          : []
      ),
    };

    expect(findAtlasLeafByViewId(workspace as any, 'view-map-1')).toBe(sourceLeaf);
  });


  it('returns null when no atlas leaf matches the view id', () => {
    const workspace = {
      getLeavesOfType: () => [],
    };

    expect(findAtlasLeafByViewId(workspace as any, 'missing-view')).toBeNull();
  });
});
