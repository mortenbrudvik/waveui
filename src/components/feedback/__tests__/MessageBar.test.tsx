import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBar } from '../MessageBar';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('MessageBar', () => {
  testForwardRef(MessageBar, 'div', { children: 'msg' });
  testRestSpread(MessageBar, { children: 'msg' });
  testClassName(MessageBar, { children: 'msg' });

  it('renders children', () => {
    render(<MessageBar>Hello world</MessageBar>);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('defaults to info status with role="status"', () => {
    render(<MessageBar data-testid="bar">Info message</MessageBar>);
    expect(screen.getByTestId('bar')).toHaveAttribute('role', 'status');
  });

  it('uses role="status" for success status', () => {
    render(<MessageBar status="success" data-testid="bar">OK</MessageBar>);
    expect(screen.getByTestId('bar')).toHaveAttribute('role', 'status');
  });

  it('uses role="alert" for error status', () => {
    render(<MessageBar status="error" data-testid="bar">Error</MessageBar>);
    expect(screen.getByTestId('bar')).toHaveAttribute('role', 'alert');
  });

  it('uses role="alert" for warning status', () => {
    render(<MessageBar status="warning" data-testid="bar">Warning</MessageBar>);
    expect(screen.getByTestId('bar')).toHaveAttribute('role', 'alert');
  });

  it('renders default dismiss button when onDismiss is provided', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<MessageBar onDismiss={onDismiss}>Msg</MessageBar>);
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismissBtn).toBeInTheDocument();
    await user.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button without onDismiss', () => {
    render(<MessageBar>Msg</MessageBar>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('renders custom icon slot', () => {
    render(
      <MessageBar icon={{ children: 'custom-icon' }}>Msg</MessageBar>,
    );
    expect(screen.getByText('custom-icon')).toBeInTheDocument();
  });

  it('applies status-specific classes', () => {
    const { rerender } = render(<MessageBar status="success" data-testid="bar">Msg</MessageBar>);
    expect(screen.getByTestId('bar').className).toContain('bg-[#e0f2e0]');

    rerender(<MessageBar status="error" data-testid="bar">Msg</MessageBar>);
    expect(screen.getByTestId('bar').className).toContain('bg-[#fde7e9]');
  });
});
