import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '../Dialog';
import { Drawer, type DrawerPosition, type DrawerProps, type DrawerSize } from '../Drawer';
import { dialogContentClassNames, drawerClassNames } from '../../../lib/classNames';
import { hasOpenModal } from '../../../lib/layers';
import { drawerBackdropMotion, drawerDurations, drawerMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-DRW-O (spec §4.2, §3, D7, D9, D16, D19): the overlay Drawer's default motion on the panel
 * (`motion`: a slide from its edge and a fade, timed by its size) and on the backdrop
 * (`backdropMotion`), the presence pair of the panel, `appear`, and the backdrop appearance a
 * stacked drawer holds while it exits. jsdom loads no CSS, so the phases wait only where
 * `mockAnimations` gives the panel a running animation. The inline drawer's collapse is P10-DRW-I.
 */

const panel = () => document.querySelector<HTMLElement>('.' + drawerClassNames.root);
const backdrop = () => document.querySelector<HTMLElement>('.' + drawerClassNames.backdrop);
const button = (name: string) => screen.getByRole('button', { name });
/** The presence element of every overlay drawer (and Dialog): its `role="dialog"` panel. */
const isDialog = (el: Element) => el.getAttribute('role') === 'dialog';
/** The backdrop with class `className` in the portal of the surface `surface`. */
const backdropOf = (surface: HTMLElement, className: string = drawerClassNames.backdrop) =>
  surface.closest('[data-wave-portal]')?.querySelector<HTMLElement>('.' + className) ?? null;

const POSITIONS: readonly DrawerPosition[] = ['start', 'end', 'left', 'right', 'bottom'];
const SIZES: readonly DrawerSize[] = ['small', 'medium', 'large', 'full'];
/** The default panel motion: the default position (`end`) with the default size's duration. */
const PANEL_RECIPE = `${drawerMotion.end} ${drawerDurations.small}`;

/** No word of `recipe` on `el`, apart from the words in `except` (the consumer's own classes). */
function expectNoWordOf(el: Element | null, recipe: string, except: readonly string[] = []) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe).filter((word) => !except.includes(word))) {
    expect(el, word).not.toHaveClass(word);
  }
}

/** The scroll lock's inline styles on `<html>` and `<body>`. */
function scrollLockStyles() {
  const html = document.documentElement.style;
  const body = document.body.style;
  return [
    html.overflow,
    html.getPropertyValue('scrollbar-gutter'),
    body.overflow,
    body.paddingInlineEnd,
  ];
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** An uncontrolled overlay Drawer with a trigger, after a page button. */
function FiltersDrawer(props: Partial<DrawerProps>) {
  return (
    <>
      <button type="button">Page button</button>
      <Drawer title="Filters" {...props}>
        <Drawer.Trigger>
          <button type="button">Open filters</button>
        </Drawer.Trigger>
        <button type="button">Apply</button>
      </Drawer>
    </>
  );
}

describe('Drawer overlay motion per position and size (§3)', () => {
  const cases = POSITIONS.flatMap((position) => SIZES.map((size) => [position, size] as const));

  it.each(cases)(
    'at %s, %s: the edge’s slide with the size’s duration, the size’s backdrop fade, the same in RTL',
    (position, size) => {
      const ui = <FiltersDrawer defaultOpen position={position} size={size} />;
      const { unmount } = renderWithProviders(ui, { dir: 'ltr' });
      expect(panel()).toHaveClass(...motionClasses(drawerMotion[position]), drawerDurations[size]);
      for (const other of SIZES.filter((other) => other !== size)) {
        expect(panel()).not.toHaveClass(drawerDurations[other]);
      }
      expect(backdrop()).toHaveClass(...motionClasses(drawerBackdropMotion[size]));
      const ltr = [panel()!.className, backdrop()!.className];
      unmount();

      // The direction decides in CSS (the `wave-rtl:` variant): the class lists do not change.
      renderWithProviders(ui, { dir: 'rtl' });
      expect([panel()!.className, backdrop()!.className]).toEqual(ltr);
    },
  );
});

describe('Drawer motion slots (D5, D6)', () => {
  describe.each([
    ['motion', 'the panel', PANEL_RECIPE, panel],
    ['backdropMotion', 'the backdrop', drawerBackdropMotion.small, backdrop],
  ] as const)('%s on %s', (prop, _, recipe, element) => {
    const open = (slot?: MotionSlot | null): React.ReactElement => (
      <FiltersDrawer defaultOpen {...(slot === undefined ? {} : { [prop]: slot })} />
    );

    it('undefined: the default motion', () => {
      render(open());
      expect(element()).toHaveClass(...motionClasses(recipe));
    });

    it('null: no motion, and the element still renders its phase', () => {
      render(open(null));
      expectNoWordOf(element(), recipe);
      expect(element()).toHaveAttribute('data-presence', 'entered');
    });

    it.each([
      ['a string', 'my-motion'],
      ['a slot object', { className: 'my-motion' }],
    ] as const)('%s replaces the default motion', (__, slot) => {
      render(open(slot));
      expect(element()).toHaveClass('my-motion');
      expectNoWordOf(element(), recipe);
    });

    it('WaveProvider motion="none" turns the default off; the part’s own value still applies', () => {
      const { unmount } = renderWithProviders(open(), { motion: 'none' });
      expectNoWordOf(element(), recipe);
      expect(element()).toHaveAttribute('data-presence', 'entered');
      unmount();
      renderWithProviders(open('my-motion'), { motion: 'none' });
      expect(element()).toHaveClass('my-motion');
    });
  });

  it('keeps the motion props off the DOM', () => {
    render(<FiltersDrawer defaultOpen motion="my-motion" backdropMotion="my-fade" />);
    for (const element of [panel(), backdrop()]) {
      expect(element).not.toHaveAttribute('motion');
      expect(element).not.toHaveAttribute('backdropMotion');
      expect(element).not.toHaveAttribute('backdropmotion');
    }
  });

  it('a duration class in className wins over the recipe’s, which keeps its other classes (§2.3)', () => {
    render(<FiltersDrawer defaultOpen className="duration-wave-faster" />);
    expect(panel()).toHaveClass('duration-wave-faster', ...motionClasses(drawerMotion.end));
    expect(panel()).not.toHaveClass(drawerDurations.small);
  });

  describe('a className with presence variants keeps 0.14’s own motion (D19)', () => {
    const legacy = ['p-8', 'data-[presence=exiting]:opacity-0'];

    it('leaves the default motion out and keeps both consumer classes', () => {
      render(<FiltersDrawer defaultOpen className={legacy.join(' ')} />);
      expect(panel()).toHaveClass(...legacy);
      expectNoWordOf(panel(), PANEL_RECIPE, legacy);
      // The backdrop is not the className's element: it keeps its default.
      expect(backdrop()).toHaveClass(...motionClasses(drawerBackdropMotion.small));
    });

    it('applies an explicit motion next to that className', () => {
      render(<FiltersDrawer defaultOpen className={legacy.join(' ')} motion="my-motion" />);
      expect(panel()).toHaveClass('my-motion', ...legacy);
      expectNoWordOf(panel(), PANEL_RECIPE, legacy);
    });
  });

  describe('backdropMotion on a drawer without a backdrop (D93)', () => {
    const BACKDROP_IGNORED =
      '[WaveUI] Drawer: `backdrop` and `backdropMotion` are ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.';
    let warn: ReturnType<typeof vi.spyOn>;
    let error: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      error = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      warn.mockRestore();
      error.mockRestore();
    });

    it.each([
      ['a non-modal overlay', { modalType: 'non-modal' }, 'my-motion'],
      ['an inline drawer', { type: 'inline' }, 'my-motion'],
      ['a non-modal overlay, as null', { modalType: 'non-modal' }, null],
    ] as const)('is ignored on %s with the backdrop-ignored warning, once', (_, props, slot) => {
      render(
        <React.StrictMode>
          <FiltersDrawer defaultOpen backdropMotion={slot} {...props} />
        </React.StrictMode>,
      );
      expect(panel()).not.toBeNull();
      expect(backdrop()).toBeNull();
      expect(document.querySelector('.my-motion')).toBeNull();
      expect(warn.mock.calls).toEqual([[BACKDROP_IGNORED]]);
      expect(error).not.toHaveBeenCalled();
    });

    it('does not warn without backdropMotion on a non-modal drawer, nor with it on a modal one', () => {
      const { unmount } = render(<FiltersDrawer defaultOpen modalType="non-modal" />);
      unmount();
      render(<FiltersDrawer defaultOpen backdropMotion="my-motion" />);
      expect(backdrop()).toHaveClass('my-motion');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });
});

describe('Drawer overlay presence (D7, D9)', () => {
  it('exits after Escape: kept mounted and inert, with focus, layer, isolation and scroll lock released at once', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<FiltersDrawer />);
    await user.click(button('Open filters'));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toHaveAttribute('data-presence', 'entering');
    expect(backdrop()).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
    expect(hasOpenModal()).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(panel()).toBe(dialog);
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
      expect(element).toHaveAttribute('inert');
    }
    // Out of the accessibility tree: the panel is the presence element and inert itself. (Testing
    // Library's role queries do not read `inert`, so the exiting panel is still found without
    // `hidden: true`.)
    expect(dialog.closest('[inert]')).toBe(dialog);
    expect(screen.getByRole('dialog', { hidden: true })).toBe(dialog);
    expect(hasOpenModal()).toBe(false);
    expect(scrollLockStyles()).toEqual(['', '', '', '']);
    expect(button('Page button').closest('[inert]')).toBeNull();
    expect(button('Open filters')).toHaveFocus();
    expect(button('Open filters')).toHaveAttribute('aria-expanded', 'false');

    await finish(motion);
    expect(panel()).toBeNull();
    expect(backdrop()).toBeNull();
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isDialog });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<FiltersDrawer />);
    await user.click(button('Open filters'));
    expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveAttribute(
      'data-presence',
      'entered',
    );
    await user.keyboard('{Escape}');
    expect(panel()).toBeNull();
    expect(backdrop()).toBeNull();
    expect(button('Open filters')).toHaveFocus();
  });

  it('animates in a drawer open by default on a client render (appear)', async () => {
    const motion = mockAnimations({ animated: isDialog });
    render(<FiltersDrawer defaultOpen />);
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'entering');
      expect(element).not.toHaveAttribute('inert');
    }
    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
    expect(backdrop()).toHaveAttribute('data-presence', 'entered');
  });

  it('reopened during its exit: the same panel enters again with its layer, trap, isolation and focus', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<FiltersDrawer />);
    await user.click(button('Open filters'));
    await finish(motion);
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    await user.keyboard('{Escape}');
    expect(dialog).toHaveAttribute('data-presence', 'exiting');

    await user.click(button('Open filters'));
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBe(dialog);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog).toHaveAttribute('data-presence', 'entering');
    expect(dialog).not.toHaveAttribute('inert');
    expect(backdrop()).not.toHaveAttribute('inert');
    expect(hasOpenModal()).toBe(true);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(button('Page button').closest('[inert]')).not.toBeNull();
    expect(document.documentElement.style.overflow).toBe('hidden');

    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    await finish(motion);
    expect(panel()).toBeNull();
    expect(button('Open filters')).toHaveFocus();
  });

  it('kept mounted (unmountOnClose={false}): exits, then hides', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<FiltersDrawer unmountOnClose={false} />);
    await user.click(button('Open filters'));
    await finish(motion);
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    await user.keyboard('{Escape}');
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
      expect(element).toHaveAttribute('inert');
      expect(element).not.toHaveAttribute('hidden');
    }
    expect(button('Open filters')).toHaveFocus();

    await finish(motion);
    expect(panel()).toBe(dialog);
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'exited');
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
    }
  });

  it('calls onOpenChange once on an Escape close under StrictMode', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <FiltersDrawer onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.click(button('Open filters'));
    await finish(motion);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'escape' }),
    );
    await finish(motion);
    expect(panel()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});

describe('Drawer while it exits (D15)', () => {
  /** The details drawer, opened over a lower surface. */
  const detailsDrawer = (
    <Drawer title="Details">
      <Drawer.Trigger>
        <button type="button">Details</button>
      </Drawer.Trigger>
      <button type="button">Confirm details</button>
    </Drawer>
  );

  it.each([
    [
      'a Dialog',
      <Dialog key="dialog">
        <Dialog.Trigger>
          <button type="button">Open lower</button>
        </Dialog.Trigger>
        <Dialog.Content title="Lower">{detailsDrawer}</Dialog.Content>
      </Dialog>,
      dialogContentClassNames.backdrop,
    ],
    [
      'a Drawer',
      <Drawer key="drawer" title="Lower">
        <Drawer.Trigger>
          <button type="button">Open lower</button>
        </Drawer.Trigger>
        {detailsDrawer}
      </Drawer>,
      drawerClassNames.backdrop,
    ],
  ] as const)(
    'keeps a drawer’s backdrop transparent while it exits over %s',
    async (_, ui, lowerBackdropClass) => {
      const motion = mockAnimations({ animated: isDialog });
      const user = userEvent.setup();
      render(ui);
      await user.click(button('Open lower'));
      await finish(motion);
      await user.click(button('Details'));
      await finish(motion);
      const lower = screen.getByRole('dialog', { name: 'Lower' });
      const upper = screen.getByRole('dialog', { name: 'Details' });
      const upperBackdrop = backdropOf(upper);
      expect(upperBackdrop).toHaveAttribute('data-appearance', 'transparent');
      expect(backdropOf(lower, lowerBackdropClass)).toHaveAttribute('data-appearance', 'dimmed');

      await user.keyboard('{Escape}');
      expect(upper).toHaveAttribute('data-presence', 'exiting');
      expect(upperBackdrop).toHaveAttribute('data-presence', 'exiting');
      // The page stays dimmed once: the exiting backdrop does not turn dimmed over the lower one's.
      expect(upperBackdrop).toHaveAttribute('data-appearance', 'transparent');
      expect(backdropOf(lower, lowerBackdropClass)).toHaveAttribute('data-appearance', 'dimmed');
      expect(button('Details')).toHaveFocus();

      await finish(motion);
      expect(upper.isConnected).toBe(false);
      expect(screen.getByRole('dialog', { name: 'Lower' })).toBe(lower);
      await user.keyboard('{Escape}');
      await finish(motion);
      expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    },
  );
});
