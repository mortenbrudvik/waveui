import type * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Persona } from '../Persona';
import type { PersonaProps } from '../Persona';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
import type { Size } from '../../../lib/types';

describe('Persona', () => {
  testSystemProps(Persona, {
    expectedTag: 'div',
    displayName: 'Persona',
    defaultProps: { name: 'John Doe' },
    a11yVariants: [
      { name: 'image and status', props: { src: 'photo.jpg', status: 'busy' } },
      { name: 'secondary text', props: { secondaryText: 'Software Engineer' } },
    ],
  });

  it('renders name text', () => {
    render(<Persona name="Alice Smith" />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  // data-display#29: absence asserted by content.
  it('renders secondaryText only when provided', () => {
    const { rerender } = render(<Persona name="Alice Smith" secondaryText="Software Engineer" />);
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    rerender(<Persona name="Alice Smith" />);
    expect(screen.queryByText('Software Engineer')).toBeNull();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('renders avatar with initials by default', () => {
    render(<Persona name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders avatar with src', () => {
    const { container } = render(<Persona name="John" src="https://example.com/photo.jpg" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  // data-display#27: the visible name is the only announcement of the name.
  describe('announces the name once', () => {
    it('hides the initials avatar (no second "John Doe" image)', () => {
      render(<Persona name="John Doe" />);
      expect(screen.queryByRole('img', { name: 'John Doe' })).toBeNull();
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('JD').closest('[aria-hidden="true"]')).not.toBeNull();
      expect(screen.getAllByText('John Doe')).toHaveLength(1);
    });

    it('renders the avatar image with empty alt text', () => {
      const { container } = render(<Persona name="John Doe" src="https://example.com/photo.jpg" />);
      expect(container.querySelector('img')).toHaveAttribute('alt', '');
      expect(screen.queryByRole('img', { name: 'John Doe' })).toBeNull();
    });
  });

  it('renders custom avatar slot', () => {
    render(<Persona name="John" avatar={<span data-testid="custom-avatar">AV</span>} />);
    expect(screen.getByTestId('custom-avatar')).toHaveTextContent('AV');
    expect(screen.queryByText('J')).toBeNull();
  });

  it('renders custom badge slot', () => {
    render(<Persona name="John" badge={<span data-testid="custom-badge">B</span>} />);
    expect(screen.getByTestId('custom-badge')).toHaveTextContent('B');
  });

  it('renders presence badge when status is provided', () => {
    render(<Persona name="John" status="available" />);
    expect(screen.getByRole('img', { name: 'Available' })).toBeInTheDocument();
  });

  // data-display#29: badge precedence.
  it('shows the custom badge instead of the status badge when both are given', () => {
    render(<Persona name="John" status="busy" badge={<span data-testid="custom-badge">B</span>} />);
    expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Busy' })).toBeNull();
  });

  // data-display#29: presence size mapping; the size reaches the avatar.
  it.each([
    ['extra-small', 'size-2.5', 'w-6'],
    ['small', 'size-2.5', 'w-8'],
    ['medium', 'size-3', 'w-10'],
    ['large', 'size-3', 'w-12'],
    ['extra-large', 'size-3', 'w-14'],
  ] as Array<[Size, string, string]>)(
    'a %s persona uses the %s presence badge and a %s avatar',
    (size, sizeClass, avatarWidth) => {
      render(<Persona name="John" size={size} status="away" />);
      expect(screen.getByRole('img', { name: 'Away' })).toHaveClass(sizeClass);
      // The decorative avatar visual around the initials.
      const avatar = screen.getByText('J').parentElement!;
      expect(avatar).toHaveAttribute('aria-hidden', 'true');
      expect(avatar).toHaveClass(avatarWidth, avatarWidth.replace('w-', 'h-'));
    },
  );

  // C-SLOTS: a badge or avatar slot that renders nothing (`badge={count && …}` with count 0, an
  // empty `.map()` result) is not given: the status badge and the built-in avatar are shown.
  it.each([
    ['0', () => 0],
    ['an empty array', () => []],
    ['an array of empty items', () => [null, false, '']],
  ] as Array<[string, () => PersonaProps['badge']]>)(
    'treats a badge or avatar set to %s as not given',
    (_kind, makeSlot) => {
      const { container } = render(
        <Persona name="John Doe" status="busy" badge={makeSlot()} avatar={makeSlot()} />,
      );
      expect(screen.getByRole('img', { name: 'Busy' })).toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(container).not.toHaveTextContent(/0/);
    },
  );

  // feedback-navigation#34
  it('positions the badge at the logical end corner (RTL-safe)', () => {
    renderWithProviders(<Persona name="John" status="available" />, { dir: 'rtl' });
    const badgeContainer = screen.getByRole('img', { name: 'Available' }).parentElement;
    expect(badgeContainer).toHaveClass('end-0', 'bottom-0');
    expect(badgeContainer?.className).not.toMatch(/\bright-0\b/);
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in PersonaProps (C-REF)', () => {
    expectTypeOf<PersonaProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });
});
