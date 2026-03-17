import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Carousel } from '../Carousel';
import { testRestSpread, testClassName } from '../../../test-utils';

describe('Carousel', () => {
  testRestSpread(Carousel);
  testClassName(Carousel);

  it('forwards ref to DOM element', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Carousel ref={ref} data-testid="ref-test">
        <Carousel.Item>Slide 1</Carousel.Item>
      </Carousel>,
    );
    const el = screen.getByTestId('ref-test');
    expect(ref.current).toBe(el);
    expect(el.tagName.toLowerCase()).toBe('div');
  });

  it('renders without crashing', () => {
    render(
      <Carousel data-testid="carousel">
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    expect(screen.getByTestId('carousel')).toBeInTheDocument();
  });

  it('has carousel role and roledescription', () => {
    render(
      <Carousel data-testid="carousel">
        <Carousel.Item>Slide 1</Carousel.Item>
      </Carousel>,
    );
    const el = screen.getByTestId('carousel');
    expect(el).toHaveAttribute('role', 'region');
    expect(el).toHaveAttribute('aria-roledescription', 'carousel');
  });

  it('renders slide content', () => {
    render(
      <Carousel>
        <Carousel.Item>First Slide Content</Carousel.Item>
        <Carousel.Item>Second Slide Content</Carousel.Item>
      </Carousel>,
    );
    expect(screen.getByText('First Slide Content')).toBeInTheDocument();
    expect(screen.getByText('Second Slide Content')).toBeInTheDocument();
  });

  it('renders prev/next navigation buttons', () => {
    render(
      <Carousel>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    expect(screen.getByLabelText('Previous slide')).toBeInTheDocument();
    expect(screen.getByLabelText('Next slide')).toBeInTheDocument();
  });

  it('renders dot indicators', () => {
    render(
      <Carousel>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
        <Carousel.Item>Slide 3</Carousel.Item>
      </Carousel>,
    );
    const dots = screen.getAllByRole('tab');
    expect(dots).toHaveLength(3);
  });

  it('navigates to next slide on next button click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Carousel defaultValue={0} onValueChange={onChange}>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    await user.click(screen.getByLabelText('Next slide'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('navigates to previous slide on prev button click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Carousel defaultValue={1} onValueChange={onChange}>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    await user.click(screen.getByLabelText('Previous slide'));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('disables prev button at first slide when loop is false', () => {
    render(
      <Carousel defaultValue={0}>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    expect(screen.getByLabelText('Previous slide')).toBeDisabled();
  });

  it('disables next button at last slide when loop is false', () => {
    render(
      <Carousel defaultValue={1}>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    expect(screen.getByLabelText('Next slide')).toBeDisabled();
  });

  it('loops from last to first when loop is true', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Carousel defaultValue={1} onValueChange={onChange} loop>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    await user.click(screen.getByLabelText('Next slide'));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('navigates via dot indicator click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Carousel defaultValue={0} onValueChange={onChange}>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
        <Carousel.Item>Slide 3</Carousel.Item>
      </Carousel>,
    );
    await user.click(screen.getByLabelText('Go to slide 3'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('controlled: respects value prop', () => {
    render(
      <Carousel value={1}>
        <Carousel.Item>Slide 1</Carousel.Item>
        <Carousel.Item>Slide 2</Carousel.Item>
      </Carousel>,
    );
    const dot2 = screen.getByLabelText('Go to slide 2');
    expect(dot2).toHaveAttribute('aria-selected', 'true');
  });
});
