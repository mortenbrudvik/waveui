import * as React from 'react';
import { describe, it, expect, vi, afterEach, expectTypeOf } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { MenuItemCheckbox, MenuItemRadio, MenuItemSwitch } from '../Menu.selectable';
import type {
  MenuItemCheckboxProps,
  MenuItemRadioProps,
  MenuItemSelectableProps,
  MenuItemSwitchProps,
} from '../Menu.selectable';
import { MenuItem } from '../Menu.items';
import type { MenuItemProps } from '../Menu.items';
import { INERT_MENU_CONTEXT, MenuContext } from '../Menu.context';
import { Menu } from '../Menu';
import { useMenuListContext } from '../Menu.hooks';
import type { MenuListContextValue } from '../Menu.hooks';
import type { CheckedValues, CheckedValuesChangeDetails, Slot } from '../../../lib/types';
import {
  menuItemCheckboxClassNames,
  menuItemClassNames,
  menuItemRadioClassNames,
  menuItemSwitchClassNames,
} from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  expectThrows,
  openingTags,
  testSystemProps,
} from '../../../test-utils';
import { MenuListHarness, renderInMenuList } from './menuHarness';

afterEach(() => {
  vi.restoreAllMocks();
});

const checkbox = (name: string) => screen.getByRole('menuitemcheckbox', { name });
const radio = (name: string) => screen.getByRole('menuitemradio', { name });

const CHECKMARK_SPACE =
  'wave:hidden wave:w-4 wave:shrink-0 wave:group-has-[[data-menu-checkmark]]/menu:inline-flex';

function Harness({ children }: { children: React.ReactNode }) {
  return <MenuListHarness>{children}</MenuListHarness>;
}

/** What each child element of a row is: its column marker, else its text. */
function describeRow(row: Element): string[] {
  return Array.from(row.children).map((child) => {
    if (child.hasAttribute('data-menu-column-space')) {
      return `space:${child.getAttribute('data-menu-column-space')}`;
    }
    if (child.hasAttribute('data-menu-checkmark')) return 'checkmark';
    if (child.hasAttribute('data-menu-icon')) return 'icon';
    if (child.hasAttribute('data-menu-switch')) return 'switch';
    return `text:${child.textContent}`;
  });
}

type Kind = 'checkbox' | 'radio' | 'switch';

/** The three kinds: their role, and the component (typed by the props all three share). */
const KINDS: Array<[Kind, string, React.ComponentType<MenuItemSwitchProps>]> = [
  ['checkbox', 'menuitemcheckbox', MenuItemCheckbox],
  ['radio', 'menuitemradio', MenuItemRadio],
  ['switch', 'menuitemcheckbox', MenuItemSwitch],
];

describe('roles and the checked state', () => {
  it.each(KINDS)(
    '%s: role %s, aria-checked always rendered and data-checked only while checked',
    (_kind, role, Item) => {
      renderInMenuList(
        <>
          <Item name="view" value="ruler">
            Ruler
          </Item>
          <Item name="view" value="grid">
            Grid
          </Item>
        </>,
        { defaultCheckedValues: { view: ['grid'] } },
      );
      const unchecked = screen.getByRole(role, { name: 'Ruler' });
      const checked = screen.getByRole(role, { name: 'Grid' });
      expect(unchecked).toHaveAttribute('aria-checked', 'false');
      expect(unchecked).not.toHaveAttribute('data-checked');
      expect(checked).toHaveAttribute('aria-checked', 'true');
      expect(checked).toHaveAttribute('data-checked', '');
      expect(checked).toHaveAttribute('data-roving-text', 'Grid');
      expect(checked.tagName).toBe('DIV');
    },
  );

  it.each(KINDS)(
    '%s: a consumer aria-checked or data-checked cannot contradict the state',
    (_k, role, Item) => {
      renderInMenuList(
        <>
          <Item name="view" value="ruler" aria-checked="true" data-checked="">
            Ruler
          </Item>
          <Item name="view" value="grid" aria-checked="false">
            Grid
          </Item>
        </>,
        { defaultCheckedValues: { view: ['grid'] } },
      );
      expect(screen.getByRole(role, { name: 'Ruler' })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole(role, { name: 'Ruler' })).not.toHaveAttribute('data-checked');
      expect(screen.getByRole(role, { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
    },
  );

  it.each(KINDS)('%s: a consumer role wins, as on Menu.Item', (_k, _role, Item) => {
    renderInMenuList(
      <Item name="view" value="ruler" role="menuitemradio">
        Ruler
      </Item>,
    );
    expect(radio('Ruler')).toHaveAttribute('aria-checked', 'false');
  });

  it.each(KINDS)('%s: disabled renders aria-disabled and data-disabled', (_k, role, Item) => {
    renderInMenuList(
      <Item name="view" value="ruler" disabled>
        Ruler
      </Item>,
      { defaultCheckedValues: { view: ['ruler'] } },
    );
    const item = screen.getByRole(role, { name: 'Ruler' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute('data-disabled', '');
    // A disabled item still shows its state.
    expect(item).toHaveAttribute('aria-checked', 'true');
  });

  it('throws outside a Menu in development', () => {
    expectThrows(
      <MenuItemCheckbox name="view" value="ruler">
        Ruler
      </MenuItemCheckbox>,
      '[WaveUI] Menu.ItemCheckbox must be used within Menu',
    );
    expectThrows(
      <MenuItemRadio name="sort" value="date">
        Date
      </MenuItemRadio>,
      '[WaveUI] Menu.ItemRadio must be used within Menu',
    );
    expectThrows(
      <MenuItemSwitch name="view" value="grid">
        Grid
      </MenuItemSwitch>,
      '[WaveUI] Menu.ItemSwitch must be used within Menu',
    );
  });

  it.each([
    ['Menu.ItemCheckbox', MenuItemCheckbox],
    ['Menu.ItemRadio', MenuItemRadio],
    ['Menu.ItemSwitch', MenuItemSwitch],
  ] as const)(
    '%s in a popup menu outside Menu.Popover warns that it has no role="menu" parent',
    (componentName, Item) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <MenuContext.Provider value={{ ...INERT_MENU_CONTEXT, popup: true }}>
          <Item name="view" value="grid">
            Grid
          </Item>
        </MenuContext.Provider>,
      );
      expect(warn.mock.calls).toEqual([
        [
          `[WaveUI] ${componentName}: rendered in a popup menu outside Menu.Popover, so it has no \`role="menu"\` parent. A Menu with \`open\`, \`defaultOpen\` or \`onOpenChange\` is a popup menu that renders no element of its own: put the items in Menu.Popover, or leave these props out for a static menu.`,
        ],
      ]);
    },
  );
});

describe('checked values', () => {
  it('uncontrolled: a click toggles a checkbox item and reports { name, checkedItems, event }', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    let clickEvent: Event | undefined;
    renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="ruler">
          Ruler
        </MenuItemCheckbox>
        <MenuItemCheckbox
          name="view"
          value="grid"
          onClick={(event) => {
            clickEvent = event.nativeEvent;
          }}
        >
          Grid
        </MenuItemCheckbox>
      </>,
      { defaultCheckedValues: { view: ['ruler'] }, onCheckedValuesChange },
    );
    await user.click(checkbox('Grid'));
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    const [values, details] = onCheckedValuesChange.mock.calls[0] as [
      Record<string, string[]>,
      CheckedValuesChangeDetails,
    ];
    expect(values).toEqual({ view: ['ruler', 'grid'] });
    expect(details).toEqual({ name: 'view', checkedItems: ['ruler', 'grid'], event: clickEvent });
    expect(details.event).toBeInstanceOf(MouseEvent);
    expect(details.event.type).toBe('click');
    expect(details.checkedItems).toBe(values.view);

    await user.click(checkbox('Ruler'));
    expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedValuesChange).toHaveBeenLastCalledWith(
      { view: ['grid'] },
      expect.objectContaining({ name: 'view', checkedItems: ['grid'] }),
    );
  });

  it('a group name that is an Object.prototype key ("__proto__") works like any other', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    renderInMenuList(
      <MenuItemCheckbox name="__proto__" value="ruler">
        Ruler
      </MenuItemCheckbox>,
      { onCheckedValuesChange },
    );
    expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'false');
    await user.click(checkbox('Ruler'));
    expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'true');
    const [values, details] = onCheckedValuesChange.mock.calls[0] as [
      CheckedValues,
      CheckedValuesChangeDetails,
    ];
    // An own group, not the object's prototype.
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
    expect(Object.entries(values)).toEqual([['__proto__', ['ruler']]]);
    expect(details).toEqual(
      expect.objectContaining({ name: '__proto__', checkedItems: ['ruler'] }),
    );
  });

  it('a radio item is checked while its value is in the group; checking one makes it the only value', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    renderInMenuList(
      <>
        <MenuItemRadio name="sort" value="name">
          Name
        </MenuItemRadio>
        <MenuItemRadio name="sort" value="date">
          Date
        </MenuItemRadio>
      </>,
      { defaultCheckedValues: { sort: ['name', 'date'] }, onCheckedValuesChange },
    );
    // A radio group should hold one value; one that holds several shows each of them checked.
    expect(radio('Name')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
    await user.click(radio('Name'));
    expect(radio('Name')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedValuesChange.mock.calls.map(([values]) => values)).toEqual([
      { sort: ['name'] },
    ]);
  });

  it('a switch item toggles like a checkbox item', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    renderInMenuList(
      <MenuItemSwitch name="view" value="grid">
        Grid
      </MenuItemSwitch>,
      { onCheckedValuesChange },
    );
    await user.click(checkbox('Grid'));
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedValuesChange).toHaveBeenCalledWith(
      { view: ['grid'] },
      expect.objectContaining({ name: 'view', checkedItems: ['grid'] }),
    );
    await user.click(checkbox('Grid'));
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(2);
  });

  it('controlled: a parent that ignores the callback keeps its value', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="grid">
          Grid
        </MenuItemCheckbox>
        <MenuItemRadio name="sort" value="date">
          Date
        </MenuItemRadio>
      </>,
      { checkedValues: { view: ['grid'], sort: [] }, onCheckedValuesChange },
    );
    await user.click(checkbox('Grid'));
    expect(onCheckedValuesChange).toHaveBeenCalledWith(
      { view: [], sort: [] },
      expect.objectContaining({ name: 'view', checkedItems: [] }),
    );
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
    await user.click(radio('Date'));
    expect(radio('Date')).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(2);
    expect(closeFromItem).toHaveBeenCalledTimes(2);
  });

  it('controlled: the rendered state follows the prop', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [values, setValues] = React.useState<CheckedValues>({ view: ['ruler'] });
      return (
        <>
          <button type="button" onClick={() => setValues({ view: ['grid'] })}>
            Only grid
          </button>
          <MenuListHarness checkedValues={values} onCheckedValuesChange={setValues}>
            <MenuItemCheckbox name="view" value="ruler">
              Ruler
            </MenuItemCheckbox>
            <MenuItemCheckbox name="view" value="grid">
              Grid
            </MenuItemCheckbox>
          </MenuListHarness>
        </>
      );
    }
    render(<Controlled />);
    expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Only grid' }));
    expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'false');
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox('Ruler'));
    expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'true');
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedValuesChange once per change in StrictMode', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    render(
      <React.StrictMode>
        <MenuListHarness onCheckedValuesChange={onCheckedValuesChange}>
          <MenuItemCheckbox name="view" value="grid">
            Grid
          </MenuItemCheckbox>
          <MenuItemRadio name="sort" value="date">
            Date
          </MenuItemRadio>
        </MenuListHarness>
      </React.StrictMode>,
    );
    await user.click(checkbox('Grid'));
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    await user.click(radio('Date'));
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(2);
    expect(onCheckedValuesChange).toHaveBeenLastCalledWith(
      { view: ['grid'], sort: ['date'] },
      expect.objectContaining({ name: 'sort', checkedItems: ['date'] }),
    );
  });

  it('radio items are exclusive per name; two radio groups side by side stay independent', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    renderInMenuList(
      <>
        <MenuItemRadio name="sort" value="name">
          Name
        </MenuItemRadio>
        <MenuItemRadio name="sort" value="date">
          Date
        </MenuItemRadio>
        <MenuItemRadio name="order" value="asc">
          Ascending
        </MenuItemRadio>
        <MenuItemRadio name="order" value="desc">
          Descending
        </MenuItemRadio>
      </>,
      { defaultCheckedValues: { sort: ['name'], order: ['asc'] }, onCheckedValuesChange },
    );
    await user.click(radio('Date'));
    expect(radio('Name')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Ascending')).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedValuesChange).toHaveBeenLastCalledWith(
      { sort: ['date'], order: ['asc'] },
      expect.objectContaining({ name: 'sort', checkedItems: ['date'] }),
    );
    await user.click(radio('Descending'));
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Descending')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Ascending')).toHaveAttribute('aria-checked', 'false');
  });

  it('re-selecting a checked radio item changes nothing and still closes the menu on a click and Enter', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <MenuItemRadio name="sort" value="date">
        Date
      </MenuItemRadio>,
      { defaultCheckedValues: { sort: ['date'] }, onCheckedValuesChange },
    );
    await user.click(radio('Date'));
    expect(closeFromItem).toHaveBeenCalledTimes(1);
    act(() => radio('Date').focus());
    await user.keyboard('{Enter}');
    expect(closeFromItem).toHaveBeenCalledTimes(2);
    await user.keyboard(' ');
    expect(closeFromItem).toHaveBeenCalledTimes(2);
    expect(onCheckedValuesChange).not.toHaveBeenCalled();
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('activation in a popover list', () => {
  it.each(KINDS)('%s: Space changes the state and keeps the menu open', async (_k, role, Item) => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <Item name="view" value="grid">
        Grid
      </Item>,
      { onCheckedValuesChange },
    );
    const item = screen.getByRole(role, { name: 'Grid' });
    act(() => item.focus());
    await user.keyboard(' ');
    expect(item).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    expect(closeFromItem).not.toHaveBeenCalled();
    expect(item).toHaveFocus();
  });

  it('Space is consumed (no page scroll), and its click event is the details event', () => {
    const onCheckedValuesChange = vi.fn();
    renderInMenuList(
      <MenuItemCheckbox name="view" value="grid">
        Grid
      </MenuItemCheckbox>,
      { onCheckedValuesChange },
    );
    expect(fireEvent.keyDown(checkbox('Grid'), { key: ' ' })).toBe(false);
    const [, details] = onCheckedValuesChange.mock.calls[0] as [
      unknown,
      CheckedValuesChangeDetails,
    ];
    expect(details.event).toBeInstanceOf(MouseEvent);
    expect(details.event.type).toBe('click');
  });

  it.each(KINDS)(
    '%s: Enter and a click change the state and close the menu once each',
    async (_k, role, Item) => {
      const user = userEvent.setup();
      const { closeFromItem } = renderInMenuList(
        <Item name="view" value="grid">
          Grid
        </Item>,
      );
      const item = screen.getByRole(role, { name: 'Grid' });
      act(() => item.focus());
      await user.keyboard('{Enter}');
      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(closeFromItem).toHaveBeenCalledTimes(1);
      await user.click(item);
      expect(item).toHaveAttribute('aria-checked', kindOfRole(role) === 'radio' ? 'true' : 'false');
      expect(closeFromItem).toHaveBeenCalledTimes(2);
    },
  );

  it('persistOnClick on the item and persistOnItemClick on the Menu keep the menu open', async () => {
    const user = userEvent.setup();
    const first = renderInMenuList(
      <MenuItemCheckbox name="view" value="grid" persistOnClick>
        Grid
      </MenuItemCheckbox>,
    );
    await user.click(checkbox('Grid'));
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
    expect(first.closeFromItem).not.toHaveBeenCalled();
    first.unmount();

    const second = renderInMenuList(
      <>
        <MenuItemRadio name="sort" value="date">
          Date
        </MenuItemRadio>
        <MenuItemSwitch name="view" value="grid">
          Grid
        </MenuItemSwitch>
      </>,
      { persistOnItemClick: true },
    );
    await user.click(radio('Date'));
    act(() => checkbox('Grid').focus());
    await user.keyboard('{Enter}');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
    expect(second.closeFromItem).not.toHaveBeenCalled();
  });

  it("an item's persistOnClick={false} beats the Menu's persistOnItemClick", async () => {
    const user = userEvent.setup();
    const { closeFromItem } = renderInMenuList(
      <MenuItemCheckbox name="view" value="grid" persistOnClick={false}>
        Grid
      </MenuItemCheckbox>,
      { persistOnItemClick: true },
    );
    await user.click(checkbox('Grid'));
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('a consumer onClick that prevents the default changes nothing and does not close', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    const { closeFromItem } = renderInMenuList(
      <MenuItemCheckbox name="view" value="grid" onClick={onClick}>
        Grid
      </MenuItemCheckbox>,
      { onCheckedValuesChange },
    );
    await user.click(checkbox('Grid'));
    act(() => checkbox('Grid').focus());
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedValuesChange).not.toHaveBeenCalled();
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('a consumer onKeyDown runs first, and its preventDefault() skips the activation', () => {
    const onCheckedValuesChange = vi.fn();
    const calls: string[] = [];
    renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="grid" onKeyDown={() => calls.push('onKeyDown')}>
          Grid
        </MenuItemCheckbox>
        <MenuItemCheckbox name="view" value="ruler" onKeyDown={(event) => event.preventDefault()}>
          Ruler
        </MenuItemCheckbox>
      </>,
      { onCheckedValuesChange },
    );
    fireEvent.keyDown(checkbox('Grid'), { key: ' ' });
    expect(calls).toEqual(['onKeyDown']);
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(checkbox('Ruler'), { key: ' ' });
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'false');
  });

  it.each(KINDS)(
    '%s: a disabled item never changes and calls no onClick',
    async (_k, role, Item) => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      const onClick = vi.fn();
      const { closeFromItem } = renderInMenuList(
        <Item name="view" value="grid" disabled onClick={onClick}>
          Grid
        </Item>,
        { onCheckedValuesChange },
      );
      const item = screen.getByRole(role, { name: 'Grid' });
      await user.click(item);
      expect(fireEvent.keyDown(item, { key: 'Enter' })).toBe(false);
      expect(fireEvent.keyDown(item, { key: ' ' })).toBe(false);
      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(onClick).not.toHaveBeenCalled();
      expect(onCheckedValuesChange).not.toHaveBeenCalled();
      expect(closeFromItem).not.toHaveBeenCalled();
    },
  );

  it('in a static list activation changes the state and closes nothing', async () => {
    const user = userEvent.setup();
    const { closeFromItem } = renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="grid">
          Grid
        </MenuItemCheckbox>
        <MenuItemRadio name="sort" value="date">
          Date
        </MenuItemRadio>
      </>,
      { isStatic: true },
    );
    await user.click(checkbox('Grid'));
    act(() => radio('Date').focus());
    await user.keyboard('{Enter}');
    expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('the arrow keys, Home and End move between checkable items and skip disabled ones', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="ruler">
          Ruler
        </MenuItemCheckbox>
        <MenuItemSwitch name="view" value="grid" disabled>
          Grid
        </MenuItemSwitch>
        <MenuItemRadio name="sort" value="date">
          Date
        </MenuItemRadio>
        <MenuItem>Refresh</MenuItem>
      </>,
    );
    await user.tab();
    expect(checkbox('Ruler')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(radio('Date')).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Refresh' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(checkbox('Ruler')).toHaveFocus();
  });

  it('typeahead matches the label, not the glyph', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="grid">
          Grid
        </MenuItemCheckbox>
        <MenuItemCheckbox name="view" value="ruler" checkmark="x">
          Ruler
        </MenuItemCheckbox>
        <MenuItemCheckbox name="view" value="xray">
          X-ray
        </MenuItemCheckbox>
      </>,
      { defaultCheckedValues: { view: ['ruler'] } },
    );
    expect(checkbox('Ruler')).toHaveAttribute('data-roving-text', 'Ruler');
    await user.tab();
    expect(checkbox('Grid')).toHaveFocus();
    // The checked Ruler item shows "x" as its glyph: typeahead passes it for the X-ray label.
    await user.keyboard('x');
    expect(checkbox('X-ray')).toHaveFocus();
  });

  it('typeahead reads a non-string label through its text', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="grid">
          Grid
        </MenuItemCheckbox>
        <MenuItemRadio name="sort" value="size">
          <span>Size</span>
        </MenuItemRadio>
      </>,
    );
    await user.tab();
    await user.keyboard('s');
    expect(radio('Size')).toHaveFocus();
  });
});

function kindOfRole(role: string): Kind {
  return role === 'menuitemradio' ? 'radio' : 'checkbox';
}

describe('the check column', () => {
  it('a checked item shows the 16px check glyph, an unchecked one an empty column; a plain item keeps the placeholder', () => {
    renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="ruler">
          Ruler
        </MenuItemCheckbox>
        <MenuItemCheckbox name="view" value="grid">
          Grid
        </MenuItemCheckbox>
        <MenuItem>Refresh</MenuItem>
      </>,
      { defaultCheckedValues: { view: ['ruler'] } },
    );
    const checked = checkbox('Ruler');
    expect(describeRow(checked)).toEqual(['checkmark', 'space:icon', 'text:Ruler']);
    const column = checked.querySelector('[data-menu-checkmark]');
    expect(column).toHaveAttribute('aria-hidden', 'true');
    const glyph = column?.firstElementChild;
    expect(glyph).toHaveAttribute('data-wave-icon', 'check');
    expect(glyph).toHaveAttribute('width', '16');
    expect(glyph).toHaveAttribute('stroke', 'currentColor');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');

    const unchecked = checkbox('Grid');
    expect(describeRow(unchecked)).toEqual(['checkmark', 'space:icon', 'text:Grid']);
    expect(unchecked.querySelector('[data-menu-checkmark]')).toBeEmptyDOMElement();

    const plain = screen.getByRole('menuitem', { name: 'Refresh' });
    expect(describeRow(plain)).toEqual(['space:checkmark', 'space:icon', 'text:Refresh']);
    expect(plain.children[0]).toHaveClass(...CHECKMARK_SPACE.split(' '));
  });

  it('a radio item shows the check glyph too', () => {
    renderInMenuList(
      <MenuItemRadio name="sort" value="date">
        Date
      </MenuItemRadio>,
      { defaultCheckedValues: { sort: ['date'] } },
    );
    expect(
      radio('Date').querySelector('[data-menu-checkmark] [data-wave-icon="check"]'),
    ).not.toBeNull();
  });

  it('an item with an icon and a shortcut keeps the row order', () => {
    renderInMenuList(
      <MenuItemCheckbox name="view" value="ruler" icon={{ children: 'R' }} shortcut="Ctrl+R">
        Ruler
      </MenuItemCheckbox>,
      { defaultCheckedValues: { view: ['ruler'] } },
    );
    // The shortcut is part of the row's text (jsdom names the row "RulerCtrl+R", as for Menu.Item).
    const row = screen.getByRole('menuitemcheckbox');
    expect(describeRow(row)).toEqual(['checkmark', 'icon', 'text:Ruler', 'text:Ctrl+R']);
    expect(row).toHaveAttribute('data-roving-text', 'Ruler');
  });

  it('a switch item renders the checkmark placeholder and the switch at the row end', () => {
    renderInMenuList(
      <MenuItemSwitch name="view" value="grid" shortcut="Ctrl+G">
        Grid
      </MenuItemSwitch>,
    );
    const row = screen.getByRole('menuitemcheckbox');
    expect(describeRow(row)).toEqual([
      'space:checkmark',
      'space:icon',
      'text:Grid',
      'text:Ctrl+G',
      'switch',
    ]);
    // The switch is decorative: it adds nothing to the name.
    expect(row.querySelector('[data-menu-switch]')).toHaveAttribute('aria-hidden', 'true');
    expect(row).toHaveAccessibleName('GridCtrl+G');
  });

  it.each([
    ['Menu.ItemCheckbox', MenuItemCheckbox],
    ['Menu.ItemRadio', MenuItemRadio],
  ] as const)(
    '%s: the checkmark slot replaces the glyph (decorative) while checked',
    (_n, Item) => {
      renderInMenuList(
        <>
          <Item name="view" value="ruler" checkmark={<svg data-testid="custom" />}>
            Ruler
          </Item>
          <Item name="view" value="grid" checkmark={{ className: 'text-primary', children: '•' }}>
            Grid
          </Item>
          <Item name="other" value="off" checkmark={<svg data-testid="unchecked-custom" />}>
            Off
          </Item>
        </>,
        { defaultCheckedValues: { view: ['ruler', 'grid'] } },
      );
      const custom = screen.getByTestId('custom');
      expect(custom.closest('[data-menu-checkmark]')).not.toBeNull();
      expect(custom.parentElement).toHaveAttribute('aria-hidden', 'true');
      const slotObject = screen.getByText('•');
      expect(slotObject.tagName).toBe('SPAN');
      expect(slotObject).toHaveClass('text-primary');
      expect(slotObject).toHaveAttribute('aria-hidden', 'true');
      expect(document.querySelector('[data-wave-icon="check"]')).toBeNull();
      expect(screen.queryByTestId('unchecked-custom')).toBeNull();
    },
  );

  it.each([
    ['Menu.ItemCheckbox', MenuItemCheckbox],
    ['Menu.ItemRadio', MenuItemRadio],
  ] as const)('%s: null and undefined keep the default glyph without a warning', (_n, Item) => {
    const warn = vi.spyOn(console, 'warn');
    renderInMenuList(
      <>
        <Item name="view" value="ruler" checkmark={null}>
          Ruler
        </Item>
        <Item name="view" value="grid" checkmark={undefined}>
          Grid
        </Item>
      </>,
      { defaultCheckedValues: { view: ['ruler', 'grid'] } },
    );
    expect(
      document.querySelectorAll('[data-menu-checkmark] [data-wave-icon="check"]'),
    ).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['Menu.ItemCheckbox', MenuItemCheckbox, false],
    ['Menu.ItemCheckbox', MenuItemCheckbox, ''],
    ['Menu.ItemCheckbox', MenuItemCheckbox, []],
    ['Menu.ItemRadio', MenuItemRadio, <></>],
    ['Menu.ItemRadio', MenuItemRadio, [null, false]],
  ] as const)(
    '%s: a checkmark that renders nothing (%#) keeps the default glyph and warns once',
    (componentName, Item, value) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderInMenuList(
        <>
          <Item name="view" value="ruler" checkmark={value as Slot<'span'>}>
            Ruler
          </Item>
          <Item name="view" value="grid" checkmark={value as Slot<'span'>}>
            Grid
          </Item>
        </>,
        { defaultCheckedValues: { view: ['ruler'] } },
      );
      expect(
        document.querySelectorAll('[data-menu-checkmark] [data-wave-icon="check"]'),
      ).toHaveLength(1);
      expect(warn.mock.calls).toEqual([
        [
          `[WaveUI] ${componentName}: \`checkmark\` renders nothing, so the item shows the default check glyph. A checked item always shows an indicator: pass an icon, or leave \`checkmark\` unset.`,
        ],
      ]);
    },
  );
});

describe('the switch indicator', () => {
  const TRACK =
    'wave:relative wave:inline-flex wave:h-[16px] wave:w-[32px] wave:shrink-0 wave:items-center wave:rounded-full wave:border wave:transition-colors wave:duration-200 wave:motion-reduce:transition-none';
  const THUMB =
    'wave:block wave:h-[10px] wave:w-[10px] wave:rounded-full wave:transition-transform wave:duration-200 wave:motion-reduce:transition-none wave:forced-colors:forced-color-adjust-none';

  function renderSwitches(options: { rtl?: boolean } = {}) {
    renderInMenuList(
      <>
        <MenuItemSwitch name="view" value="on">
          On
        </MenuItemSwitch>
        <MenuItemSwitch name="view" value="off">
          Off
        </MenuItemSwitch>
        <MenuItemSwitch name="view" value="on-disabled" disabled>
          On disabled
        </MenuItemSwitch>
        <MenuItemSwitch name="view" value="off-disabled" disabled>
          Off disabled
        </MenuItemSwitch>
      </>,
      {
        defaultCheckedValues: { view: ['on', 'on-disabled'] },
        dir: options.rtl ? 'rtl' : undefined,
      },
    );
    const parts = (name: string) => {
      const track = checkbox(name).querySelector('[data-menu-switch]');
      return { track, thumb: track?.firstElementChild };
    };
    return parts;
  }

  it('is a decorative 32x16 track with a 10px thumb in the checked and the unchecked state', () => {
    const parts = renderSwitches();
    const on = parts('On');
    expect(on.track).toHaveAttribute('aria-hidden', 'true');
    expect(on.track).toHaveClass(...TRACK.split(' '), 'wave:border-primary', 'wave:bg-primary');
    expect(on.thumb).toHaveClass(
      ...THUMB.split(' '),
      'wave:translate-x-[18px]',
      'wave:wave-rtl:-translate-x-[18px]',
      'wave:bg-primary-foreground',
    );
    const off = parts('Off');
    expect(off.track).toHaveClass(
      ...TRACK.split(' '),
      'wave:border-stroke-accessible',
      'wave:bg-transparent',
    );
    expect(off.track).not.toHaveClass('wave:bg-primary');
    expect(off.thumb).toHaveClass(
      ...THUMB.split(' '),
      'wave:translate-x-[2px]',
      'wave:wave-rtl:-translate-x-[2px]',
      'wave:bg-stroke-accessible',
    );
  });

  it('uses the forced-colors recipe of Switch', () => {
    const parts = renderSwitches();
    expect(parts('On').track).toHaveClass(
      'wave:forced-colors:border-[Highlight]',
      'wave:forced-colors:bg-[Highlight]',
    );
    expect(parts('On').thumb).toHaveClass('wave:forced-colors:bg-[HighlightText]');
    expect(parts('Off').track).toHaveClass('wave:forced-colors:border-[ButtonText]');
    expect(parts('Off').thumb).toHaveClass('wave:forced-colors:bg-[ButtonText]');
    expect(parts('On disabled').track).toHaveClass(
      'wave:forced-colors:border-[GrayText]',
      'wave:forced-colors:bg-[Canvas]',
    );
    expect(parts('On disabled').thumb).toHaveClass('wave:forced-colors:bg-[GrayText]');
    expect(parts('Off disabled').track).toHaveClass(
      'wave:forced-colors:text-[GrayText]',
      'wave:forced-colors:border-[GrayText]',
    );
    expect(parts('Off disabled').thumb).toHaveClass('wave:forced-colors:bg-[GrayText]');
  });

  it('follows the checked state', async () => {
    const user = userEvent.setup();
    const parts = renderSwitches();
    await user.click(checkbox('Off'));
    expect(parts('Off').track).toHaveClass('wave:bg-primary');
    expect(parts('Off').thumb).toHaveClass('wave:translate-x-[18px]');
  });

  it('keeps the logical row and the wave-rtl: thumb classes in RTL', () => {
    const parts = renderSwitches({ rtl: true });
    expect(checkbox('On').closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(describeRow(checkbox('On'))).toEqual([
      'space:checkmark',
      'space:icon',
      'text:On',
      'switch',
    ]);
    expect(parts('On').thumb).toHaveClass('wave:wave-rtl:-translate-x-[18px]');
    expect(parts('Off').thumb).toHaveClass('wave:wave-rtl:-translate-x-[2px]');
  });
});

describe('the duplicate name and value warning', () => {
  it('warns once for two checkable items with the same name and value in one list', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderInMenuList(
      <>
        <MenuItemCheckbox name="sort" value="date">
          Date
        </MenuItemCheckbox>
        <MenuItemRadio name="sort" value="date">
          Date again
        </MenuItemRadio>
        <MenuItemSwitch name="sort" value="name">
          Name
        </MenuItemSwitch>
      </>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Menu: two checkable items of one menu list have the name "sort" and the value "date", so both show as checked. Give every item of a group its own value.',
      ],
    ]);
  });

  it('does not warn when an item changes its value or is replaced', async () => {
    const warn = vi.spyOn(console, 'warn');
    const { rerender } = renderInMenuList(
      <MenuItemCheckbox name="sort" value="date">
        Date
      </MenuItemCheckbox>,
    );
    // The list's roving hook observes the changed items (a MutationObserver): let it settle.
    rerender(
      <MenuItemCheckbox name="sort" value="name">
        Name
      </MenuItemCheckbox>,
    );
    await act(async () => {});
    rerender(
      <MenuItemRadio name="sort" value="date">
        Date
      </MenuItemRadio>,
    );
    await act(async () => {});
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('server rendering', () => {
  it('renders aria-checked and the glyph from defaultCheckedValues and hydrates without warnings', async () => {
    const tree = (
      <MenuListHarness isStatic defaultCheckedValues={{ view: ['ruler'], sort: ['date'] }}>
        <MenuItemCheckbox name="view" value="ruler">
          Ruler
        </MenuItemCheckbox>
        <MenuItemSwitch name="view" value="grid">
          Grid
        </MenuItemSwitch>
        <MenuItemRadio name="sort" value="date">
          Date
        </MenuItemRadio>
      </MenuListHarness>
    );
    const html = renderToString(tree);
    expect(html).toMatch(/role="menuitemcheckbox"[^>]*aria-checked="true"[^>]*data-checked=""/);
    expect(html).toMatch(/role="menuitemradio"[^>]*aria-checked="true"/);
    expect(html.match(/data-wave-icon="check"/g)).toHaveLength(2);
    expect(html).toContain('data-menu-switch=""');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(checkbox('Ruler')).toHaveAttribute('aria-checked', 'true');
      expect(checkbox('Grid')).toHaveAttribute('aria-checked', 'false');
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe('accessibility', () => {
  const items = (
    <>
      <MenuItemCheckbox name="view" value="ruler" shortcut="Ctrl+R">
        Ruler
      </MenuItemCheckbox>
      <MenuItemCheckbox name="view" value="grid" disabled>
        Grid
      </MenuItemCheckbox>
      <MenuItemSwitch name="view" value="status">
        Status bar
      </MenuItemSwitch>
      <MenuItemSwitch name="view" value="minimap">
        Minimap
      </MenuItemSwitch>
      <MenuItemRadio name="sort" value="name">
        Name
      </MenuItemRadio>
      <MenuItemRadio name="sort" value="date">
        Date
      </MenuItemRadio>
      <MenuItem>Refresh</MenuItem>
    </>
  );

  it('has no axe violations in a popover list', async () => {
    renderInMenuList(items, {
      defaultCheckedValues: { view: ['ruler', 'status'], sort: ['date'] },
    });
    await expectNoA11yViolations();
  });

  it('has no axe violations in a static list', async () => {
    renderInMenuList(items, {
      isStatic: true,
      defaultCheckedValues: { view: ['grid'], sort: ['name'] },
    });
    await expectNoA11yViolations();
  });
});

describe('MenuItemCheckbox system props', () => {
  testSystemProps(MenuItemCheckbox, {
    expectedTag: 'div',
    displayName: 'MenuItemCheckbox',
    defaultProps: { name: 'view', value: 'grid', children: 'Grid' },
    a11yVariants: [{ name: 'checked', props: { value: 'ruler', children: 'Ruler' } }],
    conflictingClass: { className: 'px-4', overrides: 'wave:px-3' },
    wrapper: function CheckedHarness({ children }) {
      return (
        <MenuListHarness defaultCheckedValues={{ view: ['ruler'] }}>{children}</MenuListHarness>
      );
    },
  });
});

describe('MenuItemRadio system props', () => {
  testSystemProps(MenuItemRadio, {
    expectedTag: 'div',
    displayName: 'MenuItemRadio',
    defaultProps: { name: 'sort', value: 'date', children: 'Date' },
    conflictingClass: { className: 'px-4', overrides: 'wave:px-3' },
    wrapper: Harness,
  });
});

describe('MenuItemSwitch system props', () => {
  testSystemProps(MenuItemSwitch, {
    expectedTag: 'div',
    displayName: 'MenuItemSwitch',
    defaultProps: { name: 'view', value: 'grid', children: 'Grid' },
    conflictingClass: { className: 'px-4', overrides: 'wave:px-3' },
    wrapper: Harness,
  });
});

describe('types', () => {
  it('requires name and value; checkmark is a Slot<"span">', () => {
    expectTypeOf<MenuItemSelectableProps>().toEqualTypeOf<{ name: string; value: string }>();
    expectTypeOf<MenuItemCheckboxProps['checkmark']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<MenuItemRadioProps['checkmark']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<MenuItemCheckboxProps>().toExtend<MenuItemProps>();
    expectTypeOf<MenuItemSwitchProps>().toExtend<MenuItemSelectableProps>();
    // @ts-expect-error -- `name` and `value` are required
    const missing: MenuItemCheckboxProps = { children: 'Grid' };
    // @ts-expect-error -- `value` is required
    const noValue: MenuItemRadioProps = { name: 'sort', children: 'Date' };
    // @ts-expect-error -- a switch item has no checkmark slot
    const switchCheckmark: MenuItemSwitchProps = { name: 'v', value: 'g', checkmark: 'x' };
    expect([missing, noValue, switchCheckmark]).toHaveLength(3);
  });
});

describe('Menu.ItemCheckbox, Menu.ItemRadio and Menu.ItemSwitch — slotProps', () => {
  type RowSlotProps = NonNullable<MenuItemCheckboxProps['slotProps']>;
  type SwitchSlotProps = NonNullable<MenuItemSwitchProps['slotProps']>;
  const ROW_PARTS: RowSlotProps = { content: {}, shortcut: {} };
  const SWITCH_PARTS: SwitchSlotProps = { content: {}, shortcut: {}, track: {}, thumb: {} };
  const KIND_CLASSES = {
    checkbox: menuItemCheckboxClassNames,
    radio: menuItemRadioClassNames,
    switch: menuItemSwitchClassNames,
  } as const;
  const get = (row: Element, className: string) =>
    row.querySelector<HTMLElement>('.' + className) as HTMLElement;
  const track = (row: Element) => get(row, menuItemSwitchClassNames.track);
  const thumb = (row: Element) => get(row, menuItemSwitchClassNames.thumb);
  /** The item of `role` whose name starts with `label` (a shortcut's text follows the label). */
  const named = (role: string, label: string) =>
    screen.getByRole(role, { name: new RegExp(`^${label}`) });

  // Captured from 4a08890 (client and server agree): the merged props may put the class before the
  // locked attributes.
  const ON_TRACK =
    '<span aria-hidden="true" class="wave-menu-item-switch__track wave:relative wave:inline-flex wave:h-[16px] wave:w-[32px] wave:shrink-0 wave:items-center wave:rounded-full wave:border wave:transition-colors wave:duration-200 wave:motion-reduce:transition-none wave:border-primary wave:bg-primary wave:forced-colors:border-[Highlight] wave:forced-colors:bg-[Highlight]" data-menu-switch="">';
  const ON_THUMB =
    '<span class="wave-menu-item-switch__thumb wave:block wave:h-[10px] wave:w-[10px] wave:rounded-full wave:transition-transform wave:duration-200 wave:motion-reduce:transition-none wave:forced-colors:forced-color-adjust-none wave:translate-x-[18px] wave:wave-rtl:-translate-x-[18px] wave:bg-primary-foreground wave:forced-colors:bg-[HighlightText]">';
  const OFF_DISABLED_TRACK =
    '<span aria-hidden="true" class="wave-menu-item-switch__track wave:relative wave:inline-flex wave:h-[16px] wave:w-[32px] wave:shrink-0 wave:items-center wave:rounded-full wave:border wave:transition-colors wave:duration-200 wave:motion-reduce:transition-none wave:border-stroke-accessible wave:bg-transparent wave:forced-colors:text-[GrayText] wave:forced-colors:border-[GrayText]" data-menu-switch="">';
  const OFF_DISABLED_THUMB =
    '<span class="wave-menu-item-switch__thumb wave:block wave:h-[10px] wave:w-[10px] wave:rounded-full wave:transition-transform wave:duration-200 wave:motion-reduce:transition-none wave:forced-colors:forced-color-adjust-none wave:translate-x-[2px] wave:wave-rtl:-translate-x-[2px] wave:bg-stroke-accessible wave:forced-colors:bg-[GrayText]">';
  const contentPin = (kind: string) =>
    `<span class="wave-menu-item__content wave-menu-item-${kind}__content wave:flex-1">`;
  const shortcutPin = (kind: string) =>
    `<span class="wave-menu-item__shortcut wave-menu-item-${kind}__shortcut wave:ms-4 wave:text-caption-1 wave:text-muted-foreground" dir="auto">`;
  const BASE_PINS = [
    contentPin('checkbox'),
    shortcutPin('checkbox'),
    contentPin('radio'),
    shortcutPin('radio'),
    contentPin('switch'),
    shortcutPin('switch'),
    ON_TRACK,
    ON_THUMB,
    contentPin('switch'),
    OFF_DISABLED_TRACK,
    OFF_DISABLED_THUMB,
  ].join('\n');

  function PinnedItems({ row, toggle }: { row?: RowSlotProps; toggle?: SwitchSlotProps }) {
    return (
      <MenuListHarness
        isStatic
        defaultCheckedValues={{ view: ['grid'], sort: ['name'], wrap: ['on'] }}
      >
        <MenuItemCheckbox name="view" value="grid" shortcut="Ctrl+G" slotProps={row}>
          Grid
        </MenuItemCheckbox>
        <MenuItemRadio name="sort" value="name" shortcut="Ctrl+N" slotProps={row}>
          Name
        </MenuItemRadio>
        <MenuItemSwitch name="wrap" value="on" shortcut="Ctrl+W" slotProps={toggle}>
          Wrap
        </MenuItemSwitch>
        <MenuItemSwitch name="wrap" value="ruler" disabled slotProps={toggle}>
          Ruler
        </MenuItemSwitch>
      </MenuListHarness>
    );
  }

  /** The parts of the pinned items, in the order of {@link BASE_PINS}. */
  const pinnedParts = (root: ParentNode) => {
    const [grid, name, wrap, ruler] = Array.from(
      root.querySelectorAll('[role="menuitemcheckbox"], [role="menuitemradio"]'),
    );
    const content = (row: Element) => get(row, menuItemClassNames.content);
    const shortcut = (row: Element) => get(row, menuItemClassNames.shortcut);
    return [
      ...[grid, name, wrap].flatMap((row) => [content(row), shortcut(row)]),
      track(wrap),
      thumb(wrap),
      content(ruler),
      track(ruler),
      thumb(ruler),
    ];
  };

  it('renders the parts of 4a08890 (attributes sorted), on the client and the server', () => {
    render(<PinnedItems />);
    expect(openingTags(...pinnedParts(document.body))).toBe(BASE_PINS);
    const template = document.createElement('template');
    template.innerHTML = renderToString(<PinnedItems row={ROW_PARTS} toggle={SWITCH_PARTS} />);
    expect(openingTags(...pinnedParts(template.content))).toBe(BASE_PINS);
  });

  it.each(KINDS)(
    '%s: renders the same markup without slotProps, with {} and with every part empty',
    (kind, _role, Item) => {
      const every = kind === 'switch' ? SWITCH_PARTS : ROW_PARTS;
      const cases: Array<Partial<MenuItemSwitchProps> & { checkmark?: Slot<'span'> }> = [
        { value: 'grid', shortcut: 'Ctrl+G', icon: { children: 'G' }, children: 'Grid' },
        { value: 'ruler', children: <b>Ruler</b> },
        { value: 'grid', disabled: true, children: 'Off' },
        { value: 'ruler', disabled: true, shortcut: 'R', children: 'Ruler' },
        {
          value: 'grid',
          'data-roving-text': 'Lines',
          children: <i>Grid lines</i>,
        } as Partial<MenuItemSwitchProps>,
        ...(kind === 'switch' ? [] : [{ value: 'grid', checkmark: { children: 'v' } }]),
      ];
      for (const props of cases) {
        expectInertSlotProps(
          (slotProps) => (
            <MenuListHarness defaultCheckedValues={{ view: ['grid'] }}>
              <Item name="view" value="grid" {...props} slotProps={slotProps} />
            </MenuListHarness>
          ),
          every,
        );
      }
    },
  );

  it.each(KINDS)(
    '%s: puts your className, style, data-* and ref on the label and the shortcut',
    (kind, role, Item) => {
      const contentRef = React.createRef<HTMLSpanElement>();
      const shortcutRef = React.createRef<HTMLSpanElement>();
      renderInMenuList(
        <Item
          name="view"
          value="grid"
          shortcut="Ctrl+G"
          slotProps={{
            content: {
              className: 'my-content flex-none',
              style: { opacity: 0.5 },
              'data-part': 'content',
              ref: contentRef,
            },
            shortcut: {
              className: 'my-shortcut ms-2',
              style: { opacity: 0.25 },
              'data-part': 'shortcut',
              ref: shortcutRef,
            },
          }}
        >
          Grid
        </Item>,
      );
      const row = named(role, 'Grid');
      const classes = KIND_CLASSES[kind];
      for (const [element, base, own, mine, replaced, data, opacity, ref] of [
        [
          get(row, classes.content),
          menuItemClassNames.content,
          classes.content,
          'my-content',
          'wave:flex-1',
          'content',
          '0.5',
          contentRef,
        ],
        [
          get(row, classes.shortcut),
          menuItemClassNames.shortcut,
          classes.shortcut,
          'my-shortcut',
          'wave:ms-4',
          'shortcut',
          '0.25',
          shortcutRef,
        ],
      ] as const) {
        expect(Array.from(element.classList).slice(0, 2)).toEqual([base, own]);
        expect(element).toHaveClass(mine);
        expect(element).not.toHaveClass(replaced);
        expect(element).toHaveAttribute('data-part', data);
        expect(element).toHaveStyle({ opacity });
        expect(ref.current).toBe(element);
      }
    },
  );

  it.each(KINDS)(
    '%s: locks the shortcut’s direction, gives no part a role, and keeps typeahead on the label',
    async (kind, role, Item) => {
      const user = userEvent.setup();
      renderInMenuList(
        <>
          <Item
            name="view"
            value="grid"
            shortcut="Ctrl+,"
            slotProps={{
              content: { role: role, 'data-menu-label': 'x', tabIndex: 0 },
              shortcut: { dir: 'ltr', role: 'note', 'data-menu-label': '', tabIndex: 0 },
            }}
          >
            Apple
          </Item>
          <MenuItem>Cherry</MenuItem>
        </>,
      );
      const row = named(role, 'Apple');
      const classes = KIND_CLASSES[kind];
      expect(get(row, classes.content)).not.toHaveAttribute('role');
      expect(get(row, classes.content)).not.toHaveAttribute('data-menu-label');
      expect(get(row, classes.shortcut)).toHaveAttribute('dir', 'auto');
      expect(get(row, classes.shortcut)).not.toHaveAttribute('role');
      expect(get(row, classes.shortcut)).not.toHaveAttribute('data-menu-label');
      expect(get(row, classes.content)).not.toHaveAttribute('tabindex');
      expect(get(row, classes.shortcut)).not.toHaveAttribute('tabindex');
      expect(screen.getAllByRole(role)).toHaveLength(1);
      await user.tab();
      await user.keyboard('{End}');
      expect(screen.getByRole('menuitem', { name: 'Cherry' })).toHaveFocus();
      await user.keyboard('a');
      expect(row).toHaveFocus();
    },
  );

  it.each(KINDS)(
    '%s: runs a part’s handler first; a prevented click calls onClick but changes nothing',
    async (_kind, role, Item) => {
      const user = userEvent.setup();
      const order: string[] = [];
      const onClick = vi.fn(() => void order.push('item'));
      const onCheckedValuesChange = vi.fn();
      const prevent = (name: string) => (event: React.MouseEvent) => {
        order.push(name);
        event.preventDefault();
      };
      const { closeFromItem, rerender } = renderInMenuList(
        <Item
          name="view"
          value="grid"
          shortcut="Ctrl+G"
          onClick={onClick}
          slotProps={{ content: { onClick: prevent('content') } }}
        >
          Grid
        </Item>,
        { defaultCheckedValues: { view: [] }, onCheckedValuesChange },
      );
      const row = named(role, 'Grid');
      await user.click(row.querySelector('.' + menuItemClassNames.content) as HTMLElement);
      expect(order).toEqual(['content', 'item']);
      expect(row).toHaveAttribute('aria-checked', 'false');
      expect(onCheckedValuesChange).not.toHaveBeenCalled();
      expect(closeFromItem).not.toHaveBeenCalled();
      rerender(
        <Item
          name="view"
          value="grid"
          shortcut="Ctrl+G"
          onClick={onClick}
          slotProps={{ shortcut: { onClick: () => void order.push('shortcut') } }}
        >
          Grid
        </Item>,
      );
      await user.click(row.querySelector('.' + menuItemClassNames.shortcut) as HTMLElement);
      expect(order).toEqual(['content', 'item', 'shortcut', 'item']);
      expect(row).toHaveAttribute('aria-checked', 'true');
      expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
      expect(closeFromItem).toHaveBeenCalledTimes(1);
    },
  );

  it.each(KINDS)(
    '%s: calls no click handler of a part while the item is disabled, as it calls no onClick',
    async (kind, role, Item) => {
      const handlers = { content: vi.fn(), shortcut: vi.fn(), track: vi.fn(), thumb: vi.fn() };
      const onClick = vi.fn();
      const onCheckedValuesChange = vi.fn();
      const ui = (props: Partial<MenuItemSwitchProps>) => (
        <Item
          name="view"
          value="grid"
          shortcut="Ctrl+G"
          onClick={onClick}
          persistOnClick
          {...props}
          slotProps={{
            content: { onClick: handlers.content },
            shortcut: { onClick: handlers.shortcut },
            track: { onClick: handlers.track },
            thumb: { onClick: handlers.thumb },
          }}
        >
          Grid
        </Item>
      );
      const { rerender } = renderInMenuList(ui({ disabled: true }), {
        defaultCheckedValues: { view: [] },
        onCheckedValuesChange,
      });
      const row = named(role, 'Grid');
      // The switch's two parts are clicked through the thumb, inside the track.
      const clickEveryPart = () => {
        fireEvent.click(get(row, menuItemClassNames.content));
        fireEvent.click(get(row, menuItemClassNames.shortcut));
        if (kind === 'switch') fireEvent.click(thumb(row));
      };
      clickEveryPart();
      for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
      expect(onCheckedValuesChange).not.toHaveBeenCalled();
      expect(row).toHaveAttribute('aria-checked', 'false');
      // Enabled, and with a consumer aria-disabled alone, the item and its parts run.
      for (const [props, calls] of [
        [{}, 1],
        [{ 'aria-disabled': true }, 2],
      ] as const) {
        rerender(ui(props));
        await act(async () => {});
        clickEveryPart();
        expect(handlers.content).toHaveBeenCalledTimes(calls);
        expect(handlers.shortcut).toHaveBeenCalledTimes(calls);
        expect(handlers.thumb).toHaveBeenCalledTimes(kind === 'switch' ? calls : 0);
        expect(handlers.track).toHaveBeenCalledTimes(kind === 'switch' ? calls : 0);
      }
      expect(onClick).toHaveBeenCalledTimes(kind === 'switch' ? 6 : 4);
    },
  );

  it('switch: puts your className, style, data-* and ref on the track and the thumb', () => {
    const trackRef = React.createRef<HTMLSpanElement>();
    const thumbRef = React.createRef<HTMLSpanElement>();
    renderInMenuList(
      <MenuItemSwitch
        name="view"
        value="grid"
        slotProps={{
          track: {
            className: 'my-track bg-error',
            style: { opacity: 0.5 },
            'data-part': 'track',
            ref: trackRef,
          },
          thumb: {
            className: 'my-thumb h-3',
            style: { opacity: 0.25 },
            'data-part': 'thumb',
            ref: thumbRef,
          },
        }}
      >
        Grid
      </MenuItemSwitch>,
      { defaultCheckedValues: { view: ['grid'] } },
    );
    const row = checkbox('Grid');
    for (const [element, stable, mine, replaced, data, opacity, ref] of [
      [
        track(row),
        menuItemSwitchClassNames.track,
        'my-track',
        'wave:bg-primary',
        'track',
        '0.5',
        trackRef,
      ],
      [
        thumb(row),
        menuItemSwitchClassNames.thumb,
        'my-thumb',
        'wave:h-[10px]',
        'thumb',
        '0.25',
        thumbRef,
      ],
    ] as const) {
      expect(element.classList[0]).toBe(stable);
      expect(element).toHaveClass(mine);
      expect(element).not.toHaveClass(replaced);
      expect(element).toHaveAttribute('data-part', data);
      expect(element).toHaveStyle({ opacity });
      expect(ref.current).toBe(element);
    }
    expect(track(row)).toHaveClass('bg-error');
    expect(thumb(row)).toHaveClass('h-3');
  });

  it('switch: the track and thumb follow the checked state with your classes on them', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <MenuItemSwitch
        name="view"
        value="grid"
        slotProps={{ track: { className: 'my-track' }, thumb: { className: 'my-thumb' } }}
      >
        Grid
      </MenuItemSwitch>,
      { defaultCheckedValues: { view: [] } },
    );
    const row = checkbox('Grid');
    expect(track(row)).toHaveClass('my-track', 'wave:bg-transparent');
    expect(thumb(row)).toHaveClass('my-thumb', 'wave:translate-x-[2px]');
    await user.click(row);
    expect(row).toHaveAttribute('aria-checked', 'true');
    expect(track(row)).toHaveClass('my-track', 'wave:bg-primary');
    expect(track(row)).not.toHaveClass('wave:bg-transparent');
    expect(thumb(row)).toHaveClass('my-thumb', 'wave:translate-x-[18px]');
  });

  it('switch: locks the track’s hidden state and marker, and gives the drawing no role', () => {
    renderInMenuList(
      <MenuItemSwitch
        name="view"
        value="grid"
        slotProps={{
          track: {
            'aria-hidden': false,
            'data-menu-switch': 'mine',
            role: 'switch',
            tabIndex: 0,
            title: 'T',
          },
          thumb: { role: 'img', 'aria-label': 'Thumb', tabIndex: 0, title: 'Thumb' },
        }}
      >
        Grid
      </MenuItemSwitch>,
    );
    const row = checkbox('Grid');
    expect(track(row)).toHaveAttribute('aria-hidden', 'true');
    expect(track(row)).toHaveAttribute('data-menu-switch', '');
    expect(track(row)).not.toHaveAttribute('role');
    expect(track(row)).toHaveAttribute('title', 'T');
    expect(thumb(row)).not.toHaveAttribute('role');
    expect(thumb(row)).toHaveAttribute('title', 'Thumb');
    expect(track(row)).not.toHaveAttribute('tabindex');
    expect(thumb(row)).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(1);
  });

  it('switch: leaves the menu’s check column alone: a part cannot add a column marker', async () => {
    const values: MenuListContextValue[] = [];
    function Probe() {
      values.push(useMenuListContext());
      return null;
    }
    const markers = { 'data-menu-checkmark': '', 'data-menu-icon': '', className: 'my-part' };
    function View({ slotProps }: { slotProps?: SwitchSlotProps }) {
      return (
        <Menu aria-label="View" defaultCheckedValues={{ view: ['grid'] }}>
          <Menu.ItemSwitch name="view" value="grid" shortcut="Ctrl+G" slotProps={slotProps}>
            Grid
          </Menu.ItemSwitch>
          <Probe />
        </Menu>
      );
    }
    const { rerender } = render(<View />);
    await act(async () => {});
    rerender(
      <View slotProps={{ content: markers, shortcut: markers, track: markers, thumb: markers }} />,
    );
    await act(async () => {});
    expect(document.querySelectorAll('.my-part')).toHaveLength(4);
    expect(document.querySelector('[data-menu-icon], [data-menu-checkmark]')).toBeNull();
    expect(values.at(-1)).toStrictEqual({ hasIcons: false, hasCheckmarks: false });
  });

  it('switch: a click on the switch that its handler prevents leaves the item as it was', async () => {
    const user = userEvent.setup();
    const onTrackClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    const onCheckedValuesChange = vi.fn();
    renderInMenuList(
      <MenuItemSwitch name="view" value="grid" slotProps={{ track: { onClick: onTrackClick } }}>
        Grid
      </MenuItemSwitch>,
      { defaultCheckedValues: { view: [] }, onCheckedValuesChange },
    );
    const row = checkbox('Grid');
    await user.click(thumb(row));
    expect(onTrackClick).toHaveBeenCalledTimes(1);
    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedValuesChange).not.toHaveBeenCalled();
    await user.click(row);
    expect(row).toHaveAttribute('aria-checked', 'true');
  });

  it.each(KINDS)(
    '%s: calls your part handlers once per click in StrictMode',
    async (kind, role, Item) => {
      const user = userEvent.setup();
      const handlers = { content: vi.fn(), shortcut: vi.fn(), track: vi.fn(), thumb: vi.fn() };
      const slotProps: SwitchSlotProps = {
        content: { onClick: handlers.content },
        shortcut: { onClick: handlers.shortcut },
        ...(kind === 'switch' && {
          track: { onClick: handlers.track },
          thumb: { onClick: handlers.thumb },
        }),
      };
      renderInMenuList(
        <Item name="view" value="grid" shortcut="Ctrl+G" slotProps={slotProps}>
          Grid
        </Item>,
        { renderOptions: { wrapper: React.StrictMode } },
      );
      const row = named(role, 'Grid');
      await user.click(get(row, menuItemClassNames.content));
      await user.click(get(row, menuItemClassNames.shortcut));
      expect(handlers.content).toHaveBeenCalledTimes(1);
      expect(handlers.shortcut).toHaveBeenCalledTimes(1);
      if (kind === 'switch') {
        await user.click(thumb(row));
        expect(handlers.thumb).toHaveBeenCalledTimes(1);
        // The thumb's click bubbled through the track.
        expect(handlers.track).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('keeps the label naming each kind: no aria-label, hidden state or roving container from a part', () => {
    const LABEL_PART = {
      'aria-label': 'Other',
      hidden: true,
      inert: true,
      'aria-hidden': true,
      'data-roving-container': '',
    } as const;
    render(
      <PinnedItems
        row={{ content: LABEL_PART }}
        toggle={{ content: LABEL_PART, track: { 'data-roving-container': '' } }}
      />,
    );
    for (const [role, label] of [
      ['menuitemcheckbox', 'Grid'],
      ['menuitemradio', 'Name'],
      ['menuitemcheckbox', 'Wrap'],
    ] as const) {
      const row = named(role, label);
      const content = get(row, menuItemClassNames.content);
      for (const attribute of [
        'aria-label',
        'hidden',
        'inert',
        'aria-hidden',
        'data-roving-container',
      ]) {
        expect(content, `${label} ${attribute}`).not.toHaveAttribute(attribute);
      }
    }
    expect(track(named('menuitemcheckbox', 'Wrap'))).not.toHaveAttribute('data-roving-container');
  });

  it('ignores the parts an item does not draw: no shortcut, and no switch on a checkbox or radio', () => {
    const parts = {
      shortcut: { className: 'my-shortcut' },
      track: { className: 'my-track' },
      thumb: { className: 'my-thumb' },
    } as RowSlotProps;
    renderInMenuList(
      <>
        <MenuItemCheckbox name="view" value="grid" slotProps={parts}>
          Grid
        </MenuItemCheckbox>
        <MenuItemRadio name="sort" value="name" slotProps={parts}>
          Name
        </MenuItemRadio>
        <MenuItemSwitch name="view" value="ruler" slotProps={parts}>
          Ruler
        </MenuItemSwitch>
      </>,
    );
    expect(document.querySelector('.' + menuItemClassNames.shortcut)).toBeNull();
    expect(document.querySelector('.my-shortcut')).toBeNull();
    expect(document.querySelectorAll('.' + menuItemSwitchClassNames.track)).toHaveLength(1);
    expect(document.querySelectorAll('.my-track')).toHaveLength(1);
    expect(checkbox('Grid').querySelector('.my-track, .my-thumb')).toBeNull();
    expect(radio('Name').querySelector('.my-track, .my-thumb')).toBeNull();
  });

  it('keeps the item element its own: slotProps never reaches it', () => {
    renderInMenuList(
      <MenuItemCheckbox
        name="view"
        value="grid"
        slotProps={{ root: { role: 'button', className: 'my-root' } } as never}
      >
        Grid
      </MenuItemCheckbox>,
    );
    expect(checkbox('Grid')).not.toHaveAttribute('slotprops');
    expect(checkbox('Grid')).not.toHaveClass('my-root');
    expect(document.querySelector('.my-root, [role="button"]')).toBeNull();
  });

  it('switch: keeps the mirrored thumb with your class in RTL', () => {
    renderInMenuList(
      <MenuItemSwitch
        name="view"
        value="grid"
        shortcut="Ctrl+G"
        slotProps={{ thumb: { className: 'my-thumb' }, shortcut: { className: 'my-shortcut' } }}
      >
        Grid
      </MenuItemSwitch>,
      { defaultCheckedValues: { view: ['grid'] }, dir: 'rtl' },
    );
    const row = named('menuitemcheckbox', 'Grid');
    expect(row.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(thumb(row)).toHaveClass('my-thumb', 'wave:wave-rtl:-translate-x-[18px]');
    expect(get(row, menuItemSwitchClassNames.shortcut)).toHaveAttribute('dir', 'auto');
  });

  it('has no accessibility violations with every part customised', async () => {
    renderInMenuList(
      <>
        <MenuItemCheckbox
          name="view"
          value="grid"
          shortcut="Ctrl+G"
          slotProps={{ content: { title: 'Grid lines' }, shortcut: { className: 'my-shortcut' } }}
        >
          Grid
        </MenuItemCheckbox>
        <MenuItemRadio name="sort" value="name" slotProps={{ content: { id: 'sort-name' } }}>
          Name
        </MenuItemRadio>
        <MenuItemSwitch
          name="wrap"
          value="on"
          slotProps={{ track: { className: 'my-track' }, thumb: { title: 'On' } }}
        >
          Wrap
        </MenuItemSwitch>
      </>,
      { defaultCheckedValues: { view: ['grid'], wrap: ['on'] } },
    );
    await expectNoA11yViolations();
  });

  it('types each kind’s parts for their elements, and takes no children', () => {
    expectTypeOf<keyof RowSlotProps>().toEqualTypeOf<'content' | 'shortcut' | 'subText'>();
    expectTypeOf<keyof NonNullable<MenuItemRadioProps['slotProps']>>().toEqualTypeOf<
      'content' | 'shortcut' | 'subText'
    >();
    expectTypeOf<keyof SwitchSlotProps>().toEqualTypeOf<
      'content' | 'shortcut' | 'subText' | 'track' | 'thumb'
    >();
    expectTypeOf<NonNullable<RowSlotProps['content']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<SwitchSlotProps['track']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<SwitchSlotProps['thumb']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    const noSubmenu = (
      // @ts-expect-error -- a checkable item draws no submenu chevron
      <MenuItemCheckbox name="v" value="g" slotProps={{ submenuIndicator: {} }}>
        Grid
      </MenuItemCheckbox>
    );
    const noSwitch = (
      // @ts-expect-error -- only a switch item draws a track
      <MenuItemRadio name="v" value="g" slotProps={{ track: {} }}>
        Grid
      </MenuItemRadio>
    );
    const noChildren = (
      // @ts-expect-error -- a part takes no children: the item draws them
      <MenuItemSwitch name="v" value="g" slotProps={{ thumb: { children: 'x' } }}>
        Grid
      </MenuItemSwitch>
    );
    expect([noSubmenu, noSwitch, noChildren]).toHaveLength(3);
  });
});
