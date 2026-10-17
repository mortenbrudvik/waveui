import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SwatchPicker } from '../SwatchPicker';
import { ColorSwatch, EmptySwatch, ImageSwatch } from '../SwatchPicker.swatches';
import { Button } from '../../button/Button';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../../overlays/Tooltip';
import { expectThrows, testComposedHandler, testSystemProps } from '../../../test-utils';

function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

function unnamedMessage(value: string): string {
  return (
    `[WaveUI] ColorSwatch: swatch "${value}" has no accessible name, so it is announced by its ` +
    'color value. Pass `aria-label`, or wrap it in a Tooltip with `relationship="label"`.'
  );
}

function duplicateMessage(value: string): string {
  return (
    `[WaveUI] SwatchPicker: several swatches share the value "${value}". Swatch values must be ` +
    'unique; only the first one can be selected.'
  );
}

describe('ColorSwatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  testSystemProps(ColorSwatch, {
    expectedTag: 'button',
    displayName: 'ColorSwatch',
    defaultProps: { value: 'red', color: '#d13438', 'aria-label': 'Red' },
    wrapper: ({ children }) => (
      <SwatchPicker aria-label="Color" defaultValue="red">
        {children}
      </SwatchPicker>
    ),
    a11yVariants: [
      { name: 'unselected', props: { value: 'blue', color: '#0f6cbd', 'aria-label': 'Blue' } },
    ],
  });

  testComposedHandler(ColorSwatch, {
    handler: 'onClick',
    defaultProps: { value: 'red', color: '#d13438', 'aria-label': 'Red' },
    wrapper: ({ children }) => <SwatchPicker aria-label="Color">{children}</SwatchPicker>,
    act: async ({ user }) => {
      await user.click(screen.getByRole('radio', { name: 'Red' }));
    },
    assertInternal: () =>
      expect(screen.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true'),
    assertInternalSuppressed: () =>
      expect(screen.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'false'),
  });

  it('renders items before children in one radio group', () => {
    render(
      <SwatchPicker aria-label="Color" items={[{ value: 'red', color: '#d13438', label: 'Red' }]}>
        <ColorSwatch value="blue" color="#0f6cbd" aria-label="Blue" />
      </SwatchPicker>,
    );
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Red',
      'Blue',
    ]);
  });

  it('lets a Tooltip name and describe a swatch button', () => {
    render(
      <SwatchPicker aria-label="Color">
        <Tooltip content="Ocean blue" relationship="label">
          <ColorSwatch value="blue" color="#0f6cbd" />
        </Tooltip>
      </SwatchPicker>,
    );
    expect(screen.getByRole('radio', { name: 'Ocean blue' })).toBeInTheDocument();
  });

  it('throws outside a picker in development and renders inert in production', () => {
    expectThrows(
      <ColorSwatch value="x" color="red" />,
      '[WaveUI] ColorSwatch must be used within SwatchPicker',
    );

    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ColorSwatch value="x" color="red" aria-label="Red" />);
    const swatch = screen.getByRole('radio', { name: 'Red' });
    expect(swatch).toHaveAttribute('tabindex', '-1');
    expect(swatch).toHaveAttribute('aria-checked', 'false');
    expect(error.mock.calls).toEqual([['[WaveUI] ColorSwatch must be used within SwatchPicker']]);
  });

  it('warns once per duplicated value and once for an unnamed swatch, even rerendered', () => {
    const warn = spyWarn();
    const duplicated = (
      <SwatchPicker aria-label="Color">
        <ColorSwatch value="a" color="#000001" />
        <ColorSwatch value="a" color="#000002" aria-label="Two" />
      </SwatchPicker>
    );
    const { rerender } = render(duplicated);
    // (a) A rerender with the same duplicates must not add a second warning.
    rerender(duplicated);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls).toEqual(
      expect.arrayContaining([[unnamedMessage('a')], [duplicateMessage('a')]]),
    );
  });

  it('warns exactly once per duplicated value and once for an unnamed swatch, in StrictMode', () => {
    const warn = spyWarn();
    const duplicated = (
      <React.StrictMode>
        <SwatchPicker aria-label="Color">
          <ColorSwatch value="a" color="#000001" />
          <ColorSwatch value="a" color="#000002" aria-label="Two" />
        </SwatchPicker>
      </React.StrictMode>
    );
    const { rerender } = render(duplicated);
    rerender(duplicated);
    // StrictMode's double mount effects (register, then its cleanup, then register again) must
    // still settle on exactly these two warnings, not four.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls).toEqual(
      expect.arrayContaining([[unnamedMessage('a')], [duplicateMessage('a')]]),
    );
  });

  it('does not warn about swatch values in StrictMode, when keyed swatches are reordered or one is replaced', async () => {
    const warn = vi.spyOn(console, 'warn');
    const renderSwatches = (keys: string[]) => (
      <React.StrictMode>
        <SwatchPicker aria-label="Color">
          {keys.map((key) => (
            <ColorSwatch
              key={key}
              value={key.replace('-new', '')}
              color="#000000"
              aria-label={key}
            />
          ))}
        </SwatchPicker>
      </React.StrictMode>
    );
    const { rerender } = render(renderSwatches(['a', 'b', 'c']));
    // Async act: the roving store sees the moved swatches through a MutationObserver (a microtask).
    await act(async () => rerender(renderSwatches(['c', 'a', 'b'])));
    // 'a-new' keeps the same value ('a') under a different key: the old instance unmounts
    // (unregisters) and the new one mounts (registers) in the same commit.
    await act(async () => rerender(renderSwatches(['c', 'a-new', 'b'])));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a resolved duplicate does not warn again; a later duplicate of a different value still does', async () => {
    const warn = spyWarn();
    const swatches = (list: ReadonlyArray<{ key: string; value: string; label: string }>) => (
      <SwatchPicker aria-label="Color">
        {list.map((s) => (
          <ColorSwatch key={s.key} value={s.value} color="#000000" aria-label={s.label} />
        ))}
      </SwatchPicker>
    );
    const { rerender } = render(
      swatches([
        { key: '1', value: 'a', label: 'One' },
        { key: '2', value: 'a', label: 'Two' },
        { key: '3', value: 'b', label: 'Three' },
      ]),
    );
    expect(warn.mock.calls).toEqual([[duplicateMessage('a')]]);

    // Removes swatch '2' (the "a" duplicate is resolved) and adds swatch '4', a new "b" duplicate.
    // Async act: the roving store sees the added/removed swatches through a MutationObserver (a
    // microtask).
    warn.mockClear();
    await act(async () => {
      rerender(
        swatches([
          { key: '1', value: 'a', label: 'One' },
          { key: '3', value: 'b', label: 'Three' },
          { key: '4', value: 'b', label: 'Four' },
        ]),
      );
    });
    expect(warn.mock.calls).toEqual([[duplicateMessage('b')]]);
  });

  it('falls back to the color value as its accessible name when unnamed', () => {
    const warn = spyWarn();
    render(
      <SwatchPicker aria-label="Color">
        <ColorSwatch value="teal" color="#008272" />
      </SwatchPicker>,
    );
    expect(screen.getByRole('radio', { name: '#008272' })).toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('scopes the duplicate-value registry to one picker (two pickers may share a value)', () => {
    const warn = spyWarn();
    render(
      <>
        <SwatchPicker aria-label="First">
          <ColorSwatch value="a" color="#000003" aria-label="One" />
        </SwatchPicker>
        <SwatchPicker aria-label="Second">
          <ColorSwatch value="a" color="#000004" aria-label="Two" />
        </SwatchPicker>
      </>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('merges a consumer style with its own required background color (the color always wins)', () => {
    render(
      <SwatchPicker aria-label="Color">
        <ColorSwatch
          value="red"
          color="#d13438"
          aria-label="Red"
          style={{ margin: '8px', backgroundColor: 'transparent' }}
        />
      </SwatchPicker>,
    );
    const swatch = screen.getByRole('radio', { name: 'Red' });
    expect(swatch).toHaveStyle({ margin: '8px', backgroundColor: 'rgb(209, 52, 56)' });
  });
});

describe('ColorSwatch options (D21, D22)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disabled: native disabled, a slash, dimmed, skipped by the arrows, never selected', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SwatchPicker aria-label="Color" defaultValue="a" onValueChange={onValueChange}>
        <ColorSwatch value="a" color="#000001" aria-label="A" />
        <ColorSwatch value="b" color="#000002" aria-label="B" disabled />
        <ColorSwatch value="c" color="#000003" aria-label="C" />
      </SwatchPicker>,
    );
    const b = screen.getByRole('radio', { name: 'B' });
    expect(b).toBeDisabled();
    expect(b.className).toContain('disabled:opacity-50');
    expect(b.querySelector('svg[data-wave-swatch-slash]')).not.toBeNull();
    expect(
      screen.getByRole('radio', { name: 'C' }).querySelector('[data-wave-swatch-slash]'),
    ).toBeNull();
    await user.click(b);
    expect(onValueChange).not.toHaveBeenCalled();
    act(() => screen.getByRole('radio', { name: 'A' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'C' })).toHaveFocus();
    expect(onValueChange).toHaveBeenCalledWith('c');
    await act(async () => {});
  });

  it('icon: shown while not selected, replaced by the check while selected', () => {
    const swatch = (value: string) => (
      <SwatchPicker aria-label="Color" value={value}>
        <ColorSwatch value="a" color="#d13438" aria-label="A" icon={<i data-testid="glyph" />} />
      </SwatchPicker>
    );
    const { rerender } = render(swatch(''));
    expect(screen.getByTestId('glyph').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('radio', { name: 'A' }).querySelector('svg')).toBeNull();
    rerender(swatch('a'));
    expect(screen.queryByTestId('glyph')).toBeNull();
    expect(screen.getByRole('radio', { name: 'A' }).querySelector('svg')).not.toBeNull();
  });

  it('unwraps a button passed as icon, warning once', () => {
    const warn = spyWarn();
    render(
      <SwatchPicker aria-label="Color">
        <ColorSwatch
          value="a"
          color="#d13438"
          aria-label="A"
          icon={<button type="button">Glyph</button>}
        />
        <ColorSwatch value="b" color="#d13439" aria-label="B" icon={<Button>Glyph</Button>} />
      </SwatchPicker>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByText('Glyph')).toHaveLength(2);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] ColorSwatch: `icon` received a button element; its children render as the ' +
          'glyph of the swatch and its props were dropped (buttons cannot be nested). Pass ' +
          'icon content instead, e.g. `icon={<MyIcon />}`.',
      ],
    ]);
  });

  it('borderColor sets the inline border color', () => {
    render(
      <SwatchPicker aria-label="Color">
        <ColorSwatch value="w" color="#ffffff" aria-label="White" borderColor="#808080" />
      </SwatchPicker>,
    );
    expect(screen.getByRole('radio', { name: 'White' })).toHaveStyle({
      borderColor: 'rgb(128, 128, 128)',
    });
  });

  it('per-swatch size and shape override the picker', () => {
    render(
      <SwatchPicker aria-label="Color" size="large" shape="square">
        <ColorSwatch value="a" color="#000001" aria-label="A" size="extra-small" shape="rounded" />
        <ColorSwatch value="b" color="#000002" aria-label="B" />
      </SwatchPicker>,
    );
    const a = screen.getByRole('radio', { name: 'A' });
    expect(a).toHaveClass('w-5', 'h-5', 'rounded');
    expect(a).not.toHaveClass('w-10', 'rounded-none');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveClass('w-10', 'h-10', 'rounded-none');
  });

  it('carries the forced-colors classes, with a Highlight ring while selected', () => {
    render(
      <SwatchPicker aria-label="Color" defaultValue="a">
        <ColorSwatch value="a" color="#000001" aria-label="A" />
        <ColorSwatch value="b" color="#000002" aria-label="B" />
      </SwatchPicker>,
    );
    expect(screen.getByRole('radio', { name: 'A' })).toHaveClass(
      'forced-colors:forced-color-adjust-none',
      'forced-colors:focus-visible:outline-[Highlight]',
      'forced-colors:ring-[Highlight]',
    );
    expect(screen.getByRole('radio', { name: 'B' })).toHaveClass(
      'forced-colors:focus-visible:outline-[Highlight]',
    );
    expect(screen.getByRole('radio', { name: 'B' })).not.toHaveClass(
      'forced-colors:ring-[Highlight]',
    );
  });

  it('spacing="small" shrinks the gap and the focus outline offset to 2', () => {
    const picker = (spacing?: 'small') => (
      <SwatchPicker aria-label="Color" spacing={spacing}>
        <ColorSwatch value="a" color="#000001" aria-label="A" />
      </SwatchPicker>
    );
    const { rerender } = render(picker('small'));
    expect(screen.getByRole('radio', { name: 'A' })).toHaveClass('focus-visible:outline-offset-2');
    expect(screen.getByRole('radiogroup')).toHaveClass('gap-1');
    rerender(picker());
    expect(screen.getByRole('radio', { name: 'A' })).toHaveClass('focus-visible:outline-offset-4');
    expect(screen.getByRole('radiogroup')).toHaveClass('gap-2');
  });
});

describe('ImageSwatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws src as a covering background image, with a token check when selected', () => {
    render(
      <SwatchPicker aria-label="Pattern" defaultValue="dots">
        <ImageSwatch value="dots" src="/dots.png" aria-label="Dots" />
      </SwatchPicker>,
    );
    const swatch = screen.getByRole('radio', { name: 'Dots' });
    expect(swatch.style.backgroundImage).toContain('/dots.png');
    expect(swatch).toHaveClass('bg-cover');
    expect(swatch).toHaveAttribute('aria-checked', 'true');
    expect(swatch.querySelector('svg')).not.toBeNull();
    expect(swatch.innerHTML).toContain('text-foreground');
    expect(swatch.innerHTML).toContain('text-background');
    expect(swatch).not.toHaveClass('forced-colors:forced-color-adjust-none');
  });

  it('is named by its value and warns once per kind when unnamed', () => {
    const warn = spyWarn();
    render(
      <SwatchPicker aria-label="Pattern">
        <ImageSwatch value="dots" src="/dots.png" />
        <ImageSwatch value="stripes" src="/stripes.png" />
      </SwatchPicker>,
    );
    expect(screen.getByRole('radio', { name: 'dots' })).toBeInTheDocument();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] ImageSwatch: swatch "dots" has no accessible name, so it is announced by its ' +
          'value. Pass `aria-label`, or wrap it in a Tooltip with `relationship="label"`.',
      ],
    ]);
  });

  it('disabled draws the slash and cannot be selected', () => {
    render(
      <SwatchPicker aria-label="Pattern">
        <ImageSwatch value="dots" src="/dots.png" aria-label="Dots" disabled />
      </SwatchPicker>,
    );
    const swatch = screen.getByRole('radio', { name: 'Dots' });
    expect(swatch).toBeDisabled();
    expect(swatch.querySelector('svg[data-wave-swatch-slash]')).not.toBeNull();
  });
});

describe('EmptySwatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a plain button named "Add color", outside the radio group order', async () => {
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SwatchPicker aria-label="Color" defaultValue="a" onValueChange={onValueChange}>
        <ColorSwatch value="a" color="#000001" aria-label="A" />
        <ColorSwatch value="b" color="#000002" aria-label="B" />
        <EmptySwatch onClick={onClick} />
      </SwatchPicker>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    const add = screen.getByRole('button', { name: 'Add color' });
    expect(add).toHaveAttribute('type', 'button');
    expect(add).not.toHaveAttribute('role');
    expect(add).not.toHaveAttribute('data-roving-value');
    expect(add).toHaveClass(
      'border-dashed',
      'border-stroke-accessible',
      'forced-colors:border-[ButtonText]',
    );
    expect(add.querySelector('svg')).not.toBeNull();
    await user.click(add);
    expect(onClick).toHaveBeenCalledTimes(1);
    // Arrow keys on the empty swatch are not handled: focus stays, nothing is selected.
    act(() => add.focus());
    await user.keyboard('{ArrowRight}{ArrowLeft}{ArrowDown}{Home}{End}');
    expect(add).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    // An arrow key on a radio still works.
    act(() => screen.getByRole('radio', { name: 'A' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveFocus();
    await act(async () => {});
  });

  it('takes a custom name, size and shape, and its icon follows the optional-indicator rule', () => {
    render(
      <SwatchPicker aria-label="Color" size="large" shape="square">
        <EmptySwatch
          aria-label="New"
          size="extra-small"
          shape="circular"
          icon={<i data-testid="p" />}
        />
        <EmptySwatch aria-label="Bare" icon={false} />
        <EmptySwatch aria-label="Default" icon={null} />
      </SwatchPicker>,
    );
    const custom = screen.getByRole('button', { name: 'New' });
    expect(custom).toHaveClass('w-5', 'h-5', 'rounded-full');
    expect(screen.getByTestId('p').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Bare' }).querySelector('svg')).toBeNull();
    expect(screen.getByRole('button', { name: 'Default' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Default' })).toHaveClass('w-10', 'rounded-none');
  });

  it('unwraps a button passed as icon, warning once', () => {
    const warn = spyWarn();
    render(
      <SwatchPicker aria-label="Color">
        <EmptySwatch icon={<button type="button">Plus</button>} />
      </SwatchPicker>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Plus')).toBeInTheDocument();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] EmptySwatch: `icon` received a button element; its children render as the ' +
          'glyph of the swatch and its props were dropped (buttons cannot be nested). Pass ' +
          'icon content instead, e.g. `icon={<MyIcon />}`.',
      ],
    ]);
  });

  it('ignores an arrow key that bubbles from it (fireEvent)', () => {
    const onValueChange = vi.fn();
    render(
      <SwatchPicker aria-label="Color" onValueChange={onValueChange}>
        <ColorSwatch value="a" color="#000001" aria-label="A" />
        <EmptySwatch />
      </SwatchPicker>,
    );
    const add = screen.getByRole('button', { name: 'Add color' });
    act(() => add.focus());
    fireEvent.keyDown(add, { key: 'ArrowLeft' });
    expect(add).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('throws outside a picker in development', () => {
    expectThrows(<EmptySwatch />, '[WaveUI] EmptySwatch must be used within SwatchPicker');
  });
});
