import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Listbox } from '../Listbox';
import { Option } from '../Option';
import { useVirtualWindow } from '../../../hooks/useVirtualWindow';
import type { ListboxItem } from '../../../hooks/useListbox';
import { installResizeObserverMock, type ResizeObserverMock } from '../../../test-utils';

const ITEMS: readonly ListboxItem[] = Array.from({ length: 400 }, (_, i) => ({
  value: `item-${i}`,
  label: `Item ${i}`,
}));
const heightOf = (index: number) => (index % 4 === 0 ? 64 : 32);

let ro: ResizeObserverMock;

beforeEach(() => {
  ro = installResizeObserverMock();
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.getAttribute('role') === 'listbox' ? 250 : 0;
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const index = this.getAttribute('data-virtual-index');
    return new DOMRect(0, 0, 200, index === null ? 0 : heightOf(Number(index)));
  });
});

afterEach(() => {
  ro.restore();
  vi.restoreAllMocks();
});

function MeasuredListbox({ measure = true }: { measure?: boolean }) {
  const virtualWindow = useVirtualWindow({ itemSize: 40, measureItems: measure });
  return (
    <Listbox
      aria-label="Items"
      items={ITEMS}
      virtualWindow={virtualWindow}
      renderOption={(item) => (
        <Option value={item.value} label={item.label}>
          {item.label}
        </Option>
      )}
    />
  );
}

describe('Listbox with a window that measures its options', () => {
  it('draws options with the height of their content, found by the window', () => {
    render(<MeasuredListbox />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    options.forEach((option, index) => {
      expect(option).toHaveAttribute('data-virtual-index', String(index));
      expect(option).toHaveAttribute('aria-posinset', String(index + 1));
      expect(option).toHaveAttribute('aria-setsize', String(ITEMS.length));
      expect(option.style.height).toBe('');
      expect(option).toHaveStyle({ boxSizing: 'border-box', flexShrink: '0' });
    });
  });

  it('lays the options of a window of fixed rows out at its item size', () => {
    render(<MeasuredListbox measure={false} />);
    const option = screen.getAllByRole('option')[0];
    expect(option).toHaveStyle({ height: '40px' });
    expect(option).not.toHaveAttribute('data-virtual-index');
  });

  it('renders fewer options once it measured taller ones than the estimate', () => {
    render(<MeasuredListbox />);
    const measured = screen.getAllByRole('option').length;
    // The initial viewport (480 px) holds 12 estimated rows; 250 px of measured rows hold fewer.
    expect(measured).toBeLessThan(12 + 6);
  });
});
