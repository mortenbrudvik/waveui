import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Combobox } from '../Combobox';
import { DatePicker } from '../DatePicker';
import { Dropdown } from '../Dropdown';
import { Option } from '../Option';
import { PickerClearButton } from '../PickerClearButton';
import { SearchBox } from '../SearchBox';
import { TimePicker } from '../TimePicker';

/*
 * The clear button of the five controls keeps focus in the control when a value is cleared from
 * outside while the button has focus: the button goes away with the value, and focus would fall to
 * `<body>`.
 */

interface Case {
  name: string;
  /** The control with a value. */
  filled: React.ReactElement;
  /** The same control with the value cleared from outside. */
  cleared: React.ReactElement;
  /** The element focus belongs on. */
  target: () => HTMLElement;
  clearName: RegExp;
}

const FRUIT = [
  <Option key="apple" value="apple">
    Apple
  </Option>,
  <Option key="banana" value="banana">
    Banana
  </Option>,
];

const CASES: Case[] = [
  {
    name: 'Combobox',
    filled: (
      <Combobox aria-label="Fruit" clearable value="apple">
        {FRUIT}
      </Combobox>
    ),
    cleared: (
      <Combobox aria-label="Fruit" clearable value="">
        {FRUIT}
      </Combobox>
    ),
    target: () => screen.getByRole('combobox', { name: 'Fruit' }),
    clearName: /clear selection/i,
  },
  {
    name: 'Dropdown',
    filled: (
      <Dropdown aria-label="Fruit" clearable value="apple">
        {FRUIT}
      </Dropdown>
    ),
    cleared: (
      <Dropdown aria-label="Fruit" clearable value="">
        {FRUIT}
      </Dropdown>
    ),
    target: () => screen.getByRole('combobox', { name: 'Fruit' }),
    clearName: /clear selection/i,
  },
  {
    name: 'DatePicker',
    filled: <DatePicker aria-label="Day" clearable value={new Date(2026, 0, 15)} locale="en-US" />,
    cleared: <DatePicker aria-label="Day" clearable value={null} locale="en-US" />,
    target: () => screen.getByRole('textbox', { name: 'Day' }),
    clearName: /clear date/i,
  },
  {
    name: 'TimePicker',
    filled: <TimePicker aria-label="Time" clearable value="10:30" />,
    cleared: <TimePicker aria-label="Time" clearable value="" />,
    target: () => screen.getByRole('combobox', { name: 'Time' }),
    clearName: /clear time/i,
  },
  {
    name: 'SearchBox',
    filled: <SearchBox aria-label="Search" value="query" />,
    cleared: <SearchBox aria-label="Search" value="" />,
    target: () => screen.getByRole('searchbox', { name: 'Search' }),
    clearName: /clear/i,
  },
];

describe.each(CASES)('$name clear button focus', ({ filled, cleared, target, clearName }) => {
  it('moves focus to the control when the value is cleared from outside while the button has focus', async () => {
    const { rerender } = render(filled);
    const button = screen.getByRole('button', { name: clearName });
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    rerender(cleared);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: clearName })).toBeNull();
    expect(document.activeElement).toBe(target());
  });

  it('leaves focus where it is when another element has it', async () => {
    const outside = document.createElement('button');
    outside.type = 'button';
    document.body.append(outside);
    try {
      const { rerender } = render(filled);
      act(() => outside.focus());
      rerender(cleared);
      await act(async () => {});
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });
});

describe('PickerClearButton', () => {
  it('renders a button of type button, with its own ref and the props it is given', () => {
    const ref = React.createRef<HTMLButtonElement>();
    const fallback = React.createRef<HTMLInputElement>();
    render(
      <>
        <input ref={fallback} aria-label="Field" />
        <PickerClearButton ref={ref} fallbackRef={fallback} aria-label="Clear" data-x="1" />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Clear' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-x', '1');
    expect(ref.current).toBe(button);
  });

  it('ignores a fallback that is gone', async () => {
    const fallback = { current: null } as React.RefObject<HTMLElement | null>;
    const { rerender } = render(
      <PickerClearButton fallbackRef={fallback} aria-label="Clear">
        x
      </PickerClearButton>,
    );
    act(() => screen.getByRole('button', { name: 'Clear' }).focus());
    rerender(<div />);
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
  });
});
