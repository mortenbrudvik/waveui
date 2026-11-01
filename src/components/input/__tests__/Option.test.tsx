import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  ListboxProvider,
  ListboxSurface,
  Option,
  OptionGroup,
  useListboxPopup,
  type ListboxSurfaceListProps,
  type ListboxSurfaceProps,
  type OptionGroupProps,
  type OptionProps,
  type UseListboxPopupResult,
} from '../Option';
import { Combobox, Option as ComboboxReexport, OptionGroup as GroupReexport } from '../Combobox';
import { Dropdown } from '../Dropdown';
import { collectOptionLabels, useListbox } from '../../../hooks/useListbox';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';
import { useMergedRefs } from '../../../hooks/useMergedRefs';
import {
  listboxSurfaceClassNames,
  optionClassNames,
  optionGroupClassNames,
} from '../../../lib/classNames';
import type { Slot } from '../../../lib/slot';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  mockRect,
  openingTags,
  testDisplayName,
  expectThrows,
} from '../../../test-utils';
import { Listbox } from '../Listbox';

function combobox() {
  return screen.getByRole('combobox', { name: 'Fruit' });
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

describe('Option / OptionGroup (input-pickers#1, #6, #20)', () => {
  testDisplayName(Option, 'Option');
  testDisplayName(OptionGroup, 'OptionGroup');

  it('are re-exported unchanged from Combobox.tsx', () => {
    expect(ComboboxReexport).toBe(Option);
    expect(GroupReexport).toBe(OptionGroup);
  });

  it('are marked for collectOptionLabels (label → textValue → text → value)', () => {
    const labels = collectOptionLabels(
      <>
        <Option value="a" label="Label A">
          <b>ignored</b>
        </Option>
        <OptionGroup label="Group">
          <Option value="b" textValue="Text B">
            Bee
          </Option>
          <Option value="c">
            <span>Cee</span>
          </Option>
        </OptionGroup>
        <Option value="d" />
      </>,
    );
    expect(Object.fromEntries(labels)).toEqual({
      a: 'Label A',
      b: 'Text B',
      c: 'Cee',
      d: 'd',
    });
  });

  it('forwards ref to the option <li>', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLLIElement>();
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <Option ref={ref} value="a">
          Apple
        </Option>
      </Dropdown>,
    );
    expect(ref.current).toBe(screen.getByRole('option', { name: 'Apple' }));
    // Closed: the option moves back into the inline, hidden list.
    await user.click(combobox());
    expect(ref.current?.tagName).toBe('LI');
    expect(ref.current).not.toBeVisible();
    await user.click(combobox());
    expect(ref.current).toBe(screen.getByRole('option', { name: 'Apple' }));
  });

  it('renders a group as presentation > group named by its label', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <OptionGroup label="Citrus">
          <Option value="l">Lemon</Option>
        </OptionGroup>
      </Dropdown>,
    );
    const group = screen.getByRole('group', { name: 'Citrus' });
    expect(group.tagName).toBe('UL');
    expect(group.parentElement).toHaveAttribute('role', 'presentation');
    expect(group.parentElement?.tagName).toBe('LI');
  });

  it('puts the hidden attribute on a hidden group and option, next to a consumer display class', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <OptionGroup label="Citrus" className="flex" hidden>
          <Option value="l" className="grid">
            Lemon
          </Option>
        </OptionGroup>
        <Option value="a" className="grid" hidden>
          Apple
        </Option>
      </Dropdown>,
    );
    const group = screen.getByRole('group', { name: 'Citrus', hidden: true }).parentElement;
    // base.css's scoped `[hidden]` rule hides them over any display class.
    expect(group).toHaveAttribute('hidden');
    expect(group).toHaveClass('flex');
    // (a hidden element has no accessible name: query its text)
    const lemon = screen.getByText('Lemon').closest('li');
    expect(lemon).toHaveAttribute('role', 'option');
    expect(lemon).toHaveClass('grid');
    expect(lemon).not.toHaveClass('flex');
    const apple = screen.getByText('Apple').closest('li');
    expect(apple).toHaveAttribute('role', 'option');
    expect(apple).toHaveAttribute('hidden');
    expect(apple).toHaveClass('grid');
  });

  it('keeps the 0.4 data-value attribute', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('data-value', 'a');
  });

  it('shows the label prop in the trigger when the children are not plain text', () => {
    render(
      <Dropdown aria-label="Fruit" defaultValue="a">
        <Option value="a" label="Apple">
          <span aria-hidden="true">*</span> Apple (red)
        </Option>
      </Dropdown>,
    );
    expect(combobox()).toHaveTextContent('Apple');
    expect(combobox()).not.toHaveTextContent('red');
  });

  it('composes a consumer onClick: it runs first and preventDefault() cancels the selection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onClick = vi.fn((e: React.MouseEvent) => e.preventDefault());
    render(
      <Dropdown aria-label="Fruit" defaultOpen onValueChange={onValueChange}>
        <Option value="a" onClick={onClick}>
          Apple
        </Option>
        <Option value="b">Banana</Option>
      </Dropdown>,
    );
    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('marks the selected option with a check mark and the container forced-colors recipe', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen defaultValue="b">
        <Option value="a">Apple</Option>
        <Option value="b">Banana</Option>
      </Dropdown>,
    );
    const selected = screen.getByRole('option', { name: 'Banana' });
    const other = screen.getByRole('option', { name: 'Apple' });
    expect(selected.querySelector('svg')).not.toHaveClass('invisible');
    expect(other.querySelector('svg')).toHaveClass('invisible');
    expect(selected).toHaveClass('forced-colors:outline-[Highlight]');
    expect(other).not.toHaveClass('forced-colors:outline-[Highlight]');
    expect(selected).not.toHaveClass('forced-colors:forced-color-adjust-none');
  });

  it('Option and OptionGroup written in a Server Component (lazy types) render the same server HTML and behave the same', async () => {
    const user = userEvent.setup();
    const LazyOption = asClientReference(Option);
    const LazyGroup = asClientReference(OptionGroup);
    const plain = renderToString(
      <Dropdown aria-label="Fruit" defaultValue="l">
        <OptionGroup label="Citrus">
          <Option value="l">Lemon</Option>
        </OptionGroup>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    expect(plain).toMatch(/role="combobox"[^>]*>(<[^>]*>)*Lemon</); // the trigger shows the label
    const lazy = (
      <Dropdown aria-label="Fruit" defaultValue="l">
        <LazyGroup label="Citrus">
          <LazyOption value="l">Lemon</LazyOption>
        </LazyGroup>
        <LazyOption value="a">Apple</LazyOption>
      </Dropdown>
    );
    expect(renderToString(lazy)).toBe(plain);

    render(lazy);
    expect(combobox()).toHaveTextContent('Lemon');
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(combobox()).toHaveTextContent('Apple');
  });

  it('throws in development outside a listbox (C-CONTEXT)', () => {
    expectThrows(
      <ul>
        <Option value="a">Apple</Option>
      </ul>,
      '[WaveUI] Option must be used within a listbox (Listbox, Combobox, Dropdown or a ListboxProvider)',
    );
  });
});

describe('Option / OptionGroup hidden by the consumer', () => {
  it('a hidden option is never highlighted or committed with the keyboard, like a native <option hidden>', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Dropdown aria-label="Fruit" onValueChange={onValueChange}>
        <Option value="placeholder" hidden>
          Choose…
        </Option>
        <Option value="a">Apple</Option>
        <Option value="b" hidden>
          Banana
        </Option>
        <Option value="c">Cherry</Option>
      </Dropdown>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Cherry' }));
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onValueChange.mock.calls).toEqual([['a']]);
    // Typeahead does not find the hidden Banana either.
    await user.keyboard('b');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{Enter}');
    expect(onValueChange.mock.calls).toEqual([['a']]);
    const hidden = screen.getAllByRole('option', { hidden: true }).filter((o) => o.hidden);
    expect(hidden.map((o) => o.textContent)).toEqual(['Choose…', 'Banana']);
  });

  it('a selected hidden option (a placeholder) shows its label; opening starts at the first visible option', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown aria-label="Fruit" defaultValue="placeholder">
        <Option value="placeholder" hidden>
          Choose…
        </Option>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    expect(combobox()).toHaveTextContent('Choose…');
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
  });

  it('the options of a hidden OptionGroup are never highlighted or committed', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Dropdown aria-label="Fruit" onValueChange={onValueChange}>
        <OptionGroup label="Citrus" hidden>
          <Option value="l">Lemon</Option>
          <OptionGroup label="Limes">
            <Option value="k">Key lime</Option>
          </OptionGroup>
        </OptionGroup>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{ArrowUp}{Home}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('k');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{Enter}');
    expect(onValueChange.mock.calls).toEqual([['a']]);
  });

  it('a group whose options are all hidden is hidden; a listbox with only hidden options does not expand', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown aria-label="Fruit">
        <OptionGroup label="Citrus">
          <Option value="l" hidden>
            Lemon
          </Option>
        </OptionGroup>
        <Option value="a" hidden>
          Apple
        </Option>
      </Dropdown>,
    );
    expect(
      screen.getByRole('group', { name: 'Citrus', hidden: true }).parentElement,
    ).toHaveAttribute('hidden');
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Combobox: a hidden option is not listed or committed, and filtering matches textValue', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox aria-label="Fruit" onValueChange={onValueChange}>
        <Option value="us" label="USA" textValue="United States">
          USA
        </Option>
        <Option value="x" hidden>
          United Kingdom
        </Option>
        <Option value="no">Norway</Option>
      </Combobox>,
    );
    await user.type(combobox(), 'united');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['USA']);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onValueChange.mock.calls).toEqual([['us']]);
  });
});

/* ------------------------------------------------------------------ */
/*  Custom pickers: the public listbox parts (option-2, option-3, listbox-2) */
/* ------------------------------------------------------------------ */

interface ListboxHarnessProps {
  /** The selected values. */
  selected?: readonly string[];
  multiselect?: boolean;
  children?: React.ReactNode;
}

/**
 * An open select-only listbox without a combobox or ListboxSurface: the list a custom picker
 * renders itself, with its options under a ListboxProvider.
 */
function ListboxHarness({ selected = [], multiselect = false, children }: ListboxHarnessProps) {
  const listbox = useListbox({
    open: true,
    mode: 'select-only',
    multiselect,
    selectedValues: selected,
    onSelect: () => {},
  });
  return (
    <ListboxProvider value={listbox.context}>
      <ul {...listbox.getListboxProps()} aria-label="Fruit">
        {children}
      </ul>
    </ListboxProvider>
  );
}

function renderInListbox(ui: React.ReactNode, options: Omit<ListboxHarnessProps, 'children'> = {}) {
  return render(<ListboxHarness {...options}>{ui}</ListboxHarness>);
}

function option(name: string): HTMLElement {
  return screen.getByRole('option', { name });
}

/** A listbox that holds focus itself (standalone mode): an option press focuses the list. */
function StandaloneHarness({ children }: { children?: React.ReactNode }) {
  const [focused, setFocused] = React.useState(false);
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const listbox = useListbox({
    open: focused,
    mode: 'standalone',
    selectedValues: selected,
    onSelect: (value) => setSelected([value]),
  });
  return (
    <ListboxProvider value={listbox.context}>
      <ul
        {...listbox.getListboxProps()}
        aria-label="Fruit"
        onKeyDown={listbox.onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {children}
      </ul>
    </ListboxProvider>
  );
}

/** A dismiss layer (a Dialog, for example) around a picker. */
function ParentLayer({
  onDismiss,
  children,
}: {
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({ open: true, onDismiss, refs: [ref] });
  return (
    <DismissLayerProvider layerId={layerId}>
      <div ref={ref}>{children}</div>
    </DismissLayerProvider>
  );
}

const FONTS = ['Arial', 'Georgia', 'Verdana'];

interface FontPickerProps extends Pick<
  ListboxSurfaceProps,
  'showCheck' | 'listClassName' | 'surfaceClassName' | 'listProps'
> {
  fonts?: readonly string[];
  multiselect?: boolean;
  defaultValues?: readonly string[];
}

/**
 * A minimal custom picker on the listbox parts (spec §1.3): a button combobox, `useListbox`,
 * `useListboxPopup` and `ListboxSurface`. The root's `data-open` shows the open state.
 */
function FontPicker({
  fonts = FONTS,
  multiselect = false,
  defaultValues = [],
  ...surfaceProps
}: FontPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<readonly string[]>(defaultValues);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'select-only',
    multiselect,
    selectedValues: values,
    onSelect: (value) =>
      setValues((current) => {
        if (!multiselect) return [value];
        return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      }),
  });
  // Nothing to show (no options): the list stays collapsed.
  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef,
  });
  const buttonRef = useMergedRefs<HTMLButtonElement>(anchorRef, setReference);
  return (
    <div ref={rootRef} data-open={open ? '' : undefined}>
      <button
        type="button"
        aria-label="Font"
        {...listbox.getComboboxProps()}
        aria-expanded={expanded}
        ref={buttonRef}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          // Open with nothing shown: close, and leave Escape to an enclosing layer (not an Escape
          // that only cancels an IME composition).
          if (event.key === 'Escape' && open && !expanded && !event.nativeEvent.isComposing) {
            setOpen(false);
            return;
          }
          listbox.onKeyDown(event);
        }}
        onKeyUp={listbox.onKeyUp}
      >
        {values.join(', ') || 'Pick a font'}
      </button>
      <ListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        aria-label="Fonts"
        {...surfaceProps}
      >
        {fonts.map((font) => (
          <Option key={font} value={font}>
            {font}
          </Option>
        ))}
      </ListboxSurface>
    </div>
  );
}

function fontButton(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Font' });
}

function fontSurface(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-wave-listbox-surface]');
}

const CHECK_ICON_EMPTY =
  '[WaveUI] Option: `checkIcon` renders nothing, so the default check shows: a selected option must show its state. Pass a glyph, or leave it unset.';

const GROUP_UNNAMED =
  '[WaveUI] OptionGroup: the group has no name. Give it a text `label`, `aria-label` or `aria-labelledby`.';

describe('Option parts for custom pickers (option-2, option-3, listbox-2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Option checkIcon (option-2)', () => {
    it('replaces the check glyph with checkIcon and keeps the 0.7 svg by default', () => {
      renderInListbox(
        <>
          <Option value="a" checkIcon={<span data-testid="glyph">★</span>}>
            Apple
          </Option>
          <Option value="b">Banana</Option>
        </>,
        { selected: ['a', 'b'] },
      );
      expect(
        within(option('Apple')).getByTestId('glyph').closest('[aria-hidden="true"]'),
      ).not.toBeNull();
      expect(option('Apple').querySelector('svg')).toBeNull();
      expect(option('Banana').querySelector('svg')).toHaveClass('shrink-0');
    });

    it('keeps the check column for a custom glyph: shown while selected, invisible otherwise', () => {
      renderInListbox(
        <>
          <Option value="a" checkIcon="✓">
            Apple
          </Option>
          <Option value="b" checkIcon={{ className: 'text-success', children: '✓' }}>
            Banana
          </Option>
        </>,
        { selected: ['a'] },
      );
      const shown = within(option('Apple')).getByText('✓');
      expect(shown).toHaveAttribute('aria-hidden', 'true');
      expect(shown).toHaveClass('shrink-0');
      expect(shown).not.toHaveClass('invisible');
      // A slot object keeps the column classes and adds its own.
      const kept = within(option('Banana')).getByText('✓');
      expect(kept).toHaveAttribute('aria-hidden', 'true');
      expect(kept).toHaveClass('shrink-0', 'invisible', 'text-success');
      // The glyph is not part of the option's name.
      expect(option('Apple')).toHaveAccessibleName('Apple');
    });

    it('keeps the 0.7 check for null and undefined, without a warning', () => {
      const warn = vi.spyOn(console, 'warn');
      renderInListbox(
        <>
          <Option value="a" checkIcon={null}>
            Apple
          </Option>
          <Option value="b" checkIcon={undefined}>
            Banana
          </Option>
        </>,
        { selected: ['a'] },
      );
      expect(option('Apple').querySelector('svg')).toHaveAttribute('data-wave-icon', 'check');
      expect(option('Apple').querySelector('svg')).toHaveClass('shrink-0');
      expect(option('Apple').querySelector('svg')).not.toHaveClass('invisible');
      expect(option('Banana').querySelector('svg')).toHaveClass('shrink-0', 'invisible');
      expect(warn).not.toHaveBeenCalled();
    });

    it('keeps the default and warns once for a checkIcon that renders nothing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInListbox(
        <Option value="a" checkIcon={false}>
          Apple
        </Option>,
        { selected: ['a'] },
      );
      expect(option('Apple').querySelector('svg')).not.toBeNull();
      expect(warn.mock.calls).toEqual([[CHECK_ICON_EMPTY]]);
    });

    it('renders the glyph through a render function; one that renders nothing keeps the default and warns once (P13-01)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInListbox(
        <>
          <Option
            value="a"
            checkIcon={{
              children: (Component, props) => (
                <Component {...props} data-testid="glyph">
                  ★
                </Component>
              ),
            }}
          >
            Apple
          </Option>
          <Option value="b" checkIcon={{ children: () => null }}>
            Banana
          </Option>
        </>,
        { selected: ['a', 'b'] },
      );
      const glyph = within(option('Apple')).getByTestId('glyph');
      expect(glyph.tagName).toBe('SPAN');
      expect(glyph).toHaveClass(optionClassNames.checkIcon, 'inline-flex', 'shrink-0');
      expect(glyph).toHaveAttribute('aria-hidden', 'true');
      expect(option('Apple').querySelector('svg')).toBeNull();
      expect(option('Apple')).toHaveAccessibleName('Apple');
      // A required indicator: a selected option shows its state.
      expect(option('Banana').querySelector('svg')).toHaveAttribute('data-wave-icon', 'check');
      expect(warn.mock.calls).toEqual([[CHECK_ICON_EMPTY]]);
    });

    it("keeps the default for '', [] and an empty Fragment, with one warning", () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInListbox(
        <>
          <Option value="a" checkIcon="">
            Apple
          </Option>
          <Option value="b" checkIcon={[]}>
            Banana
          </Option>
          <Option value="c" checkIcon={<></>}>
            Cherry
          </Option>
        </>,
        { selected: ['a', 'b', 'c'] },
      );
      for (const name of ['Apple', 'Banana', 'Cherry']) {
        expect(option(name).querySelector('svg')).toHaveAttribute('data-wave-icon', 'check');
      }
      expect(warn.mock.calls).toEqual([[CHECK_ICON_EMPTY]]);
    });
  });

  describe('the multi-select box (D8)', () => {
    it('draws a checkbox box in a multi-select list, without the Highlight outline', () => {
      renderInListbox(<Option value="a">Apple</Option>, { selected: ['a'], multiselect: true });
      const box = option('Apple').querySelector('[data-wave-option-box]');
      expect(box).toHaveAttribute('aria-hidden', 'true');
      expect(box).toHaveClass('bg-primary');
      expect(option('Apple').className).not.toMatch(/outline-\[Highlight\]/);
    });

    it('checked and unchecked boxes: their colours, forced-colors recipes and the glyph only while selected', () => {
      renderInListbox(
        <>
          <Option value="a">Apple</Option>
          <Option value="b">Banana</Option>
        </>,
        { selected: ['a'], multiselect: true },
      );
      const checked = option('Apple').querySelector('[data-wave-option-box]');
      expect(checked).toHaveClass(
        'h-4',
        'w-4',
        'shrink-0',
        'rounded-xs',
        'border',
        'border-primary',
        'bg-primary',
        'text-primary-foreground',
        'forced-colors:bg-[Highlight]',
        'forced-colors:text-[HighlightText]',
        'forced-colors:forced-color-adjust-none',
      );
      expect(checked?.querySelector('svg')).toHaveAttribute('data-wave-icon', 'check');
      const unchecked = option('Banana').querySelector('[data-wave-option-box]');
      expect(unchecked).toHaveAttribute('aria-hidden', 'true');
      expect(unchecked).toHaveClass(
        'border-stroke-accessible',
        'bg-transparent',
        'forced-colors:border-[ButtonText]',
      );
      expect(unchecked).not.toHaveClass('bg-primary');
      expect(unchecked?.childNodes).toHaveLength(0);
      // The box is the check column: no second glyph next to it.
      expect(option('Apple').querySelectorAll('svg')).toHaveLength(1);
      expect(option('Banana').querySelector('svg')).toBeNull();
      // The box carries the state; the Highlight outline would look like the active option.
      for (const name of ['Apple', 'Banana']) {
        expect(option(name).className).not.toMatch(/outline-\[Highlight\]/);
      }
    });

    it('draws a custom checkIcon inside the box while selected', () => {
      renderInListbox(
        <>
          <Option value="a" checkIcon={<span data-testid="glyph-a">★</span>}>
            Apple
          </Option>
          <Option value="b" checkIcon={<span data-testid="glyph-b">★</span>}>
            Banana
          </Option>
        </>,
        { selected: ['a'], multiselect: true },
      );
      const box = option('Apple').querySelector('[data-wave-option-box]');
      expect(box).toContainElement(screen.getByTestId('glyph-a'));
      expect(box?.querySelector('svg')).toBeNull();
      expect(screen.queryByTestId('glyph-b')).toBeNull();
    });

    it('draws no box when the surface turns the check off (showCheck={false})', async () => {
      const user = userEvent.setup();
      render(<FontPicker multiselect showCheck={false} defaultValues={['Georgia']} />);
      await user.click(fontButton());
      expect(option('Georgia')).toHaveAttribute('aria-selected', 'true');
      expect(option('Georgia').querySelector('[data-wave-option-box]')).toBeNull();
      expect(option('Georgia').querySelector('svg')).toBeNull();
    });

    it('keeps the Highlight outline of a selected option while no box carries the state', async () => {
      const user = userEvent.setup();
      render(<FontPicker multiselect showCheck={false} defaultValues={['Georgia']} />);
      await user.click(fontButton());
      expect(fontButton()).toHaveAttribute('aria-expanded', 'true');
      expect(option('Georgia')).toHaveClass('forced-colors:outline-[Highlight]');
      expect(option('Arial')).not.toHaveClass('forced-colors:outline-[Highlight]');
    });

    it("draws a disabled option's box in the row's muted colour, checked or not", () => {
      renderInListbox(
        <>
          <Option value="a" disabled>
            Apple
          </Option>
          <Option value="b" disabled>
            Banana
          </Option>
          <Option value="c" disabled checkIcon={<span data-testid="glyph-c">★</span>}>
            Cherry
          </Option>
        </>,
        { selected: ['a', 'c'], multiselect: true },
      );
      // The row's disabled look is its muted text colour, which the box follows.
      expect(option('Apple')).toHaveAttribute('aria-disabled', 'true');
      const disabledBox = [
        'border-current',
        'bg-transparent',
        'forced-colors:border-[GrayText]',
        'forced-colors:bg-[Canvas]',
      ];
      const checked = option('Apple').querySelector('[data-wave-option-box]');
      expect(checked).toHaveClass(...disabledBox);
      for (const cls of [
        'border-primary',
        'bg-primary',
        'text-primary-foreground',
        'forced-colors:bg-[Highlight]',
        'forced-colors:text-[HighlightText]',
        'forced-colors:forced-color-adjust-none',
      ]) {
        expect(checked).not.toHaveClass(cls);
      }
      expect(checked?.querySelector('svg')).toHaveClass(
        'forced-colors:text-[GrayText]',
        'forced-colors:forced-color-adjust-none',
      );
      const unchecked = option('Banana').querySelector('[data-wave-option-box]');
      expect(unchecked).toHaveClass(...disabledBox);
      expect(unchecked).not.toHaveClass('border-stroke-accessible');
      expect(unchecked).not.toHaveClass('forced-colors:border-[ButtonText]');
      expect(unchecked?.childNodes).toHaveLength(0);
      // A custom glyph takes the same GrayText recipe.
      const custom = option('Cherry').querySelector('[data-wave-option-box]');
      expect(custom).toHaveClass(...disabledBox);
      expect(screen.getByTestId('glyph-c').parentElement).toHaveClass(
        'forced-colors:text-[GrayText]',
        'forced-colors:forced-color-adjust-none',
      );
    });
  });

  describe('OptionGroup naming (option-3)', () => {
    it('routes an OptionGroup name to its group list, a defined consumer name winning', () => {
      const warn = vi.spyOn(console, 'warn');
      renderInListbox(
        <>
          <OptionGroup label="Citrus" aria-label="Sour fruit">
            <Option value="l">Lime</Option>
          </OptionGroup>
          <OptionGroup aria-label="Other">
            <Option value="p">Pear</Option>
          </OptionGroup>
          <OptionGroup label={<span>Berries</span>} aria-label={undefined}>
            <Option value="s">Strawberry</Option>
          </OptionGroup>
        </>,
      );
      const sour = screen.getByRole('group', { name: 'Sour fruit' });
      expect(sour).not.toHaveAttribute('aria-labelledby');
      expect(sour.parentElement).toHaveTextContent('Citrus'); // the heading still shows
      const other = screen.getByRole('group', { name: 'Other' });
      // No label: no heading element, only the group list in the presentation item.
      expect(other.parentElement?.children).toHaveLength(1);
      const berries = screen.getByRole('group', { name: 'Berries' });
      expect(berries).toHaveAttribute('aria-labelledby', berries.previousElementSibling?.id);
      expect(warn).not.toHaveBeenCalled();
    });

    it('sends aria-labelledby to the group list and keeps the other props on its item', () => {
      render(
        <>
          <span id="stone-fruit">Stone fruit</span>
          <ListboxHarness>
            <OptionGroup label="Heading" aria-labelledby="stone-fruit" data-testid="item">
              <Option value="p">Peach</Option>
            </OptionGroup>
          </ListboxHarness>
        </>,
      );
      const group = screen.getByRole('group', { name: 'Stone fruit' });
      expect(group).toHaveAttribute('aria-labelledby', 'stone-fruit');
      const item = screen.getByTestId('item');
      expect(item).toHaveAttribute('role', 'presentation');
      expect(item).not.toHaveAttribute('aria-labelledby');
      expect(item).toContainElement(group);
    });

    it('warns once for an unnamed group, an icon-only label included', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInListbox(
        <OptionGroup label={<svg aria-hidden="true" />}>
          <Option value="x">X</Option>
        </OptionGroup>,
      );
      expect(warn.mock.calls).toEqual([[GROUP_UNNAMED]]);
    });

    it('warns once for a group without a label or a name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInListbox(
        <OptionGroup>
          <Option value="x">X</Option>
        </OptionGroup>,
      );
      expect(warn.mock.calls).toEqual([[GROUP_UNNAMED]]);
      // No heading: the presentation item holds only the group list.
      expect(screen.getByRole('group').parentElement?.children).toHaveLength(1);
    });

    it('warns once for a label whose text is hidden from assistive technology', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInListbox(
        <OptionGroup label={<span aria-hidden="true">🍋</span>}>
          <Option value="y">Y</Option>
        </OptionGroup>,
      );
      // The heading shows its text, but the group it labels has no accessible name.
      const group = screen.getByRole('group');
      expect(group.previousElementSibling).toHaveTextContent('🍋');
      expect(group).toHaveAccessibleName('');
      expect(warn.mock.calls).toEqual([[GROUP_UNNAMED]]);
    });

    it('warns once for an empty aria-label, which names nothing and leaves out the heading', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInListbox(
        <OptionGroup label="Citrus" aria-label="">
          <Option value="l">Lime</Option>
        </OptionGroup>,
      );
      expect(screen.getByRole('group')).not.toHaveAttribute('aria-labelledby');
      expect(warn.mock.calls).toEqual([[GROUP_UNNAMED]]);
    });

    it('checks the name again when a rerender changes the label', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderInListbox(
        <OptionGroup label="Citrus">
          <Option value="l">Lime</Option>
        </OptionGroup>,
      );
      expect(warn).not.toHaveBeenCalled();
      rerender(
        <ListboxHarness>
          <OptionGroup label={<svg aria-hidden="true" />}>
            <Option value="l">Lime</Option>
          </OptionGroup>
        </ListboxHarness>,
      );
      expect(warn.mock.calls).toEqual([[GROUP_UNNAMED]]);
    });

    it('does not warn for a label named by an image', () => {
      const warn = vi.spyOn(console, 'warn');
      renderInListbox(
        <OptionGroup label={<svg role="img" aria-label="Citrus" />}>
          <Option value="l">Lime</Option>
        </OptionGroup>,
      );
      expect(screen.getByRole('group', { name: 'Citrus' })).toHaveAttribute('aria-labelledby');
      expect(warn).not.toHaveBeenCalled();
    });

    it('server HTML: a group names its list without a dangling reference', () => {
      const html = renderToString(
        <Dropdown aria-label="Fruit">
          <OptionGroup aria-label="Citrus">
            <Option value="l">Lemon</Option>
          </OptionGroup>
          <OptionGroup label={<b>Berries</b>}>
            <Option value="s">Strawberry</Option>
          </OptionGroup>
        </Dropdown>,
      );
      expect(html).toContain('role="group" aria-label="Citrus"');
      expect(html).toMatch(/role="group" aria-labelledby="[^"]+"/);
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
    });
  });

  describe('ListboxProvider', () => {
    it('provides a listbox context to options rendered without ListboxSurface', () => {
      renderInListbox(
        <>
          <Option value="a">Apple</Option>
          <Option value="b">Banana</Option>
        </>,
        { selected: ['b'] },
      );
      const list = screen.getByRole('listbox', { name: 'Fruit' });
      expect(option('Apple').parentElement).toBe(list);
      expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
      expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
      // The options registered with the listbox: its active option (the selected Banana) is set.
      expect(option('Banana')).toHaveAttribute('data-active');
    });

    it('sets its displayName', () => {
      expect(ListboxProvider.displayName).toBe('ListboxProvider');
    });
  });

  describe('Option pointer handlers', () => {
    it('composes a consumer onMouseDown with the pointer press of a standalone list', () => {
      const onMouseDown = vi.fn();
      render(
        <StandaloneHarness>
          <Option value="a">Apple</Option>
          <Option value="b" onMouseDown={onMouseDown}>
            Banana
          </Option>
        </StandaloneHarness>,
      );
      const list = screen.getByRole('listbox', { name: 'Fruit' });
      // The press prevents the default, focuses the list and makes the pressed option active.
      expect(fireEvent.mouseDown(option('Banana'))).toBe(false);
      expect(onMouseDown).toHaveBeenCalledTimes(1);
      expect(list).toHaveFocus();
      expect(list).toHaveAttribute('aria-activedescendant', option('Banana').id);
    });

    it('a consumer onMouseDown that calls preventDefault() stops the press', () => {
      const onMouseDown = vi.fn((event: React.MouseEvent) => event.preventDefault());
      render(
        <StandaloneHarness>
          <Option value="a">Apple</Option>
          <Option value="b" onMouseDown={onMouseDown}>
            Banana
          </Option>
        </StandaloneHarness>,
      );
      const list = screen.getByRole('listbox', { name: 'Fruit' });
      fireEvent.mouseDown(option('Banana'));
      expect(onMouseDown).toHaveBeenCalledTimes(1);
      expect(list).not.toHaveFocus();
      expect(list).not.toHaveAttribute('aria-activedescendant');
    });

    it('keeps a consumer onMouseDown in a popup list', () => {
      const onMouseDown = vi.fn();
      renderInListbox(
        <Option value="a" onMouseDown={onMouseDown}>
          Apple
        </Option>,
      );
      fireEvent.mouseDown(option('Apple'));
      expect(onMouseDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('ListboxSurface and useListboxPopup (listbox-2)', () => {
    it('a minimal custom picker opens, positions its surface below the button and selects', async () => {
      const user = userEvent.setup();
      render(<FontPicker />);
      expect(fontButton()).toHaveAttribute('aria-expanded', 'false');
      expect(fontSurface()).toBeNull(); // the closed list is inline and hidden, without a surface
      await user.click(fontButton());
      expect(fontButton()).toHaveAttribute('aria-expanded', 'true');
      const list = screen.getByRole('listbox', { name: 'Fonts' });
      expect(list.closest('[data-wave-portal]')).not.toBeNull();
      expect(fontSurface()).toContainElement(list);
      expect(fontSurface()).toHaveAttribute('data-side', 'bottom');
      expect(fontSurface()).toHaveAttribute('data-align', 'start');
      // As wide as the button.
      expect(fontSurface()?.style.width).toBe('var(--wave-popup-reference-width)');
      expect(fontButton()).toHaveAttribute('aria-controls', list.id);
      await user.click(option('Georgia'));
      expect(fontButton()).toHaveTextContent('Georgia');
      expect(fontButton()).toHaveAttribute('aria-expanded', 'false');
      expect(fontSurface()).toBeNull();
    });

    it('flips the surface above the button near the viewport bottom', async () => {
      const html = document.documentElement;
      Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
      Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
      try {
        const user = userEvent.setup();
        render(<FontPicker />);
        mockRect(fontButton(), { x: 100, y: 740, width: 200, height: 32 });
        await user.click(fontButton());
        await waitFor(() => expect(fontSurface()).toHaveAttribute('data-side', 'top'));
        expect(fontSurface()).toHaveAttribute('data-align', 'start');
      } finally {
        Reflect.deleteProperty(html, 'clientWidth');
        Reflect.deleteProperty(html, 'clientHeight');
      }
    });

    it('closes on a press outside and on Escape', async () => {
      const user = userEvent.setup();
      render(
        <>
          <FontPicker />
          <p>Outside</p>
        </>,
      );
      const root = fontButton().parentElement;
      await user.click(fontButton());
      expect(root).toHaveAttribute('data-open');
      await user.click(screen.getByText('Outside'));
      expect(root).not.toHaveAttribute('data-open');
      expect(fontSurface()).toBeNull();

      await user.click(fontButton());
      expect(fontButton()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');
      expect(root).not.toHaveAttribute('data-open');
      expect(fontSurface()).toBeNull();
      expect(fontButton()).toHaveFocus();
    });

    it('inside another layer, Escape closes only the popup; the next Escape reaches the layer', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <FontPicker />
        </ParentLayer>,
      );
      await user.click(fontButton());
      await user.keyboard('{Escape}');
      expect(fontButton()).toHaveAttribute('aria-expanded', 'false');
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });

    it('hands Escape to an enclosing layer while it shows nothing (no options, overlays#1)', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <FontPicker fonts={[]} />
        </ParentLayer>,
      );
      const root = fontButton().parentElement;
      await user.click(fontButton());
      // Open, with nothing to show: collapsed, and no surface.
      expect(root).toHaveAttribute('data-open');
      expect(fontButton()).toHaveAttribute('aria-expanded', 'false');
      expect(fontSurface()).toBeNull();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
      expect(root).not.toHaveAttribute('data-open');
    });

    it('lets listClassName replace the list’s maximum height', async () => {
      const user = userEvent.setup();
      render(<FontPicker listClassName="max-h-80" />);
      // The closed, inline list carries it too (hidden, so it has no accessible name to query).
      const inline = screen.getByRole('listbox', { hidden: true });
      expect(inline).toHaveClass('max-h-80');
      expect(inline).not.toHaveClass('max-h-60');
      await user.click(fontButton());
      const list = screen.getByRole('listbox', { name: 'Fonts' });
      expect(list).toHaveClass('max-h-80', 'min-h-0', 'overflow-auto');
      expect(list).not.toHaveClass('max-h-60');
    });

    it('keeps the 0.7 list and surface classes without the class props', async () => {
      const user = userEvent.setup();
      render(<FontPicker />);
      await user.click(fontButton());
      // The stable classes (P3-00) come first, then the 0.7 utilities unchanged.
      expect(screen.getByRole('listbox', { name: 'Fonts' }).className).toBe(
        `${listboxSurfaceClassNames.list} min-h-0 max-h-60 overflow-auto`,
      );
      expect(fontSurface()?.className).toBe(
        `${listboxSurfaceClassNames.root} flex flex-col overflow-hidden rounded border border-border bg-background py-1 text-foreground shadow-4`,
      );
    });

    it('merges surfaceClassName last onto the surface', async () => {
      const user = userEvent.setup();
      render(<FontPicker surfaceClassName="shadow-8 rounded-lg" />);
      await user.click(fontButton());
      expect(fontSurface()).toHaveClass('shadow-8', 'rounded-lg', 'border', 'bg-background');
      expect(fontSurface()).not.toHaveClass('shadow-4');
      expect(fontSurface()).not.toHaveClass('rounded');
    });
  });

  // 0.11 spec §1.11: attributes and a ref for the list element (TagPicker.List builds on them).
  describe('ListboxSurface listProps', () => {
    it('ListboxSurface spreads listProps onto the list, and its own attributes win', async () => {
      const user = userEvent.setup();
      // The listbox's own attributes, which the type omits, passed anyway (a JavaScript caller).
      const overridden = {
        role: 'menu',
        id: 'my-list',
        tabIndex: 0,
        hidden: false,
        className: 'my-class',
        'aria-label': 'Not the name',
        'aria-multiselectable': false,
      } as unknown as ListboxSurfaceListProps;
      // A `data-*` attribute, as a wrapper's rest props carry it (TagPicker.List's `data-testid`).
      const listProps: ListboxSurfaceListProps & { 'data-testid': string } = {
        ...overridden,
        'data-testid': 'font-list',
        'aria-describedby': 'font-hint',
        title: 'Fonts on this device',
      };
      render(
        <>
          <p id="font-hint">Pick one or more</p>
          <FontPicker multiselect listProps={listProps} />
        </>,
      );
      // Closed: the inline list keeps its own `hidden`.
      const inline = screen.getByTestId('font-list');
      expect(inline).toHaveAttribute('hidden');
      expect(inline).toHaveAttribute('role', 'listbox');

      await user.click(fontButton());
      const list = screen.getByRole('listbox', { name: 'Fonts' });
      expect(list).toBe(screen.getByTestId('font-list'));
      expect(list).toHaveAttribute('aria-describedby', 'font-hint');
      expect(list).toHaveAttribute('title', 'Fonts on this device');
      // The listbox's own attributes win.
      expect(list).not.toHaveAttribute('id', 'my-list');
      expect(fontButton()).toHaveAttribute('aria-controls', list.id);
      expect(list).toHaveAttribute('tabindex', '-1');
      expect(list).toHaveAttribute('aria-multiselectable', 'true');
      expect(list).toHaveAttribute('aria-label', 'Fonts');
      expect(list).not.toHaveAttribute('hidden');
      expect(list.className).toBe(
        `${listboxSurfaceClassNames.list} min-h-0 max-h-60 overflow-auto`,
      );
      await expectNoA11yViolations(document.body);
    });

    it('drops the aria-multiselectable and aria-activedescendant of listProps when the listbox renders none', async () => {
      const user = userEvent.setup();
      // A JavaScript caller's values for keys the type omits: a single-select list in a combobox
      // mode renders neither attribute, and listProps must not add them.
      const listProps = {
        'aria-multiselectable': true,
        'aria-activedescendant': 'font-hint',
        'data-testid': 'font-list',
      } as unknown as ListboxSurfaceListProps;
      render(
        <>
          <p id="font-hint">Pick one</p>
          <FontPicker listProps={listProps} />
        </>,
      );
      const inline = screen.getByTestId('font-list');
      expect(inline).not.toHaveAttribute('aria-multiselectable');
      expect(inline).not.toHaveAttribute('aria-activedescendant');

      await user.click(fontButton());
      await user.keyboard('{ArrowDown}');
      const list = screen.getByRole('listbox', { name: 'Fonts' });
      expect(list).toBe(screen.getByTestId('font-list'));
      expect(list).not.toHaveAttribute('aria-multiselectable');
      // The active option is the combobox's descendant, not the list's.
      expect(fontButton()).toHaveAttribute('aria-activedescendant');
      expect(list).not.toHaveAttribute('aria-activedescendant');
      await expectNoA11yViolations(document.body);
    });

    it('listProps.ref receives the list, hidden in place and in the popup', async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLUListElement>();
      render(<FontPicker listProps={{ ref }} />);
      const inline = screen.getByRole('listbox', { hidden: true });
      expect(ref.current).toBe(inline);
      expect(ref.current).toHaveAttribute('hidden');
      expect(ref.current?.closest('[data-wave-portal]')).toBeNull();

      await user.click(fontButton());
      const list = screen.getByRole('listbox', { name: 'Fonts' });
      expect(ref.current).toBe(list);
      expect(fontSurface()).toContainElement(ref.current);

      await user.keyboard('{Escape}');
      expect(fontSurface()).toBeNull();
      expect(ref.current).toBe(screen.getByRole('listbox', { hidden: true }));
      expect(ref.current).toHaveAttribute('hidden');
    });

    it('composes listProps.onMouseDown before the list’s own (its preventDefault keeps focus)', async () => {
      const user = userEvent.setup();
      const seen: boolean[] = [];
      // Stops the press at the list, so only the list's own handler (not the surface's) can keep
      // focus on the combobox.
      const onMouseDown = vi.fn((event: React.MouseEvent<HTMLUListElement>) => {
        seen.push(event.defaultPrevented);
        event.stopPropagation();
      });
      render(<FontPicker listProps={{ onMouseDown }} />);
      await user.click(fontButton());
      expect(fontButton()).toHaveFocus();

      await user.pointer({ keys: '[MouseLeft>]', target: option('Georgia') });
      expect(onMouseDown).toHaveBeenCalledTimes(1);
      // The consumer's handler runs first, before the list prevents the default.
      expect(seen).toEqual([false]);
      expect(fontButton()).toHaveFocus();
      await user.pointer({ keys: '[/MouseLeft]', target: option('Georgia') });
      expect(fontButton()).toHaveTextContent('Georgia');
      expect(fontButton()).toHaveFocus();
    });

    it('a consumer’s preventDefault in listProps.onMouseDown also keeps focus', async () => {
      const user = userEvent.setup();
      const onMouseDown = vi.fn((event: React.MouseEvent<HTMLUListElement>) => {
        event.preventDefault();
      });
      render(<FontPicker listProps={{ onMouseDown }} />);
      await user.click(fontButton());
      expect(fireEvent.mouseDown(option('Verdana'))).toBe(false);
      expect(onMouseDown).toHaveBeenCalledTimes(1);
      expect(fontButton()).toHaveFocus();
    });

    it('a style in listProps reaches the list', async () => {
      const user = userEvent.setup();
      render(<FontPicker listProps={{ style: { minWidth: '12rem' } }} />);
      expect(screen.getByRole('listbox', { hidden: true }).style.minWidth).toBe('12rem');
      await user.click(fontButton());
      expect(screen.getByRole('listbox', { name: 'Fonts' }).style.minWidth).toBe('12rem');
    });

    it('renders the 0.10 list without listProps', () => {
      const html = renderToString(<FontPicker />);
      const withEmpty = renderToString(<FontPicker listProps={{}} />);
      expect(withEmpty).toBe(html);
    });

    it('types listProps and its ref', () => {
      expectTypeOf<ListboxSurfaceProps['listProps']>().toEqualTypeOf<
        ListboxSurfaceListProps | undefined
      >();
      expectTypeOf<ListboxSurfaceListProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLUListElement> | undefined
      >();
      expectTypeOf<ListboxSurfaceListProps['style']>().toEqualTypeOf<
        React.CSSProperties | undefined
      >();
      // The listbox's own attributes and the naming props are not part of listProps.
      type OwnKeys =
        | 'role'
        | 'id'
        | 'hidden'
        | 'tabIndex'
        | 'className'
        | 'aria-label'
        | 'aria-labelledby'
        | 'aria-multiselectable'
        | 'aria-activedescendant';
      expectTypeOf<Extract<keyof ListboxSurfaceListProps, OwnKeys>>().toBeNever();
      // The list's content is the surface's `children`.
      expectTypeOf<
        Extract<keyof ListboxSurfaceListProps, 'children' | 'dangerouslySetInnerHTML'>
      >().toBeNever();
      expectTypeOf<'onMouseDown'>().toExtend<keyof ListboxSurfaceListProps>();
      expectTypeOf<'aria-describedby'>().toExtend<keyof ListboxSurfaceListProps>();
    });
  });

  describe('types', () => {
    it('types the new props and the renamed popup result', () => {
      expectTypeOf<OptionProps['checkIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
      expectTypeOf<OptionGroupProps['label']>().toEqualTypeOf<React.ReactNode>();
      expectTypeOf<ListboxSurfaceProps['listClassName']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ListboxSurfaceProps['surfaceClassName']>().toEqualTypeOf<string | undefined>();
      expectTypeOf(useListboxPopup).returns.toEqualTypeOf<UseListboxPopupResult>();
      expectTypeOf<ListboxSurfaceProps['floatingProps']>().toEqualTypeOf<
        UseListboxPopupResult['floatingProps']
      >();
    });
  });
});

describe('Option — slotProps', () => {
  type OptionSlotProps = NonNullable<OptionProps['slotProps']>;
  const part = (name: string) => document.querySelector<HTMLElement>(`.${name}`);

  it('renders the 0.17.1 parts of Option and OptionGroup without slotProps (opening tags, attributes sorted)', () => {
    // Captured from b8941ef, a server render: the merged props may put the class before the
    // locked attributes.
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <Listbox aria-label="Fruit" multiselect defaultValue={['a']}>
        <Option value="a">Apple</Option>
        <OptionGroup label="More">
          <Option value="c">Cherry</Option>
        </OptionGroup>
      </Listbox>,
    );
    const all = (name: string) => Array.from(container.querySelectorAll(`.${name}`));
    expect(
      openingTags(
        ...all(optionClassNames.indicator),
        ...all(optionClassNames.content),
        ...all(optionGroupClassNames.label),
        ...all(optionGroupClassNames.list),
      ),
    ).toBe(
      [
        '<span aria-hidden="true" class="wave-option__indicator flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-primary bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none" data-wave-option-box="">',
        '<span aria-hidden="true" class="wave-option__indicator flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-stroke-accessible bg-transparent forced-colors:border-[ButtonText]" data-wave-option-box="">',
        '<span class="wave-option__content min-w-0 flex-1">',
        '<span class="wave-option__content min-w-0 flex-1">',
        '<div class="wave-option-group__label px-3 py-1 text-caption-1 font-semibold text-muted-foreground" id="option-group-_id0_" role="presentation">',
        '<ul aria-labelledby="option-group-_id0_" class="wave-option-group__list" role="group">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const options = (slotProps: OptionSlotProps | undefined) => [
      <Option key="a" value="a" slotProps={slotProps}>
        Apple
      </Option>,
      <Option key="b" value="b" disabled slotProps={slotProps}>
        Banana
      </Option>,
    ];
    expectInertSlotProps(
      (slotProps) => (
        <Listbox aria-label="Fruit" defaultValue="a">
          {options(slotProps)}
        </Listbox>
      ),
      { indicator: {}, content: {} },
    );
    expectInertSlotProps(
      (slotProps) => (
        <Listbox aria-label="Fruit" multiselect defaultValue={['a']}>
          {options(slotProps)}
        </Listbox>
      ),
      { indicator: {}, content: {} },
    );
  });

  it('puts your className, style, data-* and ref on the indicator and the content', () => {
    const indicator = React.createRef<HTMLSpanElement>();
    const content = React.createRef<HTMLSpanElement>();
    render(
      <Listbox aria-label="Fruit" multiselect defaultValue={['a']}>
        <Option
          value="a"
          slotProps={{
            indicator: {
              ref: indicator,
              className: 'my-indicator',
              style: { opacity: 0.5 },
              'data-part': 'indicator',
            },
            content: {
              ref: content,
              className: 'my-content',
              style: { opacity: 0.5 },
              'data-part': 'content',
            },
          }}
        >
          Apple
        </Option>
      </Listbox>,
    );
    const option = screen.getByRole('option', { name: 'Apple' });
    for (const [element, stable, mine, ref] of [
      [part(optionClassNames.indicator), optionClassNames.indicator, 'my-indicator', indicator],
      [part(optionClassNames.content), optionClassNames.content, 'my-content', content],
    ] as const) {
      expect(option).toContainElement(element);
      expect(element!.classList[0]).toBe(stable);
      expect(element!.classList[element!.classList.length - 1]).toBe(mine);
      expect(element).toHaveStyle({ opacity: '0.5' });
      expect(ref.current).toBe(element);
    }
    expect(indicator.current).toHaveAttribute('data-part', 'indicator');
    expect(content.current).toHaveAttribute('data-part', 'content');
    // The option itself keeps its semantics.
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  it('lets your class replace a conflicting class of the content', () => {
    render(
      <Listbox aria-label="Fruit">
        <Option value="a" slotProps={{ content: { className: 'flex-none' } }}>
          Apple
        </Option>
      </Listbox>,
    );
    const content = part(optionClassNames.content);
    expect(content).toHaveClass('flex-none');
    expect(content).not.toHaveClass('flex-1');
  });

  it('keeps the indicator decorative and marked', () => {
    render(
      <Listbox aria-label="Fruit" multiselect>
        <Option
          value="a"
          slotProps={{ indicator: { 'aria-hidden': false, 'data-wave-option-box': undefined } }}
        >
          Apple
        </Option>
      </Listbox>,
    );
    const indicator = part(optionClassNames.indicator);
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).toHaveAttribute('data-wave-option-box', '');
  });

  it('keeps the indicator out of the tab order: a part sets no tabIndex on it', () => {
    render(
      <Listbox aria-label="Fruit" multiselect>
        <Option value="a" slotProps={{ indicator: { tabIndex: 0 } }}>
          Apple
        </Option>
      </Listbox>,
    );
    expect(part(optionClassNames.indicator)).not.toHaveAttribute('tabindex');
  });

  it.each([
    ['enabled', false, 1],
    ['disabled', true, 0],
  ] as const)(
    'calls your content and indicator onClick only while the option is %s',
    (_, disabled, calls) => {
      const content = vi.fn();
      const indicator = vi.fn();
      const own = vi.fn();
      render(
        <Listbox aria-label="Fruit" multiselect>
          <Option
            value="a"
            disabled={disabled}
            onClick={own}
            slotProps={{ content: { onClick: content }, indicator: { onClick: indicator } }}
          >
            Apple
          </Option>
        </Listbox>,
      );
      fireEvent.click(part(optionClassNames.content)!);
      fireEvent.click(part(optionClassNames.indicator)!);
      expect(content).toHaveBeenCalledTimes(calls);
      expect(indicator).toHaveBeenCalledTimes(calls);
      // The Option's own onClick, on its <li>, runs in both states (as in 0.17.1).
      expect(own).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps the content naming the option: no role, aria-label or hidden state from a part', () => {
    render(
      <Listbox aria-label="Fruit">
        <Option
          value="a"
          slotProps={{
            content: {
              role: 'img',
              'aria-label': 'Other',
              hidden: true,
              inert: true,
              'aria-hidden': true,
            },
          }}
        >
          Apple
        </Option>
      </Listbox>,
    );
    const option = screen.getByRole('option', { name: 'Apple' });
    const content = part(optionClassNames.content);
    expect(option).toContainElement(content);
    for (const attribute of ['role', 'aria-label', 'hidden', 'inert', 'aria-hidden']) {
      expect(content).not.toHaveAttribute(attribute);
    }
  });

  it('ignores the indicator part in a single-select list, which draws no square', () => {
    const indicator = React.createRef<HTMLSpanElement>();
    render(
      <Listbox aria-label="Fruit" defaultValue="a">
        <Option value="a" slotProps={{ indicator: { ref: indicator, className: 'my-indicator' } }}>
          Apple
        </Option>
      </Listbox>,
    );
    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    expect(indicator.current).toBeNull();
    expect(document.querySelector('.my-indicator')).toBeNull();
  });

  it('reaches the options of a Combobox and a Dropdown too', async () => {
    const user = userEvent.setup();
    const apple = (
      <Option value="a" slotProps={{ content: { className: 'my-content' } }}>
        Apple
      </Option>
    );
    for (const picker of [
      <Combobox key="combobox" aria-label="Fruit">
        {apple}
      </Combobox>,
      <Dropdown key="dropdown" aria-label="Fruit">
        {apple}
      </Dropdown>,
    ]) {
      const { unmount } = render(picker);
      await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
      const option = screen.getByRole('option', { name: 'Apple' });
      expect(within(option).getByText('Apple')).toHaveClass(optionClassNames.content, 'my-content');
      unmount();
    }
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <Listbox aria-label="Fruit" multiselect defaultValue={['a']}>
        <Option
          value="a"
          slotProps={{ indicator: { className: 'my-indicator' }, content: { title: 'Apple' } }}
        >
          Apple
        </Option>
      </Listbox>,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof OptionSlotProps>().toEqualTypeOf<'indicator' | 'content'>();
    expectTypeOf<NonNullable<OptionSlotProps['indicator']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<OptionSlotProps['content']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the Option draws its content
    void (<Option value="a" slotProps={{ content: { children: 'Other' } }} />);
  });
});

describe('OptionGroup — slotProps', () => {
  type OptionGroupSlotProps = NonNullable<OptionGroupProps['slotProps']>;
  const part = (name: string) => document.querySelector<HTMLElement>(`.${name}`);

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    for (const props of [
      { label: 'More' },
      { 'aria-label': 'More' },
      { label: 'More', 'aria-labelledby': 'elsewhere' },
    ] as OptionGroupProps[]) {
      expectInertSlotProps(
        (slotProps) => (
          <Listbox aria-label="Fruit">
            <OptionGroup {...props} slotProps={slotProps}>
              <Option value="a">Apple</Option>
            </OptionGroup>
          </Listbox>
        ),
        { label: {}, list: {} },
      );
    }
  });

  it('puts your className, style, data-* and ref on the label and the list', () => {
    const label = React.createRef<HTMLDivElement>();
    const list = React.createRef<HTMLUListElement>();
    render(
      <Listbox aria-label="Fruit">
        <OptionGroup
          label="More"
          slotProps={{
            label: { ref: label, className: 'my-label', style: { opacity: 0.5 }, 'data-part': 'l' },
            list: { ref: list, className: 'my-list', style: { opacity: 0.5 }, 'data-part': 'g' },
          }}
        >
          <Option value="a">Apple</Option>
        </OptionGroup>
      </Listbox>,
    );
    const group = screen.getByRole('group', { name: 'More' });
    expect(list.current).toBe(group);
    expect(label.current).toBe(part(optionGroupClassNames.label));
    for (const [element, stable, mine, data] of [
      [label.current, optionGroupClassNames.label, 'my-label', 'l'],
      [list.current, optionGroupClassNames.list, 'my-list', 'g'],
    ] as const) {
      expect(element!.classList[0]).toBe(stable);
      expect(element!.classList[element!.classList.length - 1]).toBe(mine);
      expect(element).toHaveStyle({ opacity: '0.5' });
      expect(element).toHaveAttribute('data-part', data);
    }
  });

  it('keeps the heading id that names the list, and the list role, name and visibility', () => {
    render(
      <>
        <span id="extra">Fruit</span>
        <Listbox aria-label="Fruit">
          <OptionGroup
            label="More"
            slotProps={{
              label: { id: 'mine', role: 'heading' },
              list: {
                role: 'list',
                hidden: true,
                'aria-label': 'Other',
                'aria-labelledby': 'extra',
              },
            }}
          >
            <Option value="a">Apple</Option>
          </OptionGroup>
        </Listbox>
      </>,
    );
    const heading = part(optionGroupClassNames.label)!;
    expect(heading.id).not.toBe('mine');
    expect(heading).toHaveAttribute('role', 'presentation');
    const group = screen.getByRole('group', { name: 'More Fruit' });
    expect(group).not.toHaveAttribute('hidden');
    expect(group).not.toHaveAttribute('aria-label');
    expect(group).toHaveAttribute('aria-labelledby', `${heading.id} extra`);
  });

  it('keeps its options reachable: a part sets no inert or aria-hidden on the list', () => {
    render(
      <Listbox aria-label="Fruit">
        <OptionGroup label="More" slotProps={{ list: { inert: true, 'aria-hidden': true } }}>
          <Option value="a">Apple</Option>
        </OptionGroup>
      </Listbox>,
    );
    const group = screen.getByRole('group', { name: 'More' });
    expect(group).not.toHaveAttribute('inert');
    expect(group).not.toHaveAttribute('aria-hidden');
  });

  it('ignores the label part without a label, and still warns about an unnamed group', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const label = React.createRef<HTMLDivElement>();
      render(
        <Listbox aria-label="Fruit">
          <OptionGroup slotProps={{ label: { ref: label, className: 'my-label' } }}>
            <Option value="a">Apple</Option>
          </OptionGroup>
        </Listbox>,
      );
      expect(label.current).toBeNull();
      expect(document.querySelector('.my-label')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] OptionGroup: the group has no name. Give it a text `label`, `aria-label` or `aria-labelledby`.',
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('reads the heading that a label part ref is attached to for the name check', () => {
    const warn = vi.spyOn(console, 'warn');
    const label = React.createRef<HTMLDivElement>();
    render(
      <Listbox aria-label="Fruit">
        <OptionGroup label={<span>More fruit</span>} slotProps={{ label: { ref: label } }}>
          <Option value="a">Apple</Option>
        </OptionGroup>
      </Listbox>,
    );
    expect(label.current).toHaveTextContent('More fruit');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof OptionGroupSlotProps>().toEqualTypeOf<'label' | 'list'>();
    expectTypeOf<NonNullable<OptionGroupSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<OptionGroupSlotProps['list']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLUListElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the group draws its content
    void (<OptionGroup slotProps={{ list: { children: 'Other' } }} />);
  });
});
