import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../Pagination';
import { testSystemProps } from '../../../test-utils';

describe('Pagination', () => {
  testSystemProps(Pagination, {
    expectedTag: 'nav',
    displayName: 'Pagination',
    defaultProps: { totalPages: 10 },
  });

  it('renders with aria-label="Pagination"', () => {
    render(<Pagination data-testid="pag" totalPages={5} />);
    expect(screen.getByTestId('pag')).toHaveAttribute('aria-label', 'Pagination');
  });

  it('renders correct page numbers for small total', () => {
    render(<Pagination totalPages={5} showPreviousNext={false} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`Page ${i}`)).toBeInTheDocument();
    }
  });

  it('marks current page with aria-current="page"', () => {
    render(<Pagination totalPages={5} defaultCurrentPage={3} showPreviousNext={false} />);
    expect(screen.getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Page 1')).not.toHaveAttribute('aria-current');
  });

  it('handles page changes in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination totalPages={5} onPageChange={onPageChange} showPreviousNext={false} />);

    await user.click(screen.getByLabelText('Page 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
    // After clicking, page 3 should become current
    expect(screen.getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
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

    await user.click(screen.getByLabelText('Page 4'));
    expect(onPageChange).toHaveBeenCalledWith(4);
    // In controlled mode, page should not update until prop changes
    expect(screen.getByLabelText('Page 1')).toHaveAttribute('aria-current', 'page');

    rerender(
      <Pagination
        totalPages={5}
        currentPage={4}
        onPageChange={onPageChange}
        showPreviousNext={false}
      />,
    );
    expect(screen.getByLabelText('Page 4')).toHaveAttribute('aria-current', 'page');
  });

  it('disables previous button on first page', () => {
    render(<Pagination totalPages={5} defaultCurrentPage={1} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<Pagination totalPages={5} defaultCurrentPage={5} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
  });

  it('navigates with previous and next buttons', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination totalPages={5} defaultCurrentPage={3} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByLabelText('Next page'));
    // After previous click, current is 2, so next goes to 3
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('shows ellipsis for many pages', () => {
    render(<Pagination totalPages={20} defaultCurrentPage={10} showPreviousNext={false} />);
    const ellipses = document.querySelectorAll('[aria-hidden="true"]');
    expect(ellipses.length).toBeGreaterThanOrEqual(2);
  });

  it('shows first/last buttons when showFirstLast is true', () => {
    render(<Pagination totalPages={10} showFirstLast />);
    expect(screen.getByLabelText('First page')).toBeInTheDocument();
    expect(screen.getByLabelText('Last page')).toBeInTheDocument();
  });

  it('disables all buttons when disabled', () => {
    render(<Pagination totalPages={5} disabled />);
    const buttons = document.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('applies small size classes', () => {
    render(<Pagination totalPages={3} size="small" showPreviousNext={false} />);
    const button = screen.getByLabelText('Page 1');
    expect(button.className).toContain('h-7');
    expect(button.className).toContain('w-7');
  });
});
