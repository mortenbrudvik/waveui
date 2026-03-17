import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rating, RatingDisplay } from '../Rating';

describe('Rating', () => {
  it('renders without crashing', () => {
    render(<Rating data-testid="rating" />);
    expect(screen.getByTestId('rating')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Rating ref={ref} data-testid="rating" />);
    expect(ref.current).toBe(screen.getByTestId('rating'));
  });

  it('merges custom className', () => {
    render(<Rating data-testid="rating" className="custom" />);
    expect(screen.getByTestId('rating').className).toContain('custom');
  });

  it('renders 5 stars by default', () => {
    render(<Rating />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(5);
  });

  it('renders custom max stars', () => {
    render(<Rating max={10} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(10);
  });

  it('calls onChange when a star is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating onChange={onChange} />);
    const stars = screen.getAllByRole('radio');
    await user.click(stars[2]); // 3rd star
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('supports controlled value', () => {
    render(<Rating value={4} />);
    const stars = screen.getAllByRole('radio');
    expect(stars[3]).toHaveAttribute('aria-checked', 'true');
    expect(stars[4]).toHaveAttribute('aria-checked', 'false');
  });

  it('supports uncontrolled defaultValue', () => {
    render(<Rating defaultValue={2} />);
    const stars = screen.getAllByRole('radio');
    expect(stars[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('supports keyboard navigation with ArrowRight', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating defaultValue={2} onChange={onChange} />);
    const container = screen.getByRole('radiogroup');
    container.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('supports keyboard navigation with ArrowLeft', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating defaultValue={3} onChange={onChange} />);
    const container = screen.getByRole('radiogroup');
    container.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('does not exceed max on ArrowRight', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating defaultValue={5} onChange={onChange} />);
    const container = screen.getByRole('radiogroup');
    container.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('does not go below 0 on ArrowLeft', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating defaultValue={0} onChange={onChange} />);
    const container = screen.getByRole('radiogroup');
    container.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('applies disabled state', () => {
    render(<Rating disabled data-testid="rating" />);
    const stars = screen.getAllByRole('radio');
    stars.forEach((star) => expect(star).toBeDisabled());
  });

  it('has proper aria-label on stars', () => {
    render(<Rating />);
    expect(screen.getByLabelText('1 star')).toBeInTheDocument();
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument();
  });
});

describe('RatingDisplay', () => {
  it('renders without crashing', () => {
    render(<RatingDisplay value={3} data-testid="rd" />);
    expect(screen.getByTestId('rd')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<RatingDisplay ref={ref} value={3} data-testid="rd" />);
    expect(ref.current).toBe(screen.getByTestId('rd'));
  });

  it('has role="img" and proper aria-label', () => {
    render(<RatingDisplay value={4} max={5} data-testid="rd" />);
    const el = screen.getByTestId('rd');
    expect(el).toHaveAttribute('role', 'img');
    expect(el).toHaveAttribute('aria-label', 'Rating: 4 out of 5');
  });

  it('renders correct number of stars', () => {
    render(<RatingDisplay value={3} max={7} />);
    const el = screen.getByRole('img');
    // 7 span children for stars
    expect(el.children).toHaveLength(7);
  });
});
