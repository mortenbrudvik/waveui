import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleButton } from '../ToggleButton';
import type { ToggleButtonProps } from '../ToggleButton';
import { buttonClassName } from '../buttonStyles';
import {
  testSystemProps,
  testFocusEvents,
  testNoImplicitSubmit,
  renderWithProviders,
} from '../../../test-utils';
import type { Appearance, IconPosition } from '../../../lib/types';

const APPEARANCES: Appearance[] = ['primary', 'outline', 'subtle', 'transparent'];

const BoldIcon = () => (
  <svg data-testid="bold-icon" viewBox="0 0 16 16" width="16" height="16">
    <path d="M4 2h5a3 3 0 0 1 0 6H4zM4 8h6a3 3 0 0 1 0 6H4z" fill="currentColor" />
  </svg>
);

/** The class list of an element as a sorted array (order-independent comparison). */
const classesOf = (el: Element) => Array.from(el.classList).sort();
/** The classes of a `buttonClassName()` result as a sorted array. */
const classesFrom = (value: string) => value.split(/\s+/).filter(Boolean).sort();

describe('ToggleButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(ToggleButton, {
    expectedTag: 'button',
    displayName: 'ToggleButton',
    defaultProps: { children: 'Bold' },
    conflictingClass: { className: 'px-8', overrides: 'px-3' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'pressed', props: { pressed: true } },
      { name: 'pressed and disabled', props: { pressed: true, disabled: true } },
      { name: 'pressed and disabledFocusable', props: { pressed: true, disabledFocusable: true } },
      { name: 'icon only with aria-label', props: { icon: <BoldIcon />, 'aria-label': 'Bold' } },
    ],
  });

  testFocusEvents(ToggleButton, { children: 'Bold' });

  testNoImplicitSubmit(ToggleButton, { defaultProps: { children: 'Bold' } });

  it('renders a native button with type="button" that a consumer may override (button-provider#1)', () => {
    const { rerender } = render(<ToggleButton>Bold</ToggleButton>);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('type', 'button');
    rerender(<ToggleButton type="submit">Bold</ToggleButton>);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('type', 'submit');
  });

  describe('icon slot (button-provider#21, data-display#31)', () => {
    it('renders the icon shorthand inside an aria-hidden span', () => {
      render(<ToggleButton icon={<BoldIcon />}>Bold</ToggleButton>);
      const icon = screen.getByTestId('bold-icon');
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(icon.parentElement).toHaveClass('inline-flex', 'shrink-0');
    });

    it('renders icon as SlotObject', () => {
      render(
        <ToggleButton
          icon={{ children: <span data-testid="slot-icon">I</span>, className: 'custom' }}
        >
          Italic
        </ToggleButton>,
      );
      const icon = screen.getByTestId('slot-icon');
      expect(icon.parentElement).toHaveClass('custom', 'shrink-0');
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps icon text out of the accessible name', () => {
      render(<ToggleButton icon={{ children: 'B' }}>Bold</ToggleButton>);
      expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    });

    it('warns once in development when an icon-only toggle has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ToggleButton icon={<BoldIcon />} />);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Button: an icon-only button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon is decorative and hidden from assistive technology).',
        ],
      ]);
    });

    it('iconPosition="after" renders the icon after the label; the default is before', () => {
      render(
        <>
          <ToggleButton icon={<BoldIcon />}>Bold</ToggleButton>
          <ToggleButton icon={{ children: <BoldIcon /> }} iconPosition="after">
            Italic
          </ToggleButton>
        </>,
      );
      const bold = screen.getByRole('button', { name: 'Bold' });
      const italic = screen.getByRole('button', { name: 'Italic' });
      expect(bold.firstChild).toHaveAttribute('aria-hidden', 'true');
      expect(bold.lastChild?.textContent).toBe('Bold');
      expect(italic.firstChild?.textContent).toBe('Italic');
      expect(italic.lastChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('iconPosition="after" has no effect on an icon-only toggle: one child, square sizing', () => {
      render(
        <ToggleButton icon={<BoldIcon />} iconPosition="after" aria-label="Bold" size="large" />,
      );
      const button = screen.getByRole('button', { name: 'Bold' });
      expect(button.childNodes).toHaveLength(1);
      expect(button.firstChild).toHaveAttribute('aria-hidden', 'true');
      expect(button).toHaveClass('h-10', 'w-10');
      expect(button).not.toHaveClass('min-w-24');
    });

    it('iconPosition keeps the DOM order in RTL (the writing direction mirrors it)', () => {
      renderWithProviders(
        <>
          <ToggleButton icon={<BoldIcon />}>Bold</ToggleButton>
          <ToggleButton icon={<BoldIcon />} iconPosition="after">
            Italic
          </ToggleButton>
        </>,
        { dir: 'rtl' },
      );
      const bold = screen.getByRole('button', { name: 'Bold' });
      const italic = screen.getByRole('button', { name: 'Italic' });
      expect(bold.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(bold.firstChild).toHaveAttribute('aria-hidden', 'true');
      expect(bold.lastChild?.textContent).toBe('Bold');
      expect(italic.firstChild?.textContent).toBe('Italic');
      expect(italic.lastChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('does not warn for an icon-only toggle with an aria-label', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ToggleButton icon={<BoldIcon />} aria-label="Bold" />);
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveClass('w-8');
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('uncontrolled', () => {
    it('starts unpressed by default', () => {
      render(<ToggleButton>Toggle</ToggleButton>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });

    it('starts pressed when defaultPressed is true', () => {
      render(<ToggleButton defaultPressed>Toggle</ToggleButton>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles pressed state', async () => {
      const user = userEvent.setup();
      render(<ToggleButton>Toggle</ToggleButton>);
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-pressed', 'false');
      await user.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      await user.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onPressedChange with each new value', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      render(<ToggleButton onPressedChange={onPressedChange}>Toggle</ToggleButton>);
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('button'));
      expect(onPressedChange.mock.calls).toEqual([[true], [false]]);
    });

    it('toggles with the keyboard (Enter and Space)', async () => {
      const user = userEvent.setup();
      render(<ToggleButton>Toggle</ToggleButton>);
      const btn = screen.getByRole('button');
      await user.tab();
      await user.keyboard('{Enter}');
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard(' ');
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('controlled (button-provider#15, table-core#3)', () => {
    it('pressed={true} renders aria-pressed="true" and a click requests false', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      render(
        <ToggleButton pressed onPressedChange={onPressedChange}>
          Toggle
        </ToggleButton>,
      );
      const btn = screen.getByRole('button', { name: 'Toggle' });
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      await user.click(btn);
      expect(onPressedChange).toHaveBeenCalledTimes(1);
      expect(onPressedChange).toHaveBeenCalledWith(false);
      // The parent did not accept the change.
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });

    it('follows a new controlled value on rerender', () => {
      const { rerender } = render(<ToggleButton pressed={false}>Toggle</ToggleButton>);
      const btn = screen.getByRole('button', { name: 'Toggle' });
      expect(btn).toHaveAttribute('aria-pressed', 'false');
      rerender(<ToggleButton pressed>Toggle</ToggleButton>);
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      rerender(<ToggleButton pressed={false}>Toggle</ToggleButton>);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('a parent that accepts the change toggles on every click', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      const Parent = () => {
        const [pressed, setPressed] = React.useState(false);
        return (
          <ToggleButton
            pressed={pressed}
            onPressedChange={(next) => {
              onPressedChange(next);
              setPressed(next);
            }}
          >
            Toggle
          </ToggleButton>
        );
      };
      render(<Parent />);
      const btn = screen.getByRole('button', { name: 'Toggle' });
      await user.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      await user.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
      expect(onPressedChange.mock.calls).toEqual([[true], [false]]);
    });

    it('a parent that ignores the callback: separate clicks emit (true), (true) while aria-pressed stays false', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      render(
        <ToggleButton pressed={false} onPressedChange={onPressedChange}>
          Toggle
        </ToggleButton>,
      );
      const btn = screen.getByRole('button', { name: 'Toggle' });
      await user.click(btn);
      await user.click(btn);
      expect(onPressedChange.mock.calls).toEqual([[true], [true]]);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('fireEvent clicks separated by a microtask are separate interactions: (true), (true)', async () => {
      const onPressedChange = vi.fn();
      render(
        <ToggleButton pressed={false} onPressedChange={onPressedChange}>
          Toggle
        </ToggleButton>,
      );
      const btn = screen.getByRole('button', { name: 'Toggle' });
      fireEvent.click(btn);
      await act(async () => {});
      fireEvent.click(btn);
      expect(onPressedChange.mock.calls).toEqual([[true], [true]]);
    });

    it('back-to-back fireEvent clicks run in one task and chain: (true), (false) (spec §2.3)', () => {
      const onPressedChange = vi.fn();
      render(
        <ToggleButton pressed={false} onPressedChange={onPressedChange}>
          Toggle
        </ToggleButton>,
      );
      const btn = screen.getByRole('button', { name: 'Toggle' });
      fireEvent.click(btn);
      fireEvent.click(btn);
      expect(onPressedChange.mock.calls).toEqual([[true], [false]]);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('a disabled toggle does not call onPressedChange or onClick', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      const onClick = vi.fn();
      render(
        <ToggleButton disabled onPressedChange={onPressedChange} onClick={onClick}>
          Toggle
        </ToggleButton>,
      );
      const btn = screen.getByRole('button', { name: 'Toggle' });
      expect(btn).toBeDisabled();
      await user.click(btn);
      expect(onPressedChange).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('a disabledFocusable toggle stays focusable but never toggles (StrictMode)', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      const onClick = vi.fn();
      render(
        <React.StrictMode>
          <ToggleButton disabledFocusable onPressedChange={onPressedChange} onClick={onClick}>
            Toggle
          </ToggleButton>
        </React.StrictMode>,
      );
      const btn = screen.getByRole('button', { name: 'Toggle' });
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveAttribute('aria-disabled', 'true');
      expect(btn).toHaveAttribute('data-disabled-focusable', '');
      await user.tab();
      expect(btn).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.click(btn);
      expect(onPressedChange).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it.each([
      ['uncontrolled', undefined],
      ['controlled', false],
    ])('StrictMode: onPressedChange fires exactly once per click (%s)', async (_mode, pressed) => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      render(
        <React.StrictMode>
          <ToggleButton pressed={pressed} onPressedChange={onPressedChange}>
            Toggle
          </ToggleButton>
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      expect(onPressedChange).toHaveBeenCalledTimes(1);
      expect(onPressedChange).toHaveBeenCalledWith(true);
    });
  });

  describe('onClick (C-COMPOSE)', () => {
    it('calls onClick alongside the toggle', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<ToggleButton onClick={onClick}>Toggle</ToggleButton>);
      await user.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledOnce();
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('a consumer onClick runs first and can cancel the toggle with preventDefault', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      const onPressedChange = vi.fn(() => order.push('toggle'));
      const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
        order.push('consumer');
        if (event.currentTarget.dataset.locked === 'true') event.preventDefault();
      });
      const { rerender } = render(
        <ToggleButton onClick={onClick} onPressedChange={onPressedChange}>
          Toggle
        </ToggleButton>,
      );
      await user.click(screen.getByRole('button'));
      expect(order).toEqual(['consumer', 'toggle']);

      rerender(
        <ToggleButton onClick={onClick} onPressedChange={onPressedChange} data-locked="true">
          Toggle
        </ToggleButton>,
      );
      await user.click(screen.getByRole('button'));
      expect(onPressedChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('styles (button-provider#3, #10, #19, #20)', () => {
    it.each(APPEARANCES)('unpressed %s uses the shared button classes', (appearance) => {
      render(<ToggleButton appearance={appearance}>Toggle</ToggleButton>);
      expect(classesOf(screen.getByRole('button'))).toEqual(
        classesFrom(buttonClassName({ appearance })),
      );
    });

    it.each(APPEARANCES)('pressed %s uses the shared pressed classes', (appearance) => {
      render(
        <ToggleButton appearance={appearance} defaultPressed>
          Toggle
        </ToggleButton>,
      );
      expect(classesOf(screen.getByRole('button'))).toEqual(
        classesFrom(buttonClassName({ appearance, pressed: true })),
      );
    });

    it.each(APPEARANCES)('pressed and disabled %s uses the shared classes', (appearance) => {
      render(
        <ToggleButton appearance={appearance} pressed disabled>
          Toggle
        </ToggleButton>,
      );
      expect(classesOf(screen.getByRole('button'))).toEqual(
        classesFrom(buttonClassName({ appearance, pressed: true, disabled: true })),
      );
    });

    it.each(APPEARANCES)(
      'pressed and disabledFocusable %s uses the pressed-and-disabled classes',
      (appearance) => {
        render(
          <ToggleButton appearance={appearance} pressed disabledFocusable>
            Toggle
          </ToggleButton>,
        );
        const btn = screen.getByRole('button', { name: 'Toggle' });
        expect(btn).not.toBeDisabled();
        expect(classesOf(btn)).toEqual(
          classesFrom(buttonClassName({ appearance, pressed: true, disabled: true })),
        );
      },
    );

    it('a pressed toggle with a consumer aria-disabled uses the pressed-and-disabled classes', () => {
      render(
        <ToggleButton defaultPressed aria-disabled="true">
          Toggle
        </ToggleButton>,
      );
      const btn = screen.getByRole('button', { name: 'Toggle' });
      expect(btn).not.toBeDisabled();
      expect(classesOf(btn)).toEqual(
        classesFrom(buttonClassName({ pressed: true, disabled: true })),
      );
    });

    it('primary uses the primary tokens with gated hover and pressed colors (no raw colors)', () => {
      render(<ToggleButton appearance="primary">Toggle</ToggleButton>);
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass(
        'bg-primary',
        'text-primary-foreground',
        'not-disabled:not-aria-disabled:hover:bg-primary-hover',
        'not-disabled:not-aria-disabled:active:bg-primary-pressed',
      );
    });

    it('a pressed outline toggle uses the selected tokens', () => {
      render(<ToggleButton defaultPressed>Toggle</ToggleButton>);
      expect(screen.getByRole('button')).toHaveClass(
        'bg-selected',
        'text-selected-foreground',
        'border-primary',
      );
    });

    it('shows the pressed state in forced colors with the container recipe', () => {
      render(<ToggleButton defaultPressed>Toggle</ToggleButton>);
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass('forced-colors:outline-[Highlight]');
      expect(btn).not.toHaveClass('forced-colors:forced-color-adjust-none');
    });

    it('gates every hover and pressed class and never uses the enabled: variant', () => {
      render(
        <>
          <ToggleButton appearance="primary">One</ToggleButton>
          <ToggleButton defaultPressed>Two</ToggleButton>
        </>,
      );
      for (const btn of screen.getAllByRole('button')) {
        const classes = Array.from(btn.classList);
        expect(classes.filter((c) => c.includes('enabled:'))).toEqual([]);
        expect(
          classes.filter(
            (c) =>
              /(^|:)(hover|active):/.test(c) && !c.startsWith('not-disabled:not-aria-disabled:'),
          ),
        ).toEqual([]);
      }
    });

    it('extra-large uses a larger font than large (button-provider#19)', () => {
      render(
        <>
          <ToggleButton size="large">Large</ToggleButton>
          <ToggleButton size="extra-large">Extra large</ToggleButton>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('text-body-2');
      const xl = screen.getByRole('button', { name: 'Extra large' });
      expect(xl).toHaveClass('text-[18px]/[24px]');
      expect(xl).not.toHaveClass('text-sm');
    });

    it('follows the provider theme through tokens', () => {
      renderWithProviders(<ToggleButton defaultPressed>Toggle</ToggleButton>, { theme: 'dark' });
      const btn = screen.getByRole('button', { name: 'Toggle' });
      expect(btn.closest('.wave-dark')).not.toBeNull();
      expect(btn).toHaveClass('bg-selected', 'text-selected-foreground');
    });
  });

  describe('types (button-provider#27)', () => {
    it('ToggleButtonProps carries ref (C-REF)', () => {
      expectTypeOf<ToggleButtonProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLButtonElement> | undefined
      >();
      const ref = React.createRef<HTMLButtonElement>();
      render(<ToggleButton ref={ref}>Toggle</ToggleButton>);
      expect(ref.current).toBe(screen.getByRole('button', { name: 'Toggle' }));
    });

    it('iconPosition is an IconPosition; disabledFocusable is a boolean', () => {
      expectTypeOf<ToggleButtonProps['iconPosition']>().toEqualTypeOf<IconPosition | undefined>();
      expectTypeOf<ToggleButtonProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
      // @ts-expect-error iconPosition is 'before' | 'after'
      const element = <ToggleButton iconPosition="end">Bold</ToggleButton>;
      expect(element).toBeTruthy();
    });
  });
});
