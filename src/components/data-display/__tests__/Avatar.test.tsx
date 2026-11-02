import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { avatarClassNames } from '../../../lib/classNames';
import { Avatar } from '../Avatar';
import type { AvatarProps } from '../Avatar';
import { hashToNamedColor, type AvatarNamedColor } from '../Avatar.colors';
import { AvatarSizeContext, type AvatarSizeContextValue } from '../Avatar.context';
import { PresenceBadge } from '../PresenceBadge';
import { Tag } from '../Tag';
import { InteractionTag } from '../InteractionTag';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';
import type { Size } from '../../../lib/types';

const PHOTO = 'https://example.com/photo.jpg';

describe('Avatar', () => {
  testSystemProps(Avatar, {
    expectedTag: 'span',
    displayName: 'Avatar',
    defaultProps: { name: 'John Doe' },
    conflictingClass: { className: 'bg-error', overrides: 'wave:bg-primary' },
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

    // A falsy badge (`badge={count && <CounterBadge
    // … />}` with count 0) is no badge, as in 0.4 and like `icon`, and so is a collection whose
    // items render nothing: no stray "0" in the corner, and the root props stay on the avatar.
    describe.each([
      ['null', () => null],
      ['false', () => false],
      ['an empty string', () => ''],
      ['0', () => 0],
      ['NaN', () => NaN],
      ['an empty array', () => []],
      ['an array of empty items', () => [null, false, '', [undefined]]],
    ] as Array<[string, () => AvatarProps['badge']]>)('badge set to %s', (_kind, makeBadge) => {
      it('renders the avatar without a badge wrapper', () => {
        const ref = React.createRef<HTMLSpanElement>();
        const { container } = render(
          <Avatar
            ref={ref}
            name="Jane Doe"
            badge={makeBadge()}
            className="custom-root"
            data-testid="avatar"
          />,
        );
        const avatar = screen.getByTestId('avatar');
        expect(screen.getByRole('img', { name: 'Jane Doe' })).toBe(avatar);
        expect(container.firstElementChild).toBe(avatar);
        expect(ref.current).toBe(avatar);
        expect(avatar).toHaveClass('custom-root');
        expect(avatar.textContent).toBe('JD');
      });
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
        expect(avatar).toHaveClass('wave:bg-muted', 'wave:text-muted-foreground');
        expect(avatar).not.toHaveClass('wave:bg-primary');
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
      expect(img).toHaveClass('wave:object-cover');
    });

    it('renders an element slot as the image itself (no nested children)', () => {
      render(<Avatar image={<img src={PHOTO} alt="Custom" className="custom-img" />} />);
      const img = screen.getByRole('img', { name: 'Custom' });
      expect(img).toHaveAttribute('src', PHOTO);
      expect(img).toHaveClass('wave:object-cover', 'custom-img');
      expect(img.childNodes).toHaveLength(0);
    });

    it('accepts the object form with img attributes (no cast needed)', () => {
      render(<Avatar image={{ src: PHOTO, alt: 'From object', className: 'custom-img' }} />);
      const img = screen.getByRole('img', { name: 'From object' });
      expect(img).toHaveAttribute('src', PHOTO);
      expect(img).toHaveClass('wave:object-cover', 'custom-img');
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

    // An undefined slot alt (an optional `alt: user.photoAlt`, or a wrapper
    // forwarding `alt={alt}`) is no alt of its own, so the image alt still defaults to `name`.
    describe.each([
      ['object', () => ({ src: PHOTO, alt: undefined })],
      ['element', () => <img src={PHOTO} alt={undefined} />],
    ] as Array<[string, () => AvatarProps['image']]>)(
      'an %s image slot whose alt is undefined',
      (_form, makeImage) => {
        it('takes the name as its alt', async () => {
          const { container } = render(
            <>
              <span id="team-role">Team lead</span>
              <Avatar name="Jane Doe" image={makeImage()} aria-describedby="team-role" />
            </>,
          );
          const img = screen.getByRole('img', { name: 'Jane Doe' });
          expect(img.tagName).toBe('IMG');
          expect(img).toHaveAttribute('alt', 'Jane Doe');
          expect(img).toHaveAccessibleDescription('Team lead');
          expect(container.querySelectorAll('[aria-describedby]')).toHaveLength(1);
          await expectNoA11yViolations();
        });

        it('server-renders the name as its alt', () => {
          const html = renderToString(<Avatar name="Jane Doe" image={makeImage()} />);
          expect(html).toContain('alt="Jane Doe"');
        });

        it.each([
          ['decorative', { decorative: true }],
          ['named by aria-label', { 'aria-label': 'Jane, team lead' }],
          ['without a name', { name: undefined }],
        ] as Array<[string, Partial<AvatarProps>]>)(
          'takes an empty alt when the avatar is %s',
          (_case, props) => {
            const { container } = render(<Avatar name="Jane Doe" image={makeImage()} {...props} />);
            expect(container.querySelector('img')).toHaveAttribute('alt', '');
          },
        );
      },
    );
  });

  // data-display#4
  describe('image load failure', () => {
    it('falls back to the initials with their background when src fails to load', () => {
      const { container } = render(
        <Avatar src="https://example.com/missing.jpg" name="Jane Doe" data-testid="avatar" />,
      );
      const avatar = screen.getByTestId('avatar');
      expect(avatar).not.toHaveClass('wave:bg-primary');
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toBe(avatar);
      expect(avatar).toHaveTextContent('JD');
      expect(avatar).toHaveClass('wave:bg-primary', 'wave:text-primary-foreground');
    });

    // An image slot's own alt names the avatar (the avatar has no `name`).
    // That name survives a load failure: the fallback visual carries it instead of turning
    // aria-hidden. The alt describes the image, so no initials are made from it.
    it.each([
      ['object', () => ({ src: 'https://example.com/expired.png', alt: '  Bob   Smith ' })],
      ['element', () => <img src="https://example.com/expired.png" alt="Bob Smith" />],
    ] as Array<[string, () => AvatarProps['image']]>)(
      'keeps the name given by the alt of an %s image slot when the image fails',
      async (_form, makeImage) => {
        const { container } = render(<Avatar image={makeImage()} data-testid="avatar" />);
        expect(screen.getByRole('img', { name: 'Bob Smith' }).tagName).toBe('IMG');
        fireEvent.error(container.querySelector('img')!);
        expect(container.querySelector('img')).toBeNull();
        const avatar = screen.getByRole('img', { name: 'Bob Smith' });
        expect(avatar).toBe(screen.getByTestId('avatar'));
        expect(avatar).toHaveAttribute('aria-label', 'Bob Smith');
        expect(avatar).not.toHaveAttribute('aria-hidden');
        expect(container.querySelector('svg[data-wave-icon="person"]')).not.toBeNull();
        await expectNoA11yViolations();
      },
    );

    it.each([
      [
        'the name over the slot alt',
        { name: 'Jane Doe', image: { src: 'bad.png', alt: 'Portrait' } },
        'Jane Doe',
      ],
      [
        'a consumer role with the slot alt',
        { role: 'img', image: { src: 'bad.png', alt: 'Bob Smith' } },
        'Bob Smith',
      ],
    ] as Array<[string, AvatarProps, string]>)(
      'names the fallback with %s when the image fails',
      (_case, props, name) => {
        const { container } = render(<Avatar {...props} data-testid="avatar" />);
        fireEvent.error(container.querySelector('img')!);
        expect(screen.getByRole('img', { name })).toBe(screen.getByTestId('avatar'));
      },
    );

    it.each([
      ['decorative', { decorative: true, image: { src: 'bad.png', alt: 'Bob Smith' } }],
      ['named by an empty slot alt', { image: { src: 'bad.png', alt: '' } }],
      ['named by a blank slot alt', { image: <img src="bad.png" alt="   " /> }],
    ] as Array<[string, AvatarProps]>)(
      'keeps a failed image avatar hidden when it is %s',
      (_case, props) => {
        const { container } = render(<Avatar {...props} data-testid="avatar" />);
        fireEvent.error(container.querySelector('img')!);
        expect(screen.getByTestId('avatar')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByRole('img')).toBeNull();
      },
    );

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

    // A framework image component whose `src` is not a string (a static-import object).
    interface StaticImage {
      url: string;
    }
    type FrameworkImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
      src?: StaticImage;
    };
    const FrameworkImage = ({ src, alt = '', ...props }: FrameworkImageProps) => (
      <img src={src?.url} alt={alt} {...props} />
    );

    it('retries when an element slot gets another non-string src, not an equal one', () => {
      const { container, rerender } = render(
        <Avatar name="Jane Doe" image={<FrameworkImage src={{ url: 'bad.png' }} />} />,
      );
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();

      // An inline object with the same content is the same image: no retry on every render.
      rerender(<Avatar name="Jane Doe" image={<FrameworkImage src={{ url: 'bad.png' }} />} />);
      expect(container.querySelector('img')).toBeNull();

      // Another person's image is tried.
      rerender(<Avatar name="Jane Doe" image={<FrameworkImage src={{ url: 'good.png' }} />} />);
      expect(container.querySelector('img')).toHaveAttribute('src', 'good.png');
    });

    it('retries when an object slot gets another srcSet', () => {
      const { container, rerender } = render(
        <Avatar name="Jane Doe" image={{ src: 'bad.png', srcSet: 'bad.png 1x' }} />,
      );
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      rerender(<Avatar name="Jane Doe" image={{ src: 'bad.png', srcSet: 'good.png 1x' }} />);
      expect(container.querySelector('img')).toHaveAttribute('srcset', 'good.png 1x');
    });

    it('retries when an element slot without src gets another srcSet or key', () => {
      const { container, rerender } = render(
        <Avatar name="Jane Doe" image={<img srcSet="bad.png 1x" alt="" />} />,
      );
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      rerender(<Avatar name="Jane Doe" image={<img srcSet="good.png 1x" alt="" />} />);
      expect(container.querySelector('img')).toHaveAttribute('srcset', 'good.png 1x');

      rerender(<Avatar name="Jane Doe" image={<FrameworkImage key="jane" />} />);
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      rerender(<Avatar name="Jane Doe" image={<FrameworkImage key="john" />} />);
      expect(container.querySelector('img')).not.toBeNull();
    });

    describe('an image that failed before hydration', () => {
      /**
       * Server-renders `ui`, lets `prepare` settle the image state of the server markup (as the
       * browser does before the client script runs), then hydrates it. React attaches its `error`
       * listener during hydration and does not replay an event that already fired. Returns what
       * React logged while hydrating (a mismatch), to assert that it is nothing.
       */
      async function hydrate(ui: React.ReactElement, prepare: (img: HTMLImageElement) => void) {
        const host = document.createElement('div');
        host.innerHTML = renderToString(ui);
        document.body.appendChild(host);
        prepare(host.querySelector('img')!);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        let root: ReturnType<typeof hydrateRoot>;
        let hydrationErrors: unknown[][];
        try {
          root = await act(async () => hydrateRoot(host, ui));
        } finally {
          // Copied before the restore, which clears the recorded calls.
          hydrationErrors = [...errors.mock.calls];
          errors.mockRestore();
        }
        return {
          host,
          hydrationErrors,
          rerender(next: React.ReactElement) {
            act(() => root.render(next));
          },
          cleanup() {
            act(() => root.unmount());
            host.remove();
          },
        };
      }

      /** A settled image: `complete`, with the given natural width and `decode()` behaviour. */
      function settle(img: HTMLImageElement, naturalWidth: number, decode?: () => Promise<void>) {
        Object.defineProperty(img, 'complete', { configurable: true, get: () => true });
        Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => naturalWidth });
        if (decode) Object.defineProperty(img, 'decode', { configurable: true, value: decode });
      }

      const ui = <Avatar name="Jane Doe" src="https://example.com/expired.jpg" />;

      it('falls back to the initials (no decode support)', async () => {
        const { host, hydrationErrors, cleanup } = await hydrate(ui, (img) => {
          settle(img, 0);
          img.dispatchEvent(new Event('error'));
        });
        try {
          expect(hydrationErrors).toEqual([]);
          expect(host.querySelector('img')).toBeNull();
          const avatar = screen.getByRole('img', { name: 'Jane Doe' });
          expect(avatar).toHaveTextContent('JD');
          expect(avatar).toHaveClass('wave:bg-primary');
        } finally {
          cleanup();
        }
      });

      it('falls back to the initials when decode() rejects', async () => {
        const decode = vi.fn(() => Promise.reject(new DOMException('broken', 'EncodingError')));
        const { host, hydrationErrors, cleanup } = await hydrate(ui, (img) => {
          settle(img, 0, decode);
          img.dispatchEvent(new Event('error'));
        });
        try {
          expect(hydrationErrors).toEqual([]);
          expect(decode).toHaveBeenCalledTimes(1);
          expect(host.querySelector('img')).toBeNull();
          expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveTextContent('JD');
        } finally {
          cleanup();
        }
      });

      it.each([
        ['an element slot', { image: <FrameworkImage src={{ url: 'expired.png' }} /> }],
        [
          'an avatar with a badge',
          { src: 'https://example.com/expired.jpg', badge: <PresenceBadge status="busy" /> },
        ],
      ] as Array<[string, AvatarProps]>)('checks %s too', async (_case, props) => {
        const { host, hydrationErrors, cleanup } = await hydrate(
          <Avatar name="Jane Doe" {...props} />,
          (img) => {
            settle(img, 0);
            img.dispatchEvent(new Event('error'));
          },
        );
        try {
          expect(hydrationErrors).toEqual([]);
          expect(host.querySelector('img')).toBeNull();
          expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveTextContent('JD');
        } finally {
          cleanup();
        }
      });

      it('keeps a loaded image without a natural size (an SVG whose decode() resolves)', async () => {
        const svg = <Avatar name="Jane Doe" src="https://example.com/jane.svg" />;
        const { host, hydrationErrors, cleanup } = await hydrate(svg, (img) => {
          settle(img, 0, () => Promise.resolve());
        });
        try {
          expect(hydrationErrors).toEqual([]);
          expect(host.querySelector('img')).toHaveAttribute('alt', 'Jane Doe');
        } finally {
          cleanup();
        }
      });

      it('keeps a loaded image and one that is still loading', async () => {
        const loaded = await hydrate(ui, (img) => settle(img, 96));
        try {
          expect(loaded.hydrationErrors).toEqual([]);
          expect(loaded.host.querySelector('img')).toHaveAttribute('alt', 'Jane Doe');
        } finally {
          loaded.cleanup();
        }
        // jsdom never loads the image: `complete` stays false, as while the browser loads it.
        const loading = await hydrate(ui, () => {});
        try {
          expect(loading.hydrationErrors).toEqual([]);
          expect(loading.host.querySelector('img')).toHaveAttribute('alt', 'Jane Doe');
        } finally {
          loading.cleanup();
        }
      });

      it('ignores a late verdict on a source that was replaced meanwhile', async () => {
        let rejectDecode: (reason: unknown) => void = () => {};
        const decode = () =>
          new Promise<void>((_resolve, reject) => {
            rejectDecode = reject;
          });
        const { host, hydrationErrors, rerender, cleanup } = await hydrate(ui, (img) => {
          settle(img, 0, decode);
        });
        try {
          expect(hydrationErrors).toEqual([]);
          // The client moves on to another photo before the check of the old one settles.
          rerender(<Avatar name="Jane Doe" src={PHOTO} />);
          await act(async () => rejectDecode(new DOMException('broken', 'EncodingError')));
          expect(host.querySelector('img')).toHaveAttribute('src', PHOTO);
        } finally {
          cleanup();
        }
      });
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
        expect(avatar).toHaveClass('wave:bg-primary');
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
        expect(avatar).toHaveClass('wave:bg-primary');
        expect(avatar).not.toHaveClass('wave:bg-muted');
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
      expect(avatar).toHaveClass('wave:bg-muted');
      expect(avatar).not.toHaveTextContent('JD');
    });
  });

  // input-basic#8 / button-provider#3: token colors only.
  describe('colors', () => {
    it.each([
      ['initials', { name: 'Jane Doe' }, ['wave:bg-primary', 'wave:text-primary-foreground']],
      ['icon', { icon: <svg /> }, ['wave:bg-muted', 'wave:text-muted-foreground']],
      ['fallback', {}, ['wave:bg-muted', 'wave:text-muted-foreground']],
    ] as const)('%s mode uses token colors', (_mode, props, classes) => {
      render(<Avatar {...props} data-testid="avatar" />);
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveClass(...classes);
      expect(avatar.className).not.toMatch(/white|#/);
    });

    it('paints no background behind a loaded image', () => {
      render(<Avatar src={PHOTO} name="Jane Doe" data-testid="avatar" />);
      // One class per assertion: a multi-class `.not.toHaveClass` passes when any one is missing.
      expect(screen.getByTestId('avatar')).not.toHaveClass('wave:bg-primary');
      expect(screen.getByTestId('avatar')).not.toHaveClass('wave:bg-muted');
    });
  });

  // data-display#16
  it.each([
    ['extra-small', 'wave:w-6'],
    ['small', 'wave:w-8'],
    ['medium', 'wave:w-10'],
    ['large', 'wave:w-12'],
    ['extra-large', 'wave:w-14'],
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
    expect(badge).toHaveClass('wave:end-0', 'wave:bottom-0');
    expect(badge.className).not.toMatch(/\bright-0\b/);
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in AvatarProps (C-REF)', () => {
    expectTypeOf<AvatarProps['ref']>().toEqualTypeOf<React.Ref<HTMLSpanElement> | undefined>();
  });

  // 0.11 spec §1.10: the internal box that Tag and InteractionTag media give an Avatar.
  describe('AvatarSizeContext', () => {
    const inBox = (size: AvatarSizeContextValue['size'], ui: React.ReactNode) => (
      <AvatarSizeContext.Provider value={{ size }}>{ui}</AvatarSizeContext.Provider>
    );

    it.each([
      [24, 'wave:w-6', 'wave:h-6'],
      [20, 'wave:w-5', 'wave:h-5'],
      [16, 'wave:w-4', 'wave:h-4'],
    ] as const)(
      'an Avatar without size takes the box of AvatarSizeContext (%dpx)',
      (size, width, height) => {
        render(inBox(size, <Avatar name="Jane Doe" />));
        const avatar = screen.getByRole('img', { name: 'Jane Doe' });
        expect(avatar).toHaveClass(width, height, 'wave:text-[10px]');
        expect(avatar).not.toHaveClass('wave:w-10');
        expect(avatar).not.toHaveClass('wave:h-10');
        expect(avatar).not.toHaveClass('wave:text-sm');
        // The box is reported as the resolved size (0.13).
        expect(avatar).toHaveAttribute('data-size', String(size));
      },
    );

    it('keeps the person glyph at 60% of the box', () => {
      const { container } = render(inBox(16, <Avatar data-testid="avatar" />));
      expect(screen.getByTestId('avatar')).toHaveClass('wave:w-4', 'wave:h-4');
      expect(container.querySelector('svg')).toHaveAttribute('width', '60%');
    });

    it('its own size wins over the context', () => {
      render(inBox(16, <Avatar name="Jane Doe" size="large" />));
      const avatar = screen.getByRole('img', { name: 'Jane Doe' });
      expect(avatar).toHaveClass('wave:w-12', 'wave:h-12', 'wave:text-base');
      expect(avatar).not.toHaveClass('wave:w-4');
      expect(avatar).not.toHaveClass('wave:h-4');
    });

    it('outside the context it keeps the medium classes', () => {
      render(
        <>
          <Avatar name="Jane Doe" />
          <AvatarSizeContext.Provider value={null}>
            <Avatar name="John Doe" />
          </AvatarSizeContext.Provider>
        </>,
      );
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveClass(
        'wave:w-10',
        'wave:h-10',
        'wave:text-sm',
      );
      expect(screen.getByRole('img', { name: 'John Doe' })).toHaveClass(
        'wave:w-10',
        'wave:h-10',
        'wave:text-sm',
      );
    });

    it('with a badge the visual is sized, not the wrapper', () => {
      render(
        inBox(
          20,
          <Avatar name="Jane Doe" badge={<PresenceBadge status="busy" />} data-testid="root" />,
        ),
      );
      const root = screen.getByTestId('root');
      const visual = screen.getByRole('img', { name: 'Jane Doe' });
      expect(root).not.toBe(visual);
      expect(visual).toHaveClass('wave:w-5', 'wave:h-5', 'wave:text-[10px]');
      expect(root).not.toHaveClass('wave:w-5');
      expect(root).not.toHaveClass('wave:h-5');
    });

    it('is null by default and named for React DevTools', () => {
      expectTypeOf(AvatarSizeContext).toEqualTypeOf<React.Context<AvatarSizeContextValue | null>>();
      expectTypeOf<AvatarSizeContextValue['size']>().toEqualTypeOf<number>();
      expect(AvatarSizeContext.displayName).toBe('AvatarSizeContext');
      let value: AvatarSizeContextValue | null | undefined;
      const Probe = () => {
        value = React.useContext(AvatarSizeContext);
        return null;
      };
      render(<Probe />);
      expect(value).toBeNull();
    });
  });

  describe('shape and numeric sizes (0.13)', () => {
    const NAMED = [
      ['extra-small', 24],
      ['small', 32],
      ['medium', 40],
      ['large', 48],
      ['extra-large', 56],
    ] as const;
    const NUMERIC = [16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120, 128] as const;
    const visual = () => screen.getByRole('img');

    it.each(NAMED)('the named size %s keeps its 0.12 box of %dpx', (size, px) => {
      render(<Avatar name="Jane Doe" size={size} />);
      expect(visual()).toHaveAttribute('data-size', size);
      expect(visual().className).toContain(`wave:w-${px / 4}`);
      expect(visual().className).toContain(`wave:h-${px / 4}`);
    });

    it.each(NUMERIC)('the numeric size %d renders its box', (px) => {
      render(<Avatar name="Jane Doe" size={px} />);
      expect(visual()).toHaveAttribute('data-size', String(px));
      expect(visual().className).toContain(`wave:w-${px / 4}`);
      expect(visual().className).toContain(`wave:h-${px / 4}`);
    });

    it('defaults to medium and renders the resolved data-size and data-shape', () => {
      render(<Avatar name="Jane Doe" />);
      expect(visual()).toHaveAttribute('data-size', 'medium');
      expect(visual()).toHaveAttribute('data-shape', 'circular');
      expect(visual().className).toContain('wave:rounded-full');
    });

    it('a square avatar is rounded-md from 40px and rounded-sm below', () => {
      const { rerender } = render(<Avatar name="Jane Doe" shape="square" size={40} />);
      expect(visual()).toHaveAttribute('data-shape', 'square');
      expect(visual().className).toContain('wave:rounded-md');
      expect(visual().className).not.toContain('wave:rounded-full');
      rerender(<Avatar name="Jane Doe" shape="square" size={24} />);
      expect(visual().className).toContain('wave:rounded-sm');
    });

    it('with a badge the data attributes are on the root and the visual is sized', () => {
      const { container } = render(
        <Avatar name="Jane Doe" size={64} shape="square" badge={<PresenceBadge status="busy" />} />,
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('data-size', '64');
      expect(root).toHaveAttribute('data-shape', 'square');
    });

    it('a rounded Tag gives its Avatar a square shape and a circular Tag a circular one', () => {
      const { rerender } = render(
        <Tag shape="rounded" media={<Avatar name="Jane Doe" />}>
          Jane
        </Tag>,
      );
      expect(visual()).toHaveAttribute('data-shape', 'square');
      rerender(
        <Tag shape="circular" media={<Avatar name="Jane Doe" />}>
          Jane
        </Tag>,
      );
      expect(visual()).toHaveAttribute('data-shape', 'circular');
    });

    it('an InteractionTag.Primary passes its shape too', () => {
      const { container } = render(
        <InteractionTag shape="rounded">
          <InteractionTag.Primary media={<Avatar name="Jane Doe" />}>Jane</InteractionTag.Primary>
        </InteractionTag>,
      );
      // The Avatar sits inside a button, whose children are presentational for the role queries.
      expect(container.querySelector('.wave-avatar')).toHaveAttribute('data-shape', 'square');
    });

    it("an Avatar's own shape wins over the Tag's", () => {
      render(
        <Tag shape="rounded" media={<Avatar name="Jane Doe" shape="circular" />}>
          Jane
        </Tag>,
      );
      expect(visual()).toHaveAttribute('data-shape', 'circular');
    });

    it('the 16, 20 and 24px tag boxes are unchanged', () => {
      render(
        <AvatarSizeContext.Provider value={{ size: 16 }}>
          <Avatar name="Jane Doe" />
        </AvatarSizeContext.Provider>,
      );
      expect(visual().className).toContain('wave:w-4');
      expect(visual()).toHaveAttribute('data-size', '16');
    });

    it('types the numeric sizes next to the named ones', () => {
      expectTypeOf<AvatarProps['size']>().toEqualTypeOf<
        Size | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 72 | 96 | 120 | 128 | undefined
      >();
      expectTypeOf<AvatarProps['shape']>().toEqualTypeOf<'circular' | 'square' | undefined>();
      // @ts-expect-error 50 is not a size
      void (<Avatar size={50} />);
    });
  });

  describe('initials (0.13)', () => {
    const initialsOf = (container: HTMLElement) =>
      container.querySelector('.wave-avatar__initials')?.textContent;

    it('strips brackets and punctuation: Jane Doe (Contoso) gives JD', () => {
      const { container } = render(<Avatar name="Jane Doe (Contoso)" />);
      expect(initialsOf(container)).toBe('JD');
    });

    it('swaps the two initials in right-to-left layouts', () => {
      const { container } = renderWithProviders(<Avatar name="Jane Doe" />, { dir: 'rtl' });
      expect(initialsOf(container)).toBe('DJ');
    });

    it('shows the person glyph for a name without initials (a phone number, ideographs)', () => {
      const { container, rerender } = render(<Avatar name="+1 (555) 010-0000" />);
      expect(initialsOf(container)).toBeUndefined();
      expect(container.querySelector('svg')).not.toBeNull();
      rerender(<Avatar name="田中太郎" />);
      expect(initialsOf(container)).toBeUndefined();
      expect(container.querySelector('svg')).not.toBeNull();
    });

    it.each([
      ['a string', 'XY'],
      ['an element', <b key="b">XY</b>],
    ])('the initials slot replaces the computed initials (%s)', (_label, slot) => {
      const { container } = render(<Avatar name="Jane Doe" initials={slot} />);
      const node = container.querySelector('.wave-avatar__initials');
      expect(node?.textContent).toBe('XY');
      expect(node).toHaveAttribute('aria-hidden', 'true');
      expect(container.textContent).not.toContain('JD');
    });

    it('an object slot adds its props to the initials element', () => {
      const { container } = render(
        <Avatar name="Jane Doe" initials={{ children: 'XY', className: 'font-black' }} />,
      );
      const node = container.querySelector('.wave-avatar__initials');
      expect(node?.textContent).toBe('XY');
      expect(node).toHaveClass('font-black');
    });

    it('an initials slot works without a name', () => {
      const { container } = render(<Avatar initials="XY" />);
      expect(initialsOf(container)).toBe('XY');
    });

    it.each([
      ['', '' as const],
      ['an empty array', [] as unknown as string],
    ])(
      'an initials slot that renders nothing (%s) falls back to the computed initials',
      (_label, slot) => {
        const { container } = render(<Avatar name="Jane Doe" initials={slot} />);
        expect(initialsOf(container)).toBe('JD');
      },
    );

    it('an image still wins over the initials slot', () => {
      const { container } = render(<Avatar name="Jane Doe" src={PHOTO} initials="XY" />);
      expect(initialsOf(container)).toBeUndefined();
      expect(container.querySelector('img')).not.toBeNull();
    });
  });

  describe('color (0.13)', () => {
    const NAMED = [
      'red',
      'pumpkin',
      'gold',
      'forest',
      'teal',
      'blue',
      'navy',
      'lavender',
      'purple',
      'magenta',
      'brown',
      'steel',
    ] as const;
    const visual = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('.wave-avatar')!;

    it('defaults to brand, with the 0.12 classes', () => {
      const { container } = render(<Avatar name="Jane Doe" />);
      expect(visual(container)).toHaveAttribute('data-color', 'brand');
      expect(visual(container)).toHaveClass('wave:bg-primary', 'wave:text-primary-foreground');
    });

    it('neutral uses the muted pair', () => {
      const { container } = render(<Avatar name="Jane Doe" color="neutral" />);
      expect(visual(container)).toHaveAttribute('data-color', 'neutral');
      expect(visual(container)).toHaveClass('wave:bg-muted', 'wave:text-muted-foreground');
    });

    it.each(NAMED)('the named color %s uses its palette pair', (color) => {
      const { container } = render(<Avatar name="Jane Doe" color={color} />);
      expect(visual(container)).toHaveAttribute('data-color', color);
      expect(visual(container)).toHaveClass(
        `wave:bg-palette-${color}`,
        `wave:text-palette-${color}-foreground`,
      );
    });

    it('colorful picks the same named color for the same idForColor, whatever the name', () => {
      const a = render(<Avatar name="Jane Doe" color="colorful" idForColor="user-42" />);
      const b = render(<Avatar name="Somebody Else" color="colorful" idForColor="user-42" />);
      const colorA = visual(a.container).getAttribute('data-color');
      expect(NAMED).toContain(colorA);
      expect(visual(b.container)).toHaveAttribute('data-color', colorA!);
      expect(visual(a.container)).toHaveClass(`wave:bg-palette-${colorA}`);
    });

    it('colorful falls back to the name without an id', () => {
      const a = render(<Avatar name="Jane Doe" color="colorful" />);
      const b = render(<Avatar name="Jane Doe" color="colorful" />);
      expect(visual(b.container).getAttribute('data-color')).toBe(
        visual(a.container).getAttribute('data-color'),
      );
      expect(NAMED).toContain(visual(a.container).getAttribute('data-color'));
    });

    it('colorful with neither a name nor an id falls back to brand', () => {
      const { container } = render(<Avatar color="colorful" />);
      expect(visual(container)).toHaveAttribute('data-color', 'brand');
      expect(visual(container).className).not.toMatch(/undefined|NaN/);
    });

    it('colorful spreads different ids over several colors', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 24; i += 1) {
        const { container, unmount } = render(
          <Avatar name="Jane Doe" color="colorful" idForColor={`user-${i}`} />,
        );
        seen.add(visual(container).getAttribute('data-color')!);
        unmount();
      }
      expect(seen.size).toBeGreaterThanOrEqual(6);
    });

    it('the hash is stable: known ids keep their color across releases', () => {
      const { container } = render(<Avatar color="colorful" idForColor="user-42" />);
      expect(visual(container).getAttribute('data-color')).toBe(hashToNamedColor('user-42'));
      expect(hashToNamedColor('')).toBe(hashToNamedColor(''));
    });

    it('colorful renders the same on the server and the client', () => {
      const html = renderToString(<Avatar name="Jane Doe" color="colorful" idForColor="user-42" />);
      const { container } = render(
        <Avatar name="Jane Doe" color="colorful" idForColor="user-42" />,
      );
      expect(html).toContain(`data-color="${visual(container).getAttribute('data-color')}"`);
    });

    it('an image avatar ignores the color classes but reports the color', () => {
      const { container } = render(<Avatar name="Jane Doe" src={PHOTO} color="red" />);
      expect(visual(container)).toHaveAttribute('data-color', 'red');
      expect(visual(container).className).not.toContain('wave:bg-palette-red');
    });

    it('an icon avatar keeps the muted pair', () => {
      const { container } = render(<Avatar name="Jane Doe" icon={<svg />} color="red" />);
      expect(visual(container)).toHaveClass('wave:bg-muted', 'wave:text-muted-foreground');
    });

    it('types the colors', () => {
      expectTypeOf<AvatarProps['color']>().toEqualTypeOf<
        'neutral' | 'brand' | 'colorful' | AvatarNamedColor | undefined
      >();
      expectTypeOf<AvatarNamedColor>().toEqualTypeOf<(typeof NAMED)[number]>();
    });
  });

  describe('active state and badge size (0.13)', () => {
    const visual = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('.wave-avatar__visual, .wave-avatar')!;

    it('renders data-active and data-active-appearance with their defaults', () => {
      const { container } = render(<Avatar name="Jane Doe" />);
      expect(container.firstElementChild).toHaveAttribute('data-active', 'unset');
      expect(container.firstElementChild).toHaveAttribute('data-active-appearance', 'ring');
    });

    it.each([
      ['ring', ['wave:ring-2', 'wave:ring-primary']],
      ['ring-shadow', ['wave:ring-2', 'wave:ring-primary', 'wave:shadow-8']],
      ['shadow', ['wave:shadow-8']],
      ['glow', ['wave:shadow-[0_0_0.5rem_0.125rem_var(--wave-primary)]']],
    ] as const)('an active avatar draws the %s appearance', (activeAppearance, classes) => {
      const { container } = render(
        <Avatar name="Jane Doe" active="active" activeAppearance={activeAppearance} />,
      );
      expect(container.firstElementChild).toHaveAttribute('data-active', 'active');
      expect(container.firstElementChild).toHaveAttribute(
        'data-active-appearance',
        activeAppearance,
      );
      expect(visual(container)).toHaveClass(...classes);
    });

    it('an unset avatar draws no active look', () => {
      const { container } = render(<Avatar name="Jane Doe" activeAppearance="glow" />);
      expect(visual(container).className).not.toMatch(/ring-primary|shadow-8|opacity-60/);
    });

    it('an inactive avatar is dimmed, with a reduced-motion variant on its transition', () => {
      const { container } = render(<Avatar name="Jane Doe" active="inactive" />);
      expect(container.firstElementChild).toHaveAttribute('data-active', 'inactive');
      expect(visual(container)).toHaveClass(
        'wave:opacity-60',
        'wave:motion-reduce:transition-none',
      );
    });

    it.each([
      [16, 'wave:size-2'],
      [24, 'wave:size-2'],
      [28, 'wave:size-2.5'],
      [32, 'wave:size-2.5'],
      [36, 'wave:size-3'],
      [56, 'wave:size-3'],
      [64, 'wave:size-4'],
      [96, 'wave:size-4'],
      [120, 'wave:size-5'],
      [128, 'wave:size-5'],
    ] as const)('a PresenceBadge in the badge slot of a %dpx avatar is %s', (size, boxClass) => {
      render(<Avatar name="Jane Doe" size={size} badge={<PresenceBadge status="busy" />} />);
      expect(screen.getByRole('img', { name: 'Busy' })).toHaveClass(boxClass);
    });

    it('named sizes map the same way', () => {
      render(<Avatar name="Jane Doe" size="large" badge={<PresenceBadge status="busy" />} />);
      expect(screen.getByRole('img', { name: 'Busy' })).toHaveClass('wave:size-3');
    });

    it("the badge's own size wins", () => {
      render(
        <Avatar name="Jane Doe" size={128} badge={<PresenceBadge status="busy" size="small" />} />,
      );
      expect(screen.getByRole('img', { name: 'Busy' })).toHaveClass('wave:size-2.5');
    });

    it('a PresenceBadge outside an avatar stays medium', () => {
      render(<PresenceBadge status="busy" />);
      expect(screen.getByRole('img', { name: 'Busy' })).toHaveClass('wave:size-3');
    });

    it('the badge keeps its own role and name beside the avatar, with no violations', async () => {
      const { container } = render(
        <Avatar name="Jane Doe" size={64} badge={<PresenceBadge status="away" />} />,
      );
      expect(screen.getByRole('img', { name: 'Jane Doe' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Away' })).toBeInTheDocument();
      await expectNoA11yViolations(container);
    });

    it('types active and activeAppearance', () => {
      expectTypeOf<AvatarProps['active']>().toEqualTypeOf<
        'active' | 'inactive' | 'unset' | undefined
      >();
      expectTypeOf<AvatarProps['activeAppearance']>().toEqualTypeOf<
        'ring' | 'ring-shadow' | 'shadow' | 'glow' | undefined
      >();
    });
  });
});

describe('Avatar — slotProps', () => {
  type AvatarSlotProps = NonNullable<AvatarProps['slotProps']>;
  const visuals = (root: ParentNode = document) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${avatarClassNames.visual}`));

  /** Without a badge (the visual is the root), with a badge, and decorative. */
  const Avatars = ({ parts }: { parts?: AvatarSlotProps }) => (
    <>
      <Avatar name="Jane Doe" slotProps={parts} />
      <Avatar name="Jane Doe" badge={<PresenceBadge status="busy" />} slotProps={parts} />
      <Avatar decorative slotProps={parts} />
    </>
  );

  // Captured from 112d7f8's dist (client and server agree).
  const SIZE = 'wave:rounded-full wave:w-10 wave:h-10 wave:text-sm';
  const VISUAL = `wave-avatar__visual wave:inline-flex wave:items-center wave:justify-center wave:overflow-hidden wave:shrink-0 wave:font-bold ${SIZE}`;
  const STATE =
    'data-active="unset" data-active-appearance="ring" data-color="brand" data-shape="circular" data-size="medium"';
  const BASE_PINS = [
    `<span aria-label="Jane Doe" class="wave-avatar ${VISUAL} wave:bg-primary wave:text-primary-foreground" ${STATE} role="img">`,
    `<span aria-label="Jane Doe" class="${VISUAL} wave:bg-primary wave:text-primary-foreground" role="img">`,
    `<span aria-hidden="true" class="wave-avatar ${VISUAL} wave:bg-muted wave:text-muted-foreground" ${STATE}>`,
  ].join('\n');

  it('renders the visual of 112d7f8 (attributes sorted), on the client and the server', () => {
    for (const parts of [undefined, { visual: {} }]) {
      const view = render(<Avatars parts={parts} />);
      expect(openingTags(...visuals())).toBe(BASE_PINS);
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Avatars parts={parts} />);
      expect(openingTags(...visuals(template.content))).toBe(BASE_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with the part empty', () => {
    const own = {
      id: 'me',
      title: 'Me',
      style: { opacity: 0.5 },
      'data-x': '1',
      className: 'my-avatar',
      'aria-describedby': 'note',
      onClick: () => {},
    };
    for (const props of [
      {},
      own,
      { src: PHOTO },
      { role: 'button', tabIndex: 0, 'aria-label': 'Profile', image: { src: PHOTO, alt: 'Jane' } },
      { ...own, badge: <PresenceBadge status="away" />, color: 'colorful', active: 'active' },
    ] as AvatarProps[]) {
      expectInertSlotProps(
        (parts: AvatarSlotProps | undefined) => (
          <Avatar name="Jane Doe" {...props} slotProps={parts} />
        ),
        { visual: {} },
      );
    }
  });

  it('applies the part to the root without a badge, after the avatar’s own props', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const partRef = React.createRef<HTMLSpanElement>();
    render(
      <Avatar
        ref={ref}
        name="Jane Doe"
        id="own"
        className="my-avatar"
        style={{ opacity: 0.5, marginTop: '2px' }}
        data-x="1"
        slotProps={{
          visual: {
            className: 'my-visual bg-error',
            style: { opacity: 0.25 },
            id: 'part',
            title: 'Jane',
            'data-x': '2',
            'data-y': '3',
            'data-size': 'huge',
            ref: partRef,
          },
        }}
      />,
    );
    const root = screen.getByRole('img', { name: 'Jane Doe' });
    expect(root.classList[0]).toBe(avatarClassNames.root);
    expect(root.classList[1]).toBe(avatarClassNames.visual);
    expect(root).toHaveClass('my-avatar', 'my-visual', 'bg-error');
    // Your class replaces a conflicting one of the part.
    expect(root).not.toHaveClass('wave:bg-primary');
    expect(root).toHaveStyle({ opacity: '0.25', marginTop: '2px' });
    // The avatar's own props and its state win; you add what it does not set.
    expect(root).toHaveAttribute('id', 'own');
    expect(root).toHaveAttribute('data-x', '1');
    expect(root).toHaveAttribute('data-size', 'medium');
    expect(root).toHaveAttribute('data-y', '3');
    expect(root).toHaveAttribute('title', 'Jane');
    expect(ref.current).toBe(root);
    expect(partRef.current).toBe(root);
  });

  it('applies the part to the visual inside the wrapper with a badge', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const partRef = React.createRef<HTMLSpanElement>();
    const { container } = renderWithProviders(
      <Avatar
        ref={ref}
        name="Jane Doe"
        className="my-avatar"
        data-x="1"
        badge={<PresenceBadge status="out-of-office" />}
        slotProps={{
          visual: {
            className: 'my-visual',
            style: { opacity: 0.25 },
            'data-x': '2',
            ref: partRef,
          },
        }}
      />,
      { dir: 'rtl' },
    );
    const wrapper = container.querySelector<HTMLElement>(`.${avatarClassNames.root}`)!;
    const [visual] = visuals();
    expect(visual).not.toBe(wrapper);
    expect(wrapper).toContainElement(visual);
    expect(visual).toBe(screen.getByRole('img', { name: 'Jane Doe' }));
    expect(visual.classList[0]).toBe(avatarClassNames.visual);
    expect(visual).toHaveClass('my-visual');
    expect(visual).toHaveStyle({ opacity: '0.25' });
    expect(visual).toHaveAttribute('data-x', '2');
    expect(wrapper).toHaveClass('my-avatar');
    expect(wrapper).not.toHaveClass('my-visual');
    expect(wrapper).toHaveAttribute('data-x', '1');
    expect(ref.current).toBe(wrapper);
    expect(partRef.current).toBe(visual);
    expect(screen.getByRole('img', { name: 'Out of office' })).toBeInTheDocument();
  });

  it.each([
    ['named', { name: 'Jane Doe' }],
    ['decorative', { name: 'Jane Doe', decorative: true }],
    ['unnamed', {}],
    ['named by its image', { src: PHOTO, name: 'Jane Doe' }],
    ['with a badge', { name: 'Jane Doe', badge: <PresenceBadge status="busy" /> }],
  ] as Array<[string, AvatarProps]>)(
    'locks the name wiring, the tab stop and the hidden state of the visual (%s)',
    (_case, props) => {
      const { container, rerender } = render(<Avatar {...props} />);
      const [base] = visuals(container);
      const wiring = ['role', 'aria-label', 'aria-hidden', 'aria-description', 'aria-details'];
      const before = wiring.map((name) => base.getAttribute(name));
      const attempt = {
        role: 'button',
        'aria-label': 'Replaced',
        'aria-hidden': base.hasAttribute('aria-hidden') ? false : true,
        'aria-description': 'More',
        'aria-details': 'details',
        tabIndex: 0,
        hidden: true,
        inert: true,
      } as unknown as AvatarSlotProps['visual'];
      rerender(<Avatar {...props} slotProps={{ visual: attempt }} />);
      const [visual] = visuals(container);
      expect(wiring.map((name) => visual.getAttribute(name))).toEqual(before);
      for (const name of ['tabindex', 'hidden', 'inert']) {
        expect(visual).not.toHaveAttribute(name);
      }
    },
  );

  it('keeps the attributes the avatar sets from your props, which win over the part', () => {
    render(
      <Avatar
        name="Jane Doe"
        role="button"
        tabIndex={0}
        aria-label="Open profile"
        slotProps={{ visual: { role: 'link', tabIndex: -1 } as AvatarSlotProps['visual'] }}
      />,
    );
    const visual = screen.getByRole('button', { name: 'Open profile' });
    expect(visual).toHaveAttribute('tabindex', '0');
  });

  it('adds your ids to the aria-describedby of the visual', () => {
    render(
      <>
        <span id="own">Own</span>
        <span id="part">Part</span>
        <Avatar
          name="Jane Doe"
          aria-describedby="own"
          slotProps={{ visual: { 'aria-describedby': 'part' } }}
        />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute(
      'aria-describedby',
      'own part',
    );
  });

  it('runs your handler before the avatar’s own: preventDefault() skips it without a badge', () => {
    const order: string[] = [];
    const onClick = vi.fn(() => void order.push('own'));
    const { container, rerender } = render(
      <Avatar
        name="Jane Doe"
        onClick={onClick}
        slotProps={{ visual: { onClick: () => void order.push('part') } }}
      />,
    );
    fireEvent.click(visuals(container)[0]);
    expect(order).toEqual(['part', 'own']);
    rerender(
      <Avatar
        name="Jane Doe"
        onClick={onClick}
        slotProps={{ visual: { onClick: (event) => event.preventDefault() } }}
      />,
    );
    fireEvent.click(visuals(container)[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leaves the avatar’s own handlers on the wrapper with a badge', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Avatar
        name="Jane Doe"
        onClick={onClick}
        badge={<PresenceBadge status="busy" />}
        slotProps={{ visual: { onClick: (event) => event.preventDefault() } }}
      />,
    );
    fireEvent.click(visuals(container)[0]);
    // The wrapper's handler is the avatar's own prop, which a bubbling click reaches.
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls a handler of the visual once per click in StrictMode', () => {
    const onClick = vi.fn();
    const { container } = render(
      <React.StrictMode>
        <Avatar name="Jane Doe" slotProps={{ visual: { onClick } }} />
        <Avatar
          name="Jane Doe"
          badge={<PresenceBadge status="busy" />}
          slotProps={{ visual: { onClick } }}
        />
      </React.StrictMode>,
    );
    for (const visual of visuals(container)) fireEvent.click(visual);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['without a badge', {}],
    ['with a badge', { badge: <PresenceBadge status="busy" /> }],
  ] as Array<[string, Partial<AvatarProps>]>)(
    'never detaches the avatar’s ref for an inline ref of the part (%s)',
    (_case, props) => {
      const ref = vi.fn();
      const partRefs: Array<HTMLSpanElement | null> = [];
      const ui = () => (
        <Avatar
          ref={ref}
          name="Jane Doe"
          {...props}
          slotProps={{ visual: { ref: (node) => void partRefs.push(node) } }}
        />
      );
      const { rerender } = render(ui());
      rerender(ui());
      rerender(ui());
      expect(ref.mock.calls).toEqual([[expect.any(HTMLSpanElement)]]);
      const [visual] = visuals();
      expect(partRefs.filter((node) => node !== null)).toEqual([visual, visual, visual]);
    },
  );

  it.each([
    ['without a badge', {}],
    ['with a badge', { badge: <PresenceBadge status="busy" /> }],
  ] as Array<[string, Partial<AvatarProps>]>)(
    'still finds an image that failed before hydration with a ref of the part (%s)',
    async (_case, props) => {
      const partRef = React.createRef<HTMLSpanElement>();
      const ui = (
        <Avatar
          name="Jane Doe"
          src="https://example.com/expired.jpg"
          {...props}
          slotProps={{ visual: { ref: partRef } }}
        />
      );
      const host = document.createElement('div');
      host.innerHTML = renderToString(ui);
      document.body.appendChild(host);
      const img = host.querySelector('img')!;
      Object.defineProperty(img, 'complete', { configurable: true, get: () => true });
      Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => 0 });
      img.dispatchEvent(new Event('error'));
      const root = await act(async () => hydrateRoot(host, ui));
      try {
        await act(async () => {});
        expect(host.querySelector('img')).toBeNull();
        expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveTextContent('JD');
        expect(partRef.current).toBe(visuals(host)[0]);
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    },
  );

  it('has no accessibility violations with the part customised', async () => {
    render(
      <>
        <Avatars parts={{ visual: { className: 'my-visual', title: 'Avatar' } }} />
        <Avatar src={PHOTO} name="John Doe" slotProps={{ visual: { className: 'my-visual' } }} />
      </>,
    );
    await expectNoA11yViolations();
  });

  it('types the part for its element, and takes no children', () => {
    expectTypeOf<keyof AvatarSlotProps>().toEqualTypeOf<'visual'>();
    expectTypeOf<NonNullable<AvatarSlotProps['visual']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- the avatar draws the content of the visual
    const parts: AvatarSlotProps = { visual: { children: 'x' } };
    expect(parts).toBeDefined();
  });
});
