import * as React from 'react';
import type { CoreSize, InputAppearance } from '../src';

const SIZES: readonly CoreSize[] = ['small', 'medium', 'large'];
const APPEARANCES: readonly InputAppearance[] = [
  'outline',
  'underline',
  'filled-darker',
  'filled-lighter',
];

/**
 * A size × appearance grid for the "Sizes and appearances" stories: one row per appearance, one
 * cell per size. The `filled-lighter` row sits on a surface other than the page background, as
 * the docs recommend.
 */
export function SizeAppearanceGrid({
  render,
}: {
  render: (size: CoreSize, appearance: InputAppearance) => React.ReactNode;
}) {
  return (
    <div className="grid gap-4">
      {APPEARANCES.map((appearance) => (
        <div
          key={appearance}
          className={
            appearance === 'filled-lighter'
              ? 'grid grid-cols-3 items-start gap-3 rounded bg-secondary p-3'
              : 'grid grid-cols-3 items-start gap-3 p-3'
          }
        >
          {SIZES.map((size) => (
            <React.Fragment key={size}>{render(size, appearance)}</React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
