import * as React from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Toast, Toaster, ToastBody, ToastClose, ToastFooter, ToastTitle } from '../Toast';
import type { ToastBodyProps, ToastController, ToastProps, ToastTitleProps } from '../Toast';
import { Button } from '../../button/Button';
import type { Slot } from '../../../lib/slot';
import {
  toastBodyClassNames,
  toastClassNames,
  toasterClassNames,
  toastFooterClassNames,
  toastTitleClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  mockAnimations,
  mockMatchMedia,
  openingTags,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
import {
  ControllerProbe,
  advance,
  getLiveRegion,
  getToasts,
  renderToaster,
} from './toasterHarness';

/** Renders a part inside a standalone Toast, the host its context needs. */
function ToastWrapper({ children }: { children: React.ReactNode }) {
  return <Toast>{children}</Toast>;
}

const unscanned = (part: 'Title' | 'Body' | 'Footer') =>
  `[WaveUI] Toast.${part} is not a direct child of Toast, so it renders inside the body that Toast makes for its children. Make it a direct child of Toast.`;

describe('Toast parts (P3-02, toast-2)', () => {
  describe('ToastTitle', () => {
    testSystemProps(ToastTitle, {
      expectedTag: 'div',
      displayName: 'ToastTitle',
      defaultProps: { children: 'Saved' },
      wrapper: ToastWrapper,
    });
  });

  describe('ToastBody', () => {
    testSystemProps(ToastBody, {
      expectedTag: 'div',
      displayName: 'ToastBody',
      defaultProps: { children: 'Your changes were saved.' },
      wrapper: ToastWrapper,
    });
  });

  describe('ToastFooter', () => {
    testSystemProps(ToastFooter, {
      expectedTag: 'div',
      displayName: 'ToastFooter',
      defaultProps: { children: <button type="button">Undo</button> },
      wrapper: ToastWrapper,
    });
  });

  testCompoundExposure(Toast, ['Title', 'Body', 'Footer', 'Close']);

  it('exports every part under its flat name (C-COMPOUND)', () => {
    expect(ToastTitle).toBe(Toast.Title);
    expect(ToastBody).toBe(Toast.Body);
    expect(ToastFooter).toBe(Toast.Footer);
    expect(ToastClose).toBe(Toast.Close);
  });

  it('renders the title row, the body with its subtitle and the footer in the content column', () => {
    render(
      <Toast status="success" data-testid="toast">
        <Toast.Title action={<a href="#details">Details</a>}>Backup complete</Toast.Title>
        <Toast.Body subtitle="2 minutes ago">All files were copied.</Toast.Body>
        <Toast.Footer>
          <button type="button">Open archive</button>
        </Toast.Footer>
      </Toast>,
    );
    const content = screen.getByTestId('toast').querySelector(`.${toastClassNames.content}`);
    const label = screen.getByText('Backup complete');
    const row = label.parentElement;
    expect(label).toHaveClass(toastTitleClassNames.label);
    expect(row).toHaveClass(toastTitleClassNames.root);
    expect(screen.getByRole('link', { name: 'Details' }).parentElement).toHaveClass(
      toastTitleClassNames.action,
    );
    const body = screen.getByText('All files were copied.');
    expect(body).toHaveClass(toastBodyClassNames.root);
    expect(within(body).getByText('2 minutes ago')).toHaveClass(toastBodyClassNames.subtitle);
    const footer = screen.getByRole('button', { name: 'Open archive' }).parentElement;
    expect(footer).toHaveClass(toastFooterClassNames.root);
    // After the visually hidden severity text, in the order given.
    expect(content?.firstElementChild).toHaveTextContent('Success:');
    expect(Array.from(content?.children ?? []).slice(1)).toEqual([row, body, footer]);
  });

  it('renders no action element for an action that renders nothing, and no empty subtitle', () => {
    render(
      <Toast>
        <Toast.Title action={false}>Saved</Toast.Title>
        <Toast.Body subtitle="">Done.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved').parentElement?.children).toHaveLength(1);
    expect(screen.getByText('Done.').children).toHaveLength(0);
  });

  it('renders the 0.5 title prop and plain children through the Title and Body parts', () => {
    render(<Toast title="Saved">Your changes were saved.</Toast>);
    expect(screen.getByText('Saved')).toHaveClass(toastTitleClassNames.label);
    expect(screen.getByText('Your changes were saved.')).toHaveClass(toastBodyClassNames.root);
  });

  it('renders the title prop as a Title next to Body and Footer parts', () => {
    render(
      <Toast title="Upload failed">
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Upload failed')).toHaveClass(toastTitleClassNames.label);
    expect(screen.getByText('The file is too large.')).toHaveClass(toastBodyClassNames.root);
  });

  it('finds parts inside a Fragment (no body around them, no warning)', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <Toast>
        <>
          <Toast.Title>Saved</Toast.Title>
          <Toast.Body>Done.</Toast.Body>
        </>
      </Toast>,
    );
    expect(screen.getByText('Saved').closest(`.${toastBodyClassNames.root}`)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('finds parts written in a Server Component (client references): the same markup', () => {
    const Title = asClientReference(Toast.Title);
    const Body = asClientReference(Toast.Body);
    const Footer = asClientReference(Toast.Footer);
    const plain = renderToString(
      <Toast>
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body>Done.</Toast.Body>
        <Toast.Footer>
          <button type="button">Undo</button>
        </Toast.Footer>
      </Toast>,
    );
    const lazy = renderToString(
      <Toast>
        <Title>Saved</Title>
        <Body>Done.</Body>
        <Footer>
          <button type="button">Undo</button>
        </Footer>
      </Toast>,
    );
    expect(lazy).toBe(plain);
  });

  it.each(['Title', 'Body', 'Footer'] as const)(
    'warns once when Toast.%s is not a direct child: it renders inside the body',
    (part) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function AppPart() {
        if (part === 'Title') return <Toast.Title>Saved</Toast.Title>;
        if (part === 'Body') return <Toast.Body>Saved</Toast.Body>;
        return (
          <Toast.Footer>
            <button type="button">Saved</button>
          </Toast.Footer>
        );
      }
      render(
        <Toast>
          <AppPart />
        </Toast>,
      );
      // The part's element sits inside the body the Toast made for its children.
      const element = screen.getByText('Saved');
      expect(element.parentElement?.closest(`.${toastBodyClassNames.root}`)).not.toBeNull();
      expect(warn.mock.calls).toEqual([[unscanned(part)]]);
      warn.mockRestore();
    },
  );

  it('prefers a Toast.Title part over the title prop, with a development warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Toast title="Prop title">
        <Toast.Title>Part title</Toast.Title>
      </Toast>,
    );
    expect(screen.queryByText('Prop title')).not.toBeInTheDocument();
    expect(screen.getByText('Part title')).toHaveClass(toastTitleClassNames.label);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toast: `title` is ignored because a Toast.Title is among the children. Remove one of them.',
      ],
    ]);
    warn.mockRestore();
  });

  it.each([
    ['Toast.Title', <Toast.Title key="title">Saved</Toast.Title>],
    ['Toast.Body', <Toast.Body key="body">Done.</Toast.Body>],
    ['Toast.Footer', <Toast.Footer key="footer" />],
  ])('%s throws outside a Toast (C-CONTEXT)', (name, ui) => {
    expectThrows(ui, `[WaveUI] ${name} must be used within <Toast>`);
  });

  it('uses a consumer id on Toast.Body, and a generated one otherwise', () => {
    const { unmount } = render(
      <Toast>
        <Toast.Body id="save-details">Saved to Documents.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved to Documents.')).toHaveAttribute('id', 'save-details');
    unmount();
    render(
      <Toast>
        <Toast.Body>Saved to Documents.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved to Documents.').id).not.toBe('');
  });

  it('renders its parts on the server and hydrates without warnings', async () => {
    const ui = (
      <Toast status="success">
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body>Your changes were saved.</Toast.Body>
      </Toast>
    );
    const host = document.createElement('div');
    host.innerHTML = renderToString(ui);
    document.body.append(host);
    const error = vi.spyOn(console, 'error');
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, ui);
      });
      expect(error).not.toHaveBeenCalled();
      expect(within(host).getByText('Saved')).toHaveClass(toastTitleClassNames.label);
    } finally {
      act(() => root?.unmount());
      error.mockRestore();
      host.remove();
    }
  });

  describe('icon (P3-02, toast-3)', () => {
    it('renders the status icon by default', () => {
      render(<Toast status="warning" title="Disk almost full" data-testid="toast" />);
      const icon = screen.getByTestId('toast').querySelector(`.${toastClassNames.icon}`);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon?.querySelector('[data-wave-icon="warning"]')).not.toBeNull();
    });

    it('replaces the status icon with the icon slot, decoratively', () => {
      render(<Toast title="Synced" icon={<svg data-testid="sync" />} data-testid="toast" />);
      const icon = screen.getByTestId('sync').parentElement;
      expect(icon).toHaveClass(toastClassNames.icon);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId('toast').querySelector('[data-wave-icon]')).toBeNull();
    });

    it('keeps the icon class on a slot object that swaps the element', () => {
      render(<Toast title="Starred" icon={{ as: 'i', children: '★' }} data-testid="toast" />);
      const icon = screen.getByTestId('toast').querySelector('i');
      expect(icon).toHaveClass(toastClassNames.icon);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it.each([
      ['null', null],
      ['false', false],
      ["''", ''],
    ])('shows no icon for %s (anything that renders nothing)', (_, icon) => {
      render(<Toast title="Plain" icon={icon} data-testid="toast" />);
      const toast = screen.getByTestId('toast');
      expect(toast.querySelector(`.${toastClassNames.icon}`)).toBeNull();
      expect(toast.querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('types icon as a span slot', () => {
      expectTypeOf<ToastProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    });
  });
});

describe('Toast.Close (P3-02, toasttrigger-1)', () => {
  it('makes its child call the Toast’s onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Title
          action={
            <Toast.Close>
              <button type="button">Got it</button>
            </Toast.Close>
          }
        >
          Saved
        </Toast.Title>
      </Toast>,
    );
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('runs the child’s onClick first; preventDefault() there keeps the toast', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const calls: string[] = [];
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            <button type="button" onClick={() => calls.push('child')}>
              Undo
            </button>
          </Toast.Close>
          <Toast.Close>
            <button type="button" onClick={(event) => event.preventDefault()}>
              Keep
            </button>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    onDismiss.mockImplementation(() => calls.push('dismiss'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(calls).toEqual(['child', 'dismiss']);
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('unwraps a Fragment around a single child', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            <>
              <button type="button">Close</button>
            </>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('passes its props to a render-prop child', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            {(props) => (
              <button type="button" {...props}>
                Done
              </button>
            )}
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss through a disabledFocusable Button', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            <Button disabledFocusable>Undo</Button>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    const undo = screen.getByRole('button', { name: 'Undo' });
    await user.click(undo);
    act(() => undo.focus());
    await user.keyboard('{Enter}');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('warns once when there is nothing to dismiss', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Toast>
        <Toast.Footer>
          <Toast.Close>
            <button type="button">Close</button>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toast.Close has nothing to dismiss: render it in a toast dispatched to a Toaster, or in a Toast with `onDismiss`.',
      ],
    ]);
    warn.mockRestore();
  });

  it('throws outside a Toast (C-CONTEXT)', () => {
    expectThrows(
      <Toast.Close>
        <button type="button">Close</button>
      </Toast.Close>,
      '[WaveUI] Toast.Close must be used within <Toast>',
    );
  });
});

describe('the toast container (P3-02, D10)', () => {
  it('wraps every toast in a focusable group named by its severity and title, described by its body', () => {
    const { dispatch } = renderToaster();
    dispatch({
      status: 'error',
      title: 'Upload failed',
      body: 'The file is too large.',
      timeout: 0,
    });
    const [container] = getToasts();
    expect(container).toHaveAttribute('role', 'group');
    expect(container).toHaveAttribute('tabindex', '-1');
    expect(container).toHaveClass(toasterClassNames.toast);
    expect(screen.getByRole('group', { name: 'Error: Upload failed' })).toBe(container);
    expect(container).toHaveAccessibleDescription('The file is too large.');
    // The marker moved from the Toast to its container.
    expect(container.querySelector('[data-wave-toast]')).toBeNull();
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('names the group by the severity alone without a title, by the title alone without a severity text', () => {
    const { dispatch } = renderToaster();
    dispatch({ status: 'warning', title: '', body: 'Check your connection.', timeout: 0 });
    dispatch({ statusLabel: '', title: 'Saved', timeout: 0 });
    dispatch({ statusLabel: '', title: '', body: 'Plain', timeout: 0 });
    const [severityOnly, titleOnly, unnamed] = getToasts();
    expect(severityOnly).toHaveAccessibleName('Warning:');
    expect(titleOnly).toHaveAccessibleName('Saved');
    expect(titleOnly).not.toHaveAttribute('aria-describedby');
    expect(unnamed).not.toHaveAttribute('aria-labelledby');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('shows the Dismiss button of every Toast and dismisses the toast with it', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster();
    dispatch({ title: 'Saved', timeout: 0 });
    await user.click(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' }));
    expect(getToasts()).toHaveLength(0);
  });

  it('keeps one registration per part under StrictMode', () => {
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    const dispatchSave = (body: string | undefined) =>
      act(() => {
        controllerRef.current?.dispatchToast({ toastId: 'save', title: 'Saved', body, timeout: 0 });
      });
    dispatchSave('Your changes were saved.');
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Info: Saved');
    expect(container).toHaveAccessibleDescription('Your changes were saved.');
    // A registration left behind by StrictMode's second effect run would keep the description.
    dispatchSave(undefined);
    expect(container).not.toHaveAttribute('aria-describedby');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('has no accessibility violations with a title and a body (open)', async () => {
    const { dispatch } = renderToaster({}, { app: <p>App content</p> });
    dispatch({ status: 'success', title: 'Saved', body: 'Your changes were saved.', timeout: 0 });
    await expectNoA11yViolations(document.body);
  });
});

describe('presence (P3-02, D29)', () => {
  const isToast = (el: Element) => el.hasAttribute('data-wave-toast');

  it('keeps a dismissed toast mounted, exiting and inert until its exit ends', async () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Saved', timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAttribute('data-presence', 'entering');
    await act(async () => {
      await motion.finishAll();
    });
    expect(container).toHaveAttribute('data-presence', 'entered');

    dismiss(id);
    expect(container).toHaveAttribute('data-presence', 'exiting');
    expect(container).toHaveAttribute('inert');
    // No longer announced.
    expect(getLiveRegion('polite')).toBeEmptyDOMElement();
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(0);
  });

  it('ends the exit at once under reduced motion', () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Saved', timeout: 0 });
    expect(getToasts()[0]).toHaveAttribute('data-presence', 'entered');
    dismiss(id);
    expect(getToasts()).toHaveLength(0);
  });

  it('does not count a dismissed toast toward limit: the next one shows at once', async () => {
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster({ limit: 1 });
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(1);
    dismiss(first);
    const [exiting, shown] = getToasts();
    expect(exiting).toHaveAttribute('data-presence', 'exiting');
    expect(shown).toHaveTextContent('Second');
    expect(shown).not.toHaveAttribute('inert');
    expect(getLiveRegion('polite')).toHaveTextContent('Info: Second');
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toEqual([shown]);
  });

  it('revives an exiting toast dispatched again with its id', async () => {
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    dispatch({ toastId: 'sync', title: 'Syncing…', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    const [container] = getToasts();
    dismiss('sync');
    expect(container).toHaveAttribute('data-presence', 'exiting');
    dispatch({ toastId: 'sync', status: 'success', title: 'Synced', timeout: 0 });
    expect(getToasts()).toEqual([container]);
    expect(container).toHaveAttribute('data-presence', 'entering');
    expect(container).not.toHaveAttribute('inert');
    expect(getLiveRegion('polite')).toHaveTextContent('Success: Synced');
    await act(async () => {
      await motion.finishAll();
    });
    expect(container).toHaveAttribute('data-presence', 'entered');
    expect(getToasts()).toEqual([container]);
  });

  it('moves focus in the dismissing commit to the next toast that is not exiting', async () => {
    const motion = mockAnimations({ animated: isToast });
    const user = userEvent.setup();
    const { dispatch, dismiss } = renderToaster();
    dispatch({ title: 'First', timeout: 0 });
    const second = dispatch({ title: 'Second', timeout: 0 });
    dispatch({ title: 'Third', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    const [first, secondContainer, third] = getToasts();
    dismiss(second);
    await user.click(within(first).getByRole('button', { name: 'Dismiss' }));
    // Two toasts exit at once; focus skips both and lands on Third before either exit ends.
    expect(within(third).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    expect(first).toHaveAttribute('data-presence', 'exiting');
    expect(secondContainer).toHaveAttribute('data-presence', 'exiting');
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toEqual([third]);
  });

  it('moves focus from a focused container to the next container itself', () => {
    const { dispatch, dismiss } = renderToaster();
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    const [firstContainer, secondContainer] = getToasts();
    act(() => firstContainer.focus());
    dismiss(first);
    expect(secondContainer).toHaveFocus();
  });

  it('keeps the return target when the browser blurs a dismissed toast later (focus fix-up)', async () => {
    const motion = mockAnimations({ animated: isToast });
    const user = userEvent.setup();
    const { dispatch, dismiss } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    await user.click(input);
    await user.tab();
    const [firstContainer, second] = getToasts();
    const firstButton = within(firstContainer).getByRole('button', { name: 'Dismiss' });
    expect(firstButton).toHaveFocus();
    dismiss(first);
    const secondButton = within(second).getByRole('button', { name: 'Dismiss' });
    expect(secondButton).toHaveFocus();
    // A browser's focus fix-up blurs the inert, exiting subtree later, with <body> active.
    const active = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(document.body);
    fireEvent.focusOut(firstButton, { relatedTarget: null });
    active.mockRestore();
    await user.keyboard('{Enter}');
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('starts exactly one dismiss timer for a toast revived during its exit', async () => {
    vi.useFakeTimers();
    try {
      const motion = mockAnimations({ animated: isToast });
      const { dispatch, dismiss } = renderToaster();
      dispatch({ toastId: 'sync', title: 'Syncing…', timeout: 1000 });
      await act(async () => {
        await motion.finishAll();
      });
      dismiss('sync');
      expect(getToasts()[0]).toHaveAttribute('data-presence', 'exiting');
      dispatch({ toastId: 'sync', status: 'success', title: 'Synced', timeout: 1000 });
      // The revived toast's own dismiss timer, not stacked with a leftover one from before it
      // exited, plus the fade timer of its freshly announced (re-)message: one of each, not two
      // competing dismiss timers.
      expect(vi.getTimerCount()).toBe(2);
      advance(999);
      expect(getToasts()[0]).not.toHaveAttribute('data-presence', 'exiting');
      advance(1);
      expect(getToasts()[0]).toHaveAttribute('data-presence', 'exiting');
      await act(async () => {
        await motion.finishAll();
      });
      expect(getToasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves focus to the remembered origin when every shown toast is dismissed in one commit', async () => {
    const motion = mockAnimations({ animated: isToast });
    const user = userEvent.setup();
    const { dispatch, dismissAll } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    await user.click(input);
    await user.tab();
    const [first, second] = getToasts();
    expect(within(first).getByRole('button', { name: 'Dismiss' })).toHaveFocus();

    dismissAll();
    expect(first).toHaveAttribute('data-presence', 'exiting');
    expect(first).toHaveAttribute('inert');
    expect(second).toHaveAttribute('data-presence', 'exiting');
    expect(second).toHaveAttribute('inert');
    // Every shown toast is exiting: none is a live candidate for the fallback, so focus returns to
    // the element that was focused before it entered the toasts.
    expect(input).toHaveFocus();

    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(0);
  });
});

describe('ToastTitle — slotProps', () => {
  type TitleSlotProps = NonNullable<ToastTitleProps['slotProps']>;
  const label = () =>
    document.querySelector<HTMLElement>('.' + toastTitleClassNames.label) as HTMLElement;

  it('renders the title text of 3fafbe0 (attributes sorted)', () => {
    // Captured from 3fafbe0's server render: the merged props may put the class first.
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <Toast>
        <Toast.Title action={<a href="#undo">Undo</a>}>Saved</Toast.Title>
      </Toast>,
    );
    expect(openingTags(host.querySelector('.' + toastTitleClassNames.label) as Element)).toBe(
      '<span class="wave-toast-title__label wave:min-w-0 wave:flex-1 wave:text-body-2 wave:font-semibold wave:text-foreground" id="wave-toast-title-_id0_">',
    );
  });

  it('renders the same markup without slotProps, with {} and with the part empty', () => {
    const cases: Array<Partial<ToastTitleProps>> = [
      {},
      { action: <a href="#undo">Undo</a>, className: 'mine', id: 'own' },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => (
          <Toast>
            <Toast.Title {...props} slotProps={slotProps}>
              Saved
            </Toast.Title>
          </Toast>
        ),
        { label: {} },
      );
    }
  });

  it('puts your className, style, data-* and ref on the title text, after its own classes', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(
      <Toast>
        <Toast.Title
          data-testid="row"
          slotProps={{
            label: {
              className: 'my-label',
              style: { letterSpacing: '1px' },
              'data-part': 'label',
              ref,
            },
          }}
        >
          Saved
        </Toast.Title>
      </Toast>,
    );
    const text = label();
    expect(text.classList[0]).toBe(toastTitleClassNames.label);
    expect(text).toHaveClass('wave:font-semibold', 'my-label');
    expect(text.classList[text.classList.length - 1]).toBe('my-label');
    expect(text).toHaveAttribute('data-part', 'label');
    expect(text).toHaveStyle({ letterSpacing: '1px' });
    expect(ref.current).toBe(text);
    // The row takes none of it, and no `slotProps` attribute.
    expect(screen.getByTestId('row')).not.toHaveAttribute('data-part');
    expect(document.querySelector('[slotprops]')).toBeNull();
  });

  it('lets your class replace a conflicting class of the title text', () => {
    render(
      <Toast>
        <Toast.Title slotProps={{ label: { className: 'font-bold' } }}>Saved</Toast.Title>
      </Toast>,
    );
    expect(label()).toHaveClass('font-bold');
    expect(label()).not.toHaveClass('wave:font-semibold');
  });

  it('keeps the title text the toast’s name: its id, name and hidden state are locked', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="success">
        <Toast.Title
          slotProps={{
            label: {
              id: 'mine',
              'aria-label': 'Other',
              hidden: true,
              inert: true,
              'aria-hidden': true,
              title: 'Title',
            },
          }}
        >
          Saved
        </Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Success: Saved');
    expect(label().id).toMatch(/^wave-toast-title-/);
    for (const name of ['aria-label', 'hidden', 'inert', 'aria-hidden']) {
      expect(label(), name).not.toHaveAttribute(name);
    }
    expect(label()).toHaveAttribute('title', 'Title');
    expect(getLiveRegion('polite')).toHaveTextContent(/^Success: Saved$/);
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('keeps the Toaster’s view of the title text with a new inline ref on every render', () => {
    const elements: Array<HTMLSpanElement | null> = [];
    const { dispatchContent } = renderToaster();
    // A replacement renders the title again, with a new inline ref. The Toaster still reads the
    // title first and the title's action last.
    for (const body of ['Saving.', 'Done.']) {
      dispatchContent(
        <Toast status="success">
          <Toast.Title
            action={<a href="#undo">Undo</a>}
            slotProps={{ label: { ref: (element) => void elements.push(element) } }}
          >
            Saved
          </Toast.Title>
          <Toast.Body>{body}</Toast.Body>
        </Toast>,
        { toastId: 'save', timeout: 0 },
      );
    }
    expect(elements.at(-1)).toBe(label());
    expect(getLiveRegion('polite')).toHaveTextContent(/^Success: Saved Done\. Undo$/);
  });

  it('runs your handler on the title text once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <Toast>
          <Toast.Title slotProps={{ label: { onClick } }}>Saved</Toast.Title>
        </Toast>
      </React.StrictMode>,
    );
    await user.click(label());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations with the part customised', async () => {
    render(
      <Toast onDismiss={() => {}}>
        <Toast.Title slotProps={{ label: { className: 'my-label', title: 'Title' } }}>
          Saved
        </Toast.Title>
      </Toast>,
    );
    await expectNoA11yViolations();
  });

  it('types the part for its element, and takes no children', () => {
    expectTypeOf<keyof TitleSlotProps>().toEqualTypeOf<'label'>();
    expectTypeOf<NonNullable<TitleSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: your children are the title text
    void (<ToastTitle slotProps={{ label: { children: 'Other' } }}>Saved</ToastTitle>);
  });
});

describe('ToastBody — slotProps', () => {
  type BodySlotProps = NonNullable<ToastBodyProps['slotProps']>;
  const subtitle = () =>
    document.querySelector<HTMLElement>('.' + toastBodyClassNames.subtitle) as HTMLElement;

  it('renders the subtitle of 3fafbe0 (attributes sorted)', () => {
    // Captured from 3fafbe0's server render: the merged props may put the class first.
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <Toast>
        <Toast.Body subtitle="2 files">Done.</Toast.Body>
      </Toast>,
    );
    expect(openingTags(host.querySelector('.' + toastBodyClassNames.subtitle) as Element)).toBe(
      '<div class="wave-toast-body__subtitle wave:mt-1 wave:text-caption-1 wave:text-muted-foreground">',
    );
  });

  it('renders the same markup without slotProps, with {} and with the part empty', () => {
    const cases: Array<Partial<ToastBodyProps>> = [
      { subtitle: '2 files' },
      { subtitle: <strong>2 files</strong>, id: 'own-body', className: 'mine' },
      {},
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => (
          <Toast>
            <Toast.Body {...props} slotProps={slotProps}>
              Done.
            </Toast.Body>
          </Toast>
        ),
        { subtitle: {} },
      );
    }
  });

  it('puts your className, style, data-* and ref on the subtitle, after its own classes', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Toast>
        <Toast.Body
          data-testid="body"
          subtitle="2 files"
          slotProps={{
            subtitle: {
              className: 'my-subtitle',
              style: { letterSpacing: '1px' },
              'data-part': 'subtitle',
              ref,
            },
          }}
        >
          Done.
        </Toast.Body>
      </Toast>,
    );
    const line = subtitle();
    expect(line.classList[0]).toBe(toastBodyClassNames.subtitle);
    expect(line).toHaveClass('wave:text-caption-1', 'my-subtitle');
    expect(line.classList[line.classList.length - 1]).toBe('my-subtitle');
    expect(line).toHaveAttribute('data-part', 'subtitle');
    expect(line).toHaveStyle({ letterSpacing: '1px' });
    expect(ref.current).toBe(line);
    // The body takes none of it, and no `slotProps` attribute.
    expect(screen.getByTestId('body')).not.toHaveAttribute('data-part');
    expect(document.querySelector('[slotprops]')).toBeNull();
  });

  it('lets your class replace a conflicting class of the subtitle', () => {
    render(
      <Toast>
        <Toast.Body subtitle="2 files" slotProps={{ subtitle: { className: 'mt-2' } }}>
          Done.
        </Toast.Body>
      </Toast>,
    );
    expect(subtitle()).toHaveClass('mt-2');
    expect(subtitle()).not.toHaveClass('wave:mt-1');
  });

  it('keeps the subtitle in the toast’s description: its name and hidden state are locked', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="success">
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body
          subtitle="2 files"
          slotProps={{
            subtitle: {
              'aria-label': 'Other',
              hidden: true,
              inert: true,
              'aria-hidden': true,
              title: 'Subtitle',
            },
          }}
        >
          Done.
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    const [container] = getToasts();
    expect(container).toHaveAccessibleDescription('Done. 2 files');
    for (const name of ['aria-label', 'hidden', 'inert', 'aria-hidden']) {
      expect(subtitle(), name).not.toHaveAttribute(name);
    }
    expect(subtitle()).toHaveAttribute('title', 'Subtitle');
    expect(getLiveRegion('polite')).toHaveTextContent(/^Success: Saved Done\. 2 files$/);
  });

  it('ignores the part while there is no subtitle', () => {
    render(
      <Toast>
        <Toast.Body data-testid="body" slotProps={{ subtitle: { className: 'my-subtitle' } }}>
          Done.
        </Toast.Body>
      </Toast>,
    );
    expect(document.querySelector('.' + toastBodyClassNames.subtitle)).toBeNull();
    expect(document.querySelector('.my-subtitle')).toBeNull();
    expect(screen.getByTestId('body')).not.toHaveAttribute('slotprops');
  });

  it('runs your handler on the subtitle once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <Toast>
          <Toast.Body subtitle="2 files" slotProps={{ subtitle: { onClick } }}>
            Done.
          </Toast.Body>
        </Toast>
      </React.StrictMode>,
    );
    await user.click(subtitle());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations with the part customised', async () => {
    render(
      <Toast title="Saved">
        <Toast.Body subtitle="2 files" slotProps={{ subtitle: { className: 'my-subtitle' } }}>
          Done.
        </Toast.Body>
      </Toast>,
    );
    await expectNoA11yViolations();
  });

  it('types the part for its element, and takes no children', () => {
    expectTypeOf<keyof BodySlotProps>().toEqualTypeOf<'subtitle'>();
    expectTypeOf<NonNullable<BodySlotProps['subtitle']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: `subtitle` is the line's content
    void (<ToastBody slotProps={{ subtitle: { children: 'Other' } }}>Done.</ToastBody>);
  });
});
