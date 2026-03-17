import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Persona } from '../Persona';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Persona', () => {
  testForwardRef(Persona, 'div', { name: 'John Doe' });
  testRestSpread(Persona, { name: 'John Doe' });
  testClassName(Persona, { name: 'John Doe' });

  it('renders without crashing', () => {
    render(<Persona name="John Doe" data-testid="persona" />);
    expect(screen.getByTestId('persona')).toBeInTheDocument();
  });

  it('renders name text', () => {
    render(<Persona name="Alice Smith" />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('renders secondaryText', () => {
    render(<Persona name="Alice Smith" secondaryText="Software Engineer" />);
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });

  it('does not render secondaryText when not provided', () => {
    const { container } = render(<Persona name="Alice" />);
    const captions = container.querySelectorAll('.text-caption-1');
    expect(captions.length).toBe(0);
  });

  it('renders avatar with initials by default', () => {
    render(<Persona name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders avatar with src', () => {
    render(<Persona name="John" src="https://example.com/photo.jpg" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('renders custom avatar slot', () => {
    render(
      <Persona name="John" avatar={<span data-testid="custom-avatar">AV</span>} />,
    );
    expect(screen.getByTestId('custom-avatar')).toBeInTheDocument();
  });

  it('renders custom badge slot', () => {
    render(
      <Persona name="John" badge={<span data-testid="custom-badge">B</span>} />,
    );
    expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
  });

  it('renders presence badge when status is provided', () => {
    render(<Persona name="John" status="available" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Available');
  });
});
