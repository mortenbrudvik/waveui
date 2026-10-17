import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwatchPicker, SwatchPickerRow } from '../SwatchPicker';
import type { SwatchPickerProps } from '../SwatchPicker';
import { ColorSwatch, EmptySwatch } from '../SwatchPicker.swatches';
import { Popover } from '../../overlays/Popover';
import { Tooltip } from '../../overlays/Tooltip';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  renderWithProviders,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

const items = [
  { value: 'red', color: '#d13438', label: 'Red' }, // wave-allow-color: fixture
  { value: 'blue', color: '#0f6cbd', label: 'Blue' }, // wave-allow-color: fixture
  { value: 'green', color: '#107c10', label: 'Green' }, // wave-allow-color: fixture
];

/** Two rows of three, the middle cell of the second row disabled. */
function TwoRows(props: Partial<SwatchPickerProps>) {
  return (
    <SwatchPicker layout="grid" aria-label="Palette" {...props}>
      <SwatchPicker.Row>
        <ColorSwatch value="a1" color="#d13438" aria-label="A1" />
        <ColorSwatch value="a2" color="#0f6cbd" aria-label="A2" />
        <ColorSwatch value="a3" color="#107c10" aria-label="A3" />
      </SwatchPicker.Row>
      <SwatchPicker.Row>
        <ColorSwatch value="b1" color="#ffb900" aria-label="B1" />
        <ColorSwatch value="b2" color="#8764b8" aria-label="B2" disabled />
        <ColorSwatch value="b3" color="#00b7c3" aria-label="B3" />
      </SwatchPicker.Row>
    </SwatchPicker>
  );
}

const cellButton = (name: string) => screen.getByRole('button', { name });
const cellOf = (name: string) => cellButton(name).closest('[role="gridcell"]');

/** The accessible names of the cells of each row, in order. */
function rowNames(grid: HTMLElement): string[][] {
  return within(grid)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole('gridcell')
        .map((cell) => within(cell).getByRole('button').getAttribute('aria-label') ?? ''),
    );
}

describe('SwatchPicker grid layout — system props', () => {
  testSystemProps(SwatchPicker, {
    expectedTag: 'div',
    displayName: 'SwatchPicker',
    defaultProps: { layout: 'grid', items, 'aria-label': 'Brand colors' },
    a11yVariants: [
      { name: 'grid, selected', props: { defaultValue: 'blue' } },
      { name: 'grid, required in a form', props: { name: 'color', required: true } },
      {
        name: 'grid, rows and an empty swatch',
        props: {
          items: undefined,
          defaultValue: 'a2',
          children: (
            <>
              <SwatchPicker.Row>
                <ColorSwatch value="a1" color="#d13438" aria-label="A1" />
                <ColorSwatch value="a2" color="#0f6cbd" aria-label="A2" />
              </SwatchPicker.Row>
              <EmptySwatch />
            </>
          ),
        },
      },
    ],
  });
});

describe('SwatchPicker.Row', () => {
  testCompoundExposure(SwatchPicker, ['Row']);

  it('is the same component under its flat name', () => {
    expect(SwatchPickerRow).toBe(SwatchPicker.Row);
  });

  describe('in the grid layout', () => {
    testSystemProps(SwatchPickerRow, {
      expectedTag: 'div',
      displayName: 'SwatchPickerRow',
      defaultProps: {
        children: <ColorSwatch value="red" color="#d13438" aria-label="Red" />,
      },
      wrapper: ({ children }) => (
        <SwatchPicker layout="grid" aria-label="Palette" defaultValue="red">
          {children}
        </SwatchPicker>
      ),
    });
  });

  describe('in the row layout', () => {
    testSystemProps(SwatchPickerRow, {
      expectedTag: 'div',
      displayName: 'SwatchPickerRow',
      defaultProps: {
        children: <ColorSwatch value="red" color="#d13438" aria-label="Red" />,
      },
      wrapper: ({ children }) => (
        <SwatchPicker aria-label="Palette" defaultValue="red">
          {children}
        </SwatchPicker>
      ),
    });
  });

  it('throws outside a picker in development', () => {
    expectThrows(
      <SwatchPickerRow>Row</SwatchPickerRow>,
      '[WaveUI] SwatchPicker.Row must be used within SwatchPicker',
    );
  });

  it('is a full-width line without a role in the row layout; the radios stay one group', async () => {
    const user = userEvent.setup();
    render(
      <SwatchPicker aria-label="Palette" defaultValue="a1">
        <SwatchPicker.Row data-testid="row-a">
          <ColorSwatch value="a1" color="#d13438" aria-label="A1" />
        </SwatchPicker.Row>
        <SwatchPicker.Row>
          <ColorSwatch value="b1" color="#ffb900" aria-label="B1" />
        </SwatchPicker.Row>
      </SwatchPicker>,
    );
    const row = screen.getByTestId('row-a');
    expect(row).not.toHaveAttribute('role');
    expect(row).toHaveClass('basis-full');
    expect(screen.queryByRole('row')).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'B1' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'B1' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('SwatchPicker grid layout — ARIA (D20)', () => {
  it('is a grid of rows of gridcells; the selected cell is aria-selected and its button pressed', () => {
    render(<TwoRows defaultValue="a2" />);
    const grid = screen.getByRole('grid', { name: 'Palette' });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(rowNames(grid)).toEqual([
      ['A1', 'A2', 'A3'],
      ['B1', 'B2', 'B3'],
    ]);
    expect(cellOf('A2')).toHaveAttribute('aria-selected', 'true');
    expect(cellOf('A1')).toHaveAttribute('aria-selected', 'false');
    const a2 = cellButton('A2');
    expect(a2).toHaveAttribute('aria-pressed', 'true');
    expect(a2).toHaveAttribute('data-selected');
    expect(a2).not.toHaveAttribute('aria-checked');
    expect(a2).toHaveAttribute('type', 'button');
    const a1 = cellButton('A1');
    expect(a1).not.toHaveAttribute('aria-pressed');
    expect(a1).not.toHaveAttribute('data-selected');
    expect(a2.querySelector('[data-wave-icon="check"]')).not.toBeNull();
  });

  it('renders its layout, focus mode, size, shape and spacing as data attributes', () => {
    const { rerender } = render(<TwoRows />);
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('data-layout', 'grid');
    expect(grid).toHaveAttribute('data-focus-mode', 'arrow');
    expect(grid).toHaveAttribute('data-size', 'medium');
    expect(grid).toHaveAttribute('data-shape', 'circular');
    expect(grid).toHaveAttribute('data-spacing', 'medium');
    rerender(<TwoRows size="small" shape="square" spacing="small" />);
    expect(grid).toHaveAttribute('data-size', 'small');
    expect(grid).toHaveAttribute('data-shape', 'square');
    expect(grid).toHaveAttribute('data-spacing', 'small');
  });

  it('renders data-layout="row" in the default layout', () => {
    render(<SwatchPicker aria-label="Palette" items={items} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('data-layout', 'row');
    expect(group).toHaveAttribute('data-spacing', 'medium');
  });

  it('keeps the button the target of ref, className, style and rest props; the cell carries only its role', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <SwatchPicker layout="grid" aria-label="Palette">
        <ColorSwatch
          ref={ref}
          value="red"
          color="#d13438"
          aria-label="Red"
          className="mt-1"
          style={{ marginInline: 2 }}
          data-testid="red"
        />
      </SwatchPicker>,
    );
    const button = cellButton('Red');
    expect(ref.current).toBe(button);
    expect(button).toHaveClass('mt-1');
    expect(button).toHaveAttribute('data-testid', 'red');
    expect(button.style.marginInline).toBe('2px');
    const cell = cellOf('Red')!;
    expect(cell).not.toHaveClass('mt-1');
    expect(cell).not.toHaveAttribute('data-testid');
  });

  it('names a swatch through a wrapping Tooltip', () => {
    render(
      <SwatchPicker layout="grid" aria-label="Palette">
        <Tooltip content="Ocean blue" relationship="label">
          <ColorSwatch value="blue" color="#0f6cbd" />
        </Tooltip>
      </SwatchPicker>,
    );
    expect(cellButton('Ocean blue')).toHaveAttribute('data-roving-value', 'blue');
  });

  it('spacing="small" narrows the gap between rows and between cells', () => {
    render(<TwoRows spacing="small" />);
    const grid = screen.getByRole('grid');
    expect(grid).toHaveClass('gap-1');
    for (const row of screen.getAllByRole('row')) expect(row).toHaveClass('gap-1');
  });

  it('warns once that an unnamed grid has no accessible name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<SwatchPicker layout="grid" items={items} />);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] SwatchPicker: the grid has no accessible name. Pass `aria-label` or ' +
            '`aria-labelledby`, or render it inside a Field.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('SwatchPicker grid layout — implicit rows', () => {
  it('puts items and the loose children after them in one implicit row (items first)', () => {
    const onClick = vi.fn();
    render(
      <SwatchPicker layout="grid" aria-label="Palette" items={items}>
        <EmptySwatch onClick={onClick} />
      </SwatchPicker>,
    );
    const grid = screen.getByRole('grid');
    expect(rowNames(grid)).toEqual([['Red', 'Blue', 'Green', 'Add color']]);
    expect(cellOf('Add color')).not.toHaveAttribute('aria-selected');
  });

  it('wraps each run of loose children between rows in its own implicit row', () => {
    render(
      <SwatchPicker layout="grid" aria-label="Palette" items={items}>
        <ColorSwatch value="x" color="#000000" aria-label="X" />
        <SwatchPicker.Row>
          <ColorSwatch value="a1" color="#d13438" aria-label="A1" />
        </SwatchPicker.Row>
        <>
          <SwatchPicker.Row>
            <ColorSwatch value="b1" color="#ffb900" aria-label="B1" />
          </SwatchPicker.Row>
          {null}
          <EmptySwatch />
        </>
        {false}
      </SwatchPicker>,
    );
    expect(rowNames(screen.getByRole('grid'))).toEqual([
      ['Red', 'Blue', 'Green', 'X'],
      ['A1'],
      ['B1'],
      ['Add color'],
    ]);
  });

  it('renders no empty implicit row', () => {
    render(
      <SwatchPicker layout="grid" aria-label="Palette">
        <SwatchPicker.Row>
          <ColorSwatch value="a1" color="#d13438" aria-label="A1" />
        </SwatchPicker.Row>
      </SwatchPicker>,
    );
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('finds rows given as Server Component references (asClientReference)', () => {
    const LazyRow = asClientReference(SwatchPickerRow);
    const tree = (Row: typeof SwatchPickerRow) => (
      <SwatchPicker layout="grid" aria-label="Palette" items={items}>
        <EmptySwatch />
        <Row>
          <ColorSwatch value="a1" color="#d13438" aria-label="A1" />
        </Row>
        <Row>
          <ColorSwatch value="b1" color="#ffb900" aria-label="B1" />
        </Row>
        <EmptySwatch aria-label="More" />
      </SwatchPicker>
    );
    expect(renderToString(tree(LazyRow))).toBe(renderToString(tree(SwatchPickerRow)));
    render(tree(LazyRow));
    expect(rowNames(screen.getByRole('grid'))).toEqual([
      ['Red', 'Blue', 'Green', 'Add color'],
      ['A1'],
      ['B1'],
      ['More'],
    ]);
  });
});

describe('SwatchPicker grid layout — accessibility', () => {
  it('has no axe violations with a selected swatch and an empty swatch', async () => {
    render(
      <SwatchPicker layout="grid" aria-label="Palette" items={items} defaultValue="green">
        <EmptySwatch />
      </SwatchPicker>,
    );
    await expectNoA11yViolations();
  });

  it('says "required" through its description, never aria-required (a consumer one dropped)', async () => {
    render(
      <form aria-label="Form">
        <SwatchPicker
          layout="grid"
          aria-label="Palette"
          items={items}
          name="color"
          required
          aria-required="true"
        />
      </form>,
    );
    const grid = screen.getByRole('grid', { name: 'Palette' });
    expect(grid).not.toHaveAttribute('aria-required');
    expect(grid).toHaveAccessibleDescription('Required');
    await expectNoA11yViolations();
  });

  it('takes the hint text from labels.required', () => {
    render(
      <SwatchPicker
        layout="grid"
        aria-label="Palette"
        items={items}
        required
        labels={{ required: 'Obligatoire' }}
      />,
    );
    expect(screen.getByRole('grid')).toHaveAccessibleDescription('Obligatoire');
  });

  it('has no hint when not required, and keeps aria-required on the radio group of the row layout', () => {
    const { rerender } = render(<SwatchPicker layout="grid" aria-label="Palette" items={items} />);
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-describedby');
    rerender(<SwatchPicker aria-label="Palette" items={items} required />);
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-required', 'true');
    expect(group).not.toHaveAttribute('aria-describedby');
  });

  it('inside a required Field: named by its label, described by its hint and "Required", no aria-required', async () => {
    renderWithFieldContext(<SwatchPicker layout="grid" items={items} />, {
      hintId: FIELD_TEST_IDS.hintId,
      required: true,
    });
    const grid = screen.getByRole('grid', { name: FIELD_TEST_TEXT.label });
    expect(grid).not.toHaveAttribute('aria-required');
    expect(grid).toHaveAccessibleDescription(/Required/);
    expect(grid).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.hint} Required`);
    await expectNoA11yViolations();
  });

  it('inside a required Field, an explicit required={false} drops the hint', () => {
    renderWithFieldContext(<SwatchPicker layout="grid" items={items} required={false} />, {
      required: true,
    });
    expect(screen.getByRole('grid')).not.toHaveAccessibleDescription(/Required/);
  });

  it('keeps aria-invalid from an invalid Field', () => {
    renderWithFieldContext(<SwatchPicker layout="grid" items={items} />, {
      errorId: FIELD_TEST_IDS.errorId,
    });
    expect(screen.getByRole('grid')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('SwatchPicker grid layout — keyboard', () => {
  it('arrow keys move focus without selecting; Space and Enter select (once each in StrictMode)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <TwoRows defaultValue="a1" onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.tab();
    expect(cellButton('A1')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(cellButton('A2')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    // B2 is disabled: the nearest enabled cell of the row, the earlier one on a tie.
    expect(cellButton('B1')).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(cellOf('A1')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard(' ');
    expect(onValueChange.mock.calls).toEqual([['b1']]);
    expect(cellOf('B1')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}{ArrowUp}');
    expect(cellButton('A3')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onValueChange.mock.calls).toEqual([['b1'], ['a3']]);
    expect(cellButton('A3')).toHaveAttribute('aria-pressed', 'true');
  });

  it('moves through the cells in reading order and stops at the ends; Home/End and Ctrl+Home/End', async () => {
    const user = userEvent.setup();
    render(<TwoRows />);
    await user.tab();
    expect(cellButton('A1')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(cellButton('A1')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(cellButton('B1')).toHaveFocus();
    await user.keyboard('{End}');
    expect(cellButton('B3')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(cellButton('B3')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(cellButton('B1')).toHaveFocus();
    await user.keyboard('{Control>}{Home}{/Control}');
    expect(cellButton('A1')).toHaveFocus();
    await user.keyboard('{Control>}{End}{/Control}');
    expect(cellButton('B3')).toHaveFocus();
  });

  it('mirrors Left and Right under dir="rtl"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TwoRows />, { dir: 'rtl' });
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(cellButton('A2')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(cellButton('A1')).toHaveFocus();
  });

  it('the tab stop follows focus: Tab and Shift+Tab leave the grid from an unselected cell', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <TwoRows defaultValue="a2" />
        <button type="button">After</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(cellButton('A2')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(cellButton('B1')).toHaveFocus();
    expect(cellButton('B1')).toHaveAttribute('tabindex', '0');
    expect(cellButton('A2')).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(cellButton('B1')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
  });

  it('an EmptySwatch is a cell in the arrow order: Enter calls its onClick and selects nothing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    render(
      <SwatchPicker
        layout="grid"
        aria-label="Palette"
        items={items}
        defaultValue="green"
        onValueChange={onValueChange}
      >
        <EmptySwatch onClick={onClick} />
      </SwatchPicker>,
    );
    await user.tab();
    expect(cellButton('Green')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const add = cellButton('Add color');
    expect(add).toHaveFocus();
    expect(add).toHaveAttribute('tabindex', '0');
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard('{ArrowLeft}');
    expect(cellButton('Green')).toHaveFocus();
  });

  it('runs a consumer onKeyDown first; preventDefault() keeps the grid keys out', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') event.preventDefault();
    });
    render(<TwoRows onKeyDown={onKeyDown} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(cellButton('A2')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(cellButton('A2')).toHaveFocus();
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('a grid of disabled swatches has no tab stop, and its keys do nothing', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <SwatchPicker layout="grid" aria-label="Palette" onValueChange={onValueChange}>
          <SwatchPicker.Row>
            <ColorSwatch value="a1" color="#d13438" aria-label="A1" disabled />
            <ColorSwatch value="a2" color="#0f6cbd" aria-label="A2" disabled />
          </SwatchPicker.Row>
          <SwatchPicker.Row>
            <ColorSwatch value="b1" color="#ffb900" aria-label="B1" disabled />
          </SwatchPicker.Row>
        </SwatchPicker>
        <button type="button">After</button>
      </>,
    );
    const grid = screen.getByRole('grid');
    expect(grid.querySelector('[tabindex="0"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    for (const key of ['ArrowRight', 'ArrowDown', 'Home', 'End', ' ', 'Enter']) {
      fireEvent.keyDown(cellButton('A1'), { key });
      fireEvent.keyDown(grid, { key, ctrlKey: key === 'Home' });
    }
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
    await expectNoA11yViolations();
  });
});

describe('SwatchPicker — a Popover opened from an EmptySwatch keeps its keys', () => {
  it.each(['grid', 'row'] as const)('in the %s layout', async (layout) => {
    const user = userEvent.setup();
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <SwatchPicker
        layout={layout}
        aria-label="Palette"
        items={items}
        defaultValue="red"
        onValueChange={onOuterChange}
      >
        <Popover>
          <Popover.Trigger>
            <EmptySwatch />
          </Popover.Trigger>
          <Popover.Content aria-label="More colors">
            <SwatchPicker
              aria-label="More"
              items={[
                { value: 'navy', color: '#0f2d6b', label: 'Navy' },
                { value: 'teal', color: '#00b7c3', label: 'Teal' },
              ]}
              defaultValue="navy"
              onValueChange={onInnerChange}
            />
            <input aria-label="Hex" defaultValue="#0f2d6b" />
          </Popover.Content>
        </Popover>
      </SwatchPicker>,
    );
    const add = screen.getByRole('button', { name: 'Add color' });
    await user.click(add);
    const navy = await screen.findByRole('radio', { name: 'Navy' });
    act(() => navy.focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Teal' })).toHaveFocus();
    expect(onInnerChange.mock.calls).toEqual([['teal']]);

    const hex = screen.getByRole('textbox', { name: 'Hex' });
    act(() => hex.focus());
    for (const key of ['ArrowLeft', 'ArrowDown', 'Home', 'End']) {
      expect(fireEvent.keyDown(hex, { key })).toBe(true); // not default-prevented
    }
    expect(hex).toHaveFocus();
    expect(onOuterChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
  });
});

describe('SwatchPicker grid layout — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  it('submits the selected value under its name', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <TwoRows name="color" />
      </form>,
    );
    expect(new FormData(getForm()).getAll('color')).toEqual([]);
    await user.click(cellButton('B3'));
    expect(new FormData(getForm()).getAll('color')).toEqual(['b3']);
  });

  it('required blocks validation and focuses the tab stop until a swatch is selected', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <TwoRows name="color" required />
      </form>,
    );
    let valid: boolean | undefined;
    act(() => {
      valid = getForm().checkValidity();
    });
    expect(valid).toBe(false);
    expect(cellButton('A1')).toHaveFocus();
    await user.keyboard(' ');
    act(() => {
      valid = getForm().checkValidity();
    });
    expect(valid).toBe(true);
  });

  it('form reset restores defaultValue', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <TwoRows name="color" defaultValue="a2" />
      </form>,
    );
    await user.click(cellButton('B1'));
    expect(cellOf('B1')).toHaveAttribute('aria-selected', 'true');
    act(() => getForm().reset());
    expect(cellOf('A2')).toHaveAttribute('aria-selected', 'true');
    expect(cellOf('B1')).toHaveAttribute('aria-selected', 'false');
  });
});
