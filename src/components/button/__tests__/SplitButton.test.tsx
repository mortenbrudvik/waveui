import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitButton } from '../SplitButton';

describe('SplitButton', () => {
  // SplitButton refs the wrapper div, but spreads rest props to the primary button,
  // so the standard helpers don't apply directly.

  it('forwards ref to wrapper div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<SplitButton ref={ref}>Save</SplitButton>);
    expect(ref.current).toBe(screen.getByRole('group'));
    expect(ref.current!.tagName.toLowerCase()).toBe('div');
  });

  it('merges custom className on wrapper div', () => {
    render(<SplitButton className="my-custom-class">Save</SplitButton>);
    expect(screen.getByRole('group').className).toContain('my-custom-class');
  });

  it('renders without crashing', () => {
    render(<SplitButton>Save</SplitButton>);
    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders two buttons (primary and menu)', () => {
    render(<SplitButton>Save</SplitButton>);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('menu button has aria-haspopup="menu"', () => {
    render(<SplitButton>Save</SplitButton>);
    expect(screen.getByLabelText('More options')).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('calls onClick for primary button only', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onMenuClick = vi.fn();
    render(
      <SplitButton onClick={onClick} onMenuClick={onMenuClick}>
        Save
      </SplitButton>,
    );
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onMenuClick).not.toHaveBeenCalled();
  });

  it('calls onMenuClick for menu button only', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onMenuClick = vi.fn();
    render(
      <SplitButton onClick={onClick} onMenuClick={onMenuClick}>
        Save
      </SplitButton>,
    );
    await user.click(screen.getByLabelText('More options'));
    expect(onMenuClick).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disables both buttons when disabled', () => {
    render(<SplitButton disabled>Save</SplitButton>);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });
});
