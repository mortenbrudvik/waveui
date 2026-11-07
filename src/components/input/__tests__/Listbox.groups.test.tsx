import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Listbox, type ListboxProps } from '../Listbox';
import { Option, OptionGroup, type ListboxGroupRenderState } from '../Option';
import { optionGroupClassNames, listboxClassNames } from '../../../lib/classNames';
import {
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  installResizeObserverMock,
  renderWithProviders,
  type ResizeObserverMock,
} from '../../../test-utils';
import { useVirtualWindow } from '../../../hooks/useVirtualWindow';
import type { ListboxItem } from '../../../hooks/useListbox';
import { ITEM_SIZE, scrollList, useTestWindow, type TestWindowOptions } from './windowHarness';
import {
  activeOptionOf,
  GROUPED_ITEMS,
  groupNames,
  headerTexts,
  installGroupStubs,
  optionLabels,
  PER_GROUP,
  SMALL_ITEMS,
} from './groupsHarness';

const list = () => screen.getByRole('listbox', { name: 'Items' });
const active = () => activeOptionOf(list());

describe('Listbox option groups (items with a group)', () => {
  it('draws each group as a named role=group under a header, and ungrouped options in place', () => {
    render(<Listbox aria-label="Items" items={SMALL_ITEMS} />);
    const root = list();
    // The structure of OptionGroup: a presentational item with the header and the group's list.
    const groups = Array.from(root.querySelectorAll(':scope > li[role="presentation"]'));
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveClass(optionGroupClassNames.root);
    expect(headerTexts(root)).toEqual(['Fruit', 'Vegetables']);
    const header = root.querySelector('[data-group-header]') as HTMLElement;
    expect(header).toHaveAttribute('aria-hidden', 'true');
    expect(header).toHaveClass(optionGroupClassNames.label);
    expect(groupNames(root)).toEqual(['Fruit', 'Vegetables']);
    const fruit = screen.getByRole('group', { name: 'Fruit' });
    expect(fruit).toHaveClass(optionGroupClassNames.list);
    expect(within(fruit).getAllByRole('option')).toHaveLength(3);
    // The ungrouped option stands directly in the list, between the two groups.
    const children = Array.from(root.children).map(
      (el) => el.tagName + ':' + el.getAttribute('role'),
    );
    expect(children).toEqual(['LI:presentation', 'LI:option', 'LI:presentation']);
    expect(screen.getByRole('option', { name: 'Water' }).parentElement).toBe(root);
  });

  it('counts positions within the group, and among the ungrouped options', () => {
    render(<Listbox aria-label="Items" items={SMALL_ITEMS} />);
    const positionOf = (name: string) => {
      const option = screen.getByRole('option', { name });
      return [option.getAttribute('aria-posinset'), option.getAttribute('aria-setsize')];
    };
    expect(positionOf('Apple')).toEqual(['1', '3']);
    expect(positionOf('Cherry')).toEqual(['3', '3']);
    expect(positionOf('Water')).toEqual(['1', '1']);
    expect(positionOf('Carrot')).toEqual(['1', '2']);
    expect(positionOf('Leek')).toEqual(['2', '2']);
  });

  it('keeps the keys over the options: arrows cross a boundary, headers are never active, disabled options are skipped', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Listbox aria-label="Items" items={SMALL_ITEMS} />);
    await user.tab();
    expect(active()).toHaveAccessibleName('Apple');
    await user.keyboard('{ArrowDown}');
    // Banana is disabled.
    expect(active()).toHaveAccessibleName('Cherry');
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveAccessibleName('Water');
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveAccessibleName('Carrot');
    await user.keyboard('{End}');
    expect(active()).toHaveAccessibleName('Leek');
    await user.keyboard('{Home}');
    expect(active()).toHaveAccessibleName('Apple');
    // Typeahead goes over the options.
    await user.keyboard('lee');
    expect(active()).toHaveAccessibleName('Leek');
    // The active descendant is always an option.
    expect(active()).toHaveAttribute('role', 'option');
  });

  it('selects by click and keyboard, and the headers select nothing', async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<Listbox aria-label="Items" items={SMALL_ITEMS} onValueChange={onValueChange} />);
    await user.click(screen.getByRole('option', { name: 'Carrot' }));
    expect(onValueChange.mock.calls).toEqual([['carrot']]);
    const header = list().querySelector('[data-group-header]') as HTMLElement;
    await user.click(header);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{Home}{Enter}');
    expect(onValueChange.mock.calls.at(-1)).toEqual(['apple']);
  });

  it('range-selects over a group boundary in a multiselect list', async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <Listbox
        aria-label="Items"
        multiselect
        items={SMALL_ITEMS}
        defaultValue={['cherry']}
        onValueChange={onValueChange}
      />,
    );
    await user.tab();
    await user.keyboard('{Control>}{Shift>}{End}{/Shift}{/Control}');
    // The headers are not options: they are neither selected nor named.
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(['cherry', 'water', 'carrot', 'leek']);
  });

  it('passes the name and the state of the group to renderGroup', () => {
    const renderGroup = vi.fn((name: string, state: ListboxGroupRenderState) => (
      <span>
        {name} ({state.size}) #{state.index}
      </span>
    ));
    render(<Listbox aria-label="Items" items={SMALL_ITEMS} renderGroup={renderGroup} />);
    expect(headerTexts(list())).toEqual(['Fruit (3) #0', 'Vegetables (2) #1']);
    expect(renderGroup).toHaveBeenCalledWith('Fruit', { index: 0, size: 3 });
    // The name of the group's list stays the plain name.
    expect(groupNames(list())).toEqual(['Fruit', 'Vegetables']);
  });

  it('makes a name that comes back after other items another group, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items: ListboxItem[] = [
      { value: 'a', label: 'A', group: 'One' },
      { value: 'b', label: 'B', group: 'Two' },
      { value: 'c', label: 'C', group: 'One' },
    ];
    const { rerender } = render(<Listbox aria-label="Items" items={items} />);
    expect(groupNames(list())).toEqual(['One', 'Two', 'One']);
    expect(headerTexts(list())).toEqual(['One', 'Two', 'One']);
    rerender(<Listbox aria-label="Items" items={[...items]} />);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Listbox: the items of a group are not adjacent (One): a group name that comes ' +
          'back after other items starts another group, with a header of its own. Order the ' +
          '`items` so that the items of a group follow each other.',
      ],
    ]);
    warn.mockRestore();
  });

  it('treats an empty group name as no group', () => {
    render(
      <Listbox
        aria-label="Items"
        items={[
          { value: 'a', label: 'A', group: '' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    expect(groupNames(list())).toEqual([]);
    expect(screen.getByRole('option', { name: 'A' })).toHaveAttribute('aria-setsize', '2');
  });

  it('draws nothing for a group whose items the data leaves out', () => {
    render(
      <Listbox
        aria-label="Items"
        items={SMALL_ITEMS.map((item) =>
          item.group === 'Fruit' ? { ...item, hidden: true } : item,
        )}
      />,
    );
    expect(groupNames(list())).toEqual(['Vegetables']);
    expect(headerTexts(list())).toEqual(['Vegetables']);
  });

  it('renders the groups in the server HTML, with no dangling id', () => {
    const html = renderToString(<Listbox aria-label="Items" items={SMALL_ITEMS} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Fruit"');
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);
  });

  it('has no axe violations, focused and with a multiselect', async () => {
    const user = userEvent.setup();
    render(<Listbox aria-label="Items" multiselect items={SMALL_ITEMS} defaultValue={['leek']} />);
    await user.tab();
    await expectNoA11yViolations();
  });

  it('mirrors in right-to-left layouts with the same structure and keys', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Listbox aria-label="Items" items={SMALL_ITEMS} />, { dir: 'rtl' });
    expect(groupNames(list())).toEqual(['Fruit', 'Vegetables']);
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(active()).toHaveAccessibleName('Carrot');
  });

  it('keeps the flat list as it was when no item has a group', () => {
    render(
      <Listbox
        aria-label="Items"
        items={SMALL_ITEMS.map(({ group: _group, ...item }) => item)}
        renderGroup={() => 'ignored'}
      />,
    );
    expect(
      list().querySelectorAll('[role="group"], [data-group-header], li[role="presentation"]'),
    ).toHaveLength(0);
    expect(screen.getAllByRole('option')).toHaveLength(6);
    expect(screen.getByRole('option', { name: 'Leek' })).toHaveAttribute('aria-setsize', '6');
  });

  it('warns once that renderGroup is ignored without items', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Listbox aria-label="Items" renderGroup={() => 'x'}>
        <Option value="a">A</Option>
      </Listbox>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Listbox: `renderGroup` is ignored without `items`: it draws the group headers of ' +
          'data mode only. Pass the options as `items` with a `group`, or draw the groups with ' +
          '`OptionGroup`.',
      ],
    ]);
    warn.mockRestore();
  });

  it('types group and renderGroup', () => {
    expectTypeOf<ListboxItem['group']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ListboxProps['renderGroup']>().toEqualTypeOf<
      ((group: string, state: ListboxGroupRenderState) => React.ReactNode) | undefined
    >();
    expectTypeOf<ListboxGroupRenderState>().toEqualTypeOf<{ index: number; size: number }>();
  });
});

describe('Listbox windowed option groups (virtualWindow)', () => {
  beforeEach(() => {
    installGroupStubs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  type WindowedProps = Partial<ListboxProps> & { windowOptions?: TestWindowOptions };

  /** A Listbox over 100 groups of 50 items, windowed by a 32-pixel window. */
  function WindowedGroups({ windowOptions, ...props }: WindowedProps) {
    const virtualWindow = useTestWindow(windowOptions);
    return (
      <Listbox aria-label="Items" items={GROUPED_ITEMS} {...props} virtualWindow={virtualWindow} />
    );
  }

  const rowsOf = () =>
    Array.from(
      list().querySelectorAll('[role="option"], [data-group-header], [data-virtual-spacer]'),
    );

  it('mounts at most 30 rows of 5,100, the headers among them, and a spacer for the rest', () => {
    render(<WindowedGroups />);
    const rows = rowsOf();
    expect(rows.length).toBeLessThanOrEqual(30);
    // The first row of the list is Group 0's header, the options follow in their group.
    expect(rows[0]).toHaveAttribute('data-group-header');
    expect(headerTexts(list())).toEqual(['Group 0']);
    expect(groupNames(list())).toEqual(['Group 0']);
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAccessibleName('Item 0');
    options.forEach((option, index) => {
      expect(option).toHaveAttribute('aria-posinset', String(index + 1));
      expect(option).toHaveAttribute('aria-setsize', String(PER_GROUP));
      expect(option).toHaveStyle({ height: '32px' });
    });
    // Everything below the window is one spacer, as tall as the rows it stands for.
    const spacer = list().querySelector('[data-virtual-spacer]') as HTMLElement;
    expect(spacer).toHaveClass(listboxClassNames.spacer);
    expect(spacer.parentElement).toBe(list());
    expect(rows.at(-1)).toBe(spacer);
    const rendered = rows.length - 1;
    expect(spacer).toHaveStyle({ height: `${(5100 - rendered) * ITEM_SIZE}px` });
    expect(rows[0]).toHaveStyle({ height: '32px' });
  });

  it('renders the window of a scrolled list as partial groups named by their own name', () => {
    render(<WindowedGroups />);
    // Row 2500 is inside the middle of the list, in some group; no header need be rendered.
    scrollList(list(), 2500 * ITEM_SIZE);
    expect(screen.getAllByRole('option').length + headerTexts(list()).length).toBeLessThanOrEqual(
      30,
    );
    const names = groupNames(list());
    expect(names.length).toBeGreaterThan(0);
    for (const group of screen.getAllByRole('group')) {
      // Every rendered group is named, whether or not its header is in the window.
      expect(group).toHaveAccessibleName(/^Group \d+$/);
      expect(within(group).getAllByRole('option').length).toBeGreaterThan(0);
    }
    // The group of the first rendered option has no header in range when it started above.
    const firstOption = screen.getAllByRole('option')[0];
    const firstGroup = firstOption.closest('[role="group"]') as HTMLElement;
    const position = Number(firstOption.getAttribute('aria-posinset'));
    expect(firstGroup.parentElement?.querySelector('[data-group-header]') !== null).toBe(
      position === 1,
    );
  });

  it('walks the keyboard across the group boundaries, scrolling the window along', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedGroups />);
    await user.tab();
    expect(active()).toHaveAccessibleName('Item 0');
    await user.keyboard('{ArrowDown}'.repeat(PER_GROUP));
    // Item 50 opens Group 1: the header above it is rendered and in view.
    expect(active()).toHaveAccessibleName('Item 50');
    expect(active()).toHaveAttribute('aria-posinset', '1');
    expect(
      within(active()!.closest('[role="group"]') as HTMLElement).getAllByRole('option')[0],
    ).toBe(active());
    expect(headerTexts(list())).toContain('Group 1');
    const list_ = list();
    const header = Array.from(list_.querySelectorAll('[data-group-header]')).find(
      (el) => el.textContent === 'Group 1',
    ) as HTMLElement;
    // The header's row is in view: its top is not above the scroll position.
    // Group 1's header is row 51: row 0 is Group 0's header, rows 1 to 50 its options.
    const rowIndex = PER_GROUP + 1;
    expect(list_.scrollTop).toBeLessThanOrEqual(rowIndex * ITEM_SIZE);
    expect(header).toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(active()).toHaveAccessibleName('Item 49');
    expect(active()).toHaveAttribute('aria-posinset', String(PER_GROUP));
    // The window keeps at most 30 rows throughout.
    expect(rowsOf().length).toBeLessThanOrEqual(30);
  });

  it('Home, End, PageDown and typeahead go over the options, and the window follows', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedGroups />);
    await user.tab();
    await user.keyboard('{End}');
    expect(active()).toHaveAccessibleName(`Item ${GROUPED_ITEMS.length - 1}`);
    expect(list()).toContainElement(active());
    expect(rowsOf().length).toBeLessThanOrEqual(30);
    await user.keyboard('{Home}');
    expect(active()).toHaveAccessibleName('Item 0');
    expect(list().scrollTop).toBe(0);
    await user.keyboard('{PageDown}{PageDown}');
    // Ten options a page, over the options only.
    expect(active()).toHaveAccessibleName('Item 20');
    await user.keyboard('Item 3333');
    expect(active()).toHaveAccessibleName('Item 3333');
    expect(list()).toContainElement(active());
    const group = (active() as HTMLElement).closest('[role="group"]');
    expect(group).toHaveAccessibleName(`Group ${Math.floor(3333 / PER_GROUP)}`);
    expect(rowsOf().length).toBeLessThanOrEqual(30);
  });

  it('keeps the active option rendered, in a group element of its own, when scrolled away', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedGroups defaultValue="g40-7" />);
    await user.tab();
    const kept = active();
    expect(kept).toHaveAccessibleName('Item 2007');
    scrollList(list(), 100 * ITEM_SIZE);
    expect(active()).toBe(kept);
    expect(kept).toBeInTheDocument();
    expect(kept?.closest('[role="group"]')).toHaveAccessibleName('Group 40');
    // Between spacers, in a partial group: no header, same name, same position in the group.
    expect(kept).toHaveAttribute('aria-posinset', '8');
    expect(kept).toHaveAttribute('aria-setsize', String(PER_GROUP));
    expect(rowsOf().length).toBeLessThanOrEqual(31);
  });

  it('focuses the selected option deep in the list and renders it', async () => {
    const user = userEvent.setup();
    render(<WindowedGroups defaultValue="g70-33" />);
    await user.tab();
    expect(active()).toHaveAccessibleName('Item 3533');
    expect(list()).toContainElement(active());
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(30);
  });

  it('has no axe violations in the middle of the list, with no dangling id', async () => {
    const user = userEvent.setup();
    render(<WindowedGroups defaultValue="g40-7" />);
    await user.tab();
    scrollList(list(), 100 * ITEM_SIZE);
    await expectNoA11yViolations();
  });

  it('renders the first window and its groups on the server, with no dangling id', () => {
    const Server = () => <WindowedGroups />;
    const html = renderToString(<Server />);
    expect(html).toContain('aria-label="Group 0"');
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);
  });

  it('mirrors in right-to-left layouts', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<WindowedGroups />, { dir: 'rtl' });
    await user.tab();
    await user.keyboard('{ArrowDown}'.repeat(PER_GROUP + 1));
    expect(active()).toHaveAccessibleName('Item 51');
    expect(list().closest('[dir="rtl"]')).not.toBeNull();
  });

  it('keeps its ungrouped options between groups in the window', () => {
    function Mixed() {
      const virtualWindow = useTestWindow();
      const items: ListboxItem[] = [
        ...Array.from({ length: 3 }, (_, i) => ({ value: `a${i}`, label: `A ${i}`, group: 'A' })),
        { value: 'loose', label: 'Loose' },
        ...Array.from({ length: 3 }, (_, i) => ({ value: `b${i}`, label: `B ${i}`, group: 'B' })),
      ];
      return <Listbox aria-label="Items" items={items} virtualWindow={virtualWindow} />;
    }
    render(<Mixed />);
    expect(optionLabels(list())).toEqual(['A 0', 'A 1', 'A 2', 'Loose', 'B 0', 'B 1', 'B 2']);
    expect(screen.getByRole('option', { name: 'Loose' }).parentElement).toBe(list());
    expect(screen.getByRole('option', { name: 'Loose' })).toHaveAttribute('aria-setsize', '1');
    expect(list().querySelector('[data-virtual-spacer]')).toBeNull();
  });

  it('makes one scroll request for an option inside a group, and two for the first of one', async () => {
    const user = userEvent.setup({ delay: null });
    const onScrollToIndex = vi.fn();
    render(<WindowedGroups windowOptions={{ onScrollToIndex, keep: false }} />);
    await user.tab();
    // Focus: Item 0 opens Group 0 (its header is row 0, the option row 1).
    expect(onScrollToIndex.mock.calls).toEqual([
      [0, { align: 'auto' }],
      [1, { align: 'auto' }],
    ]);
    onScrollToIndex.mockClear();
    await user.keyboard('{ArrowDown}');
    expect(onScrollToIndex.mock.calls).toEqual([[2, { align: 'auto' }]]);
  });
});

describe('Listbox option groups in a window that measures its rows', () => {
  let ro: ResizeObserverMock;

  beforeEach(() => {
    ro = installResizeObserverMock();
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      return this.getAttribute('role') === 'listbox' ? 250 : 0;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const index = this.getAttribute('data-virtual-index');
      return new DOMRect(
        0,
        0,
        200,
        index === null ? 0 : this.hasAttribute('data-group-header') ? 24 : 48,
      );
    });
  });

  afterEach(() => {
    ro.restore();
    vi.restoreAllMocks();
  });

  function MeasuredGroups() {
    const virtualWindow = useVirtualWindow({ itemSize: 40, measureItems: true });
    return <Listbox aria-label="Items" items={GROUPED_ITEMS} virtualWindow={virtualWindow} />;
  }

  it('measures headers and options as rows of their own, found by the window', () => {
    render(<MeasuredGroups />);
    const header = list().querySelector('[data-group-header]') as HTMLElement;
    expect(header).toHaveAttribute('data-virtual-index', '0');
    expect(header.style.height).toBe('');
    const options = screen.getAllByRole('option');
    // Row indexes count the headers: the first option is row 1.
    expect(options[0]).toHaveAttribute('data-virtual-index', '1');
    expect(options[1]).toHaveAttribute('data-virtual-index', '2');
    // The positions still count the options of the group.
    expect(options[1]).toHaveAttribute('aria-posinset', '2');
    expect(options[1]).toHaveAttribute('aria-setsize', String(PER_GROUP));
    act(() => {});
  });
});

describe('Listbox groups do not change the OptionGroup children form', () => {
  it('renders OptionGroup children as before', () => {
    render(
      <Listbox aria-label="Items">
        <OptionGroup label="Fruit">
          <Option value="a">Apple</Option>
        </OptionGroup>
      </Listbox>,
    );
    expect(screen.getByRole('group', { name: 'Fruit' })).toBeInTheDocument();
    expect(list().querySelector('[data-group-header]')).toBeNull();
  });
});
