import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoButton } from '../InfoButton';
import { InfoLabel } from '../InfoLabel';
import { infoButtonClassNames } from '../../../lib/classNames';
import { popupMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-INFO (spec §6.3, D7, D9, D22): the InfoButton note animates with the positioned popups'
 * default motion (`popupMotion`), takes a `motion` slot (InfoLabel passes it through), keeps the one
 * copy of `info` through the exit, and moves focus out of itself in the closing commit.
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

const button = () => screen.getByRole('button', { name: 'Information' });
/** The note, exiting ones included (an exiting note is `inert`, which role queries ignore). */
const note = () => document.querySelector<HTMLElement>('.' + infoButtonClassNames.info);
const isNote = (el: Element) => el.classList.contains(infoButtonClassNames.info);
const infoCopies = () => screen.queryAllByTestId('info');

function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

const INFO = <span data-testid="info">Use 12 characters.</span>;

describe('InfoButton note motion slot (D5, D6)', () => {
  const open = (slot?: MotionSlot | null) => (
    <InfoButton info={INFO} openOnHover={false} {...(slot === undefined ? {} : { motion: slot })} />
  );
  const opened = async (ui: React.ReactElement, render_ = render) => {
    const user = userEvent.setup();
    render_(ui);
    await user.click(button());
    return screen.getByRole('note');
  };

  it('undefined: the default motion of a positioned popup', async () => {
    expect(await opened(open())).toHaveClass(...motionClasses(popupMotion));
  });

  it('null: no motion, and the note still renders its phase', async () => {
    const el = await opened(open(null));
    expectNoWordOf(el, popupMotion);
    expect(el).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['a slot object', { className: 'my-motion' }],
  ] as const)('%s replaces the default motion', async (_, slot) => {
    const el = await opened(open(slot));
    expect(el).toHaveClass('my-motion');
    expectNoWordOf(el, popupMotion);
  });

  it('WaveProvider motion="none" turns the default off; the part’s own value still applies', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(open(), { motion: 'none' });
    await user.click(button());
    expectNoWordOf(screen.getByRole('note'), popupMotion);
    unmount();
    renderWithProviders(open('my-motion'), { motion: 'none' });
    await user.click(button());
    expect(screen.getByRole('note')).toHaveClass('my-motion');
  });

  it('keeps the motion prop off the DOM, on the note only', async () => {
    const el = await opened(open('my-motion'));
    expect(el).toHaveClass(infoButtonClassNames.info, 'my-motion');
    expect(button()).not.toHaveAttribute('motion');
    expect(button()).not.toHaveClass('my-motion');
  });

  it('InfoLabel passes motion through to the note', async () => {
    const user = userEvent.setup();
    render(
      <InfoLabel info={INFO} motion="my-motion" openOnHover={false}>
        Password
      </InfoLabel>,
    );
    await user.click(screen.getByRole('button', { name: 'Password Information' }));
    const el = screen.getByRole('note');
    expect(el).toHaveClass('my-motion');
    expectNoWordOf(el, popupMotion);
  });

  it('InfoLabel without motion: the default', async () => {
    const user = userEvent.setup();
    render(
      <InfoLabel info={INFO} openOnHover={false}>
        Password
      </InfoLabel>,
    );
    await user.click(screen.getByRole('button', { name: 'Password Information' }));
    expect(screen.getByRole('note')).toHaveClass(...motionClasses(popupMotion));
  });
});

describe('InfoButton note presence (D7, D9, D22)', () => {
  it('exits after Escape: kept mounted, closed and inert, with exactly one copy of info in every phase', async () => {
    const motion = mockAnimations({ animated: isNote });
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    expect(infoCopies()).toHaveLength(1);
    expect(note()).toBeNull();

    await user.click(button());
    const el = note()!;
    expect(el).toHaveAttribute('data-presence', 'entering');
    expect(el).toHaveAttribute('data-state', 'open');
    expect(infoCopies()).toHaveLength(1);
    expect(el).toContainElement(infoCopies()[0]!);
    await finish(motion);
    expect(el).toHaveAttribute('data-presence', 'entered');
    expect(infoCopies()).toHaveLength(1);

    await user.keyboard('{Escape}');
    expect(note()).toBe(el);
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(el).toHaveAttribute('data-state', 'closed');
    expect(el.closest('[inert]')).toBe(el);
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button()).not.toHaveAttribute('aria-controls');
    expect(infoCopies()).toHaveLength(1);
    expect(el).toContainElement(infoCopies()[0]!);

    await finish(motion);
    expect(note()).toBeNull();
    expect(infoCopies()).toHaveLength(1);
    expect(el).not.toContainElement(infoCopies()[0]!);
  });

  it('Escape with focus on a link in the note focuses the button in the closing commit', async () => {
    const motion = mockAnimations({ animated: isNote });
    const user = userEvent.setup();
    render(
      <InfoButton
        info={
          <>
            <span data-testid="info">Rules</span> <a href="#rules">Read the rules</a>
          </>
        }
        openOnHover={false}
      />,
    );
    await user.click(button());
    await finish(motion);
    await user.tab();
    const link = screen.getByRole('link', { name: 'Read the rules' });
    expect(link).toHaveFocus();

    await user.keyboard('{Escape}');
    const el = note()!;
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(el.closest('[inert]')).toBe(el);
    expect(el).toContainElement(link);
    expect(button()).toHaveFocus();

    await finish(motion);
    expect(note()).toBeNull();
    expect(button()).toHaveFocus();
  });

  it('reopened during its exit: the same note enters again, open and not inert', async () => {
    const motion = mockAnimations({ animated: isNote });
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    await user.click(button());
    await finish(motion);
    const el = note()!;

    await user.click(button());
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(el.closest('[inert]')).toBe(el);

    await user.click(button());
    expect(note()).toBe(el);
    expect(document.querySelectorAll('.' + infoButtonClassNames.info)).toHaveLength(1);
    expect(el).toHaveAttribute('data-presence', 'entering');
    expect(el).toHaveAttribute('data-state', 'open');
    expect(el.closest('[inert]')).toBeNull();
    expect(infoCopies()).toHaveLength(1);
    await finish(motion);
    await user.keyboard('{Escape}');
    await finish(motion);
    expect(note()).toBeNull();
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isNote });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    await user.click(button());
    expect(note()).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    expect(note()).toBeNull();
    expect(infoCopies()).toHaveLength(1);
  });

  it('without reduced motion the phases wait for the note’s motion', async () => {
    const motion = mockAnimations({ animated: isNote });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    await user.click(button());
    const el = note()!;
    expect(el).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(el).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    expect(note()).toBe(el);
    expect(el).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(note()).toBeNull();
    expect(infoCopies()).toHaveLength(1);
  });

  it('animates in a note that opens on a client render (appear)', async () => {
    const motion = mockAnimations({ animated: isNote });
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    await user.click(button());
    expect(note()).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(note()).toHaveAttribute('data-presence', 'entered');
  });
});
