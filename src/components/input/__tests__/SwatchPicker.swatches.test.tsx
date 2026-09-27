import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SwatchPicker } from '../SwatchPicker';
import { ColorSwatch } from '../SwatchPicker.swatches';
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
