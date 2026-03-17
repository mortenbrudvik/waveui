import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleButton } from '../ToggleButton';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('ToggleButton', () => {
  testForwardRef(ToggleButton, 'button');
  testRestSpread(ToggleButton);
  testClassName(ToggleButton);

  it('renders without crashing', () => {
    render(<ToggleButton>Toggle</ToggleButton>);
    expect(screen.getByRole('button', { name: 'Toggle' })).toBeInTheDocument();
  });

  it('renders icon as ReactNode shorthand', () => {
    render(<ToggleButton icon={<span data-testid="icon">B</span>}>Bold</ToggleButton>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders icon as SlotObject', () => {
    render(
      <ToggleButton
        icon={{ children: <span data-testid="slot-icon">I</span>, className: 'custom' }}
      >
        Italic
      </ToggleButton>,
    );
    expect(screen.getByTestId('slot-icon')).toBeInTheDocument();
  });

  it('starts unpressed by default', () => {
    render(<ToggleButton>Toggle</ToggleButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts pressed when defaultPressed is true', () => {
    render(<ToggleButton defaultPressed>Toggle</ToggleButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles pressed state in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(<ToggleButton>Toggle</ToggleButton>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onPressedChange in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(<ToggleButton onPressedChange={onPressedChange}>Toggle</ToggleButton>);
    await user.click(screen.getByRole('button'));
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it('respects controlled pressed prop', async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(
      <ToggleButton pressed={false} onPressedChange={onPressedChange}>
        Toggle
      </ToggleButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await user.click(btn);
    // Controlled: should still be false since parent hasn't updated
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it('calls onClick alongside toggle', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ToggleButton onClick={onClick}>Toggle</ToggleButton>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
