/**
 * TagPicker's single-line layout (spec P6-04 D62): `overflow="count"`, the tags that do not fit
 * hidden behind an aria-hidden "+N", measured by `useTagOverflow`.
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { TagPicker } from '../TagPicker';
import type { TagPickerProps } from '../TagPicker';
import {
  installResizeObserverMock,
  mockRect,
  renderWithProviders,
  type ResizeObserverMock,
} from '../../../test-utils';
import { tagPickerClassNames } from '../../../lib/classNames';

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
];

let ro: ResizeObserverMock;

beforeEach(() => {
  ro = installResizeObserverMock();
});

afterEach(() => {
  ro.restore();
  vi.restoreAllMocks();
});

function combobox() {
  return screen.getByRole('combobox', { name: 'Fruits' });
}

function control() {
  return combobox().closest<HTMLElement>('[data-wave-tagpicker-control]')!;
}

function root() {
  return control().parentElement!;
}

function tagItems() {
  return Array.from(control().querySelectorAll<HTMLElement>('[data-wave-tag-item]'));
}

function chip() {
  return control().querySelector<HTMLElement>(`.${tagPickerClassNames.overflowCount}`);
}

/** Gives the control and its tags a box and measures (the observer's callback). */
function layout(controlWidth: number, tagWidth: number) {
  mockRect(control(), { width: controlWidth });
  for (const tag of tagItems()) mockRect(tag, { width: tagWidth });
  ro.trigger(control());
}

function Picker(props: Partial<TagPickerProps>) {
  return (
    <>
      <TagPicker
        aria-label="Fruits"
        options={options}
        defaultValue={['apple', 'banana', 'cherry']}
        overflow="count"
        {...props}
      />
      <button type="button">After</button>
    </>
  );
}

describe('TagPicker overflow="count"', () => {
  it('collapsed: hides the tags that do not fit (the first always stays) and shows an aria-hidden +N after them', () => {
    render(<Picker />);
    layout(130, 60);
    expect(tagItems().map((tag) => tag.hidden)).toEqual([false, false, true]);
    expect(chip()).toHaveTextContent('+1');
    expect(chip()).toHaveAttribute('aria-hidden', 'true');
    const group = screen.getByRole('list', { name: 'Selected' });
    expect(group.nextElementSibling).toBe(chip());
    expect(group).toHaveClass('flex-nowrap', 'overflow-hidden', 'whitespace-nowrap', 'min-w-0');
    expect(control()).toHaveClass('flex-nowrap');
    // The summary still names every tag.
    expect(combobox()).toHaveAccessibleDescription('Selected: Apple, Banana, Cherry');
    layout(40, 60);
    expect(tagItems().map((tag) => tag.hidden)).toEqual([false, true, true]);
    expect(chip()).toHaveTextContent('+2');
  });

  it("renders data-overflow='count' and data-collapsed", () => {
    render(<Picker />);
    expect(root()).toHaveAttribute('data-overflow', 'count');
    expect(root()).toHaveAttribute('data-collapsed', '');
  });

  it('labels.overflowCount localizes it', () => {
    render(<Picker labels={{ overflowCount: (count) => `${count} til` }} />);
    layout(70, 60);
    expect(chip()).toHaveTextContent('2 til');
  });

  it('focus on the input, a remove button (Shift+Tab) or the clear button, and opening the list, show every tag and drop the chip; leaving collapses again', async () => {
    const user = userEvent.setup();
    render(<Picker clearable />);
    layout(130, 60);
    expect(chip()).toHaveTextContent('+1');
    const after = screen.getByRole('button', { name: 'After' });

    // The clear button, by Shift+Tab from after the picker.
    act(() => after.focus());
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveFocus();
    expect(root()).not.toHaveAttribute('data-collapsed');
    expect(chip()).toBeNull();
    expect(tagItems().every((tag) => !tag.hidden)).toBe(true);

    // The input, then a remove button (Shift+Tab from the input).
    await user.tab({ shift: true });
    expect(combobox()).toHaveFocus();
    expect(chip()).toBeNull();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Remove Cherry' })).toHaveFocus();
    expect(chip()).toBeNull();

    // Leaving collapses again.
    act(() => after.focus());
    expect(root()).toHaveAttribute('data-collapsed', '');
    expect(chip()).toHaveTextContent('+1');

    // Opening the list (a controlled open from outside) shows every tag too.
    const { rerender } = render(
      <TagPicker
        aria-label="Vegetables"
        options={options}
        defaultValue={['apple', 'banana', 'cherry']}
        overflow="count"
        open={false}
      />,
    );
    const second = screen.getByRole('combobox', { name: 'Vegetables' });
    const secondRoot = second.closest('[data-wave-tagpicker-control]')!.parentElement!;
    expect(secondRoot).toHaveAttribute('data-collapsed', '');
    rerender(
      <TagPicker
        aria-label="Vegetables"
        options={options}
        defaultValue={['apple', 'banana', 'cherry']}
        overflow="count"
        open
      />,
    );
    expect(secondRoot).not.toHaveAttribute('data-collapsed');
  });

  it('tracks focus in every mode: switching to count while focus is inside stays expanded, and after a blur in wrap mode collapses', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Picker overflow="wrap" />);
    await user.click(combobox());
    await user.keyboard('{Escape}');
    rerender(<Picker overflow="count" />);
    expect(root()).not.toHaveAttribute('data-collapsed');
    await user.type(combobox(), 'b');
    expect(root()).not.toHaveAttribute('data-collapsed');
    await user.keyboard('{Escape}{Escape}');
    rerender(<Picker overflow="wrap" />);
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    rerender(<Picker overflow="count" />);
    expect(root()).toHaveAttribute('data-collapsed', '');
    layout(130, 60);
    expect(chip()).toHaveTextContent('+1');
  });

  it('re-measures when a tag’s label changes while collapsed (async options), a visible one and a hidden one', () => {
    const relabel = (value: string, label: string) =>
      options.map((option) => (option.value === value ? { ...option, label } : option));
    const { rerender } = render(<Picker />);
    layout(130, 60);
    expect(chip()).toHaveTextContent('+1');
    // A visible tag grows with its new label.
    mockRect(tagItems()[1], { width: 100 });
    rerender(<Picker options={relabel('banana', 'Banana split')} />);
    expect(tagItems().map((tag) => tag.hidden)).toEqual([false, true, true]);
    expect(chip()).toHaveTextContent('+2');
    // A hidden tag shrinks with its new label: it is shown, measured and kept.
    mockRect(tagItems()[1], { width: 60 });
    rerender(<Picker options={relabel('banana', 'Banana')} />);
    expect(chip()).toHaveTextContent('+1');
    mockRect(tagItems()[2], { width: 10 });
    rerender(<Picker options={relabel('cherry', 'Ch')} />);
    expect(tagItems().map((tag) => tag.hidden)).toEqual([false, false, false]);
    expect(chip()).toBeNull();
  });

  it('a press on the chip focuses the input and leaves the list closed', () => {
    const onOpenChange = vi.fn();
    render(<Picker onOpenChange={onOpenChange} />);
    layout(130, 60);
    const press = fireEvent.mouseDown(chip()!, { button: 0 });
    expect(press).toBe(false); // defaultPrevented
    expect(combobox()).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(chip()).toBeNull();
  });

  it('re-measures on a resize (the mock’s trigger) and on a new tag; measures nothing in wrap mode', () => {
    const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
    const { rerender } = render(<Picker value={['apple', 'banana', 'cherry']} />);
    expect(observe).toHaveBeenCalledWith(control());
    layout(130, 60);
    expect(chip()).toHaveTextContent('+1');
    mockRect(control(), { width: 250 });
    ro.trigger(control());
    expect(chip()).toBeNull();
    mockRect(control(), { width: 130 });
    ro.trigger(control());
    expect(chip()).toHaveTextContent('+1');
    // A new tag (no box of its own in jsdom) is measured as it arrives: the cached widths keep
    // the hidden one counted.
    rerender(<Picker value={['apple', 'banana', 'cherry', 'date']} />);
    expect(chip()).toHaveTextContent('+2');

    observe.mockClear();
    const wrap = render(
      <TagPicker aria-label="Wrapped" options={options} defaultValue={['apple', 'banana']} />,
    );
    expect(observe).not.toHaveBeenCalled();
    const wrapRoot = within(wrap.container)
      .getByRole('combobox', { name: 'Wrapped' })
      .closest('[data-wave-tagpicker-control]')!.parentElement!;
    expect(wrapRoot).toHaveAttribute('data-overflow', 'wrap');
    expect(wrapRoot).not.toHaveAttribute('data-collapsed');
  });

  it('renders every tag and no chip on the server and hydrates without warnings', async () => {
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    const ui = <Picker />;
    const html = renderToString(ui);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      expect(container.querySelectorAll('[data-wave-tag-item]')).toHaveLength(3);
      expect(container.querySelector('[data-wave-tag-item][hidden]')).toBeNull();
      expect(container.querySelector(`.${tagPickerClassNames.overflowCount}`)).toBeNull();
      expect(container.querySelector('[data-overflow="count"]')).toHaveAttribute(
        'data-collapsed',
        '',
      );
      let hydrated: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        hydrated = hydrateRoot(container, ui);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      act(() => hydrated?.unmount());
    } finally {
      container.remove();
    }
  });

  it('keeps the chip after the visible tags in RTL', () => {
    renderWithProviders(<Picker />, { dir: 'rtl' });
    layout(130, 60);
    const group = screen.getByRole('list', { name: 'Selected' });
    const visible = tagItems().filter((tag) => !tag.hidden);
    expect(visible).toHaveLength(2);
    expect(group.nextElementSibling).toBe(chip());
    expect(chip()).toHaveTextContent('+1');
  });
});
