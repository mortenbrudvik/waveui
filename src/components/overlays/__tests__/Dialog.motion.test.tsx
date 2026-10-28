import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, type DialogContentProps, type DialogProps } from '../Dialog';
import { dialogContentClassNames } from '../../../lib/classNames';
import { hasOpenModal } from '../../../lib/layers';
import { dialogBackdropMotion, dialogMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  installResizeObserverMock,
  mockAnimations,
  mockMatchMedia,
  mockRect,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-DLG (spec §4.1, D7, D9, D16, D19): Dialog.Content's default motion on the surface
 * (`motion`) and the backdrop (`backdropMotion`), the presence pair of the surface, `appear`, and
 * the two fixes an exit makes visible: a stacked dialog's backdrop keeps its appearance (risk 7)
 * and the titles keep their end padding (risk 8) while the surface exits. jsdom loads no CSS, so
 * the phases wait only where `mockAnimations` gives the surface a running animation.
 */

const surface = () => document.querySelector<HTMLElement>('.' + dialogContentClassNames.root);
const backdrop = () => document.querySelector<HTMLElement>('.' + dialogContentClassNames.backdrop);
const positioner = () =>
  document.querySelector<HTMLElement>('.' + dialogContentClassNames.positioner);
const titleActions = () =>
  document.querySelector<HTMLElement>('.' + dialogContentClassNames.titleActions);
const button = (name: string) => screen.getByRole('button', { name });
/** The presence element of every Dialog: the surface. */
const isDialog = (el: Element) => el.getAttribute('role') === 'dialog';
/** The backdrop of the dialog whose surface is `dialog` (its portal's, a sibling of the positioner). */
const backdropOf = (dialog: HTMLElement) =>
  dialog
    .closest('[data-wave-portal]')
    ?.querySelector<HTMLElement>('.' + dialogContentClassNames.backdrop) ?? null;

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

function OrderDialog({
  dialogProps,
  contentProps,
}: {
  dialogProps?: Partial<DialogProps>;
  contentProps?: Partial<DialogContentProps>;
}) {
  return (
    <>
      <button type="button">Page button</button>
      <Dialog {...dialogProps}>
        <Dialog.Trigger>
          <button type="button">Open order</button>
        </Dialog.Trigger>
        <Dialog.Content title="Order" {...contentProps}>
          <button type="button">Confirm</button>
        </Dialog.Content>
      </Dialog>
    </>
  );
}

describe('Dialog.Content motion slots (D5, D6)', () => {
  describe.each([
    ['motion', 'the surface', dialogMotion, surface],
    ['backdropMotion', 'the backdrop', dialogBackdropMotion, backdrop],
  ] as const)('%s on %s', (prop, _, recipe, element) => {
    const open = (slot?: MotionSlot | null): React.ReactElement => (
      <OrderDialog
        dialogProps={{ defaultOpen: true }}
        contentProps={slot === undefined ? {} : { [prop]: slot }}
      />
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
    render(
      <OrderDialog
        dialogProps={{ defaultOpen: true }}
        contentProps={{ motion: 'my-motion', backdropMotion: 'my-fade' }}
      />,
    );
    for (const element of [surface(), backdrop(), positioner()]) {
      expect(element).not.toHaveAttribute('motion');
      expect(element).not.toHaveAttribute('backdropMotion');
      expect(element).not.toHaveAttribute('backdropmotion');
    }
  });

  describe('a className with presence variants keeps 0.14’s own motion (D19)', () => {
    const legacy = ['p-8', 'data-[presence=exiting]:opacity-0'];

    it('leaves the default motion out and keeps both consumer classes', () => {
      render(
        <OrderDialog
          dialogProps={{ defaultOpen: true }}
          contentProps={{ className: legacy.join(' ') }}
        />,
      );
      expect(surface()).toHaveClass(...legacy);
      expectNoWordOf(surface(), dialogMotion, legacy);
      // The backdrop is not the className's element: it keeps its default.
      expect(backdrop()).toHaveClass(...motionClasses(dialogBackdropMotion));
    });

    it('applies an explicit motion next to that className', () => {
      render(
        <OrderDialog
          dialogProps={{ defaultOpen: true }}
          contentProps={{ className: legacy.join(' '), motion: 'my-motion' }}
        />,
      );
      expect(surface()).toHaveClass('my-motion', ...legacy);
      expectNoWordOf(surface(), dialogMotion, legacy);
    });
  });

  describe('backdropMotion on a non-modal dialog (D93)', () => {
    const BACKDROP_IGNORED =
      '[WaveUI] Dialog.Content: `backdrop` and `backdropMotion` are ignored with `modalType="non-modal"`: a non-modal dialog has no backdrop, so the page behind it stays usable.';
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

    it('is ignored with the backdrop-ignored warning, once', () => {
      render(
        <React.StrictMode>
          <OrderDialog
            dialogProps={{ defaultOpen: true, modalType: 'non-modal' }}
            contentProps={{ backdropMotion: 'my-motion' }}
          />
        </React.StrictMode>,
      );
      expect(screen.getByRole('dialog', { name: 'Order' })).toBeInTheDocument();
      expect(backdrop()).toBeNull();
      expect(document.querySelector('.my-motion')).toBeNull();
      expect(warn.mock.calls).toEqual([[BACKDROP_IGNORED]]);
      expect(error).not.toHaveBeenCalled();
    });

    it('does not warn without backdropMotion on a non-modal dialog, nor with it on a modal one', () => {
      const { unmount } = render(
        <OrderDialog dialogProps={{ defaultOpen: true, modalType: 'non-modal' }} />,
      );
      unmount();
      render(
        <OrderDialog
          dialogProps={{ defaultOpen: true }}
          contentProps={{ backdropMotion: 'my-motion' }}
        />,
      );
      expect(backdrop()).toHaveClass('my-motion');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });
});

describe('Dialog.Content presence (D7, D9)', () => {
  it('exits after Escape: kept mounted and inert, with focus, layer, isolation and scroll lock released at once', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<OrderDialog />);
    await user.click(button('Open order'));
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    expect(dialog).toHaveAttribute('data-presence', 'entering');
    expect(backdrop()).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
    expect(hasOpenModal()).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(surface()).toBe(dialog);
    for (const element of [backdrop(), positioner(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'exiting');
    }
    expect(positioner()).toHaveAttribute('inert');
    expect(backdrop()).toHaveAttribute('inert');
    // Out of the accessibility tree: inside the inert positioner. (Testing Library's role queries
    // do not read `inert`, so the exiting surface is still found without `hidden: true`.)
    expect(dialog.closest('[inert]')).toBe(positioner());
    expect(screen.getByRole('dialog', { hidden: true })).toBe(dialog);
    expect(hasOpenModal()).toBe(false);
    expect(scrollLockStyles()).toEqual(['', '', '', '']);
    expect(button('Page button').closest('[inert]')).toBeNull();
    expect(button('Open order')).toHaveFocus();
    expect(button('Open order')).toHaveAttribute('aria-expanded', 'false');

    await finish(motion);
    expect(surface()).toBeNull();
    expect(backdrop()).toBeNull();
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isDialog });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<OrderDialog />);
    await user.click(button('Open order'));
    expect(screen.getByRole('dialog', { name: 'Order' })).toHaveAttribute(
      'data-presence',
      'entered',
    );
    await user.keyboard('{Escape}');
    expect(surface()).toBeNull();
    expect(button('Open order')).toHaveFocus();
  });

  it('animates in a dialog open by default on a client render (appear)', async () => {
    const motion = mockAnimations({ animated: isDialog });
    render(<OrderDialog dialogProps={{ defaultOpen: true }} />);
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    for (const element of [backdrop(), positioner(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'entering');
      expect(element).not.toHaveAttribute('inert');
    }
    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
  });

  it('reopened during its exit: the same surface enters again with its layer, trap, isolation and focus', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<OrderDialog />);
    await user.click(button('Open order'));
    await finish(motion);
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    await user.keyboard('{Escape}');
    expect(dialog).toHaveAttribute('data-presence', 'exiting');

    await user.click(button('Open order'));
    expect(screen.getByRole('dialog', { name: 'Order' })).toBe(dialog);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog).toHaveAttribute('data-presence', 'entering');
    expect(positioner()).not.toHaveAttribute('inert');
    expect(backdrop()).not.toHaveAttribute('inert');
    expect(hasOpenModal()).toBe(true);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(button('Page button').closest('[inert]')).not.toBeNull();
    expect(document.documentElement.style.overflow).toBe('hidden');

    await finish(motion);
    expect(dialog).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    await finish(motion);
    expect(surface()).toBeNull();
    expect(button('Open order')).toHaveFocus();
  });

  it('kept mounted (unmountOnClose={false}): exits, then hides', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(<OrderDialog dialogProps={{ unmountOnClose: false }} />);
    await user.click(button('Open order'));
    await finish(motion);
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    await user.keyboard('{Escape}');
    expect(dialog).toHaveAttribute('data-presence', 'exiting');
    for (const element of [backdrop(), positioner()]) {
      expect(element).toHaveAttribute('inert');
      expect(element).not.toHaveAttribute('hidden');
    }
    await finish(motion);
    expect(surface()).toBe(dialog);
    expect(dialog).toHaveAttribute('data-presence', 'exited');
    for (const element of [backdrop(), positioner()]) {
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
        <OrderDialog dialogProps={{ onOpenChange }} />
      </React.StrictMode>,
    );
    await user.click(button('Open order'));
    await finish(motion);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'escape' }),
    );
    await finish(motion);
    expect(surface()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});

describe('Dialog.Content while it exits (D15)', () => {
  it('keeps a stacked dialog’s backdrop transparent while it exits (risk 7)', async () => {
    const motion = mockAnimations({ animated: isDialog });
    const user = userEvent.setup();
    render(
      <Dialog>
        <Dialog.Trigger>
          <button type="button">Open settings</button>
        </Dialog.Trigger>
        <Dialog.Content title="Settings">
          <Dialog>
            <Dialog.Trigger>
              <button type="button">Reset</button>
            </Dialog.Trigger>
            <Dialog.Content title="Reset settings?">
              <button type="button">Confirm reset</button>
            </Dialog.Content>
          </Dialog>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('Open settings'));
    await finish(motion);
    await user.click(button('Reset'));
    await finish(motion);
    const lower = screen.getByRole('dialog', { name: 'Settings' });
    const upper = screen.getByRole('dialog', { name: 'Reset settings?' });
    const upperBackdrop = backdropOf(upper);
    expect(upperBackdrop).toHaveAttribute('data-appearance', 'transparent');
    expect(backdropOf(lower)).toHaveAttribute('data-appearance', 'dimmed');

    await user.keyboard('{Escape}');
    expect(upper).toHaveAttribute('data-presence', 'exiting');
    expect(upperBackdrop).toHaveAttribute('data-presence', 'exiting');
    // The page stays dimmed once: the exiting backdrop does not turn dimmed over the lower one's.
    expect(upperBackdrop).toHaveAttribute('data-appearance', 'transparent');
    expect(backdropOf(lower)).toHaveAttribute('data-appearance', 'dimmed');

    await finish(motion);
    expect(upper.isConnected).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBe(lower);
  });

  it('keeps the titles’ end padding while it exits (risk 8)', async () => {
    const resizeObserver = installResizeObserverMock();
    try {
      const motion = mockAnimations({ animated: isDialog });
      const user = userEvent.setup();
      render(<OrderDialog />);
      await user.click(button('Open order'));
      await finish(motion);
      const area = titleActions()!;
      mockRect(area, { width: 40, height: 32 });
      const padding = () => surface()!.style.getPropertyValue('--wave-dialog-title-end-padding');
      resizeObserver.trigger(area);
      expect(padding()).toBe('48px');

      await user.keyboard('{Escape}');
      expect(surface()).toHaveAttribute('data-presence', 'exiting');
      expect(padding()).toBe('48px');
      resizeObserver.trigger(area);
      expect(padding()).toBe('48px');

      await finish(motion);
      expect(surface()).toBeNull();
    } finally {
      resizeObserver.restore();
    }
  });
});
