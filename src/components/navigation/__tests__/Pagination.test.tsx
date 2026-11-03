import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/Pagination.stories';
import { Pagination, getPaginationRange } from '../Pagination';
import type { PaginationItemType, PaginationProps } from '../Pagination';
import { paginationClassNames } from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';

/** The rendered page/ellipsis sequence in DOM order (render with `showPreviousNext={false}`). */
function renderedSequence(): Array<number | 'ellipsis'> {
  const list = screen.getByRole('navigation').querySelector('ol');
  if (!list) throw new Error('Pagination list not found');
  return Array.from(list.children).map((item) => {
    const button = item.querySelector('button');
    return button ? Number(button.textContent) : 'ellipsis';
  });
}

const page = (n: number) => screen.getByRole('button', { name: `Page ${n}` });

/** useControllable's warning when a value switches between controlled and uncontrolled. */
const modeSwitch = (from: string, to: string) =>
  `[WaveUI] A component is changing from ${from} to ${to}. Components should not switch ` +
  'between controlled and uncontrolled: pass `undefined` only when the component is ' +
  'uncontrolled, and the empty value (for example `[]`, `null` or `""`) to clear a controlled ' +
  'value.';

/** The development warning for a `totalPages` that is not an integer. */
const totalPagesWarning = (received: string) =>
  `[WaveUI] Pagination: \`totalPages\` must be an integer, received ${received}. Fractional ` +
  'values are rounded down; NaN and infinite values render nothing.';

// Console spies are restored after every test, so none carries calls into the next one.
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Pagination', () => {
  testSystemProps(Pagination, {
    expectedTag: 'nav',
    displayName: 'Pagination',
    defaultProps: { totalPages: 10, showFirstLast: true },
    a11yVariants: [
      { name: 'first page (boundary buttons aria-disabled)', props: { defaultCurrentPage: 1 } },
      { name: 'last page', props: { defaultCurrentPage: 10 } },
      { name: 'many pages with ellipses', props: { totalPages: 50, defaultCurrentPage: 25 } },
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  it('keeps ref in PaginationProps (C-REF)', () => {
    expectTypeOf<PaginationProps['ref']>().toEqualTypeOf<React.Ref<HTMLElement> | undefined>();
  });

  it('names the landmark "Pagination" by default and lets aria-label override it', () => {
    const { rerender } = render(<Pagination totalPages={5} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    rerender(<Pagination totalPages={5} aria-label="Sider" />);
    expect(screen.getByRole('navigation', { name: 'Sider' })).toBeInTheDocument();
  });

  it('renders every page for a small total', () => {
    render(<Pagination totalPages={5} showPreviousNext={false} />);
    expect(renderedSequence()).toEqual([1, 2, 3, 4, 5]);
  });

  it('marks current page with aria-current="page"', () => {
    render(<Pagination totalPages={5} defaultCurrentPage={3} showPreviousNext={false} />);
    expect(page(3)).toHaveAttribute('aria-current', 'page');
    expect(page(1)).not.toHaveAttribute('aria-current');
  });

  it('handles page changes in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination totalPages={5} onPageChange={onPageChange} showPreviousNext={false} />);

    await user.click(page(3));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(page(3)).toHaveAttribute('aria-current', 'page');
    expect(page(1)).not.toHaveAttribute('aria-current');
  });

  it('handles page changes in controlled mode', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination
        totalPages={5}
        currentPage={1}
        onPageChange={onPageChange}
        showPreviousNext={false}
      />,
    );

    await user.click(page(4));
    expect(onPageChange).toHaveBeenCalledWith(4);
    // In controlled mode, page should not update until prop changes
    expect(page(1)).toHaveAttribute('aria-current', 'page');

    rerender(
      <Pagination
        totalPages={5}
        currentPage={4}
        onPageChange={onPageChange}
        showPreviousNext={false}
      />,
    );
    expect(page(4)).toHaveAttribute('aria-current', 'page');
  });

  it('controlled Next that the parent ignores emits the same target each time (separate interactions)', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination totalPages={5} currentPage={2} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange.mock.calls).toEqual([[3], [3]]);
  });

  it('fires onPageChange when the current page is activated again (0.4 semantics, table-core#3)', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination totalPages={5} defaultCurrentPage={2} onPageChange={onPageChange} />);
    await user.click(page(2));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(page(2)).toHaveAttribute('aria-current', 'page');
  });

  it('calls onPageChange exactly once per activation under StrictMode', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <React.StrictMode>
        <Pagination totalPages={5} onPageChange={onPageChange} />
      </React.StrictMode>,
    );
    await user.click(page(3));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it('navigates with previous and next buttons', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination totalPages={5} defaultCurrentPage={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(page(2)).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    expect(page(3)).toHaveAttribute('aria-current', 'page');
  });

  it('applies small size classes', () => {
    render(<Pagination totalPages={3} size="small" showPreviousNext={false} />);
    expect(page(1)).toHaveClass('wave:h-7', 'wave:w-7');
  });

  describe('boundary buttons (C-DISABLED, feedback-navigation#29)', () => {
    it('marks Previous aria-disabled on the first page but keeps it focusable', () => {
      render(<Pagination totalPages={5} defaultCurrentPage={1} />);
      const previous = screen.getByRole('button', { name: 'Previous page' });
      expect(previous).toHaveAttribute('aria-disabled', 'true');
      expect(previous).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next page' })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it('marks Next aria-disabled on the last page but keeps it focusable', () => {
      render(<Pagination totalPages={5} defaultCurrentPage={5} />);
      const next = screen.getByRole('button', { name: 'Next page' });
      expect(next).toHaveAttribute('aria-disabled', 'true');
      expect(next).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Previous page' })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it('marks First and Last aria-disabled at their boundaries', () => {
      const { rerender } = render(<Pagination totalPages={10} currentPage={1} showFirstLast />);
      expect(screen.getByRole('button', { name: 'First page' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Last page' })).not.toHaveAttribute(
        'aria-disabled',
      );
      rerender(<Pagination totalPages={10} currentPage={10} showFirstLast />);
      expect(screen.getByRole('button', { name: 'First page' })).not.toHaveAttribute(
        'aria-disabled',
      );
      expect(screen.getByRole('button', { name: 'Last page' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('ignores activation of an aria-disabled boundary button', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(
        <Pagination
          totalPages={5}
          defaultCurrentPage={1}
          showFirstLast
          onPageChange={onPageChange}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Previous page' }));
      await user.click(screen.getByRole('button', { name: 'First page' }));
      screen.getByRole('button', { name: 'First page' }).focus();
      await user.keyboard('{Enter}');
      expect(onPageChange).not.toHaveBeenCalled();
      expect(page(1)).toHaveAttribute('aria-current', 'page');
    });

    it('keeps focus on First after activating it from the keyboard', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(
        <Pagination
          totalPages={10}
          defaultCurrentPage={4}
          showFirstLast
          onPageChange={onPageChange}
        />,
      );
      const first = screen.getByRole('button', { name: 'First page' });
      first.focus();
      await user.keyboard('{Enter}');
      expect(onPageChange).toHaveBeenCalledWith(1);
      expect(page(1)).toHaveAttribute('aria-current', 'page');
      expect(first).toHaveAttribute('aria-disabled', 'true');
      expect(first).toHaveFocus();
    });

    it('keeps focus on Previous after reaching page 1 (feedback-navigation#25)', async () => {
      const user = userEvent.setup();
      render(<Pagination totalPages={5} defaultCurrentPage={2} />);
      const previous = screen.getByRole('button', { name: 'Previous page' });
      previous.focus();
      await user.keyboard('{Enter}');
      expect(page(1)).toHaveAttribute('aria-current', 'page');
      expect(previous).toHaveAttribute('aria-disabled', 'true');
      expect(previous).toHaveFocus();
      // Tab order continues from the focused boundary button.
      await user.tab();
      expect(page(1)).toHaveFocus();
    });

    it('keeps focus on the activated page button when the visible range changes', async () => {
      const user = userEvent.setup();
      render(<Pagination totalPages={20} defaultCurrentPage={10} />);
      // [1, …, 9, 10, 11, …, 20] → [1, …, 8, 9, 10, …, 20]: page 9 moves one slot on.
      page(9).focus();
      await user.keyboard('{Enter}');
      expect(page(9)).toHaveAttribute('aria-current', 'page');
      expect(page(9)).toHaveFocus();
      // → [1, …, 19, 20]: the range shrinks from 7 to 4 items.
      page(20).focus();
      await user.keyboard('{Enter}');
      expect(page(20)).toHaveAttribute('aria-current', 'page');
      expect(page(20)).toHaveFocus();
      // Previous keeps focus as well, and the pages follow it.
      const previous = screen.getByRole('button', { name: 'Previous page' });
      previous.focus();
      await user.keyboard('{Enter}');
      expect(page(19)).toHaveAttribute('aria-current', 'page');
      expect(previous).toHaveFocus();
    });

    it('gates hover and pressed styles so aria-disabled buttons do not react', () => {
      render(<Pagination totalPages={5} defaultCurrentPage={1} />);
      const previous = screen.getByRole('button', { name: 'Previous page' });
      expect(previous).toHaveClass(
        'wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover',
        'wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed',
        'wave:aria-disabled:opacity-50',
      );
      expect(previous.className).not.toMatch(/(^|\s)wave:hover:/);
    });

    it('shows the focus ring of a boundary button that disabled itself at full strength', async () => {
      const user = userEvent.setup();
      render(<Pagination totalPages={5} defaultCurrentPage={2} />);
      const previous = screen.getByRole('button', { name: 'Previous page' });
      previous.focus();
      await user.keyboard('{Enter}');
      expect(previous).toHaveAttribute('aria-disabled', 'true');
      expect(previous).toHaveFocus();
      // Dimmed, except while its ring shows: `opacity` would dim the ring below 3:1.
      expect(previous).toHaveClass(
        'wave:aria-disabled:opacity-50',
        'wave:aria-disabled:focus-visible:opacity-100',
      );
    });
  });

  describe('First/Last (feedback-navigation#44)', () => {
    it('shows first/last buttons only when showFirstLast is true', () => {
      const { rerender } = render(<Pagination totalPages={10} />);
      expect(screen.queryByRole('button', { name: 'First page' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Last page' })).not.toBeInTheDocument();
      rerender(<Pagination totalPages={10} showFirstLast />);
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAccessibleName('First page');
      expect(buttons[buttons.length - 1]).toHaveAccessibleName('Last page');
    });

    it('jumps to the first and last page', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(
        <Pagination
          totalPages={10}
          defaultCurrentPage={5}
          showFirstLast
          onPageChange={onPageChange}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Last page' }));
      expect(onPageChange).toHaveBeenLastCalledWith(10);
      expect(page(10)).toHaveAttribute('aria-current', 'page');
      await user.click(screen.getByRole('button', { name: 'First page' }));
      expect(onPageChange).toHaveBeenLastCalledWith(1);
      expect(page(1)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('whole-control disabled', () => {
    it('natively disables every button', () => {
      render(<Pagination totalPages={5} disabled />);
      const buttons = screen.getAllByRole('button');
      // Previous + 5 pages + Next
      expect(buttons).toHaveLength(7);
      for (const button of buttons) {
        expect(button).toBeDisabled();
        expect(button).not.toHaveAttribute('aria-disabled');
      }
    });

    it('natively disables First/Last as well', () => {
      render(<Pagination totalPages={3} showFirstLast disabled />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(7);
      buttons.forEach((button) => expect(button).toBeDisabled());
    });
  });

  it('renders nothing when totalPages is 0', () => {
    const { container } = render(<Pagination totalPages={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('clamping (feedback-navigation#26)', () => {
    it('clamps a controlled page above totalPages and notifies the parent once', () => {
      const onPageChange = vi.fn();
      render(<Pagination totalPages={5} currentPage={9} onPageChange={onPageChange} />);
      expect(page(5)).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('button', { name: 'Page 9' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next page' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Previous page' })).not.toHaveAttribute(
        'aria-disabled',
      );
      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it('clamps a page below 1', () => {
      const onPageChange = vi.fn();
      render(<Pagination totalPages={5} currentPage={0} onPageChange={onPageChange} />);
      expect(page(1)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('notifies once under StrictMode', () => {
      const onPageChange = vi.fn();
      render(
        <React.StrictMode>
          <Pagination totalPages={5} currentPage={9} onPageChange={onPageChange} />
        </React.StrictMode>,
      );
      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it('re-clamps when totalPages shrinks below the current page', () => {
      const onPageChange = vi.fn();
      const { rerender } = render(
        <Pagination totalPages={10} currentPage={8} onPageChange={onPageChange} />,
      );
      expect(onPageChange).not.toHaveBeenCalled();
      rerender(<Pagination totalPages={4} currentPage={8} onPageChange={onPageChange} />);
      expect(page(4)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(4);
      // A re-render with the same props does not notify again.
      rerender(<Pagination totalPages={4} currentPage={8} onPageChange={onPageChange} />);
      expect(onPageChange).toHaveBeenCalledTimes(1);
    });

    it('keeps an uncontrolled clamp when totalPages grows again (shrink, then regrow)', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      const pager = (total: number) => (
        <Pagination totalPages={total} onPageChange={onPageChange} showPreviousNext={false} />
      );
      const { rerender } = render(pager(10));
      await user.click(page(10));
      expect(onPageChange.mock.calls).toEqual([[10]]);

      rerender(pager(4));
      expect(page(4)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange.mock.calls).toEqual([[10], [4]]);

      // The clamp is stored: the pager stays where the consumer was last told it is.
      rerender(pager(10));
      expect(page(4)).toHaveAttribute('aria-current', 'page');
      expect(page(10)).not.toHaveAttribute('aria-current');
      expect(onPageChange.mock.calls).toEqual([[10], [4]]);

      // Shrinking below the stored page clamps (and notifies) again.
      rerender(pager(2));
      expect(page(2)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange.mock.calls).toEqual([[10], [4], [2]]);
      rerender(pager(10));
      expect(page(2)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange).toHaveBeenCalledTimes(3);
      // Passing through an empty result (nothing rendered) does not announce the clamp again.
      rerender(pager(0));
      rerender(pager(10));
      expect(page(2)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange).toHaveBeenCalledTimes(3);

      // Navigation starts from the shown page, also back to the page it was clamped from.
      await user.click(page(10));
      expect(onPageChange).toHaveBeenLastCalledWith(10);
      expect(screen.getAllByRole('button', { current: 'page' })).toEqual([page(10)]);
    });

    it('stores the clamp of an uncontrolled default page once under StrictMode', () => {
      const onPageChange = vi.fn();
      const pager = (total: number) => (
        <React.StrictMode>
          <Pagination totalPages={total} defaultCurrentPage={9} onPageChange={onPageChange} />
        </React.StrictMode>
      );
      const { rerender } = render(pager(5));
      expect(page(5)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange.mock.calls).toEqual([[5]]);
      rerender(pager(20));
      expect(page(5)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange.mock.calls).toEqual([[5]]);
    });

    it('shows the controlled page again when totalPages grows back (the prop wins)', () => {
      const onPageChange = vi.fn();
      const pager = (total: number) => (
        <Pagination totalPages={total} currentPage={8} onPageChange={onPageChange} />
      );
      const { rerender } = render(pager(10));
      rerender(pager(4));
      expect(page(4)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange.mock.calls).toEqual([[4]]);
      // A parent that ignored the clamp still holds 8, and the pager shows the parent's value.
      rerender(pager(10));
      expect(page(8)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange.mock.calls).toEqual([[4]]);
    });

    it('keeps controlled clamp semantics after a controlled pager receives currentPage={undefined} (sticky mode)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onPageChange = vi.fn();
      const pager = (total: number, currentPage: number | undefined) => (
        <Pagination
          totalPages={total}
          currentPage={currentPage}
          defaultCurrentPage={9}
          onPageChange={onPageChange}
          showPreviousNext={false}
        />
      );
      try {
        const { rerender } = render(pager(5, 3));
        expect(page(3)).toHaveAttribute('aria-current', 'page');

        // Misuse: useControllable stays controlled (and warns) and reports `defaultCurrentPage`.
        rerender(pager(5, undefined));
        await act(async () => {});
        expect(warn.mock.calls).toEqual([[modeSwitch('controlled', 'uncontrolled')]]);
        expect(page(5)).toHaveAttribute('aria-current', 'page');
        expect(onPageChange.mock.calls).toEqual([[5]]);

        // Controlled semantics, not the uncontrolled stored clamp: once the value fits again it is
        // shown again, without a second notification.
        rerender(pager(10, undefined));
        expect(page(9)).toHaveAttribute('aria-current', 'page');
        expect(screen.getAllByRole('button', { current: 'page' })).toEqual([page(9)]);
        expect(onPageChange.mock.calls).toEqual([[5]]);
        expect(warn.mock.calls).toEqual([[modeSwitch('controlled', 'uncontrolled')]]);
      } finally {
        warn.mockRestore();
      }
    });

    it('lets a late currentPage take over from a stored uncontrolled clamp (sticky mode)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onPageChange = vi.fn();
      const pager = (total: number, currentPage?: number) => (
        <Pagination
          totalPages={total}
          currentPage={currentPage}
          defaultCurrentPage={9}
          onPageChange={onPageChange}
          showPreviousNext={false}
        />
      );
      try {
        const { rerender } = render(pager(4));
        expect(page(4)).toHaveAttribute('aria-current', 'page');
        expect(onPageChange.mock.calls).toEqual([[4]]);

        // The late value is controlled from the render it arrives in: the prop wins over the
        // stored uncontrolled clamp, and nothing is clamped or announced.
        rerender(pager(10, 7));
        await act(async () => {});
        expect(warn.mock.calls).toEqual([[modeSwitch('uncontrolled', 'controlled')]]);
        expect(screen.getAllByRole('button', { current: 'page' })).toEqual([page(7)]);
        expect(onPageChange.mock.calls).toEqual([[4]]);

        // Withdrawing it keeps the pager controlled: `defaultCurrentPage`, not the stored clamp.
        rerender(pager(10, undefined));
        await act(async () => {});
        expect(screen.getAllByRole('button', { current: 'page' })).toEqual([page(9)]);
        expect(onPageChange.mock.calls).toEqual([[4]]);
        // The controlled mode is sticky: withdrawing the value warns once more.
        expect(warn.mock.calls).toEqual([
          [modeSwitch('uncontrolled', 'controlled')],
          [modeSwitch('controlled', 'uncontrolled')],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    it('clamps an uncontrolled default page and navigates from the clamped page', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(<Pagination totalPages={5} defaultCurrentPage={9} onPageChange={onPageChange} />);
      expect(page(5)).toHaveAttribute('aria-current', 'page');
      expect(onPageChange).toHaveBeenCalledWith(5);
      await user.click(screen.getByRole('button', { name: 'Previous page' }));
      expect(onPageChange).toHaveBeenLastCalledWith(4);
      expect(page(4)).toHaveAttribute('aria-current', 'page');
    });

    it('renders nothing and warns in development when totalPages is NaN', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = render(<Pagination totalPages={Number.NaN} />);
      await act(async () => {});
      expect(container).toBeEmptyDOMElement();
      expect(warn.mock.calls).toEqual([[totalPagesWarning('NaN')]]);
    });

    it('treats a fractional totalPages as its floor and warns in development', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Pagination totalPages={4.7} defaultCurrentPage={9} showPreviousNext={false} />);
      await act(async () => {});
      expect(renderedSequence()).toEqual([1, 2, 3, 4]);
      expect(page(4)).toHaveAttribute('aria-current', 'page');
      expect(warn.mock.calls).toEqual([[totalPagesWarning('4.7')]]);
    });
  });

  describe('getItemAriaLabel (feedback-navigation#30)', () => {
    it('names every button with the custom labels', () => {
      const getItemAriaLabel = vi.fn((type: PaginationItemType, p: number, selected: boolean) => {
        switch (type) {
          case 'first':
            return 'Første side';
          case 'previous':
            return `Forrige side (${p})`;
          case 'next':
            return `Neste side (${p})`;
          case 'last':
            return 'Siste side';
          default:
            return selected ? `Side ${p}, gjeldende` : `Side ${p}`;
        }
      });
      render(
        <Pagination
          totalPages={5}
          defaultCurrentPage={3}
          showFirstLast
          aria-label="Sidenavigasjon"
          getItemAriaLabel={getItemAriaLabel}
        />,
      );
      expect(screen.getByRole('navigation', { name: 'Sidenavigasjon' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Første side' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Forrige side (2)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Side 3, gjeldende' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('button', { name: 'Side 4' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Neste side (4)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Siste side' })).toBeInTheDocument();
      expect(getItemAriaLabel).toHaveBeenCalledWith('page', 3, true);
      expect(getItemAriaLabel).toHaveBeenCalledWith('page', 1, false);
      expect(getItemAriaLabel).toHaveBeenCalledWith('first', 1, false);
      expect(getItemAriaLabel).toHaveBeenCalledWith('last', 5, false);
    });

    it('uses the English defaults', () => {
      render(<Pagination totalPages={3} defaultCurrentPage={2} showFirstLast />);
      for (const name of [
        'First page',
        'Previous page',
        'Page 1',
        'Page 2',
        'Next page',
        'Last page',
      ]) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
    });
  });

  describe('styling', () => {
    it('gives every button the shared focus ring (feedback-navigation#24)', () => {
      render(<Pagination totalPages={5} showFirstLast />);
      for (const button of screen.getAllByRole('button')) {
        expect(button).toHaveClass(
          'wave:focus-visible:outline-2',
          'wave:focus-visible:outline-offset-2',
          'wave:focus-visible:outline-ring',
        );
      }
    });

    it('draws the current page with theme tokens (input-basic#8)', () => {
      render(<Pagination totalPages={5} defaultCurrentPage={2} />);
      expect(page(2)).toHaveClass(
        'wave:bg-primary',
        'wave:text-primary-foreground',
        'wave:border-primary',
      );
      expect(page(2).className).not.toMatch(/text-white|#[0-9a-f]{3,6}/i);
      expect(page(3)).toHaveClass(
        'wave:text-foreground',
        'wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover',
      );
    });

    it('turns off the color transition for reduced motion', () => {
      render(<Pagination totalPages={3} />);
      expect(page(1)).toHaveClass('wave:motion-reduce:transition-none');
    });

    it('mirrors the directional chevrons in RTL (feedback-navigation#34)', () => {
      renderWithProviders(<Pagination totalPages={5} defaultCurrentPage={3} showFirstLast />, {
        dir: 'rtl',
      });
      for (const name of ['First page', 'Previous page', 'Next page', 'Last page']) {
        const icon = screen.getByRole('button', { name }).querySelector('svg');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(icon).toHaveClass('wave:wave-rtl:-scale-x-100');
      }
    });

    it('mirrors the chevrons by their own direction, not by any RTL ancestor (C-LOGICAL)', () => {
      // Tailwind's `rtl:` also matches inside an LTR subtree of an RTL page; `wave-rtl:` follows
      // the element's own direction (`:dir(rtl)`), so these chevrons keep their LTR direction.
      renderWithProviders(
        <div dir="ltr">
          <Pagination totalPages={5} defaultCurrentPage={3} showFirstLast />
        </div>,
        { dir: 'rtl' },
      );
      for (const name of ['First page', 'Previous page', 'Next page', 'Last page']) {
        const icon = screen.getByRole('button', { name }).querySelector('svg');
        expect(icon?.closest('[dir]')).toHaveAttribute('dir', 'ltr');
        expect(icon).toHaveClass('wave:wave-rtl:-scale-x-100');
        expect(icon?.getAttribute('class')).not.toMatch(/(^|\s)wave:rtl:/);
      }
    });
  });

  describe('range (feedback-navigation#43)', () => {
    it.each<{
      name: string;
      args: [number, number, number?, number?];
      expected: Array<number | 'ellipsis'>;
    }>([
      { name: 'small total shows every page', args: [5, 3], expected: [1, 2, 3, 4, 5] },
      {
        name: 'exactly the slot count shows every page',
        args: [7, 4],
        expected: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        name: '(20, 10): both ellipses',
        args: [20, 10],
        expected: [1, 'ellipsis', 9, 10, 11, 'ellipsis', 20],
      },
      {
        name: '(8, 4): gap of 2 before the siblings is filled',
        args: [8, 4],
        expected: [1, 2, 3, 4, 5, 'ellipsis', 8],
      },
      {
        name: '(20, 10, sibling 2, boundary 2)',
        args: [20, 10, 2, 2],
        expected: [1, 2, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 19, 20],
      },
      { name: 'near the start', args: [20, 1], expected: [1, 2, 'ellipsis', 20] },
      { name: 'second page', args: [20, 3], expected: [1, 2, 3, 4, 'ellipsis', 20] },
      {
        name: 'gap of 2 at the start is filled',
        args: [20, 4],
        expected: [1, 2, 3, 4, 5, 'ellipsis', 20],
      },
      { name: 'near the end', args: [20, 20], expected: [1, 'ellipsis', 19, 20] },
      {
        name: 'gap of 2 at the end is filled',
        args: [20, 17],
        expected: [1, 'ellipsis', 16, 17, 18, 19, 20],
      },
      {
        name: 'siblingCount 0',
        args: [20, 10, 0, 1],
        expected: [1, 'ellipsis', 10, 'ellipsis', 20],
      },
      {
        name: 'current page above the total is clamped',
        args: [20, 99],
        expected: [1, 'ellipsis', 19, 20],
      },
      { name: 'current page below 1 is clamped', args: [20, -3], expected: [1, 2, 'ellipsis', 20] },
      { name: 'no pages', args: [0, 1], expected: [] },
      // boundaryCount 0 pins no page at either end, so a gap before the first or after the last
      // shown page is marked too; a single missing end page is shown instead.
      {
        name: 'boundaryCount 0: ellipses at both ends',
        args: [20, 10, 1, 0],
        expected: ['ellipsis', 9, 10, 11, 'ellipsis'],
      },
      {
        name: 'boundaryCount 0 at the first page',
        args: [20, 1, 1, 0],
        expected: [1, 2, 'ellipsis'],
      },
      {
        name: 'boundaryCount 0 at the last page',
        args: [20, 20, 1, 0],
        expected: ['ellipsis', 19, 20],
      },
      {
        name: 'boundaryCount 0: a single missing first page is filled',
        args: [20, 3, 1, 0],
        expected: [1, 2, 3, 4, 'ellipsis'],
      },
      {
        name: 'boundaryCount 0: a single missing last page is filled',
        args: [20, 18, 1, 0],
        expected: ['ellipsis', 17, 18, 19, 20],
      },
      {
        name: 'boundaryCount 0 and siblingCount 0',
        args: [20, 10, 0, 0],
        expected: ['ellipsis', 10, 'ellipsis'],
      },
      {
        name: 'boundaryCount 0: a total that fits the slots shows every page',
        args: [5, 3, 1, 0],
        expected: [1, 2, 3, 4, 5],
      },
    ])('$name', ({ args, expected }) => {
      expect(getPaginationRange(...args)).toEqual(expected);
    });

    it('marks the gaps at both ends with boundaryCount={0}, with unique keys', async () => {
      const user = userEvent.setup();
      const error = vi.spyOn(console, 'error');
      render(
        <Pagination
          totalPages={20}
          defaultCurrentPage={10}
          boundaryCount={0}
          showPreviousNext={false}
        />,
      );
      expect(renderedSequence()).toEqual(['ellipsis', 9, 10, 11, 'ellipsis']);
      await user.click(page(11));
      expect(renderedSequence()).toEqual(['ellipsis', 10, 11, 12, 'ellipsis']);
      const list = screen.getByRole('navigation').querySelector('ol');
      for (const item of [list?.firstElementChild, list?.lastElementChild]) {
        expect(item).toHaveAttribute('aria-hidden', 'true');
      }
      expect(error).not.toHaveBeenCalled();
    });

    it('renders the computed sequence with ellipses in place', () => {
      render(<Pagination totalPages={20} defaultCurrentPage={10} showPreviousNext={false} />);
      expect(renderedSequence()).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
      expect(page(10)).toHaveAttribute('aria-current', 'page');
    });

    it('passes siblingCount and boundaryCount to the range', () => {
      render(
        <Pagination
          totalPages={20}
          defaultCurrentPage={10}
          siblingCount={2}
          boundaryCount={2}
          showPreviousNext={false}
        />,
      );
      expect(renderedSequence()).toEqual([1, 2, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 19, 20]);
    });
  });
});

describe('Pagination — slotProps', () => {
  type PaginationSlotProps = NonNullable<PaginationProps['slotProps']>;
  const EVERY_PART: PaginationSlotProps = {
    list: {},
    listItem: {},
    firstButton: {},
    previousButton: {},
    pageButton: {},
    nextButton: {},
    lastButton: {},
    ellipsis: {},
  };
  const all = (root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`));
  const one = (cls: string) => document.querySelector<HTMLElement>(`.${cls}`) as HTMLElement;
  /** Every part, in the order of the pins: the list, the list items, the buttons, the ellipses. */
  const partsOf = (root: ParentNode = document) => [
    ...all(root, paginationClassNames.list),
    ...all(root, paginationClassNames.listItem),
    ...all(root, paginationClassNames.firstButton),
    ...all(root, paginationClassNames.previousButton),
    ...all(root, paginationClassNames.pageButton),
    ...all(root, paginationClassNames.nextButton),
    ...all(root, paginationClassNames.lastButton),
    ...all(root, paginationClassNames.ellipsis),
  ];

  // Captured from 414fe7d's dist (client and server agree).
  const buttonClasses = (size: string) =>
    'wave:inline-flex wave:items-center wave:justify-center wave:rounded wave:border wave:cursor-pointer wave:transition-colors wave:motion-reduce:transition-none wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 ' +
    size;
  const IDLE =
    'wave:border-border wave:bg-transparent wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed';
  const CURRENT =
    'wave:border-primary wave:bg-primary wave:text-primary-foreground wave:forced-colors:bg-[Highlight] wave:forced-colors:text-[HighlightText] wave:forced-colors:forced-color-adjust-none';
  const LIST =
    '<ol class="wave-pagination__list wave:m-0 wave:flex wave:list-none wave:items-center wave:gap-1 wave:p-0">';
  const ITEM = '<li class="wave-pagination__list-item">';
  const GAP_ITEM = '<li aria-hidden="true" class="wave-pagination__list-item">';
  const MEDIUM = buttonClasses('wave:h-8 wave:w-8 wave:text-body-1');
  const SMALL = buttonClasses('wave:h-7 wave:w-7 wave:text-caption-1');
  const BASE_FIRST_PAGE = [
    LIST,
    ITEM,
    ITEM,
    ITEM,
    ITEM,
    GAP_ITEM,
    ITEM,
    ITEM,
    ITEM,
    `<button aria-disabled="true" aria-label="First page" class="wave-pagination__first-button ${MEDIUM} ${IDLE}" data-disabled="" type="button">`,
    `<button aria-disabled="true" aria-label="Previous page" class="wave-pagination__previous-button ${MEDIUM} ${IDLE}" data-disabled="" type="button">`,
    `<button aria-current="page" aria-label="Page 1" class="wave-pagination__page-button ${MEDIUM} ${CURRENT}" type="button">`,
    `<button aria-label="Page 2" class="wave-pagination__page-button ${MEDIUM} ${IDLE}" type="button">`,
    `<button aria-label="Page 20" class="wave-pagination__page-button ${MEDIUM} ${IDLE}" type="button">`,
    `<button aria-label="Next page" class="wave-pagination__next-button ${MEDIUM} ${IDLE}" type="button">`,
    `<button aria-label="Last page" class="wave-pagination__last-button ${MEDIUM} ${IDLE}" type="button">`,
    '<span class="wave-pagination__ellipsis wave:inline-flex wave:items-center wave:justify-center wave:text-muted-foreground wave:h-8 wave:w-8 wave:text-body-1">',
  ].join('\n');
  const BASE_DISABLED_LAST_PAGE = [
    LIST,
    ITEM,
    ITEM,
    ITEM,
    GAP_ITEM,
    ITEM,
    ITEM,
    ITEM,
    ITEM,
    `<button aria-label="First page" class="wave-pagination__first-button ${SMALL} ${IDLE}" disabled="" type="button">`,
    `<button aria-label="Previous page" class="wave-pagination__previous-button ${SMALL} ${IDLE}" disabled="" type="button">`,
    `<button aria-label="Page 1" class="wave-pagination__page-button ${SMALL} ${IDLE}" disabled="" type="button">`,
    `<button aria-label="Page 19" class="wave-pagination__page-button ${SMALL} ${IDLE}" disabled="" type="button">`,
    `<button aria-current="page" aria-label="Page 20" class="wave-pagination__page-button ${SMALL} ${CURRENT}" disabled="" type="button">`,
    `<button aria-label="Next page" class="wave-pagination__next-button ${SMALL} ${IDLE}" disabled="" type="button">`,
    `<button aria-label="Last page" class="wave-pagination__last-button ${SMALL} ${IDLE}" disabled="" type="button">`,
    '<span class="wave-pagination__ellipsis wave:inline-flex wave:items-center wave:justify-center wave:text-muted-foreground wave:h-7 wave:w-7 wave:text-caption-1">',
  ].join('\n');

  it('renders the parts of 414fe7d (attributes sorted), on the client and the server', () => {
    for (const slotProps of [undefined, EVERY_PART]) {
      for (const [ui, pin] of [
        [
          <Pagination
            key="first"
            totalPages={20}
            defaultCurrentPage={1}
            showFirstLast
            slotProps={slotProps}
          />,
          BASE_FIRST_PAGE,
        ],
        [
          <Pagination
            key="last"
            totalPages={20}
            defaultCurrentPage={20}
            showFirstLast
            disabled
            size="small"
            slotProps={slotProps}
          />,
          BASE_DISABLED_LAST_PAGE,
        ],
      ] as const) {
        const view = render(ui);
        expect(openingTags(...partsOf())).toBe(pin);
        view.unmount();
        const template = document.createElement('template');
        template.innerHTML = renderToString(ui);
        expect(openingTags(...partsOf(template.content))).toBe(pin);
      }
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    for (const props of [
      { defaultCurrentPage: 1, showFirstLast: true },
      { defaultCurrentPage: 10 },
      { defaultCurrentPage: 20, showFirstLast: true, disabled: true },
      { defaultCurrentPage: 3, showPreviousNext: false, size: 'small' as const },
    ]) {
      expectInertSlotProps(
        (slotProps: PaginationSlotProps | undefined) => (
          <Pagination totalPages={20} {...props} slotProps={slotProps} />
        ),
        EVERY_PART,
      );
    }
  });

  it('puts your className, style and data-* on every part, after its stable class and own classes', () => {
    const mine = (name: string) => ({
      className: `my-${name}`,
      style: { opacity: 0.5 },
      'data-part': name,
    });
    const names = Object.keys(EVERY_PART) as Array<keyof PaginationSlotProps>;
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        showFirstLast
        slotProps={Object.fromEntries(names.map((name) => [name, mine(name)]))}
      />,
    );
    for (const name of names) {
      const elements = all(document, paginationClassNames[name]);
      expect(elements.length).toBeGreaterThan(0);
      for (const element of elements) {
        expect(element.classList[0]).toBe(paginationClassNames[name]);
        expect(element.classList[element.classList.length - 1]).toBe(`my-${name}`);
        expect(element).toHaveAttribute('data-part', name);
        expect(element).toHaveStyle({ opacity: '0.5' });
      }
    }
    // Every list item takes the part: around the buttons and the ellipses.
    expect(all(document, paginationClassNames.listItem)).toHaveLength(11);
    // The landmark takes none of it.
    expect(screen.getByRole('navigation')).not.toHaveClass('my-list');
  });

  it('lets your class replace a conflicting class of a part', () => {
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        slotProps={{
          list: { className: 'gap-2' },
          pageButton: { className: 'rounded-full' },
          nextButton: { className: 'border-0' },
          ellipsis: { className: 'text-foreground' },
        }}
      />,
    );
    expect(one(paginationClassNames.list)).toHaveClass('gap-2');
    expect(one(paginationClassNames.list)).not.toHaveClass('wave:gap-1');
    expect(page(10)).toHaveClass('rounded-full');
    expect(page(10)).not.toHaveClass('wave:rounded');
    expect(screen.getByRole('button', { name: 'Next page' })).not.toHaveClass('wave:border');
    expect(one(paginationClassNames.ellipsis)).not.toHaveClass('wave:text-muted-foreground');
  });

  it('attaches your refs to the parts', () => {
    const refs = {
      list: React.createRef<HTMLOListElement>(),
      listItem: React.createRef<HTMLLIElement>(),
      firstButton: React.createRef<HTMLButtonElement>(),
      previousButton: React.createRef<HTMLButtonElement>(),
      pageButton: React.createRef<HTMLButtonElement>(),
      nextButton: React.createRef<HTMLButtonElement>(),
      lastButton: React.createRef<HTMLButtonElement>(),
      ellipsis: React.createRef<HTMLSpanElement>(),
    };
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        showFirstLast
        slotProps={Object.fromEntries(Object.entries(refs).map(([name, ref]) => [name, { ref }]))}
      />,
    );
    for (const [name, ref] of Object.entries(refs)) {
      // A part of many elements: the last one rendered.
      expect(ref.current).toBe(
        all(document, paginationClassNames[name as keyof typeof refs]).at(-1),
      );
    }
  });

  it('locks every button’s type, name, current page, disabled state, role, tab index and hidden state', () => {
    const attempt = {
      type: 'submit',
      'aria-label': 'Mine',
      'aria-current': 'step',
      disabled: true,
      'aria-disabled': true,
      'data-disabled': '',
      role: 'link',
      tabIndex: -1,
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as PaginationSlotProps['pageButton'];
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        showFirstLast
        slotProps={{
          firstButton: attempt,
          previousButton: attempt,
          pageButton: attempt,
          nextButton: attempt,
          lastButton: attempt,
        }}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'First page',
      'Previous page',
      'Page 1',
      'Page 9',
      'Page 10',
      'Page 11',
      'Page 20',
      'Next page',
      'Last page',
    ]);
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toBeEnabled();
      for (const name of [
        'aria-disabled',
        'data-disabled',
        'role',
        'tabindex',
        'hidden',
        'inert',
        'aria-hidden',
      ]) {
        expect(button).not.toHaveAttribute(name);
      }
    }
    // Only the current page is current (a state-off check on every other button).
    expect(buttons.filter((button) => button.hasAttribute('aria-current'))).toEqual([page(10)]);
    expect(page(10)).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the control’s own disabled and unavailable states over a part’s', () => {
    const enabled = {
      disabled: false,
      'aria-disabled': false,
    } as PaginationSlotProps['firstButton'];
    const { rerender } = render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={1}
        showFirstLast
        slotProps={{ firstButton: enabled, previousButton: enabled }}
      />,
    );
    for (const name of ['First page', 'Previous page']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-disabled', '');
    }
    rerender(
      <Pagination
        totalPages={20}
        defaultCurrentPage={1}
        showFirstLast
        disabled
        slotProps={{ pageButton: enabled, nextButton: enabled }}
      />,
    );
    expect(page(2)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('locks the list’s and the list items’ role and hidden state, and the ellipses’ own', () => {
    const attempt = {
      role: 'button',
      hidden: true,
      inert: true,
      'aria-hidden': false,
      tabIndex: 0,
    };
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        slotProps={{ list: attempt, listItem: attempt, ellipsis: attempt }}
      />,
    );
    const list = one(paginationClassNames.list);
    const items = all(document, paginationClassNames.listItem);
    const gapItems = items.filter((item) => item.querySelector('button') === null);
    const buttonItems = items.filter((item) => !gapItems.includes(item));
    expect(gapItems).toHaveLength(2);
    for (const element of [list, ...items]) expect(element).not.toHaveAttribute('role');
    // The list and the list items of the buttons hold the buttons: never hidden.
    for (const element of [list, ...buttonItems]) {
      for (const name of ['hidden', 'inert', 'aria-hidden']) {
        expect(element).not.toHaveAttribute(name);
      }
    }
    expect(screen.getAllByRole('button')).toHaveLength(7);
    for (const button of screen.getAllByRole('button')) expect(button).toBeVisible();
    // A tab index is yours to give where nothing is hidden from assistive technology.
    expect(list).toHaveAttribute('tabindex', '0');
    // The ellipses stay out of the accessibility tree and of the tab order; hiding them is yours.
    for (const item of gapItems) {
      expect(item).toHaveAttribute('aria-hidden', 'true');
      expect(item).not.toHaveAttribute('tabindex');
      expect(item).toHaveAttribute('hidden');
    }
    for (const ellipsis of all(document, paginationClassNames.ellipsis)) {
      expect(ellipsis).not.toHaveAttribute('tabindex');
    }
  });

  it('runs your button handlers first: preventDefault() skips the page change and onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const prevent = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        showFirstLast
        onPageChange={onPageChange}
        slotProps={{
          firstButton: { onClick: prevent },
          previousButton: { onClick: prevent },
          pageButton: { onClick: prevent },
          nextButton: { onClick: prevent },
          lastButton: { onClick: prevent },
        }}
      />,
    );
    for (const name of ['First page', 'Previous page', 'Page 11', 'Next page', 'Last page']) {
      await user.click(screen.getByRole('button', { name }));
    }
    expect(prevent).toHaveBeenCalledTimes(5);
    expect(onPageChange).not.toHaveBeenCalled();
    expect(page(10)).toHaveAttribute('aria-current', 'page');
  });

  it('runs a part handler that prevents nothing before the page change', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        onPageChange={(target) => void order.push(`change:${target}`)}
        slotProps={{
          pageButton: { onClick: () => void order.push('page') },
          nextButton: { onClick: () => void order.push('next') },
        }}
      />,
    );
    await user.click(page(11));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(order).toEqual(['page', 'change:11', 'next', 'change:12']);
  });

  it('does not call your click handler on an unavailable button, as no page change happens', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const parts = { firstButton: { onClick }, previousButton: { onClick } };
    const { rerender } = render(
      <Pagination totalPages={5} currentPage={1} showFirstLast slotProps={parts} />,
    );
    await user.click(screen.getByRole('button', { name: 'First page' }));
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onClick).not.toHaveBeenCalled();
    // Once they point at another page, they are available: yours runs.
    rerender(<Pagination totalPages={5} currentPage={3} showFirstLast slotProps={parts} />);
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls each part handler once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const handlers = { list: vi.fn(), listItem: vi.fn(), pageButton: vi.fn(), ellipsis: vi.fn() };
    render(
      <React.StrictMode>
        <Pagination
          totalPages={20}
          defaultCurrentPage={10}
          onPageChange={onPageChange}
          slotProps={{
            list: { onClick: handlers.list },
            listItem: { onClick: handlers.listItem },
            pageButton: { onClick: handlers.pageButton },
            ellipsis: { onClick: handlers.ellipsis },
          }}
        />
      </React.StrictMode>,
    );
    await user.click(page(11));
    expect(handlers.pageButton).toHaveBeenCalledTimes(1);
    expect(handlers.listItem).toHaveBeenCalledTimes(1);
    expect(handlers.list).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledTimes(1);
    fireEvent.click(one(paginationClassNames.ellipsis));
    expect(handlers.ellipsis).toHaveBeenCalledTimes(1);
  });

  it('ignores the parts of buttons and ellipses it does not render', () => {
    render(
      <Pagination
        totalPages={5}
        defaultCurrentPage={3}
        showPreviousNext={false}
        slotProps={{
          firstButton: { className: 'my-first' },
          previousButton: { className: 'my-previous' },
          nextButton: { className: 'my-next' },
          lastButton: { className: 'my-last' },
          ellipsis: { className: 'my-ellipsis' },
        }}
      />,
    );
    for (const name of ['first', 'previous', 'next', 'last', 'ellipsis']) {
      expect(document.querySelector(`.my-${name}`)).toBeNull();
    }
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('applies the parts in RTL, the glyphs still mirrored', () => {
    renderWithProviders(
      <Pagination
        totalPages={20}
        defaultCurrentPage={10}
        showFirstLast
        slotProps={{ nextButton: { className: 'my-next' }, firstButton: { dir: 'ltr' } }}
      />,
      { dir: 'rtl' },
    );
    const next = screen.getByRole('button', { name: 'Next page' });
    expect(next).toHaveClass('my-next');
    expect(next.querySelector('svg')).toHaveClass('wave:wave-rtl:-scale-x-100');
    expect(screen.getByRole('button', { name: 'First page' })).toHaveAttribute('dir', 'ltr');
  });

  it('has no accessibility violations with every part customised', async () => {
    const names = Object.keys(EVERY_PART) as Array<keyof PaginationSlotProps>;
    render(
      <Pagination
        totalPages={20}
        defaultCurrentPage={1}
        showFirstLast
        slotProps={Object.fromEntries(
          names.map((name) => [name, { className: `my-${name}`, title: name }]),
        )}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof PaginationSlotProps>().toEqualTypeOf<
      | 'list'
      | 'listItem'
      | 'firstButton'
      | 'previousButton'
      | 'pageButton'
      | 'nextButton'
      | 'lastButton'
      | 'ellipsis'
    >();
    expectTypeOf<NonNullable<PaginationSlotProps['list']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLOListElement> | undefined
    >();
    expectTypeOf<NonNullable<PaginationSlotProps['listItem']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<NonNullable<PaginationSlotProps['pageButton']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<NonNullable<PaginationSlotProps['ellipsis']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    void (
      (
        // @ts-expect-error -- a part takes no children: the control renders them
        <Pagination totalPages={3} slotProps={{ pageButton: { children: 'x' } }} />
      )
    );
  });
});

describe('Pagination stories', () => {
  it('the Localized story marks the language of its Norwegian names on the landmark (WCAG 3.1.2)', () => {
    const { Localized } = composeStories(stories);
    render(<Localized />);
    const nav = screen.getByRole('navigation', { name: 'Sidenavigasjon' });
    expect(nav).toHaveAttribute('lang', 'nb');
    expect(within(nav).getByRole('button', { name: 'Neste side' })).toBeInTheDocument();
  });
});
