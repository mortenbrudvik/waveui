import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Input', () => {
  testForwardRef(Input, 'input');
  testRestSpread(Input);
  testClassName(Input);

  it('renders without crashing', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders as a plain input without slots', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input').tagName.toLowerCase()).toBe('input');
  });

  it('renders contentBefore as ReactNode shorthand', () => {
    render(<Input contentBefore={<span data-testid="before">$</span>} data-testid="input" />);
    expect(screen.getByTestId('before')).toBeInTheDocument();
  });

  it('renders contentBefore as SlotObject', () => {
    render(
      <Input
        contentBefore={{ children: <span data-testid="before-slot">$</span>, className: 'custom' }}
        data-testid="input"
      />,
    );
    expect(screen.getByTestId('before-slot')).toBeInTheDocument();
  });

  it('renders contentAfter as ReactNode shorthand', () => {
    render(<Input contentAfter={<span data-testid="after">kg</span>} data-testid="input" />);
    expect(screen.getByTestId('after')).toBeInTheDocument();
  });

  it('renders contentAfter as SlotObject', () => {
    render(
      <Input
        contentAfter={{ children: <span data-testid="after-slot">kg</span>, className: 'custom' }}
        data-testid="input"
      />,
    );
    expect(screen.getByTestId('after-slot')).toBeInTheDocument();
  });

  it('wraps in a span when contentBefore or contentAfter is provided', () => {
    const { container } = render(<Input contentBefore={<span>$</span>} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName.toLowerCase()).toBe('span');
  });

  it('sets aria-invalid when error is provided', () => {
    render(<Input error="Required" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input')).not.toHaveAttribute('aria-invalid');
  });

  it('applies error border styling', () => {
    render(<Input error="Required" data-testid="input" />);
    expect(screen.getByTestId('input').className).toContain('border-destructive');
  });

  it('handles user typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input data-testid="input" onChange={onChange} />);
    await user.type(screen.getByTestId('input'), 'hello');
    expect(onChange).toHaveBeenCalledTimes(5);
  });
});
