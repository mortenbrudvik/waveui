import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { List } from '../List';
import { listClassNames } from '../../../lib/classNames';
import { useVirtualWindow } from '../../../hooks/useVirtualWindow';
import { installResizeObserverMock, type ResizeObserverMock } from '../../../test-utils';

const COUNT = 500;
const VIEWPORT = 300;
/** A row is 40, 70 or 100 pixels tall by its index. */
const heightOf = (index: number) => 40 + (index % 3) * 30;

let ro: ResizeObserverMock;

beforeEach(() => {
  ro = installResizeObserverMock();
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains(listClassNames.root) ? VIEWPORT : 0;
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

function MeasuredList() {
  const virtualWindow = useVirtualWindow({ itemSize: 50, measureItems: true });
  return (
    <List aria-label="Rows" virtualWindow={virtualWindow} count={COUNT}>
      {(index) => <List.Item value={`row-${index}`}>{`Row ${index}`}</List.Item>}
    </List>
  );
}

describe('List with a window that measures its items', () => {
  it('gives the items the height of their content and the window the attributes it finds them by', () => {
    render(<MeasuredList />);
    const root = document.querySelector<HTMLElement>(`.${listClassNames.root}`) as HTMLElement;
    const items = Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-index]'));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).toHaveAttribute('data-virtual-index', item.getAttribute('data-index'));
      expect(item.style.height).toBe('');
      expect(item).toHaveAttribute('aria-setsize', String(COUNT));
    }
  });

  it('sizes the spacer after the items by what it measured and estimated', () => {
    render(<MeasuredList />);
    const root = document.querySelector<HTMLElement>(`.${listClassNames.root}`) as HTMLElement;
    const shown = root.querySelectorAll(':scope > [data-index]').length;
    const spacer = root.querySelector<HTMLElement>(':scope > [data-virtual-spacer]') as HTMLElement;
    // The first render laid out the initial viewport (480 px of the 50 px estimate: 10 rows and 6
    // of overscan) and the window measured those 16 rows; every other row counts as 50.
    const sizeOf = (index: number) => (index < 16 ? heightOf(index) : 50);
    let after = 0;
    for (let index = shown; index < COUNT; index++) after += sizeOf(index);
    expect(shown).toBeGreaterThan(0);
    expect(parseFloat(spacer.style.height)).toBe(after);
  });

  it('keeps fixed heights for a window of fixed items', () => {
    function FixedList() {
      const virtualWindow = useVirtualWindow({ itemSize: 50 });
      return (
        <List aria-label="Rows" virtualWindow={virtualWindow} count={COUNT}>
          {(index) => <List.Item value={`row-${index}`}>{`Row ${index}`}</List.Item>}
        </List>
      );
    }
    render(<FixedList />);
    const item = document.querySelector<HTMLElement>('[data-index="0"]') as HTMLElement;
    expect(item.style.height).toBe('50px');
    expect(item).not.toHaveAttribute('data-virtual-index');
  });
});
