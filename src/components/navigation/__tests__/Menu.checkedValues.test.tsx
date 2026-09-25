import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Menu } from '../Menu';
import type { MenuProps } from '../Menu';
import { useMenuContext } from '../Menu.context';
import type { CheckedValues, CheckedValuesChangeHandler } from '../../../lib/types';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * A test-local checkable item: reads and toggles the Menu's checked values through the context
 * (the checkable item kinds are tested in their own modules).
 */
function CheckedProbe({ name, value }: { name: string; value: string }) {
  const { checked } = useMenuContext('Test');
  return (
    <div
      role="menuitemcheckbox"
      aria-checked={checked.isChecked(name, value)}
      tabIndex={-1}
      onClick={(event) => checked.toggle(name, value, event.nativeEvent)}
    >
      {value}
    </div>
  );
}

/** Renders the Menu context's `persistOnItemClick` and `parent`. */
function ContextProbe() {
  const { persistOnItemClick, parent } = useMenuContext('Test');
  return (
    <div
      data-testid="probe"
      data-persist={String(persistOnItemClick)}
      data-parent={String(parent)}
    />
  );
}

const box = (name: string) => screen.getByRole('menuitemcheckbox', { name });

function ViewMenu(props: Partial<MenuProps>) {
  return (
    <Menu aria-label="View" {...props}>
      <CheckedProbe name="view" value="grid" />
      <CheckedProbe name="view" value="ruler" />
      <CheckedProbe name="panels" value="status" />
    </Menu>
  );
}

describe('Menu checkedValues', () => {
  it('uncontrolled: starts from defaultCheckedValues and reports each change with its details', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn<CheckedValuesChangeHandler>();
    render(
      <ViewMenu
        defaultCheckedValues={{ view: ['grid'] }}
        onCheckedValuesChange={onCheckedValuesChange}
      />,
    );
    expect(box('grid')).toHaveAttribute('aria-checked', 'true');
    expect(box('ruler')).toHaveAttribute('aria-checked', 'false');

    await user.click(box('ruler'));
    expect(box('ruler')).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    const [values, details] = onCheckedValuesChange.mock.calls[0];
    expect(values).toEqual({ view: ['grid', 'ruler'] });
    expect(details).toEqual({
      name: 'view',
      checkedItems: ['grid', 'ruler'],
      event: expect.any(Event),
    });
    expect(details?.event.type).toBe('click');
    expect(details?.checkedItems).toBe(values.view);

    await user.click(box('grid'));
    expect(box('grid')).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedValuesChange).toHaveBeenLastCalledWith(
      { view: ['ruler'] },
      { name: 'view', checkedItems: ['ruler'], event: expect.any(Event) },
    );
  });

  it('uncontrolled without defaultCheckedValues starts empty; an unknown group reads as unchecked', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn<CheckedValuesChangeHandler>();
    render(<ViewMenu onCheckedValuesChange={onCheckedValuesChange} />);
    expect(box('grid')).toHaveAttribute('aria-checked', 'false');
    expect(box('status')).toHaveAttribute('aria-checked', 'false');
    await user.click(box('status'));
    expect(box('status')).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedValuesChange.mock.calls[0][0]).toEqual({ panels: ['status'] });
  });

  it('controlled: follows checkedValues, and a parent that ignores the callback keeps its value', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn<CheckedValuesChangeHandler>();
    const initial: CheckedValues = { view: ['grid'] };
    const { rerender } = render(
      <ViewMenu checkedValues={initial} onCheckedValuesChange={onCheckedValuesChange} />,
    );
    await user.click(box('ruler'));
    expect(onCheckedValuesChange).toHaveBeenCalledWith(
      { view: ['grid', 'ruler'] },
      { name: 'view', checkedItems: ['grid', 'ruler'], event: expect.any(Event) },
    );
    expect(box('ruler')).toHaveAttribute('aria-checked', 'false');

    rerender(
      <ViewMenu
        checkedValues={{ view: ['ruler'] }}
        onCheckedValuesChange={onCheckedValuesChange}
      />,
    );
    expect(box('grid')).toHaveAttribute('aria-checked', 'false');
    expect(box('ruler')).toHaveAttribute('aria-checked', 'true');
  });

  it('accepts readonly data as the controlled value', () => {
    const readonlyValues = { view: ['grid'] } as const;
    render(<ViewMenu checkedValues={readonlyValues} />);
    expect(box('grid')).toHaveAttribute('aria-checked', 'true');
  });

  it('StrictMode: onCheckedValuesChange fires once per change', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn<CheckedValuesChangeHandler>();
    render(
      <React.StrictMode>
        <ViewMenu onCheckedValuesChange={onCheckedValuesChange} />
      </React.StrictMode>,
    );
    await user.click(box('grid'));
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    await user.click(box('ruler'));
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(2);
    expect(onCheckedValuesChange.mock.calls[1][0]).toEqual({ view: ['grid', 'ruler'] });
  });

  it('works in a popup menu: the state lives in the root and survives closing', async () => {
    const user = userEvent.setup();
    render(
      <Menu defaultCheckedValues={{ view: ['grid'] }}>
        <Menu.Trigger>
          <button type="button">View</button>
        </Menu.Trigger>
        <Menu.Popover>
          <CheckedProbe name="view" value="grid" />
          <CheckedProbe name="view" value="ruler" />
        </Menu.Popover>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'View' }));
    expect(box('grid')).toHaveAttribute('aria-checked', 'true');
    await user.click(box('ruler'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View' }));
    expect(box('ruler')).toHaveAttribute('aria-checked', 'true');
  });

  it.each([
    ['checkedValues', { checkedValues: { view: ['grid'] } }],
    ['defaultCheckedValues', { defaultCheckedValues: { view: ['grid'] } }],
    ['onCheckedValuesChange', { onCheckedValuesChange: () => {} }],
    ['persistOnItemClick', { persistOnItemClick: true }],
  ])('%s keeps a Menu of items static and renders no attribute for it', (_prop, props) => {
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    render(<ViewMenu data-testid="menu" {...props} />);
    const menu = screen.getByRole('menu', { name: 'View' });
    expect(menu).toBe(screen.getByTestId('menu'));
    for (const attribute of menu.getAttributeNames()) {
      expect(attribute).not.toMatch(/checked|persist/i);
    }
    // Not passed on to the element (React would report an unknown prop).
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders the checked state of a static menu in the server HTML', () => {
    const html = renderToString(<ViewMenu defaultCheckedValues={{ view: ['ruler'] }} />);
    expect(html).toContain('aria-checked="true"');
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
  });

  it('a popup menu does not list the checked-values props or persistOnItemClick as ignored DOM props', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <Menu
        checkedValues={{ view: [] }}
        onCheckedValuesChange={() => {}}
        persistOnItemClick
        defaultOpen={false}
      >
        <Menu.Trigger>
          <button type="button">View</button>
        </Menu.Trigger>
        <Menu.Popover>
          <CheckedProbe name="view" value="grid" />
        </Menu.Popover>
      </Menu>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('Menu persistOnItemClick', () => {
  it('reaches the context: false by default, true when set; a root menu has no parent', () => {
    const { rerender } = render(
      <Menu aria-label="Edit">
        <ContextProbe />
      </Menu>,
    );
    expect(screen.getByTestId('probe')).toHaveAttribute('data-persist', 'false');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-parent', 'null');
    rerender(
      <Menu aria-label="Edit" persistOnItemClick>
        <ContextProbe />
      </Menu>,
    );
    expect(screen.getByTestId('probe')).toHaveAttribute('data-persist', 'true');
  });

  it('keeps a popup menu open after an item is activated; an item persistOnClick={false} closes it', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Menu persistOnItemClick onOpenChange={onOpenChange}>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Bold</Menu.Item>
          <Menu.Item persistOnClick={false}>Done</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Bold' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});
