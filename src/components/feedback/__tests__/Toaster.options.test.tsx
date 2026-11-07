import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Toast, Toaster, useToastController } from '../Toast';
import type {
  ToastController,
  ToasterOffset,
  ToasterProps,
  ToastAnnouncement,
  ToastDismissReason,
  ToastPosition,
  ToastStatus,
  ToastStatusChangeDetails,
  ToastUpdate,
} from '../Toast';
import { createToaster } from '../../../lib/toaster';
import { useDismiss } from '../../../hooks/useDismiss';
import { Portal } from '../../portal/Portal';
import { toasterClassNames } from '../../../lib/classNames';
import { toastMotion } from '../../../lib/motion';
import { expectNoA11yViolations, motionClasses, renderWithProviders } from '../../../test-utils';
import { advance, getLiveRegion, getToasts, getViewport, renderToaster } from './toasterHarness';

const texts = () => getToasts().map((toast) => toast.textContent);

describe('Toaster — offset (toaster-3)', () => {
  it('keeps the 16px classes and sets no style without an offset', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'One', timeout: 0 });
    const viewport = getViewport();
    expect(viewport).toHaveClass('wave:bottom-4', 'wave:end-4');
    expect(viewport.getAttribute('style')).toBeNull();
  });

  it.each([
    ['bottom-end', { bottom: '24px', insetInlineEnd: '8px' }],
    ['bottom-start', { bottom: '24px', insetInlineStart: '8px' }],
    ['top-end', { top: '24px', insetInlineEnd: '8px' }],
    ['top-start', { top: '24px', insetInlineStart: '8px' }],
    ['top-right', { top: '24px', right: '8px' }],
    ['top-left', { top: '24px', left: '8px' }],
    ['bottom-right', { bottom: '24px', right: '8px' }],
    ['bottom-left', { bottom: '24px', left: '8px' }],
  ] as const)(
    'moves %s toasts to the offset over the classes',
    (position, expected: Record<string, string>) => {
      const { dispatch } = renderToaster({ position, offset: { horizontal: 8, vertical: 24 } });
      dispatch({ title: 'One', timeout: 0 });
      const style = getViewport().style as unknown as Record<string, string>;
      for (const [property, value] of Object.entries(expected)) expect(style[property]).toBe(value);
    },
  );

  it('takes one number for both axes, and sets only the axis it is given', () => {
    const { setProps, dispatch } = renderToaster({ offset: 4 });
    dispatch({ title: 'One', timeout: 0 });
    expect(getViewport().style.bottom).toBe('4px');
    expect(getViewport().style.insetInlineEnd).toBe('4px');
    setProps({ offset: { vertical: 40 } });
    expect(getViewport().style.bottom).toBe('40px');
    expect(getViewport().style.insetInlineEnd).toBe('');
    setProps({ offset: { horizontal: 40 } });
    expect(getViewport().style.bottom).toBe('');
    expect(getViewport().style.insetInlineEnd).toBe('40px');
  });

  it('allows 0 and ignores a value that is not a finite number of 0 or more', () => {
    const { setProps } = renderToaster({ offset: { horizontal: 0, vertical: 0 } });
    expect(getViewport().style.bottom).toBe('0px');
    expect(getViewport().style.insetInlineEnd).toBe('0px');
    setProps({ offset: { horizontal: -4, vertical: Number.NaN } });
    expect(getViewport().style.length).toBe(0);
    setProps({ offset: { horizontal: Infinity, vertical: '8' as unknown as number } });
    expect(getViewport().style.length).toBe(0);
    setProps({ offset: undefined });
    expect(getViewport().style.length).toBe(0);
  });

  it('lets a style of yours win, and keeps the panel room after it', () => {
    renderToaster({ offset: 8, style: { bottom: 100 } });
    expect(getViewport().style.bottom).toBe('100px');
    expect(getViewport().style.insetInlineEnd).toBe('8px');
  });

  it('ignores the horizontal distance of a centered position', () => {
    renderToaster({ position: 'bottom', offset: { horizontal: 50, vertical: 12 } });
    expect(getViewport().style.bottom).toBe('12px');
    expect(getViewport().style.insetInlineStart).toBe('');
    expect(getViewport().style.insetInlineEnd).toBe('');
    expect(getViewport().style.left).toBe('');
  });

  it('types the offset', () => {
    expectTypeOf<ToasterProps['offset']>().toEqualTypeOf<ToasterOffset | undefined>();
    expectTypeOf<ToasterOffset>().toEqualTypeOf<
      number | { horizontal?: number; vertical?: number }
    >();
  });
});

describe('Toaster — centered positions and per-toast positions (toaster-4)', () => {
  it.each([
    [
      'top',
      ['wave:top-4', 'wave:inset-x-0', 'wave:mx-auto', 'wave:mt-(--wave-toaster-offset-block)'],
    ],
    [
      'bottom',
      ['wave:bottom-4', 'wave:inset-x-0', 'wave:mx-auto', 'wave:mb-(--wave-toaster-offset-block)'],
    ],
  ] as const)(
    'centers %s toasts with auto margins and renders data-position',
    (position, classes) => {
      renderToaster({ position });
      const viewport = getViewport();
      expect(viewport).toHaveAttribute('data-position', position);
      expect(viewport).toHaveClass(...classes);
      // No inline margin variable: a panel at a side never moves a centered stack.
      expect(viewport.className).not.toContain('--wave-toaster-offset)');
    },
  );

  it('slides centered toasts from their edge', () => {
    const top = renderToaster({ position: 'top' });
    top.dispatch({ title: 'Top', timeout: 0 });
    expect(getToasts()[0]).toHaveClass(...motionClasses(toastMotion.top));
    top.unmount();
    const bottom = renderToaster({ position: 'bottom' });
    bottom.dispatch({ title: 'Bottom', timeout: 0 });
    expect(getToasts()[0]).toHaveClass(...motionClasses(toastMotion.bottom));
  });

  it('reads an unknown position (untyped code) as bottom-end', () => {
    renderToaster({ position: 'middle' as ToastPosition });
    expect(getViewport()).toHaveAttribute('data-position', 'bottom-end');
  });

  describe('per-toast position', () => {
    it('shows a toast in the Toaster position without one, and in a stack of its own with one', () => {
      const { dispatch } = renderToaster({ position: 'bottom-end' });
      dispatch({ title: 'Here', timeout: 0 });
      dispatch({ title: 'There', timeout: 0, position: 'top-start' });
      const viewport = getViewport();
      const stacks = viewport.querySelectorAll<HTMLElement>(`.${toasterClassNames.stack}`);
      expect(stacks).toHaveLength(1);
      const [stack] = stacks;
      expect(stack).toHaveAttribute('data-position', 'top-start');
      expect(stack).toHaveClass(
        'wave:fixed',
        'wave:flex',
        'wave:flex-col',
        'wave:gap-2',
        'wave:top-4',
        'wave:start-4',
      );
      expect(stack.textContent).toContain('There');
      expect(stack.textContent).not.toContain('Here');
      // The toast of the Toaster's position is a direct child of the region.
      expect(getToasts()[0].parentElement).toBe(viewport);
      expect(getToasts()[1].parentElement).toBe(stack);
    });

    it('stacks the toasts of one other position together and each other position apart', () => {
      const { dispatch } = renderToaster();
      dispatch({ title: 'A', timeout: 0, position: 'top' });
      dispatch({ title: 'B', timeout: 0, position: 'top' });
      dispatch({ title: 'C', timeout: 0, position: 'bottom-start' });
      const stacks = getViewport().querySelectorAll<HTMLElement>(`.${toasterClassNames.stack}`);
      expect(Array.from(stacks, (stack) => stack.getAttribute('data-position'))).toEqual([
        'top',
        'bottom-start',
      ]);
      expect(within(stacks[0]).getAllByRole('group')).toHaveLength(2);
      expect(within(stacks[1]).getAllByRole('group')).toHaveLength(1);
      expect(stacks[0]).toHaveClass('wave:inset-x-0', 'wave:mx-auto');
    });

    it('removes the stack with its last toast', () => {
      const { dispatch, dismiss } = renderToaster();
      const id = dispatch({ title: 'There', timeout: 0, position: 'top-end' });
      expect(getViewport().querySelector(`.${toasterClassNames.stack}`)).not.toBeNull();
      dismiss(id);
      expect(getViewport().querySelector(`.${toasterClassNames.stack}`)).toBeNull();
    });

    it('does not take the room an open panel needs: the stack keeps its corner', () => {
      const { dispatch } = renderToaster();
      dispatch({ title: 'There', timeout: 0, position: 'top-start' });
      const stack = getViewport().querySelector<HTMLElement>(`.${toasterClassNames.stack}`)!;
      expect(stack.style.getPropertyValue('--wave-toaster-offset')).toBe('0px');
      expect(stack.style.getPropertyValue('--wave-toaster-offset-block')).toBe('0px');
    });

    it('gives a stack the custom offset of its own edges', () => {
      const { dispatch } = renderToaster({ offset: { horizontal: 30, vertical: 10 } });
      dispatch({ title: 'There', timeout: 0, position: 'top-start' });
      const stack = getViewport().querySelector<HTMLElement>(`.${toasterClassNames.stack}`)!;
      expect(stack.style.top).toBe('10px');
      expect(stack.style.insetInlineStart).toBe('30px');
    });

    it('slides a stacked toast from the edge it sits on', () => {
      const { dispatch } = renderToaster({ position: 'bottom-end' });
      dispatch({ title: 'Top', timeout: 0, position: 'top-end' });
      dispatch({ title: 'Bottom', timeout: 0 });
      const [bottom, top] = getToasts();
      expect(bottom).toHaveClass(...motionClasses(toastMotion.bottom));
      expect(top).toHaveClass(...motionClasses(toastMotion.top));
    });

    it('takes the position through the content form too, and reads an unknown one as the default', () => {
      const { dispatchContent, dispatch } = renderToaster();
      dispatchContent(<Toast title="Content" />, { timeout: 0, position: 'top-end' });
      dispatch({ title: 'Odd', timeout: 0, position: 'nowhere' as ToastPosition });
      const stacks = getViewport().querySelectorAll(`.${toasterClassNames.stack}`);
      expect(stacks).toHaveLength(1);
      // The toast with the unknown position is in the region, the content toast in the stack.
      expect(getToasts()[0].parentElement).toBe(getViewport());
      expect(getToasts()[1].parentElement).toBe(stacks[0]);
    });

    it('keeps the region shared: the live regions, Escape, the toast part and the focus fallback', () => {
      const { dispatch } = renderToaster({
        slotProps: { toast: { 'data-custom': 'yes' } as never },
      });
      dispatch({ title: 'Here', timeout: 0 });
      dispatch({ title: 'There', timeout: 0, position: 'top-start' });
      expect(getViewport().querySelectorAll('[aria-live]')).toHaveLength(2);
      expect(getLiveRegion('polite').textContent).toBe('Info: HereInfo: There');
      for (const toast of getToasts()) expect(toast).toHaveAttribute('data-custom', 'yes');
      // Dismissing the focused toast moves focus to the next one, across the stacks.
      const [first, second] = getToasts();
      act(() => first.focus());
      fireEvent.keyDown(first, { key: 'Delete' });
      expect(texts()).toEqual(['Info: There']);
      expect(second).toHaveFocus();
      fireEvent.keyDown(second, { key: 'Escape' });
      expect(getToasts()).toHaveLength(0);
    });

    it('has no accessibility violations with toasts in two places', async () => {
      const { dispatch } = renderToaster();
      dispatch({ title: 'Here', timeout: 0 });
      dispatch({ title: 'There', timeout: 0, position: 'top-start' });
      await expectNoA11yViolations();
    });
  });
});

describe('Toaster — inline (toaster-6)', () => {
  it('renders the region in the tree instead of a portal', () => {
    const { container, dispatch } = renderToaster({ inline: true });
    dispatch({ title: 'Inline', timeout: 0 });
    const viewport = getViewport();
    expect(container.contains(viewport)).toBe(true);
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
    expect(viewport.style.zIndex).toBe('var(--wave-z-toast, 1100)');
    expect(viewport).toHaveClass('wave:fixed');
    expect(getLiveRegion('polite').textContent).toBe('Info: Inline');
  });

  it('is portaled by default, with the toast layer on the portal', () => {
    const { container, dispatch } = renderToaster();
    dispatch({ title: 'Portaled', timeout: 0 });
    expect(container.contains(getViewport())).toBe(false);
    expect(getViewport().closest('[data-wave-portal]')).toHaveAttribute('data-layer', 'toast');
    expect(getViewport().style.zIndex).toBe('');
  });

  it('lets a style of yours replace the z-index and works with the other options', () => {
    renderToaster({ inline: true, style: { zIndex: 5 }, offset: 8, position: 'top' });
    expect(getViewport().style.zIndex).toBe('5');
    expect(getViewport().style.top).toBe('8px');
  });

  it('has no accessibility violations', async () => {
    const { dispatch } = renderToaster({ inline: true });
    dispatch({ title: 'Inline', timeout: 0 });
    await expectNoA11yViolations();
  });
});

describe('Toaster — politeness and announce (toaster-7)', () => {
  it('announces per the toast politeness, whatever its status', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Urgent info', timeout: 0, politeness: 'assertive' });
    dispatch({ title: 'Calm error', status: 'error', timeout: 0, politeness: 'polite' });
    expect(getLiveRegion('assertive').textContent).toBe('Info: Urgent info');
    expect(getLiveRegion('polite').textContent).toBe('Error: Calm error');
  });

  it('keeps the status default without a politeness, and reads an unknown one that way', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Fine', timeout: 0 });
    dispatch({ title: 'Broken', status: 'error', timeout: 0, politeness: 'loud' as 'polite' });
    expect(getLiveRegion('polite').textContent).toBe('Info: Fine');
    expect(getLiveRegion('assertive').textContent).toBe('Error: Broken');
  });

  it('takes the politeness through the content form', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="success">
        <Toast.Title>Saved</Toast.Title>
      </Toast>,
      { timeout: 0, politeness: 'assertive' },
    );
    expect(getLiveRegion('assertive').textContent).toBe('Success: Saved');
  });

  describe('the announce function', () => {
    it('is called once per toast with the text and politeness, and the live regions stay empty', () => {
      const announce = vi.fn<(announcement: ToastAnnouncement) => void>();
      const { dispatch } = renderToaster({ announce });
      const id = dispatch({ title: 'Saved', body: 'All changes', status: 'success', timeout: 0 });
      expect(announce).toHaveBeenCalledExactlyOnceWith({
        toastId: id,
        message: 'Success: Saved All changes',
        politeness: 'polite',
      });
      expect(getLiveRegion('polite').textContent).toBe('');
      expect(getLiveRegion('assertive').textContent).toBe('');
      // The regions stay mounted, ready for a Toaster without the prop.
      expect(getLiveRegion('polite')).toHaveAttribute('role', 'status');
    });

    it('passes assertive for an error and the toast politeness when it has one', () => {
      const announce = vi.fn<(announcement: ToastAnnouncement) => void>();
      const { dispatch } = renderToaster({ announce });
      dispatch({ title: 'Failed', status: 'error', timeout: 0 });
      dispatch({ title: 'Heads up', timeout: 0, politeness: 'assertive' });
      expect(announce.mock.calls.map(([call]) => [call.message, call.politeness])).toEqual([
        ['Error: Failed', 'assertive'],
        ['Info: Heads up', 'assertive'],
      ]);
    });

    it('is called again for a toast dispatched again, and uses the announcement text', () => {
      const announce = vi.fn<(announcement: ToastAnnouncement) => void>();
      const { dispatch, dispatchContent } = renderToaster({ announce });
      dispatch({ title: 'Same', toastId: 'a', timeout: 0 });
      dispatch({ title: 'Same', toastId: 'a', timeout: 0 });
      expect(announce).toHaveBeenCalledTimes(2);
      dispatchContent(<Toast title="Visible text" />, { announcement: 'Spoken text', timeout: 0 });
      expect(announce.mock.calls[2][0].message).toBe('Info: Spoken text');
    });

    it('is not called for a toast that waits beyond the limit, until it appears', () => {
      const announce = vi.fn<(announcement: ToastAnnouncement) => void>();
      const { dispatch, dismiss } = renderToaster({ announce, limit: 1 });
      const first = dispatch({ title: 'First', timeout: 0 });
      dispatch({ title: 'Second', timeout: 0 });
      expect(announce).toHaveBeenCalledTimes(1);
      dismiss(first);
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce.mock.calls[1][0].message).toBe('Info: Second');
    });

    it('is called once under StrictMode', () => {
      const announce = vi.fn<(announcement: ToastAnnouncement) => void>();
      const controllerRef = React.createRef<ToastController>();
      render(
        <React.StrictMode>
          <Toaster announce={announce}>
            <Dispatcher
              onReady={(controller) => {
                controllerRef.current = controller;
              }}
            />
          </Toaster>
        </React.StrictMode>,
      );
      act(() => {
        controllerRef.current!.dispatchToast({ title: 'Once', timeout: 0 });
      });
      expect(announce).toHaveBeenCalledTimes(1);
    });

    it('is typed', () => {
      expectTypeOf<ToasterProps['announce']>().toEqualTypeOf<
        ((announcement: ToastAnnouncement) => void) | undefined
      >();
      expectTypeOf<ToastAnnouncement['politeness']>().toEqualTypeOf<'polite' | 'assertive'>();
    });
  });
});

/** Hands the controller to the test from inside a Toaster (the public hook). */
function Dispatcher({ onReady }: { onReady: (controller: ToastController) => void }) {
  const controller = useToastController();
  React.useEffect(() => onReady(controller), [controller, onReady]);
  return null;
}

describe('Toaster — priority (toaster-8)', () => {
  it('shows the waiting toast with the highest priority first, the earliest among equals', () => {
    const { dispatch, dismiss } = renderToaster({ limit: 1 });
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Low', timeout: 0 });
    dispatch({ title: 'Urgent', timeout: 0, priority: 5 });
    dispatch({ title: 'Also low', timeout: 0 });
    dispatch({ title: 'Important', timeout: 0, priority: 2 });
    expect(texts()).toEqual(['Info: First']);
    dismiss(first);
    expect(texts()).toEqual(['Info: Urgent']);
  });

  it('promotes in order of priority as places free up', () => {
    const { dispatch, dismissAll } = renderToaster({ limit: 2 });
    dispatch({ title: 'A', timeout: 0 });
    dispatch({ title: 'B', timeout: 0 });
    dispatch({ title: 'C', timeout: 0, priority: 1 });
    dispatch({ title: 'D', timeout: 0, priority: 3 });
    dispatch({ title: 'E', timeout: 0, priority: 2 });
    expect(texts()).toEqual(['Info: A', 'Info: B']);
    dismissAll();
    // dismissAllToasts removes the waiting toasts too.
    expect(getToasts()).toHaveLength(0);
  });

  it('shows two promoted toasts in the order of the list, the highest priority taking the first place', () => {
    const { dispatch, dismiss } = renderToaster({ limit: 2 });
    const a = dispatch({ title: 'A', timeout: 0 });
    const b = dispatch({ title: 'B', timeout: 0 });
    dispatch({ title: 'C', timeout: 0, priority: 1 });
    dispatch({ title: 'D', timeout: 0, priority: 3 });
    dispatch({ title: 'E', timeout: 0, priority: 2 });
    dismiss(a);
    dismiss(b);
    // D and E are the two highest; shown toasts keep the order of their dispatch.
    expect(texts().sort()).toEqual(['Info: D', 'Info: E']);
  });

  it('treats a priority that is not a finite number as 0, and lets an update change it', () => {
    const { dispatch, dismiss, controller } = renderToaster({ limit: 1 });
    const first = dispatch({ title: 'First', timeout: 0 });
    const second = dispatch({ title: 'Second', timeout: 0, priority: Number.NaN });
    dispatch({ title: 'Third', timeout: 0 });
    act(() => controller().updateToast({ toastId: second, priority: -1 }));
    dismiss(first);
    expect(texts()).toEqual(['Info: Third']);
  });

  it('never moves a toast that is shown, whatever the priority of a newer one', () => {
    const { dispatch } = renderToaster({ limit: 1 });
    dispatch({ title: 'Shown', timeout: 0 });
    dispatch({ title: 'Urgent', timeout: 0, priority: 100 });
    expect(texts()).toEqual(['Info: Shown']);
  });
});

describe('Toaster — pause options (toaster-9)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses on hover by default', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Hovered' });
    fireEvent.pointerOver(getToasts()[0]);
    advance(20_000);
    expect(getToasts()).toHaveLength(1);
  });

  it('lets a toast time out while hovered with pauseOnHover: false', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Runs on', pauseOnHover: false });
    dispatch({ title: 'Waits', timeout: 8000 });
    fireEvent.pointerOver(getToasts()[0]);
    advance(5000);
    expect(texts()).toEqual(['Info: Waits']);
    // The one that waited was paused from the start, so all 8000 ms are left when the pointer goes.
    fireEvent.pointerOut(getToasts()[0], { relatedTarget: document.body });
    advance(7999);
    expect(getToasts()).toHaveLength(1);
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('still pauses on focus when it does not pause on hover', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Focused', pauseOnHover: false });
    const button = within(getToasts()[0]).getByRole('button', { name: 'Dismiss' });
    act(() => button.focus());
    advance(20_000);
    expect(getToasts()).toHaveLength(1);
    act(() => button.blur());
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('pauses in a background window by default, and keeps running with pauseOnWindowBlur: false', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Runs on', pauseOnWindowBlur: false });
    dispatch({ title: 'Waits' });
    act(() => {
      window.dispatchEvent(new FocusEvent('blur'));
    });
    advance(5000);
    expect(texts()).toEqual(['Info: Waits']);
    advance(20_000);
    expect(texts()).toEqual(['Info: Waits']);
    act(() => {
      window.dispatchEvent(new FocusEvent('focus'));
    });
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('takes the options through the content form', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<Toast title="Runs on" />, { pauseOnHover: false });
    fireEvent.pointerOver(getToasts()[0]);
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('lets an update change the option, which restarts the timer', () => {
    const { dispatch, controller } = renderToaster();
    const id = dispatch({ title: 'Updated' });
    fireEvent.pointerOver(getToasts()[0]);
    advance(10_000);
    expect(getToasts()).toHaveLength(1);
    act(() => controller().updateToast({ toastId: id, pauseOnHover: false }));
    advance(4999);
    expect(getToasts()).toHaveLength(1);
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  describe('showDismissButton', () => {
    it('is on in a Toaster by default, and off with false, while the keyboard still dismisses', () => {
      vi.useRealTimers();
      const { dispatch } = renderToaster();
      dispatch({ title: 'With', timeout: 0 });
      dispatch({ title: 'Without', timeout: 0, showDismissButton: false });
      const [withButton, withoutButton] = getToasts();
      expect(within(withButton).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
      expect(within(withoutButton).queryByRole('button')).toBeNull();
      fireEvent.keyDown(withoutButton, { key: 'Delete' });
      expect(texts()).toEqual(['Info: With']);
    });

    it('hides the button of a Toast element too, and keeps a Toast.Close working', () => {
      vi.useRealTimers();
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <Toast showDismissButton={false}>
          <Toast.Title>Task</Toast.Title>
          <Toast.Footer>
            <Toast.Close>
              <button type="button">Cancel</button>
            </Toast.Close>
          </Toast.Footer>
        </Toast>,
        { timeout: 0 },
      );
      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(getToasts()).toHaveLength(0);
    });
  });
});

describe('Toaster — updateToast (toastctl-2)', () => {
  it('merges the options over the toast: what is left out keeps its value', () => {
    const { dispatch, controller } = renderToaster();
    const id = dispatch({ title: 'Uploading', body: 'photo.png', status: 'info', timeout: 0 });
    act(() => controller().updateToast({ toastId: id, title: 'Uploaded', status: 'success' }));
    expect(texts()).toEqual(['Success: Uploadedphoto.png']);
  });

  it('replaces the content of a toast dispatched with content, and merges its options', () => {
    const { dispatchContent, controller } = renderToaster();
    const id = dispatchContent(
      <Toast>
        <Toast.Title>Step 1</Toast.Title>
      </Toast>,
      { timeout: 0, announcement: 'Working' },
    );
    act(() =>
      controller().updateToast({
        toastId: id,
        content: (
          <Toast status="success">
            <Toast.Title>Step 2</Toast.Title>
          </Toast>
        ),
      }),
    );
    expect(texts()).toEqual(['Success: Step 2']);
    // The announcement option of the dispatch is kept.
    expect(getLiveRegion('polite').textContent).toBe('Success: Working');
  });

  it('keeps the place of the toast, its container and its timer', () => {
    vi.useFakeTimers();
    try {
      const { dispatch, controller } = renderToaster();
      dispatch({ title: 'Other', timeout: 0 });
      const id = dispatch({ title: 'Mine' });
      const container = getToasts()[1];
      advance(3000);
      act(() => controller().updateToast({ toastId: id, title: 'Renamed' }));
      expect(getToasts()[1]).toBe(container);
      expect(texts()).toEqual(['Info: Other', 'Info: Renamed']);
      // 3000 ms of its 5000 have passed, and an update that passes no timeout does not restart them.
      advance(1999);
      expect(getToasts()).toHaveLength(2);
      advance(1);
      expect(texts()).toEqual(['Info: Other']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts the timer when the update passes a timeout', () => {
    vi.useFakeTimers();
    try {
      const { dispatch, controller } = renderToaster();
      const id = dispatch({ title: 'Mine' });
      advance(3000);
      act(() => controller().updateToast({ toastId: id, timeout: 10_000 }));
      advance(9999);
      expect(getToasts()).toHaveLength(1);
      advance(1);
      expect(getToasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces again only when the text that is read changes', () => {
    const announce = vi.fn<(announcement: ToastAnnouncement) => void>();
    const { dispatch, controller } = renderToaster({ announce });
    const id = dispatch({ title: 'Syncing', body: '10%', timeout: 0 });
    expect(announce).toHaveBeenCalledTimes(1);
    act(() => controller().updateToast({ toastId: id, timeout: 0 }));
    expect(announce).toHaveBeenCalledTimes(1);
    act(() => controller().updateToast({ toastId: id, body: '20%' }));
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce.mock.calls[1][0].message).toBe('Info: Syncing 20%');
    // A fixed announcement keeps what is read while the visible text changes.
    const progress = vi.fn<(announcement: ToastAnnouncement) => void>();
    const second = renderToaster({ announce: progress });
    const fixed = second.dispatchContent(<Toast title="0%" />, {
      announcement: 'Uploading',
      timeout: 0,
    });
    act(() => second.controller().updateToast({ toastId: fixed, content: <Toast title="50%" /> }));
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('reads the new text from the live region when it changes', () => {
    const { dispatch, controller } = renderToaster();
    const id = dispatch({ title: 'One', timeout: 0 });
    expect(getLiveRegion('polite').textContent).toBe('Info: One');
    act(() => controller().updateToast({ toastId: id, title: 'Two' }));
    expect(getLiveRegion('polite').textContent).toBe('Info: Two');
  });

  it('updates a toast that waits beyond the limit and shows it updated', () => {
    const { dispatch, dismiss, controller } = renderToaster({ limit: 1 });
    const first = dispatch({ title: 'First', timeout: 0 });
    const second = dispatch({ title: 'Second', timeout: 0 });
    act(() => controller().updateToast({ toastId: second, title: 'Second, updated' }));
    dismiss(first);
    expect(texts()).toEqual(['Info: Second, updated']);
  });

  it('ignores an unknown id and a dismissed toast, and updates nothing in an untyped call', () => {
    const { dispatch, dismiss, controller } = renderToaster();
    const id = dispatch({ title: 'Mine', timeout: 0 });
    act(() => controller().updateToast({ toastId: 'nope', title: 'Ghost' }));
    expect(texts()).toEqual(['Info: Mine']);
    dismiss(id);
    act(() => controller().updateToast({ toastId: id, title: 'Revived?' }));
    expect(getToasts()).toHaveLength(0);
    act(() => controller().updateToast(undefined as unknown as ToastUpdate));
    act(() => controller().updateToast({} as unknown as ToastUpdate));
    expect(getToasts()).toHaveLength(0);
  });

  it('warns once when content is given for a text toast, and when text is given for a content toast', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { dispatch, dispatchContent, controller } = renderToaster();
    const text = dispatch({ title: 'Text', timeout: 0 });
    const content = dispatchContent(<Toast title="Content" />, { timeout: 0 });
    act(() => controller().updateToast({ toastId: text, content: <p>Ignored</p> }));
    act(() => controller().updateToast({ toastId: text, content: <p>Ignored</p> }));
    act(() => controller().updateToast({ toastId: content, title: 'Ignored' }));
    expect(texts()).toEqual(['Info: Text', 'Info: Content']);
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
      '[WaveUI] Toaster: `updateToast` was given `content` for a toast built from text options; it is ignored. Update `title` and `body` instead.',
      '[WaveUI] Toaster: `updateToast` was given `title` or `body` for a toast dispatched with content; they are ignored. Update `content` instead.',
    ]);
    warn.mockRestore();
  });

  it('is typed: a partial of the options with the id, and content', () => {
    expectTypeOf<ToastUpdate>().toHaveProperty('toastId').toEqualTypeOf<string>();
    expectTypeOf<ToastUpdate['title']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ToastUpdate['content']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<ToastController['updateToast']>().toEqualTypeOf<(update: ToastUpdate) => void>();
    // @ts-expect-error -- the id is required
    const missing: ToastUpdate = { title: 'No id' };
    void missing;
  });
});

describe('Toaster — pauseToast and playToast (toastctl-3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the countdown of a toast until it is played, keeping the time that was left', () => {
    const { dispatch, controller } = renderToaster();
    const id = dispatch({ title: 'Held' });
    advance(2000);
    act(() => controller().pauseToast(id));
    advance(60_000);
    expect(getToasts()).toHaveLength(1);
    act(() => controller().playToast(id));
    advance(2999);
    expect(getToasts()).toHaveLength(1);
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('pauses only its own toast', () => {
    const { dispatch, controller } = renderToaster();
    const held = dispatch({ title: 'Held' });
    dispatch({ title: 'Free' });
    act(() => controller().pauseToast(held));
    advance(5000);
    expect(texts()).toEqual(['Info: Held']);
  });

  it('stays paused when the pointer or focus leave the region, and when the window returns', () => {
    const { dispatch, controller } = renderToaster();
    const id = dispatch({ title: 'Held' });
    act(() => controller().pauseToast(id));
    fireEvent.pointerOver(getToasts()[0]);
    fireEvent.pointerOut(getToasts()[0], { relatedTarget: document.body });
    act(() => {
      window.dispatchEvent(new FocusEvent('blur'));
      window.dispatchEvent(new FocusEvent('focus'));
    });
    advance(30_000);
    expect(getToasts()).toHaveLength(1);
  });

  it('pauses a toast before its timer has started, and a pause on an id that is not shown waits for it', () => {
    const { dispatch, controller } = renderToaster();
    act(() => controller().pauseToast('later'));
    dispatch({ title: 'Later', toastId: 'later' });
    advance(20_000);
    expect(getToasts()).toHaveLength(1);
    act(() => controller().playToast('later'));
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('forgets the pause when the toast is dismissed', () => {
    const { dispatch, dismiss, controller } = renderToaster();
    const id = dispatch({ title: 'Held', toastId: 'held' });
    act(() => controller().pauseToast(id));
    dismiss(id);
    dispatch({ title: 'Again', toastId: 'held' });
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('ignores a play for a toast that was never paused, and unknown ids', () => {
    const { dispatch, controller } = renderToaster();
    dispatch({ title: 'Plain' });
    act(() => controller().playToast('nope'));
    act(() => controller().pauseToast('nope'));
    act(() => controller().playToast('nope'));
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });
});

describe('Toaster — onStatusChange (toastctl-4)', () => {
  type Call = [ToastStatus, ToastStatusChangeDetails];
  const record = () => {
    const calls: Call[] = [];
    const onStatusChange = vi.fn((status: ToastStatus, details: ToastStatusChangeDetails) => {
      calls.push([status, details]);
    });
    return { calls, onStatusChange };
  };
  const statuses = (calls: Call[]) => calls.map(([status]) => status);

  it('reports visible, then dismissed with its reason, then unmounted', () => {
    const { calls, onStatusChange } = record();
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Life', toastId: 'life', timeout: 0, onStatusChange });
    expect(calls).toEqual([['visible', { toastId: 'life', reason: undefined }]]);
    dismiss(id);
    expect(calls).toEqual([
      ['visible', { toastId: 'life', reason: undefined }],
      ['dismissed', { toastId: 'life', reason: 'controller' }],
      ['unmounted', { toastId: 'life', reason: undefined }],
    ]);
  });

  it('reports queued for a toast that waits beyond the limit, then visible', () => {
    const { calls, onStatusChange } = record();
    const { dispatch, dismiss } = renderToaster({ limit: 1 });
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', toastId: 'second', timeout: 0, onStatusChange });
    expect(statuses(calls)).toEqual(['queued']);
    dismiss(first);
    expect(statuses(calls)).toEqual(['queued', 'visible']);
  });

  it('reports a waiting toast that is dismissed as dismissed and unmounted', () => {
    const { calls, onStatusChange } = record();
    const { dispatch, dismiss } = renderToaster({ limit: 1 });
    dispatch({ title: 'First', timeout: 0 });
    const id = dispatch({ title: 'Second', toastId: 'second', timeout: 0, onStatusChange });
    dismiss(id);
    expect(calls).toEqual([
      ['queued', { toastId: 'second', reason: undefined }],
      ['dismissed', { toastId: 'second', reason: 'controller' }],
      ['unmounted', { toastId: 'second', reason: undefined }],
    ]);
  });

  describe('the reason of a dismissal', () => {
    const reasonOf = (calls: Call[]): ToastDismissReason | undefined =>
      calls.find(([status]) => status === 'dismissed')?.[1].reason;

    it('is timeout when the timer runs out', () => {
      vi.useFakeTimers();
      try {
        const { calls, onStatusChange } = record();
        const { dispatch } = renderToaster();
        dispatch({ title: 'Timed', onStatusChange });
        advance(5000);
        expect(reasonOf(calls)).toBe('timeout');
      } finally {
        vi.useRealTimers();
      }
    });

    it('is close for the Dismiss button and a Toast.Close', () => {
      const { calls, onStatusChange } = record();
      const { dispatch, dispatchContent } = renderToaster();
      dispatch({ title: 'Button', timeout: 0, onStatusChange });
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(reasonOf(calls)).toBe('close');
      const second = record();
      dispatchContent(
        <Toast>
          <Toast.Title>Close</Toast.Title>
          <Toast.Footer>
            <Toast.Close>
              <button type="button">Undo</button>
            </Toast.Close>
          </Toast.Footer>
        </Toast>,
        { timeout: 0, onStatusChange: second.onStatusChange },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(reasonOf(second.calls)).toBe('close');
    });

    it('is keyboard for Delete and Backspace, escape for Escape and controller for the controller', () => {
      const keyboard = record();
      const escape = record();
      const controller = record();
      const { dispatch, dismissAll } = renderToaster();
      dispatch({ title: 'Key', timeout: 0, onStatusChange: keyboard.onStatusChange });
      fireEvent.keyDown(getToasts()[0], { key: 'Backspace' });
      expect(reasonOf(keyboard.calls)).toBe('keyboard');
      dispatch({ title: 'Esc', timeout: 0, onStatusChange: escape.onStatusChange });
      fireEvent.keyDown(getToasts()[0], { key: 'Escape' });
      expect(reasonOf(escape.calls)).toBe('escape');
      dispatch({ title: 'All', timeout: 0, onStatusChange: controller.onStatusChange });
      dismissAll();
      expect(reasonOf(controller.calls)).toBe('controller');
    });
  });

  it('reports visible again when a toast that is exiting is revived by its id', () => {
    const { calls, onStatusChange } = record();
    const { dispatch, dismiss } = renderToaster();
    dispatch({ title: 'Back', toastId: 'back', timeout: 0, onStatusChange });
    dismiss('back');
    dispatch({ title: 'Back', toastId: 'back', timeout: 0, onStatusChange });
    expect(statuses(calls)).toEqual(['visible', 'dismissed', 'unmounted', 'visible']);
  });

  it('calls the handler of the latest dispatch, and reports a replaced toast once', () => {
    const first = record();
    const second = record();
    const { dispatch, dismiss } = renderToaster();
    dispatch({ title: 'One', toastId: 'a', timeout: 0, onStatusChange: first.onStatusChange });
    dispatch({ title: 'Two', toastId: 'a', timeout: 0, onStatusChange: second.onStatusChange });
    dismiss('a');
    expect(statuses(first.calls)).toEqual(['visible']);
    expect(statuses(second.calls)).toEqual(['dismissed', 'unmounted']);
  });

  it('reports each change once under StrictMode', () => {
    const { calls, onStatusChange } = record();
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster>
          <Dispatcher
            onReady={(controller) => {
              controllerRef.current = controller;
            }}
          />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current!.dispatchToast({
        title: 'Once',
        toastId: 'once',
        timeout: 0,
        onStatusChange,
      });
    });
    act(() => controllerRef.current!.dismissToast('once'));
    expect(statuses(calls)).toEqual(['visible', 'dismissed', 'unmounted']);
  });

  it('takes the callback through the content form and an update', () => {
    const { calls, onStatusChange } = record();
    const { dispatchContent, controller, dismiss } = renderToaster();
    const id = dispatchContent(<Toast title="Content" />, { timeout: 0 });
    act(() => controller().updateToast({ toastId: id, onStatusChange }));
    dismiss(id);
    expect(statuses(calls)).toEqual(['dismissed', 'unmounted']);
  });

  it('does not report for the unmount of the Toaster itself', () => {
    const { calls, onStatusChange } = record();
    const { dispatch, unmount } = renderToaster();
    dispatch({ title: 'Gone', timeout: 0, onStatusChange });
    unmount();
    expect(statuses(calls)).toEqual(['visible']);
  });

  it('is typed', () => {
    expectTypeOf<ToastStatus>().toEqualTypeOf<'queued' | 'visible' | 'dismissed' | 'unmounted'>();
    expectTypeOf<ToastDismissReason>().toEqualTypeOf<
      'timeout' | 'close' | 'keyboard' | 'escape' | 'controller'
    >();
    expectTypeOf<ToastStatusChangeDetails>().toEqualTypeOf<{
      toastId: string;
      reason: ToastDismissReason | undefined;
    }>();
  });
});

describe('createToaster handle — updateToast, pauseToast and playToast', () => {
  it('queues updates and pauses behind the dispatch they are for, in order', () => {
    vi.useFakeTimers();
    try {
      const handle = createToaster();
      const id = handle.dispatchToast({ title: 'Queued', timeout: 0 });
      handle.updateToast({ toastId: id, title: 'Queued, then updated' });
      handle.pauseToast(id);
      render(<Toaster toaster={handle} />);
      expect(texts()).toEqual(['Info: Queued, then updated']);
      act(() => handle.updateToast({ toastId: id, timeout: 5000 }));
      advance(30_000);
      expect(getToasts()).toHaveLength(1);
      act(() => handle.playToast(id));
      advance(5000);
      expect(getToasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets the updates that waited for a dispatch that is replaced, and for a dismissed one', () => {
    const handle = createToaster();
    const id = handle.dispatchToast({ title: 'Old', toastId: 'a', timeout: 0 });
    handle.updateToast({ toastId: id, title: 'Old, updated' });
    handle.dispatchToast({ title: 'New', toastId: 'a', timeout: 0 });
    const other = handle.dispatchToast({ title: 'Other', toastId: 'b', timeout: 0 });
    handle.updateToast({ toastId: other, title: 'Never shown' });
    handle.dismissToast(other);
    render(<Toaster toaster={handle} />);
    expect(texts()).toEqual(['Info: New']);
  });

  it('does nothing on the server and for an untyped update', () => {
    const handle = createToaster();
    handle.updateToast(undefined as unknown as ToastUpdate);
    handle.updateToast({ toastId: 3 as unknown as string });
    render(<Toaster toaster={handle} />);
    expect(getToasts()).toHaveLength(0);
  });
});

describe('Toaster — offsets during a drawer exit', () => {
  // jsdom has no layout: a stand-in panel reports a stubbed box (as in Toast.test.tsx).
  const END_EDGE = { left: 704, right: 1024, top: 0, bottom: 768 };

  /**
   * A stand-in Drawer: a modal layer while `open`, and its surface stays in the document with
   * `data-presence="exiting"` for as long as `mounted` says, as a Drawer's does during its exit.
   */
  function StandInDrawer({ open, mounted }: { open: boolean; mounted: boolean }) {
    const surfaceRef = React.useRef<HTMLElement | null>(null);
    const { layerId } = useDismiss({
      open,
      onDismiss: () => {},
      refs: [surfaceRef],
      kind: 'modal',
    });
    const attach = React.useCallback((el: HTMLDivElement | null) => {
      surfaceRef.current = el;
      if (el) {
        el.getBoundingClientRect = () =>
          ({
            ...END_EDGE,
            width: END_EDGE.right - END_EDGE.left,
            height: END_EDGE.bottom - END_EDGE.top,
            x: END_EDGE.left,
            y: END_EDGE.top,
            toJSON: () => ({}),
          }) as DOMRect;
      }
    }, []);
    if (!open && !mounted) return null;
    return (
      <Portal layerId={layerId}>
        <div
          ref={attach}
          role="dialog"
          aria-label="Filters"
          data-presence={open ? 'entered' : 'exiting'}
        >
          <button type="button">Apply</button>
        </div>
      </Portal>
    );
  }
  const offset = () => getViewport().style.getPropertyValue('--wave-toaster-offset');

  it('keeps the toasts beside the panel while it exits, and moves them back once it is gone', () => {
    const ui = (open: boolean, mounted: boolean) => (
      <Toaster>
        <StandInDrawer open={open} mounted={mounted} />
      </Toaster>
    );
    const { rerender } = render(ui(true, true));
    expect(offset()).toBe('320px');
    // The layer closes and the panel starts its exit: the toasts stay clear of it.
    rerender(ui(false, true));
    expect(offset()).toBe('320px');
    // A measure while it still exits changes nothing.
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(offset()).toBe('320px');
    // The exit ends: the panel unmounts, and the next measure moves the toasts back.
    rerender(ui(false, false));
    act(() => {
      document.dispatchEvent(new Event('animationend'));
    });
    expect(offset()).toBe('');
  });

  it('does not keep a panel that is no longer exiting', () => {
    const ui = (open: boolean, mounted: boolean) => (
      <Toaster>
        <StandInDrawer open={open} mounted={mounted} />
      </Toaster>
    );
    const { rerender } = render(ui(true, true));
    expect(offset()).toBe('320px');
    rerender(ui(false, true));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    // A kept-mounted, closed surface (no exit running) is not a panel.
    act(() => {
      dialog.setAttribute('data-presence', 'exited');
      window.dispatchEvent(new Event('resize'));
    });
    expect(offset()).toBe('');
    rerender(ui(false, false));
  });
});

describe('Toaster options with the provider', () => {
  it('renders a centered, offset, inline Toaster in an RTL provider without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(<Toaster position="top" offset={12} inline />, { dir: 'rtl' });
    expect(getViewport()).toHaveAttribute('data-position', 'top');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});
