import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/Tag.stories';
import { Tag } from '../Tag';
import type { TagOwnProps, TagProps } from '../Tag';
import { Button } from '../../button/Button';
import type { Slot } from '../../../lib/slot';
import {
  asClientReference,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

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
     * A filter bar that follows the documented recipe: when a dismissal removes a tag, focus the
     * next tag's dismiss button, else the previous one, else a button next to the group. The
     * `FilterBar` of `stories/Tag.stories.tsx` implements the same recipe: keep the two in sync.
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
    expect(tag).toHaveClass('ps-3', 'pe-1.5');
    expect(tag.className).not.toMatch(/\bp[lr]-/);
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
    await user.tab();
    await user.tab();
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
