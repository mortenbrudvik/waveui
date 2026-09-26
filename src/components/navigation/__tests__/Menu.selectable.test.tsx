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
import type { CheckedValues, CheckedValuesChangeDetails, Slot } from '../../../lib/types';
import { expectNoA11yViolations, expectThrows, testSystemProps } from '../../../test-utils';
import { MenuListHarness, renderInMenuList } from './menuHarness';

afterEach(() => {
  vi.restoreAllMocks();
});

const checkbox = (name: string) => screen.getByRole('menuitemcheckbox', { name });
const radio = (name: string) => screen.getByRole('menuitemradio', { name });

const CHECKMARK_SPACE = 'hidden w-4 shrink-0 group-has-[[data-menu-checkmark]]/menu:inline-flex';

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
    'relative inline-flex h-[16px] w-[32px] shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none';
  const THUMB =
    'block h-[10px] w-[10px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none';

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
    expect(on.track).toHaveClass(...TRACK.split(' '), 'border-primary', 'bg-primary');
    expect(on.thumb).toHaveClass(
      ...THUMB.split(' '),
      'translate-x-[18px]',
      'wave-rtl:-translate-x-[18px]',
      'bg-primary-foreground',
    );
    const off = parts('Off');
    expect(off.track).toHaveClass(
      ...TRACK.split(' '),
      'border-stroke-accessible',
      'bg-transparent',
    );
    expect(off.track).not.toHaveClass('bg-primary');
    expect(off.thumb).toHaveClass(
      ...THUMB.split(' '),
      'translate-x-[2px]',
      'wave-rtl:-translate-x-[2px]',
      'bg-stroke-accessible',
    );
  });

  it('uses the forced-colors recipe of Switch', () => {
    const parts = renderSwitches();
    expect(parts('On').track).toHaveClass(
      'forced-colors:border-[Highlight]',
      'forced-colors:bg-[Highlight]',
    );
    expect(parts('On').thumb).toHaveClass('forced-colors:bg-[HighlightText]');
    expect(parts('Off').track).toHaveClass('forced-colors:border-[ButtonText]');
    expect(parts('Off').thumb).toHaveClass('forced-colors:bg-[ButtonText]');
    expect(parts('On disabled').track).toHaveClass(
      'forced-colors:border-[GrayText]',
      'forced-colors:bg-[Canvas]',
    );
    expect(parts('On disabled').thumb).toHaveClass('forced-colors:bg-[GrayText]');
    expect(parts('Off disabled').track).toHaveClass(
      'forced-colors:text-[GrayText]',
      'forced-colors:border-[GrayText]',
    );
    expect(parts('Off disabled').thumb).toHaveClass('forced-colors:bg-[GrayText]');
  });

  it('follows the checked state', async () => {
    const user = userEvent.setup();
    const parts = renderSwitches();
    await user.click(checkbox('Off'));
    expect(parts('Off').track).toHaveClass('bg-primary');
    expect(parts('Off').thumb).toHaveClass('translate-x-[18px]');
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
    expect(parts('On').thumb).toHaveClass('wave-rtl:-translate-x-[18px]');
    expect(parts('Off').thumb).toHaveClass('wave-rtl:-translate-x-[2px]');
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
    conflictingClass: { className: 'px-4', overrides: 'px-3' },
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
    conflictingClass: { className: 'px-4', overrides: 'px-3' },
    wrapper: Harness,
  });
});

describe('MenuItemSwitch system props', () => {
  testSystemProps(MenuItemSwitch, {
    expectedTag: 'div',
    displayName: 'MenuItemSwitch',
    defaultProps: { name: 'view', value: 'grid', children: 'Grid' },
    conflictingClass: { className: 'px-4', overrides: 'px-3' },
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
