import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker, type TagPickerProps } from '../TagPicker';
import { tagPickerClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';
import type { VirtualWindow } from '../../../hooks/useVirtualWindow';
import {
  COUNT,
  installWindowStubs,
  ITEM_SIZE,
  MANY_ITEMS,
  order,
  range,
  scrollList,
  spacers,
  useTestWindow,
  type TestWindowOptions,
} from './windowHarness';

const OPTIONS = MANY_ITEMS.map((item) => ({ value: item.value, label: item.label }));

beforeEach(() => {
  installWindowStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

type WindowedProps = Partial<TagPickerProps> & { windowOptions?: TestWindowOptions };

function WindowedTagPicker({ windowOptions, ...props }: WindowedProps) {
  const virtualWindow = useTestWindow(windowOptions);
  return (
    <TagPicker aria-label="Items" options={OPTIONS} {...props} virtualWindow={virtualWindow} />
  );
}

const input = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Items' });
const list = () => screen.getByRole('listbox');
const options = () => screen.queryAllByRole('option');

function activeOption(): HTMLElement | null {
  const id = input().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

describe('TagPicker windowed options (virtualWindow)', () => {
  it('mounts at most 30 of 10,000 options, each 32 pixels tall, with spacers for the others', async () => {
    const user = userEvent.setup();
    render(<WindowedTagPicker />);
    await user.click(input());
    expect(order(list())).toEqual([...range(1, 17), 'spacer']);
    const [end] = spacers(list());
    expect(end).toHaveAttribute('aria-hidden', 'true');
    expect(end).toHaveAttribute('role', 'presentation');
    expect(end).toHaveClass(tagPickerClassNames.spacer);
    expect(end).toHaveStyle({ height: `${(COUNT - 16) * ITEM_SIZE}px`, flexShrink: '0' });
    for (const option of options()) {
      expect(option).toHaveAttribute('aria-setsize', String(COUNT));
      expect(option).toHaveClass(tagPickerClassNames.option);
      expect(option).toHaveStyle({ height: '32px', boxSizing: 'border-box', flexShrink: '0' });
    }
    scrollList(list(), 5000 * ITEM_SIZE);
    expect(options().length).toBeLessThanOrEqual(30);
    expect(order(list())).toEqual(['spacer', ...range(4993, 5017), 'spacer']);
  });

  it('renders no option while closed, and turns the scroll anchoring off on the shown list', async () => {
    const user = userEvent.setup();
    render(<WindowedTagPicker />);
    expect(options()).toHaveLength(0);
    await user.click(input());
    expect(list()).toHaveClass('wave:[overflow-anchor:none]');
  });

  it('adds the option that is clicked, skipping the options already selected', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<WindowedTagPicker onValueChange={onValueChange} />);
    await user.click(input());
    await user.click(within(list()).getByRole('option', { name: 'Item 3' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['item-3']);
    // The selected option leaves the list: the window counts 9,999 options.
    for (const option of options()) expect(option).toHaveAttribute('aria-setsize', '9999');
    expect(within(list()).queryByRole('option', { name: 'Item 3' })).toBeNull();
  });

  it('moves over every option with the arrow keys and keeps the active option rendered', async () => {
    const user = userEvent.setup();
    render(<WindowedTagPicker />);
    input().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveAccessibleName('Item 0');
    await user.keyboard('{ArrowDown}'.repeat(20));
    expect(activeOption()).toHaveAccessibleName('Item 20');
    scrollList(list(), 5000 * ITEM_SIZE);
    expect(activeOption()).toHaveAccessibleName('Item 20');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Remove Item 20' })).toBeInTheDocument();
  });

  it('narrows the window and aria-setsize while typing', async () => {
    const user = userEvent.setup();
    render(<WindowedTagPicker />);
    await user.click(input());
    await user.type(input(), 'Item 55');
    // Item 55, 550 … 559 and 5500 … 5599.
    expect(activeOption()).toHaveAccessibleName('Item 55');
    for (const option of options()) expect(option).toHaveAttribute('aria-setsize', '111');
  });

  it('renders the create option last, as the window’s final item', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    render(
      <WindowedTagPicker
        options={OPTIONS.slice(0, 5)}
        allowCreate
        onOptionCreate={onOptionCreate}
      />,
    );
    await user.click(input());
    await user.type(input(), 'zzz');
    const create = within(list()).getByRole('option', { name: 'Create "zzz"' });
    expect(create).toHaveAttribute('data-create');
    expect(create).toHaveAttribute('aria-posinset', '1');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onOptionCreate).toHaveBeenCalledWith('zzz', { event: expect.any(Event) });
  });

  it('ignores the window beside a List with children, with one development warning', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function Parts() {
      const virtualWindow = useTestWindow();
      return (
        <TagPicker aria-label="Items" virtualWindow={virtualWindow}>
          <TagPicker.Control>
            <TagPicker.Group />
            <TagPicker.Input />
          </TagPicker.Control>
          <TagPicker.List>
            <TagPicker.Option value="a">A</TagPicker.Option>
            <TagPicker.Option value="b">B</TagPicker.Option>
          </TagPicker.List>
        </TagPicker>
      );
    }
    render(<Parts />);
    await user.click(input());
    expect(options()).toHaveLength(2);
    expect(spacers(list())).toHaveLength(0);
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[WaveUI] TagPicker: `virtualWindow` is ignored with a `TagPicker.List` that has children: ' +
        'only the options of the array form (`options`) are windowed, so every option child is ' +
        'rendered. Pass the options as `options`.',
    ]);
  });

  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    render(<WindowedTagPicker />);
    await user.click(input());
    await expectNoA11yViolations();
  });

  it('types virtualWindow', () => {
    expectTypeOf<TagPickerProps['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
  });
});
