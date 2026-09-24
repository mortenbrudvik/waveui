import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwatchPicker } from '../SwatchPicker';
import type { SwatchPickerProps } from '../SwatchPicker';
import type { Shape } from '../../../lib/types';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

const defaultItems = [
  { value: 'red', color: '#d13438', label: 'Red' },
  { value: 'blue', color: '#0f6cbd', label: 'Blue' },
  { value: 'green', color: '#107c10', label: 'Green' },
];

const swatch = (name: string) => screen.getByRole('radio', { name });

function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

function warnings(spy: ReturnType<typeof spyWarn>, text: string) {
  return spy.mock.calls.filter(([msg]) => String(msg).includes(text));
}

describe('SwatchPicker', () => {
  testSystemProps(SwatchPicker, {
    expectedTag: 'div',
    displayName: 'SwatchPicker',
    defaultProps: { items: defaultItems, 'aria-label': 'Brand colors' },
    a11yVariants: [
      { name: 'selected', props: { defaultValue: 'blue' } },
      { name: 'square, large', props: { shape: 'square', size: 'large', defaultValue: 'red' } },
      { name: 'required in a form', props: { name: 'color', required: true } },
    ],
  });

  it('renders all swatch items as radios', () => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('is a radiogroup named by aria-label', () => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" />);
    expect(screen.getByRole('radiogroup', { name: 'Brand colors' })).toBeInTheDocument();
  });

  it('selects an item on click and reports it through onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SwatchPicker items={defaultItems} aria-label="Brand colors" onValueChange={onValueChange} />,
    );
    await user.click(swatch('Blue'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('blue');
    expect(swatch('Blue')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the selected state via aria-checked', async () => {
    const user = userEvent.setup();
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" defaultValue="" />);
    expect(swatch('Blue')).toHaveAttribute('aria-checked', 'false');
    await user.click(swatch('Blue'));
    expect(swatch('Blue')).toHaveAttribute('aria-checked', 'true');
    expect(swatch('Red')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not fire onValueChange when the selected swatch is clicked again', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SwatchPicker
        items={defaultItems}
        aria-label="Brand colors"
        defaultValue="blue"
        onValueChange={onValueChange}
      />,
    );
    await user.click(swatch('Blue'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('controlled: respects the value prop', () => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" value="green" />);
    expect(swatch('Green')).toHaveAttribute('aria-checked', 'true');
    expect(swatch('Red')).toHaveAttribute('aria-checked', 'false');
  });

  it('controlled: a click reports the new value but the selection stays until the parent updates', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SwatchPicker
        items={defaultItems}
        aria-label="Brand colors"
        value="red"
        onValueChange={onValueChange}
      />,
    );
    await user.click(swatch('Blue'));
    expect(onValueChange).toHaveBeenCalledWith('blue');
    expect(swatch('Red')).toHaveAttribute('aria-checked', 'true');
    expect(swatch('Blue')).toHaveAttribute('aria-checked', 'false');

    rerender(
      <SwatchPicker
        items={defaultItems}
        aria-label="Brand colors"
        value="blue"
        onValueChange={onValueChange}
      />,
    );
    expect(swatch('Blue')).toHaveAttribute('aria-checked', 'true');
    expect(swatch('Red')).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onValueChange exactly once per interaction in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <SwatchPicker
          items={defaultItems}
          aria-label="Brand colors"
          onValueChange={onValueChange}
        />
      </React.StrictMode>,
    );
    await user.click(swatch('Blue'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith('green');
  });

  it('keeps the deprecated onChange alias working and warns once', async () => {
    const warn = spyWarn();
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(
        <SwatchPicker items={defaultItems} aria-label="Brand colors" onChange={onChange} />,
      );
      rerender(<SwatchPicker items={defaultItems} aria-label="Brand colors" onChange={onChange} />);
      await user.click(swatch('Green'));
      expect(onChange).toHaveBeenCalledWith('green');
      const deprecations = warnings(warn, 'SwatchPicker: `onChange` is deprecated');
      expect(deprecations).toHaveLength(1);
      expect(String(deprecations[0][0])).toContain('Use `onValueChange` instead.');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('SwatchPicker — shape and size', () => {
  it('uses rounded-full for the default circular shape', () => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveClass('rounded-full');
  });

  it.each([
    ['square', 'rounded-none'],
    ['rounded', 'rounded'],
    ['circular', 'rounded-full'],
  ] as const)('shape="%s" renders every swatch with %s', (shape, expected) => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" shape={shape} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveClass(expected);
      for (const other of ['rounded-none', 'rounded', 'rounded-full'].filter(
        (c) => c !== expected,
      )) {
        expect(radio).not.toHaveClass(other);
      }
    }
  });

  it.each([
    ['small', 'w-6', 'h-6'],
    ['medium', 'w-8', 'h-8'],
    ['large', 'w-10', 'h-10'],
  ] as const)('size="%s" renders every swatch with %s %s', (size, width, height) => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" size={size} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveClass(width, height);
  });

  it('types shape with the shared Shape type', () => {
    expectTypeOf<NonNullable<SwatchPickerProps['shape']>>().toEqualTypeOf<Shape>();
  });
});

describe('SwatchPicker — selected indicator (input-pickers#16)', () => {
  it('marks the selected swatch with an offset ring and a check glyph, not color alone', () => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" defaultValue="blue" />);
    const blue = swatch('Blue');
    expect(blue).toHaveClass(
      'ring-2',
      'ring-offset-2',
      'ring-foreground',
      'ring-offset-background',
    );
    expect(blue).toHaveAttribute('data-selected');
    expect(blue.querySelector('[data-wave-icon="check"]')).not.toBeNull();

    const red = swatch('Red');
    expect(red).not.toHaveClass('ring-2');
    expect(red).not.toHaveAttribute('data-selected');
    expect(red.querySelector('[data-wave-icon="check"]')).toBeNull();
  });

  it('draws a black check on a light swatch and a white check on a dark swatch', () => {
    const items = [
      { value: 'yellow', color: '#ffff00', label: 'Yellow' },
      { value: 'navy', color: '#0f2d6b', label: 'Navy' },
    ];
    const { rerender } = render(<SwatchPicker items={items} aria-label="Colors" value="yellow" />);
    const glyphOf = (name: string) => {
      const icons = swatch(name).querySelectorAll<SVGElement>('[data-wave-icon="check"]');
      // The last icon is the glyph; the one under it is its contrasting halo.
      return icons[icons.length - 1];
    };
    expect(glyphOf('Yellow')).toHaveStyle({ color: 'rgb(0, 0, 0)' });
    rerender(<SwatchPicker items={items} aria-label="Colors" value="navy" />);
    expect(glyphOf('Navy')).toHaveStyle({ color: 'rgb(255, 255, 255)' });
  });

  it('uses token classes only (no raw white stroke on the glyph)', () => {
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" defaultValue="red" />);
    const svg = swatch('Red').querySelector('svg');
    expect(svg).not.toHaveAttribute('stroke', 'white');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});

describe('SwatchPicker — keyboard (roving tab index, input-pickers#17)', () => {
  it('is a single tab stop on the selected swatch', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <SwatchPicker items={defaultItems} aria-label="Brand colors" defaultValue="blue" />
        <button type="button">After</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(swatch('Blue')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(swatch('Red')).toHaveAttribute('tabindex', '-1');
    expect(swatch('Blue')).toHaveAttribute('tabindex', '0');
    expect(swatch('Green')).toHaveAttribute('tabindex', '-1');
  });

  it('puts the tab stop on the first swatch when nothing is selected', async () => {
    const user = userEvent.setup();
    render(<SwatchPicker items={defaultItems} aria-label="Brand colors" />);
    await user.tab();
    expect(swatch('Red')).toHaveFocus();
  });

  it('arrow keys move focus and select (both axes, wrapping)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SwatchPicker
        items={defaultItems}
        aria-label="Brand colors"
        defaultValue="red"
        onValueChange={onValueChange}
      />,
    );
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(swatch('Blue')).toHaveFocus();
    expect(swatch('Blue')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown}');
    expect(swatch('Green')).toHaveFocus();
    expect(swatch('Green')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown}');
    expect(swatch('Red')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(swatch('Green')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(swatch('Blue')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(swatch('Red')).toHaveFocus();
    await user.keyboard('{End}');
    expect(swatch('Green')).toHaveFocus();
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([
      'blue',
      'green',
      'red',
      'green',
      'blue',
      'red',
      'green',
    ]);
  });

  it('mirrors Left/Right under dir="rtl"', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SwatchPicker items={defaultItems} aria-label="Brand colors" defaultValue="red" />,
      { dir: 'rtl' },
    );
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(swatch('Blue')).toHaveFocus();
    expect(swatch('Blue')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(swatch('Red')).toHaveFocus();
  });
});

describe('SwatchPicker — accessible names (input-pickers#23)', () => {
  it('has no hard-coded English group name and warns once when unnamed', () => {
    const warn = spyWarn();
    try {
      const { rerender } = render(<SwatchPicker items={defaultItems} />);
      rerender(<SwatchPicker items={defaultItems} />);
      const group = screen.getByRole('radiogroup');
      expect(group).not.toHaveAttribute('aria-label');
      expect(group).toHaveAccessibleName('');
      expect(warnings(warn, 'SwatchPicker: the radiogroup has no accessible name')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('is named by aria-labelledby', () => {
    render(
      <>
        <span id="swatch-heading">Theme color</span>
        <SwatchPicker items={defaultItems} aria-labelledby="swatch-heading" />
      </>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Theme color' })).toBeInTheDocument();
  });

  it('names swatches by label and falls back to the color with a development warning', () => {
    const warn = spyWarn();
    try {
      render(
        <SwatchPicker
          aria-label="Colors"
          items={[
            { value: 'a', color: '#d13438', label: 'Cranberry' },
            { value: 'b', color: '#107c10' },
          ]}
        />,
      );
      expect(swatch('Cranberry')).toBeInTheDocument();
      expect(swatch('#107c10')).toBeInTheDocument();
      expect(warnings(warn, 'SwatchPicker: swatch "b" has no `label`')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn when every swatch and the group are named', () => {
    const warn = spyWarn();
    try {
      render(<SwatchPicker items={defaultItems} aria-label="Brand colors" />);
      expect(warnings(warn, 'SwatchPicker')).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('SwatchPicker — Field integration (FieldContext)', () => {
  it('is named by the Field label and described by its hint and error', () => {
    renderWithFieldContext(<SwatchPicker items={defaultItems} />, {
      hintId: FIELD_TEST_IDS.hintId,
      errorId: FIELD_TEST_IDS.errorId,
      required: true,
    });
    const group = screen.getByRole('radiogroup', { name: FIELD_TEST_TEXT.label });
    expect(group).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-required', 'true');
  });

  it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <SwatchPicker items={defaultItems} required={false} />
      </form>,
      { required: true },
    );
    const group = screen.getByRole('radiogroup', { name: FIELD_TEST_TEXT.label });
    expect(group).not.toHaveAttribute('aria-required', 'true');
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });

  it('a consumer aria-label wins over the Field label', () => {
    renderWithFieldContext(<SwatchPicker items={defaultItems} aria-label="Accent" />);
    expect(screen.getByRole('radiogroup', { name: 'Accent' })).toBeInTheDocument();
  });
});

describe('SwatchPicker — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  it('submits the selected value under its name', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <SwatchPicker items={defaultItems} aria-label="Brand colors" name="color" />
      </form>,
    );
    expect(new FormData(getForm()).getAll('color')).toEqual([]);
    await user.click(swatch('Green'));
    expect(new FormData(getForm()).getAll('color')).toEqual(['green']);
  });

  it('adds nothing to FormData without a name', () => {
    render(
      <form aria-label="Form">
        <SwatchPicker items={defaultItems} aria-label="Brand colors" defaultValue="red" />
      </form>,
    );
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('required blocks validation until a swatch is selected', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <SwatchPicker items={defaultItems} aria-label="Brand colors" name="color" required />
      </form>,
    );
    // The `invalid` event focuses the visible tab stop, which updates roving state: keep it in act.
    let valid: boolean | undefined;
    act(() => {
      valid = getForm().checkValidity();
    });
    expect(valid).toBe(false);
    expect(swatch('Red')).toHaveFocus();
    await user.click(swatch('Green'));
    act(() => {
      valid = getForm().checkValidity();
    });
    expect(valid).toBe(true);
  });

  it('form reset restores defaultValue (with and without a name)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <SwatchPicker items={defaultItems} aria-label="Named" name="color" defaultValue="blue" />
        <SwatchPicker items={defaultItems} aria-label="Unnamed" />
      </form>,
    );
    const named = screen.getByRole('radiogroup', { name: 'Named' });
    const unnamed = screen.getByRole('radiogroup', { name: 'Unnamed' });
    await user.click(named.querySelectorAll<HTMLElement>('[role="radio"]')[2]);
    await user.click(unnamed.querySelectorAll<HTMLElement>('[role="radio"]')[0]);
    act(() => getForm().reset());
    expect(named.querySelector('[aria-checked="true"]')).toHaveAccessibleName('Blue');
    expect(unnamed.querySelector('[aria-checked="true"]')).toBeNull();
  });
});
