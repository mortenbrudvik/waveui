import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/Tag.stories';
import { Tag } from '../Tag';
import type { TagOwnProps, TagProps } from '../Tag';
import { Avatar, avatarSizeClasses } from '../Avatar';
import { Button } from '../../button/Button';
import type { Slot } from '../../../lib/slot';
import { forcedColors } from '../../../lib/styles';
import { tagClassNames } from '../../../lib/classNames';
import type { TagAppearance, TagShape, TagSize } from '../../../lib/types';
import {
  asClientReference,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

const APPEARANCES: readonly TagAppearance[] = ['filled', 'outline', 'brand'];
const SIZES: readonly TagSize[] = ['medium', 'small', 'extra-small'];

/** The development warning of a `<button>`/`Button` element passed as `dismissIcon`. */
const BUTTON_SLOT_WARNING = '[WaveUI] Tag: `dismissIcon` received a button.';
/** The deprecation warning of the 0.4 button-object form of `dismissIcon`. */
const BUTTON_OBJECT_WARNING =
  '[WaveUI] Tag: `dismissIcon={{ onClick, type, disabled, … }} (button props on the slot object)` is deprecated';
/** The warning for `aria-label`/`aria-labelledby` on the slot. */
const NAME_IGNORED_WARNING =
  '[WaveUI] Tag: `aria-label`/`aria-labelledby` on `dismissIcon` are ignored.';

const CustomIcon = () => (
  <svg data-testid="custom-icon" width="12" height="12" viewBox="0 0 12 12">
    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" />
  </svg>
);

describe('Tag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(Tag, {
    expectedTag: 'span',
    displayName: 'Tag',
    polymorphic: true,
    defaultProps: { children: 'Label' },
    conflictingClass: { className: 'bg-primary', overrides: 'bg-muted' },
    a11yVariants: [
      { name: 'dismissible', props: { dismissible: true, children: 'Cherry' } },
      {
        name: 'dismissible with a custom icon',
        props: { dismissible: true, children: 'Cherry', dismissIcon: <CustomIcon /> },
      },
      ...APPEARANCES.map((appearance) => ({
        name: `${appearance}, dismissible`,
        props: { appearance, dismissible: true, children: 'Cherry' },
      })),
      { name: 'selected', props: { selected: true, dismissible: true, children: 'Cherry' } },
      { name: 'disabled', props: { disabled: true, children: 'Cherry' } },
      {
        name: 'disabled, dismissible',
        props: { disabled: true, dismissible: true, children: 'Cherry' },
      },
      {
        name: 'media, icon and secondary text',
        props: {
          media: <Avatar name="Katri Athokas" />,
          icon: <CustomIcon />,
          secondaryText: 'Designer',
          dismissible: true,
          children: 'Katri',
        },
      },
      ...SIZES.map((size) => ({
        name: `size ${size}`,
        props: { size, dismissible: true, icon: <CustomIcon />, children: 'Cherry' },
      })),
    ],
  });

  testNoImplicitSubmit(Tag, { defaultProps: { dismissible: true, children: 'Cherry' } });

  it('renders children', () => {
    render(<Tag>React</Tag>);
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders as a different element via as prop', () => {
    render(
      <Tag as="div" data-testid="tag">
        Label
      </Tag>,
    );
    expect(screen.getByTestId('tag').tagName.toLowerCase()).toBe('div');
  });

  it('uses theme tokens for the chip (C-TOKENS)', () => {
    render(<Tag data-testid="tag">Label</Tag>);
    expect(screen.getByTestId('tag')).toHaveClass('bg-muted', 'text-foreground');
  });

  it('does not show a dismiss button when not dismissible', () => {
    render(<Tag>Label</Tag>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('dismiss button name (data-display#10)', () => {
    it('names the dismiss button after the dismiss label and the tag content', () => {
      render(<Tag dismissible>Cherry</Tag>);
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('gives each tag of a group its own dismiss name', () => {
      render(
        <>
          <Tag dismissible>Red</Tag>
          <Tag dismissible>Blue</Tag>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Dismiss Red' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss Blue' })).toBeInTheDocument();
    });

    it('uses the shared decorative dismiss icon (input-datetime#22)', () => {
      render(<Tag dismissible>Cherry</Tag>);
      const icon = screen
        .getByRole('button', { name: 'Dismiss Cherry' })
        .querySelector('[data-wave-icon="dismiss"]');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('uses a custom dismissLabel (localisation)', () => {
      render(
        <Tag dismissible dismissLabel="Entfernen">
          Kirsche
        </Tag>,
      );
      expect(screen.getByRole('button', { name: 'Entfernen Kirsche' })).toBeInTheDocument();
    });
  });

  describe('dismiss props without dismissible', () => {
    const NOT_DISMISSIBLE_WARNING =
      '[WaveUI] Tag: `onDismiss` and `dismissIcon` take effect only with `dismissible`';

    it.each([
      ['onDismiss', { onDismiss: () => {} }],
      ['dismissIcon', { dismissIcon: <CustomIcon /> }],
    ])('warns when %s is passed without dismissible (no dismiss button renders)', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Tag {...props}>Cherry</Tag>);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(NOT_DISMISSIBLE_WARNING)]]);
    });

    it('does not warn when dismissible is set explicitly, true or false', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Tag dismissible onDismiss={() => {}}>
            Cherry
          </Tag>
          {/* A tag that is dismissible only in some states keeps its handler. */}
          <Tag dismissible={false} onDismiss={() => {}} dismissIcon={<CustomIcon />}>
            Plum
          </Tag>
        </>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Tag dismissible onDismiss={onDismiss}>
        Label
      </Tag>,
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss Label' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses from the keyboard', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Tag dismissible onDismiss={onDismiss}>
        Label
      </Tag>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss Label' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe('focus after a keyboard dismiss (the recipe of the "Focus after dismissal" docs)', () => {
    /**
     * A filter bar that follows the documented recipe for standalone tags (README "Focus after
     * dismissal"): when a dismissal removes a tag, focus the next tag's dismiss button, else the
     * previous one, else a button next to the group. A TagGroup does this itself.
     */
    function FilterTags({ initial }: { initial: readonly string[] }) {
      const [filters, setFilters] = React.useState(initial);
      // Each rendered tag by filter, to reach its dismiss button (the tag's only button).
      const tags = React.useRef(new Map<string, HTMLElement>());
      const reset = React.useRef<HTMLButtonElement>(null);

      const dismiss = (filter: string) => {
        const index = filters.indexOf(filter);
        const neighbour = filters[index + 1] ?? filters[index - 1];
        const target =
          neighbour === undefined
            ? reset.current
            : (tags.current.get(neighbour)?.querySelector('button') ?? null);
        // The neighbour stays mounted, so it can take focus before the tag is removed.
        target?.focus();
        setFilters((current) => current.filter((f) => f !== filter));
      };

      return (
        <>
          <div role="group" aria-label="Filters">
            {filters.map((filter) => (
              <Tag
                key={filter}
                ref={(element) => {
                  if (element) tags.current.set(filter, element);
                  return () => {
                    tags.current.delete(filter);
                  };
                }}
                dismissible
                onDismiss={() => dismiss(filter)}
              >
                {filter}
              </Tag>
            ))}
          </div>
          <button type="button" ref={reset} onClick={() => setFilters(initial)}>
            Reset filters
          </button>
        </>
      );
    }

    /** Tabs to the dismiss button named `name` and presses `key` on it. */
    async function dismissWithKey(
      user: ReturnType<typeof userEvent.setup>,
      name: string,
      key: '{Enter}' | ' ' = '{Enter}',
    ) {
      const button = screen.getByRole('button', { name });
      for (let i = 0; i < 10 && document.activeElement !== button; i++) await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard(key);
      expect(screen.queryByRole('button', { name })).toBeNull();
    }

    it('dismissing the middle tag with Enter focuses the next dismiss button', async () => {
      const user = userEvent.setup();
      render(<FilterTags initial={['Red', 'Blue', 'Large']} />);
      await dismissWithKey(user, 'Dismiss Blue');
      expect(screen.getByRole('button', { name: 'Dismiss Large' })).toHaveFocus();
    });

    it('dismissing the last tag focuses the previous dismiss button', async () => {
      const user = userEvent.setup();
      render(<FilterTags initial={['Red', 'Blue', 'Large']} />);
      await dismissWithKey(user, 'Dismiss Large');
      expect(screen.getByRole('button', { name: 'Dismiss Blue' })).toHaveFocus();
    });

    it('dismissing the only tag focuses the fallback next to the group', async () => {
      const user = userEvent.setup();
      render(<FilterTags initial={['Red']} />);
      await dismissWithKey(user, 'Dismiss Red');
      expect(screen.getByRole('button', { name: 'Reset filters' })).toHaveFocus();
    });

    it('focus never ends on <body> while every tag is dismissed in turn (Enter and Space)', async () => {
      const user = userEvent.setup();
      render(<FilterTags initial={['Red', 'Blue', 'Large', 'Round']} />);
      const steps: Array<[string, '{Enter}' | ' ', string]> = [
        ['Dismiss Blue', '{Enter}', 'Dismiss Large'],
        ['Dismiss Large', ' ', 'Dismiss Round'],
        ['Dismiss Round', '{Enter}', 'Dismiss Red'],
        ['Dismiss Red', ' ', 'Reset filters'],
      ];
      for (const [name, key, next] of steps) {
        await dismissWithKey(user, name, key);
        // Let anything scheduled after the removal (frames, effects) run before checking.
        await act(async () => {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        });
        expect(document.activeElement).not.toBe(document.body);
        expect(screen.getByRole('button', { name: next })).toHaveFocus();
      }
    });
  });

  describe('dismissIcon slot (data-display#1, feedback-navigation#1)', () => {
    it('renders a custom icon inside the wired dismiss button', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag dismissible onDismiss={onDismiss} dismissIcon={<CustomIcon />}>
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      expect(button).toContainElement(screen.getByTestId('custom-icon'));
      await user.click(screen.getByTestId('custom-icon'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(button).toHaveAccessibleName('Dismiss Cherry');
    });

    it('renders slot object content inside the wired button', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={{ className: 'text-error', children: <CustomIcon /> }}
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      const icon = screen.getByTestId('custom-icon');
      expect(button).toContainElement(icon);
      expect(icon.parentElement).toHaveClass('text-error');
      await user.click(icon);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('merges a <button> slot into the wired button instead of nesting it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const calls: string[] = [];
      render(
        <Tag
          dismissible
          onDismiss={() => calls.push('onDismiss')}
          dismissIcon={
            <button type="button" className="text-error" onClick={() => calls.push('slot')}>
              <CustomIcon />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Dismiss Cherry');
      expect(buttons[0]).toHaveClass('text-error');
      expect(buttons[0]).toContainElement(screen.getByTestId('custom-icon'));
      await user.click(buttons[0]);
      expect(calls).toEqual(['slot', 'onDismiss']);
      // The element form gets its own warning, never the deprecation of the button-object form.
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('lets a <button> slot that calls preventDefault() suppress onDismiss', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={
            <button type="button" onClick={(event) => event.preventDefault()}>
              x
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      await user.click(screen.getByRole('button', { name: 'Dismiss Cherry' }));
      expect(onDismiss).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('merges a Wave Button slot into the wired button', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onClick = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={<Button appearance="subtle" icon={<CustomIcon />} onClick={onClick} />}
        >
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Dismiss Cherry');
      expect(buttons[0]).not.toHaveAttribute('appearance');
      await user.click(buttons[0]);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('renders the icon and the text label of a Wave Button slot together (C-SLOTS)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag dismissible dismissIcon={<Button icon={<CustomIcon />}>Remove</Button>}>
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Remove Cherry');
      expect(buttons[0]).toContainElement(screen.getByTestId('custom-icon'));
      expect(buttons[0]).toHaveTextContent('Remove');
      // The icon comes first and stays decorative, as in MessageBar and SearchBox.
      const iconSpan = screen.getByTestId('custom-icon').parentElement as HTMLElement;
      expect(iconSpan).toHaveAttribute('aria-hidden', 'true');
      expect(iconSpan.nextSibling?.textContent).toBe('Remove');
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it.each([
      [
        'a Wave Button element',
        (onClick: () => void): TagOwnProps['dismissIcon'] => (
          <Button
            icon={<CustomIcon />}
            iconPosition="after"
            disabled
            disabledFocusable
            onClick={onClick}
          >
            Remove
          </Button>
        ),
        'Remove Cherry',
        BUTTON_SLOT_WARNING,
      ],
      [
        'a slot object whose `as` is a Wave Button (deprecated form)',
        (onClick: () => void) =>
          // Wave Button props are not part of the slot type: a JavaScript caller's 0.4 form.
          ({
            as: Button,
            icon: <CustomIcon />,
            iconPosition: 'after',
            disabled: true,
            disabledFocusable: true,
            onClick,
            children: 'Remove',
          }) as Slot<'span'>,
        'Dismiss Cherry',
        BUTTON_OBJECT_WARNING,
      ],
    ])(
      '%s: iconPosition and disabledFocusable take effect on the dismiss button and never reach the DOM',
      async (_, dismissIcon, name, warning) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = userEvent.setup();
        const onSlotClick = vi.fn();
        const onDismiss = vi.fn();
        const onParentClick = vi.fn();
        render(
          <div onClick={onParentClick}>
            <Tag dismissible onDismiss={onDismiss} dismissIcon={dismissIcon(onSlotClick)}>
              Cherry
            </Tag>
          </div>,
        );
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1);
        const button = buttons[0];
        expect(button).toHaveAccessibleName(name);
        // Neither prop lands on the button or its content as an unknown attribute.
        expect(button.outerHTML).not.toMatch(/iconposition|disabledfocusable/i);
        // iconPosition="after": the decorative icon follows the text, as in Button (the object
        // form's content is hidden as a whole).
        const icon = screen.getByTestId('custom-icon').parentElement as HTMLElement;
        expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(icon.previousSibling?.textContent).toBe('Remove');
        expect(icon.nextSibling).toBeNull();
        // disabledFocusable wins over disabled: unavailable, but focusable and in the tab order.
        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveAttribute('data-disabled', '');
        expect(button).toHaveAttribute('data-disabled-focusable', '');
        expect(button).toHaveClass(
          'aria-disabled:cursor-not-allowed',
          'aria-disabled:opacity-50',
          // The dimmed look lifts while the focus ring shows (opacity would dim the ring too).
          'aria-disabled:focus-visible:opacity-100',
        );
        await user.tab();
        expect(button).toHaveFocus();
        await user.keyboard('{Enter}');
        await user.keyboard(' ');
        await user.click(button);
        expect(onSlotClick).not.toHaveBeenCalled();
        expect(onDismiss).not.toHaveBeenCalled();
        expect(onParentClick).not.toHaveBeenCalled();
        expect(warn.mock.calls).toEqual([[expect.stringContaining(warning)]]);
        expect(error).not.toHaveBeenCalled();
      },
    );

    it('merges a Wave Button written in a Server Component (lazy type) instead of nesting it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const LazyButton = asClientReference(Button);
      const onClick = vi.fn();
      const onDismiss = vi.fn();
      const tag = (SlotButton: typeof Button) => (
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={<SlotButton icon={<CustomIcon />} onClick={onClick} />}
        >
          Cherry
        </Tag>
      );
      expect(renderToString(tag(LazyButton))).toBe(renderToString(tag(Button)));
      render(tag(LazyButton));
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Dismiss Cherry');
      await user.click(buttons[0]);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    const emptyContentCases: Array<
      [string, TagOwnProps['dismissIcon'], 'button' | 'content' | null, string | null]
    > = [
      ['a slot object without children', { className: 'text-error' }, 'content', null],
      [
        'the deprecated button-object form without children',
        { as: 'button', className: 'text-error', onClick: () => {} },
        'button',
        BUTTON_OBJECT_WARNING,
      ],
      [
        'a childless <button>',
        <button key="b" type="button" className="text-error" />,
        'button',
        BUTTON_SLOT_WARNING,
      ],
      [
        'a childless Wave Button',
        <Button key="w" className="text-error" />,
        'button',
        BUTTON_SLOT_WARNING,
      ],
      [
        'a <button> whose children render nothing',
        <button key="e" type="button" className="text-error">
          {false}
        </button>,
        'button',
        BUTTON_SLOT_WARNING,
      ],
      [
        'a <button> whose children are an empty Fragment',
        <button key="f" type="button" className="text-error">
          <></>
        </button>,
        'button',
        BUTTON_SLOT_WARNING,
      ],
      [
        'a Wave Button whose icon and children are empty Fragments',
        <Button key="wf" className="text-error" icon={<></>}>
          <></>
        </Button>,
        'button',
        BUTTON_SLOT_WARNING,
      ],
      [
        'a slot object whose children are an empty Fragment',
        { className: 'text-error', children: <></> },
        'content',
        null,
      ],
      ['content that renders nothing', [], null, null],
      ['an empty Fragment', <React.Fragment key="f" />, null, null],
      ['a Fragment whose content renders nothing', <>{[false, '']}</>, null, null],
      ['a Set of empty Fragments', new Set([<React.Fragment key="f" />]), null, null],
    ];

    it.each(emptyContentCases)(
      'shows the default icon for %s (never an empty dismiss button)',
      (_, dismissIcon, classTarget, warning) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(
          <Tag dismissible dismissIcon={dismissIcon}>
            Cherry
          </Tag>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
        const icon = button.querySelector('[data-wave-icon="dismiss"]');
        expect(icon).not.toBeNull();
        expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
        if (classTarget === 'button') {
          // A merged button (or the button-object form) keeps its className on the dismiss button.
          expect(button).toHaveClass('text-error');
        } else if (classTarget === 'content') {
          // The slot object's element wraps the default icon and carries its className.
          expect(icon?.parentElement).toHaveClass('text-error');
          expect(button).not.toHaveClass('text-error');
        }
        expect(warn.mock.calls).toEqual(warning ? [[expect.stringContaining(warning)]] : []);
      },
    );

    describe('a slot object that brings its own content keeps it (no default icon is added)', () => {
      const HTML_ICON = '<svg data-testid="html-icon" viewBox="0 0 12 12"></svg>';

      /** An icon component that also renders its children, like icons that accept extra paths. */
      function DrawnIcon({
        className,
        children,
      }: {
        className?: string;
        children?: React.ReactNode;
      }) {
        return (
          <svg data-testid="drawn-icon" className={className} viewBox="0 0 12 12">
            {children}
          </svg>
        );
      }

      it('renders dangerouslySetInnerHTML content in the slot element', () => {
        const error = vi.spyOn(console, 'error');
        render(
          <Tag
            dismissible
            dismissIcon={{
              className: 'text-error',
              dangerouslySetInnerHTML: { __html: HTML_ICON },
            }}
          >
            Cherry
          </Tag>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
        const icon = within(button).getByTestId('html-icon');
        expect(icon.parentElement).toHaveClass('text-error');
        expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        expect(error).not.toHaveBeenCalled();
      });

      it('renders dangerouslySetInnerHTML of the deprecated button-object form inside the button', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error');
        render(
          <Tag
            dismissible
            dismissIcon={{ as: 'button', dangerouslySetInnerHTML: { __html: HTML_ICON } }}
          >
            Cherry
          </Tag>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
        const icon = within(button).getByTestId('html-icon');
        expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_OBJECT_WARNING)]]);
        expect(error).not.toHaveBeenCalled();
      });

      it('renders a component `as` as the icon, without the default icon inside it', () => {
        render(
          <Tag dismissible dismissIcon={{ as: DrawnIcon, className: 'text-error' }}>
            Cherry
          </Tag>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
        expect(within(button).getByTestId('drawn-icon')).toHaveClass('text-error');
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
      });

      it('renders a void `as` (an img) as the icon, without the default icon or a warning', () => {
        const warn = vi.spyOn(console, 'warn');
        render(
          <Tag
            dismissible
            dismissIcon={
              { as: 'img', src: 'close.svg', alt: '', className: 'size-3' } as Slot<'span'>
            }
          >
            Cherry
          </Tag>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
        const image = button.querySelector('img');
        expect(image).toHaveAttribute('src', 'close.svg');
        expect(image).toHaveClass('size-3');
        expect(image).toHaveAttribute('aria-hidden', 'true');
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
      });
    });

    describe('markup of a merged button (dangerouslySetInnerHTML)', () => {
      const HTML_ICON = '<svg data-testid="html-icon" viewBox="0 0 12 12"></svg>';

      it('renders the markup of a merged <button> inside the wired button instead of throwing', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error');
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        render(
          <Tag
            dismissible
            onDismiss={onDismiss}
            dismissIcon={
              <button
                type="button"
                className="text-error"
                dangerouslySetInnerHTML={{ __html: HTML_ICON }}
              />
            }
          >
            Cherry
          </Tag>,
        );
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toHaveAccessibleName('Dismiss Cherry');
        expect(buttons[0]).toHaveClass('text-error');
        expect(buttons[0]).toContainElement(screen.getByTestId('html-icon'));
        expect(buttons[0].querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        await user.click(buttons[0]);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
        expect(error).not.toHaveBeenCalled();
      });

      it('names the button by a text label in the markup, as it does for children', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(
          <Tag
            dismissible
            dismissIcon={<button type="button" dangerouslySetInnerHTML={{ __html: 'Remove' }} />}
          >
            Cherry
          </Tag>,
        );
        await waitFor(() =>
          expect(screen.getByRole('button')).toHaveAccessibleName('Remove Cherry'),
        );
        expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
      });
    });

    it('merges a slot object whose `as` is a Wave Button instead of nesting it (deprecated form)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          dismissIcon={
            // Wave Button props are not part of the slot type: a JavaScript caller's 0.4 form.
            {
              as: Button,
              appearance: 'subtle',
              className: 'text-error',
              icon: <CustomIcon />,
            } as Slot<'span'>
          }
        >
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Dismiss Cherry');
      expect(buttons[0]).toHaveClass('text-error');
      expect(buttons[0]).not.toHaveAttribute('appearance');
      const icon = within(buttons[0]).getByTestId('custom-icon');
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(buttons[0].querySelector('[data-wave-icon="dismiss"]')).toBeNull();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_OBJECT_WARNING)]]);
    });

    it('shows the default icon for a slot object whose `as` is a childless Wave Button', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag dismissible dismissIcon={{ as: Button, className: 'text-error' }}>
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveClass('text-error');
      expect(buttons[0].querySelector('[data-wave-icon="dismiss"]')).not.toBeNull();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_OBJECT_WARNING)]]);
    });

    // A generator is read once to decide whether it renders anything; its items are what renders.
    describe('generator content', () => {
      function* items(...values: React.ReactNode[]): Generator<React.ReactNode> {
        yield* values;
      }

      it('renders the text of a merged <button> given as a generator, which names the button', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error');
        render(
          <Tag dismissible dismissIcon={<button type="button">{items('Remove')}</button>}>
            Cherry
          </Tag>,
        );
        const button = screen.getByRole('button');
        expect(within(button).getByText('Remove')).toBeInTheDocument();
        expect(button).toHaveAccessibleName('Remove Cherry');
        expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
        expect(error).not.toHaveBeenCalled();
      });

      it('names a merged <button> by the text of a generator on the server too', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        try {
          host.innerHTML = renderToString(
            <Tag dismissible dismissIcon={<button type="button">{items('Remove')}</button>}>
              Cherry
            </Tag>,
          );
          expect(within(host).getByRole('button')).toHaveAccessibleName('Remove Cherry');
        } finally {
          host.remove();
        }
      });

      it.each([
        ['as the slot', () => items(<CustomIcon key="icon" />)],
        [
          'as the children of a slot object',
          () => ({ className: 'text-error', children: items(<CustomIcon key="icon" />) }),
        ],
        [
          'as the children of a merged <button>',
          () => <button type="button">{items(<CustomIcon key="icon" />)}</button>,
        ],
      ])('renders an icon given by a generator %s', (name, makeIcon) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error');
        render(
          <Tag dismissible dismissIcon={makeIcon() as TagOwnProps['dismissIcon']}>
            Cherry
          </Tag>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
        expect(button).toContainElement(screen.getByTestId('custom-icon'));
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        expect(warn.mock.calls).toEqual(
          name.includes('<button>') ? [[expect.stringContaining(BUTTON_SLOT_WARNING)]] : [],
        );
        expect(error).not.toHaveBeenCalled();
      });
    });

    it('merges the deprecated button-object form onto the wired button with a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onClick = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={{ as: 'button', onClick, children: <CustomIcon /> }}
        >
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      await user.click(buttons[0]);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_OBJECT_WARNING)]]);
    });

    it('puts the button attributes of the deprecated button-object form on the dismiss button', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <p id="remove-hint">Removes the filter</p>
          <Tag
            dismissible
            dismissIcon={{
              as: 'button',
              id: 'remove-cherry',
              className: 'text-error',
              'aria-label': 'Remove',
              'aria-describedby': 'remove-hint',
              onClick: () => {},
              children: <CustomIcon />,
            }}
          >
            Cherry
          </Tag>
        </>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      expect(button).toHaveAccessibleDescription('Removes the filter');
      expect(button).toHaveAttribute('id', 'remove-cherry');
      expect(button).toHaveClass('text-error');
      expect(button).not.toHaveAttribute('aria-label');

      const iconSpan = screen.getByTestId('custom-icon').parentElement as HTMLElement;
      expect(iconSpan).toHaveAttribute('aria-hidden', 'true');
      expect(iconSpan).not.toHaveAttribute('aria-label');
      expect(iconSpan).not.toHaveAttribute('aria-describedby');
      expect(iconSpan).not.toHaveAttribute('id');
      expect(iconSpan).not.toHaveClass('text-error');
      expect(warn.mock.calls).toEqual([
        [expect.stringContaining(BUTTON_OBJECT_WARNING)],
        [expect.stringContaining(NAME_IGNORED_WARNING)],
      ]);
    });

    it('ignores aria-label on a <button> slot and says so (the name comes from dismissLabel)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          dismissIcon={
            <button type="button" aria-label="Remove">
              <CustomIcon />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      expect(button).not.toHaveAttribute('aria-label');
      expect(warn.mock.calls).toEqual([
        [expect.stringContaining(BUTTON_SLOT_WARNING)],
        [expect.stringMatching(/aria-label.*ignored.*dismissLabel/)],
      ]);
    });

    it('moves aria attributes of an icon slot object to the dismiss button', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <p id="remove-hint">Removes the filter</p>
          <Tag
            dismissible
            dismissIcon={{
              className: 'text-error',
              'aria-label': 'Remove',
              'aria-describedby': 'remove-hint',
              children: <CustomIcon />,
            }}
          >
            Cherry
          </Tag>
        </>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      expect(button).toHaveAccessibleDescription('Removes the filter');
      const iconSpan = screen.getByTestId('custom-icon').parentElement as HTMLElement;
      expect(iconSpan).toHaveClass('text-error');
      expect(iconSpan).toHaveAttribute('aria-hidden', 'true');
      expect(iconSpan).not.toHaveAttribute('aria-label');
      expect(iconSpan).not.toHaveAttribute('aria-describedby');
      expect(warn.mock.calls).toEqual([[expect.stringContaining(NAME_IGNORED_WARNING)]]);
    });
  });

  describe('dismiss name from a merged button with a text label (C-SLOTS naming, WCAG 2.5.3)', () => {
    /** Stands in for `<FormattedMessage>`/`<Trans>`: the text comes from a component. */
    function Translated({ text }: { text: string }) {
      return <>{text}</>;
    }

    it('names the button by its visible text plus the tag content (P12 change request)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag dismissible onDismiss={onDismiss} dismissIcon={<button type="button">Remove</button>}>
          Cherry
        </Tag>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName(expect.stringContaining('Remove'));
      expect(button).toHaveAccessibleName('Remove Cherry');
      await user.click(button);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it.each([
      ['a Wave Button with a text label', <Button key="b">Remove</Button>, 'Remove Cherry'],
      [
        'a <button> whose child component renders the text (i18n)',
        <button key="t" type="button">
          <Translated text="Entfernen" />
        </button>,
        'Entfernen Cherry',
      ],
      [
        'a <button> with an icon and a text label',
        <button key="i" type="button">
          <CustomIcon />
          Remove
        </button>,
        'Remove Cherry',
      ],
    ])('%s is named by its visible text', (_, dismissIcon, name) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag dismissible dismissIcon={dismissIcon}>
          Cherry
        </Tag>,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName(name);
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it.each([
      ['a lone letter used as a glyph', 'x'],
      ['a symbol', '×'],
      ['an icon', <CustomIcon key="icon" />],
      [
        'aria-hidden text',
        <span key="h" aria-hidden="true">
          Remove
        </span>,
      ],
      [
        'hidden text',
        <span key="h" hidden>
          Remove
        </span>,
      ],
    ])('a <button> whose content is %s keeps "Dismiss Cherry"', (_, children) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag dismissible dismissIcon={<button type="button">{children}</button>}>
          Cherry
        </Tag>,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName('Dismiss Cherry');
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('keeps "Dismiss Cherry" for text in icon content (slot content is decorative)', () => {
      render(
        <Tag dismissible dismissIcon={<span>Remove</span>}>
          Cherry
        </Tag>,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName('Dismiss Cherry');
    });

    it('still ignores aria-label on the slot: the visible text and the tag content name the button', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          dismissIcon={
            <button type="button" aria-label="Delete">
              Remove
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Remove Cherry');
      expect(button).not.toHaveAttribute('aria-label');
      expect(warn.mock.calls).toEqual([
        [expect.stringContaining(BUTTON_SLOT_WARNING)],
        [expect.stringContaining(NAME_IGNORED_WARNING)],
      ]);
    });

    it('follows text that a child component renders or removes later', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setTextRef = React.createRef<(text: string) => void>();
      function LateText({ ref }: { ref: React.Ref<(text: string) => void> }) {
        const [text, setText] = React.useState('');
        React.useImperativeHandle(ref, () => setText, []);
        return <>{text}</>;
      }
      render(
        <Tag
          dismissible
          dismissIcon={
            <button type="button">
              <CustomIcon />
              <LateText ref={setTextRef} />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');

      act(() => setTextRef.current?.('Remove'));
      await waitFor(() => expect(button).toHaveAccessibleName('Remove Cherry'));

      act(() => setTextRef.current?.(''));
      await waitFor(() => expect(button).toHaveAccessibleName('Dismiss Cherry'));
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('decides the server-rendered name from the literal children', () => {
      // The warnings come from effects, which never run on the server.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const host = document.createElement('div');
      document.body.appendChild(host);
      try {
        host.innerHTML = renderToString(
          <>
            <Tag dismissible dismissIcon={<button type="button">Remove</button>}>
              Cherry
            </Tag>
            <Tag dismissible dismissIcon={<button type="button">x</button>}>
              Plum
            </Tag>
          </>,
        );
        const [named, glyph] = within(host).getAllByRole('button');
        expect(named).toHaveAccessibleName('Remove Cherry');
        expect(glyph).toHaveAccessibleName('Dismiss Plum');
        expect(warn).not.toHaveBeenCalled();
      } finally {
        host.remove();
      }
    });
  });

  it('uses logical padding, so the tag is RTL-safe (feedback-navigation#34)', () => {
    renderWithProviders(
      <Tag dismissible data-testid="tag">
        Label
      </Tag>,
      { dir: 'rtl' },
    );
    const tag = screen.getByTestId('tag');
    // 0.11 (D20): the 1px border is part of every inset, so 12px and 6px stay the outer metrics.
    expect(tag).toHaveClass('ps-2.75', 'pe-1.25');
    expect(tag.className).not.toMatch(/\bp[lr]-/);
  });

  describe('look: appearance, selected, shape (P6-01: D20, D22, D23, D26)', () => {
    /** The class list of an element, sorted, to compare it as a set. */
    const classesOf = (element: Element) => element.className.split(/\s+/).filter(Boolean).sort();

    it('renders the 0.10 box by default (D20)', () => {
      render(
        <>
          <Tag data-testid="plain">Label</Tag>
          <Tag dismissible data-testid="dismissible">
            Cherry
          </Tag>
        </>,
      );
      const box = [
        'wave-tag',
        'inline-flex',
        'items-center',
        'gap-1',
        'min-h-7',
        'border',
        'border-transparent',
        'bg-muted',
        'text-foreground',
        'text-body-1',
        'rounded-full',
        'ps-2.75',
      ];
      for (const [testId, endInset] of [
        ['plain', 'pe-2.75'],
        ['dismissible', 'pe-1.25'],
      ] as const) {
        const tag = screen.getByTestId(testId);
        expect(classesOf(tag)).toEqual([...box, endInset].sort());
        expect(tag).toHaveAttribute('data-size', 'medium');
        expect(tag).toHaveAttribute('data-appearance', 'filled');
        expect(tag).toHaveAttribute('data-shape', 'circular');
        expect(tag).toHaveAttribute('data-wave-tag-item', '');
        expect(tag).not.toHaveAttribute('data-selected');
        expect(tag).not.toHaveAttribute('data-disabled');
        expect(tag).not.toHaveAttribute('aria-disabled');
        expect(tag).not.toHaveAttribute('role');
      }
    });

    const LOOKS: Record<TagAppearance, readonly string[]> = {
      filled: ['border-transparent', 'bg-muted', 'text-foreground'],
      outline: ['border-stroke', 'bg-transparent', 'text-foreground'],
      brand: ['border-transparent', 'bg-selected', 'text-selected-foreground'],
    };
    const RAW_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\b(?:white|black)\b|-(?:gray|grey|blue|red)-\d/i;

    it.each(APPEARANCES)('draws the %s appearance with theme tokens', (appearance) => {
      render(
        <Tag appearance={appearance} dismissible data-testid="tag">
          Cherry
        </Tag>,
      );
      const tag = screen.getByTestId('tag');
      expect(tag).toHaveAttribute('data-appearance', appearance);
      expect(tag).toHaveClass(...LOOKS[appearance], 'border');
      for (const other of APPEARANCES.filter((name) => name !== appearance)) {
        const own = new Set(LOOKS[appearance]);
        for (const name of LOOKS[other]) if (!own.has(name)) expect(tag).not.toHaveClass(name);
      }
      expect(tag.outerHTML).not.toMatch(RAW_COLOR);
    });

    it('draws the selected look over every appearance, and disabled over selected', () => {
      render(
        <>
          {APPEARANCES.map((appearance) => (
            <Tag key={appearance} appearance={appearance} selected data-testid={appearance}>
              {appearance}
            </Tag>
          ))}
          {APPEARANCES.map((appearance) => (
            <Tag
              key={appearance}
              appearance={appearance}
              selected
              disabled
              data-testid={`disabled-${appearance}`}
            >
              {appearance}
            </Tag>
          ))}
        </>,
      );
      for (const appearance of APPEARANCES) {
        const tag = screen.getByTestId(appearance);
        expect(tag).toHaveAttribute('data-selected', '');
        expect(tag).toHaveAttribute('data-appearance', appearance);
        expect(tag).toHaveClass('bg-primary', 'text-primary-foreground', 'border-primary');
        expect(tag).not.toHaveClass('bg-muted', 'bg-selected', 'bg-transparent');
        // A Tag is not interactive: the selected state is a look, never announced (D26).
        expect(tag).not.toHaveAttribute('aria-selected');
        expect(tag).not.toHaveAttribute('aria-pressed');

        const disabled = screen.getByTestId(`disabled-${appearance}`);
        expect(disabled).toHaveAttribute('data-selected', '');
        expect(disabled).toHaveAttribute('data-disabled', '');
        expect(disabled).not.toHaveClass('bg-primary', 'text-primary-foreground', 'border-primary');
        expect(disabled).toHaveClass(...LOOKS[appearance]);
      }
    });

    it('draws 4px corners with shape rounded; circular is the default', () => {
      render(
        <>
          <Tag dismissible data-testid="circular">
            Plum
          </Tag>
          <Tag shape="rounded" dismissible data-testid="rounded">
            Cherry
          </Tag>
        </>,
      );
      const circular = screen.getByTestId('circular');
      expect(circular).toHaveAttribute('data-shape', 'circular');
      expect(circular).toHaveClass('rounded-full');
      const rounded = screen.getByTestId('rounded');
      expect(rounded).toHaveAttribute('data-shape', 'rounded');
      expect(rounded).toHaveClass('rounded');
      expect(rounded).not.toHaveClass('rounded-full');
      // The Dismiss button stays a circle in both shapes.
      expect(screen.getByRole('button', { name: 'Dismiss Cherry' })).toHaveClass('rounded-full');
    });

    it('uses the state tokens for the Dismiss hover of each look (D22)', () => {
      render(
        <>
          {APPEARANCES.map((appearance) => (
            <Tag key={appearance} appearance={appearance} dismissible>
              {appearance}
            </Tag>
          ))}
          <Tag selected dismissible>
            Selected
          </Tag>
        </>,
      );
      const gate = 'not-disabled:not-aria-disabled:';
      const expected: Record<string, readonly [string, string]> = {
        filled: ['bg-muted-hover', 'bg-muted-pressed'],
        outline: ['bg-muted-hover', 'bg-muted-pressed'],
        brand: ['bg-selected-hover', 'bg-selected-pressed'],
        Selected: ['bg-primary-hover', 'bg-primary-pressed'],
      };
      for (const [text, [hover, pressed]] of Object.entries(expected)) {
        const button = screen.getByRole('button', { name: `Dismiss ${text}` });
        expect(button).toHaveClass(`${gate}hover:${hover}`, `${gate}active:${pressed}`);
        // 0.10's dismiss hover (1.05:1 in light) is gone (D22, "Fixed").
        expect(button).not.toHaveClass(`${gate}hover:bg-subtle-pressed`);
        // The glyph takes the tag's text colour (C-NATIVE: set explicitly).
        expect(button).toHaveClass('text-inherit');
        expect(button).not.toHaveClass('text-foreground');
      }
    });

    it('draws the focus ring on the tag fill: primary-foreground on a selected tag, offset 0 at extra-small', () => {
      render(
        <>
          <Tag dismissible>Plain</Tag>
          <Tag selected dismissible>
            Selected
          </Tag>
          <Tag selected disabled dismissible>
            Locked
          </Tag>
          <Tag size="extra-small" dismissible>
            Small
          </Tag>
        </>,
      );
      const plain = screen.getByRole('button', { name: 'Dismiss Plain' });
      expect(plain).toHaveClass(
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-ring',
      );
      const selected = screen.getByRole('button', { name: 'Dismiss Selected' });
      expect(selected).toHaveClass('focus-visible:outline-primary-foreground');
      expect(selected).not.toHaveClass('focus-visible:outline-ring');
      // Disabled wins over selected: the default ring.
      const locked = screen.getByRole('button', { name: 'Dismiss Locked' });
      expect(locked).toHaveClass('focus-visible:outline-ring');
      expect(locked).not.toHaveClass('focus-visible:outline-primary-foreground');
      const small = screen.getByRole('button', { name: 'Dismiss Small' });
      expect(small).toHaveClass('focus-visible:outline-offset-0');
      expect(small).not.toHaveClass('focus-visible:outline-offset-2');
    });

    it('draws an edge, the selected outline, GrayText and a Highlight glyph in forced colours (D29)', () => {
      render(
        <>
          <Tag dismissible data-testid="plain">
            Plain
          </Tag>
          <Tag selected data-testid="selected">
            Selected
          </Tag>
          <Tag disabled dismissible data-testid="disabled">
            Disabled
          </Tag>
        </>,
      );
      // The transparent 1px border is the tag's edge in forced colours.
      expect(screen.getByTestId('plain')).toHaveClass('border', 'border-transparent');
      expect(screen.getByTestId('plain').className).not.toContain('forced-colors:outline');
      expect(screen.getByTestId('selected')).toHaveClass(
        ...forcedColors.selectedContainer.split(' '),
      );
      expect(screen.getByTestId('selected').className).not.toContain('forced-color-adjust');
      expect(screen.getByTestId('disabled')).toHaveClass(...forcedColors.disabled.split(' '));
      expect(screen.getByRole('button', { name: 'Dismiss Plain' })).toHaveClass(
        'forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]',
      );
    });
  });

  describe('sizes (P6-01: D21, D28)', () => {
    const CustomIconSlot = <CustomIcon />;
    const METRICS: Record<
      TagSize,
      {
        height: string;
        text: string;
        gap: string;
        textStart: string;
        iconStart: string;
        textEnd: string;
        dismissEnd: string;
        mediaEnd: string;
        iconBox: string;
        dismissBox: string;
        hitLayer: string;
        glyph: string;
        avatar: readonly string[];
      }
    > = {
      medium: {
        height: 'min-h-7',
        text: 'text-body-1',
        gap: 'gap-1',
        textStart: 'ps-2.75',
        iconStart: 'ps-1.75',
        textEnd: 'pe-2.75',
        dismissEnd: 'pe-1.25',
        mediaEnd: 'me-1',
        iconBox: 'size-5',
        dismissBox: 'size-5',
        hitLayer: 'before:-inset-0.5',
        glyph: '12',
        avatar: avatarSizeClasses['extra-small'].split(' '),
      },
      small: {
        height: 'min-h-6',
        text: 'text-caption-1',
        gap: 'gap-1',
        textStart: 'ps-1.75',
        iconStart: 'ps-1.25',
        textEnd: 'pe-1.75',
        dismissEnd: 'pe-0.75',
        mediaEnd: 'me-0.5',
        iconBox: 'size-4',
        dismissBox: 'size-4',
        hitLayer: 'before:-inset-1',
        glyph: '12',
        avatar: ['w-5', 'h-5'],
      },
      'extra-small': {
        height: 'min-h-5',
        text: 'text-caption-1',
        gap: 'gap-0.5',
        textStart: 'ps-1.75',
        iconStart: 'ps-1.25',
        textEnd: 'pe-1.75',
        dismissEnd: 'pe-px',
        mediaEnd: 'me-0.5',
        iconBox: 'size-3',
        dismissBox: 'size-4',
        hitLayer: 'before:-inset-1',
        glyph: '10',
        avatar: ['w-4', 'h-4'],
      },
    };

    it.each(SIZES)('sizes the tag, its icon, Avatar and Dismiss button at %s', (size) => {
      const metrics = METRICS[size];
      render(
        <>
          <Tag size={size} data-testid="text">
            Text
          </Tag>
          <Tag size={size} icon={CustomIconSlot} dismissible data-testid="icon">
            Icon
          </Tag>
          <Tag size={size} media={<Avatar name="Katri Athokas" />} data-testid="media">
            Katri
          </Tag>
        </>,
      );
      const text = screen.getByTestId('text');
      expect(text).toHaveAttribute('data-size', size);
      expect(text).toHaveClass(
        metrics.height,
        metrics.text,
        metrics.gap,
        metrics.textStart,
        metrics.textEnd,
      );

      const withIcon = screen.getByTestId('icon');
      expect(withIcon).toHaveClass(metrics.iconStart, metrics.dismissEnd);
      expect(withIcon).not.toHaveClass(metrics.textStart);
      const iconBox = withIcon.querySelector(`.${tagClassNames.icon}`);
      expect(iconBox).toHaveClass(metrics.iconBox, '[&>svg]:size-full');

      const dismiss = screen.getByRole('button', { name: 'Dismiss Icon' });
      expect(dismiss).toHaveClass(
        metrics.dismissBox,
        'relative',
        'before:absolute',
        metrics.hitLayer,
      );
      const glyph = dismiss.querySelector('[data-wave-icon="dismiss"]');
      expect(glyph).toHaveAttribute('width', metrics.glyph);
      expect(glyph).toHaveAttribute('height', metrics.glyph);
      if (size === 'extra-small') expect(dismiss).toHaveClass('focus-visible:outline-offset-0');
      else expect(dismiss).toHaveClass('focus-visible:outline-offset-2');

      const withMedia = screen.getByTestId('media');
      expect(withMedia).toHaveClass('ps-px');
      expect(withMedia.querySelector(`.${tagClassNames.media}`)).toHaveClass(metrics.mediaEnd);
      expect(screen.getByRole('img', { name: 'Katri Athokas' })).toHaveClass(...metrics.avatar);
    });

    it('gives the Dismiss button a 24px pointer target at every size', () => {
      render(
        <>
          {SIZES.map((size) => (
            <Tag key={size} size={size} dismissible>
              {size}
            </Tag>
          ))}
        </>,
      );
      for (const size of SIZES) {
        const button = screen.getByRole('button', { name: `Dismiss ${size}` });
        // A 20px button reaches 2px beyond each edge, a 16px one 4px: 24px either way.
        expect(button).toHaveClass('relative', 'before:absolute', METRICS[size].hitLayer);
      }
    });
  });

  describe('disabled (P6-01: D24, D25)', () => {
    it('disables the Dismiss button natively: click, Enter, Space, Delete and Backspace call no onDismiss, and Tab skips it', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <>
          <button type="button">Before</button>
          <Tag dismissible disabled onDismiss={onDismiss} data-testid="tag">
            Cherry
          </Tag>
          <button type="button">After</button>
        </>,
      );
      const dismiss = screen.getByRole('button', { name: 'Dismiss Cherry' });
      expect(dismiss).toBeDisabled();
      expect(dismiss).not.toHaveAttribute('aria-disabled');
      expect(dismiss).not.toHaveAttribute('data-disabled-focusable');
      fireEvent.click(dismiss);
      await user.click(dismiss);
      for (const key of ['Enter', ' ', 'Delete', 'Backspace']) {
        fireEvent.keyDown(dismiss, { key });
        fireEvent.keyUp(dismiss, { key });
      }
      expect(onDismiss).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Before' }));
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

      const tag = screen.getByTestId('tag');
      expect(tag).toHaveAttribute('data-disabled', '');
      // ARIA 1.2 allows no aria-disabled on a generic span.
      expect(tag).not.toHaveAttribute('aria-disabled');
    });

    it.each([
      [
        'a merged disabledFocusable Button',
        <Button key="b" disabledFocusable icon={<CustomIcon />} />,
        BUTTON_SLOT_WARNING,
      ],
      [
        'a merged <button disabled={false}>',
        <button key="n" type="button" disabled={false}>
          <CustomIcon />
        </button>,
        BUTTON_SLOT_WARNING,
      ],
      [
        'the deprecated { disabled: false } object',
        { disabled: false, children: <CustomIcon /> } as Slot<'span'>,
        BUTTON_OBJECT_WARNING,
      ],
    ])('disabled wins over %s', (_, dismissIcon, warning) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onDismiss = vi.fn();
      render(
        <Tag dismissible disabled onDismiss={onDismiss} dismissIcon={dismissIcon}>
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      const button = buttons[0];
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('aria-disabled');
      expect(button).not.toHaveAttribute('data-disabled');
      expect(button).not.toHaveAttribute('data-disabled-focusable');
      fireEvent.click(button);
      expect(onDismiss).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(warning)]]);
    });

    it('dims the tag once and lifts while a focus ring shows inside', () => {
      render(
        <>
          <Tag dismissible disabled data-testid="disabled">
            Cherry
          </Tag>
          <Tag dismissible data-testid="enabled">
            Plum
          </Tag>
        </>,
      );
      const disabled = screen.getByTestId('disabled');
      expect(disabled).toHaveClass(
        'opacity-50',
        'focus-visible:opacity-100',
        'has-focus-visible:opacity-100',
      );
      const disabledButton = screen.getByRole('button', { name: 'Dismiss Cherry' });
      expect(disabledButton).not.toHaveClass('disabled:opacity-50');
      expect(disabledButton).not.toHaveClass('aria-disabled:opacity-50');
      expect(disabledButton).toHaveClass(
        'disabled:cursor-not-allowed',
        'aria-disabled:cursor-not-allowed',
      );
      // An enabled tag dims nothing itself; its button keeps the look of its own disabled states.
      expect(screen.getByTestId('enabled')).not.toHaveClass('opacity-50');
      expect(screen.getByRole('button', { name: 'Dismiss Plum' })).toHaveClass(
        'disabled:opacity-50',
        'aria-disabled:opacity-50',
        'aria-disabled:focus-visible:opacity-100',
      );
    });

    /** A Tag whose `disabled` the test switches, with a button after it to Tab to. */
    function HeldTag({ disabled, onDismiss }: { disabled: boolean; onDismiss?: () => void }) {
      return (
        <>
          <Tag dismissible disabled={disabled} onDismiss={onDismiss}>
            Cherry
          </Tag>
          <button type="button">After</button>
        </>
      );
    }

    it('a Dismiss button disabled while it has focus keeps focus, unavailable, until focus leaves it (D25)', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const { rerender } = render(<HeldTag disabled={false} onDismiss={onDismiss} />);
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      await user.tab();
      expect(button).toHaveFocus();

      rerender(<HeldTag disabled onDismiss={onDismiss} />);
      expect(button).toHaveFocus();
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-disabled', '');
      expect(button).toHaveAttribute('data-disabled-focusable', '');
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.keyboard('{Delete}');
      await user.keyboard('{Backspace}');
      await user.click(button);
      expect(onDismiss).not.toHaveBeenCalled();
      expect(button).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('aria-disabled');
      expect(button).not.toHaveAttribute('data-disabled-focusable');

      // Enabled again, it is an ordinary button; a disabled tag rendered unfocused is natively
      // disabled at once.
      rerender(<HeldTag disabled={false} onDismiss={onDismiss} />);
      expect(button).not.toBeDisabled();
      rerender(<HeldTag disabled onDismiss={onDismiss} />);
      expect(button).toBeDisabled();
    });

    it('a held control stays held when blur fires without focus moving (window blur)', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<HeldTag disabled={false} />);
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      await user.tab();
      rerender(<HeldTag disabled />);
      expect(button).toHaveAttribute('aria-disabled', 'true');

      const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      fireEvent.blur(button);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled();

      hasFocus.mockReturnValue(true);
      fireEvent.blur(button);
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('aria-disabled');
    });

    /** A link chip whose `disabled` the test switches, between two buttons. */
    function LinkChip({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
      return (
        <>
          <button type="button">Before</button>
          <Tag as="a" href="#react" disabled={disabled} onClick={onClick} data-testid="link">
            React
          </Tag>
          <button type="button">After</button>
        </>
      );
    }

    it('a disabled link chip is aria-disabled, has no href and its ring is undimmed', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const { rerender } = render(<LinkChip disabled onClick={onClick} />);
      const link = screen.getByTestId('link');
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('role', 'link');
      expect(link).not.toHaveAttribute('href');
      expect(link).toHaveAttribute('data-disabled', '');
      expect(screen.getByRole('link', { name: 'React' })).toBe(link);
      expect(link).toHaveClass('opacity-50', 'focus-visible:opacity-100');
      // A disabled `<a>` gets no `disabled` attribute.
      expect(link).not.toHaveAttribute('disabled');

      await user.click(screen.getByRole('button', { name: 'Before' }));
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

      // fireEvent returns false when the event's default was prevented.
      expect(fireEvent.click(link)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();

      // Disabled while it has focus: it keeps its href and focus until focus leaves it.
      rerender(<LinkChip disabled={false} onClick={onClick} />);
      expect(link).toHaveAttribute('href', '#react');
      expect(link).not.toHaveAttribute('aria-disabled');
      expect(link).not.toHaveAttribute('role');
      await user.click(screen.getByRole('button', { name: 'Before' }));
      await user.tab();
      expect(link).toHaveFocus();
      rerender(<LinkChip disabled onClick={onClick} />);
      expect(link).toHaveFocus();
      expect(link).toHaveAttribute('href', '#react');
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('data-disabled-focusable', '');
      expect(fireEvent.click(link)).toBe(false);
      await user.keyboard('{Enter}');
      expect(onClick).not.toHaveBeenCalled();

      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(link).not.toHaveAttribute('href');
      expect(link).not.toHaveAttribute('data-disabled-focusable');
      expect(link).toHaveAttribute('aria-disabled', 'true');
    });

    /** A button chip whose `disabled` the test switches, with a button after it to Tab to. */
    function ButtonChip({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
      return (
        <>
          <Tag as="button" type="button" disabled={disabled} onClick={onClick}>
            React
          </Tag>
          <button type="button">After</button>
        </>
      );
    }

    it('a button root disabled while it has focus keeps focus, unavailable, until focus leaves it (D25)', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onParentClick = vi.fn();
      const { rerender } = render(<ButtonChip disabled={false} onClick={onClick} />, {
        wrapper: ({ children }) => <div onClick={onParentClick}>{children}</div>,
      });
      const chip = screen.getByRole('button', { name: 'React' });
      await user.tab();
      expect(chip).toHaveFocus();

      rerender(<ButtonChip disabled onClick={onClick} />);
      expect(chip).toHaveFocus();
      expect(chip).not.toBeDisabled();
      expect(chip).toHaveAttribute('aria-disabled', 'true');
      expect(chip).toHaveAttribute('data-disabled', '');
      expect(chip).toHaveAttribute('data-disabled-focusable', '');
      expect(chip).toHaveClass('opacity-50', 'focus-visible:opacity-100');
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.click(chip);
      expect(onClick).not.toHaveBeenCalled();
      // Blocked as a natively disabled button's click: it does not reach ancestors.
      expect(onParentClick).not.toHaveBeenCalled();
      expect(chip).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(chip).toBeDisabled();
      expect(chip).not.toHaveAttribute('aria-disabled');
      expect(chip).not.toHaveAttribute('data-disabled-focusable');

      // Disabled while focus is elsewhere, it is natively disabled at once.
      rerender(<ButtonChip disabled={false} onClick={onClick} />);
      expect(chip).not.toBeDisabled();
      await user.click(chip);
      expect(onClick).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole('button', { name: 'After' }));
      rerender(<ButtonChip disabled onClick={onClick} />);
      expect(chip).toBeDisabled();
      expect(chip).not.toHaveAttribute('aria-disabled');
    });

    it('forwards disabled and value to an as element that takes them, never to the span or an anchor', () => {
      render(
        <>
          <Tag as="button" type="button" disabled value="x" data-testid="button">
            Button
          </Tag>
          <Tag disabled value="x" data-testid="span">
            Span
          </Tag>
          <Tag as="a" href="#x" disabled value="x" data-testid="anchor">
            Anchor
          </Tag>
          <Tag as="li" value="3" data-testid="item">
            Item
          </Tag>
        </>,
      );
      const button = screen.getByTestId('button');
      expect(button.tagName).toBe('BUTTON');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('value', 'x');
      for (const testId of ['span', 'anchor']) {
        const element = screen.getByTestId(testId);
        expect(element).not.toHaveAttribute('disabled');
        expect(element).not.toHaveAttribute('value');
        expect(element).toHaveAttribute('data-disabled', '');
      }
      expect(screen.getByTestId('item')).toHaveAttribute('value', '3');
    });

    it('forwards disabled and value to an as component', () => {
      const received: Array<{ disabled?: boolean; value?: string }> = [];
      function Chip({
        disabled,
        value,
        children,
      }: {
        disabled?: boolean;
        value?: string;
        children?: React.ReactNode;
      }) {
        received.push({ disabled, value });
        return <span>{children}</span>;
      }
      render(
        <Tag as={Chip} disabled value="x">
          Chip
        </Tag>,
      );
      expect(received.at(-1)).toEqual({ disabled: true, value: 'x' });
    });
  });

  describe('slots: media, icon, secondaryText (P6-01: D27)', () => {
    it('renders media, icon, primary text, secondary text and the Dismiss button in that order', () => {
      render(
        <Tag
          media={<Avatar name="Katri Athokas" />}
          icon={<CustomIcon />}
          secondaryText="Designer"
          dismissible
          data-testid="tag"
        >
          Katri
        </Tag>,
      );
      const parts = Array.from(screen.getByTestId('tag').children);
      expect(parts).toHaveLength(4);
      expect(parts[0]).toHaveClass(tagClassNames.media);
      expect(parts[0]).toContainElement(screen.getByRole('img', { name: 'Katri Athokas' }));
      expect(parts[1]).toHaveClass(tagClassNames.icon);
      expect(parts[1]).toContainElement(screen.getByTestId('custom-icon'));
      // The column wrapper holds the two texts, primary first.
      expect(Array.from(parts[2].children).map((part) => part.textContent)).toEqual([
        'Katri',
        'Designer',
      ]);
      expect(parts[3]).toBe(screen.getByRole('button', { name: 'Dismiss Katri' }));
    });

    it('sizes an Avatar in media for the tag; an Avatar own size wins; an Avatar in children keeps its size', () => {
      render(
        <>
          {SIZES.map((size) => (
            <Tag key={size} size={size} media={<Avatar name={`Media ${size}`} />}>
              {size}
            </Tag>
          ))}
          <Tag media={<Avatar name="Own size" size="small" />}>Own</Tag>
          <Tag>
            <Avatar name="In children" />
            Children
          </Tag>
        </>,
      );
      const boxes: Record<TagSize, readonly string[]> = {
        medium: avatarSizeClasses['extra-small'].split(' '),
        small: ['w-5', 'h-5'],
        'extra-small': ['w-4', 'h-4'],
      };
      for (const size of SIZES) {
        expect(screen.getByRole('img', { name: `Media ${size}` })).toHaveClass(...boxes[size]);
      }
      expect(screen.getByRole('img', { name: 'Own size' })).toHaveClass(
        ...avatarSizeClasses.small.split(' '),
      );
      expect(screen.getByRole('img', { name: 'In children' })).toHaveClass(
        ...avatarSizeClasses.medium.split(' '),
      );
    });

    it('hides the icon from assistive technology, not the media', () => {
      render(
        <Tag media={<Avatar name="Katri Athokas" />} icon={<CustomIcon />} data-testid="tag">
          Katri
        </Tag>,
      );
      const tag = screen.getByTestId('tag');
      expect(tag.querySelector(`.${tagClassNames.icon}`)).toHaveAttribute('aria-hidden', 'true');
      const media = tag.querySelector(`.${tagClassNames.media}`);
      expect(media).not.toHaveAttribute('aria-hidden');
      expect(screen.getByRole('img', { name: 'Katri Athokas' })).toBeInTheDocument();
    });

    function* nothing(): Generator<React.ReactNode> {
      // Yields nothing: an empty generator renders nothing.
    }
    it.each([
      ['an empty string', () => ''],
      ['an empty array', () => []],
      ['an empty Fragment', () => <></>],
      ['an empty generator', () => nothing()],
    ])(
      'renders no element for media, icon or secondaryText that render nothing (%s)',
      (_, empty) => {
        render(
          <Tag
            media={empty() as Slot<'span'>}
            icon={empty() as Slot<'span'>}
            secondaryText={empty() as React.ReactNode}
            data-testid="tag"
          >
            Cherry
          </Tag>,
        );
        const tag = screen.getByTestId('tag');
        expect(tag.children).toHaveLength(1);
        expect(tag.firstElementChild).toHaveClass(tagClassNames.primaryText);
        // Nothing takes room: the text inset applies.
        expect(tag).toHaveClass('ps-2.75');
        expect(tag).not.toHaveClass('ps-px');
        expect(tag).not.toHaveClass('ps-1.75');
      },
    );

    it('puts the two texts in a column with the two-line type only while secondaryText renders', () => {
      render(
        <>
          <Tag secondaryText="Designer" size="small" data-testid="two">
            Katri
          </Tag>
          <Tag data-testid="one">Cherry</Tag>
        </>,
      );
      const primary = screen.getByText('Katri');
      expect(primary).toHaveClass(tagClassNames.primaryText, 'text-caption-1', 'leading-3.5');
      const column = primary.parentElement as HTMLElement;
      expect(column).not.toBe(screen.getByTestId('two'));
      expect(column.className).toBe('inline-flex min-w-0 flex-col text-start');
      const secondary = screen.getByText('Designer');
      expect(secondary).toHaveClass(tagClassNames.secondaryText, 'text-caption-2', 'leading-3');
      expect(secondary.parentElement).toBe(column);

      const single = screen.getByText('Cherry');
      expect(single.parentElement).toBe(screen.getByTestId('one'));
      expect(single).not.toHaveClass('text-caption-1');
      expect(single).not.toHaveClass('leading-3.5');
    });

    it('names the dismiss button after the primary text only, with media, icon and secondary text', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Tag media={<Avatar name="Katri Athokas" />} dismissible>
            Katri
          </Tag>
          <Tag secondaryText="Designer" dismissible>
            Cherry
          </Tag>
          <Tag icon={<CustomIcon />} dismissible>
            Plum
          </Tag>
          <Tag
            media={<Avatar name="Fig Person" />}
            secondaryText="Fruit"
            dismissible
            dismissIcon={<button type="button">Remove</button>}
          >
            Fig
          </Tag>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Dismiss Katri' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss Cherry' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss Plum' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove Fig' })).toBeInTheDocument();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('uses only logical classes with every slot, in RTL', () => {
      renderWithProviders(
        <Tag
          media={<Avatar name="Katri Athokas" />}
          icon={<CustomIcon />}
          secondaryText="Designer"
          dismissible
          data-testid="tag"
        >
          Katri
        </Tag>,
        { dir: 'rtl' },
      );
      const tag = screen.getByTestId('tag');
      expect(tag).toHaveClass('ps-px', 'pe-1.25');
      const physical =
        /(?:^|\s|:)-?(?:[pm][lr]|left|right|rounded-[lr]|border-[lr]|text-left|text-right)(?:-|\s|$)/;
      for (const element of [tag, ...Array.from(tag.querySelectorAll('*'))]) {
        expect(element.getAttribute('class') ?? '').not.toMatch(physical);
      }
    });
  });

  it('renders and hydrates a dismissible tag with an Avatar media and secondary text', async () => {
    const error = vi.spyOn(console, 'error');
    const ui = (
      <Tag media={<Avatar name="Katri Athokas" />} secondaryText="Designer" dismissible>
        Katri
      </Tag>
    );
    const html = renderToString(ui);
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, ui);
      });
      expect(host.innerHTML).toBe(html);
      expect(within(host).getByRole('button')).toHaveAccessibleName('Dismiss Katri');
      expect(error).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      host.remove();
    }
  });

  it('calls onDismiss once per activation in StrictMode', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <React.StrictMode>
        <Tag dismissible onDismiss={onDismiss}>
          Cherry
        </Tag>
      </React.StrictMode>,
    );
    const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
    await user.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledTimes(2);
    await user.keyboard(' ');
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  describe('Delete and Backspace (P6-02: D33)', () => {
    it('dismisses on Delete and Backspace outside a TagGroup, once per press', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag dismissible onDismiss={onDismiss}>
          Cherry
        </Tag>,
      );
      await user.tab();
      await user.keyboard('{Delete}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
      await user.keyboard('{Backspace}');
      expect(onDismiss).toHaveBeenCalledTimes(2);

      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      // A held key repeats: only its first press dismisses.
      fireEvent.keyDown(button, { key: 'Delete', repeat: true });
      // Ctrl, Alt and Meta are other shortcuts; Shift is allowed.
      fireEvent.keyDown(button, { key: 'Delete', ctrlKey: true });
      fireEvent.keyDown(button, { key: 'Backspace', altKey: true });
      fireEvent.keyDown(button, { key: 'Backspace', metaKey: true });
      // An input method composing text owns the key.
      fireEvent.keyDown(button, { key: 'Backspace', isComposing: true });
      expect(onDismiss).toHaveBeenCalledTimes(2);
      fireEvent.keyDown(button, { key: 'Delete', shiftKey: true });
      expect(onDismiss).toHaveBeenCalledTimes(3);
    });

    it('dismisses once on a held Enter, Delete or Backspace', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag dismissible onDismiss={onDismiss}>
          Cherry
        </Tag>,
      );
      await user.tab();
      // A held key repeats (`repeat: true`), and the browser clicks a button on every repeated
      // Enter: only the first press dismisses.
      for (const key of ['Enter', 'Delete', 'Backspace']) {
        onDismiss.mockClear();
        await user.keyboard(`{${key}>4/}`);
        expect(onDismiss).toHaveBeenCalledTimes(1);
      }
    });

    it("dismisses through the button's own click, so the key reaches its onClick (detail 0)", () => {
      const onClick = vi.fn((event: React.MouseEvent) => event.detail);
      const onDismiss = vi.fn();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={
            <button type="button" onClick={onClick}>
              <CustomIcon />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss Cherry' }), {
        key: 'Delete',
      });
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveReturnedWith(0);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(vi.mocked(console.warn).mock.calls).toEqual([
        [expect.stringContaining(BUTTON_SLOT_WARNING)],
      ]);
    });

    it.each([
      ['onKeyDown', { onKeyDown: (event: React.KeyboardEvent) => event.preventDefault() }],
      ['onClick', { onClick: (event: React.MouseEvent) => event.preventDefault() }],
    ] as const)("a merged button's %s preventDefault() cancels Delete", (_name, handlers) => {
      const onDismiss = vi.fn();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={
            <button type="button" {...handlers}>
              <CustomIcon />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss Cherry' }), {
        key: 'Delete',
      });
      expect(onDismiss).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('a merged disabledFocusable Button blocks Delete', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={<Button disabledFocusable icon={<CustomIcon />} />}
        >
          Cherry
        </Tag>,
      );
      await user.tab();
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      expect(button).toHaveFocus();
      await user.keyboard('{Delete}{Backspace}');
      expect(onDismiss).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[expect.stringContaining(BUTTON_SLOT_WARNING)]]);
    });

    it('dismisses a tag on Delete while a link in its text has focus', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag dismissible onDismiss={onDismiss}>
          <a href="#react">React</a>
        </Tag>,
      );
      await user.tab();
      expect(screen.getByRole('link', { name: 'React' })).toHaveFocus();
      await user.keyboard('{Delete}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
      await user.keyboard('{Backspace}');
      expect(onDismiss).toHaveBeenCalledTimes(2);
      // The link keeps focus: the tag is the app's to remove.
      expect(screen.getByRole('link', { name: 'React' })).toHaveFocus();
      fireEvent.keyDown(screen.getByRole('link', { name: 'React' }), {
        key: 'Delete',
        repeat: true,
      });
      expect(onDismiss).toHaveBeenCalledTimes(2);
    });

    it('does not dismiss from an input in its text, from a portal opened from it, without a Dismiss button or while disabled', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const portalTarget = document.createElement('div');
      document.body.appendChild(portalTarget);
      try {
        const { rerender } = render(
          <Tag dismissible onDismiss={onDismiss}>
            <a href="#react">React</a>
            <input aria-label="Rename" defaultValue="React" />
            {/* A popup opened from the tag: in the React tree, outside the tag in the DOM. */}
            {createPortal(<button type="button">In a popup</button>, portalTarget)}
          </Tag>,
        );
        await user.click(screen.getByRole('textbox', { name: 'Rename' }));
        await user.keyboard('{Backspace}{Delete}');
        expect(screen.getByRole('textbox', { name: 'Rename' })).toHaveValue('Reac');
        fireEvent.keyDown(screen.getByRole('button', { name: 'In a popup' }), { key: 'Delete' });
        expect(onDismiss).not.toHaveBeenCalled();

        rerender(
          <Tag dismissible onDismiss={onDismiss} disabled>
            <a href="#react">React</a>
          </Tag>,
        );
        fireEvent.keyDown(screen.getByRole('link', { name: 'React' }), { key: 'Delete' });
        rerender(
          <Tag onDismiss={onDismiss} dismissible={false}>
            <a href="#react">React</a>
          </Tag>,
        );
        fireEvent.keyDown(screen.getByRole('link', { name: 'React' }), { key: 'Delete' });
        expect(onDismiss).not.toHaveBeenCalled();
      } finally {
        portalTarget.remove();
      }
    });

    it("a consumer's onKeyDown on the tag runs first and its preventDefault() cancels Delete on a link", () => {
      const onDismiss = vi.fn();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
      render(
        <Tag dismissible onDismiss={onDismiss} onKeyDown={onKeyDown}>
          <a href="#react">React</a>
        </Tag>,
      );
      fireEvent.keyDown(screen.getByRole('link', { name: 'React' }), { key: 'Delete' });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('renders data-wave-tag-item and data-wave-tag-dismiss', () => {
      render(
        <>
          <Tag data-testid="static">React</Tag>
          <Tag dismissible data-testid="dismissible">
            Cherry
          </Tag>
        </>,
      );
      expect(screen.getByTestId('static')).toHaveAttribute('data-wave-tag-item', '');
      expect(screen.getByTestId('dismissible')).toHaveAttribute('data-wave-tag-item', '');
      expect(screen.getByRole('button', { name: 'Dismiss Cherry' })).toHaveAttribute(
        'data-wave-tag-dismiss',
        '',
      );
    });

    it("moves focus to the link in a standalone tag's text when its focused Dismiss button unmounts, and nowhere when the tag goes", async () => {
      const user = userEvent.setup();
      function Lockable() {
        const [state, setState] = React.useState<'dismissible' | 'locked' | 'removed'>(
          'dismissible',
        );
        return state === 'removed' ? null : (
          <Tag
            dismissible={state === 'dismissible'}
            onDismiss={() => setState('locked')}
            onKeyDown={(event) => {
              if (event.key === 'x') setState('removed');
            }}
          >
            <a href="#react">React</a>
          </Tag>
        );
      }
      render(<Lockable />);
      await user.tab();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Dismiss React' })).toHaveFocus();
      await user.keyboard('{Enter}');
      await act(async () => {});
      expect(screen.getByRole('link', { name: 'React' })).toHaveFocus();
      await user.keyboard('x');
      await act(async () => {});
      expect(screen.queryByRole('link')).toBeNull();
      expect(document.activeElement).toBe(document.body);
    });
  });

  describe('a Dismiss button inside a link or a button (P6-03: D47)', () => {
    const NESTED_WARNINGS = {
      button:
        '[WaveUI] Tag: `as="button"` with `dismissible` puts the Dismiss button inside a button. Use InteractionTag instead: `InteractionTag.Primary` for the action, `InteractionTag.Secondary` for Dismiss.',
      a: '[WaveUI] Tag: a dismissible tag rendered as a link (`as="a"` or a link component) puts the Dismiss button inside the link. Put the link in the tag\'s content: `<Tag dismissible><a href>…</a></Tag>`.',
    } as const;

    it.each(['button', 'a'] as const)(
      'warns Tag:nested-button once for a dismissible Tag rendered as %s',
      (element) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // React reports the nested `<button>` itself (a link holding a button is valid HTML to it).
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const tag = (text: string) =>
          element === 'button' ? (
            <Tag as="button" type="button" dismissible>
              {text}
            </Tag>
          ) : (
            <Tag as="a" href="#react" dismissible>
              {text}
            </Tag>
          );
        const { rerender } = render(tag('React'));
        rerender(
          <>
            {tag('React')}
            {tag('Vue')}
          </>,
        );
        expect(warn.mock.calls).toEqual([[NESTED_WARNINGS[element]]]);
        // React's own report of the nesting (its format strings and their arguments).
        const nesting = [
          ['In HTML, %s cannot be a descendant of <%s>.', '<button>', 'button'],
          ['<%s> cannot contain a nested %s.', 'button', '<button>'],
        ];
        expect(
          error.mock.calls.map(([format, child, parent]) => [
            String(format).split('\n')[0],
            child,
            parent,
          ]),
        ).toEqual(element === 'button' ? nesting : []);
        // It still renders the 0.10 DOM.
        const root = screen.getByText('React').parentElement;
        expect(root?.localName).toBe(element);
        expect(root).toContainElement(screen.getByRole('button', { name: 'Dismiss React' }));
      },
    );

    it('warns for a link component too, read from the rendered element', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const RouterLink = ({ ref, ...props }: React.ComponentPropsWithRef<'a'>) => (
        <a ref={ref} {...props} />
      );
      render(
        <Tag as={RouterLink} href="#react" dismissible>
          React
        </Tag>,
      );
      expect(warn.mock.calls).toEqual([[NESTED_WARNINGS.a]]);
    });

    it("does not warn without dismissible or for a link in the tag's content", () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Tag as="a" href="#react">
            React
          </Tag>
          <Tag as="button" type="button" dismissible={false}>
            Vue
          </Tag>
          <Tag dismissible>
            <a href="#svelte">Svelte</a>
          </Tag>
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Dismiss Svelte' })).toBeInTheDocument();
    });
  });

  describe('types (button-provider#8, data-display#1)', () => {
    it('type-checks props against the `as` element', () => {
      const anchorRef = React.createRef<HTMLAnchorElement>();
      const elementRef = React.createRef<HTMLElement>();
      render(
        <>
          <Tag as="a" href="/topics/react" ref={anchorRef}>
            React
          </Tag>
          <Tag ref={elementRef}>Vue</Tag>
        </>,
      );
      expect(anchorRef.current).toBe(screen.getByRole('link', { name: 'React' }));
      expect(elementRef.current?.tagName.toLowerCase()).toBe('span');
    });

    it('rejects props the rendered element does not have', () => {
      const elements = [
        // @ts-expect-error href is not a <span> attribute
        <Tag key="1" href="/nope" />,
        // @ts-expect-error dismissLabel is a string
        <Tag key="2" dismissLabel={3} />,
      ];
      expect(elements).toHaveLength(2);
    });

    it('accepts icon content and the deprecated button-object form for dismissIcon', () => {
      expectTypeOf<{ onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }>().toExtend<
        NonNullable<TagOwnProps['dismissIcon']>
      >();
      expectTypeOf<React.ReactElement>().toExtend<NonNullable<TagOwnProps['dismissIcon']>>();
      expectTypeOf<TagProps>().toEqualTypeOf<TagProps<'span'>>();
      interface FilterTagProps extends TagProps {
        filterId: string;
      }
      expectTypeOf<FilterTagProps>().toHaveProperty('dismissible');
    });

    it('types the look, the state and the slots with the shared tag unions (P6-01)', () => {
      expectTypeOf<TagProps['size']>().toEqualTypeOf<TagSize | undefined>();
      expectTypeOf<TagProps['appearance']>().toEqualTypeOf<TagAppearance | undefined>();
      expectTypeOf<TagProps['shape']>().toEqualTypeOf<TagShape | undefined>();
      expectTypeOf<TagProps['selected']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<TagProps['value']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TagOwnProps['media']>().toEqualTypeOf<Slot<'span'> | undefined>();
      expectTypeOf<TagOwnProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
      expectTypeOf<TagOwnProps['secondaryText']>().toEqualTypeOf<React.ReactNode>();
      // Tag's own props shadow the element attributes of the same names (D26, §8 Q4).
      expectTypeOf<TagProps<'button'>['disabled']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<TagProps<'li'>['value']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TagProps<'button'>['value']>().toEqualTypeOf<string | undefined>();
      interface PersonTagProps extends TagProps {
        personId: string;
      }
      expectTypeOf<PersonTagProps>().toHaveProperty('media');
    });

    it('rejects values outside the tag unions', () => {
      const elements = [
        // @ts-expect-error a tag has no large size
        <Tag key="1" size="large" />,
        // @ts-expect-error tint is a Badge appearance, not a tag one
        <Tag key="2" appearance="tint" />,
        // @ts-expect-error a tag has no square shape
        <Tag key="3" shape="square" />,
        // @ts-expect-error selected is a boolean
        <Tag key="4" selected="yes" />,
        // @ts-expect-error value is a string
        <Tag key="5" value={1} />,
        // @ts-expect-error value is a string on an li too (D26)
        <Tag key="6" as="li" value={1} />,
      ];
      expect(elements).toHaveLength(6);
    });
  });
});

describe('Tag stories', () => {
  const { Dismissible, FilterGroup } = composeStories(stories);

  it('FilterGroup focuses the next filter after a dismiss, else the previous one, else "Reset filters"', async () => {
    const user = userEvent.setup();
    render(<FilterGroup />);
    // Nothing to reset yet: the button is unavailable but focusable.
    const reset = screen.getByRole('button', { name: 'Reset filters' });
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    expect(reset).not.toBeDisabled();
    // A TagGroup toolbar: one Tab stop, then the arrow keys.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove Red' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Remove Blue' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Remove Blue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Large' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Remove Red' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(reset).toHaveFocus();
    expect(reset).not.toHaveAttribute('aria-disabled');

    await user.keyboard('{Enter}');
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    for (const filter of ['Red', 'Blue', 'Large']) {
      expect(screen.getByRole('button', { name: `Remove ${filter}` })).toBeInTheDocument();
    }
  });

  it('Dismissible focuses a separate Restore button after a dismiss; it brings the tag back', async () => {
    const user = userEvent.setup();
    render(<Dismissible />);
    // While the tag is shown, Restore is unavailable but focusable, and pressing it does nothing.
    const restore = screen.getByRole('button', { name: 'Restore' });
    expect(restore).toHaveAttribute('aria-disabled', 'true');
    expect(restore).not.toBeDisabled();
    await user.click(restore);
    expect(screen.getByText('Dismissible tag')).toBeInTheDocument();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Dismiss Dismissible tag' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.queryByText('Dismissible tag')).toBeNull();
    expect(restore).toHaveFocus();
    expect(restore).not.toHaveAttribute('aria-disabled');

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Dismiss Dismissible tag' })).toBeInTheDocument();
  });
});
