import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from '../Nav';
import { NavDrawer, type NavDrawerProps } from '../NavDrawer';
import { Hamburger } from '../Hamburger';
import type { DrawerPosition, DrawerSize } from '../../overlays/Drawer';
import { drawerClassNames, navDrawerClassNames } from '../../../lib/classNames';
import { hasOpenModal } from '../../../lib/layers';
import {
  drawerBackdropMotion,
  drawerDurations,
  drawerMotion,
  inlineDrawerMotion,
  inlineDrawerStructure,
} from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-DRW-O (spec §4.2, §3, D7, D9, D19): an overlay NavDrawer moves as an overlay Drawer does, on
 * the same panel shell: the panel slides from its edge with its size's duration (`motion`), the
 * backdrop fades (`backdropMotion`), and the panel exits `inert` with its layer and focus released
 * at once. An inline NavDrawer collapses as an inline Drawer does (P10-DRW-I, §4.3): its panel sits
 * in a collapse wrapper that carries Drawer's and NavDrawer's collapse classes. jsdom loads no
 * CSS, so the phases wait only where `mockAnimations` gives an element a running animation.
 */

const panel = () => document.querySelector<HTMLElement>('.' + navDrawerClassNames.root);
const backdrop = () => document.querySelector<HTMLElement>('.' + navDrawerClassNames.backdrop);
const button = (name: string) => screen.getByRole('button', { name });
/** The presence element of an overlay NavDrawer: its `role="dialog"` panel. */
const isDialog = (el: Element) => el.getAttribute('role') === 'dialog';

const POSITIONS: readonly DrawerPosition[] = ['start', 'end', 'left', 'right', 'bottom'];
const SIZES: readonly DrawerSize[] = ['small', 'medium', 'large', 'full'];
/** The default panel motion: the default position (`start`) with the default size's duration. */
const PANEL_RECIPE = `${drawerMotion.start} ${drawerDurations.small}`;

/** No word of `recipe` on `el`, apart from the words in `except` (the consumer's own classes). */
function expectNoWordOf(el: Element | null, recipe: string, except: readonly string[] = []) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe).filter((word) => !except.includes(word))) {
    expect(el, word).not.toHaveClass(word);
  }
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** A drawer's parts: a Header with a Hamburger and the Body. */
const parts = (
  <>
    <NavDrawer.Header>
      <Hamburger />
      Contoso HR
    </NavDrawer.Header>
    <NavDrawer.Body>
      <Nav.Item value="home">Home</Nav.Item>
      <Nav.Item value="reports">Reports</Nav.Item>
    </NavDrawer.Body>
  </>
);

/** An open NavDrawer, uncontrolled (it never closes in these cases). */
const openDrawer = (props: Partial<NavDrawerProps> = {}) => (
  <NavDrawer defaultOpen {...props}>
    {parts}
  </NavDrawer>
);

/** A controlled drawer opened from a page button, with its open state in the page. */
function Page({ drawerProps }: { drawerProps?: Partial<NavDrawerProps> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((previous) => !previous)}>
        Open navigation
      </button>
      <NavDrawer
        {...drawerProps}
        open={open}
        onOpenChange={(next, details) => {
          drawerProps?.onOpenChange?.(next, details);
          setOpen(next);
        }}
      >
        {parts}
      </NavDrawer>
      <button type="button">Page action</button>
    </>
  );
}

describe('NavDrawer overlay motion per position and size (§3)', () => {
  const cases = POSITIONS.flatMap((position) => SIZES.map((size) => [position, size] as const));

  it.each(cases)(
    'at %s, %s: the edge’s slide with the size’s duration, the size’s backdrop fade, the same in RTL',
    (position, size) => {
      const ui = openDrawer({ position, size });
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

  it('without size: the small duration, at its default start edge', () => {
    render(openDrawer());
    expect(panel()).toHaveAttribute('data-size', 'small');
    expect(panel()).toHaveClass(...motionClasses(PANEL_RECIPE));
    for (const other of SIZES.filter((other) => other !== 'small')) {
      expect(panel()).not.toHaveClass(drawerDurations[other]);
    }
    expect(backdrop()).toHaveClass(...motionClasses(drawerBackdropMotion.small));
  });
});

describe('NavDrawer motion slots (D5, D6)', () => {
  describe.each([
    ['motion', 'the panel', PANEL_RECIPE, panel],
    ['backdropMotion', 'the backdrop', drawerBackdropMotion.small, backdrop],
  ] as const)('%s on %s', (prop, _, recipe, element) => {
    const open = (slot?: MotionSlot | null): React.ReactElement =>
      openDrawer(slot === undefined ? {} : { [prop]: slot });

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
    render(openDrawer({ motion: 'my-motion', backdropMotion: 'my-fade' }));
    const nav = screen.getByRole('navigation', { name: 'Navigation' });
    for (const element of [panel(), backdrop(), nav]) {
      expect(element).not.toHaveAttribute('motion');
      expect(element).not.toHaveAttribute('backdropMotion');
      expect(element).not.toHaveAttribute('backdropmotion');
    }
  });

  describe('a className with presence variants keeps 0.14’s own motion (D19)', () => {
    const legacy = ['w-65', 'data-[presence=exiting]:opacity-0'];

    it('leaves the default motion out and keeps both consumer classes', () => {
      render(openDrawer({ className: legacy.join(' ') }));
      expect(panel()).toHaveClass(...legacy);
      expectNoWordOf(panel(), PANEL_RECIPE, legacy);
      expect(backdrop()).toHaveClass(...motionClasses(drawerBackdropMotion.small));
    });

    it('applies an explicit motion next to that className', () => {
      render(openDrawer({ className: legacy.join(' '), motion: 'my-motion' }));
      expect(panel()).toHaveClass('my-motion', ...legacy);
      expectNoWordOf(panel(), PANEL_RECIPE, legacy);
    });
  });

  describe('backdropMotion on a drawer without a backdrop (D93)', () => {
    const BACKDROP_IGNORED =
      '[WaveUI] NavDrawer: `backdrop` and `backdropMotion` are ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.';
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
      ['a non-modal overlay', { modalType: 'non-modal' }],
      ['an inline drawer', { type: 'inline' }],
    ] as const)('is ignored on %s with the backdrop-ignored warning, once', (_, props) => {
      render(
        <React.StrictMode>
          {openDrawer({ backdropMotion: 'my-motion', ...props })}
        </React.StrictMode>,
      );
      expect(panel()).not.toBeNull();
      expect(backdrop()).toBeNull();
      expect(document.querySelector('.my-motion')).toBeNull();
      expect(warn.mock.calls).toEqual([[BACKDROP_IGNORED]]);
      expect(error).not.toHaveBeenCalled();
    });

    it('does not warn with backdropMotion on a modal overlay', () => {
      render(openDrawer({ backdropMotion: 'my-motion' }));
      expect(backdrop()).toHaveClass('my-motion');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });
});

describe('NavDrawer overlay presence (D7, D9)', () => {
  it('exits after Escape: kept mounted and inert, with focus and the layer released at once', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(button('Open navigation'));
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(dialog).toHaveAttribute('data-presence', 'entering');
    expect(backdrop()).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
    expect(hasOpenModal()).toBe(true);

    await user.keyboard('{Escape}');
    expect(panel()).toBe(dialog);
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
      expect(element).toHaveAttribute('inert');
    }
    // Out of the accessibility tree: the panel is the presence element and inert itself.
    expect(dialog.closest('[inert]')).toBe(dialog);
    expect(hasOpenModal()).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    expect(button('Page action').closest('[inert]')).toBeNull();
    expect(button('Open navigation')).toHaveFocus();

    await finish(motion);
    expect(panel()).toBeNull();
    expect(backdrop()).toBeNull();
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isDialog });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(button('Open navigation'));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toHaveAttribute(
      'data-presence',
      'entered',
    );
    await user.keyboard('{Escape}');
    expect(panel()).toBeNull();
    expect(button('Open navigation')).toHaveFocus();
  });

  it('animates in a drawer open by default on a client render (appear)', async () => {
    const motion = mockAnimations({ animated: isDialog });
    render(openDrawer());
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'entering');
      expect(element).not.toHaveAttribute('inert');
    }
    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
  });

  it('kept mounted (unmountOnClose={false}): exits, then hides', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<Page drawerProps={{ unmountOnClose: false }} />);
    await user.click(button('Open navigation'));
    await finish(motion);
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    await user.keyboard('{Escape}');
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
      expect(element).toHaveAttribute('inert');
      expect(element).not.toHaveAttribute('hidden');
    }
    expect(button('Open navigation')).toHaveFocus();

    await finish(motion);
    expect(panel()).toBe(dialog);
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'exited');
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
    }
  });
});

describe('inline NavDrawer collapse (§4.3, D13)', () => {
  const collapse = () => document.querySelector<HTMLElement>('.' + navDrawerClassNames.collapse);
  /** The presence element of an inline NavDrawer: its collapse wrapper. */
  const isCollapse = (el: Element) => el.classList.contains(navDrawerClassNames.collapse);
  /** The default wrapper motion: the default position (`start`) with the default size's duration. */
  const WRAPPER_RECIPE = `${inlineDrawerMotion.width} ${drawerDurations.small}`;
  const inline = (props: Partial<NavDrawerProps> = {}) => openDrawer({ type: 'inline', ...props });

  it('wraps the panel in an element with Drawer’s and NavDrawer’s collapse classes and the default collapse', () => {
    render(inline());
    const wrapper = collapse()!;
    expect(Array.from(wrapper.classList).slice(0, 2)).toEqual([
      drawerClassNames.collapse,
      navDrawerClassNames.collapse,
    ]);
    expect(wrapper).toHaveClass(
      ...motionClasses(inlineDrawerStructure.start),
      ...motionClasses(WRAPPER_RECIPE),
    );
    expect(Array.from(wrapper.children)).toEqual([panel()]);
    expect(panel()).toHaveAttribute('data-type', 'inline');
    expect(panel()).toContainElement(screen.getByRole('navigation', { name: 'Navigation' }));
    expectNoWordOf(panel(), WRAPPER_RECIPE);
    for (const element of [wrapper, panel()]) {
      expect(element).toHaveAttribute('data-presence', 'entered');
    }
  });

  it.each(POSITIONS)('at %s: the position’s structure and its axis’s collapse', (position) => {
    render(inline({ position, size: 'medium' }));
    expect(collapse()).toHaveClass(
      ...motionClasses(inlineDrawerStructure[position]),
      ...motionClasses(inlineDrawerMotion[position === 'bottom' ? 'height' : 'width']),
      drawerDurations.medium,
    );
  });

  it('size="full": the structure only', () => {
    render(inline({ size: 'full' }));
    expect(collapse()).toHaveClass(...motionClasses(inlineDrawerStructure.start));
    expectNoWordOf(collapse(), `${inlineDrawerMotion.width} ${drawerDurations.full}`);
  });

  it.each([
    ['null', null],
    ['a replacement', 'my-motion'],
  ] as const)('motion %s goes on the wrapper', (_, slot) => {
    render(inline({ motion: slot }));
    expectNoWordOf(collapse(), WRAPPER_RECIPE);
    if (slot !== null) expect(collapse()).toHaveClass(slot);
    expect(panel()).not.toHaveClass('my-motion');
    expect(collapse()).toHaveAttribute('data-presence', 'entered');
  });

  it('a className with presence variants keeps 0.14’s motion on the panel (D19)', async () => {
    const legacy = ['w-65', 'data-[presence=exiting]:opacity-0'];
    const motion = mockAnimations({
      animated: (el) => el.classList.contains(navDrawerClassNames.root),
    });
    const user = userEvent.setup();
    render(<Page drawerProps={{ type: 'inline', className: legacy.join(' ') }} />);
    await user.click(button('Open navigation'));
    expectNoWordOf(collapse(), WRAPPER_RECIPE);
    expect(panel()).toHaveClass(...legacy);
    await finish(motion);
    const element = panel()!;
    await user.click(button('Open navigation'));
    expect(panel()).toBe(element);
    expect(element).toHaveAttribute('data-presence', 'exiting');
    expect(element).toHaveAttribute('inert');
    await finish(motion);
    expect(panel()).toBeNull();
    expect(collapse()).toBeNull();
  });

  it('exits on close: the wrapper and the panel stay, inert, then unmount', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Page drawerProps={{ type: 'inline' }} />);
    await user.click(button('Open navigation'));
    expect(collapse()).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    const wrapper = collapse()!;
    const element = panel()!;

    await user.click(button('Open navigation'));
    for (const node of [wrapper, element]) {
      expect(node).toHaveAttribute('data-presence', 'exiting');
      expect(node).toHaveAttribute('inert');
    }
    expect(hasOpenModal()).toBe(false);
    expect(button('Open navigation')).toHaveFocus();
    await finish(motion);
    expect(collapse()).toBeNull();
    expect(panel()).toBeNull();
  });

  it('kept mounted and closed: the wrapper and the panel are both hidden and inert', () => {
    render(<Page drawerProps={{ type: 'inline', unmountOnClose: false }} />);
    for (const element of [collapse(), panel()]) {
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
      expect(element).toHaveAttribute('data-presence', 'exited');
    }
  });
});
