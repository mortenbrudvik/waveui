import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rating, RatingDisplay, RatingItem } from '../Rating';
import type { RatingProps } from '../Rating';
import {
  expectNoA11yViolations,
  mockRect,
  renderWithProviders,
  testComposedHandler,
} from '../../../test-utils';

// The warning and focus tests spy on console.warn and HTMLElement.prototype.focus without
// restoring the spies themselves.
afterEach(() => {
  vi.restoreAllMocks();
});

const HeartFilled = () => <svg data-testid="heart-filled" />;
const HeartOutline = () => <svg data-testid="heart-outline" />;

function star(n: number): HTMLElement {
  return screen.getByRole('radio', { name: n === 1 ? '1 star' : `${n} stars` });
}

describe('icon pairs: an item pair, display items and empty outlines (Phase 4 D25)', () => {
  it('an item that sets one glyph draws it and the default star for the other, never the group glyph, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Rating
        aria-label="Love"
        max={2}
        defaultValue={1}
        iconFilled={<HeartFilled />}
        iconOutline={<HeartOutline />}
      >
        <Rating.Item value={1} iconFilled={<svg data-testid="own-filled" />} />
        <Rating.Item value={2} iconFilled={<svg data-testid="own-filled" />} />
      </Rating>,
    );
    expect(within(star(1)).getByTestId('own-filled')).toBeInTheDocument();
    // The unfilled star draws the default outline star, not the group's outline glyph.
    const outline = star(2).querySelector('svg');
    expect(outline).toHaveAttribute('data-wave-icon', 'star');
    expect(outline).toHaveAttribute('fill', 'none');
    expect(screen.queryByTestId('heart-filled')).toBeNull();
    expect(screen.queryByTestId('heart-outline')).toBeNull();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Rating.Item: pass both `iconFilled` and `iconOutline`: with only one of them, the other is the default star.',
      ],
    ]);
  });

  it('RatingDisplay items that set their own pair draw it, whole and partial; the others draw the group pair', () => {
    render(
      <RatingDisplay
        value={1.5}
        max={3}
        iconFilled={<HeartFilled />}
        iconOutline={<HeartOutline />}
        data-testid="root"
      >
        <RatingDisplay.Item
          value={1}
          iconFilled={<svg data-testid="own-filled" />}
          iconOutline={<svg data-testid="own-outline" />}
        />
        <Rating.Item
          value={2}
          iconFilled={<svg data-testid="own-filled" />}
          iconOutline={<svg data-testid="own-outline" />}
        />
        <RatingDisplay.Item value={3} />
      </RatingDisplay>,
    );
    const [whole, partial, empty] = Array.from(
      screen.getByTestId('root').children,
    ) as HTMLElement[];
    expect(within(whole).getByTestId('own-filled')).toBeInTheDocument();
    expect(within(whole).queryByTestId('own-outline')).toBeNull();
    // The partly filled item clips its own filled glyph over its own outline glyph.
    const [outline, clip] = Array.from(partial.children) as HTMLElement[];
    expect(within(outline).getByTestId('own-outline')).toBeInTheDocument();
    expect(clip).toHaveStyle({ width: '50%' });
    expect(within(clip).getByTestId('own-filled')).toBeInTheDocument();
    expect(within(empty).getByTestId('heart-outline')).toBeInTheDocument();
    expect(screen.queryByTestId('heart-filled')).toBeNull();
  });

  it('a button whose children render nothing draws the default star, with only the unwrap warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Rating
        aria-label="Love"
        max={1}
        defaultValue={1}
        iconFilled={<button type="button" />}
        iconOutline={<HeartOutline />}
      />,
    );
    expect(star(1).querySelector('button')).toBeNull();
    const glyph = star(1).querySelector('svg');
    expect(glyph).toHaveAttribute('data-wave-icon', 'star');
    expect(glyph).toHaveAttribute('fill', 'currentColor');
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Rating: `iconFilled` received a button element; its children render as the glyph of the star and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `iconFilled={<MyIcon />}`.',
      ],
    ]);
  });

  it.each([
    ['false', false],
    ['an empty string', ''],
  ] as const)(
    'an iconOutline that renders nothing (%s) keeps the default outline star and warns',
    (_label, nothing) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Rating
          aria-label="Love"
          max={2}
          defaultValue={1}
          iconFilled={<HeartFilled />}
          iconOutline={nothing}
        />,
      );
      expect(within(star(1)).getByTestId('heart-filled')).toBeInTheDocument();
      const outline = star(2).querySelector('svg');
      expect(outline).toHaveAttribute('data-wave-icon', 'star');
      expect(outline).toHaveAttribute('fill', 'none');
      expect(star(2)).toHaveClass('text-stroke-accessible');
      expect(warn.mock.calls).toEqual([
        ['[WaveUI] Rating: `iconOutline` renders nothing, so the default star is used.'],
      ]);
    },
  );
});

describe('half stars (Phase 4 D22, D23)', () => {
  const star3 = () => screen.getByRole('radio', { name: '3 stars' }).parentElement as HTMLElement;
  const clickAt = (el: HTMLElement, fraction: number) => {
    mockRect(el, { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    fireEvent.click(el, { clientX: 100 + fraction * 24, clientY: 12, detail: 1 });
  };

  it('renders two radios per star, over their halves, named by labels.star', () => {
    render(<Rating aria-label="Service" step={0.5} max={5} />);
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    const half = screen.getByRole('radio', { name: '2.5 stars' });
    const full = screen.getByRole('radio', { name: '3 stars' });
    expect(half).toHaveClass(
      'absolute',
      'inset-y-0',
      'start-0',
      'w-1/2',
      'opacity-0',
      'pointer-events-none',
    );
    expect(full).toHaveClass('end-0');
    expect(half.parentElement).toBe(full.parentElement);
    expect(star3()).toHaveClass('has-focus-visible:outline-2');
  });

  it('a pointer click chooses by position and focuses the chosen radio', () => {
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />);
    clickAt(star3(), 0.25);
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
    expect(screen.getByRole('radio', { name: '2.5 stars' })).toHaveFocus();
    clickAt(star3(), 0.75);
    expect(onValueChange).toHaveBeenLastCalledWith(3);
  });

  it('mirrors the halves in RTL', () => {
    const onValueChange = vi.fn();
    renderWithProviders(<Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />, {
      dir: 'rtl',
    });
    clickAt(star3(), 0.25); // the physical left is the inline end in RTL
    expect(onValueChange).toHaveBeenLastCalledWith(3);
  });

  it.each(['ltr', 'rtl'] as const)(
    'Space, Enter and a radio click choose the radio own value (%s)',
    async (dir) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <Rating aria-label="Service" step={0.5} defaultValue={2} onValueChange={onValueChange} />,
        { dir },
      );
      const three = screen.getByRole('radio', { name: '3 stars' });
      act(() => three.focus());
      await user.keyboard(' ');
      expect(onValueChange).toHaveBeenLastCalledWith(3);
      fireEvent.click(screen.getByRole('radio', { name: '1.5 stars' }));
      expect(onValueChange).toHaveBeenLastCalledWith(1.5);
    },
  );

  it('keys move by step; Home is step; End is max; no wrap and no clear', async () => {
    const user = userEvent.setup();
    render(<Rating aria-label="Service" step={0.5} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '0.5 stars' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '1 star' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}{Home}');
    expect(screen.getByRole('radio', { name: '0.5 stars' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '0.5 stars' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('snaps an off-grid controlled value; its tab stop is the lower radio', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} value={2.7} onValueChange={onValueChange} />);
    expect(screen.getByRole('radio', { name: '2.5 stars' })).toHaveAttribute('tabindex', '0');
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
  });

  it('previews halves under the mouse and clears on leave', () => {
    render(<Rating aria-label="Service" step={0.5} />);
    mockRect(star3(), { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    fireEvent.pointerMove(star3(), { clientX: 104, pointerType: 'mouse' });
    expect(star3().querySelector('[style*="width"]')).toHaveStyle({ width: '50%' });
    fireEvent.mouseLeave(screen.getByRole('radiogroup'));
    expect(star3().querySelector('[style*="width"]')).toBeNull();
  });

  it('submits 2.5, fires once per change in StrictMode, and passes axe', async () => {
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <form aria-label="Review">
          <Rating aria-label="Service" step={0.5} name="stars" onValueChange={onValueChange} />
        </form>
      </React.StrictMode>,
    );
    clickAt(star3(), 0.25);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const form = screen.getByRole('form', { name: 'Review' }) as HTMLFormElement;
    expect(new FormData(form).get('stars')).toBe('2.5');
    await expectNoA11yViolations();
  });

  it('keeps each star one 24×24px target (the 0.7 padding)', () => {
    render(<Rating aria-label="Service" step={0.5} />);
    expect(star3()).toHaveClass('p-0.5');
  });

  it('disabled: every radio is disabled and a pointer click chooses nothing', () => {
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} disabled onValueChange={onValueChange} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    clickAt(star3(), 0.25);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('types: step is 0.5 or 1', () => {
    // @ts-expect-error quarter stars are not supported
    render(<Rating aria-label="Service" step={0.25} />);
  });

  // Spec P4-03 "Tests" cases and the addendum's cases beyond the brief.

  const radio = (name: string) => screen.getByRole('radio', { name });
  /** The pointer target of the star whose full value is named `fullName`. */
  const starOf = (fullName: string) => radio(fullName).parentElement as HTMLElement;

  it.each(['ltr', 'rtl'] as const)(
    'Enter on the focused "3 stars" radio chooses 3 (%s)',
    async (dir) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <Rating aria-label="Service" step={0.5} defaultValue={2} onValueChange={onValueChange} />,
        { dir },
      );
      act(() => radio('3 stars').focus());
      await user.keyboard('{Enter}');
      expect(onValueChange.mock.calls).toEqual([[3]]);
      expect(radio('3 stars')).toHaveAttribute('aria-checked', 'true');
      expect(radio('3 stars')).toHaveFocus();
    },
  );

  it.each(['ltr', 'rtl'] as const)(
    'a click on a radio chooses its own value, never the value under the pointer (%s)',
    (dir) => {
      const onValueChange = vi.fn();
      renderWithProviders(
        <Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />,
        { dir },
      );
      act(() => radio('3 stars').click());
      expect(onValueChange.mock.calls).toEqual([[3]]);
      // A click with a press on the "1.5 stars" radio, over the half of star 2 that the pointer
      // rule would read as 2.
      mockRect(starOf('2 stars'), {
        left: 100,
        right: 124,
        top: 0,
        bottom: 24,
        width: 24,
        height: 24,
      });
      fireEvent.click(radio('1.5 stars'), {
        clientX: dir === 'rtl' ? 104 : 120,
        clientY: 12,
        detail: 1,
      });
      expect(onValueChange.mock.calls).toEqual([[3], [1.5]]);
    },
  );

  it('a click without a press on the star itself (detail 0, element.click()) chooses nothing', () => {
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />);
    mockRect(star3(), { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    act(() => star3().click());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body).toHaveFocus();
  });

  it('under dir="rtl" the physical right of a star is its half', () => {
    const onValueChange = vi.fn();
    renderWithProviders(<Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />, {
      dir: 'rtl',
    });
    clickAt(star3(), 0.75);
    expect(onValueChange.mock.calls).toEqual([[2.5]]);
    expect(radio('2.5 stars')).toHaveFocus();
  });

  it('the chosen radio takes focus without scrolling the page (preventScroll)', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<Rating aria-label="Service" step={0.5} />);
    clickAt(star3(), 0.25);
    expect(radio('2.5 stars')).toHaveFocus();
    expect(focus.mock.contexts.at(-1)).toBe(radio('2.5 stars'));
    expect(focus.mock.lastCall).toEqual([{ preventScroll: true }]);
  });

  it('after a pointer click the keyboard continues from the chosen radio', async () => {
    const user = userEvent.setup();
    render(<Rating aria-label="Service" step={0.5} />);
    clickAt(star3(), 0.25);
    await user.keyboard('{ArrowRight}');
    expect(radio('3 stars')).toHaveFocus();
    expect(radio('3 stars')).toHaveAttribute('aria-checked', 'true');
  });

  it('an off-grid controlled value checks no radio and is drawn rounded down to the step (2.7: star 3 half filled)', () => {
    render(<Rating aria-label="Service" step={0.5} value={2.7} />);
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
    expect(starOf('2 stars').firstElementChild).toHaveClass('text-rating');
    const partial = starOf('3 stars').firstElementChild as HTMLElement;
    expect(partial).toHaveClass('relative', 'text-stroke-accessible');
    expect(partial.lastElementChild).toHaveStyle({ width: '50%' });
    expect(partial.lastElementChild).toHaveClass('start-0', 'text-rating');
    expect(starOf('4 stars').firstElementChild).toHaveClass('text-stroke-accessible');
    expect(starOf('4 stars').querySelector('[style*="width"]')).toBeNull();
  });

  it('at step 1 too, an off-grid controlled value (2.5) holds the tab stop below it and the keys snap it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" value={2.5} onValueChange={onValueChange} />);
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
    expect(radio('2 stars')).toHaveAttribute('tabindex', '0');
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith(2);
  });

  it('labels.star names the half values too, each half before its full value', () => {
    const starLabel = vi.fn((value: number, max: number) => `${value} of ${max}`);
    render(<Rating aria-label="Service" step={0.5} max={2} labels={{ star: starLabel }} />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      '0.5 of 2',
      '1 of 2',
      '1.5 of 2',
      '2 of 2',
    ]);
  });

  it('the star is one box that draws the focus ring of either radio; every size keeps a 24px target', () => {
    const { rerender } = render(<Rating aria-label="Service" step={0.5} />);
    expect(star3()).toHaveClass(
      'relative',
      'inline-flex',
      'rounded',
      'has-focus-visible:outline-2',
      'has-focus-visible:outline-offset-2',
      'has-focus-visible:outline-ring',
    );
    rerender(<Rating aria-label="Service" step={0.5} size="extra-small" />);
    // 12px icon + 2 × 6px padding
    expect(star3()).toHaveClass('p-1.5');
    expect(star3().querySelector('svg')).toHaveClass('h-3', 'w-3');
    rerender(<Rating aria-label="Service" step={0.5} size="small" />);
    // 16px icon + 2 × 4px padding
    expect(star3()).toHaveClass('p-1');
  });

  it('previews the full value past the middle; touch and pen moves preview nothing', () => {
    render(<Rating aria-label="Service" step={0.5} />);
    mockRect(star3(), { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    fireEvent.pointerMove(star3(), { clientX: 118, pointerType: 'mouse' });
    expect(star3().firstElementChild).toHaveClass('text-rating');
    expect(star3().querySelector('[style*="width"]')).toBeNull();
    fireEvent.mouseLeave(screen.getByRole('radiogroup'));
    expect(star3().firstElementChild).toHaveClass('text-stroke-accessible');
    fireEvent.pointerMove(star3(), { clientX: 104, pointerType: 'touch' });
    fireEvent.pointerMove(star3(), { clientX: 104, pointerType: 'pen' });
    expect(star3().firstElementChild).toHaveClass('text-stroke-accessible');
    expect(star3().querySelector('[style*="width"]')).toBeNull();
  });

  it('disabled: a mouse move previews nothing', () => {
    render(<Rating aria-label="Service" step={0.5} disabled />);
    mockRect(star3(), { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    fireEvent.pointerMove(star3(), { clientX: 104, pointerType: 'mouse' });
    expect(star3().firstElementChild).toHaveClass('text-stroke-accessible');
    expect(star3().querySelector('[style*="width"]')).toBeNull();
  });

  it('ignores clicks and mouse moves from a portal rendered inside a star (C-COMPOSE)', () => {
    const onValueChange = vi.fn();
    const PortalGlyph = () => (
      <svg>{createPortal(<span data-testid="portaled">Tip</span>, document.body)}</svg>
    );
    render(
      <Rating
        aria-label="Service"
        step={0.5}
        max={1}
        onValueChange={onValueChange}
        iconFilled={<PortalGlyph />}
        iconOutline={<PortalGlyph />}
      />,
    );
    const portaled = screen.getByTestId('portaled');
    const box = radio('1 star').parentElement as HTMLElement;
    fireEvent.pointerMove(portaled, { clientX: 104, pointerType: 'mouse' });
    // No preview: the star stays unfilled, whole or partly.
    expect(box.firstElementChild).toHaveClass('inline-flex', 'text-stroke-accessible');
    expect(box.querySelector('[style*="width"]')).toBeNull();
    fireEvent.click(portaled, { clientX: 104, clientY: 12, detail: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('submits half values, and a form reset restores a half defaultValue', () => {
    render(
      <form aria-label="Form">
        <Rating aria-label="Service" step={0.5} name="stars" defaultValue={1.5} />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(radio('1.5 stars')).toHaveAttribute('aria-checked', 'true');
    expect(new FormData(form).get('stars')).toBe('1.5');
    clickAt(star3(), 0.75);
    expect(new FormData(form).get('stars')).toBe('3');
    act(() => form.reset());
    expect(radio('1.5 stars')).toHaveAttribute('aria-checked', 'true');
    expect(new FormData(form).get('stars')).toBe('1.5');
  });

  it('required: a blocked submission focuses the tab stop, the first half while empty', () => {
    render(
      <form aria-label="Form">
        <Rating aria-label="Service" step={0.5} name="stars" required />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    let valid = true;
    act(() => {
      valid = form.checkValidity();
    });
    expect(valid).toBe(false);
    expect(radio('0.5 stars')).toHaveFocus();
  });

  it('an untyped step other than 0.5 counts as 1: whole stars, and keys by one star', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.25 as never} onValueChange={onValueChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[1]]);
    expect(radio('1 star')).toHaveFocus();
  });

  // B21 carry-over (review Minor 2): the radio search a pointer click bails out for is bounded to
  // this star, so an unrelated `role="radio"` ancestor elsewhere in the document cannot silence
  // every pointer pick.
  it('a Rating nested inside an unrelated role="radio" element still chooses by pointer position', () => {
    const onValueChange = vi.fn();
    render(
      <div role="radio" aria-checked="false">
        <Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />
      </div>,
    );
    clickAt(star3(), 0.25);
    expect(onValueChange.mock.calls).toEqual([[2.5]]);
  });

  // B21 carry-over (review Minor 4): pins the ends at step 0.5 (the keys' 0.7 "no wrap, no clear"
  // rule extended to the half grid).
  it('ArrowRight at max emits nothing', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} value={5} onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('ArrowLeft at the minimum step (0.5) emits nothing', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} value={0.5} onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('types: RatingProps step', () => {
    expectTypeOf<RatingProps['step']>().toEqualTypeOf<0.5 | 1 | undefined>();
  });
});

describe('Rating.Item at step 0.5: the star element (Phase 4 D22, D26)', () => {
  /** A two-star half-star Rating whose second star is the item under test: a complete set. */
  function HalfRating({ children }: { children: React.ReactNode }) {
    return (
      <Rating aria-label="Service" max={2} step={0.5}>
        <Rating.Item value={1} />
        {children}
      </Rating>
    );
  }

  const star2 = () => screen.getByRole('radio', { name: '2 stars' }).parentElement as HTMLElement;
  const atStartHalf = (type: 'click' | 'pointerMove') => {
    mockRect(star2(), { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    if (type === 'click') fireEvent.click(star2(), { clientX: 106, clientY: 12, detail: 1 });
    else fireEvent.pointerMove(star2(), { clientX: 106, pointerType: 'mouse' });
  };

  testComposedHandler(RatingItem, {
    handler: 'onClick',
    defaultProps: { value: 2 },
    wrapper: HalfRating,
    act: async () => atStartHalf('click'),
    assertInternal: () => {
      expect(screen.getByRole('radio', { name: '1.5 stars' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    },
    assertInternalSuppressed: () => {
      expect(screen.getByRole('radio', { name: '1.5 stars' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    },
  });

  testComposedHandler(RatingItem, {
    handler: 'onPointerMove',
    defaultProps: { value: 2 },
    wrapper: HalfRating,
    act: async () => atStartHalf('pointerMove'),
    assertInternal: () => {
      expect(star2().querySelector('[style*="width"]')).toHaveStyle({ width: '50%' });
    },
    assertInternalSuppressed: () => {
      expect(star2().querySelector('[style*="width"]')).toBeNull();
    },
  });

  it('routes ref, className, style, data-* and the other handlers to the star span', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLElement>();
    const onMouseEnter = vi.fn();
    render(
      <HalfRating>
        <Rating.Item
          value={2}
          ref={ref}
          className="custom-star"
          style={{ opacity: 0.5 }}
          data-testid="star"
          title="Two"
          onMouseEnter={onMouseEnter}
        />
      </HalfRating>,
    );
    const box = screen.getByTestId('star');
    expect(box).toBe(star2());
    expect(box.tagName).toBe('SPAN');
    expect(ref.current).toBe(box);
    expect(box).toHaveClass('custom-star', 'relative', 'inline-flex', 'p-0.5');
    expect(box).toHaveStyle({ opacity: '0.5' });
    expect(box).toHaveAttribute('title', 'Two');
    await user.hover(box);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });
});

describe('item value checks (Phase 4 D26)', () => {
  it('warns once per duplicated value, per value outside 1…max and for a missing value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Rating aria-label="Service" max={3}>
        <Rating.Item value={1} />
        <Rating.Item value={1} />
        <Rating.Item value={4} />
      </Rating>,
    );
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[WaveUI] Rating.Item: two items have the value 1; give each star a unique value from 1 to max.',
      '[WaveUI] Rating.Item: the value 4 is not a whole number from 1 to 3.',
      '[WaveUI] Rating.Item: no item has the value 2; pass one Rating.Item per value from 1 to max.',
    ]);
  });

  it('logs each message once in StrictMode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <React.StrictMode>
        <Rating aria-label="Service" max={3}>
          <Rating.Item value={1} />
          <Rating.Item value={1} />
          <Rating.Item value={4} />
        </Rating>
      </React.StrictMode>,
    );
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[WaveUI] Rating.Item: two items have the value 1; give each star a unique value from 1 to max.',
      '[WaveUI] Rating.Item: the value 4 is not a whole number from 1 to 3.',
      '[WaveUI] Rating.Item: no item has the value 2; pass one Rating.Item per value from 1 to max.',
    ]);
  });

  it('generated stars never warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Rating aria-label="Service" max={7} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a compact RatingDisplay ignores children and never warns about a missing value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <RatingDisplay value={2} max={3} compact>
        <RatingDisplay.Item value={1} />
      </RatingDisplay>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('outside a root in production: logs once and renders an empty display star', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<RatingItem value={1} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});
