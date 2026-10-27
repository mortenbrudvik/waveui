import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer, type DrawerPosition, type DrawerProps, type DrawerSize } from '../Drawer';
import { drawerClassNames } from '../../../lib/classNames';
import { drawerDurations, inlineDrawerMotion, inlineDrawerStructure } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-DRW-I (spec §4.3, §3, D7, D9, D12, D13, D19): an inline Drawer's `<aside>` sits in a collapse
 * wrapper, the presence element, whose default motion collapses the space the panel takes in the
 * layout (columns at a side, rows at the bottom) over the duration of its size. The `<aside>` keeps
 * the consumer's props and the presence attributes; a `full` drawer has no motion; a `className`
 * with presence variants keeps 0.14's motion on the `<aside>`. jsdom loads no CSS, so the phases
 * wait only where `mockAnimations` gives an element a running animation.
 */

const collapse = () => document.querySelector<HTMLElement>('.' + drawerClassNames.collapse);
const aside = () => document.querySelector<HTMLElement>('aside');
const button = (name: string) => screen.getByRole('button', { name });
/** The presence element of an inline drawer: its collapse wrapper. */
const isCollapse = (el: Element) => el.classList.contains(drawerClassNames.collapse);

const POSITIONS: readonly DrawerPosition[] = ['start', 'end', 'left', 'right', 'bottom'];
const SIZES: readonly DrawerSize[] = ['small', 'medium', 'large', 'full'];
/** The axis an inline drawer collapses on: its width at a side, its height at the bottom. */
const axisOf = (position: DrawerPosition) => (position === 'bottom' ? 'height' : 'width');
/** The default wrapper motion: the default position (`end`) with the default size's duration. */
const WRAPPER_RECIPE = `${inlineDrawerMotion.width} ${drawerDurations.small}`;
/** The wrapper's class that lifts the panel's size cap on each axis while it is not entered. */
const PANEL_CAP_LIFT = {
  width: 'not-data-[presence=entered]:*:max-w-none',
  height: 'not-data-[presence=entered]:*:max-h-none',
} as const;

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

/** A page around an uncontrolled inline Drawer with a trigger and an Edit button. */
function Page(props: Partial<DrawerProps>) {
  return (
    <>
      <button type="button">Before</button>
      <Drawer type="inline" title="Details" {...props}>
        <Drawer.Trigger>
          <button type="button">Show details</button>
        </Drawer.Trigger>
        <button type="button">Edit</button>
      </Drawer>
      <button type="button">After</button>
    </>
  );
}

describe('inline Drawer collapse wrapper per position and size (§4.3, §3)', () => {
  const cases = POSITIONS.flatMap((position) =>
    SIZES.filter((size) => size !== 'full').map((size) => [position, size] as const),
  );

  it.each(cases)(
    'at %s, %s: the structure, the axis’s collapse and the size’s duration on the wrapper, the same in RTL',
    (position, size) => {
      const ui = <Page defaultOpen position={position} size={size} />;
      const { unmount } = renderWithProviders(ui, { dir: 'ltr' });
      const wrapper = collapse()!;
      const axis = axisOf(position);
      expect(wrapper.classList[0]).toBe(drawerClassNames.collapse);
      expect(wrapper).toHaveClass(
        ...motionClasses(inlineDrawerStructure[position]),
        ...motionClasses(inlineDrawerMotion[axis]),
        drawerDurations[size],
      );
      for (const other of SIZES.filter((other) => other !== size)) {
        expect(wrapper).not.toHaveClass(drawerDurations[other]);
      }
      // The other axis's transition is not there.
      const otherAxis = axis === 'width' ? 'height' : 'width';
      expect(wrapper).not.toHaveClass(motionClasses(inlineDrawerMotion[otherAxis])[0]);
      // While not entered (a grid), the panel's size cap on its axis is lifted, so the shrinking
      // track clips the panel instead of squeezing it; entered, the cap applies as before.
      expect(wrapper).toHaveClass(PANEL_CAP_LIFT[axis]);
      expect(wrapper).not.toHaveClass(PANEL_CAP_LIFT[otherAxis]);
      // The panel carries none of the wrapper's motion.
      expectNoWordOf(aside(), `${inlineDrawerMotion[axis]} ${drawerDurations[size]}`);
      for (const element of [wrapper, aside()]) {
        expect(element).toHaveAttribute('data-presence', 'entered');
      }
      const ltr = [wrapper.className, aside()!.className];
      unmount();

      // The text direction decides in CSS (logical alignment): the class lists do not change.
      renderWithProviders(ui, { dir: 'rtl' });
      expect([collapse()!.className, aside()!.className]).toEqual(ltr);
    },
  );

  it('wraps only the <aside>, which keeps the consumer’s id, className, ref and attributes', () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <Page
        defaultOpen
        id="details"
        className="w-96"
        ref={ref}
        data-testid="details-panel"
        aria-describedby="details-help"
      />,
    );
    const wrapper = collapse()!;
    const panel = screen.getByRole('complementary', { name: 'Details' });
    expect(Array.from(wrapper.children)).toEqual([panel]);
    expect(panel.localName).toBe('aside');
    expect(panel).toHaveAttribute('id', 'details');
    expect(panel).toHaveClass(drawerClassNames.root, 'w-96');
    expect(ref.current).toBe(panel);
    expect(panel).toHaveAttribute('data-type', 'inline');
    expect(panel).toHaveAttribute('data-testid', 'details-panel');
    expect(panel).toHaveAttribute('aria-describedby', 'details-help');
    // The wrapper takes none of them: it is not the panel.
    expect(wrapper.localName).toBe('div');
    expect(wrapper).not.toHaveClass(drawerClassNames.root, 'w-96');
    for (const name of ['id', 'data-type', 'data-testid', 'aria-describedby', 'role']) {
      expect(wrapper, name).not.toHaveAttribute(name);
    }
    // The trigger comes before the wrapper (and so before the panel).
    expect(button('Show details').compareDocumentPosition(wrapper)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('size="full": the structure only, without the collapse or a duration (D13)', () => {
    const { unmount } = render(<Page defaultOpen size="full" />);
    expect(collapse()).toHaveClass(...motionClasses(inlineDrawerStructure.end));
    expectNoWordOf(collapse(), `${inlineDrawerMotion.width} ${drawerDurations.full}`);
    expect(collapse()).toHaveAttribute('data-presence', 'entered');
    unmount();

    // Its size is its container's: a replacement does not apply either (spec §4.3).
    render(<Page defaultOpen size="full" motion="my-motion" />);
    expect(collapse()).toHaveClass(...motionClasses(inlineDrawerStructure.end));
    expect(collapse()).not.toHaveClass('my-motion');
  });

  it('kept mounted and closed: the wrapper and the <aside> are both hidden and inert', () => {
    render(<Page unmountOnClose={false} />);
    for (const element of [collapse(), aside()]) {
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
      expect(element).toHaveAttribute('data-presence', 'exited');
    }
  });
});

describe('inline Drawer motion slot on the wrapper (D5, D6)', () => {
  const open = (slot?: MotionSlot | null): React.ReactElement => (
    <Page defaultOpen {...(slot === undefined ? {} : { motion: slot })} />
  );

  it('undefined: the default collapse', () => {
    render(open());
    expect(collapse()).toHaveClass(...motionClasses(WRAPPER_RECIPE));
  });

  it('null: no motion, and the wrapper still renders its phase', () => {
    render(open(null));
    expectNoWordOf(collapse(), WRAPPER_RECIPE);
    expect(collapse()).toHaveClass(...motionClasses(inlineDrawerStructure.end));
    expect(collapse()).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['a slot object', { className: 'my-motion' }],
  ] as const)('%s replaces the default motion on the wrapper', (_, slot) => {
    render(open(slot));
    expect(collapse()).toHaveClass('my-motion', ...motionClasses(inlineDrawerStructure.end));
    expectNoWordOf(collapse(), WRAPPER_RECIPE);
    expect(aside()).not.toHaveClass('my-motion');
  });

  it('WaveProvider motion="none" turns the default off; the drawer’s own value still applies', () => {
    const { unmount } = renderWithProviders(open(), { motion: 'none' });
    expectNoWordOf(collapse(), WRAPPER_RECIPE);
    expect(collapse()).toHaveAttribute('data-presence', 'entered');
    unmount();
    renderWithProviders(open('my-motion'), { motion: 'none' });
    expect(collapse()).toHaveClass('my-motion');
  });

  it('keeps the motion props off the DOM', () => {
    render(<Page defaultOpen motion="my-motion" />);
    for (const element of [collapse(), aside()]) {
      expect(element).not.toHaveAttribute('motion');
      expect(element).not.toHaveAttribute('backdropMotion');
      expect(element).not.toHaveAttribute('backdropmotion');
    }
  });
});

describe('inline Drawer with a className that holds presence variants (D19)', () => {
  const legacy = ['p-8', 'data-[presence=exiting]:opacity-0'];
  const isAside = (el: Element) => el.tagName === 'ASIDE';

  it('leaves the motion off the wrapper and keeps the classes on the <aside>, whose motion the exit waits for', async () => {
    const motion = mockAnimations({ animated: isAside });
    const user = userEvent.setup();
    render(<Page defaultOpen className={legacy.join(' ')} />);
    expectNoWordOf(collapse(), WRAPPER_RECIPE);
    expect(collapse()).toHaveClass(...motionClasses(inlineDrawerStructure.end));
    expect(aside()).toHaveClass(...legacy);

    const panel = aside()!;
    const wrapper = collapse()!;
    await user.click(button('Close'));
    // 0.14's behaviour: the presence core waits for the <aside>'s own motion.
    for (const element of [wrapper, panel]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
      expect(element).toHaveAttribute('inert');
    }
    expect(aside()).toBe(panel);
    expect(button('Show details')).toHaveFocus();
    await finish(motion);
    expect(aside()).toBeNull();
    expect(collapse()).toBeNull();
  });

  it('without that className the exit waits for the wrapper, not for the <aside>', async () => {
    mockAnimations({ animated: isAside });
    const user = userEvent.setup();
    render(<Page defaultOpen className="p-8" />);
    await user.click(button('Close'));
    expect(aside()).toBeNull();
    expect(collapse()).toBeNull();
  });

  it('applies an explicit motion next to that className, on the wrapper', () => {
    render(<Page defaultOpen className={legacy.join(' ')} motion="my-motion" />);
    expect(collapse()).toHaveClass('my-motion');
    expectNoWordOf(collapse(), WRAPPER_RECIPE);
    expect(aside()).toHaveClass(...legacy);
    expect(aside()).not.toHaveClass('my-motion');
  });
});

describe('inline Drawer presence (D7, D9, D13)', () => {
  it('exits on close: the wrapper and the <aside> stay, inert, with focus already returned', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(button('Show details'));
    const wrapper = collapse()!;
    const panel = screen.getByRole('complementary', { name: 'Details' });
    for (const element of [wrapper, panel]) {
      expect(element).toHaveAttribute('data-presence', 'entering');
      expect(element).not.toHaveAttribute('inert');
    }
    await finish(motion);
    for (const element of [wrapper, panel]) {
      expect(element).toHaveAttribute('data-presence', 'entered');
    }

    await user.click(button('Close'));
    expect(collapse()).toBe(wrapper);
    expect(aside()).toBe(panel);
    for (const element of [wrapper, panel]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
      expect(element).toHaveAttribute('inert');
    }
    expect(panel.closest('[inert]')).toBe(panel);
    expect(button('Show details')).toHaveFocus();
    expect(button('Show details')).toHaveAttribute('aria-expanded', 'false');
    expect(button('After').closest('[inert]')).toBeNull();

    await finish(motion);
    expect(collapse()).toBeNull();
    expect(aside()).toBeNull();
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isCollapse });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(button('Show details'));
    expect(collapse()).toHaveAttribute('data-presence', 'entered');
    expect(aside()).toHaveAttribute('data-presence', 'entered');
    await user.click(button('Close'));
    expect(collapse()).toBeNull();
    expect(aside()).toBeNull();
    expect(button('Show details')).toHaveFocus();
  });

  it('does not animate in when it mounts open on a client render (no appear, D9)', () => {
    mockAnimations({ animated: (el) => isCollapse(el) || el.tagName === 'ASIDE' });
    render(<Page defaultOpen />);
    for (const element of [collapse(), aside()]) {
      expect(element).toHaveAttribute('data-presence', 'entered');
      expect(element).not.toHaveAttribute('inert');
    }
  });

  it('reopened during its exit: the same wrapper and <aside> enter again', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(button('Show details'));
    await finish(motion);
    const wrapper = collapse()!;
    const panel = aside()!;
    await user.click(button('Show details'));
    expect(wrapper).toHaveAttribute('data-presence', 'exiting');

    await user.click(button('Show details'));
    expect(collapse()).toBe(wrapper);
    expect(aside()).toBe(panel);
    for (const element of [wrapper, panel]) {
      expect(element).toHaveAttribute('data-presence', 'entering');
      expect(element).not.toHaveAttribute('inert');
    }
    await finish(motion);
    expect(wrapper).toHaveAttribute('data-presence', 'entered');
  });

  it('kept mounted (unmountOnClose={false}): exits, then hides both elements', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Page unmountOnClose={false} />);
    await user.click(button('Show details'));
    await finish(motion);
    const wrapper = collapse()!;
    const panel = aside()!;
    await user.click(button('Close'));
    for (const element of [wrapper, panel]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
      expect(element).toHaveAttribute('inert');
      expect(element).not.toHaveAttribute('hidden');
    }
    await finish(motion);
    expect(collapse()).toBe(wrapper);
    expect(aside()).toBe(panel);
    for (const element of [wrapper, panel]) {
      expect(element).toHaveAttribute('data-presence', 'exited');
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
    }
  });

  describe('server rendering', () => {
    let error: ReturnType<typeof vi.spyOn>;
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      error = vi.spyOn(console, 'error');
      warn = vi.spyOn(console, 'warn');
    });
    afterEach(() => {
      error.mockRestore();
      warn.mockRestore();
    });

    it('renders an open inline drawer entered, wrapper and <aside>, and hydrates without a warning', async () => {
      const element = <Page defaultOpen onOpenChange={() => {}} />;
      const html = renderToString(element);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = html;
      const serverWrapper = parsed.querySelector('.' + drawerClassNames.collapse);
      expect(serverWrapper).not.toBeNull();
      expect(serverWrapper).toHaveAttribute('data-presence', 'entered');
      expect(serverWrapper).toHaveClass(...motionClasses(WRAPPER_RECIPE));
      expect(Array.from(serverWrapper!.children).map((child) => child.localName)).toEqual([
        'aside',
      ]);
      expect(serverWrapper!.firstElementChild).toHaveAttribute('data-presence', 'entered');

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const onRecoverableError = vi.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        const wrapper = container.querySelector('.' + drawerClassNames.collapse);
        const panel = container.querySelector('aside');
        await act(async () => {
          root = hydrateRoot(container, element, { onRecoverableError });
        });
        expect(collapse()).toBe(wrapper);
        expect(aside()).toBe(panel);
        expect(collapse()).toHaveAttribute('data-presence', 'entered');
        expect(aside()).toHaveAttribute('data-presence', 'entered');
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });
  });
});
