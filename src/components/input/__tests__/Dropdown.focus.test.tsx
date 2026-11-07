import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from '../Dropdown';
import { Option } from '../Option';

function renderDropdown(props: Partial<React.ComponentProps<typeof Dropdown>> = {}) {
  return render(
    <>
      <button type="button">before</button>
      <Dropdown aria-label="Fruit" {...props}>
        <Option value="apple">Apple</Option>
        <Option value="banana">Banana</Option>
      </Dropdown>
    </>,
  );
}

const combobox = () => screen.getByRole('combobox', { name: 'Fruit' });

describe('Dropdown focus on a mouse press', () => {
  it('focuses the button on pointerdown, as WebKit does not on a mouse press', () => {
    renderDropdown();
    expect(document.activeElement).toBe(document.body);
    fireEvent.pointerDown(combobox(), { button: 0, pointerType: 'mouse' });
    expect(document.activeElement).toBe(combobox());
  });

  it('keeps the keys working after a mouse click opens the list', async () => {
    const user = userEvent.setup();
    renderDropdown();
    // user-event focuses a clicked button as Chromium does; the pointerdown handler is the same.
    await user.click(combobox());
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(combobox());
    await user.keyboard('{End}');
    expect(combobox().getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Banana' }).id,
    );
  });

  it('does not move focus for a press with another button', () => {
    renderDropdown();
    fireEvent.pointerDown(combobox(), { button: 2, pointerType: 'mouse' });
    expect(document.activeElement).toBe(document.body);
  });

  it('does not focus a disabled Dropdown', () => {
    renderDropdown({ disabled: true });
    fireEvent.pointerDown(combobox(), { button: 0, pointerType: 'mouse' });
    expect(document.activeElement).toBe(document.body);
  });

  it('calls onFocus once for the press', () => {
    const onFocus = vi.fn();
    renderDropdown({ onFocus });
    fireEvent.pointerDown(combobox(), { button: 0, pointerType: 'mouse' });
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('leaves focus alone when the button has it already', () => {
    const onFocus = vi.fn();
    renderDropdown({ onFocus });
    combobox().focus();
    onFocus.mockClear();
    fireEvent.pointerDown(combobox(), { button: 0, pointerType: 'mouse' });
    expect(onFocus).not.toHaveBeenCalled();
  });

  it('lets a button part keep the press from focusing, with preventDefault()', () => {
    const onPointerDown = vi.fn((event: React.PointerEvent) => event.preventDefault());
    renderDropdown({ slotProps: { button: { onPointerDown } } });
    fireEvent.pointerDown(combobox(), { button: 0, pointerType: 'mouse' });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.body);
  });

  it('runs the part handler first and then focuses', () => {
    const calls: string[] = [];
    const onFocus = () => calls.push('focus');
    renderDropdown({
      onFocus,
      slotProps: { button: { onPointerDown: () => calls.push('part') } },
    });
    fireEvent.pointerDown(combobox(), { button: 0, pointerType: 'mouse' });
    expect(calls).toEqual(['part', 'focus']);
  });
});
