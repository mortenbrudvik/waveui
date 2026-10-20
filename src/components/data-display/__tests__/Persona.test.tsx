import type * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
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

  describe('text lines, positions, presenceOnly and huge (0.13)', () => {
    const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;
    const primary = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('.wave-persona__primary-text')!;
    const secondary = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('.wave-persona__secondary-text')!;

    it('renders each text line only when given, in order', () => {
      const { container } = render(
        <Persona
          name="Jane Doe"
          secondaryText="Designer"
          tertiaryText="Oslo"
          quaternaryText="Away until 3"
        />,
      );
      const lines = Array.from(
        container.querySelectorAll(
          '.wave-persona__primary-text, .wave-persona__secondary-text, .wave-persona__tertiary-text, .wave-persona__quaternary-text',
        ),
      ).map((el) => el.textContent);
      expect(lines).toEqual(['Jane Doe', 'Designer', 'Oslo', 'Away until 3']);
    });

    it('omits lines that are not given', () => {
      const { container } = render(<Persona name="Jane Doe" tertiaryText="Oslo" />);
      expect(container.querySelector('.wave-persona__secondary-text')).toBeNull();
      expect(container.querySelector('.wave-persona__tertiary-text')).not.toBeNull();
      expect(container.querySelector('.wave-persona__quaternary-text')).toBeNull();
    });

    it('takes slots for the lines: elements and objects', () => {
      const { container } = render(
        <Persona
          name="Jane Doe"
          primaryText={<b>Dr. Jane Doe</b>}
          secondaryText={{ children: 'Designer', className: 'italic-line' }}
        />,
      );
      expect(primary(container).querySelector('b')?.textContent).toBe('Dr. Jane Doe');
      expect(secondary(container)).toHaveClass('italic-line');
      expect(secondary(container).textContent).toBe('Designer');
    });

    it('works without name when primaryText is given', () => {
      const { container } = render(<Persona primaryText="Jane Doe" />);
      expect(primary(container).textContent).toBe('Jane Doe');
    });

    it('warns once when there is neither a name nor primaryText', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Persona />);
      expect(warn.mock.calls).toEqual([[expect.stringContaining('Persona')]]);
      warn.mockRestore();
    });

    it.each([
      ['after', 'flex-row', 'items-start'],
      ['before', 'flex-row-reverse', 'items-start'],
      ['below', 'flex-col', 'items-center'],
    ] as const)('textPosition %s lays out with %s', (textPosition, layoutClass, alignClass) => {
      const { container } = render(
        <Persona name="Jane Doe" secondaryText="x" textPosition={textPosition} />,
      );
      expect(root(container)).toHaveAttribute('data-text-position', textPosition);
      if (textPosition === 'after')
        expect(root(container).className).not.toContain('flex-row-reverse');
      else expect(root(container)).toHaveClass(layoutClass);
      expect(primary(container).parentElement).toHaveClass(alignClass);
    });

    it('textAlignment defaults to start, center for below, and renders resolved', () => {
      const { container, rerender } = render(<Persona name="Jane Doe" />);
      expect(root(container)).toHaveAttribute('data-text-alignment', 'start');
      rerender(<Persona name="Jane Doe" textPosition="below" />);
      expect(root(container)).toHaveAttribute('data-text-alignment', 'center');
      rerender(<Persona name="Jane Doe" textPosition="below" textAlignment="start" />);
      expect(root(container)).toHaveAttribute('data-text-alignment', 'start');
      expect(primary(container).parentElement).toHaveClass('items-start', 'text-start');
    });

    it('presenceOnly shows the presence badge and no avatar, and keeps the text', () => {
      const { container } = render(<Persona name="Jane Doe" status="busy" presenceOnly />);
      expect(root(container)).toHaveAttribute('data-presence-only', '');
      expect(container.querySelector('.wave-avatar')).toBeNull();
      expect(screen.getByRole('img', { name: 'Busy' })).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('presenceOnly without a status shows only the text', () => {
      const { container } = render(<Persona name="Jane Doe" presenceOnly />);
      expect(container.querySelector('.wave-avatar')).toBeNull();
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('data-presence-only is absent otherwise', () => {
      const { container } = render(<Persona name="Jane Doe" />);
      expect(root(container)).not.toHaveAttribute('data-presence-only');
    });

    it('huge is a 72px avatar', () => {
      const { container } = render(<Persona name="Jane Doe" size="huge" />);
      expect(root(container)).toHaveAttribute('data-size', 'huge');
      expect(container.querySelector('.wave-avatar')).toHaveAttribute('data-size', '72');
    });

    it.each([
      ['extra-small', 'text-caption-1', 'text-caption-2'],
      ['small', 'text-body-1', 'text-caption-1'],
      ['medium', 'text-body-1', 'text-caption-1'],
      ['large', 'text-subtitle-2', 'text-body-1'],
      ['extra-large', 'text-subtitle-1', 'text-body-1'],
      ['huge', 'text-title-3', 'text-body-2'],
    ] as const)('the text of a %s persona is %s and %s', (size, primaryClass, secondaryClass) => {
      const { container } = render(
        <Persona name="Jane Doe" secondaryText="Designer" size={size} />,
      );
      expect(root(container)).toHaveAttribute('data-size', size);
      expect(primary(container)).toHaveClass(primaryClass);
      expect(secondary(container)).toHaveClass(secondaryClass);
    });

    it('a huge persona gets a large presence badge', () => {
      render(<Persona name="Jane Doe" status="busy" size="huge" />);
      expect(screen.getByRole('img', { name: 'Busy' })).toHaveClass('size-4');
    });

    it('announces the name once: the avatar is decorative and the status stays one image', () => {
      render(<Persona name="Jane Doe" secondaryText="Designer" status="away" />);
      expect(screen.getAllByText('Jane Doe')).toHaveLength(1);
      expect(screen.queryAllByRole('img', { name: 'Jane Doe' })).toHaveLength(0);
      expect(screen.getAllByRole('img')).toHaveLength(1);
      expect(screen.getByRole('img', { name: 'Away' })).toBeInTheDocument();
    });

    it('puts the text before the avatar on screen in right-to-left layouts for before, and keeps the badge corner logical', () => {
      const { container } = renderWithProviders(
        <Persona name="Jane Doe" status="busy" textPosition="before" />,
        { dir: 'rtl' },
      );
      expect(container.querySelector('.wave-persona')).toHaveClass('flex-row-reverse');
      expect(container.querySelector('.wave-persona__badge')).toHaveClass('end-0');
    });

    it('types the new props', () => {
      expectTypeOf<PersonaProps['size']>().toEqualTypeOf<Size | 'huge' | undefined>();
      expectTypeOf<PersonaProps['textPosition']>().toEqualTypeOf<
        'after' | 'before' | 'below' | undefined
      >();
      expectTypeOf<PersonaProps['textAlignment']>().toEqualTypeOf<'start' | 'center' | undefined>();
      expectTypeOf<PersonaProps['name']>().toEqualTypeOf<string | undefined>();
    });
  });
});
