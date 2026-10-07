import React, { useId } from 'react';
import type { TrayDie } from './diceTrayPool';

/**
 * Each body as a line drawing on a 24-unit grid, seen as the hand holds it: its outline and the
 * edges of the faces turned towards the eye. Drawn in `currentColor`, so the dice take the theme's
 * text colour like every other icon.
 */
const DIE_PATHS: Record<Exclude<TrayDie, 100>, string> = {
  // A tetrahedron from above: three faces meeting at its top
  4: 'M12 3 21 19.5H3Z M12 14 12 3 M12 14 21 19.5 M12 14 3 19.5',
  // A cube on a corner: three faces
  6: 'M12 2.5 20.5 7.25V16.75L12 21.5 3.5 16.75V7.25Z M3.5 7.25 12 12 20.5 7.25 M12 12V21.5',
  // An octahedron on a corner: four faces meeting in front
  8: 'M12 2.5 20.5 12 12 21.5 3.5 12Z M12 2.5 12 14.5 M3.5 12 12 14.5 20.5 12 M12 14.5V21.5',
  // A pentagonal trapezohedron: the kite in front between its two neighbours
  10: 'M12 2.5 21 10.5 12 21.5 3 10.5Z M12 2.5 7.5 12.5 12 15.5 16.5 12.5Z M7.5 12.5 3 10.5 M16.5 12.5 21 10.5 M12 15.5V21.5',
  // A dodecahedron: the pentagon in front, one edge out to every other corner of the outline
  12: 'M12 2.25 17.73 4.11 21.27 8.99 21.27 15.01 17.73 19.89 12 21.75 6.27 19.89 2.73 15.01 2.73 8.99 6.27 4.11Z '
    + 'M12 6.8 16.95 10.39 15.06 16.21 8.94 16.21 7.05 10.39Z '
    + 'M12 6.8V2.25 M16.95 10.39 21.27 8.99 M15.06 16.21 17.73 19.89 M8.94 16.21 6.27 19.89 M7.05 10.39 2.73 8.99',
  // An icosahedron: the triangle in front, each corner joined to the three corners of the outline beside it
  20: 'M12 2.25 20.44 7.13V16.88L12 21.75 3.56 16.88V7.13Z M12 7.5 16.8 15.5H7.2Z '
    + 'M12 7.5 12 2.25 M12 7.5 20.44 7.13 M12 7.5 3.56 7.13 '
    + 'M7.2 15.5 3.56 7.13 M7.2 15.5 3.56 16.88 M7.2 15.5 12 21.75 '
    + 'M16.8 15.5 20.44 7.13 M16.8 15.5 20.44 16.88 M16.8 15.5 12 21.75',
};

/** The d10's outline, which hides what of the tens die lies behind the units die. */
const D10_OUTLINE = 'M12 2.5 21 10.5 12 21.5 3 10.5Z';

/**
 * A die as the hand knows it. There is no d100 body: it is rolled with two d10,
 * tens and units, so the tray shows exactly that, the units die in front of the tens die.
 */
export function DieFace({ sides }: { sides: TrayDie }): React.ReactElement {
  // `useId` spells ids with characters a `url(#…)` reference does not take
  const maskId = `atlas-die-mask-${useId().replace(/[^\w-]/g, '')}`;
  if (sides === 100) {
    return (
      <svg viewBox="0 0 32 32" className="atlas-die-face atlas-die-face--percentile" aria-hidden="true">
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <path d={D10_OUTLINE} transform="translate(8 8)" fill="black" stroke="black" strokeWidth="3" />
        </mask>
        <path d={DIE_PATHS[10]} mask={`url(#${maskId})`} className="atlas-die-face__tens" />
        <path d={DIE_PATHS[10]} transform="translate(8 8)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="atlas-die-face" aria-hidden="true">
      <path d={DIE_PATHS[sides]} />
    </svg>
  );
}
