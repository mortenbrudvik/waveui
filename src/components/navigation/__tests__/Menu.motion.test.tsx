import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, type MenuPopoverProps, type MenuProps } from '../Menu';
import { getOpenLayers } from '../../../lib/layers';
import { popupMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-MENU (spec §6.1, D7, D9): Menu.Popover's default motion (`popupMotion`, keyed on the
 * resolved `data-side`), its `motion` slot, the presence pair of a root menu and of a submenu
 * chain, `appear`, and 0.14's motion in `className`, a plain class list since 1.0 (0.15's D19 rule
 * is removed). jsdom loads no CSS, so the phases wait only where `mockAnimations` gives a surface
 * a running animation.
 */

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

const item = (name: string) => screen.getByRole('menuitem', { name });
const fileButton = () => screen.getByRole('button', { name: 'File' });
/** A menu surface by its name, exiting ones included (an exiting surface is `inert`, not hidden). */
const menu = (name: string) => screen.getByRole('menu', { name });
const queryMenu = (name: string) => screen.queryByRole('menu', { name });
/** The presence element of every menu: its `role="menu"` surface. */
const isMenu = (el: Element) => el.getAttribute('role') === 'menu';

/** The words of the `ExitMotion` story (stories/Menu.stories.tsx), which 0.14 put in `className`. */
const STORY_EXIT_MOTION =
  'transition-opacity duration-wave-fast data-[presence=exiting]:opacity-0 motion-reduce:transition-none';

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

/** A File menu with a Share submenu. */
function FileMenu({
  root,
  popover,
  sharePopover,
}: {
  root?: Partial<MenuProps>;
  popover?: Partial<MenuPopoverProps>;
  sharePopover?: Partial<MenuPopoverProps>;
}) {
  return (
    <Menu {...root}>
      <Menu.Trigger>
        <button type="button">File</button>
      </Menu.Trigger>
      <Menu.Popover {...popover}>
        <Menu.Item>New</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Share</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover {...sharePopover}>
            <Menu.Item>Email</Menu.Item>
            <Menu.Item>Link</Menu.Item>
          </Menu.Popover>
        </Menu>
        <Menu.Item>Exit</Menu.Item>
      </Menu.Popover>
    </Menu>
  );
}

describe('Menu.Popover motion slot (D5, D6)', () => {
  const open = (slot?: MotionSlot | null): React.ReactElement => (
    <FileMenu root={{ defaultOpen: true }} popover={slot === undefined ? {} : { motion: slot }} />
  );

  it('undefined: the default motion', () => {
    render(open());
    expect(menu('File')).toHaveClass(...motionClasses(popupMotion));
  });

  it('null: no motion, and the surface still renders its phase', () => {
    render(open(null));
    expectNoWordOf(menu('File'), popupMotion);
    expect(menu('File')).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['a slot object', { className: 'my-motion' }],
  ] as const)('%s replaces the default motion', (_, slot) => {
    render(open(slot));
    expect(menu('File')).toHaveClass('my-motion');
    expectNoWordOf(menu('File'), popupMotion);
  });

  it('WaveProvider motion="none" turns the default off; the part’s own value still applies', () => {
    const { unmount } = renderWithProviders(open(), { motion: 'none' });
    expectNoWordOf(menu('File'), popupMotion);
    expect(menu('File')).toHaveAttribute('data-presence', 'entered');
    unmount();
    renderWithProviders(open('my-motion'), { motion: 'none' });
    expect(menu('File')).toHaveClass('my-motion');
  });

  it('keeps the motion prop off the DOM', () => {
    render(open('my-motion'));
    expect(menu('File')).not.toHaveAttribute('motion');
  });

  it('a submenu has the default motion of its own, and its own slot', async () => {
    const user = userEvent.setup();
    render(<FileMenu sharePopover={{ motion: 'my-motion' }} />);
    await user.click(fileButton());
    expect(menu('File')).toHaveClass(...motionClasses(popupMotion));
    await user.click(item('Share'));
    expect(menu('Share')).toHaveClass('my-motion');
    expectNoWordOf(menu('Share'), popupMotion);
  });
});

describe('Menu.Popover data-side picks the slide (§2.4)', () => {
  it.each([
    ['ltr', 'right'],
    ['rtl', 'left'],
  ] as const)(
    '%s: the root opens below its trigger, a submenu at its end side',
    async (dir, side) => {
      const user = userEvent.setup();
      renderWithProviders(<FileMenu />, { dir });
      await user.click(fileButton());
      expect(menu('File')).toHaveAttribute('data-side', 'bottom');
      await user.click(item('Share'));
      expect(menu('Share')).toHaveAttribute('data-side', side);
      expect(menu('Share')).toHaveClass(...motionClasses(popupMotion));
    },
  );
});

// 0.14's motion in `className` turned the default off through 0.x; in 1.0 it is a plain class
// list, composed after the motion classes (the file's afterEach asserts that nothing warns).
describe('a className with presence variants is a plain class list (the rule is removed in 1.0)', () => {
  const presenceClasses = ['p-8', 'data-[presence=exiting]:opacity-0'];
  const storyClasses = motionClasses(STORY_EXIT_MOTION);

  it('keeps the default motion and composes the className after it', () => {
    render(
      <FileMenu root={{ defaultOpen: true }} popover={{ className: presenceClasses.join(' ') }} />,
    );
    // The className's exit opacity replaces the recipe's own word of the same variant (1.0: the
    // recipe's carries the prefix, so the two are no longer one string); the rest stays.
    const replaced = 'wave:data-[presence=exiting]:opacity-0';
    expect(menu('File')).toHaveClass(
      ...motionClasses(popupMotion).filter((word) => word !== replaced),
      ...presenceClasses,
    );
    expect(menu('File')).not.toHaveClass(replaced);
    expect(Array.from(menu('File').classList).slice(-2)).toEqual(presenceClasses);
  });

  it('the 0.14 ExitMotion story’s classes merge as any className: the default’s words they conflict with go, its slide stays', () => {
    render(<FileMenu root={{ defaultOpen: true }} popover={{ className: STORY_EXIT_MOTION }} />);
    expect(menu('File')).toHaveClass(...storyClasses);
    // `transition-opacity` and `duration-wave-fast` replace the default's property list and
    // duration (the same variant); the rest of the default stays, its slide included.
    expect(menu('File')).not.toHaveClass('wave:transition-[opacity,translate]');
    expect(menu('File')).not.toHaveClass('wave:duration-wave-normal');
    const kept = motionClasses(popupMotion).filter(
      (word) => word.startsWith('wave:data-[side=') || word.startsWith('wave:ease-wave-'),
    );
    expect(kept.length).toBeGreaterThan(0);
    expect(menu('File')).toHaveClass(...kept);
  });

  it('an explicit motion still replaces the default; the className stays', () => {
    render(
      <FileMenu
        root={{ defaultOpen: true }}
        popover={{ className: STORY_EXIT_MOTION, motion: 'my-motion' }}
      />,
    );
    expect(menu('File')).toHaveClass('my-motion', ...storyClasses);
    expectNoWordOf(menu('File'), popupMotion, storyClasses);
  });
});

describe('Menu.Popover presence (D7, D9)', () => {
  it('exits after Escape: kept mounted, closed and inert, with the layer and focus released at once', async () => {
    const motion = mockAnimations({ animated: isMenu });
    const user = userEvent.setup();
    render(<FileMenu />);
    await user.click(fileButton());
    const surface = menu('File');
    expect(surface).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(surface).toHaveAttribute('data-presence', 'entered');

    await user.keyboard('{Escape}');
    expect(menu('File')).toBe(surface);
    expect(surface).toHaveAttribute('data-presence', 'exiting');
    expect(surface).toHaveAttribute('data-state', 'closed');
    expect(surface.closest('[inert]')).toBe(surface);
    expect(getOpenLayers()).toHaveLength(0);
    expect(fileButton()).toHaveFocus();

    await finish(motion);
    expect(queryMenu('File')).toBeNull();
  });

  it('a submenu chain closed by an item: both menus exit inert, both layers go, focus on the root trigger', async () => {
    const motion = mockAnimations({ animated: isMenu });
    const user = userEvent.setup();
    render(<FileMenu />);
    await user.click(fileButton());
    await finish(motion);
    await user.click(item('Share'));
    await finish(motion);
    const root = menu('File');
    const share = menu('Share');
    expect(getOpenLayers()).toHaveLength(2);

    await user.click(item('Email'));
    for (const surface of [root, share]) {
      expect(surface).toHaveAttribute('data-presence', 'exiting');
      expect(surface).toHaveAttribute('data-state', 'closed');
      expect(surface.closest('[inert]')).toBe(surface);
    }
    expect(getOpenLayers()).toHaveLength(0);
    expect(fileButton()).toHaveFocus();
    expect(fileButton()).toHaveAttribute('aria-expanded', 'false');

    await finish(motion);
    expect(queryMenu('File')).toBeNull();
    expect(queryMenu('Share')).toBeNull();
    expect(fileButton()).toHaveFocus();
  });

  it('animates in a menu open by default on a client render (appear)', async () => {
    const motion = mockAnimations({ animated: isMenu });
    render(<FileMenu root={{ defaultOpen: true }} />);
    const surface = menu('File');
    expect(surface).toHaveAttribute('data-presence', 'entering');
    expect(surface).not.toHaveAttribute('inert');
    await finish(motion);
    expect(surface).toHaveAttribute('data-presence', 'entered');
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isMenu });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<FileMenu />);
    await user.click(fileButton());
    expect(menu('File')).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    expect(queryMenu('File')).toBeNull();
    expect(fileButton()).toHaveFocus();
  });
});
