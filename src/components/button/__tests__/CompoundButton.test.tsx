import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompoundButton } from '../CompoundButton';
import { testSystemProps, testFocusEvents } from '../../../test-utils';

describe('CompoundButton', () => {
  testSystemProps(CompoundButton, {
    expectedTag: 'button',
    displayName: 'CompoundButton',
    polymorphic: true,
    defaultProps: { children: 'Click me' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  testFocusEvents(CompoundButton, { children: 'Click me' });

  it('renders without crashing', () => {
    render(<CompoundButton>Click me</CompoundButton>);
    expect(screen.getByRole('button', { name: /Click me/i })).toBeInTheDocument();
  });

  it('renders secondaryText', () => {
    render(<CompoundButton secondaryText="Extra info">Main</CompoundButton>);
    expect(screen.getByText('Extra info')).toBeInTheDocument();
  });

  it('does not render secondaryText when not provided', () => {
    render(<CompoundButton data-testid="btn">Main</CompoundButton>);
    const btn = screen.getByTestId('btn');
    // Should only have one child span (the main text)
    const spans = btn.querySelectorAll('span');
    expect(spans).toHaveLength(1);
  });

  it('renders as a different element via as prop', () => {
    render(
      <CompoundButton as="a" data-testid="btn" href="#">
        Link
      </CompoundButton>,
    );
    expect(screen.getByTestId('btn').tagName.toLowerCase()).toBe('a');
  });

  it('applies disabled state', () => {
    render(
      <CompoundButton disabled data-testid="btn">
        Disabled
      </CompoundButton>,
    );
    expect(screen.getByTestId('btn')).toBeDisabled();
    expect(screen.getByTestId('btn').className).toContain('opacity-50');
  });

  it('calls onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CompoundButton onClick={onClick}>Click</CompoundButton>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
