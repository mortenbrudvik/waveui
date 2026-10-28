import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ListboxContext,
  ListboxOptionPositionContext,
  useListbox,
  useListboxOption,
  type ListboxItem,
  type UseListboxResult,
} from '../useListbox';

/** a, a disabled b, c, d, a hidden h, e. */
const ITEMS: readonly ListboxItem[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo', disabled: true },
  { value: 'c', label: 'Charlie' },
  { value: 'd', label: 'Delta' },
  { value: 'h', label: 'Hidden', hidden: true },
  { value: 'e', label: 'Echo' },
];

interface DataPickerProps {
  items: readonly ListboxItem[];
  /** The values whose options are rendered (a window); every shown item without it. */
  mounted?: readonly string[];
  filter?: (item: ListboxItem) => boolean;
  onScrollToItem?: (index: number) => void;
  resultRef?: React.RefObject<UseListboxResult | null>;
}

/** A select-only picker in data mode that renders the options of `mounted` only. */
function DataPicker({ items, mounted, filter, onScrollToItem, resultRef }: DataPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const lb = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'select-only',
    selectedValues: value ? [value] : [],
    onSelect: (next) => setValue(next),
    items,
    filter,
    onScrollToItem,
  });
  React.useImperativeHandle(resultRef, () => lb);
  return (
    <div>
      <button
        type="button"
        {...lb.getComboboxProps()}
        onKeyDown={lb.onKeyDown}
        onKeyUp={lb.onKeyUp}
      >
        {lb.getItem(value)?.label ?? 'Pick'}
      </button>
      <ListboxContext.Provider value={lb.context}>
        <ul {...lb.getListboxProps()} aria-label="Letters" hidden={!open || undefined}>
          {lb.items
            .filter((item) => mounted === undefined || mounted.includes(item.value))
            .map((item) => (
              <PlainOption key={item.value} value={item.value} label={item.label} />
            ))}
        </ul>
      </ListboxContext.Provider>
    </div>
  );
}

function PlainOption({ value, label }: { value: string; label: string }) {
  const { optionProps } = useListboxOption<HTMLLIElement>({ value, label });
  return <li {...optionProps}>{label}</li>;
}

describe('useListbox data mode: onScrollToItem', () => {
  it('passes the index among the shown items, disabled ones counted', () => {
    const onScrollToItem = vi.fn();
    render(<DataPicker items={ITEMS} mounted={[]} onScrollToItem={onScrollToItem} />);
    const button = screen.getByRole('combobox');
    button.focus();
    // Opens on the first option (a, index 0); the next skips the disabled b to c, which is the
    // third shown item (index 2) although it is the second navigable value.
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    // End: e is the fifth shown item (the hidden h is not shown), index 4.
    fireEvent.keyDown(button, { key: 'End' });
    expect(onScrollToItem.mock.calls).toEqual([[0], [2], [4]]);
  });

  it('counts the items a filter keeps', () => {
    const onScrollToItem = vi.fn();
    const ref = React.createRef<UseListboxResult>();
    render(
      <DataPicker
        items={ITEMS}
        mounted={[]}
        filter={(item) => item.value !== 'a' && item.value !== 'c'}
        onScrollToItem={onScrollToItem}
        resultRef={ref}
      />,
    );
    expect(ref.current!.items.map((item) => item.value)).toEqual(['b', 'd', 'e']);
    const button = screen.getByRole('combobox');
    fireEvent.keyDown(button, { key: 'End' });
    expect(onScrollToItem).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(onScrollToItem).toHaveBeenLastCalledWith(1);
  });

  it('is not called for an option that is mounted', () => {
    const onScrollToItem = vi.fn();
    const original = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<DataPicker items={ITEMS} onScrollToItem={onScrollToItem} />);
      const button = screen.getByRole('combobox');
      fireEvent.keyDown(button, { key: 'ArrowDown' });
      fireEvent.keyDown(button, { key: 'End' });
      expect(onScrollToItem).not.toHaveBeenCalled();
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('commits an option that is not mounted with the keyboard', () => {
    render(<DataPicker items={ITEMS} mounted={[]} onScrollToItem={() => {}} />);
    const button = screen.getByRole('combobox');
    fireEvent.keyDown(button, { key: 'End' });
    expect(button).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-opt-\d+$/));
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toHaveTextContent('Echo');
  });
});

describe('useListboxOption position', () => {
  function Positioned({ position }: { position: { index: number; setSize: number } | null }) {
    const lb = useListbox({
      open: true,
      mode: 'select-only',
      selectedValues: [],
      onSelect: () => {},
      items: ITEMS,
    });
    return (
      <ListboxContext.Provider value={lb.context}>
        <ul {...lb.getListboxProps()} aria-label="Letters">
          <ListboxOptionPositionContext.Provider value={position}>
            <PlainOption value="c" label="Charlie" />
          </ListboxOptionPositionContext.Provider>
        </ul>
      </ListboxContext.Provider>
    );
  }

  it('renders aria-posinset and aria-setsize from the position context', () => {
    render(<Positioned position={{ index: 2, setSize: 5 }} />);
    const option = screen.getByRole('option', { name: 'Charlie' });
    expect(option).toHaveAttribute('aria-posinset', '3');
    expect(option).toHaveAttribute('aria-setsize', '5');
  });

  it('renders no position without the context (registration mode, custom pickers)', () => {
    render(<Positioned position={null} />);
    const option = screen.getByRole('option', { name: 'Charlie' });
    expect(option).not.toHaveAttribute('aria-posinset');
    expect(option).not.toHaveAttribute('aria-setsize');
  });

  it('follows a changed position', () => {
    const { rerender } = render(<Positioned position={{ index: 2, setSize: 5 }} />);
    act(() => rerender(<Positioned position={{ index: 0, setSize: 1 }} />));
    const option = screen.getByRole('option', { name: 'Charlie' });
    expect(option).toHaveAttribute('aria-posinset', '1');
    expect(option).toHaveAttribute('aria-setsize', '1');
  });
});
