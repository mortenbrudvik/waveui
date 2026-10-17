import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import * as React from 'react';
import { renderWithProviders } from '../../test-utils';
import { useRovingGrid } from '../useRovingGrid';

const ALL = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2'];

function Grid({
  disabled = ['b3'],
  activeValue = null,
  portal = false,
}: {
  disabled?: string[];
  activeValue?: string | null;
  portal?: boolean;
}) {
  const { containerProps, getTabIndex } = useRovingGrid({ activeValue });
  const rows = [
    ['a1', 'a2', 'a3'],
    ['b1', 'b2', 'b3'],
    ['c1', 'c2'],
  ];
  return (
    <>
      <div role="grid" aria-label="Grid" {...containerProps}>
        {rows.map((row, r) => (
          <div role="row" key={r}>
            {row.map((v) => (
              <div role="gridcell" key={v}>
                <button
                  type="button"
                  data-roving-value={v}
                  disabled={disabled.includes(v)}
                  tabIndex={getTabIndex(v)}
                >
                  {v}
                </button>
              </div>
            ))}
          </div>
        ))}
        {portal
          ? createPortal(
              <div role="row">
                <button type="button" data-roving-value="p1">
                  p1
                </button>
                <button type="button" data-roving-value="p2">
                  p2
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>
      <button type="button">outside</button>
    </>
  );
}

const cell = (name: string) => screen.getByRole('button', { name });

describe('useRovingGrid', () => {
  it('moves in reading order and stops at the grid’s ends', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    await user.tab();
    expect(cell('a1')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(cell('a1')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(cell('b1')).toHaveFocus();
    // b3 is disabled: Right from b2 goes on to c1.
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(cell('c1')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(cell('c2')).toHaveFocus();
  });

  it('moves Up and Down to the nearest enabled cell of the column, skipping rows without one', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}'); // a3 → b3 disabled → nearest enabled b2
    expect(cell('b2')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(cell('c2')).toHaveFocus();
    await user.keyboard('{ArrowDown}'); // last row: stays
    expect(cell('c2')).toHaveFocus();
    expect(fireEvent.keyDown(cell('c2'), { key: 'ArrowDown' })).toBe(false); // handled: no page scroll
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(cell('a2')).toHaveFocus();
    await user.keyboard('{ArrowUp}'); // first row: stays
    expect(cell('a2')).toHaveFocus();
  });

  it('skips a row with no enabled cell', async () => {
    const user = userEvent.setup();
    render(<Grid disabled={['b1', 'b2', 'b3']} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(cell('c2')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(cell('a2')).toHaveFocus();
  });

  it('measures the column by index in the row, the earlier cell winning a tie', async () => {
    const user = userEvent.setup();
    // c has two cells; from a3 (index 2) the nearest is c2 (index 1); from a1 it is c1.
    render(<Grid disabled={[]} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}');
    expect(cell('c2')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowLeft}{ArrowLeft}{ArrowDown}{ArrowDown}');
    expect(cell('c1')).toHaveFocus();
  });

  it('takes the earlier cell when two enabled cells are equally near', async () => {
    const user = userEvent.setup();
    render(<Grid disabled={['b2']} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowDown}'); // a2 → b1 and b3 are both one away
    expect(cell('b1')).toHaveFocus();
  });

  it('goes to the row’s ends with Home/End and the grid’s ends with Ctrl+Home/End', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    await user.tab();
    await user.keyboard('{ArrowDown}{End}'); // b1 → last enabled of the row: b2 (b3 disabled)
    expect(cell('b2')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(cell('b1')).toHaveFocus();
    await user.keyboard('{Control>}{End}{/Control}');
    expect(cell('c2')).toHaveFocus();
    await user.keyboard('{Control>}{Home}{/Control}');
    expect(cell('a1')).toHaveFocus();
  });

  it('mirrors Left and Right in RTL, and Home/End stay the row’s first and last cell', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Grid />, { dir: 'rtl' });
    await user.tab();
    expect(cell('a1')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(cell('a2')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(cell('a1')).toHaveFocus();
    await user.keyboard('{End}');
    expect(cell('a3')).toHaveFocus();
    await user.keyboard('{ArrowDown}'); // up/down are not mirrored
    expect(cell('b2')).toHaveFocus();
  });

  it('starts the tab stop at the active cell and keeps the last focused cell as the tab stop', async () => {
    const user = userEvent.setup();
    render(<Grid activeValue="b2" />);
    await user.tab();
    expect(cell('b2')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(cell('b1')).toHaveFocus();
    await user.tab();
    expect(cell('outside')).toHaveFocus();
    expect(cell('b1')).toHaveAttribute('tabindex', '0');
    expect(cell('b2')).toHaveAttribute('tabindex', '-1');
    await user.tab({ shift: true });
    expect(cell('b1')).toHaveFocus();
  });

  it('does not handle Space or Enter, and leaves modified arrows alone', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    await user.tab();
    const press = (init: Partial<KeyboardEventInit> & { key: string }) =>
      fireEvent.keyDown(cell('a1'), init);
    expect(press({ key: ' ' })).toBe(true);
    expect(press({ key: 'Enter' })).toBe(true);
    expect(press({ key: 'ArrowDown', ctrlKey: true })).toBe(true);
    expect(press({ key: 'Home', altKey: true })).toBe(true);
    expect(cell('a1')).toHaveFocus();
  });

  it('ignores keys from outside its DOM (a portal)', () => {
    render(<Grid portal />);
    act(() => cell('a1').focus());
    for (const key of ['ArrowDown', 'ArrowRight', 'Home', 'End']) {
      expect(fireEvent.keyDown(cell('p1'), { key })).toBe(true);
    }
    expect(cell('a1')).toHaveFocus();
    expect(cell('p1')).not.toHaveFocus();
  });

  it('never loops or moves when every cell is disabled', async () => {
    const user = userEvent.setup();
    render(<Grid disabled={ALL} />);
    const grid = screen.getByRole('grid');
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      fireEvent.keyDown(grid, { key });
      fireEvent.keyDown(grid, { key, ctrlKey: true });
    }
    await user.tab();
    expect(cell('outside')).toHaveFocus();
  });

  it('skips a cell that disables itself later', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Grid disabled={[]} />);
    rerender(<Grid disabled={['a2']} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(cell('a3')).toHaveFocus();
  });
});
