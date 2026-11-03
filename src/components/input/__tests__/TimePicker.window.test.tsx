import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePicker, type TimePickerProps } from '../TimePicker';
import { timePickerClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';
import type { VirtualWindow } from '../../../hooks/useVirtualWindow';
import {
  installWindowStubs,
  ITEM_SIZE,
  order,
  range,
  scrollList,
  spacers,
  useTestWindow,
  VIEWPORT,
  type TestWindowOptions,
} from './windowHarness';

/** A step of one minute makes 1,440 options. */
const COUNT = 1440;

beforeEach(() => {
  installWindowStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

type WindowedProps = Partial<TimePickerProps> & { windowOptions?: TestWindowOptions };

function WindowedTimePicker({ windowOptions, ...props }: WindowedProps) {
  const virtualWindow = useTestWindow(windowOptions);
  return (
    <TimePicker aria-label="Time" format="24h" step={1} {...props} virtualWindow={virtualWindow} />
  );
}

const input = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Time' });
const list = () => screen.getByRole('listbox');
const options = () => screen.queryAllByRole('option');

function activeOption(): HTMLElement | null {
  const id = input().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

describe('TimePicker windowed options (virtualWindow)', () => {
  it('mounts at most 30 of 1,440 options, each 32 pixels tall, with spacers for the others', async () => {
    const user = userEvent.setup();
    render(<WindowedTimePicker />);
    await user.click(input());
    // 250 pixels show 8 options; 8 more (the default overscan of 240 pixels) are rendered below.
    expect(order(list())).toEqual([...range(1, 17), 'spacer']);
    const [end] = spacers(list());
    expect(end).toHaveAttribute('aria-hidden', 'true');
    expect(end).toHaveAttribute('role', 'presentation');
    expect(end).toHaveClass(timePickerClassNames.spacer);
    expect(end).toHaveStyle({ height: `${(COUNT - 16) * ITEM_SIZE}px`, flexShrink: '0' });
    for (const option of options()) {
      expect(option).toHaveAttribute('aria-setsize', String(COUNT));
      expect(option).toHaveStyle({ height: '32px', boxSizing: 'border-box', flexShrink: '0' });
    }
    expect(options()[0]).toHaveAccessibleName('00:00');
    scrollList(list(), 600 * ITEM_SIZE);
    expect(options().length).toBeLessThanOrEqual(30);
    expect(order(list())).toEqual(['spacer', ...range(593, 617), 'spacer']);
  });

  it('renders no option while closed, and keeps the list for aria-controls', () => {
    render(<WindowedTimePicker />);
    expect(options()).toHaveLength(0);
    expect(document.querySelector(`.${timePickerClassNames.listbox}`)).not.toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input()).toHaveAttribute('aria-expanded', 'false');
  });

  it('turns the block padding and the scroll anchoring off while windowed, and keeps them without a window', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WindowedTimePicker />);
    await user.click(input());
    expect(list()).toHaveClass('wave:[overflow-anchor:none]');
    expect(list()).not.toHaveClass('wave:py-1');
    unmount();
    render(<TimePicker aria-label="Time" format="24h" step={60} />);
    await user.click(input());
    expect(list()).not.toHaveClass('wave:[overflow-anchor:none]');
    expect(list()).toHaveClass('wave:py-1');
  });

  it('opens on the selected time, centered', async () => {
    const user = userEvent.setup();
    render(<WindowedTimePicker defaultValue="12:00" />);
    await user.click(input());
    // 12:00 is option 720; it is rendered, selected, and in the middle of the list.
    const selected = within(list()).getByRole('option', { name: '12:00', selected: true });
    expect(selected).toHaveAttribute('aria-posinset', '721');
    expect(list().scrollTop).toBe(720 * ITEM_SIZE + ITEM_SIZE / 2 - VIEWPORT / 2);
  });

  it('moves over every option with the arrow keys, keeping the active option rendered', async () => {
    const user = userEvent.setup();
    render(<WindowedTimePicker />);
    input().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveAccessibleName('00:00');
    await user.keyboard('{ArrowDown}'.repeat(25));
    expect(activeOption()).toHaveAccessibleName('00:25');
    expect(within(list()).getByRole('option', { name: '00:25' })).toBe(activeOption());
    // The window moved with it, in the same update.
    expect(options().length).toBeLessThanOrEqual(30);
    scrollList(list(), 900 * ITEM_SIZE);
    // Scrolled far away, the active option stays rendered for aria-activedescendant.
    expect(activeOption()).toHaveAccessibleName('00:25');
    expect(
      document.getElementById(input().getAttribute('aria-activedescendant') ?? ''),
    ).not.toBeNull();
  });

  it('narrows the window and aria-setsize when typing, and commits the active option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<WindowedTimePicker onValueChange={onValueChange} />);
    await user.click(input());
    await user.type(input(), '13:3');
    // 13:30 … 13:39.
    expect(options().length).toBeLessThanOrEqual(10);
    for (const option of options()) expect(option).toHaveAttribute('aria-setsize', '10');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith('13:31');
  });

  it('commits an option picked with the pointer', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<WindowedTimePicker onValueChange={onValueChange} />);
    await user.click(input());
    await user.click(within(list()).getByRole('option', { name: '00:07' }));
    expect(onValueChange).toHaveBeenCalledWith('00:07');
  });

  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    render(<WindowedTimePicker />);
    await user.click(input());
    await expectNoA11yViolations();
  });

  it('passes the option parts through slotProps', async () => {
    const user = userEvent.setup();
    render(<WindowedTimePicker slotProps={{ option: { 'data-part': 'yes' } as never }} />);
    await user.click(input());
    expect(options()[0]).toHaveAttribute('data-part', 'yes');
  });

  it('types virtualWindow', () => {
    expectTypeOf<TimePickerProps['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
  });
});
