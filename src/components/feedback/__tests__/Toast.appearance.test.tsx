import * as React from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Toast } from '../Toast';
import type { ToastAppearance, ToastProps } from '../Toast';
import { toastClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';
import { getToasts, renderToaster } from './toasterHarness';

const INVERTED_ROOT = [
  'wave:border-inverted-border',
  'wave:bg-inverted',
  'wave:text-inverted-foreground',
];
const DEFAULT_ROOT = ['wave:border-border', 'wave:bg-background', 'wave:text-foreground'];

describe('Toast — appearance (toast-4)', () => {
  it('defaults to the page surface and renders data-appearance="default"', () => {
    render(<Toast title="Saved" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('data-appearance', 'default');
    expect(toast).toHaveClass(...DEFAULT_ROOT);
    expect(toast).not.toHaveClass('wave:bg-inverted');
  });

  it('draws an inverted toast on the inverted surface, keeping the status in the start border', () => {
    render(<Toast title="Saved" status="success" appearance="inverted" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('data-appearance', 'inverted');
    expect(toast).toHaveClass(...INVERTED_ROOT, 'wave:border-s-success');
    for (const cls of DEFAULT_ROOT) expect(toast).not.toHaveClass(cls);
    // The status icon takes the inverted text color: the status tints are made for the page.
    const icon = toast.querySelector(`.${toastClassNames.icon}`);
    expect(icon).toHaveClass('wave:text-inverted-foreground');
    expect(icon).not.toHaveClass('wave:text-success-tint-foreground');
  });

  it('inverts the Dismiss button and the text of the title, body and subtitle', () => {
    render(
      <Toast appearance="inverted" onDismiss={() => {}} data-testid="toast">
        <Toast.Title>Title</Toast.Title>
        <Toast.Body subtitle="Subtitle">Body</Toast.Body>
      </Toast>,
    );
    const toast = screen.getByTestId('toast');
    expect(screen.getByText('Title')).toHaveClass('wave:text-inverted-foreground');
    expect(screen.getByText('Title')).not.toHaveClass('wave:text-foreground');
    expect(screen.getByText('Body')).toHaveClass('wave:text-inverted-foreground/80');
    expect(screen.getByText('Body')).not.toHaveClass('wave:text-muted-foreground');
    expect(screen.getByText('Subtitle')).toHaveClass('wave:text-inverted-foreground/80');
    const dismiss = within(toast).getByRole('button', { name: 'Dismiss' });
    expect(dismiss).toHaveClass(
      'wave:text-inverted-foreground/80',
      'wave:not-disabled:not-aria-disabled:hover:bg-inverted-foreground/10',
      'wave:not-disabled:not-aria-disabled:hover:text-inverted-foreground',
      'wave:not-disabled:not-aria-disabled:active:bg-inverted-foreground/20',
    );
    expect(dismiss).not.toHaveClass('wave:text-muted-foreground');
    expect(dismiss).not.toHaveClass('wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover');
  });

  it('keeps the default text colors of the parts in a default toast', () => {
    render(
      <Toast onDismiss={() => {}}>
        <Toast.Title>Title</Toast.Title>
        <Toast.Body subtitle="Subtitle">Body</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Title')).toHaveClass('wave:text-foreground');
    expect(screen.getByText('Body')).toHaveClass('wave:text-muted-foreground');
    expect(screen.getByText('Subtitle')).toHaveClass('wave:text-muted-foreground');
  });

  it('reads an unknown appearance (untyped code) as the default', () => {
    render(<Toast title="Saved" appearance={'loud' as ToastAppearance} data-testid="toast" />);
    expect(screen.getByTestId('toast')).toHaveAttribute('data-appearance', 'default');
  });

  it('lets a className of the consumer replace the surface', () => {
    render(
      <Toast title="Saved" appearance="inverted" className="bg-wave-primary" data-testid="toast" />,
    );
    expect(screen.getByTestId('toast')).toHaveClass('bg-wave-primary');
    expect(screen.getByTestId('toast')).not.toHaveClass('wave:bg-inverted');
  });

  it('takes the appearance from the options of a dispatch, and from a Toast it dispatches', () => {
    const { dispatch, dispatchContent } = renderToaster();
    dispatch({ title: 'Options', appearance: 'inverted', timeout: 0 });
    dispatchContent(<Toast title="Content" appearance="inverted" />, { timeout: 0 });
    dispatchContent(<Toast title="Plain" />, { timeout: 0 });
    const toasts = getToasts().map((container) => container.querySelector('[data-appearance]'));
    expect(toasts.map((toast) => toast?.getAttribute('data-appearance'))).toEqual([
      'inverted',
      'inverted',
      'default',
    ]);
    expect(toasts[0]).toHaveClass(...INVERTED_ROOT);
  });

  it('updates the appearance with updateToast', () => {
    const { dispatch, controller } = renderToaster();
    const id = dispatch({ title: 'Switching', timeout: 0 });
    act(() => controller().updateToast({ toastId: id, appearance: 'inverted' }));
    expect(getToasts()[0].querySelector('[data-appearance]')).toHaveAttribute(
      'data-appearance',
      'inverted',
    );
  });

  it('inverts the Dismiss button inside a Toaster and still dismisses', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Bye', appearance: 'inverted', timeout: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(getToasts()).toHaveLength(0);
  });

  it('shows no Dismiss button with showDismissButton={false}, with or without onDismiss', () => {
    render(
      <>
        <Toast title="One" onDismiss={() => {}} showDismissButton={false} />
        <Toast title="Two" showDismissButton={false} />
      </>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the button without onDismiss in neither case, and only with it as in 0.x', () => {
    const onDismiss = vi.fn();
    render(<Toast title="One" onDismiss={onDismiss} showDismissButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    render(<Toast title="Two" showDismissButton />);
    // `true` shows nothing to call: with no onDismiss and outside a Toaster there is no button.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('has no accessibility violations (inverted, with parts and a Dismiss button)', async () => {
    render(
      <Toast appearance="inverted" onDismiss={() => {}}>
        <Toast.Title>Title</Toast.Title>
        <Toast.Body subtitle="Subtitle">Body</Toast.Body>
      </Toast>,
    );
    await expectNoA11yViolations();
  });

  it('types appearance and showDismissButton', () => {
    expectTypeOf<ToastAppearance>().toEqualTypeOf<'default' | 'inverted'>();
    expectTypeOf<ToastProps['appearance']>().toEqualTypeOf<ToastAppearance | undefined>();
    expectTypeOf<ToastProps['showDismissButton']>().toEqualTypeOf<boolean | undefined>();
  });
});
