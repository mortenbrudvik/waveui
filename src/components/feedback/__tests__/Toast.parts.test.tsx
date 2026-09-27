import * as React from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Toast, Toaster, ToastBody, ToastClose, ToastFooter, ToastTitle } from '../Toast';
import type { ToastController, ToastProps } from '../Toast';
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
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
import { ControllerProbe, getToasts, renderToaster } from './toasterHarness';

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
