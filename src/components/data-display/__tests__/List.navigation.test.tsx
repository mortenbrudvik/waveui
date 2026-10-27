/**
 * List navigation modes, `onAction`, `disabledSelection` and checkmarks (0.14, spec P9-06). The
 * 0.13 behaviour with none of them set is pinned by `List.test.tsx`, which this phase leaves
 * unchanged (D2).
 */
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { List } from '../List';
import type { ListItemActionEvent, ListItemProps, ListNavigationMode, ListProps } from '../List';
import { listClassNames, listItemClassNames } from '../../../lib/classNames';
import type { Slot } from '../../../lib/slot';
import { focusRingInset } from '../../../lib/styles';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

const FRUITS = ['Apple', 'Banana', 'Cherry'];
const CITIES = ['Amsterdam', 'Berlin', 'Dublin', 'Lima', 'New Delhi', 'New York', 'Oslo', 'Paris'];

/** The `<li role="listitem">` whose content is `text` (a listitem takes no name from content). */
function listItem(text: string): HTMLElement {
  const item = screen.getByText(text).closest<HTMLElement>('[role="listitem"]');
  if (!item) throw new Error(`no list item for "${text}"`);
  return item;
}

function option(name: string): HTMLElement {
  return screen.getByRole('option', { name });
}

function row(name: RegExp | string): HTMLElement {
  return screen.getByRole('row', { name });
}

function checkmarkOf(item: HTMLElement): HTMLElement | null {
  return item.querySelector<HTMLElement>(`.${listItemClassNames.checkmark}`);
}

/** Flushes the roving hook's MutationObserver (a microtask) inside act(). */
async function flushItemObserver(): Promise<void> {
  await act(async () => {});
}

function items(
  names: readonly string[],
  props: (name: string) => Partial<ListItemProps> = () => ({}),
) {
  return names.map((name) => (
    <List.Item key={name} value={name.toLowerCase()} {...props(name)}>
      {name}
    </List.Item>
  ));
}

const WARNINGS = {
  itemsWithActions:
    '[WaveUI] List: a selectable list whose items have actions is a grid (an option cannot hold interactive content), so navigationMode="items" acts as "composite". Set navigationMode="composite".',
  noneSelectable:
    '[WaveUI] List: navigationMode="none" has no effect on a selectable list, whose items are always reached with the arrow keys. Remove it, or use "items" or "composite".',
  actionNotNavigable:
    '[WaveUI] List.Item: `onAction` runs only on clicks here: the List does not navigate its items, so keyboard users cannot reach them. Set navigationMode="items" (or "composite") on the List, or make it selectable.',
};

describe('List navigation modes (P9-06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('data-navigation-mode (C-CLASS)', () => {
    it.each<[string, Partial<ListProps>, boolean, ListNavigationMode]>([
      ['a plain list', {}, false, 'none'],
      ['a plain list with actions', {}, true, 'none'],
      ['a selectable list', { selectable: true }, false, 'items'],
      ['a selectable list with actions', { selectable: true }, true, 'composite'],
      ['navigationMode="none"', { navigationMode: 'none' }, false, 'none'],
      ['navigationMode="items"', { navigationMode: 'items' }, false, 'items'],
      ['navigationMode="composite"', { navigationMode: 'composite' }, false, 'composite'],
      [
        'a selectable navigationMode="composite" list',
        { selectable: true, navigationMode: 'composite' },
        false,
        'composite',
      ],
    ])('renders the resolved mode of %s, on the server too', (_, props, withAction, expected) => {
      const ui = (
        <List aria-label="Docs" {...props}>
          <List.Item value="a" action={withAction ? <button type="button">Delete</button> : null}>
            Doc a
          </List.Item>
        </List>
      );
      expect(renderToString(ui)).toContain(`data-navigation-mode="${expected}"`);
      const { container } = render(ui);
      expect(container.querySelector(`.${listClassNames.root}`)).toHaveAttribute(
        'data-navigation-mode',
        expected,
      );
    });

    it('lets a consumer data-navigation-mode through (it goes before the rest props)', () => {
      render(<List data-navigation-mode="custom" data-testid="list" />);
      expect(screen.getByTestId('list')).toHaveAttribute('data-navigation-mode', 'custom');
    });
  });

  describe('navigationMode="items" on a plain list', () => {
    function renderPlain(props: Partial<ListProps> = {}, names: readonly string[] = FRUITS) {
      return render(
        <>
          <button type="button">Before</button>
          <List navigationMode="items" aria-label="Fruits" {...props}>
            {items(names)}
          </List>
          <button type="button">After</button>
        </>,
      );
    }

    it('keeps list semantics without aria-selected, with one Tab stop on the first item', async () => {
      const user = userEvent.setup();
      renderPlain();
      await flushItemObserver();
      const list = screen.getByRole('list', { name: 'Fruits' });
      expect(list.tagName).toBe('UL');
      expect(list).toHaveAttribute('data-roving-container');
      expect(list).not.toHaveAttribute('aria-multiselectable');
      const all = screen.getAllByRole('listitem');
      expect(all.map((el) => el.tagName)).toEqual(['LI', 'LI', 'LI']);
      expect(all.map((el) => el.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
      for (const el of all) {
        expect(el).not.toHaveAttribute('aria-selected');
        expect(el).not.toHaveAttribute('data-selected');
        expect(el).toHaveClass(...focusRingInset.split(' '));
      }
      await user.tab();
      await user.tab();
      expect(listItem('Apple')).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('moves focus with ArrowDown/ArrowUp (wrapping) and Home/End', async () => {
      const user = userEvent.setup();
      renderPlain();
      act(() => listItem('Apple').focus());
      await user.keyboard('{ArrowDown}');
      expect(listItem('Banana')).toHaveFocus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(listItem('Apple')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(listItem('Cherry')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(listItem('Apple')).toHaveFocus();
      await user.keyboard('{End}');
      expect(listItem('Cherry')).toHaveFocus();
    });

    it('keeps the Tab stop on the item that last had focus', async () => {
      const user = userEvent.setup();
      renderPlain();
      act(() => listItem('Apple').focus());
      await user.keyboard('{ArrowDown}');
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(listItem('Banana')).toHaveAttribute('tabindex', '0');
      await user.tab({ shift: true });
      expect(listItem('Banana')).toHaveFocus();
    });

    it('jumps by typeahead when it has more than 7 items, and not with 7 or fewer', async () => {
      const user = userEvent.setup();
      const { unmount } = renderPlain({}, CITIES);
      await flushItemObserver();
      act(() => listItem('Amsterdam').focus());
      await user.keyboard('new y');
      expect(listItem('New York')).toHaveFocus();
      unmount();

      renderPlain();
      await flushItemObserver();
      act(() => listItem('Apple').focus());
      await user.keyboard('c');
      expect(listItem('Apple')).toHaveFocus();
    });

    it('keeps the actions of its items in the Tab order (no grid without composite)', async () => {
      const user = userEvent.setup();
      render(
        <List navigationMode="items" aria-label="Docs">
          {items(['Alpha', 'Beta'], (name) => ({
            action: <button type="button">Delete {name}</button>,
          }))}
        </List>,
      );
      await flushItemObserver();
      expect(screen.getByRole('list', { name: 'Docs' })).toBeInTheDocument();
      await user.tab();
      expect(listItem('Alpha')).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toHaveFocus();
      // ArrowDown from an action moves to the next item.
      await user.keyboard('{ArrowDown}');
      expect(listItem('Beta')).toHaveFocus();
    });

    it('has no axe violations', async () => {
      render(
        <List navigationMode="items" aria-label="Docs">
          {items(['Alpha', 'Beta'], (name) => ({
            action: <button type="button">Delete {name}</button>,
          }))}
        </List>,
      );
      await expectNoA11yViolations();
    });
  });

  describe('navigationMode="composite"', () => {
    it('renders a selectable list as a grid before any item has an action', () => {
      render(
        <List selectable selectionMode="multiple" navigationMode="composite" aria-label="Docs">
          {items(['Alpha', 'Beta'])}
        </List>,
      );
      const grid = screen.getByRole('grid', { name: 'Docs' });
      expect(grid.tagName).toBe('DIV');
      expect(grid).toHaveAttribute('aria-multiselectable', 'true');
      expect(row('Alpha')).toHaveAttribute('aria-selected', 'false');
      expect(row('Alpha').querySelectorAll('[role="gridcell"]')).toHaveLength(1);
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('keeps the items mounted, and focused, when the first action appears', async () => {
      const user = userEvent.setup();
      function Docs() {
        const [selected, setSelected] = React.useState<string[]>([]);
        return (
          <List
            selectable
            selectionMode="multiple"
            navigationMode="composite"
            aria-label="Docs"
            selectedItems={selected}
            onSelectionChange={setSelected}
          >
            {items(['Alpha', 'Beta'], (name) => ({
              action: selected.includes(name.toLowerCase()) ? (
                <button type="button">Delete {name}</button>
              ) : undefined,
            }))}
          </List>
        );
      }
      render(<Docs />);
      const alpha = row('Alpha');
      act(() => alpha.focus());
      await user.keyboard(' ');
      expect(row(/Alpha/)).toBe(alpha);
      expect(alpha).toHaveFocus();
      expect(alpha).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toHaveAttribute(
        'tabindex',
        '-1',
      );
      await user.keyboard(' ');
      expect(row('Alpha')).toBe(alpha);
      expect(alpha).toHaveFocus();
    });

    function PlainDocs(props: Partial<ListProps>) {
      return (
        <List navigationMode="composite" aria-label="Docs" {...props}>
          {items(['Alpha', 'Beta'], (name) => ({
            action: <button type="button">Delete {name}</button>,
          }))}
        </List>
      );
    }

    it('renders a plain list as a grid without aria-selected; actions are reached with the arrow keys', async () => {
      const user = userEvent.setup();
      render(
        <>
          <PlainDocs />
          <button type="button">After</button>
        </>,
      );
      await flushItemObserver();
      const grid = screen.getByRole('grid', { name: 'Docs' });
      expect(grid).not.toHaveAttribute('aria-multiselectable');
      for (const el of screen.getAllByRole('row')) {
        expect(el).not.toHaveAttribute('aria-selected');
        expect(el).not.toHaveAttribute('data-selected');
      }
      for (const button of screen.getAllByRole('button', { name: /Delete/ })) {
        expect(button).toHaveAttribute('tabindex', '-1');
      }
      await user.tab();
      expect(row(/Alpha/)).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowDown}');
      expect(row(/Beta/)).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('mirrors Left/Right in RTL (C-LOGICAL)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlainDocs />, { dir: 'rtl' });
      act(() => row(/Alpha/).focus());
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(row(/Alpha/)).toHaveFocus();
    });

    it('renders the grid on the server', () => {
      const html = renderToString(<PlainDocs />);
      expect(html).toContain('role="grid"');
      expect(html).toContain('role="row"');
      expect(html).not.toContain('aria-selected');
    });

    it('has no axe violations, plain and selectable', async () => {
      const { unmount } = render(<PlainDocs />);
      await expectNoA11yViolations();
      unmount();
      render(<PlainDocs selectable defaultSelectedItems={['beta']} />);
      await expectNoA11yViolations();
    });
  });

  it('navigationMode="items" on a selectable list with actions warns and acts as "composite"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(
      <List selectable navigationMode="items" aria-label="Docs">
        <List.Item value="a" action={<button type="button">Delete</button>}>
          Doc a
        </List.Item>
      </List>,
    );
    expect(screen.getByRole('grid', { name: 'Docs' })).toHaveAttribute(
      'data-navigation-mode',
      'composite',
    );
    rerender(
      <List selectable navigationMode="items" aria-label="Docs">
        <List.Item value="a">Doc a</List.Item>
      </List>,
    );
    // Without actions it is a listbox again.
    expect(screen.getByRole('listbox', { name: 'Docs' })).toHaveAttribute(
      'data-navigation-mode',
      'items',
    );
    expect(warn.mock.calls).toEqual([[WARNINGS.itemsWithActions]]);
  });

  it('navigationMode="items" on a selectable list without actions is the listbox, with no warning', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <List selectable navigationMode="items" aria-label="Fruits">
        {items(FRUITS)}
      </List>,
    );
    expect(screen.getByRole('listbox', { name: 'Fruits' })).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });

  it('navigationMode="none" on a selectable list warns and keeps the automatic mode', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <List selectable navigationMode="none" aria-label="Fruits">
        {items(FRUITS)}
      </List>,
    );
    const listbox = screen.getByRole('listbox', { name: 'Fruits' });
    expect(listbox).toHaveAttribute('data-navigation-mode', 'items');
    act(() => option('Apple').focus());
    await user.keyboard('{ArrowDown} ');
    expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
    expect(warn.mock.calls).toEqual([[WARNINGS.noneSelectable]]);
  });

  describe('an explicit navigationMode that changes while mounted', () => {
    function Docs({
      mode,
      withAction = false,
    }: {
      mode?: ListNavigationMode;
      withAction?: boolean;
    }) {
      return (
        <List navigationMode={mode} aria-label="Docs">
          {items(['Alpha', 'Beta', 'Gamma'], (name) => ({
            action: withAction ? <button type="button">Delete {name}</button> : undefined,
          }))}
        </List>
      );
    }

    it('items -> composite -> items remounts the items and keeps focus on the same one', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Docs mode="items" />);
      act(() => listItem('Alpha').focus());
      await user.keyboard('{ArrowDown}');
      expect(listItem('Beta')).toHaveFocus();
      rerender(<Docs mode="composite" />);
      expect(screen.getByRole('grid', { name: 'Docs' })).toBeInTheDocument();
      expect(row('Beta')).toHaveFocus();
      rerender(<Docs mode="items" />);
      expect(screen.getByRole('list', { name: 'Docs' })).toBeInTheDocument();
      expect(listItem('Beta')).toHaveFocus();
    });

    it('none -> items gives the items a Tab stop; items -> none takes it away again', async () => {
      const { rerender } = render(<Docs />);
      expect(listItem('Alpha')).not.toHaveAttribute('tabindex');
      rerender(<Docs mode="items" />);
      await flushItemObserver();
      expect(listItem('Alpha')).toHaveAttribute('tabindex', '0');
      expect(listItem('Beta')).toHaveAttribute('tabindex', '-1');
      rerender(<Docs mode="none" />);
      await flushItemObserver();
      for (const el of screen.getAllByRole('listitem')) expect(el).not.toHaveAttribute('tabindex');
      expect(screen.getByRole('list')).not.toHaveAttribute('data-roving-container');
    });

    it('items -> none moves focus from the focused item to its first focusable content', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Docs mode="items" withAction />);
      act(() => listItem('Alpha').focus());
      await user.keyboard('{ArrowDown}');
      expect(listItem('Beta')).toHaveFocus();
      rerender(<Docs mode="none" withAction />);
      expect(screen.getByRole('button', { name: 'Delete Beta' })).toHaveFocus();
    });

    it('composite -> none moves focus from the focused row to the same item content', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Docs mode="composite" withAction />);
      act(() => row(/Alpha/).focus());
      await user.keyboard('{ArrowDown}');
      rerender(<Docs mode="none" withAction />);
      expect(screen.getByRole('list', { name: 'Docs' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Beta' })).toHaveFocus();
    });

    it('a selectable list pinned to composite becomes a listbox when the pin is removed', async () => {
      const user = userEvent.setup();
      const docs = (mode?: ListNavigationMode) => (
        <List selectable navigationMode={mode} aria-label="Docs">
          {items(['Alpha', 'Beta'])}
        </List>
      );
      const { rerender } = render(docs('composite'));
      act(() => row('Alpha').focus());
      await user.keyboard('{ArrowDown}');
      rerender(docs(undefined));
      expect(screen.getByRole('listbox', { name: 'Docs' })).toBeInTheDocument();
      expect(option('Beta')).toHaveFocus();
    });
  });
});

describe('List.Item onAction (P9-06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs on click, Enter and Space in a list without selection, with the React event', async () => {
    const user = userEvent.setup();
    // React clears `currentTarget` after dispatch: read it in the handler.
    const calls: [string, EventTarget][] = [];
    const onAction = (event: ListItemActionEvent) => calls.push([event.type, event.currentTarget]);
    render(
      <List navigationMode="items" aria-label="Fruits">
        {items(FRUITS, (name) => (name === 'Banana' ? { onAction } : {}))}
      </List>,
    );
    await user.click(screen.getByText('Banana'));
    act(() => listItem('Banana').focus());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(calls).toEqual([
      ['click', listItem('Banana')],
      ['keydown', listItem('Banana')],
      ['keydown', listItem('Banana')],
    ]);
    expect(listItem('Banana')).toHaveClass('cursor-pointer', 'hover:bg-subtle-hover');
    expect(listItem('Apple')).not.toHaveClass('cursor-pointer');
    expect(listItem('Apple')).not.toHaveClass('hover:bg-subtle-hover');
  });

  it('a selectable item: click and Enter run it and then toggle the selection; Space only toggles', async () => {
    const user = userEvent.setup();
    const log: string[] = [];
    render(
      <List
        selectable
        selectionMode="multiple"
        aria-label="Fruits"
        onSelectionChange={(selected) => log.push(`select ${selected.join(',')}`)}
      >
        {items(FRUITS, (name) => ({
          onClick: () => log.push(`click ${name}`),
          onAction: (event) => log.push(`action ${name} ${event.type}`),
        }))}
      </List>,
    );
    await user.click(option('Apple'));
    act(() => option('Banana').focus());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(log).toEqual([
      'click Apple',
      'action Apple click',
      'select apple',
      'action Banana keydown',
      'select apple,banana',
      'select apple',
    ]);
  });

  it('onAction that calls preventDefault() keeps the selection (click and Enter)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAction = vi.fn((event: ListItemActionEvent) => event.preventDefault());
    render(
      <List selectable aria-label="Fruits" onSelectionChange={onChange}>
        {items(FRUITS, () => ({ onAction }))}
      </List>,
    );
    await user.click(option('Apple'));
    act(() => option('Banana').focus());
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
    // Space is the selection key: it toggles without running onAction.
    await user.keyboard(' ');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith(['banana']);
  });

  it('runs before the key is prevented, then prevents Enter and Space (no page scroll)', () => {
    const prevented: boolean[] = [];
    render(
      <List navigationMode="items" aria-label="Fruits">
        <List.Item onAction={(event) => prevented.push(event.isDefaultPrevented())}>
          Apple
        </List.Item>
        <List.Item>Banana</List.Item>
      </List>,
    );
    act(() => listItem('Apple').focus());
    expect(fireEvent.keyDown(listItem('Apple'), { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(listItem('Apple'), { key: ' ' })).toBe(false);
    expect(prevented).toEqual([false, false]);
    // An item with nothing to activate leaves the keys to the page.
    act(() => listItem('Banana').focus());
    expect(fireEvent.keyDown(listItem('Banana'), { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(listItem('Banana'), { key: 'Enter' })).toBe(true);
  });

  it('a consumer onClick or onKeyDown that calls preventDefault() skips onAction and the selection', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onChange = vi.fn();
    render(
      <List selectable aria-label="Fruits" onSelectionChange={onChange}>
        <List.Item
          value="apple"
          onAction={onAction}
          onClick={(event) => event.preventDefault()}
          onKeyDown={(event) => event.preventDefault()}
        >
          Apple
        </List.Item>
      </List>,
    );
    await user.click(option('Apple'));
    act(() => option('Apple').focus());
    await user.keyboard('{Enter}');
    expect(onAction).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a Space that continues a typeahead search runs no action', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <List navigationMode="items" aria-label="Cities">
        {items(CITIES, () => ({ onAction }))}
      </List>,
    );
    await flushItemObserver();
    act(() => listItem('Amsterdam').focus());
    await user.keyboard('new y');
    expect(listItem('New York')).toHaveFocus();
    expect(onAction).not.toHaveBeenCalled();
    // After the search has timed out, Space runs the action again.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    await user.keyboard(' ');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('a Space that continues a typeahead search in a selectable list neither selects nor acts', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onChange = vi.fn();
    render(
      <List selectable aria-label="Cities" onSelectionChange={onChange}>
        {items(CITIES, () => ({ onAction }))}
      </List>,
    );
    await flushItemObserver();
    act(() => option('Amsterdam').focus());
    await user.keyboard('new y');
    expect(option('New York')).toHaveFocus();
    expect(onAction).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a value-less item of a selectable list runs it on Space (it cannot be selected)', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onChange = vi.fn();
    render(
      <List selectable aria-label="Fruits" onSelectionChange={onChange}>
        <List.Item onAction={onAction}>All fruits</List.Item>
        <List.Item value="apple">Apple</List.Item>
      </List>,
    );
    act(() => option('All fruits').focus());
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicks and keys on interactive content or on an action never run it', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onDelete = vi.fn();
    render(
      <List navigationMode="composite" aria-label="Docs">
        <List.Item
          value="a"
          onAction={onAction}
          action={
            <button type="button" onClick={onDelete}>
              Delete
            </button>
          }
        >
          <a href="#doc-a">Open Doc a</a>
        </List.Item>
      </List>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const link = screen.getByRole('link', { name: 'Open Doc a' });
    await user.click(link);
    act(() => link.focus());
    await user.keyboard('{Enter}');
    act(() => row(/Doc a/).focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onDelete).toHaveBeenCalledTimes(3);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('runs on a focused grid row with Enter and, without selection, Space', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <List navigationMode="composite" aria-label="Docs">
        <List.Item value="a" onAction={onAction} action={<button type="button">Delete</button>}>
          Doc a
        </List.Item>
      </List>,
    );
    act(() => row(/Doc a/).focus());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(screen.getByText('Doc a'));
    expect(onAction).toHaveBeenCalledTimes(3);
  });

  it('leaves Enter and Space with Ctrl, Alt or Meta to the page', () => {
    const onAction = vi.fn();
    render(
      <List navigationMode="items" aria-label="Fruits">
        <List.Item onAction={onAction}>Apple</List.Item>
      </List>,
    );
    act(() => listItem('Apple').focus());
    for (const modifiers of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      for (const key of [' ', 'Enter']) {
        expect(fireEvent.keyDown(listItem('Apple'), { key, ...modifiers })).toBe(true);
      }
    }
    expect(onAction).not.toHaveBeenCalled();
  });

  it('runs once per activation in StrictMode', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onChange = vi.fn();
    render(
      <React.StrictMode>
        <List selectable aria-label="Fruits" onSelectionChange={onChange}>
          {items(FRUITS, () => ({ onAction }))}
        </List>
      </React.StrictMode>,
    );
    await user.click(option('Apple'));
    act(() => option('Banana').focus());
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls).toEqual([[['apple']], [['banana']]]);
  });

  it('on an item that is not navigable: clicks still run it, and a warning says keyboards cannot', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onAction = vi.fn();
    const { rerender } = render(
      <List aria-label="Fruits">
        <List.Item onAction={onAction}>Apple</List.Item>
        <List.Item onAction={onAction}>Banana</List.Item>
      </List>,
    );
    expect(listItem('Apple')).not.toHaveAttribute('tabindex');
    expect(listItem('Apple')).toHaveClass('cursor-pointer');
    await user.click(screen.getByText('Apple'));
    expect(onAction).toHaveBeenCalledTimes(1);
    rerender(
      <List aria-label="Fruits">
        <List.Item onAction={onAction}>Apple</List.Item>
      </List>,
    );
    expect(warn.mock.calls).toEqual([[WARNINGS.actionNotNavigable]]);
  });

  it('does not warn on navigable items', () => {
    const warn = vi.spyOn(console, 'warn');
    for (const props of [{ selectable: true }, { navigationMode: 'items' as const }]) {
      const { unmount } = render(
        <List aria-label="Fruits" {...props}>
          <List.Item value="apple" onAction={() => {}}>
            Apple
          </List.Item>
        </List>,
      );
      unmount();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves an item without onAction exactly as in 0.13 in a plain list', () => {
    const onClick = vi.fn();
    render(
      <List>
        <List.Item onClick={onClick}>Apple</List.Item>
      </List>,
    );
    fireEvent.click(listItem('Apple'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(listItem('Apple').className).toBe(
      'wave-list-item flex items-center border-b border-border px-4 py-2 text-body-1',
    );
  });
});

describe('List.Item disabledSelection (P9-06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderFruits(
    props: Partial<ListProps> = {},
    banana: Partial<ListItemProps> = { disabledSelection: true },
  ) {
    return render(
      <List selectable selectionMode="multiple" aria-label="Fruits" {...props}>
        {items(FRUITS, (name) => (name === 'Banana' ? banana : {}))}
      </List>,
    );
  }

  it('blocks toggling by click, Enter and Space, and marks the item aria-disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderFruits({ onSelectionChange: onChange });
    const banana = option('Banana');
    expect(banana).toHaveAttribute('aria-disabled', 'true');
    expect(banana).toHaveAttribute('data-disabled-selection', '');
    expect(banana).toHaveAttribute('data-disabled', '');
    expect(banana).toHaveAttribute('data-disabled-focusable', '');
    expect(banana).toHaveAttribute('aria-selected', 'false');
    expect(banana).toHaveClass('cursor-default');
    expect(banana).not.toHaveClass('cursor-pointer');
    expect(banana).not.toHaveClass('hover:bg-subtle-hover');
    await user.click(banana);
    act(() => banana.focus());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onChange).not.toHaveBeenCalled();
    expect(banana).toHaveAttribute('aria-selected', 'false');
    // Space is still the item's: it does not scroll the page.
    expect(fireEvent.keyDown(banana, { key: ' ' })).toBe(false);
    expect(option('Apple')).not.toHaveAttribute('aria-disabled');
    expect(option('Apple')).not.toHaveAttribute('data-disabled-selection');
  });

  it('keeps a selected item selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderFruits({ defaultSelectedItems: ['banana'], onSelectionChange: onChange });
    await user.click(option('Banana'));
    expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
    await user.click(option('Apple'));
    expect(onChange).toHaveBeenCalledWith(['banana', 'apple']);
  });

  it('stays in the arrow order and can hold the Tab stop (C-DISABLED)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <List selectable aria-label="Fruits">
          {items(FRUITS, (name) => (name === 'Apple' ? { disabledSelection: true } : {}))}
        </List>
        <button type="button">After</button>
      </>,
    );
    await flushItemObserver();
    expect(option('Apple')).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(option('Apple')).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowUp}');
    expect(option('Apple')).toHaveFocus();
    await user.keyboard('{End}{Home}');
    expect(option('Apple')).toHaveFocus();
  });

  it('with onAction: not aria-disabled, the action runs and the selection stays', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAction = vi.fn();
    renderFruits({ onSelectionChange: onChange }, { disabledSelection: true, onAction });
    const banana = option('Banana');
    expect(banana).not.toHaveAttribute('aria-disabled');
    expect(banana).not.toHaveAttribute('data-disabled');
    expect(banana).toHaveAttribute('data-disabled-selection', '');
    expect(banana).toHaveClass('cursor-pointer', 'hover:bg-subtle-hover');
    await user.click(banana);
    act(() => banana.focus());
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(2);
    // Space is the selection key of a selectable item, and its selection is disabled.
    await user.keyboard(' ');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('works on a grid row: aria-disabled, nothing toggles', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <List selectable aria-label="Docs" onSelectionChange={onChange}>
        <List.Item value="a" disabledSelection action={<button type="button">Delete</button>}>
          Doc a
        </List.Item>
      </List>,
    );
    const docRow = row(/Doc a/);
    expect(docRow).toHaveAttribute('aria-disabled', 'true');
    act(() => docRow.focus());
    await user.keyboard('{Enter} ');
    await user.click(screen.getByText('Doc a'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has no effect in a list without selection', () => {
    render(
      <List navigationMode="items" aria-label="Fruits">
        <List.Item disabledSelection>Apple</List.Item>
      </List>,
    );
    expect(listItem('Apple')).not.toHaveAttribute('aria-disabled');
    expect(listItem('Apple')).not.toHaveAttribute('data-disabled-selection');
  });

  it('keeps a consumer aria-disabled on an item without disabledSelection (0.13)', () => {
    renderFruits({}, { 'aria-disabled': true });
    expect(option('Banana')).toHaveAttribute('aria-disabled', 'true');
    expect(option('Banana')).not.toHaveAttribute('data-disabled-selection');
  });

  it('has no axe violations', async () => {
    renderFruits({ defaultSelectedItems: ['banana'] });
    await expectNoA11yViolations();
  });
});

describe('List checkmark (P9-06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws nothing without the opt-in: the default look is unchanged', () => {
    const { container } = render(
      <List selectable aria-label="Fruits" defaultSelectedItems={['apple']}>
        {items(FRUITS)}
      </List>,
    );
    expect(container.querySelector(`.${listItemClassNames.checkmark}`)).toBeNull();
    expect(screen.getByRole('listbox')).not.toHaveAttribute('data-checkmark');
  });

  it('List checkmark: a decorative check on every item, drawn while the item is selected', async () => {
    const user = userEvent.setup();
    render(
      <List selectable checkmark aria-label="Fruits" defaultSelectedItems={['apple']}>
        {items(FRUITS)}
      </List>,
    );
    expect(screen.getByRole('listbox')).toHaveAttribute('data-checkmark', '');
    const apple = checkmarkOf(option('Apple'));
    const banana = checkmarkOf(option('Banana'));
    expect(apple).not.toBeNull();
    expect(banana).not.toBeNull();
    for (const mark of [apple, banana]) {
      expect(mark).toHaveAttribute('aria-hidden', 'true');
      expect(mark?.querySelector('svg')).not.toBeNull();
      // Logical margin before the content; drawn first although it follows the content in the DOM,
      // so typeahead reads the item's text first.
      expect(mark).toHaveClass('me-2', 'order-first', 'text-primary');
      expect(mark).toHaveClass(
        'forced-colors:text-[Highlight]',
        'forced-colors:forced-color-adjust-none',
      );
      expect(mark?.className).not.toMatch(/\b(ml|mr|pl|pr)-/);
    }
    expect(apple).not.toHaveClass('invisible');
    expect(banana).toHaveClass('invisible');
    // The accessible name stays the item's text.
    expect(option('Banana')).toBeInTheDocument();
    await user.click(option('Banana'));
    expect(checkmarkOf(option('Banana'))).not.toHaveClass('invisible');
    expect(checkmarkOf(option('Apple'))).toHaveClass('invisible');
  });

  it('an item checkmark replaces the glyph; false hides it; null and undefined keep the default', () => {
    render(
      <List
        selectable
        selectionMode="multiple"
        checkmark
        aria-label="Fruits"
        defaultSelectedItems={['apple', 'banana']}
      >
        <List.Item value="apple" checkmark={<span data-testid="star">*</span>}>
          Apple
        </List.Item>
        <List.Item value="banana" checkmark={false}>
          Banana
        </List.Item>
        <List.Item value="cherry" checkmark={null}>
          Cherry
        </List.Item>
        <List.Item value="date" checkmark={[]}>
          Date
        </List.Item>
        <List.Item value="elder">Elder</List.Item>
      </List>,
    );
    const apple = checkmarkOf(option('Apple'));
    expect(apple).toContainElement(screen.getByTestId('star'));
    expect(apple).toHaveAttribute('aria-hidden', 'true');
    expect(apple?.querySelector('svg')).toBeNull();
    expect(checkmarkOf(option('Banana'))).toBeNull();
    expect(checkmarkOf(option('Date'))).toBeNull();
    expect(checkmarkOf(option('Cherry'))?.querySelector('svg')).not.toBeNull();
    expect(checkmarkOf(option('Elder'))?.querySelector('svg')).not.toBeNull();
  });

  it('an item checkmark draws without the List opt-in, and a slot object merges its classes', () => {
    render(
      <List selectable aria-label="Fruits" defaultSelectedItems={['apple']}>
        <List.Item value="apple" checkmark={{ className: 'text-success', children: '+' }}>
          Apple
        </List.Item>
        <List.Item value="banana">Banana</List.Item>
      </List>,
    );
    const apple = checkmarkOf(option('Apple'));
    expect(apple).toHaveTextContent('+');
    expect(apple).toHaveClass(listItemClassNames.checkmark, 'me-2', 'text-success');
    expect(apple).not.toHaveClass('text-primary');
    expect(checkmarkOf(option('Banana'))).toBeNull();
  });

  it('a text glyph does not break typeahead (the check follows the content in the DOM)', async () => {
    const user = userEvent.setup();
    render(
      <List selectable checkmark aria-label="Cities">
        {items(CITIES, () => ({ checkmark: 'v' }))}
      </List>,
    );
    await flushItemObserver();
    act(() => option('Amsterdam').focus());
    await user.keyboard('o');
    expect(option('Oslo')).toHaveFocus();
  });

  it('a list without selection draws no checkmark', () => {
    const { container } = render(
      <List navigationMode="items" checkmark aria-label="Fruits">
        <List.Item value="apple" checkmark={<span>*</span>}>
          Apple
        </List.Item>
      </List>,
    );
    expect(container.querySelector(`.${listItemClassNames.checkmark}`)).toBeNull();
    expect(screen.getByRole('list')).not.toHaveAttribute('data-checkmark');
  });

  it('a disabled selection draws its check muted, GrayText in forced colors', () => {
    render(
      <List selectable checkmark aria-label="Fruits" defaultSelectedItems={['apple']}>
        <List.Item value="apple" disabledSelection>
          Apple
        </List.Item>
      </List>,
    );
    const mark = checkmarkOf(option('Apple'));
    expect(mark).toHaveClass(
      'text-muted-foreground',
      'forced-colors:text-[GrayText]',
      'forced-colors:forced-color-adjust-none',
    );
    expect(mark).not.toHaveClass('text-primary');
  });

  it('draws in grid rows, outside the cells; RTL keeps the logical margin', () => {
    renderWithProviders(
      <List selectable checkmark aria-label="Docs" defaultSelectedItems={['a']}>
        <List.Item value="a" action={<button type="button">Delete</button>}>
          Doc a
        </List.Item>
      </List>,
      { dir: 'rtl' },
    );
    const mark = checkmarkOf(row(/Doc a/));
    expect(mark?.parentElement).toBe(row(/Doc a/));
    expect(mark?.closest('[role="gridcell"]')).toBeNull();
    expect(mark).toHaveClass('me-2');
  });

  it('has no axe violations in a listbox and in a grid', async () => {
    const { unmount } = render(
      <List selectable checkmark aria-label="Fruits" defaultSelectedItems={['apple']}>
        {items(FRUITS)}
      </List>,
    );
    await expectNoA11yViolations();
    unmount();
    render(
      <List selectable checkmark aria-label="Docs" defaultSelectedItems={['a']}>
        <List.Item value="a" action={<button type="button">Delete</button>}>
          Doc a
        </List.Item>
        <List.Item value="b">Doc b</List.Item>
      </List>,
    );
    await expectNoA11yViolations();
  });
});

describe('List 0.14 types', () => {
  it('types navigationMode, checkmark, onAction and disabledSelection', () => {
    expectTypeOf<ListNavigationMode>().toEqualTypeOf<'none' | 'items' | 'composite'>();
    expectTypeOf<ListProps['navigationMode']>().toEqualTypeOf<ListNavigationMode | undefined>();
    expectTypeOf<ListProps['checkmark']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ListItemActionEvent>().toEqualTypeOf<
      React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
    >();
    expectTypeOf<ListItemProps['onAction']>().toEqualTypeOf<
      ((event: ListItemActionEvent) => void) | undefined
    >();
    expectTypeOf<ListItemProps['disabledSelection']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ListItemProps['checkmark']>().toEqualTypeOf<Slot<'span'> | undefined>();

    // @ts-expect-error 'grid' is no navigation mode
    const mode: ListNavigationMode = 'grid';
    expect(mode).toBe('grid');
  });
});
