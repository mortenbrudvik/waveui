import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { TagGroup } from '../TagGroup';
import type { TagGroupProps } from '../TagGroup';
import { Tag } from '../Tag';
import { InteractionTag } from '../InteractionTag';
import type { InteractionTagProps } from '../InteractionTag';
import { TagGroupHostContext, TagHostContext } from '../TagGroup.context';
import type { TagGroupHostOptions } from '../TagGroup.context';
import { Avatar } from '../Avatar';
import { Toolbar } from '../../button/Toolbar';
import { tagGroupClassNames } from '../../../lib/classNames';
import { forcedColors } from '../../../lib/styles';
import type { TagAppearance, TagShape, TagSize } from '../../../lib/types';
import {
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const FOCUS_LOST_WARNING =
  '[WaveUI] TagGroup: the tag that had focus was removed and no other tag could take focus, so focus fell to the page. Pass `fallbackFocusRef` (for example an "Add" or "Reset filters" button outside the group).';
const MISSING_VALUE_WARNING =
  '[WaveUI] TagGroup: a tag without `value` is in a group with `onDismiss` or a selection, so it is reported by a generated id. Give every tag a `value`.';
const duplicateWarning = (value: string) =>
  `[WaveUI] TagGroup: several tags share the value "${value}". Give every tag of a group its own \`value\`: \`onDismiss\` and the selection cannot tell them apart.`;
const LISTBOX_ROLE_WARNING =
  '[WaveUI] TagGroup: `role="listbox"` is not supported (an option cannot hold a Dismiss button); the group keeps the toolbar keyboard. Use InteractionTags in the default toolbar for selectable tags, or Listbox for a list of values.';
const STATIC_TOOLBAR_WARNING =
  '[WaveUI] TagGroup: this toolbar has tags but no control (no Dismiss button, InteractionTag or link). Pass `role="list"` for tags that only display.';
const LIST_ITEM_WARNING =
  '[WaveUI] TagGroup: a tag in a `role="list"` group is not a list item (its element is a link, a button or a component). Put a link in the tag\'s content (`<Tag><a href>…</a></Tag>`), or wrap the tag in an element with `role="listitem"`.';
const SELECTED_IN_GROUP_WARNING =
  "[WaveUI] InteractionTag: `selected` has no effect in a TagGroup that selects (`value`, `defaultValue` or `onValueChange`); the group's `value` decides.";

/** Spies on `console.warn`; read the messages with `warnings()`. */
function spyOnWarnings() {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  return () => spy.mock.calls.map((call) => String(call[0]));
}

/** The Dismiss button of the tag whose text is `text` ("Dismiss <text>"). */
const dismissButton = (text: string) => screen.getByRole('button', { name: `Dismiss ${text}` });

/** The Primary of the InteractionTag whose text is `text` (named by its text alone). */
const primaryButton = (text: string) => screen.getByRole('button', { name: text });

interface InteractionProps extends Omit<InteractionTagProps, 'children'> {
  /** The Primary's text; also the tag's `value` unless `value` is given. */
  text: string;
  /** Renders an `InteractionTag.Secondary` ("Dismiss <text>"). @default true */
  withSecondary?: boolean;
  /** The Secondary's `onClick`. */
  onSecondaryClick?: React.MouseEventHandler<HTMLButtonElement>;
}

/** An InteractionTag whose Primary is `text` and, by default, a Secondary "Dismiss <text>". */
function Interaction({
  text,
  value = text,
  withSecondary = true,
  onSecondaryClick,
  ...props
}: InteractionProps) {
  return (
    <InteractionTag value={value} {...props}>
      <InteractionTag.Primary>{text}</InteractionTag.Primary>
      {withSecondary && <InteractionTag.Secondary onClick={onSecondaryClick} />}
    </InteractionTag>
  );
}

/** Lets the focus move after a removal (a microtask after the commit) land. */
async function settle() {
  await act(async () => {});
}

const FRUITS = ['Cherry', 'Plum', 'Fig'];

interface ChipsProps extends Partial<TagGroupProps> {
  /** The Primaries' texts; each tag's `value` is its text in lower case. */
  fruits?: readonly string[];
  /** Renders an `InteractionTag.Secondary` on every tag. @default false */
  withSecondary?: boolean;
}

/** Selectable fruit chips: InteractionTags in a TagGroup named "Fruit". */
function Chips({ fruits = FRUITS, withSecondary = false, ...props }: ChipsProps) {
  return (
    <TagGroup aria-label="Fruit" {...props}>
      {fruits.map((fruit) => (
        <Interaction
          key={fruit}
          text={fruit}
          value={fruit.toLowerCase()}
          withSecondary={withSecondary}
        />
      ))}
    </TagGroup>
  );
}

/** The `aria-pressed` of each Primary of `texts`, in order. */
const pressedStates = (texts: readonly string[] = FRUITS) =>
  texts.map((text) => primaryButton(text).getAttribute('aria-pressed'));

/** The form named `name`. */
const formNamed = (name: string) => screen.getByRole('form', { name }) as HTMLFormElement;

/**
 * `form.checkValidity()` inside `act()`: it fires `invalid` at a required, empty group's hidden
 * input, whose handler moves focus (a state update of the held-focus hook).
 */
function checkValidity(form: HTMLFormElement): boolean {
  let valid = false;
  act(() => {
    valid = form.checkValidity();
  });
  return valid;
}

interface FiltersProps {
  initial?: readonly string[];
  /** Props of the TagGroup (its `onDismiss` is called before the filter is removed). */
  groupProps?: Partial<TagGroupProps>;
  /** Passes the "Reset filters" button as the group's `fallbackFocusRef`. @default true */
  withFallback?: boolean;
  /** Renders each filter's tag (default: a Tag whose value and text are the filter). */
  renderTag?: (filter: string) => React.ReactNode;
}

/** A dismissible filter bar that removes a filter from its state when the group reports it. */
function Filters({
  initial = ['Red', 'Blue', 'Large'],
  groupProps,
  withFallback = true,
  renderTag,
}: FiltersProps) {
  const [filters, setFilters] = React.useState<readonly string[]>(initial);
  const reset = React.useRef<HTMLButtonElement>(null);
  const { onDismiss, ...rest } = groupProps ?? {};
  return (
    <>
      <TagGroup
        aria-label="Filters"
        dismissible
        fallbackFocusRef={withFallback ? reset : undefined}
        {...rest}
        onDismiss={(value) => {
          onDismiss?.(value);
          setFilters((current) => current.filter((filter) => filter !== value));
        }}
      >
        {filters.map((filter) =>
          renderTag ? (
            <React.Fragment key={filter}>{renderTag(filter)}</React.Fragment>
          ) : (
            <Tag key={filter} value={filter}>
              {filter}
            </Tag>
          ),
        )}
      </TagGroup>
      <button type="button" ref={reset} onClick={() => setFilters(initial)}>
        Reset filters
      </button>
    </>
  );
}

describe('TagGroup', () => {
  testSystemProps(TagGroup, {
    expectedTag: 'div',
    displayName: 'TagGroup',
    defaultProps: { 'aria-label': 'Filters', children: <Tag dismissible>Red</Tag> },
    conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
    a11yVariants: [
      {
        name: 'dismissible Tags',
        props: {
          dismissible: true,
          children: [
            <Tag key="red" value="red">
              Red
            </Tag>,
            <Tag key="blue" value="blue" media={<Avatar name="Blue Team" />}>
              Blue
            </Tag>,
          ],
        },
      },
      {
        name: 'role list of static tags',
        props: {
          role: 'list',
          children: [<Tag key="red">Red</Tag>, <Tag key="blue">Blue</Tag>],
        },
      },
      {
        name: 'InteractionTags with Secondaries',
        props: {
          children: [
            <Interaction key="cherry" text="Cherry" />,
            <Interaction key="plum" text="Plum" selected />,
            <Interaction key="fig" text="Fig" withSecondary={false} />,
          ],
        },
      },
      {
        name: 'Tags and InteractionTags in a list',
        props: {
          role: 'list',
          children: [<Tag key="red">Red</Tag>, <Interaction key="cherry" text="Cherry" />],
        },
      },
      { name: 'disabled', props: { disabled: true, dismissible: true } },
      {
        name: 'disabled InteractionTags',
        props: { disabled: true, children: <Interaction text="Cherry" /> },
      },
      { name: 'disabled list', props: { role: 'list', disabled: true, dismissible: true } },
      { name: 'vertical', props: { orientation: 'vertical', dismissible: true } },
      {
        name: 'selecting InteractionTags',
        props: {
          defaultValue: ['plum'],
          children: [
            <Interaction key="cherry" text="Cherry" withSecondary={false} />,
            <Interaction key="plum" text="Plum" value="plum" withSecondary={false} />,
          ],
        },
      },
      {
        name: 'selecting and dismissible InteractionTags',
        props: {
          defaultValue: ['cherry'],
          children: [
            <Interaction key="cherry" text="Cherry" value="cherry" />,
            <Interaction key="plum" text="Plum" value="plum" />,
          ],
        },
      },
      {
        name: 'required with name',
        props: {
          name: 'fruit',
          required: true,
          onValueChange: () => {},
          children: [
            <Interaction key="cherry" text="Cherry" value="cherry" withSecondary={false} />,
            <Interaction key="plum" text="Plum" value="plum" withSecondary={false} />,
          ],
        },
      },
      {
        name: 'disabled selecting InteractionTags with name',
        props: {
          disabled: true,
          name: 'fruit',
          defaultValue: ['cherry'],
          children: <Interaction text="Cherry" value="cherry" />,
        },
      },
    ],
  });

  describe('roles and attributes (D30, D41)', () => {
    it.each(['horizontal', 'vertical'] as const)(
      'is a named toolbar with aria-orientation and data-orientation (%s)',
      (orientation) => {
        render(
          <TagGroup aria-label="Filters" orientation={orientation} dismissible>
            <Tag>Red</Tag>
          </TagGroup>,
        );
        const group = screen.getByRole('toolbar', { name: 'Filters' });
        expect(group).toHaveAttribute('aria-orientation', orientation);
        expect(group).toHaveAttribute('data-orientation', orientation);
        expect(group).toHaveAttribute('data-roving-container', '');
        if (orientation === 'vertical') expect(group).toHaveClass('flex-col', 'items-start');
      },
    );

    it('renders data-size, data-appearance and data-shape with their defaults, and the default classes', () => {
      render(
        <TagGroup aria-label="Filters" dismissible>
          <Tag>Red</Tag>
        </TagGroup>,
      );
      const group = screen.getByRole('toolbar');
      expect(group).toHaveAttribute('data-size', 'medium');
      expect(group).toHaveAttribute('data-appearance', 'filled');
      expect(group).toHaveAttribute('data-shape', 'circular');
      expect(group).not.toHaveAttribute('data-disabled');
      // The default box (Phase 4 rule 14): no default look changes by accident.
      expect(Array.from(group.classList).sort()).toEqual(
        [
          tagGroupClassNames.root,
          'relative',
          'inline-flex',
          'flex-wrap',
          'items-center',
          'gap-2',
        ].sort(),
      );
    });

    it.each([
      ['medium', 'gap-2'],
      ['small', 'gap-1.5'],
      ['extra-small', 'gap-1'],
    ] as const)('spaces %s tags with %s', (size, gap) => {
      render(
        <TagGroup aria-label="Filters" size={size} dismissible>
          <Tag>Red</Tag>
        </TagGroup>,
      );
      expect(screen.getByRole('toolbar')).toHaveClass(gap);
      expect(screen.getByRole('toolbar')).toHaveAttribute('data-size', size);
    });

    it('renders aria-disabled and data-disabled only while disabled', async () => {
      const { rerender } = render(
        <TagGroup aria-label="Filters" dismissible>
          <Tag>Red</Tag>
        </TagGroup>,
      );
      const group = screen.getByRole('toolbar');
      expect(group).not.toHaveAttribute('aria-disabled');
      expect(group).not.toHaveAttribute('data-disabled');
      // The roving store sees the disabled controls in a microtask (its MutationObserver).
      await act(async () => {
        rerender(
          <TagGroup aria-label="Filters" dismissible disabled>
            <Tag>Red</Tag>
          </TagGroup>,
        );
      });
      expect(group).toHaveAttribute('aria-disabled', 'true');
      expect(group).toHaveAttribute('data-disabled', '');
    });

    it('keeps the toolbar keyboard for a consumer role other than list', async () => {
      const user = userEvent.setup();
      render(
        <TagGroup role="group" aria-label="Filters" dismissible>
          <Tag>Red</Tag>
          <Tag>Blue</Tag>
        </TagGroup>,
      );
      const group = screen.getByRole('group', { name: 'Filters' });
      expect(group).toHaveAttribute('data-roving-container', '');
      // `aria-orientation` belongs to the toolbar role only.
      expect(group).not.toHaveAttribute('aria-orientation');
      await user.tab();
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Blue')).toHaveFocus();
    });

    it('with role list gives every tag role listitem, renders no aria-orientation or aria-disabled, keeps every control a Tab stop and handles no arrow key', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <TagGroup role="list" aria-label="Filters" dismissible>
          <Tag>Red</Tag>
          <Tag>Blue</Tag>
        </TagGroup>,
      );
      const list = screen.getByRole('list', { name: 'Filters' });
      expect(list).not.toHaveAttribute('aria-orientation');
      expect(list).not.toHaveAttribute('data-roving-container');
      expect(list).toHaveAttribute('data-orientation', 'horizontal');
      const items = within(list).getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual(['RedDismiss', 'BlueDismiss']);

      await user.tab();
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Red')).toHaveFocus();
      await user.tab();
      expect(dismissButton('Blue')).toHaveFocus();

      rerender(
        <TagGroup role="list" aria-label="Filters" dismissible disabled>
          <Tag>Red</Tag>
          <Tag>Blue</Tag>
        </TagGroup>,
      );
      expect(list).not.toHaveAttribute('aria-disabled');
      expect(list).toHaveAttribute('data-disabled', '');
    });

    it('with role list gives an InteractionTag root role listitem, and both of its buttons keep a Tab stop', async () => {
      const user = userEvent.setup();
      const warnings = spyOnWarnings();
      render(
        <TagGroup role="list" aria-label="Fruit">
          <Interaction text="Cherry" data-testid="cherry" />
          <Interaction text="Plum" role="note" data-testid="plum" />
        </TagGroup>,
      );
      expect(screen.getByTestId('cherry')).toHaveAttribute('role', 'listitem');
      // The consumer's role wins.
      expect(screen.getByTestId('plum')).toHaveAttribute('role', 'note');
      await user.tab();
      expect(primaryButton('Cherry')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(primaryButton('Cherry')).toHaveFocus();
      await user.tab();
      expect(dismissButton('Cherry')).toHaveFocus();
      // An InteractionTag's root is a list item itself: no list-item warning.
      expect(warnings()).toEqual([]);
    });

    it('gives no listitem role to a link chip, a list item element or a tag with its own role', () => {
      render(
        <TagGroup role="list" aria-label="Topics">
          <span role="listitem">
            <Tag as="a" href="#react" data-testid="link">
              React
            </Tag>
          </span>
          <Tag as="li" data-testid="li">
            Vue
          </Tag>
          <span role="listitem">
            <Tag role="note" data-testid="note">
              Svelte
            </Tag>
          </span>
          <Tag data-testid="span">Solid</Tag>
        </TagGroup>,
      );
      expect(screen.getByTestId('link')).not.toHaveAttribute('role');
      expect(screen.getByTestId('li')).not.toHaveAttribute('role');
      expect(screen.getByTestId('note')).toHaveAttribute('role', 'note');
      expect(screen.getByTestId('span')).toHaveAttribute('role', 'listitem');
    });

    it("restores the controls' own tabIndex when the role changes from toolbar to list", async () => {
      const user = userEvent.setup();
      const group = (role?: string) => (
        <TagGroup role={role} aria-label="Filters" dismissible>
          <Tag>Red</Tag>
          <Tag>
            <a href="#blue" tabIndex={0}>
              Blue
            </a>
          </Tag>
        </TagGroup>
      );
      const { rerender } = render(group());
      const link = screen.getByRole('link', { name: 'Blue' });
      // The toolbar stamps one Tab stop.
      expect(dismissButton('Red')).toHaveAttribute('tabindex', '0');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(dismissButton('Blue')).toHaveAttribute('tabindex', '-1');

      rerender(group('list'));
      expect(dismissButton('Red')).not.toHaveAttribute('tabindex');
      expect(link).toHaveAttribute('tabindex', '0');
      expect(dismissButton('Blue')).not.toHaveAttribute('tabindex');
      await user.tab();
      await user.tab();
      await user.tab();
      expect(dismissButton('Blue')).toHaveFocus();
    });
  });

  describe('keyboard in the toolbar (D31)', () => {
    it('has one Tab stop: the first control, then the last focused one', async () => {
      const user = userEvent.setup();
      render(<Filters />);
      await user.tab();
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Blue')).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Reset filters' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(dismissButton('Blue')).toHaveFocus();
    });

    it('moves and wraps with Left/Right over Dismiss buttons, link chips and both InteractionTag buttons', async () => {
      const user = userEvent.setup();
      render(
        <TagGroup aria-label="Topics" dismissible>
          <Tag value="red">Red</Tag>
          <Tag as="a" href="#react" dismissible={false}>
            React
          </Tag>
          <Interaction text="Cherry" />
          <Tag value="vue">
            <a href="#vue">Vue</a>
          </Tag>
        </TagGroup>,
      );
      const order = [
        dismissButton('Red'),
        screen.getByRole('link', { name: 'React' }),
        primaryButton('Cherry'),
        dismissButton('Cherry'),
        screen.getByRole('link', { name: 'Vue' }),
        dismissButton('Vue'),
      ];
      await user.tab();
      expect(order[0]).toHaveFocus();
      for (const target of [...order.slice(1), order[0]]) {
        await user.keyboard('{ArrowRight}');
        expect(target).toHaveFocus();
      }
      await user.keyboard('{ArrowLeft}');
      expect(order[5]).toHaveFocus();
      // One Tab stop: the InteractionTag's buttons are roving items too.
      expect(order.filter((control) => control.tabIndex === 0)).toEqual([order[5]]);
    });

    it('jumps with Home/End', async () => {
      const user = userEvent.setup();
      render(<Filters />);
      await user.tab();
      await user.keyboard('{End}');
      expect(dismissButton('Large')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(dismissButton('Red')).toHaveFocus();
    });

    it('uses Up/Down when vertical and ignores Left/Right', async () => {
      const user = userEvent.setup();
      render(<Filters groupProps={{ orientation: 'vertical' }} />);
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(dismissButton('Blue')).toHaveFocus();
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(dismissButton('Large')).toHaveFocus();
    });

    it('ignores Up/Down when horizontal', async () => {
      const user = userEvent.setup();
      render(<Filters />);
      await user.tab();
      await user.keyboard('{ArrowDown}{ArrowUp}');
      expect(dismissButton('Red')).toHaveFocus();
    });

    it('mirrors Left/Right in RTL', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Filters />, { dir: 'rtl' });
      await user.tab();
      await user.keyboard('{ArrowLeft}');
      expect(dismissButton('Blue')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Red')).toHaveFocus();
    });

    it('skips disabled tags', async () => {
      const user = userEvent.setup();
      render(
        <TagGroup aria-label="Filters" dismissible>
          <Tag>Red</Tag>
          <Tag disabled>Blue</Tag>
          <Tag>Large</Tag>
        </TagGroup>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Large')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(dismissButton('Red')).toHaveFocus();
    });

    it("runs the consumer's onKeyDown first and its preventDefault() cancels the navigation", async () => {
      const user = userEvent.setup();
      const calls: string[] = [];
      render(
        <Filters
          groupProps={{
            onKeyDown: (event) => {
              calls.push(event.key);
              if (event.key === 'ArrowRight') event.preventDefault();
            },
          }}
        />,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{End}');
      expect(dismissButton('Large')).toHaveFocus();
      expect(calls).toEqual(['ArrowRight', 'End']);
    });

    it("calls the consumer's onFocus", async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      render(<Filters groupProps={{ onFocus }} />);
      await user.tab();
      expect(onFocus).toHaveBeenCalledTimes(1);
      await user.keyboard('{ArrowRight}');
      expect(onFocus).toHaveBeenCalledTimes(2);
    });
  });

  describe('one arrow-axis rule with Toolbar (buttons-22)', () => {
    type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
    const KEYS: readonly Key[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

    /** Where focus lands from control `from` of three: the APG toolbar rule. */
    function expected(
      orientation: 'horizontal' | 'vertical',
      dir: 'ltr' | 'rtl',
      key: Key,
      from: number,
    ): number {
      if (key === 'Home') return 0;
      if (key === 'End') return 2;
      const next = (from + 1) % 3;
      const previous = (from + 2) % 3;
      if (orientation === 'vertical') {
        return key === 'ArrowDown' ? next : key === 'ArrowUp' ? previous : from;
      }
      if (key === 'ArrowUp' || key === 'ArrowDown') return from;
      const forward = dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';
      return key === forward ? next : previous;
    }

    const cases = (['Toolbar', 'TagGroup'] as const).flatMap((component) =>
      (['horizontal', 'vertical'] as const).flatMap((orientation) =>
        (['ltr', 'rtl'] as const).flatMap((dir) =>
          KEYS.map((key) => [component, orientation, dir, key] as const),
        ),
      ),
    );

    it.each(cases)('%s, %s, %s: %s', async (component, orientation, dir, key) => {
      const user = userEvent.setup();
      const ui =
        component === 'Toolbar' ? (
          <Toolbar aria-label="Controls" orientation={orientation}>
            <button type="button">One</button>
            <button type="button">Two</button>
            <button type="button">Three</button>
          </Toolbar>
        ) : (
          <TagGroup aria-label="Controls" orientation={orientation} dismissible>
            <Tag>One</Tag>
            <Tag>Two</Tag>
            <Tag>Three</Tag>
          </TagGroup>
        );
      renderWithProviders(ui, { dir });
      const controls = within(screen.getByRole('toolbar')).getAllByRole('button');
      expect(controls).toHaveLength(3);
      for (let from = 0; from < 3; from++) {
        act(() => controls[from].focus());
        await user.keyboard(`{${key}}`);
        expect(document.activeElement).toBe(controls[expected(orientation, dir, key, from)]);
      }
    });
  });

  describe('inheritance (D32)', () => {
    it("gives its tags its size, appearance and shape; a tag's own wins", () => {
      render(
        <TagGroup aria-label="Filters" size="small" appearance="brand" shape="rounded" dismissible>
          <Tag data-testid="inherits">Red</Tag>
          <Tag data-testid="own" size="medium" appearance="outline" shape="circular">
            Blue
          </Tag>
          <Interaction text="Cherry" data-testid="interaction" />
          <Interaction
            text="Plum"
            data-testid="own-interaction"
            size="medium"
            appearance="outline"
            shape="circular"
          />
        </TagGroup>,
      );
      const interaction = screen.getByTestId('interaction');
      expect(interaction).toHaveAttribute('data-size', 'small');
      expect(interaction).toHaveAttribute('data-appearance', 'brand');
      expect(interaction).toHaveAttribute('data-shape', 'rounded');
      expect(primaryButton('Cherry')).toHaveClass('min-h-6', 'bg-selected', 'rounded');
      expect(dismissButton('Cherry')).toHaveClass('min-w-6', 'bg-selected', 'rounded-e');
      const ownInteraction = screen.getByTestId('own-interaction');
      expect(ownInteraction).toHaveAttribute('data-size', 'medium');
      expect(ownInteraction).toHaveAttribute('data-appearance', 'outline');
      expect(ownInteraction).toHaveAttribute('data-shape', 'circular');
      expect(primaryButton('Plum')).toHaveClass('min-h-7', 'border-stroke', 'rounded-full');
      const inherits = screen.getByTestId('inherits');
      expect(inherits).toHaveAttribute('data-size', 'small');
      expect(inherits).toHaveAttribute('data-appearance', 'brand');
      expect(inherits).toHaveAttribute('data-shape', 'rounded');
      expect(inherits).toHaveClass('min-h-6', 'bg-selected', 'rounded');
      const own = screen.getByTestId('own');
      expect(own).toHaveAttribute('data-size', 'medium');
      expect(own).toHaveAttribute('data-appearance', 'outline');
      expect(own).toHaveAttribute('data-shape', 'circular');
      expect(own).toHaveClass('min-h-7', 'border-stroke', 'rounded-full');
    });

    it("disables every tag's controls; a tag's disabled={false} does not re-enable", () => {
      render(
        <TagGroup aria-label="Filters" disabled dismissible>
          <Tag data-testid="red">Red</Tag>
          <Tag data-testid="blue" disabled={false}>
            Blue
          </Tag>
          <Interaction text="Cherry" data-testid="cherry" disabled={false} />
        </TagGroup>,
      );
      for (const text of ['Red', 'Blue', 'Cherry']) expect(dismissButton(text)).toBeDisabled();
      expect(primaryButton('Cherry')).toBeDisabled();
      expect(screen.getByTestId('cherry')).toHaveAttribute('data-disabled', '');
      expect(screen.getByTestId('red')).toHaveAttribute('data-disabled', '');
      expect(screen.getByTestId('blue')).toHaveAttribute('data-disabled', '');
      expect(screen.getByTestId('blue')).toHaveClass('opacity-50');
    });

    it('gives Tags its dismissible; dismissible={false} opts out', () => {
      render(
        <TagGroup aria-label="Filters" dismissible>
          <Tag>Red</Tag>
          <Tag dismissible={false}>Blue</Tag>
        </TagGroup>,
      );
      expect(dismissButton('Red')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Dismiss Blue' })).toBeNull();
      expect(screen.getByText('Blue').parentElement).toHaveClass('pe-2.75');
    });

    it('does not warn for onDismiss on a Tag in a dismissible group', () => {
      const warnings = spyOnWarnings();
      render(
        <TagGroup aria-label="Filters" dismissible>
          <Tag onDismiss={() => {}}>Red</Tag>
        </TagGroup>,
      );
      expect(dismissButton('Red')).toBeInTheDocument();
      expect(warnings()).toEqual([]);
    });
  });

  it("keeps every Tag's Dismiss button named after its tag, in a toolbar and in a list", () => {
    const tags = (
      <>
        <Tag value="red">Red</Tag>
        <Tag value="blue" media={<Avatar name="Blue Team" />} secondaryText="Primary colour">
          Blue
        </Tag>
      </>
    );
    const { rerender } = render(
      <TagGroup aria-label="Filters" dismissible>
        {tags}
      </TagGroup>,
    );
    expect(dismissButton('Red')).toBeInTheDocument();
    expect(dismissButton('Blue')).toBeInTheDocument();
    rerender(
      <TagGroup role="list" aria-label="Filters" dismissible>
        {tags}
      </TagGroup>,
    );
    expect(dismissButton('Red')).toBeInTheDocument();
    expect(dismissButton('Blue')).toBeInTheDocument();
  });

  describe('onDismiss (D33, D34)', () => {
    it.each(['click', 'Enter', 'Space', 'Delete', 'Backspace'] as const)(
      "calls onDismiss(value) once on %s, after the Tag's own onDismiss",
      async (how) => {
        const user = userEvent.setup();
        const calls: string[] = [];
        render(
          <React.StrictMode>
            <TagGroup
              aria-label="Filters"
              dismissible
              onDismiss={(value) => calls.push(`group:${value}`)}
            >
              <Tag value="red" onDismiss={() => calls.push('tag')}>
                Red
              </Tag>
            </TagGroup>
          </React.StrictMode>,
        );
        if (how === 'click') {
          await user.click(dismissButton('Red'));
        } else {
          await user.tab();
          await user.keyboard(how === 'Space' ? ' ' : `{${how}}`);
        }
        expect(calls).toEqual(['tag', 'group:red']);
      },
    );

    it.each(['click', 'Enter', 'Space', 'Delete', 'Backspace'] as const)(
      "calls onDismiss(value) once on %s of a Secondary, after the Secondary's onClick",
      async (how) => {
        const user = userEvent.setup();
        const calls: string[] = [];
        render(
          <React.StrictMode>
            <TagGroup aria-label="Fruit" onDismiss={(value) => calls.push(`group:${value}`)}>
              <Interaction
                text="Cherry"
                value="cherry"
                onSecondaryClick={() => calls.push('own')}
              />
            </TagGroup>
          </React.StrictMode>,
        );
        if (how === 'click') {
          await user.click(dismissButton('Cherry'));
        } else {
          await user.tab();
          await user.keyboard('{ArrowRight}');
          expect(dismissButton('Cherry')).toHaveFocus();
          await user.keyboard(how === 'Space' ? ' ' : `{${how}}`);
        }
        expect(calls).toEqual(['own', 'group:cherry']);
      },
    );

    it.each(['Delete', 'Backspace'] as const)(
      'calls onDismiss(value) once on %s on a Primary with a Secondary, and never on one without',
      async (key) => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        render(
          <TagGroup aria-label="Fruit" onDismiss={onDismiss}>
            <Interaction text="Cherry" value="cherry" />
            <Interaction text="Fig" value="fig" withSecondary={false} />
          </TagGroup>,
        );
        await user.tab();
        expect(primaryButton('Cherry')).toHaveFocus();
        await user.keyboard(`{${key}}`);
        expect(onDismiss.mock.calls).toEqual([['cherry']]);
        await user.keyboard('{End}');
        expect(primaryButton('Fig')).toHaveFocus();
        await user.keyboard(`{${key}}`);
        expect(onDismiss).toHaveBeenCalledTimes(1);
      },
    );

    it('a Secondary onClick that calls preventDefault() cancels it', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <TagGroup aria-label="Fruit" onDismiss={onDismiss}>
          <Interaction text="Cherry" onSecondaryClick={(event) => event.preventDefault()} />
        </TagGroup>,
      );
      await user.click(dismissButton('Cherry'));
      fireEvent.keyDown(dismissButton('Cherry'), { key: 'Delete' });
      fireEvent.keyDown(primaryButton('Cherry'), { key: 'Backspace' });
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("a merged dismissIcon button's onKeyDown preventDefault() cancels Delete", () => {
      const onDismiss = vi.fn();
      const warnings = spyOnWarnings();
      render(
        <TagGroup aria-label="Filters" dismissible onDismiss={onDismiss}>
          <Tag
            value="red"
            dismissIcon={
              <button type="button" onKeyDown={(event) => event.preventDefault()}>
                <svg aria-hidden="true" />
              </button>
            }
          >
            Red
          </Tag>
        </TagGroup>,
      );
      fireEvent.keyDown(dismissButton('Red'), { key: 'Delete' });
      expect(onDismiss).not.toHaveBeenCalled();
      expect(warnings()).toEqual([
        expect.stringContaining('[WaveUI] Tag: `dismissIcon` received a button.'),
      ]);
    });

    it('ignores a repeated key', () => {
      const onDismiss = vi.fn();
      render(
        <TagGroup aria-label="Filters" dismissible onDismiss={onDismiss}>
          <Tag value="red">Red</Tag>
        </TagGroup>,
      );
      fireEvent.keyDown(dismissButton('Red'), { key: 'Delete', repeat: true });
      fireEvent.keyDown(dismissButton('Red'), { key: 'Backspace', repeat: true });
      expect(onDismiss).not.toHaveBeenCalled();
      fireEvent.keyDown(dismissButton('Red'), { key: 'Delete' });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('ignores Ctrl, Alt and Meta with Delete; Shift is allowed', () => {
      const onDismiss = vi.fn();
      render(
        <TagGroup aria-label="Filters" dismissible onDismiss={onDismiss}>
          <Tag value="red">Red</Tag>
        </TagGroup>,
      );
      for (const modifier of ['ctrlKey', 'altKey', 'metaKey'] as const) {
        fireEvent.keyDown(dismissButton('Red'), { key: 'Delete', [modifier]: true });
      }
      expect(onDismiss).not.toHaveBeenCalled();
      fireEvent.keyDown(dismissButton('Red'), { key: 'Delete', shiftKey: true });
      expect(onDismiss).toHaveBeenCalledWith('red');
    });

    it('ignores a key during composition', () => {
      const onDismiss = vi.fn();
      render(
        <TagGroup aria-label="Filters" dismissible onDismiss={onDismiss}>
          <Tag value="red">Red</Tag>
        </TagGroup>,
      );
      fireEvent.keyDown(dismissButton('Red'), { key: 'Backspace', isComposing: true });
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('dismisses nothing while disabled', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onTagDismiss = vi.fn();
      render(
        <TagGroup aria-label="Filters" dismissible disabled onDismiss={onDismiss}>
          <Tag value="red" onDismiss={onTagDismiss}>
            Red
          </Tag>
          <Interaction text="Cherry" onSecondaryClick={onTagDismiss} />
        </TagGroup>,
      );
      await user.click(dismissButton('Red'));
      fireEvent.click(dismissButton('Red'));
      for (const control of [
        dismissButton('Red'),
        dismissButton('Cherry'),
        primaryButton('Cherry'),
      ]) {
        fireEvent.click(control);
        for (const key of ['Enter', ' ', 'Delete', 'Backspace']) {
          fireEvent.keyDown(control, { key });
        }
      }
      expect(onDismiss).not.toHaveBeenCalled();
      expect(onTagDismiss).not.toHaveBeenCalled();
    });
  });

  describe('focus after a removal (D35)', () => {
    it("focuses the next tag's Dismiss button after the middle tag goes", async () => {
      const user = userEvent.setup();
      render(<Filters />);
      await user.tab();
      await user.keyboard('{ArrowRight}{Enter}');
      await settle();
      expect(screen.queryByText('Blue')).toBeNull();
      expect(document.activeElement).not.toBe(document.body);
      expect(dismissButton('Large')).toHaveFocus();
    });

    it('focuses the previous one after the last tag goes', async () => {
      const user = userEvent.setup();
      render(<Filters />);
      await user.tab();
      await user.keyboard('{End}{Delete}');
      await settle();
      expect(screen.queryByText('Large')).toBeNull();
      expect(dismissButton('Blue')).toHaveFocus();
    });

    it('focuses fallbackFocusRef after the only tag goes', async () => {
      const user = userEvent.setup();
      render(<Filters initial={['Red']} />);
      await user.tab();
      await user.keyboard('{Backspace}');
      await settle();
      expect(screen.queryByText('Red')).toBeNull();
      expect(screen.getByRole('button', { name: 'Reset filters' })).toHaveFocus();
    });

    it('never drops focus while every tag is dismissed in turn with Enter, Space, Delete and Backspace', async () => {
      const user = userEvent.setup();
      render(<Filters initial={['Red', 'Blue', 'Large', 'Round']} />);
      await user.tab();
      await user.keyboard('{ArrowRight}');
      const steps: Array<[string, string, string]> = [
        ['Blue', '{Enter}', 'Dismiss Large'],
        ['Large', ' ', 'Dismiss Round'],
        ['Round', '{Delete}', 'Dismiss Red'],
        ['Red', '{Backspace}', 'Reset filters'],
      ];
      for (const [filter, key, next] of steps) {
        expect(dismissButton(filter)).toHaveFocus();
        await user.keyboard(key);
        await settle();
        expect(screen.queryByText(filter)).toBeNull();
        expect(document.activeElement).not.toBe(document.body);
        expect(screen.getByRole('button', { name: next })).toHaveFocus();
      }
    });

    it("moves from a Secondary to the next tag's Dismiss control, and from a Primary (Delete) to the next tag's first control", async () => {
      const user = userEvent.setup();
      render(<Filters renderTag={(filter) => <Interaction text={filter} />} />);
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{Enter}');
      await settle();
      expect(screen.queryByRole('button', { name: 'Red' })).toBeNull();
      expect(document.activeElement).not.toBe(document.body);
      expect(dismissButton('Blue')).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(primaryButton('Blue')).toHaveFocus();
      await user.keyboard('{Delete}');
      await settle();
      expect(screen.queryByRole('button', { name: 'Blue' })).toBeNull();
      expect(primaryButton('Large')).toHaveFocus();
    });

    it('moves across Tags and InteractionTags', async () => {
      const user = userEvent.setup();
      render(
        <Filters
          initial={['Red', 'Cherry', 'Blue', 'Plum']}
          renderTag={(filter) =>
            filter === 'Cherry' || filter === 'Plum' ? (
              <Interaction text={filter} />
            ) : (
              <Tag value={filter}>{filter}</Tag>
            )
          }
        />,
      );
      await user.tab();
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{Enter}');
      await settle();
      // From a Tag's Dismiss button to the InteractionTag's Dismiss control.
      expect(dismissButton('Cherry')).toHaveFocus();
      await user.keyboard('{Backspace}');
      await settle();
      expect(dismissButton('Blue')).toHaveFocus();
      // The last tag goes from its Primary: the previous tag's first control.
      await user.keyboard('{End}{ArrowLeft}');
      expect(primaryButton('Plum')).toHaveFocus();
      await user.keyboard('{Delete}');
      await settle();
      expect(screen.queryByRole('button', { name: 'Plum' })).toBeNull();
      expect(dismissButton('Blue')).toHaveFocus();
    });

    it("moves focus to the same tag's Primary when its focused Secondary unmounts", async () => {
      const user = userEvent.setup();
      function Locking() {
        const [locked, setLocked] = React.useState(false);
        return (
          <TagGroup aria-label="Fruit" onDismiss={() => setLocked(true)}>
            <InteractionTag value="cherry">
              <InteractionTag.Primary>Cherry</InteractionTag.Primary>
              {!locked && <InteractionTag.Secondary />}
            </InteractionTag>
            <Interaction text="Plum" />
          </TagGroup>
        );
      }
      render(<Locking />);
      await user.tab();
      await user.keyboard('{ArrowRight}{Enter}');
      await settle();
      expect(screen.queryByRole('button', { name: 'Dismiss Cherry' })).toBeNull();
      expect(primaryButton('Cherry')).toHaveFocus();
    });

    it('moves focus when a tag wrapped in an element of yours goes', async () => {
      const user = userEvent.setup();
      render(
        <Filters
          renderTag={(filter) => (
            <span className="inline-flex" data-testid={`wrapper-${filter}`}>
              <Tag value={filter}>{filter}</Tag>
            </span>
          )}
        />,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}{Delete}');
      await settle();
      expect(screen.queryByTestId('wrapper-Blue')).toBeNull();
      expect(dismissButton('Large')).toHaveFocus();
    });

    it('focuses fallbackFocusRef when the group unmounts with its tags', async () => {
      function Page({ shown }: { shown: boolean }) {
        const add = React.useRef<HTMLButtonElement>(null);
        return (
          <>
            {shown && (
              <TagGroup aria-label="Filters" dismissible fallbackFocusRef={add}>
                <Tag value="red">Red</Tag>
                <Tag value="blue">Blue</Tag>
              </TagGroup>
            )}
            <button type="button" ref={add}>
              Add filter
            </button>
          </>
        );
      }
      const { rerender } = render(<Page shown />);
      act(() => dismissButton('Blue').focus());
      rerender(<Page shown={false} />);
      await settle();
      expect(screen.getByRole('button', { name: 'Add filter' })).toHaveFocus();
    });

    it('does not warn TagGroup:focus-lost when the whole group unmounts without a fallback', async () => {
      const warnings = spyOnWarnings();
      const { rerender } = render(
        <TagGroup aria-label="Filters" dismissible>
          <Tag value="red">Red</Tag>
        </TagGroup>,
      );
      act(() => dismissButton('Red').focus());
      rerender(<p>No filters</p>);
      await settle();
      expect(document.activeElement).toBe(document.body);
      expect(warnings()).toEqual([]);
    });

    it('warns TagGroup:focus-lost without a fallback', async () => {
      const user = userEvent.setup();
      const warnings = spyOnWarnings();
      render(<Filters initial={['Red']} withFallback={false} />);
      await user.tab();
      await user.keyboard('{Enter}');
      await settle();
      expect(screen.queryByText('Red')).toBeNull();
      expect(document.activeElement).toBe(document.body);
      expect(warnings()).toEqual([FOCUS_LOST_WARNING]);
    });

    it('moves no focus while the app keeps the tag', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <TagGroup aria-label="Filters" dismissible onDismiss={onDismiss}>
          <Tag value="red">Red</Tag>
          <Tag value="blue">Blue</Tag>
        </TagGroup>,
      );
      await user.tab();
      await user.keyboard('{Delete}');
      await settle();
      expect(onDismiss).toHaveBeenCalledWith('red');
      expect(dismissButton('Red')).toHaveFocus();
    });

    it('moves after an asynchronous removal (timer) while focused', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      function Delayed() {
        const [filters, setFilters] = React.useState(['Red', 'Blue']);
        return (
          <TagGroup
            aria-label="Filters"
            dismissible
            onDismiss={(value) => {
              setTimeout(() => setFilters((current) => current.filter((f) => f !== value)), 500);
            }}
          >
            {filters.map((filter) => (
              <Tag key={filter} value={filter}>
                {filter}
              </Tag>
            ))}
          </TagGroup>
        );
      }
      render(<Delayed />);
      await user.tab();
      await user.keyboard('{Enter}');
      expect(dismissButton('Red')).toHaveFocus();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      await settle();
      expect(screen.queryByText('Red')).toBeNull();
      expect(dismissButton('Blue')).toHaveFocus();
    });

    it('moves no focus when focus was outside the removed tag', async () => {
      const user = userEvent.setup();
      function Outside() {
        const [filters, setFilters] = React.useState(['Red', 'Blue']);
        return (
          <>
            <TagGroup aria-label="Filters" dismissible>
              {filters.map((filter) => (
                <Tag key={filter} value={filter}>
                  {filter}
                </Tag>
              ))}
            </TagGroup>
            <button type="button" onClick={() => setFilters(['Blue'])}>
              Remove Red
            </button>
          </>
        );
      }
      render(<Outside />);
      await user.click(screen.getByRole('button', { name: 'Remove Red' }));
      await settle();
      expect(screen.queryByText('Red')).toBeNull();
      expect(screen.getByRole('button', { name: 'Remove Red' })).toHaveFocus();
    });

    it('keeps focus placed in onDismiss', async () => {
      const user = userEvent.setup();
      render(
        <Filters
          groupProps={{
            onDismiss: () => screen.getByRole('button', { name: 'Reset filters' }).focus(),
          }}
        />,
      );
      await user.tab();
      await user.keyboard('{Enter}');
      await settle();
      expect(screen.queryByText('Red')).toBeNull();
      expect(screen.getByRole('button', { name: 'Reset filters' })).toHaveFocus();
    });

    it('lands on the next surviving tag when two tags go in one commit', async () => {
      const user = userEvent.setup();
      function Pairs() {
        const [filters, setFilters] = React.useState(['Red', 'Blue', 'Large', 'Round']);
        return (
          <TagGroup
            aria-label="Filters"
            dismissible
            // Blue and Large go together.
            onDismiss={() => setFilters(['Red', 'Round'])}
          >
            {filters.map((filter) => (
              <Tag key={filter} value={filter}>
                {filter}
              </Tag>
            ))}
          </TagGroup>
        );
      }
      render(<Pairs />);
      await user.tab();
      await user.keyboard('{ArrowRight}{Enter}');
      await settle();
      expect(screen.queryByText('Blue')).toBeNull();
      expect(screen.queryByText('Large')).toBeNull();
      expect(dismissButton('Round')).toHaveFocus();
    });

    it("moves no focus on StrictMode's simulated unmount", async () => {
      /** A link focused once, at its first mount (before StrictMode's simulated unmount). */
      function FocusedLink({ children }: { children: React.ReactNode }) {
        const ref = React.useRef<HTMLAnchorElement>(null);
        const focused = React.useRef(false);
        React.useLayoutEffect(() => {
          if (focused.current) return;
          focused.current = true;
          ref.current?.focus();
        }, []);
        return (
          <a ref={ref} href="#react">
            {children}
          </a>
        );
      }
      render(
        <React.StrictMode>
          <TagGroup aria-label="Topics" dismissible>
            <Tag value="react">
              <FocusedLink>React</FocusedLink>
            </Tag>
            <Tag value="vue">Vue</Tag>
          </TagGroup>
        </React.StrictMode>,
      );
      await settle();
      expect(screen.getByRole('link', { name: 'React' })).toHaveFocus();
    });

    it('makes the moved-to control the Tab stop (Tab out, Shift+Tab back)', async () => {
      const user = userEvent.setup();
      render(<Filters />);
      await user.tab();
      await user.keyboard('{Enter}');
      await settle();
      expect(dismissButton('Blue')).toHaveFocus();
      expect(dismissButton('Blue')).toHaveAttribute('tabindex', '0');
      expect(dismissButton('Large')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(screen.getByRole('button', { name: 'Reset filters' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(dismissButton('Blue')).toHaveFocus();
    });

    it('moves focus to the link in the same tag, else the next tag, when a focused Dismiss button unmounts', async () => {
      const user = userEvent.setup();
      function Locking() {
        const [locked, setLocked] = React.useState<readonly string[]>([]);
        return (
          <TagGroup
            aria-label="Topics"
            dismissible
            // A dismissal locks the tag instead of removing it: its Dismiss button goes.
            onDismiss={(value) => setLocked((current) => [...current, value])}
          >
            <Tag value="react" dismissible={!locked.includes('react')}>
              <a href="#react">React</a>
            </Tag>
            <Tag value="red" dismissible={!locked.includes('red')}>
              Red
            </Tag>
            <Tag value="blue">Blue</Tag>
          </TagGroup>
        );
      }
      render(<Locking />);
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('React')).toHaveFocus();
      await user.keyboard('{Enter}');
      await settle();
      expect(screen.queryByRole('button', { name: 'Dismiss React' })).toBeNull();
      expect(screen.getByRole('link', { name: 'React' })).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{Enter}');
      await settle();
      expect(screen.queryByRole('button', { name: 'Dismiss Red' })).toBeNull();
      expect(dismissButton('Blue')).toHaveFocus();
    });
  });

  describe('held focus (D25)', () => {
    function Lockable({ disabled }: { disabled: boolean }) {
      return (
        <>
          <TagGroup aria-label="Filters" dismissible disabled={disabled} onDismiss={onDismissSpy}>
            <Tag value="red">Red</Tag>
            <Tag value="blue">Blue</Tag>
          </TagGroup>
          <button type="button">After</button>
        </>
      );
    }
    const onDismissSpy = vi.fn();

    it('a control that has focus when the group is disabled keeps it, aria-disabled, until it loses focus', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Lockable disabled={false} />);
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Blue')).toHaveFocus();

      rerender(<Lockable disabled />);
      const blue = dismissButton('Blue');
      expect(blue).toHaveFocus();
      expect(blue).toHaveAttribute('aria-disabled', 'true');
      expect(blue).toHaveAttribute('data-disabled-focusable', '');
      expect(blue).not.toBeDisabled();
      // The unfocused control is natively disabled at once.
      expect(dismissButton('Red')).toBeDisabled();

      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(blue).toBeDisabled();
      expect(blue).not.toHaveAttribute('aria-disabled');
    });

    it("an InteractionTag's focused button is held when the group is disabled, and keeps its arrow order", async () => {
      const user = userEvent.setup();
      const group = (disabled: boolean) => (
        <>
          <TagGroup aria-label="Fruit" disabled={disabled} onDismiss={onDismissSpy}>
            <Interaction text="Cherry" />
            <Interaction text="Plum" />
          </TagGroup>
          <button type="button">After</button>
        </>
      );
      onDismissSpy.mockClear();
      const { rerender } = render(group(false));
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Cherry')).toHaveFocus();
      await act(async () => {
        rerender(group(true));
      });
      const held = dismissButton('Cherry');
      expect(held).toHaveFocus();
      expect(held).toHaveAttribute('data-disabled-focusable', '');
      expect(primaryButton('Cherry')).toBeDisabled();
      await user.keyboard('{Delete}{Enter}');
      expect(onDismissSpy).not.toHaveBeenCalled();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(held).toBeDisabled();
    });

    it('Delete and Enter do nothing on a held control', async () => {
      const user = userEvent.setup();
      onDismissSpy.mockClear();
      const { rerender } = render(<Lockable disabled={false} />);
      await user.tab();
      rerender(<Lockable disabled />);
      expect(dismissButton('Red')).toHaveFocus();
      await user.keyboard('{Delete}{Enter} {Backspace}');
      expect(onDismissSpy).not.toHaveBeenCalled();
      expect(dismissButton('Red')).toHaveFocus();
    });
  });

  describe('host seams (D36, spec §4.1)', () => {
    function Hosted({ host, ...props }: FiltersProps & { host: TagGroupHostOptions }) {
      return (
        <TagGroupHostContext.Provider value={host}>
          <Filters {...props} />
        </TagGroupHostContext.Provider>
      );
    }

    it("orders removal focus next, then fallbackFocusRef, with removalFocus 'next'", async () => {
      const user = userEvent.setup();
      render(<Hosted host={{ removalFocus: 'next' }} />);
      await user.tab();
      await user.keyboard('{ArrowRight}{Enter}');
      await settle();
      expect(dismissButton('Large')).toHaveFocus();
      // The last tag goes: no previous tag, the fallback.
      await user.keyboard('{Enter}');
      await settle();
      expect(screen.queryByText('Large')).toBeNull();
      expect(dismissButton('Red')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset filters' })).toHaveFocus();
    });

    it('renders hidden on the tags whose value is in hiddenValues', () => {
      render(<Hosted host={{ hiddenValues: new Set(['Blue', 'Large']) }} />);
      expect(screen.getByText('Red').parentElement).not.toHaveAttribute('hidden');
      expect(screen.getByText('Blue', { selector: '*' }).parentElement).toHaveAttribute('hidden');
      expect(screen.getByText('Large', { selector: '*' }).parentElement).toHaveAttribute('hidden');
      expect(screen.getAllByRole('button', { name: /^Dismiss/ })).toHaveLength(1);
    });

    it('a disabled tag keeps full opacity with dimDisabled false and keeps its native disabled and GrayText', () => {
      render(
        <>
          <TagGroupHostContext.Provider value={{ dimDisabled: false }}>
            <TagGroup aria-label="Hosted" dismissible disabled>
              <Tag data-testid="hosted">Red</Tag>
            </TagGroup>
          </TagGroupHostContext.Provider>
          <TagGroup aria-label="Plain" dismissible disabled>
            <Tag data-testid="plain">Blue</Tag>
          </TagGroup>
        </>,
      );
      const hosted = screen.getByTestId('hosted');
      expect(hosted).not.toHaveClass('opacity-50');
      expect(hosted).not.toHaveClass('focus-visible:opacity-100');
      expect(hosted).not.toHaveClass('has-focus-visible:opacity-100');
      expect(hosted).toHaveClass(...forcedColors.disabled.split(' '));
      expect(dismissButton('Red')).toBeDisabled();
      expect(dismissButton('Red')).toHaveClass('disabled:cursor-not-allowed');
      expect(dismissButton('Red')).not.toHaveClass('disabled:opacity-50');
      // Without a host, a disabled tag dims itself.
      expect(screen.getByTestId('plain')).toHaveClass(
        'opacity-50',
        'focus-visible:opacity-100',
        'has-focus-visible:opacity-100',
      );
    });

    it("an InteractionTag's buttons keep full opacity with dimDisabled false", async () => {
      const { rerender } = render(
        <>
          <TagGroupHostContext.Provider value={{ dimDisabled: false }}>
            <TagGroup aria-label="Hosted" disabled>
              <Interaction text="Cherry" data-testid="hosted" />
            </TagGroup>
          </TagGroupHostContext.Provider>
          <TagGroup aria-label="Plain" disabled>
            <Interaction text="Plum" />
          </TagGroup>
        </>,
      );
      const opacity = ['disabled:opacity-50', 'aria-disabled:opacity-50'];
      for (const button of [primaryButton('Cherry'), dismissButton('Cherry')]) {
        expect(button).toBeDisabled();
        for (const name of opacity) expect(button).not.toHaveClass(name);
        expect(button).not.toHaveClass('aria-disabled:focus-visible:opacity-100');
        expect(button).toHaveClass(
          'disabled:cursor-not-allowed',
          'aria-disabled:cursor-not-allowed',
          ...forcedColors.disabled.split(' '),
        );
      }
      expect(screen.getByTestId('hosted')).not.toHaveClass('opacity-50');
      // Without a host, each button dims itself.
      for (const button of [primaryButton('Plum'), dismissButton('Plum')]) {
        expect(button).toHaveClass(...opacity);
      }

      // A held button (disabled while focused) keeps its full opacity too.
      const hosted = (disabled: boolean) => (
        <TagGroupHostContext.Provider value={{ dimDisabled: false }}>
          <TagGroup aria-label="Hosted" disabled={disabled}>
            <Interaction text="Cherry" />
          </TagGroup>
        </TagGroupHostContext.Provider>
      );
      rerender(hosted(false));
      act(() => dismissButton('Cherry').focus());
      await act(async () => {
        rerender(hosted(true));
      });
      expect(dismissButton('Cherry')).toHaveFocus();
      expect(dismissButton('Cherry')).toHaveAttribute('aria-disabled', 'true');
      expect(dismissButton('Cherry')).not.toHaveClass('aria-disabled:opacity-50');
    });

    it('renders hidden on the InteractionTags whose value is in hiddenValues', () => {
      render(
        <Hosted
          host={{ hiddenValues: new Set(['Blue']) }}
          renderTag={(filter) => <Interaction text={filter} data-testid={filter} />}
        />,
      );
      expect(screen.getByTestId('Blue')).toHaveAttribute('hidden');
      expect(screen.getByTestId('Red')).not.toHaveAttribute('hidden');
      expect(screen.queryByRole('button', { name: 'Blue' })).toBeNull();
    });

    it('does not pass the host options to a nested TagGroup', () => {
      render(
        <TagGroupHostContext.Provider
          value={{ hiddenValues: new Set(['blue']), dimDisabled: false }}
        >
          <TagGroup aria-label="Outer" dismissible>
            <Tag value="blue" data-testid="outer">
              Blue
            </Tag>
            <TagGroup aria-label="Inner" dismissible disabled>
              <Tag value="blue" data-testid="inner">
                Blue
              </Tag>
            </TagGroup>
          </TagGroup>
        </TagGroupHostContext.Provider>,
      );
      expect(screen.getByTestId('outer')).toHaveAttribute('hidden');
      const inner = screen.getByTestId('inner');
      expect(inner).not.toHaveAttribute('hidden');
      expect(inner).toHaveClass('opacity-50');
    });

    it("names a Dismiss button by a host's dismissName with aria-label alone and adds its class", () => {
      render(
        <TagHostContext.Provider
          value={{ dismissName: 'Remove Cherry', dismissButtonClassName: 'wave-test-remove' }}
        >
          <Tag dismissible data-testid="cherry">
            Cherry
          </Tag>
        </TagHostContext.Provider>,
      );
      const button = screen.getByRole('button', { name: 'Remove Cherry' });
      expect(button).toHaveAttribute('aria-label', 'Remove Cherry');
      expect(button).not.toHaveAttribute('aria-labelledby');
      expect(button).toHaveClass('wave-test-remove');
      expect(screen.getByTestId('cherry').textContent).toBe('Cherry');
    });

    it('renders the data-wave-tag-group, data-wave-tag-item and data-wave-tag-dismiss markers', () => {
      render(
        <TagGroup aria-label="Filters" data-testid="group">
          <Tag dismissible data-testid="dismissible">
            Red
          </Tag>
          <Tag data-testid="static">Blue</Tag>
          <Interaction text="Cherry" data-testid="interaction" />
        </TagGroup>,
      );
      expect(screen.getByTestId('interaction')).toHaveAttribute('data-wave-tag-item', '');
      expect(dismissButton('Cherry')).toHaveAttribute('data-wave-tag-dismiss', '');
      expect(primaryButton('Cherry')).not.toHaveAttribute('data-wave-tag-dismiss');
      expect(screen.getByTestId('group')).toHaveAttribute('data-wave-tag-group', '');
      expect(screen.getByTestId('dismissible')).toHaveAttribute('data-wave-tag-item', '');
      expect(screen.getByTestId('static')).toHaveAttribute('data-wave-tag-item', '');
      expect(dismissButton('Red')).toHaveAttribute('data-wave-tag-dismiss', '');
    });
  });

  describe('selection (D38, D39)', () => {
    it('selects InteractionTags from defaultValue (uncontrolled)', async () => {
      const user = userEvent.setup();
      render(<Chips defaultValue={['plum']} />);
      expect(pressedStates()).toEqual(['false', 'true', 'false']);
      await user.click(primaryButton('Cherry'));
      expect(pressedStates()).toEqual(['true', 'true', 'false']);
      await user.click(primaryButton('Plum'));
      expect(pressedStates()).toEqual(['true', 'false', 'false']);
    });

    it('keeps a controlled value when the parent ignores onValueChange', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Chips value={['plum']} onValueChange={onValueChange} />);
      // Each click is its own task, so each starts from the rendered value again.
      await user.click(primaryButton('Cherry'));
      await user.click(primaryButton('Cherry'));
      await user.click(primaryButton('Plum'));
      expect(onValueChange.mock.calls).toEqual([[['plum', 'cherry']], [['plum', 'cherry']], [[]]]);
      expect(pressedStates()).toEqual(['false', 'true', 'false']);
    });

    it('follows a controlled value', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [value, setValue] = React.useState<readonly string[]>(['fig']);
        return <Chips value={value} onValueChange={setValue} />;
      }
      render(<Controlled />);
      expect(pressedStates()).toEqual(['false', 'false', 'true']);
      await user.click(primaryButton('Cherry'));
      expect(pressedStates()).toEqual(['true', 'false', 'true']);
    });

    it('reports values in selection order, once per toggle in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Chips onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      for (const fruit of ['Fig', 'Cherry', 'Fig', 'Plum']) {
        await user.click(primaryButton(fruit));
      }
      expect(onValueChange.mock.calls).toEqual([
        [['fig']],
        [['fig', 'cherry']],
        [['cherry']],
        [['cherry', 'plum']],
      ]);
    });

    it('emits a new array that the group does not keep', async () => {
      const user = userEvent.setup();
      const emitted: string[][] = [];
      render(
        <Chips
          onValueChange={(value) => {
            emitted.push(value);
            // The callback's array is the app's: changing it does not change the group.
            value.push('kiwi');
          }}
        />,
      );
      await user.click(primaryButton('Cherry'));
      await user.click(primaryButton('Plum'));
      expect(emitted).toEqual([
        ['cherry', 'kiwi'],
        ['cherry', 'plum', 'kiwi'],
      ]);
    });

    it('keeps selected values that have no tag', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Chips defaultValue={['kiwi']} onValueChange={onValueChange} />);
      expect(pressedStates()).toEqual(['false', 'false', 'false']);
      await user.click(primaryButton('Cherry'));
      await user.click(primaryButton('Cherry'));
      expect(onValueChange.mock.calls).toEqual([[['kiwi', 'cherry']], [['kiwi']]]);
    });

    it('renders aria-pressed true and false on Primaries and data-selected on the root, Primary and Secondary', () => {
      render(
        <TagGroup aria-label="Fruit" defaultValue={['cherry']}>
          <Interaction text="Cherry" value="cherry" data-testid="cherry" />
          <Interaction text="Plum" value="plum" data-testid="plum" />
        </TagGroup>,
      );
      expect(primaryButton('Cherry')).toHaveAttribute('aria-pressed', 'true');
      expect(primaryButton('Plum')).toHaveAttribute('aria-pressed', 'false');
      for (const element of [
        screen.getByTestId('cherry'),
        primaryButton('Cherry'),
        dismissButton('Cherry'),
      ]) {
        expect(element).toHaveAttribute('data-selected', '');
      }
      for (const element of [
        screen.getByTestId('plum'),
        primaryButton('Plum'),
        dismissButton('Plum'),
      ]) {
        expect(element).not.toHaveAttribute('data-selected');
      }
      // A Secondary is never a toggle.
      expect(dismissButton('Cherry')).not.toHaveAttribute('aria-pressed');
      // The selected look, as InteractionTag's own `selected` draws it.
      expect(primaryButton('Cherry')).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(dismissButton('Cherry')).toHaveClass('border-s-primary-foreground');
      expect(primaryButton('Plum')).toHaveClass('bg-muted');
      expect(primaryButton('Plum')).not.toHaveClass('bg-primary');
    });

    it('toggles on Space and Enter, never on an arrow key', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Chips onValueChange={onValueChange} />);
      await user.tab();
      expect(primaryButton('Cherry')).toHaveFocus();
      await user.keyboard('{ArrowRight}{ArrowLeft}{Home}{End}');
      expect(primaryButton('Fig')).toHaveFocus();
      expect(onValueChange).not.toHaveBeenCalled();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.keyboard('{Home} ');
      expect(onValueChange.mock.calls).toEqual([[['fig']], [[]], [['cherry']]]);
    });

    it("runs the Primary's onClick first; its preventDefault() cancels the toggle", async () => {
      const user = userEvent.setup();
      const calls: unknown[] = [];
      render(
        <TagGroup aria-label="Fruit" onValueChange={(value) => calls.push(['change', value])}>
          <InteractionTag value="cherry">
            <InteractionTag.Primary onClick={(event) => event.preventDefault()}>
              Cherry
            </InteractionTag.Primary>
          </InteractionTag>
          <InteractionTag value="plum">
            <InteractionTag.Primary onClick={() => calls.push('click')}>
              Plum
            </InteractionTag.Primary>
          </InteractionTag>
        </TagGroup>,
      );
      await user.click(primaryButton('Cherry'));
      expect(calls).toEqual([]);
      expect(primaryButton('Cherry')).toHaveAttribute('aria-pressed', 'false');
      await user.click(primaryButton('Plum'));
      expect(calls).toEqual(['click', ['change', ['plum']]]);
    });

    it('selects from [] with only onValueChange', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Chips onValueChange={onValueChange} />);
      expect(pressedStates()).toEqual(['false', 'false', 'false']);
      await user.click(primaryButton('Plum'));
      expect(onValueChange.mock.calls).toEqual([[['plum']]]);
      expect(pressedStates()).toEqual(['false', 'true', 'false']);
    });

    it('a group without value, defaultValue or onValueChange does not select', async () => {
      const user = userEvent.setup();
      render(<Chips />);
      for (const text of FRUITS) expect(primaryButton(text)).not.toHaveAttribute('aria-pressed');
      await user.click(primaryButton('Cherry'));
      expect(primaryButton('Cherry')).not.toHaveAttribute('aria-pressed');
    });

    it('never selects a plain Tag', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <TagGroup
          aria-label="Filters"
          dismissible
          defaultValue={['red']}
          onValueChange={onValueChange}
        >
          <Tag value="red" data-testid="red">
            Red
          </Tag>
          <Tag value="blue" as="button" dismissible={false} data-testid="blue">
            Blue
          </Tag>
          <Interaction text="Cherry" value="cherry" />
        </TagGroup>,
      );
      for (const testId of ['red', 'blue']) {
        const tag = screen.getByTestId(testId);
        expect(tag).not.toHaveAttribute('data-selected');
        expect(tag).not.toHaveAttribute('aria-pressed');
        expect(tag.querySelector('[aria-pressed], [data-selected]')).toBeNull();
      }
      await user.click(screen.getByText('Red'));
      await user.click(screen.getByTestId('blue'));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(primaryButton('Cherry')).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onDismiss and then onValueChange without the value when a selected tag is dismissed', async () => {
      const user = userEvent.setup();
      const calls: unknown[] = [];
      render(
        <React.StrictMode>
          <Chips
            withSecondary
            defaultValue={['cherry', 'plum']}
            onDismiss={(value) => calls.push(['dismiss', value])}
            onValueChange={(value) => calls.push(['change', value])}
          />
        </React.StrictMode>,
      );
      await user.click(dismissButton('Cherry'));
      expect(calls).toEqual([
        ['dismiss', 'cherry'],
        ['change', ['plum']],
      ]);
      expect(pressedStates()).toEqual(['false', 'true', 'false']);

      // Delete on a selected Primary dismisses it through its Secondary: deselected too.
      fireEvent.keyDown(primaryButton('Plum'), { key: 'Delete' });
      // A tag that is not selected is only dismissed.
      await user.click(dismissButton('Fig'));
      expect(calls).toEqual([
        ['dismiss', 'cherry'],
        ['change', ['plum']],
        ['dismiss', 'plum'],
        ['change', []],
        ['dismiss', 'fig'],
      ]);
    });

    it('deselects a dismissed tag without onDismiss', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Chips withSecondary defaultValue={['fig']} onValueChange={onValueChange} />);
      await user.click(dismissButton('Fig'));
      expect(onValueChange.mock.calls).toEqual([[[]]]);
    });

    it('a Secondary onClick that calls preventDefault() cancels the dismissal and the deselection', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onValueChange = vi.fn();
      render(
        <TagGroup
          aria-label="Fruit"
          defaultValue={['cherry']}
          onDismiss={onDismiss}
          onValueChange={onValueChange}
        >
          <Interaction
            text="Cherry"
            value="cherry"
            onSecondaryClick={(event) => event.preventDefault()}
          />
        </TagGroup>,
      );
      await user.click(dismissButton('Cherry'));
      fireEvent.keyDown(primaryButton('Cherry'), { key: 'Backspace' });
      expect(onDismiss).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(primaryButton('Cherry')).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles nothing while disabled, and keeps reporting the selection', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Chips withSecondary disabled defaultValue={['plum']} onValueChange={onValueChange} />,
      );
      await user.click(primaryButton('Cherry'));
      fireEvent.click(primaryButton('Cherry'));
      fireEvent.click(dismissButton('Plum'));
      fireEvent.keyDown(primaryButton('Plum'), { key: 'Delete' });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(pressedStates()).toEqual(['false', 'true', 'false']);
      // Disabled wins over the selected look.
      expect(primaryButton('Plum')).not.toHaveClass('bg-primary');
    });

    it('a held Primary does not toggle', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = render(<Chips onValueChange={onValueChange} />);
      await user.tab();
      rerender(<Chips onValueChange={onValueChange} disabled />);
      expect(primaryButton('Cherry')).toHaveFocus();
      expect(primaryButton('Cherry')).toHaveAttribute('data-disabled-focusable', '');
      await user.keyboard('{Enter} ');
      await user.click(primaryButton('Cherry'));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("ignores an InteractionTag's selected inside a selecting group and warns InteractionTag:selected-in-group", () => {
      const warnings = spyOnWarnings();
      const { unmount } = render(
        <TagGroup aria-label="Fruit" defaultValue={['plum']}>
          <Interaction text="Cherry" value="cherry" selected />
          <Interaction text="Plum" value="plum" selected={false} />
        </TagGroup>,
      );
      expect(pressedStates(['Cherry', 'Plum'])).toEqual(['false', 'true']);
      expect(warnings()).toEqual([SELECTED_IN_GROUP_WARNING]);
      unmount();
      // In a group that does not select, `selected` decides, unreported.
      render(
        <TagGroup aria-label="Fruit">
          <Interaction text="Cherry" value="cherry" selected />
          <Interaction text="Plum" value="plum" />
        </TagGroup>,
      );
      expect(primaryButton('Cherry')).toHaveAttribute('aria-pressed', 'true');
      expect(primaryButton('Plum')).not.toHaveAttribute('aria-pressed');
      expect(warnings()).toEqual([SELECTED_IN_GROUP_WARNING]);
    });

    it('selects InteractionTags of its own, not those of a nested group', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <TagGroup aria-label="Fruit" onValueChange={onValueChange}>
          <Interaction text="Cherry" value="cherry" withSecondary={false} />
          <TagGroup aria-label="More fruit">
            <Interaction text="Plum" value="plum" withSecondary={false} />
          </TagGroup>
        </TagGroup>,
      );
      expect(primaryButton('Plum')).not.toHaveAttribute('aria-pressed');
      await user.click(primaryButton('Plum'));
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('forms (D40)', () => {
    it('submits one entry per selected value under name, with form', async () => {
      const user = userEvent.setup();
      let data: FormData | null = null;
      render(
        <>
          <form
            aria-label="Order"
            onSubmit={(event) => {
              event.preventDefault();
              data = new FormData(event.currentTarget);
            }}
          >
            <Chips name="fruit" defaultValue={['plum']} />
            <button type="submit">Send</button>
          </form>
          <form id="elsewhere" aria-label="Elsewhere" />
          <Chips
            aria-label="Vegetables"
            fruits={['Leek']}
            name="veg"
            form="elsewhere"
            value={['leek']}
          />
        </>,
      );
      await user.click(primaryButton('Fig'));
      await user.click(primaryButton('Cherry'));
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.getAll('fruit')).toEqual(['plum', 'fig', 'cherry']);
      expect(data!.getAll('veg')).toEqual([]);
      expect(new FormData(formNamed('Elsewhere')).getAll('veg')).toEqual(['leek']);
      // The inputs sit inside the group's root.
      const group = screen.getByRole('toolbar', { name: 'Fruit' });
      const inputs = document.querySelectorAll('input[name="fruit"]');
      expect(inputs).toHaveLength(3);
      for (const input of inputs) expect(input.parentElement).toBe(group);
      expect(group).toHaveClass('relative');
    });

    it("blocks submission while required and empty, and focuses the group's Tab stop", async () => {
      const user = userEvent.setup();
      render(
        <>
          <form aria-label="Order">
            <Chips name="fruit" required defaultValue={[]} />
          </form>
          <button type="button">After</button>
        </>,
      );
      const form = formNamed('Order');
      // The Tab stop is the last focused control: Plum.
      await user.tab();
      await user.keyboard('{ArrowRight}');
      await user.click(screen.getByRole('button', { name: 'After' }));
      let valid = true;
      act(() => {
        valid = form.reportValidity();
      });
      expect(valid).toBe(false);
      expect(primaryButton('Plum')).toHaveFocus();
      await user.keyboard(' ');
      expect(checkValidity(form)).toBe(true);
      expect(new FormData(form).getAll('fruit')).toEqual(['plum']);
    });

    it('blocks submission while required and empty without a name, and submits nothing', () => {
      render(
        <form aria-label="Order">
          <Chips required defaultValue={[]} />
        </form>,
      );
      const form = formNamed('Order');
      expect(checkValidity(form)).toBe(false);
      expect(primaryButton('Cherry')).toHaveFocus();
      expect([...new FormData(form).keys()]).toEqual([]);
    });

    it('restores defaultValue on form reset and reports nothing when unchanged', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const make = () => (
        <form aria-label="Order">
          <Chips name="fruit" defaultValue={['plum']} onValueChange={onValueChange} />
          <button type="reset">Reset</button>
        </form>
      );
      const { rerender } = render(make());
      // A new inline defaultValue array with the same values.
      rerender(make());
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(primaryButton('Cherry'));
      await user.click(primaryButton('Plum'));
      expect(new FormData(formNamed('Order')).getAll('fruit')).toEqual(['cherry']);
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange.mock.calls).toEqual([[['plum', 'cherry']], [['cherry']], [['plum']]]);
      expect(pressedStates()).toEqual(['false', 'true', 'false']);
      expect(new FormData(formNamed('Order')).getAll('fruit')).toEqual(['plum']);
    });

    it('resets with a form elsewhere through the form prop, also without name', async () => {
      const user = userEvent.setup();
      render(
        <>
          <form id="order" aria-label="Order" />
          <Chips form="order" defaultValue={['fig']} />
        </>,
      );
      await user.click(primaryButton('Fig'));
      expect(pressedStates()).toEqual(['false', 'false', 'false']);
      act(() => formNamed('Order').reset());
      expect(pressedStates()).toEqual(['false', 'false', 'true']);
    });

    it('submits nothing while disabled', () => {
      render(
        <form aria-label="Order">
          <Chips name="fruit" defaultValue={['plum']} disabled />
          <Chips
            aria-label="Vegetables"
            fruits={['Leek']}
            name="veg"
            required
            defaultValue={[]}
            disabled
          />
        </form>,
      );
      const form = formNamed('Order');
      expect(new FormData(form).getAll('fruit')).toEqual([]);
      // A disabled required group does not block the form either.
      expect(checkValidity(form)).toBe(true);
    });

    it('renders no aria-required', () => {
      render(
        <>
          <Chips name="fruit" required defaultValue={[]} />
          <Chips aria-label="Topics" role="list" name="topic" required defaultValue={['plum']} />
        </>,
      );
      expect(screen.getByRole('toolbar', { name: 'Fruit' })).not.toHaveAttribute('aria-required');
      expect(screen.getByRole('list', { name: 'Topics' })).not.toHaveAttribute('aria-required');
      expect(document.querySelectorAll('input[required]')).toHaveLength(2);
      expect(document.querySelector('[aria-required]')).toBeNull();
      expect(document.querySelector('div[required]')).toBeNull();
    });

    it('renders no hidden input without a selection', () => {
      render(
        <form aria-label="Order">
          <TagGroup aria-label="Filters" dismissible name="filters" required>
            <Tag value="red">Red</Tag>
          </TagGroup>
        </form>,
      );
      expect(document.querySelector('input')).toBeNull();
      expect(checkValidity(formNamed('Order'))).toBe(true);
    });
  });

  describe('values (D37)', () => {
    it('warns once per duplicated value', async () => {
      const warnings = spyOnWarnings();
      const group = (extra?: React.ReactNode) => (
        <TagGroup aria-label="Filters" dismissible onDismiss={() => {}}>
          <Tag value="red">Red</Tag>
          <Tag value="red">Crimson</Tag>
          <Tag value="blue">Blue</Tag>
          <Tag value="blue">Navy</Tag>
          {extra}
        </TagGroup>
      );
      const { rerender } = render(group());
      // The roving store sees the new tag in a microtask (its MutationObserver).
      await act(async () => {
        rerender(group(<Tag value="red">Scarlet</Tag>));
      });
      expect(warnings()).toEqual([duplicateWarning('red'), duplicateWarning('blue')]);
    });

    it('warns duplicated values once the group starts reporting them', () => {
      const warnings = spyOnWarnings();
      const group = (onDismiss?: (value: string) => void) => (
        <TagGroup aria-label="Filters" dismissible onDismiss={onDismiss}>
          <Tag value="red">Red</Tag>
          <Tag value="red">Crimson</Tag>
        </TagGroup>
      );
      const { rerender } = render(group());
      expect(warnings()).toEqual([]);
      rerender(group(() => {}));
      expect(warnings()).toEqual([duplicateWarning('red')]);
    });

    it('warns once for a tag without value in a group with onDismiss', () => {
      const warnings = spyOnWarnings();
      const onDismiss = vi.fn();
      render(
        <TagGroup aria-label="Filters" dismissible onDismiss={onDismiss}>
          <Tag>Red</Tag>
          <Tag>Blue</Tag>
          <Tag value="large">Large</Tag>
        </TagGroup>,
      );
      expect(warnings()).toEqual([MISSING_VALUE_WARNING]);
      // It is reported by a generated id.
      fireEvent.click(dismissButton('Red'));
      expect(onDismiss).toHaveBeenCalledWith(expect.stringMatching(/^tag-/));
    });

    it('warns once for an InteractionTag without value in a group with onDismiss, and reports a generated id', () => {
      const warnings = spyOnWarnings();
      const onDismiss = vi.fn();
      render(
        <TagGroup aria-label="Fruit" onDismiss={onDismiss}>
          <InteractionTag>
            <InteractionTag.Primary>Cherry</InteractionTag.Primary>
            <InteractionTag.Secondary />
          </InteractionTag>
          <InteractionTag>
            <InteractionTag.Primary>Fig</InteractionTag.Primary>
          </InteractionTag>
        </TagGroup>,
      );
      expect(warnings()).toEqual([MISSING_VALUE_WARNING]);
      fireEvent.click(dismissButton('Cherry'));
      expect(onDismiss).toHaveBeenCalledWith(expect.stringMatching(/^tag-/));
    });

    it('warns a value shared by a Tag and an InteractionTag', () => {
      const warnings = spyOnWarnings();
      render(
        <TagGroup aria-label="Fruit" dismissible onDismiss={() => {}}>
          <Tag value="cherry">Cherry</Tag>
          <Interaction text="Cherry tomato" value="cherry" />
        </TagGroup>,
      );
      expect(warnings()).toEqual([duplicateWarning('cherry')]);
    });

    it('warns once for an InteractionTag without value in a selecting group, and toggles its generated id', async () => {
      const user = userEvent.setup();
      const warnings = spyOnWarnings();
      const onValueChange = vi.fn();
      render(
        <TagGroup aria-label="Fruit" onValueChange={onValueChange}>
          <InteractionTag>
            <InteractionTag.Primary>Cherry</InteractionTag.Primary>
          </InteractionTag>
          <InteractionTag>
            <InteractionTag.Primary>Plum</InteractionTag.Primary>
          </InteractionTag>
        </TagGroup>,
      );
      expect(warnings()).toEqual([MISSING_VALUE_WARNING]);
      await user.click(primaryButton('Cherry'));
      expect(onValueChange.mock.calls).toEqual([[[expect.stringMatching(/^tag-/)]]]);
      expect(primaryButton('Cherry')).toHaveAttribute('aria-pressed', 'true');
      expect(primaryButton('Plum')).toHaveAttribute('aria-pressed', 'false');
    });

    it('warns duplicated values in a selecting group without onDismiss', () => {
      const warnings = spyOnWarnings();
      render(
        <TagGroup aria-label="Fruit" defaultValue={[]}>
          <Interaction text="Cherry" value="cherry" />
          <Interaction text="Morello" value="cherry" />
        </TagGroup>,
      );
      expect(warnings()).toEqual([duplicateWarning('cherry')]);
    });

    it('does not warn for a Tag without value in a selecting group without onDismiss', () => {
      const warnings = spyOnWarnings();
      render(
        <TagGroup aria-label="Fruit" dismissible onValueChange={() => {}}>
          <Tag>Red</Tag>
          <Interaction text="Cherry" value="cherry" />
        </TagGroup>,
      );
      expect(warnings()).toEqual([]);
    });

    it('does not warn in a display-only group', () => {
      const warnings = spyOnWarnings();
      render(
        <>
          <TagGroup aria-label="Filters" dismissible>
            <Tag value="red">Red</Tag>
            <Tag value="red">Crimson</Tag>
            <Tag>Blue</Tag>
          </TagGroup>
          <TagGroup role="list" aria-label="Topics" onDismiss={() => {}}>
            <Tag>React</Tag>
          </TagGroup>
        </>,
      );
      expect(warnings()).toEqual([]);
    });
  });

  describe("roles' warnings (D30)", () => {
    it('warns TagGroup:listbox-role for role listbox and keeps the toolbar keyboard', async () => {
      const user = userEvent.setup();
      const warnings = spyOnWarnings();
      render(
        <TagGroup role="listbox" aria-label="Filters" dismissible>
          <Tag>Red</Tag>
          <Tag>Blue</Tag>
        </TagGroup>,
      );
      expect(warnings()).toEqual([LISTBOX_ROLE_WARNING]);
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(dismissButton('Blue')).toHaveFocus();
    });

    it('warns TagGroup:static-toolbar for a toolbar of static tags, not for a list or a disabled group', () => {
      const warnings = spyOnWarnings();
      const { unmount } = render(
        <>
          <TagGroup role="list" aria-label="Topics">
            <Tag>React</Tag>
          </TagGroup>
          <TagGroup aria-label="Disabled topics" disabled>
            <Tag as="a" href="#vue">
              Vue
            </Tag>
          </TagGroup>
          <TagGroup aria-label="Empty" />
          <TagGroup aria-label="Actions">
            <Interaction text="Cherry" withSecondary={false} />
          </TagGroup>
        </>,
      );
      expect(warnings()).toEqual([]);
      unmount();
      render(
        <TagGroup aria-label="Topics">
          <Tag>React</Tag>
          <Tag>Vue</Tag>
        </TagGroup>,
      );
      expect(warnings()).toEqual([STATIC_TOOLBAR_WARNING]);
    });

    it("counts a required group's hidden form input as no control", () => {
      const warnings = spyOnWarnings();
      render(
        <TagGroup aria-label="Topics" required onValueChange={() => {}}>
          <Tag>React</Tag>
        </TagGroup>,
      );
      expect(document.querySelector('input[data-wave-hidden-input]')).not.toBeNull();
      expect(warnings()).toEqual([STATIC_TOOLBAR_WARNING]);
    });

    it("warns TagGroup:list-item for a link-root tag in a list group, not for one wrapped in role listitem or a link in a tag's content", () => {
      const warnings = spyOnWarnings();
      const { unmount } = render(
        <TagGroup role="list" aria-label="Topics">
          <span role="listitem">
            <Tag as="a" href="#react">
              React
            </Tag>
          </span>
          <Tag>
            <a href="#vue">Vue</a>
          </Tag>
        </TagGroup>,
      );
      expect(warnings()).toEqual([]);
      unmount();
      render(
        <TagGroup role="list" aria-label="Topics">
          <Tag as="a" href="#react">
            React
          </Tag>
        </TagGroup>,
      );
      expect(warnings()).toEqual([LIST_ITEM_WARNING]);
    });
  });

  it('renders a dismissible group on the server and hydrates it', async () => {
    const errors = vi.spyOn(console, 'error');
    const ui = <Filters initial={['Red', 'Blue']} />;
    const html = renderToString(ui);
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('data-wave-tag-group=""');
    expect(html).toContain('data-wave-tag-dismiss=""');
    // The roving Tab stop is stamped after mount.
    expect(html).not.toContain('tabindex');
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, ui);
      });
      expect(errors).not.toHaveBeenCalled();
      const red = within(container).getByRole('button', { name: 'Dismiss Red' });
      expect(red).toHaveAttribute('tabindex', '0');
      expect(within(container).getByRole('button', { name: 'Dismiss Blue' })).toHaveAttribute(
        'tabindex',
        '-1',
      );
      act(() => red.focus());
      fireEvent.keyDown(red, { key: 'Delete' });
      await settle();
      expect(within(container).getByRole('button', { name: 'Dismiss Blue' })).toHaveFocus();
      act(() => root?.unmount());
    } finally {
      container.remove();
    }
  });

  it('renders a selecting, dismissible group on the server and hydrates it', async () => {
    const errors = vi.spyOn(console, 'error');
    const ui = (
      <form aria-label="Order">
        <Chips withSecondary name="fruit" defaultValue={['plum', 'kiwi']} onDismiss={() => {}} />
      </form>
    );
    const html = renderToString(ui);
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('tabindex');
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      // Named and submitted from the server HTML.
      expect(within(container).getByRole('button', { name: 'Dismiss Plum' })).toBeInTheDocument();
      const inputs = container.querySelectorAll<HTMLInputElement>('input[name="fruit"]');
      expect([...inputs].map((input) => [input.type, input.value])).toEqual([
        ['hidden', 'plum'],
        ['hidden', 'kiwi'],
      ]);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, ui);
      });
      expect(errors).not.toHaveBeenCalled();
      const plum = within(container).getByRole('button', { name: 'Plum' });
      expect(plum).toHaveAttribute('aria-pressed', 'true');
      const cherry = within(container).getByRole('button', { name: 'Cherry' });
      expect(cherry).toHaveAttribute('tabindex', '0');
      fireEvent.click(cherry);
      expect(cherry).toHaveAttribute('aria-pressed', 'true');
      const form = within(container).getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(new FormData(form).getAll('fruit')).toEqual(['plum', 'kiwi', 'cherry']);
      act(() => root?.unmount());
    } finally {
      container.remove();
    }
  });

  it('types its props', () => {
    expectTypeOf<TagGroupProps['value']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TagGroupProps['defaultValue']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TagGroupProps['onValueChange']>().toEqualTypeOf<
      ((value: string[]) => void) | undefined
    >();
    expectTypeOf<Parameters<NonNullable<TagGroupProps['onValueChange']>>[0]>().toEqualTypeOf<
      string[]
    >();
    expectTypeOf<TagGroupProps['name']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TagGroupProps['form']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TagGroupProps['required']>().toEqualTypeOf<boolean | undefined>();
    // A readonly array is accepted.
    const frozen: readonly string[] = Object.freeze(['plum']);
    expect(<TagGroup value={frozen} defaultValue={frozen} />).toBeTruthy();
    expectTypeOf<TagGroupProps['size']>().toEqualTypeOf<TagSize | undefined>();
    expectTypeOf<TagGroupProps['appearance']>().toEqualTypeOf<TagAppearance | undefined>();
    expectTypeOf<TagGroupProps['shape']>().toEqualTypeOf<TagShape | undefined>();
    expectTypeOf<TagGroupProps['onDismiss']>().toEqualTypeOf<
      ((value: string) => void) | undefined
    >();
    expectTypeOf<TagGroupProps['fallbackFocusRef']>().toEqualTypeOf<
      React.RefObject<HTMLElement | null> | undefined
    >();
    expectTypeOf<React.ComponentProps<typeof TagGroup>>().toEqualTypeOf<TagGroupProps>();
    const elements = [
      // @ts-expect-error a tag group has no large size
      <TagGroup key="1" size="large" />,
      // @ts-expect-error primary is a Button appearance, not a tag one
      <TagGroup key="2" appearance="primary" />,
      // @ts-expect-error a tag group has no square shape
      <TagGroup key="3" shape="square" />,
      // @ts-expect-error defaultValue is not a string attribute here
      <TagGroup key="4" defaultValue="x" />,
      // @ts-expect-error the selection is an array of values
      <TagGroup key="5" value="x" />,
    ];
    expect(elements).toHaveLength(5);
  });
});
