import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster, useToastController } from '../Toast';

describe('Toast', () => {
  it('renders without crashing', () => {
    render(<Toast data-testid="toast">Hello</Toast>);
    expect(screen.getByTestId('toast')).toBeInTheDocument();
  });

  it('forwards ref to the root div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Toast ref={ref} data-testid="toast">Hello</Toast>);
    expect(ref.current).toBe(screen.getByTestId('toast'));
    expect(ref.current?.tagName.toLowerCase()).toBe('div');
  });

  it('renders title', () => {
    render(<Toast title="Success!">Body text</Toast>);
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('renders body as children', () => {
    render(<Toast>Body text</Toast>);
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('renders dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Hello</Toast>);
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Hello</Toast>);
    await user.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has role=status and aria-live=polite', () => {
    render(<Toast data-testid="toast">Hello</Toast>);
    const el = screen.getByTestId('toast');
    expect(el).toHaveAttribute('role', 'status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it.each(['success', 'warning', 'error', 'info'] as const)(
    'renders status variant: %s',
    (status) => {
      render(<Toast status={status} data-testid="toast">Hello</Toast>);
      expect(screen.getByTestId('toast')).toBeInTheDocument();
    },
  );

  it('merges custom className', () => {
    render(<Toast className="my-class" data-testid="toast">Hello</Toast>);
    expect(screen.getByTestId('toast').className).toContain('my-class');
  });

  it('spreads rest props', () => {
    render(<Toast data-testid="toast" aria-label="toast-msg">Hello</Toast>);
    expect(screen.getByTestId('toast')).toHaveAttribute('aria-label', 'toast-msg');
  });
});

describe('Toaster', () => {
  it('renders without crashing', () => {
    render(<Toaster data-testid="toaster" />);
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  it('renders children (app content)', () => {
    render(<Toaster><div data-testid="app">App</div></Toaster>);
    expect(screen.getByTestId('app')).toBeInTheDocument();
  });
});

describe('useToastController', () => {
  function TestComponent() {
    const { dispatchToast } = useToastController();
    return (
      <button onClick={() => dispatchToast({ title: 'Test toast', status: 'success', timeout: 0 })}>
        Show Toast
      </button>
    );
  }

  it('dispatches a toast via the controller', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <TestComponent />
      </Toaster>,
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });
});
