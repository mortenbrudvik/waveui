import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Listbox, type ListboxProps } from '../Listbox';
import { Option, type ListboxOptionRenderState } from '../Option';
import { expectNoA11yViolations, findDanglingIdRefsInHtml } from '../../../test-utils';
import { __getAnnouncerText, __resetAnnouncer } from '../../../hooks/useAnnounce';
import { collectOptionLabels, type ListboxItem } from '../../../hooks/useListbox';

// Pass-through spy: data mode reads no labels from children.
vi.mock('../../../hooks/useListbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useListbox')>();
  return { ...actual, collectOptionLabels: vi.fn(actual.collectOptionLabels) };
});

/** Item 0 … Item 499, values `item-0` … `item-499`. */
const ITEMS: readonly ListboxItem[] = Array.from({ length: 500 }, (_, i) => ({
  value: `item-${i}`,
  label: `Item ${i}`,
}));

const BOTH_SOURCES =
  '[WaveUI] Listbox: `items` and option children were both passed. The options render from ' +
  '`items` and the children are ignored: pass one of them.';

const list = () => screen.getByRole('listbox', { name: 'Items' });

/** The option the list's `aria-activedescendant` points at. */
function activeOption(): HTMLElement | null {
  const id = list().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function renderData(props: Partial<ListboxProps> = {}) {
  return render(<Listbox aria-label="Items" items={ITEMS} {...props} />);
}

afterEach(() => {
  __resetAnnouncer();
});

describe('Listbox data mode (items)', () => {
  it('renders an option per item, with its position from the data', () => {
    renderData();
    const shown = screen.getAllByRole('option');
    expect(shown).toHaveLength(500);
    shown.forEach((option, index) => {
      expect(option).toHaveAttribute('aria-posinset', String(index + 1));
      expect(option).toHaveAttribute('aria-setsize', '500');
    });
    expect(shown[499]).toHaveAccessibleName('Item 499');
  });

  it('selects by click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.click(screen.getByRole('option', { name: 'Item 321' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-321');
    expect(list()).toHaveFocus();
    expect(activeOption()).toHaveTextContent('Item 321');
    expect(screen.getByRole('option', { name: 'Item 321' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('selects by keyboard: End, PageUp, Home and the arrows go by the data', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.tab();
    expect(list()).toHaveFocus();
    expect(activeOption()).toHaveTextContent('Item 0');
    await user.keyboard('{End}');
    expect(activeOption()).toHaveTextContent('Item 499');
    expect(activeOption()).toHaveAttribute('aria-posinset', '500');
    await user.keyboard('{PageUp}{ArrowUp}');
    expect(activeOption()).toHaveTextContent('Item 488');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-488');
    await user.keyboard('{Home}{ArrowDown} ');
    expect(onValueChange).toHaveBeenLastCalledWith('item-1');
  });

  it('selects by typeahead over the labels of items', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.tab();
    await user.keyboard('Item 42');
    expect(activeOption()).toHaveTextContent('Item 42');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-42');
  });

  it('starts on a selected item deep in the data, which is mounted', async () => {
    const user = userEvent.setup();
    renderData({ defaultValue: 'item-450' });
    await user.tab();
    const active = activeOption();
    expect(active).toHaveTextContent('Item 450');
    expect(list()).toContainElement(active);
    expect(active).toHaveAttribute('aria-selected', 'true');
  });

  it('renders a disabled item as a disabled option that the keys skip', async () => {
    const user = userEvent.setup();
    const items = ITEMS.slice(0, 3).map((item) =>
      item.value === 'item-1' ? { ...item, disabled: true } : item,
    );
    render(<Listbox aria-label="Items" items={items} />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 2');
    expect(screen.getByRole('option', { name: 'Item 1' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('passes each item and its state to renderOption', async () => {
    const user = userEvent.setup();
    const renderOption = vi.fn((item: ListboxItem, state: ListboxOptionRenderState) => (
      <Option value={item.value} label={item.label}>
        {item.label}
        {state.selected && ' (selected)'}
        {state.active && ' (active)'}
      </Option>
    ));
    renderData({ defaultValue: 'item-5', renderOption });
    expect(renderOption).toHaveBeenCalledTimes(500);
    expect(renderOption).toHaveBeenCalledWith(ITEMS[5], {
      selected: true,
      active: false,
      index: 5,
    });
    renderOption.mockClear();
    await user.tab();
    expect(renderOption.mock.calls).toEqual([
      [ITEMS[5], { selected: true, active: true, index: 5 }],
    ]);
    expect(activeOption()).toHaveTextContent('Item 5 (selected) (active)');
  });

  it('warns once when both items and option children are passed, and items wins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Listbox aria-label="Items" items={ITEMS.slice(0, 2)}>
        <Option value="x">Extra</Option>
      </Listbox>,
    );
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Item 0',
      'Item 1',
    ]);
    view.rerender(
      <Listbox aria-label="Items" items={ITEMS.slice(0, 2)}>
        <Option value="y">Other</Option>
      </Listbox>,
    );
    expect(warn.mock.calls).toEqual([[BOTH_SOURCES]]);
    warn.mockRestore();
  });

  it('reads no labels from children in data mode', async () => {
    const user = userEvent.setup();
    const collect = vi.mocked(collectOptionLabels);
    collect.mockClear();
    renderData();
    await user.click(screen.getByRole('option', { name: 'Item 8' }));
    expect(collect).not.toHaveBeenCalled();
  });

  it('renders the positions in the server HTML, with no dangling id', () => {
    const html = renderToString(
      <Listbox aria-label="Items" items={ITEMS.slice(0, 3)} defaultValue="item-1" />,
    );
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = html;
    const shown = parsed.querySelectorAll('[role="option"]');
    expect(Array.from(shown, (option) => option.getAttribute('aria-posinset'))).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(shown[1]).toHaveAttribute('aria-setsize', '3');
    expect(shown[1]).toHaveAttribute('aria-selected', 'true');
  });

  describe('multiselect', () => {
    it('keeps values that are not items and announces the label from items', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Listbox
          aria-label="Items"
          multiselect
          items={ITEMS}
          defaultValue={['gone', 'item-1']}
          onValueChange={onValueChange}
        />,
      );
      await user.click(screen.getByRole('option', { name: 'Item 400' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['gone', 'item-1', 'item-400']);
      await waitFor(() => expect(__getAnnouncerText()).toBe('Item 400 added, 3 selected'));
      await user.click(screen.getByRole('option', { name: 'Item 1' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['gone', 'item-400']);
    });
  });

  it('fires the value callback once per selection in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Listbox aria-label="Items" items={ITEMS} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('option', { name: 'Item 42' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-42');
  });

  it('follows new items', async () => {
    const { rerender } = renderData();
    act(() => rerender(<Listbox aria-label="Items" items={ITEMS.slice(10, 12)} />));
    const shown = screen.getAllByRole('option');
    expect(shown.map((option) => option.textContent)).toEqual(['Item 10', 'Item 11']);
    expect(shown[1]).toHaveAttribute('aria-setsize', '2');
    expect(shown[1]).toHaveAttribute('aria-posinset', '2');
  });

  // axe over 500 options takes about 3 s in jsdom alone, more under a loaded runner, hence the
  // 20 s timeout.
  it('has no axe violations with the list focused', async () => {
    const user = userEvent.setup();
    renderData({ defaultValue: 'item-3' });
    await user.tab();
    await expectNoA11yViolations();
  }, 20_000);

  it('types items and renderOption', () => {
    expectTypeOf<ListboxProps['items']>().toEqualTypeOf<readonly ListboxItem[] | undefined>();
    expectTypeOf<ListboxProps<true>['renderOption']>().toEqualTypeOf<
      ((item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode) | undefined
    >();
  });
});
