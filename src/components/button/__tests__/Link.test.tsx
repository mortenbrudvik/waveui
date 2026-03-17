import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from '../Link';
import { testSystemProps, testFocusEvents } from '../../../test-utils';

describe('Link', () => {
  testSystemProps(Link, {
    expectedTag: 'a',
    displayName: 'Link',
    polymorphic: true,
    defaultProps: { children: 'Go', href: '#' },
  });

  testFocusEvents(Link, { children: 'Go', href: '#' });

  it('renders without crashing', () => {
    render(<Link href="#">Go</Link>);
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('renders as an anchor by default', () => {
    render(
      <Link href="#" data-testid="link">
        Go
      </Link>,
    );
    expect(screen.getByTestId('link').tagName.toLowerCase()).toBe('a');
  });

  it('renders as a different element via as prop', () => {
    render(
      <Link as="button" data-testid="link">
        Go
      </Link>,
    );
    expect(screen.getByTestId('link').tagName.toLowerCase()).toBe('button');
  });

  it('applies inline variant by default', () => {
    render(
      <Link href="#" data-testid="link">
        Go
      </Link>,
    );
    expect(screen.getByTestId('link').className).toContain('text-primary');
  });

  it('applies standalone variant', () => {
    render(
      <Link href="#" variant="standalone" data-testid="link">
        Go
      </Link>,
    );
    expect(screen.getByTestId('link').className).toContain('font-semibold');
  });

  it('applies subtle variant', () => {
    render(
      <Link href="#" variant="subtle" data-testid="link">
        Go
      </Link>,
    );
    expect(screen.getByTestId('link').className).toContain('text-foreground');
  });

  it('prevents click when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Link href="#" disabled onClick={onClick}>
        Go
      </Link>,
    );
    await user.click(screen.getByText('Go'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sets aria-disabled when disabled', () => {
    render(
      <Link href="#" disabled data-testid="link">
        Go
      </Link>,
    );
    expect(screen.getByTestId('link')).toHaveAttribute('aria-disabled', 'true');
  });

  it('sets tabIndex to -1 when disabled', () => {
    render(
      <Link href="#" disabled data-testid="link">
        Go
      </Link>,
    );
    expect(screen.getByTestId('link')).toHaveAttribute('tabindex', '-1');
  });

  it('calls onClick when not disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Link href="#" onClick={onClick}>
        Go
      </Link>,
    );
    await user.click(screen.getByText('Go'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
