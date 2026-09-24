import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from '../Avatar';
import type { AvatarProps } from '../Avatar';
import { PresenceBadge } from '../PresenceBadge';
import { expectNoA11yViolations, renderWithProviders, testSystemProps } from '../../../test-utils';
import type { Size } from '../../../lib/types';

const PHOTO = 'https://example.com/photo.jpg';

describe('Avatar', () => {
  testSystemProps(Avatar, {
    expectedTag: 'span',
    displayName: 'Avatar',
    defaultProps: { name: 'John Doe' },
    conflictingClass: { className: 'bg-error', overrides: 'bg-primary' },
    a11yVariants: [
      { name: 'image', props: { src: PHOTO } },
      { name: 'icon without name', props: { name: undefined, icon: <svg /> } },
      { name: 'decorative', props: { decorative: true } },
      { name: 'badge', props: { badge: <PresenceBadge status="busy" /> } },
    ],
  });

  // data-display#21: with a badge the outer wrapper is the root (ref, className, rest); the name
  // and role stay on the avatar visual, so aria-label is routed there (like a composite control).
  describe('with a badge', () => {
    testSystemProps(Avatar, {
      expectedTag: 'span',
      displayName: 'Avatar',
      defaultProps: { name: 'Jane Doe', badge: <PresenceBadge status="busy" /> },
      control: { role: 'img' },
    });

    it('puts ref, className and rest props on the wrapper that contains both the avatar and the badge', () => {
      const ref = React.createRef<HTMLSpanElement>();
      render(
        <Avatar
          ref={ref}
          name="Jane Doe"
          className="custom-root"
          data-testid="root"
          badge={<PresenceBadge status="busy" />}
        />,
      );
      const root = screen.getByTestId('root');
      const visual = screen.getByRole('img', { name: 'Jane Doe' });
      const badge = screen.getByRole('img', { name: 'Busy' });
      expect(ref.current).toBe(root);
      expect(root).toHaveClass('custom-root');
      expect(root).toContainElement(visual);
      expect(root).toContainElement(badge);
      expect(visual).not.toContainElement(badge);
      expect(visual).not.toHaveClass('custom-root');
    });

    it('routes a consumer aria-label, aria-labelledby and role to the avatar visual', () => {
      render(
        <>
          <span id="caption">Team lead</span>
          <Avatar
            name="Jane Doe"
            data-testid="root"
            aria-labelledby="caption"
            badge={<PresenceBadge status="away" />}
          />
        </>,
      );
      const visual = screen.getByRole('img', { name: 'Team lead' });
      expect(screen.getByTestId('root')).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByTestId('root')).not.toHaveAttribute('role');
      expect(visual).not.toBe(screen.getByTestId('root'));
    });

    it('routes a consumer aria-describedby, aria-description and aria-details to the avatar visual', () => {
      render(
        <>
          <span id="team-role">Team lead</span>
          <span id="bio">Joined in 2024</span>
          <Avatar
            name="Jane Doe"
            data-testid="root"
            aria-describedby="team-role"
            aria-description="On call"
            aria-details="bio"
            badge={<PresenceBadge status="busy" />}
          />
        </>,
      );
      const visual = screen.getByRole('img', { name: 'Jane Doe' });
      const root = screen.getByTestId('root');
      expect(visual).toHaveAccessibleDescription('Team lead');
      expect(visual).toHaveAttribute('aria-description', 'On call');
      expect(visual).toHaveAttribute('aria-details', 'bio');
      expect(root).not.toHaveAttribute('aria-describedby');
      expect(root).not.toHaveAttribute('aria-description');
      expect(root).not.toHaveAttribute('aria-details');
    });
  });

  it('renders initials from name', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  // data-display#22
  describe('initials', () => {
    it.each([
      ['John Doe', 'JD'],
      ['Alice', 'A'],
      ['john michael doe', 'JD'],
      ['  Ada   Lovelace ', 'AL'],
      ['élan', 'É'],
      ['mary-jane watson', 'MW'],
    ])('renders %j as %j', (name, initials) => {
      render(<Avatar name={name} />);
      const avatar = screen.getByRole('img', { name: name.trim().replace(/\s+/g, ' ') });
      expect(avatar).toHaveAttribute('aria-label', name.trim().replace(/\s+/g, ' '));
      expect(avatar).toHaveTextContent(initials);
    });

    it.each([[''], ['   '], ['\t\n']])(
      'falls back to the person icon for a blank name %j',
      (name) => {
        const { container } = render(<Avatar name={name} data-testid="avatar" />);
        const avatar = screen.getByTestId('avatar');
        expect(avatar.textContent).toBe('');
        // The shared PersonIcon (§5.7), decorative and scaled to the avatar.
        const glyph = container.querySelector('svg[data-wave-icon="person"]');
        expect(glyph).toHaveAttribute('aria-hidden', 'true');
        expect(glyph).toHaveAttribute('width', '60%');
        expect(glyph).toHaveAttribute('height', '60%');
        expect(avatar).toHaveClass('bg-muted', 'text-muted-foreground');
        expect(avatar).not.toHaveClass('bg-primary');
        // No name: the fallback glyph is decorative.
        expect(avatar).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByRole('img')).toBeNull();
      },
    );

    it.each([[''], ['   '], ['\t\n']])(
      'renders an empty alt for an image with a blank name %j',
      async (name) => {
        const { container } = render(<Avatar src={PHOTO} name={name} />);
        expect(container.querySelector('img')).toHaveAttribute('alt', '');
        expect(screen.queryByRole('img')).toBeNull();
        await expectNoA11yViolations();
      },
    );

    it('normalises the whitespace of the image alt text', () => {
      render(<Avatar src={PHOTO} name={'  Ada \t Lovelace '} />);
      expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
        'alt',
        'Ada Lovelace',
      );
    });
  });

  // data-display#19
  describe('accessible name', () => {
    it('names the initials avatar with role="img" and hides the initials', () => {
      render(<Avatar name="Jane Doe" data-testid="avatar" />);
      const avatar = screen.getByRole('img', { name: 'Jane Doe' });
      expect(avatar).toBe(screen.getByTestId('avatar'));
      expect(screen.getByText('JD')).toHaveAttribute('aria-hidden', 'true');
    });

    it('names the icon avatar when a name is given and hides the icon', () => {
      render(<Avatar name="Jane Doe" icon={<svg data-testid="glyph" />} />);
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toContainElement(
        screen.getByTestId('glyph'),
      );
      expect(screen.getByTestId('glyph').closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('hides an unnamed icon avatar from assistive technology', () => {
      render(<Avatar icon={<svg />} data-testid="avatar" />);
      expect(screen.getByTestId('avatar')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('names an icon avatar with a consumer aria-label', () => {
      render(<Avatar icon={<svg />} aria-label="Guest" data-testid="avatar" />);
      expect(screen.getByRole('img', { name: 'Guest' })).toBe(screen.getByTestId('avatar'));
      expect(screen.getByTestId('avatar')).not.toHaveAttribute('aria-hidden');
    });

    it('lets a consumer aria-label replace the name', () => {
      render(<Avatar name="Jane Doe" aria-label="Jane Doe, team lead" />);
      expect(screen.getByRole('img', { name: 'Jane Doe, team lead' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Jane Doe' })).toBeNull();
    });

    // A consumer role routes to the visual span together with the name (the name the image would
    // carry), and the image inside it is presentational: the children of role="img" are not
    // exposed, so a name left on the image would be lost (axe `role-img-alt`).
    it.each([
      ['src', { src: PHOTO, name: 'Jane' }, 'Jane'],
      [
        'src with a badge',
        { src: PHOTO, name: 'Jane', badge: <PresenceBadge status="busy" /> },
        'Jane',
      ],
      ['a string image slot', { image: PHOTO, name: 'Jane' }, 'Jane'],
      ['an object image slot', { image: { src: PHOTO }, name: 'Jane' }, 'Jane'],
      [
        'an element slot with an empty alt',
        { image: <img src={PHOTO} alt="" />, name: 'Jane' },
        'Jane',
      ],
    ] as Array<[string, AvatarProps, string]>)(
      'names the visual span for a consumer role="img" with an image (%s)',
      async (_mode, props, name) => {
        const { container } = render(<Avatar {...props} role="img" />);
        const named = screen.getByRole('img', { name });
        expect(named.tagName).toBe('SPAN');
        expect(named).toHaveAttribute('aria-label', name);
        const img = container.querySelector('img')!;
        expect(named).toContainElement(img);
        expect(img).toHaveAttribute('alt', '');
        await expectNoA11yViolations();
      },
    );

    it('names the visual span with the alt of an element image slot for a consumer role="img"', async () => {
      render(<Avatar role="img" image={<img src={PHOTO} alt="Custom" />} data-testid="avatar" />);
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveAttribute('role', 'img');
      expect(avatar).toHaveAttribute('aria-label', 'Custom');
      await expectNoA11yViolations();
    });

    it('leaves the name on the image for a presentational consumer role', async () => {
      render(
        <>
          <span id="team-role">Team lead</span>
          <Avatar
            role="presentation"
            src={PHOTO}
            name="Jane"
            aria-describedby="team-role"
            data-testid="avatar"
          />
        </>,
      );
      const img = screen.getByRole('img', { name: 'Jane' });
      expect(img.tagName).toBe('IMG');
      expect(img).toHaveAccessibleDescription('Team lead');
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveAttribute('role', 'presentation');
      expect(avatar).not.toHaveAttribute('aria-label');
      expect(avatar).not.toHaveAttribute('aria-describedby');
      await expectNoA11yViolations();
    });

    it('uses the name as the image alt text', () => {
      render(<Avatar src={PHOTO} name="John" />);
      const img = screen.getByRole('img', { name: 'John' });
      expect(img.tagName).toBe('IMG');
      expect(img).toHaveAttribute('src', PHOTO);
      expect(img).toHaveAttribute('alt', 'John');
    });

    it('exposes both the avatar name and a PresenceBadge sibling name', () => {
      render(<Avatar name="Jane Doe" badge={<PresenceBadge status="busy" />} />);
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Busy' })).toBeInTheDocument();
    });

    it('exposes both names for an image avatar with a badge', () => {
      render(<Avatar src={PHOTO} name="Jane Doe" badge={<PresenceBadge status="away" />} />);
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute('src', PHOTO);
      expect(screen.getByRole('img', { name: 'Away' })).toBeInTheDocument();
    });

    // The description goes to the element that carries the name, never to a role-less wrapper.
    it.each([
      ['initials', { name: 'Jane Doe' }, 'Jane Doe', 'SPAN'],
      [
        'initials with a badge',
        { name: 'Jane Doe', badge: <PresenceBadge status="busy" /> },
        'Jane Doe',
        'SPAN',
      ],
      ['image', { src: PHOTO, name: 'Jane Doe' }, 'Jane Doe', 'IMG'],
      [
        'image with a badge',
        { src: PHOTO, name: 'Jane Doe', badge: <PresenceBadge status="away" /> },
        'Jane Doe',
        'IMG',
      ],
      ['string image slot', { image: PHOTO, name: 'Jane Doe' }, 'Jane Doe', 'IMG'],
      ['element image slot', { image: <img src={PHOTO} alt="Custom" /> }, 'Custom', 'IMG'],
      ['object image slot', { image: { src: PHOTO }, name: 'Jane Doe' }, 'Jane Doe', 'IMG'],
      ['image named by aria-label', { src: PHOTO, 'aria-label': 'Jane' }, 'Jane', 'SPAN'],
      ['image with a consumer role', { src: PHOTO, name: 'Jane', role: 'img' }, 'Jane', 'SPAN'],
      ['icon named by aria-label', { icon: <svg />, 'aria-label': 'Guest' }, 'Guest', 'SPAN'],
    ] as Array<[string, AvatarProps, string, string]>)(
      'puts aria-describedby on the named element (%s)',
      (_mode, props, name, tagName) => {
        const { container } = render(
          <>
            <span id="team-role">Team lead</span>
            <Avatar {...props} aria-describedby="team-role" />
          </>,
        );
        const named = screen.getByRole('img', { name });
        expect(named.tagName).toBe(tagName);
        expect(named).toHaveAccessibleDescription('Team lead');
        expect(container.querySelectorAll('[aria-describedby]')).toHaveLength(1);
      },
    );

    // An image with an empty alt is presentational: a description on it would conflict with that
    // role (axe `presentation-role-conflict`), so it stays on the visual span, where it is inert.
    it.each([
      ['src without a name', { src: PHOTO }],
      ['src with a blank name', { src: PHOTO, name: '   ' }],
      ['string slot without a name', { image: PHOTO }],
      ['element slot with an empty alt', { image: <img src={PHOTO} alt="" /> }],
      [
        'element slot whose own empty alt wins',
        { image: <img src={PHOTO} alt="" />, name: 'Jane' },
      ],
      ['object slot without a name', { image: { src: PHOTO } }],
      ['object slot with an empty alt', { image: { src: PHOTO, alt: '' }, name: 'Jane' }],
    ] as Array<[string, AvatarProps]>)(
      'keeps aria-describedby off an unnamed image (%s)',
      async (_mode, props) => {
        const { container } = render(
          <>
            <span id="team-role">Team lead</span>
            <Avatar {...props} aria-describedby="team-role" data-testid="avatar" />
          </>,
        );
        const img = container.querySelector('img')!;
        expect(img).not.toHaveAttribute('aria-describedby');
        expect(screen.getByTestId('avatar')).toHaveAttribute('aria-describedby', 'team-role');
        expect(screen.queryByRole('img')).toBeNull();
        await expectNoA11yViolations();
      },
    );

    it.each([
      ['element', <img key="i" src={PHOTO} alt="Jane" aria-describedby="bio" />],
      ['object', { src: PHOTO, alt: 'Jane', 'aria-describedby': 'bio' }],
    ] as Array<[string, AvatarProps['image']]>)(
      'joins the aria-describedby of an %s image slot with the avatar description',
      (_form, image) => {
        render(
          <>
            <span id="team-role">Team lead</span>
            <span id="bio">Joined in 2024</span>
            <Avatar image={image} aria-describedby="team-role bio" />
          </>,
        );
        const img = screen.getByRole('img', { name: 'Jane' });
        expect(img).toHaveAttribute('aria-describedby', 'team-role bio');
        expect(img).toHaveAccessibleDescription('Team lead Joined in 2024');
      },
    );

    it('keeps the aria-describedby of an image slot when the avatar has none', () => {
      render(
        <>
          <span id="bio">Joined in 2024</span>
          <Avatar image={<img src={PHOTO} alt="Jane" aria-describedby="bio" />} />
        </>,
      );
      expect(screen.getByRole('img', { name: 'Jane' })).toHaveAccessibleDescription(
        'Joined in 2024',
      );
    });

    it("lets an image slot's own aria-description win over the avatar's", () => {
      render(
        <Avatar
          image={<img src={PHOTO} alt="Jane" aria-description="From the slot" />}
          aria-description="From the avatar"
        />,
      );
      expect(screen.getByRole('img', { name: 'Jane' })).toHaveAttribute(
        'aria-description',
        'From the slot',
      );
    });
  });

  // data-display#27
  describe('decorative', () => {
    it('hides an initials avatar and drops its role', () => {
      render(<Avatar name="Jane Doe" decorative data-testid="avatar" />);
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveAttribute('aria-hidden', 'true');
      expect(avatar).not.toHaveAttribute('role');
      expect(avatar).not.toHaveAttribute('aria-label');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('renders the image with empty alt text', () => {
      const { container } = render(<Avatar src={PHOTO} name="Jane Doe" decorative />);
      expect(container.querySelector('img')).toHaveAttribute('alt', '');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('keeps a badge exposed', () => {
      render(<Avatar name="Jane Doe" decorative badge={<PresenceBadge status="busy" />} />);
      expect(screen.queryByRole('img', { name: 'Jane Doe' })).toBeNull();
      expect(screen.getByRole('img', { name: 'Busy' })).toBeInTheDocument();
    });

    it('is typed as an optional boolean', () => {
      expectTypeOf<AvatarProps['decorative']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  // data-display#3
  describe('image slot', () => {
    it('treats a string as the image src', () => {
      render(<Avatar image={PHOTO} name="Jane Doe" />);
      const img = screen.getByRole('img', { name: 'Jane Doe' });
      expect(img.tagName).toBe('IMG');
      expect(img).toHaveAttribute('src', PHOTO);
      expect(img).toHaveClass('object-cover');
    });

    it('renders an element slot as the image itself (no nested children)', () => {
      render(<Avatar image={<img src={PHOTO} alt="Custom" className="custom-img" />} />);
      const img = screen.getByRole('img', { name: 'Custom' });
      expect(img).toHaveAttribute('src', PHOTO);
      expect(img).toHaveClass('object-cover', 'custom-img');
      expect(img.childNodes).toHaveLength(0);
    });

    it('accepts the object form with img attributes (no cast needed)', () => {
      render(<Avatar image={{ src: PHOTO, alt: 'From object', className: 'custom-img' }} />);
      const img = screen.getByRole('img', { name: 'From object' });
      expect(img).toHaveAttribute('src', PHOTO);
      expect(img).toHaveClass('object-cover', 'custom-img');
    });

    it('defaults the alt text of the object form to the name', () => {
      render(<Avatar name="Jane Doe" image={{ src: PHOTO }} />);
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute('src', PHOTO);
    });

    it('prioritizes the image slot over src', () => {
      render(
        <Avatar
          src="https://example.com/src.jpg"
          image={{ src: 'https://example.com/slot.jpg', alt: 'slot' }}
        />,
      );
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/slot.jpg');
    });
  });

  // data-display#4
  describe('image load failure', () => {
    it('falls back to the initials with their background when src fails to load', () => {
      const { container } = render(
        <Avatar src="https://example.com/missing.jpg" name="Jane Doe" data-testid="avatar" />,
      );
      const avatar = screen.getByTestId('avatar');
      expect(avatar).not.toHaveClass('bg-primary');
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toBe(avatar);
      expect(avatar).toHaveTextContent('JD');
      expect(avatar).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('falls back to the icon when an unnamed image fails', () => {
      const { container } = render(
        <Avatar src="https://example.com/missing.jpg" icon={<svg data-testid="glyph" />} />,
      );
      fireEvent.error(container.querySelector('img')!);
      expect(screen.getByTestId('glyph')).toBeInTheDocument();
    });

    it('retries when src changes', () => {
      const { container, rerender } = render(
        <Avatar src="https://example.com/missing.jpg" name="Jane Doe" />,
      );
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      rerender(<Avatar src={PHOTO} name="Jane Doe" />);
      expect(container.querySelector('img')).toHaveAttribute('src', PHOTO);
    });

    it('tracks failures of a string image slot and calls the object form onError', () => {
      const onError = vi.fn();
      const { container, rerender } = render(
        <Avatar image="https://example.com/missing.jpg" name="Jane Doe" />,
      );
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveTextContent('JD');

      rerender(<Avatar image={{ src: PHOTO, onError }} name="Jane Doe" />);
      fireEvent.error(container.querySelector('img')!);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(container.querySelector('img')).toBeNull();
    });
  });

  // data-display#31
  describe('icon slot', () => {
    it('renders a plain node inside an aria-hidden span', () => {
      render(<Avatar icon={<span data-testid="icon">IC</span>} />);
      const icon = screen.getByTestId('icon');
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(icon.parentElement?.tagName).toBe('SPAN');
    });

    it('accepts the object form with className and attributes', () => {
      render(
        <Avatar
          name="Jane Doe"
          icon={{ children: <svg />, className: 'custom-icon', 'data-testid': 'icon' }}
        />,
      );
      const icon = screen.getByTestId('icon');
      expect(icon).toHaveClass('custom-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    // A falsy icon (`icon={count && <Icon />}` with count === 0, or url === '') is no icon, as in
    // 0.4: it never renders a stray "0".
    describe.each([
      ['null', null],
      ['false', false],
      ['an empty string', ''],
      ['0', 0],
      ['NaN', NaN],
    ] as Array<[string, AvatarProps['icon']]>)('icon set to %s', (_kind, icon) => {
      it('falls back to the initials', () => {
        render(<Avatar name="Jane Doe" icon={icon} data-testid="avatar" />);
        const avatar = screen.getByRole('img', { name: 'Jane Doe' });
        expect(avatar).toHaveTextContent('JD');
        expect(avatar).toHaveClass('bg-primary');
      });

      it('falls back to the person glyph without a name', () => {
        const { container } = render(<Avatar icon={icon} data-testid="avatar" />);
        expect(container.querySelector('svg[data-wave-icon="person"]')).not.toBeNull();
        expect(screen.getByTestId('avatar').querySelectorAll('span')).toHaveLength(0);
        expect(screen.getByTestId('avatar')).toHaveTextContent('');
      });
    });

    // A collection whose items, at any depth, render nothing is no icon either (F2
    // `slotRendersContent`): e.g. `icon={items.map(…)}` that maps to nothing.
    describe.each([
      ['an empty array', () => []],
      ['an array of empty items', () => [null, false, '', [undefined]]],
      ['a Set of empty items', () => new Set([null, ''])],
      [
        'a generator of empty items',
        function* emptyItems() {
          yield null;
          yield '';
        },
      ],
    ] as Array<[string, () => AvatarProps['icon']]>)('icon set to %s', (_kind, makeIcon) => {
      it('falls back to the initials', () => {
        render(<Avatar name="Jane Doe" icon={makeIcon()} />);
        const avatar = screen.getByRole('img', { name: 'Jane Doe' });
        expect(avatar).toHaveTextContent('JD');
        expect(avatar).toHaveClass('bg-primary');
        expect(avatar).not.toHaveClass('bg-muted');
      });

      it('falls back to the person glyph without a name', () => {
        const { container } = render(<Avatar icon={makeIcon()} data-testid="avatar" />);
        expect(container.querySelector('svg[data-wave-icon="person"]')).not.toBeNull();
        expect(screen.getByTestId('avatar').querySelectorAll('span')).toHaveLength(0);
      });
    });

    // Checking a generator for content must not consume it: its items still render.
    it('renders the items of a generator icon that has content', () => {
      function* glyphs() {
        yield null;
        yield <svg key="glyph" data-testid="glyph" />;
      }
      render(<Avatar name="Jane Doe" icon={glyphs()} />);
      const avatar = screen.getByRole('img', { name: 'Jane Doe' });
      expect(screen.getByTestId('glyph').parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(avatar).toHaveClass('bg-muted');
      expect(avatar).not.toHaveTextContent('JD');
    });
  });

  // input-basic#8 / button-provider#3: token colors only.
  describe('colors', () => {
    it.each([
      ['initials', { name: 'Jane Doe' }, ['bg-primary', 'text-primary-foreground']],
      ['icon', { icon: <svg /> }, ['bg-muted', 'text-muted-foreground']],
      ['fallback', {}, ['bg-muted', 'text-muted-foreground']],
    ] as const)('%s mode uses token colors', (_mode, props, classes) => {
      render(<Avatar {...props} data-testid="avatar" />);
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveClass(...classes);
      expect(avatar.className).not.toMatch(/white|#/);
    });

    it('paints no background behind a loaded image', () => {
      render(<Avatar src={PHOTO} name="Jane Doe" data-testid="avatar" />);
      // One class per assertion: a multi-class `.not.toHaveClass` passes when any one is missing.
      expect(screen.getByTestId('avatar')).not.toHaveClass('bg-primary');
      expect(screen.getByTestId('avatar')).not.toHaveClass('bg-muted');
    });
  });

  // data-display#16
  it.each([
    ['extra-small', 'w-6'],
    ['small', 'w-8'],
    ['medium', 'w-10'],
    ['large', 'w-12'],
    ['extra-large', 'w-14'],
  ] as Array<[Size, string]>)('size %s renders %s', (size, width) => {
    render(<Avatar size={size} name="A" data-testid="avatar" />);
    expect(screen.getByTestId('avatar')).toHaveClass(width, width.replace('w-', 'h-'));
  });

  // feedback-navigation#34
  it('positions the badge at the logical end corner (RTL-safe)', () => {
    renderWithProviders(
      <Avatar name="Jane Doe" badge={{ children: 'online', 'data-testid': 'badge' }} />,
      { dir: 'rtl' },
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('end-0', 'bottom-0');
    expect(badge.className).not.toMatch(/\bright-0\b/);
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in AvatarProps (C-REF)', () => {
    expectTypeOf<AvatarProps['ref']>().toEqualTypeOf<React.Ref<HTMLSpanElement> | undefined>();
  });
});
