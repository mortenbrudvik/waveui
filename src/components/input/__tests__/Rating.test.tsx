import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rating, RatingDisplay } from '../Rating';
import type { RatingDisplayLabels, RatingDisplayProps, RatingLabels, RatingProps } from '../Rating';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testComposedHandler,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

function star(n: number): HTMLElement {
  return screen.getByRole('radio', { name: n === 1 ? '1 star' : `${n} stars` });
}

const DEPRECATED_ON_CHANGE =
  '[WaveUI] Rating: `onChange` is deprecated and will be removed in 1.0. Use `onValueChange` ' +
  'instead.';

/** Number of stars drawn filled (the rating color). */
function filledCount(): number {
  return screen.getAllByRole('radio').filter((s) => s.classList.contains('text-rating')).length;
}

describe('Rating', () => {
  testSystemProps(Rating, {
    expectedTag: 'div',
    displayName: 'Rating',
    defaultProps: { defaultValue: 3 },
    a11yVariants: [
      { name: 'no value', props: { defaultValue: 0 } },
      { name: 'disabled', props: { disabled: true } },
      { name: 'small', props: { size: 'extra-small' } },
      { name: 'required with a name', props: { name: 'score', required: true, defaultValue: 0 } },
    ],
  });

  testNoImplicitSubmit(Rating, { defaultProps: { defaultValue: 2 } });

  testComposedHandler(Rating, {
    handler: 'onKeyDown',
    defaultProps: { defaultValue: 2 },
    act: async ({ user }) => {
      act(() => star(2).focus());
      await user.keyboard('{ArrowRight}');
    },
    assertInternal: () => {
      expect(star(3)).toHaveFocus();
      expect(star(3)).toHaveAttribute('aria-checked', 'true');
    },
    assertInternalSuppressed: () => {
      expect(star(2)).toHaveFocus();
      expect(star(2)).toHaveAttribute('aria-checked', 'true');
    },
  });

  it('is a radiogroup named "Rating" by default', () => {
    render(<Rating />);
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Rating ref={ref} />);
    expect(ref.current).toBe(screen.getByRole('radiogroup', { name: 'Rating' }));
  });

  it('merges custom className', () => {
    render(<Rating className="custom" />);
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toHaveClass('custom', 'inline-flex');
  });

  it('renders 5 stars by default', () => {
    render(<Rating />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('renders custom max stars', () => {
    render(<Rating max={10} />);
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(star(10)).toBeInTheDocument();
  });

  it('calls onValueChange when a star is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating onValueChange={onValueChange} />);
    await user.click(star(3));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(3);
    expect(star(3)).toHaveAttribute('aria-checked', 'true');
  });

  it('does not call onValueChange when the current star is clicked again', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating defaultValue={3} onValueChange={onValueChange} />);
    await user.click(star(3));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('fires onValueChange exactly once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Rating onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(star(4));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the deprecated onChange alias working and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(<Rating onChange={onChange} />);
      rerender(<Rating onChange={onChange} />);
      await user.click(star(2));
      expect(onChange).toHaveBeenCalledWith(2);
      expect(warn.mock.calls).toEqual([[DEPRECATED_ON_CHANGE]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('the deprecated onChange alias is change-only like onValueChange: clicking the current star calls neither', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(<Rating defaultValue={3} onChange={onChange} onValueChange={onValueChange} />);
      await user.click(star(3));
      expect(onChange).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(star(4));
      expect(onChange.mock.calls).toEqual([[4]]);
      expect(onValueChange.mock.calls).toEqual([[4]]);
      expect(warn.mock.calls).toEqual([[DEPRECATED_ON_CHANGE]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('names the stars with labels.star (value and max)', async () => {
    const user = userEvent.setup();
    const labels: RatingLabels = {
      star: (value, max) => `${value} étoile${value > 1 ? 's' : ''} sur ${max}`,
    };
    const onValueChange = vi.fn();
    render(<Rating aria-label="Note" max={3} labels={labels} onValueChange={onValueChange} />);
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual([
      '1 étoile sur 3',
      '2 étoiles sur 3',
      '3 étoiles sur 3',
    ]);
    await user.click(screen.getByRole('radio', { name: '2 étoiles sur 3' }));
    expect(onValueChange.mock.calls).toEqual([[2]]);
  });

  it('supports controlled value', () => {
    render(<Rating value={4} />);
    expect(star(4)).toHaveAttribute('aria-checked', 'true');
    expect(star(5)).toHaveAttribute('aria-checked', 'false');
    expect(filledCount()).toBe(4);
  });

  it('a controlled value={0} clears the rating (the keyboard cannot; §7.3)', () => {
    const { rerender } = render(<Rating value={3} />);
    expect(filledCount()).toBe(3);
    rerender(<Rating value={0} />);
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
    expect(filledCount()).toBe(0);
    // The tab stop falls back to the first star.
    expect(star(1)).toHaveAttribute('tabindex', '0');
  });

  it('supports uncontrolled defaultValue', () => {
    render(<Rating defaultValue={2} />);
    expect(star(2)).toHaveAttribute('aria-checked', 'true');
    expect(filledCount()).toBe(2);
  });

  it('applies disabled state', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating disabled defaultValue={2} onValueChange={onValueChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Rating' });
    expect(group).toHaveAttribute('aria-disabled', 'true');
    screen.getAllByRole('radio').forEach((s) => expect(s).toBeDisabled());
    // Keys and clicks never change a disabled rating.
    fireEvent.keyDown(star(2), { key: 'ArrowRight' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    await user.click(star(4));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(star(2)).toHaveAttribute('aria-checked', 'true');
  });

  it('has proper aria-label on stars', () => {
    render(<Rating />);
    expect(star(1)).toHaveAccessibleName('1 star');
    expect(star(3)).toHaveAccessibleName('3 stars');
  });
});

describe('Rating — roving focus between the stars', () => {
  it('the container is not a tab stop; only the checked star is', () => {
    render(<Rating defaultValue={3} />);
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).not.toHaveAttribute('tabindex');
    const tabbable = screen.getAllByRole('radio').filter((s) => s.tabIndex === 0);
    expect(tabbable).toEqual([star(3)]);
  });

  it('with no value, Tab reaches the first star', async () => {
    const user = userEvent.setup();
    render(<Rating />);
    await user.tab();
    expect(star(1)).toHaveFocus();
  });

  it('ArrowRight and ArrowUp move focus to the next star and select it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating defaultValue={2} onValueChange={onValueChange} />);
    await user.tab();
    expect(star(2)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(star(3)).toHaveFocus();
    expect(star(3)).toHaveAttribute('aria-checked', 'true');
    expect(star(3)).toHaveAttribute('tabindex', '0');
    await user.keyboard('{ArrowUp}');
    expect(star(4)).toHaveFocus();
    expect(star(4)).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([[3], [4]]);
  });

  it('ArrowLeft and ArrowDown move focus to the previous star and select it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating defaultValue={4} onValueChange={onValueChange} />);
    act(() => star(4).focus());
    await user.keyboard('{ArrowLeft}');
    expect(star(3)).toHaveFocus();
    expect(star(3)).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown}');
    expect(star(2)).toHaveFocus();
    expect(star(2)).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([[3], [2]]);
  });

  it('Home and End select the first and last star', async () => {
    const user = userEvent.setup();
    render(<Rating defaultValue={3} />);
    act(() => star(3).focus());
    await user.keyboard('{End}');
    expect(star(5)).toHaveFocus();
    expect(star(5)).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Home}');
    expect(star(1)).toHaveFocus();
    expect(star(1)).toHaveAttribute('aria-checked', 'true');
  });

  it('does not exceed max on ArrowRight/ArrowUp/End (no onValueChange or onChange alias, selection unchanged)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<Rating defaultValue={5} onValueChange={onValueChange} onChange={onChange} />);
      act(() => star(5).focus());
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{End}');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(star(5)).toHaveFocus();
      expect(star(5)).toHaveAttribute('aria-checked', 'true');
      expect(warn.mock.calls).toEqual([[DEPRECATED_ON_CHANGE]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not go below the first star on ArrowLeft/ArrowDown: the keyboard cannot clear the rating (no onValueChange, selection unchanged)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<Rating defaultValue={1} onValueChange={onValueChange} onChange={onChange} />);
      act(() => star(1).focus());
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowDown}');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(star(1)).toHaveFocus();
      expect(star(1)).toHaveAttribute('aria-checked', 'true');
      expect(warn.mock.calls).toEqual([[DEPRECATED_ON_CHANGE]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('mirrors Left/Right under dir="rtl"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Rating defaultValue={2} />, { dir: 'rtl' });
    act(() => star(2).focus());
    await user.keyboard('{ArrowLeft}');
    expect(star(3)).toHaveFocus();
    expect(star(3)).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(star(2)).toHaveFocus();
    expect(star(2)).toHaveAttribute('aria-checked', 'true');
  });

  it('from an empty rating, ArrowRight on the focused first star chooses 1 star (0.4: 0 → 1)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating onValueChange={onValueChange} />);
    await user.tab();
    expect(star(1)).toHaveFocus();
    expect(star(1)).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('{ArrowRight}');
    expect(star(1)).toHaveFocus();
    expect(star(1)).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([[1]]);
    await user.keyboard('{ArrowRight}');
    expect(star(2)).toHaveFocus();
    expect(onValueChange.mock.calls).toEqual([[1], [2]]);
  });

  it('from an empty rating, ArrowUp chooses 1 star', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{ArrowUp}');
    expect(star(1)).toHaveFocus();
    expect(star(1)).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([[1]]);
  });

  it('from an empty rating, Home chooses 1 star and End the last star', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { unmount } = render(<Rating onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{Home}');
    expect(star(1)).toHaveFocus();
    expect(star(1)).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([[1]]);
    unmount();

    const onEnd = vi.fn();
    render(<Rating onValueChange={onEnd} />);
    await user.tab();
    await user.keyboard('{End}');
    expect(star(5)).toHaveFocus();
    expect(star(5)).toHaveAttribute('aria-checked', 'true');
    expect(onEnd.mock.calls).toEqual([[5]]);
  });

  it('from an empty rating, ArrowLeft and ArrowDown choose nothing (bound)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowDown}');
    expect(star(1)).toHaveFocus();
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('from an empty rating under dir="rtl", ArrowLeft chooses 1 star', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderWithProviders(<Rating onValueChange={onValueChange} />, { dir: 'rtl' });
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard('{ArrowLeft}');
    expect(star(1)).toHaveFocus();
    expect(star(1)).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([[1]]);
  });

  it('arrows count from the chosen value when focus is on another star (controlled parent rejects)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // The parent never accepts a change, so the value stays 2.
    render(<Rating value={2} onValueChange={onValueChange} />);
    act(() => star(2).focus());
    await user.keyboard('{ArrowRight}');
    expect(star(3)).toHaveFocus();
    expect(star(3)).toHaveAttribute('aria-checked', 'false');
    // Still one star more than the value (3), not than the focused star (4).
    await user.keyboard('{ArrowRight}');
    expect(star(3)).toHaveFocus();
    expect(onValueChange.mock.calls).toEqual([[3], [3]]);
  });
});

describe('Rating — hover preview', () => {
  it('previews the hovered star and restores the value on unhover', async () => {
    const user = userEvent.setup();
    render(<Rating defaultValue={2} />);
    await user.hover(star(4));
    expect(filledCount()).toBe(4);
    await user.unhover(star(4));
    expect(filledCount()).toBe(2);
  });

  it('drops a stale hover preview when the rating becomes disabled', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Rating value={2} />);
    await user.hover(star(4));
    expect(filledCount()).toBe(4);
    rerender(<Rating value={2} disabled />);
    expect(filledCount()).toBe(2);
    rerender(<Rating value={3} disabled />);
    expect(filledCount()).toBe(3);
    rerender(<Rating value={3} />);
    expect(filledCount()).toBe(3);
  });
});

describe('Rating — Field integration (FieldContext)', () => {
  it('is named by the Field label instead of the default "Rating" and described by hint and error', () => {
    renderWithFieldContext(<Rating />, {
      hintId: FIELD_TEST_IDS.hintId,
      errorId: FIELD_TEST_IDS.errorId,
      required: true,
    });
    const group = screen.getByRole('radiogroup', { name: FIELD_TEST_TEXT.label });
    expect(group).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-required', 'true');
  });

  it('a consumer aria-label names the group', () => {
    render(<Rating aria-label="Product quality" />);
    expect(screen.getByRole('radiogroup', { name: 'Product quality' })).toBeInTheDocument();
  });

  it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <Rating required={false} />
      </form>,
      { required: true },
    );
    const group = screen.getByRole('radiogroup', { name: FIELD_TEST_TEXT.label });
    expect(group).not.toHaveAttribute('aria-required', 'true');
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });
});

describe('Rating — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  /** A failed check fires `invalid`, which focuses the tab stop and updates state: run it in act. */
  function checkValidity(): boolean {
    let valid = false;
    act(() => {
      valid = getForm().checkValidity();
    });
    return valid;
  }

  it('submits the rating under its name once a star is chosen', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Rating name="score" />
      </form>,
    );
    expect(new FormData(getForm()).getAll('score')).toEqual([]);
    await user.click(star(4));
    expect(new FormData(getForm()).getAll('score')).toEqual(['4']);
  });

  it('adds nothing to FormData without a name', () => {
    render(
      <form aria-label="Form">
        <Rating defaultValue={3} />
      </form>,
    );
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('required blocks validation until a star is chosen', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Rating name="score" required />
      </form>,
    );
    expect(checkValidity()).toBe(false);
    // The blocked submission moves focus to the star tab stop, where the user can fix it.
    expect(star(1)).toHaveFocus();
    await user.click(star(2));
    expect(checkValidity()).toBe(true);
  });

  it('a disabled rating neither blocks validation nor submits a value', () => {
    render(
      <form aria-label="Form">
        <Rating name="score" required disabled />
        <Rating name="kept" defaultValue={4} disabled aria-label="Kept" />
      </form>,
    );
    expect(checkValidity()).toBe(true);
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('form reset restores defaultValue (with and without a name)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Rating name="score" defaultValue={2} aria-label="Named" />
        <Rating aria-label="Unnamed" />
      </form>,
    );
    const named = screen.getByRole('radiogroup', { name: 'Named' });
    const unnamed = screen.getByRole('radiogroup', { name: 'Unnamed' });
    await user.click(named.querySelectorAll<HTMLElement>('[role="radio"]')[4]);
    await user.click(unnamed.querySelectorAll<HTMLElement>('[role="radio"]')[1]);
    act(() => getForm().reset());
    expect(named.querySelector('[aria-checked="true"]')).toHaveAccessibleName('2 stars');
    expect(unnamed.querySelector('[aria-checked="true"]')).toBeNull();
  });
});

describe('Rating — styling tokens and target size', () => {
  it('draws filled stars with the rating token and empty stars as accessible-stroke outlines', () => {
    render(<Rating defaultValue={2} />);
    expect(star(2)).toHaveClass('text-rating');
    expect(star(3)).toHaveClass('text-stroke-accessible');
    expect(star(2).querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    expect(star(3).querySelector('svg')).toHaveAttribute('fill', 'none');
    expect(star(3).querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
  });

  it('gives extra-small and small stars a 24px target', () => {
    const { rerender } = render(<Rating size="extra-small" />);
    // 12px icon + 2 × 6px padding
    expect(star(1)).toHaveClass('p-1.5');
    expect(star(1).querySelector('svg')).toHaveClass('h-3', 'w-3');
    rerender(<Rating size="small" />);
    // 16px icon + 2 × 4px padding
    expect(star(1)).toHaveClass('p-1');
    expect(star(1).querySelector('svg')).toHaveClass('h-4', 'w-4');
    rerender(<Rating size="medium" />);
    // 20px icon + 2 × 2px padding
    expect(star(1)).toHaveClass('p-0.5');
  });

  it('turns off the color transition for reduced motion and shows a focus ring on the star', () => {
    render(<Rating />);
    expect(star(1)).toHaveClass('motion-reduce:transition-none', 'focus-visible:outline-ring');
  });
});

describe('RatingDisplay', () => {
  testSystemProps(RatingDisplay, {
    expectedTag: 'div',
    displayName: 'RatingDisplay',
    defaultProps: { value: 3 },
    a11yVariants: [{ name: 'custom max', props: { value: 7, max: 10 } }],
  });

  it('has role="img" and proper aria-label', () => {
    render(<RatingDisplay value={4} max={5} />);
    expect(screen.getByRole('img', { name: 'Rating: 4 out of 5' })).toBeInTheDocument();
  });

  it('renders correct number of stars', () => {
    render(<RatingDisplay value={3} max={7} />);
    const el = screen.getByRole('img', { name: 'Rating: 3 out of 7' });
    // 7 span children for stars
    expect(el.children).toHaveLength(7);
  });

  it('draws a fraction as a partly filled star, so the stars show the value the name reports', () => {
    render(<RatingDisplay value={4.6} />);
    const stars = Array.from(screen.getByRole('img', { name: 'Rating: 4.6 out of 5' }).children);
    expect(stars).toHaveLength(5);
    for (const whole of stars.slice(0, 4)) expect(whole).toHaveClass('text-rating');
    const partial = stars[4] as HTMLElement;
    // The outline of the empty star, with the filled star clipped to the fraction over it.
    expect(partial).toHaveClass('relative', 'text-stroke-accessible');
    const clip = partial.lastElementChild as HTMLElement;
    expect(clip).toHaveClass('absolute', 'start-0', 'overflow-hidden', 'text-rating');
    expect(clip).toHaveStyle({ width: '60%' });
    expect(clip.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    expect(partial.firstElementChild).toHaveAttribute('fill', 'none');
  });

  it('fills the partly filled star from the inline start, also under dir="rtl"', () => {
    const { container } = renderWithProviders(<RatingDisplay value={0.25} max={2} />, {
      dir: 'rtl',
    });
    const [first, second] = Array.from(screen.getByRole('img').children);
    expect(first.lastElementChild).toHaveClass('start-0');
    expect(first.lastElementChild).toHaveStyle({ width: '25%' });
    expect(second).toHaveClass('text-stroke-accessible');
    expect(second.children).toHaveLength(1);
    expect(container.innerHTML).not.toMatch(/\b(left|right)-0\b/);
  });

  it('draws filled stars with the rating token and empty ones as accessible-stroke outlines', () => {
    render(<RatingDisplay value={2} max={3} />);
    const stars = Array.from(screen.getByRole('img').children);
    expect(stars[1]).toHaveClass('text-rating');
    expect(stars[2]).toHaveClass('text-stroke-accessible');
    expect(stars[2].querySelector('svg')).toHaveAttribute('fill', 'none');
  });
});

describe('RatingDisplay — value text, count, compact and localizable name', () => {
  /** The visible text of a RatingDisplay (its stars have none). */
  function visibleText(): string {
    return screen.getByRole('img').textContent ?? '';
  }

  /**
   * Runs `run` with `Intl.NumberFormat` defaulting to `defaultLocale` when no locale is passed, as
   * a runtime (a server, a browser) with that default locale does.
   */
  async function withDefaultLocale<T>(defaultLocale: string, run: () => Promise<T>): Promise<T> {
    const Native = Intl.NumberFormat;
    const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (
      locales?: Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions,
    ) {
      return new Native(locales ?? defaultLocale, options);
    } as unknown as typeof Intl.NumberFormat);
    try {
      return await run();
    } finally {
      spy.mockRestore();
    }
  }

  it('shows no text by default (the stars only, as in 0.5)', () => {
    render(<RatingDisplay value={4.5} data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root.children).toHaveLength(5);
    expect(root.textContent).toBe('');
    expect(root).not.toHaveAttribute('data-compact');
  });

  it.each([
    { locale: 'en-US', text: '4.5' },
    { locale: 'de-DE', text: '4,5' },
  ])('shows the value formatted for $locale with showValue', ({ locale, text }) => {
    render(<RatingDisplay value={4.5} showValue locale={locale} />);
    expect(visibleText()).toBe(text);
    const valueText = screen.getByText(text);
    expect(valueText).toHaveClass('ms-1', 'font-semibold', 'text-foreground', 'text-body-1');
  });

  it('shows up to one decimal', () => {
    render(<RatingDisplay value={4.56} showValue locale="en-US" />);
    expect(visibleText()).toBe('4.6');
    expect(screen.getByRole('img', { name: 'Rating: 4.6 out of 5' })).toBeInTheDocument();
  });

  it.each([
    { locale: 'en-US', text: '4.5(1,160)', name: 'Rating: 4.5 out of 5, 1,160 ratings' },
    { locale: 'de-DE', text: '4,5(1.160)', name: 'Rating: 4,5 out of 5, 1.160 ratings' },
  ])(
    'shows the value and the grouped count and adds the count to the name ($locale)',
    ({ locale, text, name }) => {
      render(<RatingDisplay value={4.5} count={1160} locale={locale} />);
      expect(visibleText()).toBe(text);
      expect(screen.getByRole('img')).toHaveAccessibleName(name);
      const countText = screen.getByText(/^\(/);
      expect(countText).toHaveClass('ms-1', 'text-muted-foreground');
    },
  );

  it('names a single rating in the singular', () => {
    render(<RatingDisplay value={5} count={1} locale="en-US" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Rating: 5 out of 5, 1 rating');
    expect(visibleText()).toBe('5(1)');
  });

  it('localizes the name with labels', () => {
    render(
      <RatingDisplay
        value={4.5}
        max={5}
        count={1160}
        locale="de-DE"
        labels={{
          rating: (value, max, formattedValue) => `Bewertung: ${formattedValue} von ${max}`,
          count: (count, formattedCount) =>
            count === 1 ? '1 Bewertung' : `${formattedCount} Bewertungen`,
        }}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName('Bewertung: 4,5 von 5, 1.160 Bewertungen');
  });

  it('passes value, max and the formatted value to labels.rating, and count to labels.count', () => {
    const rating = vi.fn(() => 'Score');
    const count = vi.fn(() => 'votes');
    render(
      <RatingDisplay
        value={3.25}
        max={10}
        count={2500}
        locale="en-US"
        labels={{ rating, count }}
      />,
    );
    expect(rating).toHaveBeenLastCalledWith(3.25, 10, '3.3');
    expect(count).toHaveBeenLastCalledWith(2500, '2,500');
    expect(screen.getByRole('img')).toHaveAccessibleName('Score, votes');
  });

  it('keeps a consumer aria-label as the name', () => {
    render(<RatingDisplay value={4} count={12} aria-label="Average: 4 stars from 12 reviews" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Average: 4 stars from 12 reviews');
  });

  it('compact renders one filled star followed by the value (and the count)', () => {
    render(<RatingDisplay value={3.5} compact count={20} locale="en-US" data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-compact', '');
    const stars = root.querySelectorAll('svg');
    expect(stars).toHaveLength(1);
    expect(stars[0]).toHaveAttribute('fill', 'currentColor');
    expect(stars[0].closest('.text-rating')).not.toBeNull();
    expect(visibleText()).toBe('3.5(20)');
    expect(root).toHaveAccessibleName('Rating: 3.5 out of 5, 20 ratings');
  });

  it.each([
    { size: 'extra-small', text: 'text-caption-1' },
    { size: 'small', text: 'text-caption-1' },
    { size: 'medium', text: 'text-body-1' },
    { size: 'large', text: 'text-body-2' },
    { size: 'extra-large', text: 'text-body-2' },
  ] as const)('sizes the text with the stars ($size)', ({ size, text }) => {
    render(<RatingDisplay value={4} showValue count={3} size={size} locale="en-US" />);
    expect(screen.getByText('4')).toHaveClass(text);
    expect(screen.getByText('(3)')).toHaveClass(text);
  });

  it('uses logical margins for the text (RTL)', () => {
    const { container } = renderWithProviders(
      <RatingDisplay value={4} count={3} locale="en-US" />,
      { dir: 'rtl' },
    );
    expect(container.innerHTML).not.toMatch(/\b(?:ml|mr)-/);
    expect(screen.getByText('4')).toHaveClass('ms-1');
  });

  it('passes axe with the value, the count and compact', async () => {
    render(
      <>
        <RatingDisplay value={4.5} showValue locale="en-US" />
        <RatingDisplay value={4.5} count={1160} locale="en-US" />
        <RatingDisplay value={4.5} compact locale="en-US" />
      </>,
    );
    await expectNoA11yViolations();
  });

  it('with locale, hydrates the server HTML without a mismatch when the runtime locales differ', async () => {
    const element = <RatingDisplay value={4.5} count={1160} locale="de-DE" />;
    const container = document.createElement('div');
    container.innerHTML = await withDefaultLocale('en-US', async () => renderToString(element));
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    // A text or attribute mismatch is reported here (React then renders the client text).
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await withDefaultLocale('nb-NO', async () => {
        await act(async () => {
          root = hydrateRoot(container, element, { onRecoverableError });
        });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(screen.getByRole('img')).toHaveAccessibleName('Rating: 4,5 out of 5, 1.160 ratings');
    } finally {
      error.mockRestore();
      act(() => root?.unmount());
      container.remove();
    }
  });

  it('falls back to the runtime locale for a tag Intl rejects, with a development warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<RatingDisplay value={4.5} showValue locale="de_DE" />);
      expect(screen.getByRole('img')).toHaveAccessibleName(
        `Rating: ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(4.5)} out of 5`,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] RatingDisplay: `locale` "de_DE" is not a valid BCP 47 language tag (use ' +
            'hyphens, as in "en-US"). The runtime default locale formats the value instead, so the ' +
            'server and the browser may render different text.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('Rating — types', () => {
  it('types the RatingDisplay text props and labels', () => {
    expectTypeOf<RatingDisplayProps['showValue']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<RatingDisplayProps['count']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<RatingDisplayProps['compact']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<RatingDisplayProps['locale']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RatingDisplayProps['labels']>().toEqualTypeOf<RatingDisplayLabels | undefined>();
    expectTypeOf<NonNullable<RatingDisplayLabels['rating']>>().toEqualTypeOf<
      (value: number, max: number, formattedValue: string) => string
    >();
    expectTypeOf<NonNullable<RatingDisplayLabels['count']>>().toEqualTypeOf<
      (count: number, formattedCount: string) => string
    >();
  });

  it('declares ref in the props interfaces (C-REF)', () => {
    expectTypeOf<RatingProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<RatingDisplayProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<RatingProps['onValueChange']>().toEqualTypeOf<
      ((value: number) => void) | undefined
    >();
  });
});
