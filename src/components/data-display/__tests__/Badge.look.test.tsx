import * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
import type { BadgeProps } from '../Badge';
import { CounterBadge } from '../CounterBadge';
import type { CounterBadgeProps } from '../CounterBadge';
import { badgeColorClasses } from '../Badge.colors';
import { badgeClassNames } from '../../../lib/classNames';
import type { BadgeAppearance, BadgeColor, BadgeSize, Shape, Size } from '../../../lib/types';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

const COLORS = Object.keys(badgeColorClasses) as BadgeColor[];
const SHAPES: Array<[Shape, string]> = [
  ['circular', 'wave:rounded-full'],
  ['rounded', 'wave:rounded-md'],
  ['square', 'wave:rounded-none'],
];
const Glyph = () => (
  <svg data-testid="glyph" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" />
  </svg>
);

describe('Badge — ghost, shape, tiny and the icon slot (badge-3, badge-4, badge-5, badge-6)', () => {
  describe('ghost appearance', () => {
    it.each(COLORS)('%s draws its color as text, with no fill and no border', (color) => {
      render(
        <Badge appearance="ghost" color={color} data-testid="badge">
          Ghost
        </Badge>,
      );
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-appearance', 'ghost');
      expect(badge).toHaveClass(
        'wave:bg-transparent',
        ...badgeColorClasses[color].ghost.split(' '),
      );
      expect(badge).not.toHaveClass('wave:border');
    });

    it('every ghost color is a text color class', () => {
      for (const color of COLORS) {
        expect(badgeColorClasses[color].ghost).toMatch(/^wave:text-[a-z-]+$/);
      }
    });
  });

  describe('shape', () => {
    it.each(SHAPES)('shape "%s" draws %s and renders data-shape', (shape, cls) => {
      render(
        <Badge shape={shape} data-testid="badge">
          7
        </Badge>,
      );
      expect(screen.getByTestId('badge')).toHaveClass(cls);
      expect(screen.getByTestId('badge')).toHaveAttribute('data-shape', shape);
    });

    it('is circular by default, and only the shape sets the corners', () => {
      render(<Badge data-testid="badge">7</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-shape', 'circular');
      expect(badge).toHaveClass('wave:rounded-full');
      expect(badge).not.toHaveClass('wave:rounded-md', 'wave:rounded-none');
    });
  });

  describe('size', () => {
    it.each(['extra-small', 'small', 'medium', 'large', 'extra-large'] as Size[])(
      'renders data-size="%s"',
      (size) => {
        render(
          <Badge size={size} data-testid="badge">
            7
          </Badge>,
        );
        expect(screen.getByTestId('badge')).toHaveAttribute('data-size', size);
      },
    );

    it('tiny is a 6px dot: no content, no padding, the dot color', () => {
      render(
        <Badge size="tiny" aria-label="Unread" data-testid="badge">
          Hidden text
        </Badge>,
      );
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-size', 'tiny');
      expect(badge).toHaveClass('wave:h-1.5', 'wave:w-1.5', 'wave:p-0', 'wave:bg-primary');
      expect(badge).toBeEmptyDOMElement();
      expect(screen.getByRole('img', { name: 'Unread' })).toBe(badge);
    });

    it('a tiny badge draws no icon either', () => {
      render(<Badge size="tiny" icon={<Glyph />} data-testid="badge" />);
      expect(screen.queryByTestId('glyph')).not.toBeInTheDocument();
      expect(screen.getByTestId('badge')).toBeEmptyDOMElement();
    });

    it.each([
      ['filled', 'wave:bg-success'],
      ['tint', 'wave:bg-success'],
      ['ghost', 'wave:bg-success'],
      ['outline', 'wave:border-success'],
    ] as Array<[BadgeAppearance, string]>)(
      'a tiny %s badge draws %s (the dot colors, which stand out alone)',
      (appearance, cls) => {
        render(<Badge size="tiny" appearance={appearance} color="success" data-testid="badge" />);
        expect(screen.getByTestId('badge')).toHaveClass(cls);
      },
    );

    it('a tiny outline badge is a ring without a fill', () => {
      render(<Badge size="tiny" appearance="outline" data-testid="badge" />);
      expect(screen.getByTestId('badge')).toHaveClass('wave:bg-transparent', 'wave:border');
    });
  });

  describe('icon and iconPosition', () => {
    it('draws the icon in an aria-hidden span before the text, with the stable class', () => {
      render(
        <Badge icon={<Glyph />} data-testid="badge">
          Done
        </Badge>,
      );
      const badge = screen.getByTestId('badge');
      const icon = badge.querySelector(`.${badgeClassNames.icon}`);
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon?.tagName).toBe('SPAN');
      expect(icon).toContainElement(screen.getByTestId('glyph'));
      expect(badge.firstElementChild).toBe(icon);
      expect(badge).toHaveClass('wave:gap-1');
      expect(badge).toHaveTextContent('Done');
    });

    it('iconPosition="after" puts it after the text', () => {
      render(
        <Badge icon={<Glyph />} iconPosition="after" data-testid="badge">
          Done
        </Badge>,
      );
      const badge = screen.getByTestId('badge');
      expect(badge.lastElementChild).toHaveClass(badgeClassNames.icon);
      expect(badge.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    });

    it('takes a slot object, whose class follows the part and whose props reach the span', () => {
      render(
        <Badge
          icon={{ children: <Glyph />, className: 'mine', 'data-x': 'y' } as never}
          data-testid="b"
        >
          Done
        </Badge>,
      );
      const icon = screen.getByTestId('b').querySelector(`.${badgeClassNames.icon}`);
      expect(icon).toHaveClass('mine');
      expect(icon).toHaveAttribute('data-x', 'y');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it.each([undefined, null, false, '', []])('an icon of %j draws nothing and no gap', (icon) => {
      render(
        <Badge icon={icon as never} data-testid="badge">
          Done
        </Badge>,
      );
      expect(screen.getByTestId('badge').querySelector(`.${badgeClassNames.icon}`)).toBeNull();
      expect(screen.getByTestId('badge')).not.toHaveClass('wave:gap-1');
    });

    it('an icon-only badge keeps its name from aria-label', () => {
      render(<Badge icon={<Glyph />} aria-label="Verified" />);
      expect(screen.getByRole('img', { name: 'Verified' })).toBeInTheDocument();
    });

    it('sizes the glyph box with the badge', () => {
      render(
        <>
          <Badge size="extra-small" icon={<Glyph />} data-testid="xs" />
          <Badge size="medium" icon={<Glyph />} data-testid="md" />
          <Badge size="extra-large" icon={<Glyph />} data-testid="xl" />
        </>,
      );
      const box = (id: string) => screen.getByTestId(id).querySelector(`.${badgeClassNames.icon}`);
      expect(box('xs')).toHaveClass('wave:size-2.5');
      expect(box('md')).toHaveClass('wave:size-3');
      expect(box('xl')).toHaveClass('wave:size-4');
    });

    it('swaps sides with the writing direction (the order is by the inline axis, not the DOM)', () => {
      renderWithProviders(
        <Badge icon={<Glyph />} data-testid="badge">
          Done
        </Badge>,
        { dir: 'rtl' },
      );
      expect(screen.getByTestId('badge').firstElementChild).toHaveClass(badgeClassNames.icon);
    });
  });

  it('has no axe violations in the new looks', async () => {
    const { container } = render(
      <>
        <Badge appearance="ghost" color="danger">
          Ghost
        </Badge>
        <Badge shape="square" icon={<Glyph />} iconPosition="after">
          New
        </Badge>
        <Badge size="tiny" aria-label="Unread" />
      </>,
    );
    await expectNoA11yViolations(container);
  });

  it('types', () => {
    expectTypeOf<BadgeProps['shape']>().toEqualTypeOf<Shape | undefined>();
    expectTypeOf<BadgeProps['size']>().toEqualTypeOf<BadgeSize | undefined>();
    expectTypeOf<BadgeProps['appearance']>().toEqualTypeOf<BadgeAppearance | undefined>();
    expectTypeOf<BadgeSize>().toEqualTypeOf<'tiny' | Size>();
    // @ts-expect-error not a shape
    expect(<Badge shape="pill" />).toBeTruthy();
  });
});

describe('CounterBadge — ghost, shape and size (counterbadge-4)', () => {
  it('ghost draws the color as text with no fill and no border, in each color', () => {
    for (const color of COLORS) {
      const { unmount } = render(
        <CounterBadge count={4} appearance="ghost" color={color} data-testid="c" />,
      );
      const badge = screen.getByTestId('c');
      expect(badge).toHaveAttribute('data-appearance', 'ghost');
      expect(badge).toHaveClass(
        'wave:bg-transparent',
        ...badgeColorClasses[color].ghost.split(' '),
      );
      expect(badge).not.toHaveClass('wave:border');
      unmount();
    }
  });

  it('a ghost dot has no text to carry its color, so it is the filled dot', () => {
    render(<CounterBadge dot appearance="ghost" color="success" data-testid="c" />);
    expect(screen.getByTestId('c')).toHaveClass('wave:bg-success', 'wave:h-1.5');
  });

  it.each(SHAPES)('shape "%s" draws %s, on a count and on a dot', (shape, cls) => {
    render(
      <>
        <CounterBadge count={4} shape={shape} data-testid="count" />
        <CounterBadge dot shape={shape} data-testid="dot" />
      </>,
    );
    for (const id of ['count', 'dot']) {
      expect(screen.getByTestId(id)).toHaveClass(cls);
      expect(screen.getByTestId(id)).toHaveAttribute('data-shape', shape);
    }
  });

  it.each([
    ['extra-small', 'wave:h-3.5'],
    ['small', 'wave:h-4'],
    ['medium', 'wave:h-5'],
    ['large', 'wave:h-6'],
    ['extra-large', 'wave:h-8'],
  ] as Array<[Size, string]>)('size "%s" is %s tall and renders data-size', (size, cls) => {
    render(<CounterBadge count={4} size={size} data-testid="c" />);
    expect(screen.getByTestId('c')).toHaveClass(cls);
    expect(screen.getByTestId('c')).toHaveAttribute('data-size', size);
  });

  it('is medium by default, and a dot ignores the size', () => {
    render(
      <>
        <CounterBadge count={4} data-testid="count" />
        <CounterBadge dot size="extra-large" data-testid="dot" />
      </>,
    );
    expect(screen.getByTestId('count')).toHaveClass('wave:h-5', 'wave:min-w-5');
    expect(screen.getByTestId('count')).toHaveAttribute('data-size', 'medium');
    expect(screen.getByTestId('dot')).toHaveClass('wave:h-1.5');
    expect(screen.getByTestId('dot')).not.toHaveClass('wave:h-8');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <CounterBadge count={4} appearance="ghost" shape="rounded" size="large" />
        <CounterBadge dot aria-label="Unread" />
      </>,
    );
    await expectNoA11yViolations(container);
  });

  it('types', () => {
    expectTypeOf<CounterBadgeProps['appearance']>().toEqualTypeOf<
      'filled' | 'outline' | 'ghost' | undefined
    >();
    expectTypeOf<CounterBadgeProps['shape']>().toEqualTypeOf<Shape | undefined>();
    expectTypeOf<CounterBadgeProps['size']>().toEqualTypeOf<Size | undefined>();
  });
});
