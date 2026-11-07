import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { avatarGroupClassNames } from '../../../lib/classNames';
import { getOpenLayers } from '../../../lib/layers';
import { popupMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';
import { Avatar } from '../Avatar';
import { AvatarGroup } from '../AvatarGroup';

/*
 * Motion on the remaining popups (ROADMAP §8.5): the AvatarGroup overflow popup mounts through the
 * presence core with the positioned popups' default motion (`popupMotion`), takes it as `motion`
 * (the group's, or an `AvatarGroup.Popover`'s own), and exits with focus back on the overflow
 * button in the closing commit. jsdom loads no CSS, so the phases wait only where `mockAnimations`
 * gives the popup a running animation.
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

const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana'];
const overflow = () => screen.getByRole('button', { name: '3 more' });
const popup = () => document.querySelector<HTMLElement>('.' + avatarGroupClassNames.surface);
const isPopup = (el: Element) => el.classList.contains(avatarGroupClassNames.surface);

function group(props: Partial<React.ComponentProps<typeof AvatarGroup>> = {}) {
  return (
    <AvatarGroup aria-label="Team" max={1} {...props}>
      {NAMES.map((name) => (
        <Avatar key={name} name={name} />
      ))}
    </AvatarGroup>
  );
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

describe('AvatarGroup overflow popup motion', () => {
  const opened = async (slot?: MotionSlot | null, provider?: 'none') => {
    const user = userEvent.setup();
    if (provider) renderWithProviders(group({ motion: slot }), { motion: provider });
    else render(group({ motion: slot }));
    await user.click(overflow());
    return popup()!;
  };

  it('undefined: the default motion, by the side it opened on', async () => {
    const surface = await opened();
    expect(surface).toHaveClass(...motionClasses(popupMotion));
    expect(surface).toHaveAttribute('data-side', 'bottom');
    expect(surface).toHaveAttribute('data-state', 'open');
    expect(surface).toHaveAttribute('data-presence', 'entered');
  });

  it('null: no motion, and the popup still renders its phase', async () => {
    const surface = await opened(null);
    expectNoWordOf(surface, popupMotion);
    expect(surface).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['a slot object', { className: 'my-motion' }],
  ] as const)('%s replaces the default motion', async (_, slot) => {
    const surface = await opened(slot);
    expect(surface).toHaveClass('my-motion');
    expectNoWordOf(surface, popupMotion);
  });

  it('WaveProvider motion="none" turns the default off; the own value still applies', async () => {
    const { unmount } = renderWithProviders(group(), { motion: 'none' });
    await userEvent.setup().click(overflow());
    expectNoWordOf(popup(), popupMotion);
    expect(popup()).toHaveAttribute('data-presence', 'entered');
    await userEvent.setup().keyboard('{Escape}');
    unmount();
    const surface = await opened('my-motion', 'none');
    expect(surface).toHaveClass('my-motion');
    expectNoWordOf(surface, popupMotion);
  });

  it('an AvatarGroup.Popover takes its own motion over the group’s', async () => {
    const user = userEvent.setup();
    render(
      <AvatarGroup aria-label="Team" motion="group-motion">
        <Avatar name="Alice" />
        <AvatarGroup.Popover motion="own-motion">
          <Avatar name="Bob" />
        </AvatarGroup.Popover>
      </AvatarGroup>,
    );
    await user.click(screen.getByRole('button', { name: '1 more' }));
    expect(popup()).toHaveClass('own-motion');
    expect(popup()).not.toHaveClass('group-motion');
    await user.keyboard('{Escape}');
  });

  it('a group’s motion reaches an AvatarGroup.Popover you write', async () => {
    const user = userEvent.setup();
    render(
      <AvatarGroup aria-label="Team" motion={null}>
        <Avatar name="Alice" />
        <AvatarGroup.Popover>
          <Avatar name="Bob" />
        </AvatarGroup.Popover>
      </AvatarGroup>,
    );
    await user.click(screen.getByRole('button', { name: '1 more' }));
    expectNoWordOf(popup(), popupMotion);
    await user.keyboard('{Escape}');
  });

  it('merges a slotProps surface part, and locks its presence attributes', async () => {
    const user = userEvent.setup();
    render(
      group({
        slotProps: {
          surface: {
            className: 'mine',
            'data-presence': 'exited',
            inert: true,
            'data-state': 'closed',
          },
        },
      }),
    );
    await user.click(overflow());
    expect(popup()).toHaveClass('mine', ...motionClasses(popupMotion));
    expect(popup()).toHaveAttribute('data-presence', 'entered');
    expect(popup()).toHaveAttribute('data-state', 'open');
    expect(popup()).not.toHaveAttribute('inert');
    await user.keyboard('{Escape}');
  });

  it('exits with focus back on the overflow button in the closing commit, the layer released and the popup inert', async () => {
    honourInert();
    const motion = mockAnimations({ animated: isPopup });
    const user = userEvent.setup();
    render(group());
    await user.click(overflow());
    const surface = popup()!;
    expect(surface).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(surface).toHaveAttribute('data-presence', 'entered');
    expect(surface).toHaveFocus();
    expect(overflow()).toHaveAttribute('aria-controls', surface.id);

    await user.keyboard('{Escape}');
    expect(popup()).toBe(surface);
    expect(surface).toHaveAttribute('data-presence', 'exiting');
    expect(surface).toHaveAttribute('data-state', 'closed');
    expect(surface.closest('[inert]')).toBe(surface);
    expect(getOpenLayers()).toHaveLength(0);
    expect(overflow()).toHaveFocus();
    expect(overflow()).toHaveAttribute('aria-expanded', 'false');
    expect(overflow()).not.toHaveAttribute('aria-controls');
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(popup()).toBeNull();
    expect(overflow()).toHaveFocus();
  });

  it('reopened during its exit: the same popup enters again, open and not inert', async () => {
    const motion = mockAnimations({ animated: isPopup });
    const user = userEvent.setup();
    render(group());
    await user.click(overflow());
    await finish(motion);
    const surface = popup()!;
    await user.keyboard('{Escape}');
    expect(surface).toHaveAttribute('data-presence', 'exiting');
    await user.click(overflow());
    expect(popup()).toBe(surface);
    expect(surface).toHaveAttribute('data-presence', 'entering');
    expect(surface).toHaveAttribute('data-state', 'open');
    expect(surface.closest('[inert]')).toBeNull();
    await finish(motion);
    await user.keyboard('{Escape}');
    await finish(motion);
    expect(popup()).toBeNull();
  });

  it('opens and closes once per request in StrictMode', async () => {
    const motion = mockAnimations({ animated: isPopup });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<React.StrictMode>{group({ onOpenChange })}</React.StrictMode>);
    await user.click(overflow());
    await finish(motion);
    await user.keyboard('{Escape}');
    await finish(motion);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenNthCalledWith(
      1,
      true,
      expect.objectContaining({ reason: 'trigger' }),
    );
    expect(onOpenChange).toHaveBeenNthCalledWith(
      2,
      false,
      expect.objectContaining({ reason: 'escape' }),
    );
    expect(popup()).toBeNull();
  });

  it('exits at once without a running animation', async () => {
    const user = userEvent.setup();
    render(group());
    await user.click(overflow());
    await user.keyboard('{Escape}');
    expect(popup()).toBeNull();
    expect(overflow()).toHaveFocus();
  });
});
