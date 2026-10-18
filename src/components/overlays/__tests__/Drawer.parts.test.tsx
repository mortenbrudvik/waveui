import { afterEach, describe, it, expect } from 'vitest';
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { Drawer, type DrawerPosition, type DrawerProps, type DrawerSize } from '../Drawer';
import { drawerClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
});

/** The sizes with their width (side positions) and height (`bottom`) classes. */
const SIZES = [
  ['small', 'w-80', 'h-80'],
  ['medium', 'w-148', 'h-148'],
  ['large', 'w-235', 'h-235'],
  ['full', 'w-full', 'h-full'],
] as const satisfies ReadonlyArray<readonly [DrawerSize, string, string]>;

const SIDES = ['start', 'end', 'left', 'right'] as const satisfies readonly DrawerPosition[];

const WIDTHS = SIZES.map(([, width]) => width);
const HEIGHTS = SIZES.map(([, , height]) => height);
const EDGES = ['border-s', 'border-e', 'border-l', 'border-r', 'border-t', 'border-b'];
const INSET_TOP = 'pt-[env(safe-area-inset-top)]';
const INSET_BOTTOM = 'pb-[env(safe-area-inset-bottom)]';

/** Opens a Drawer named "Filters" and returns its panel. */
function renderPanel(props: Partial<DrawerProps> = {}, options: { dir?: 'rtl' } = {}) {
  const ui = (
    <Drawer defaultOpen title="Filters" {...props}>
      Content
    </Drawer>
  );
  if (options.dir) renderWithProviders(ui, { dir: options.dir });
  else render(ui);
  return screen.getByRole('dialog', { name: 'Filters' });
}

/** Asserts each class on its own (a multi-class `not.toHaveClass` passes when one is missing). */
function expectNoneOf(element: HTMLElement, classes: readonly string[]) {
  for (const name of classes) expect(element).not.toHaveClass(name);
}

describe('Drawer size and position (P6-05 D78, D79)', () => {
  it.each(SIDES.flatMap((side) => SIZES.map(([size, width]) => [side, size, width] as const)))(
    'a %s panel of size %s is %s wide and spans the window height',
    (position, size, width) => {
      const panel = renderPanel({ position, size });
      expect(panel).toHaveClass(drawerClassNames.root, width, 'top-0', 'h-full', 'max-w-full');
      expect(panel).toHaveAttribute('data-size', size);
      expectNoneOf(
        panel,
        WIDTHS.filter((other) => other !== width),
      );
      expectNoneOf(panel, ['inset-x-0', 'bottom-0', 'max-h-full', 'h-80', 'h-148', 'h-235']);
    },
  );

  it('defaults to the small size', () => {
    const panel = renderPanel();
    expect(panel).toHaveClass('w-80');
    expect(panel).toHaveAttribute('data-size', 'small');
  });

  it.each(SIZES.map(([size, , height]) => [size, height] as const))(
    'a bottom panel of size %s runs along the bottom edge, the window wide and %s high',
    (size, height) => {
      const panel = renderPanel({ position: 'bottom', size });
      expect(panel).toHaveClass(
        height,
        'w-full',
        'inset-x-0',
        'bottom-0',
        'max-h-full',
        'border-t',
      );
      expect(panel).toHaveAttribute('data-position', 'bottom');
      expect(panel).toHaveAttribute('data-size', size);
      expectNoneOf(panel, ['top-0', 'max-w-full', 'end-0', 'start-0', 'w-80', 'w-148', 'w-235']);
      expectNoneOf(
        panel,
        HEIGHTS.filter((other) => other !== height),
      );
    },
  );

  it.each([
    [undefined, 'end'],
    ['end', 'end'],
    ['start', 'start'],
    ['left', 'left'],
    ['right', 'right'],
    ['bottom', 'bottom'],
  ] as const)('position %s renders data-position="%s"', (position, expected) => {
    const panel = renderPanel({ position });
    expect(panel).toHaveAttribute('data-position', expected);
  });

  it('lets a width class in className replace the size', () => {
    const panel = renderPanel({ size: 'medium', className: 'w-[480px]' });
    expect(panel).toHaveClass('w-[480px]', 'max-w-full');
    expect(panel).not.toHaveClass('w-148');
    expect(panel).toHaveAttribute('data-size', 'medium');
  });

  it('lets a height class in className replace the size of a bottom panel', () => {
    const panel = renderPanel({ position: 'bottom', size: 'large', className: 'h-[50vh]' });
    expect(panel).toHaveClass('h-[50vh]', 'max-h-full', 'w-full');
    expect(panel).not.toHaveClass('h-235');
  });

  it('keeps the logical classes of a side panel and the classes of a bottom one under RTL', () => {
    const start = renderPanel({ position: 'start', size: 'medium' }, { dir: 'rtl' });
    expect(start.closest('[data-wave-portal]')).toHaveAttribute('dir', 'rtl');
    expect(start).toHaveClass('start-0', 'border-e', 'w-148');
    expectNoneOf(start, ['left-0', 'right-0', 'border-l', 'border-r']);
    cleanup();

    const bottom = renderPanel({ position: 'bottom' }, { dir: 'rtl' });
    expect(bottom).toHaveClass('inset-x-0', 'bottom-0', 'w-full', 'h-80', 'border-t');
    expectNoneOf(bottom, ['left-0', 'right-0', 'start-0', 'end-0', 'border-s', 'border-e']);
  });
});

describe('Drawer forced colours, class level (P6-05 D79)', () => {
  it.each([
    ['start', 'border-e'],
    ['end', 'border-s'],
    ['left', 'border-r'],
    ['right', 'border-l'],
    ['bottom', 'border-t'],
  ] as const)('a %s panel draws its inner edge only, %s', (position, edge) => {
    const panel = renderPanel({ position });
    expect(panel).toHaveClass(edge, 'border-border');
    expectNoneOf(
      panel,
      EDGES.filter((other) => other !== edge),
    );
    expect(panel).not.toHaveClass('border');
  });
});

describe('Drawer safe-area insets (P6-05 D85)', () => {
  it.each(SIDES)('a %s panel pads the top and bottom insets of the screen', (position) => {
    const panel = renderPanel({ position });
    expect(panel).toHaveClass(INSET_TOP, INSET_BOTTOM);
  });

  it.each(['small', 'medium', 'large'] as const)(
    'a bottom panel of size %s pads only the bottom inset (it does not reach the top)',
    (size) => {
      const panel = renderPanel({ position: 'bottom', size });
      expect(panel).toHaveClass(INSET_BOTTOM);
      expect(panel).not.toHaveClass(INSET_TOP);
    },
  );

  it('a full bottom panel pads both insets', () => {
    const panel = renderPanel({ position: 'bottom', size: 'full' });
    expect(panel).toHaveClass(INSET_TOP, INSET_BOTTOM);
  });

  it('pads no side insets', () => {
    const panel = renderPanel({ size: 'full' });
    expect(panel.className).not.toMatch(/safe-area-inset-(left|right)/);
  });
});

describe('Drawer size and position: accessibility', () => {
  it.each([
    ['a bottom drawer', { position: 'bottom' }],
    ['a large drawer', { size: 'large' }],
    ['a full bottom drawer', { position: 'bottom', size: 'full' }],
  ] as const)('%s has no violations', async (_name, props) => {
    renderPanel(props);
    await expectNoA11yViolations(document.body);
  });
});
