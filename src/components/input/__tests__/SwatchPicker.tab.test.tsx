import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwatchPicker } from '../SwatchPicker';
import type { SwatchPickerProps } from '../SwatchPicker';
import { ColorSwatch, EmptySwatch } from '../SwatchPicker.swatches';
import { Tooltip } from '../../overlays/Tooltip';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';
import { renderWithFieldContext } from '../../../test-utils-field';

const items = [
  { value: 'red', color: '#d13438', label: 'Red' }, // wave-allow-color: fixture
  { value: 'blue', color: '#0f6cbd', label: 'Blue' }, // wave-allow-color: fixture
  { value: 'green', color: '#107c10', label: 'Green' }, // wave-allow-color: fixture
];

/** Two rows; the second row's middle swatch is disabled. */
function Rows(props: Partial<SwatchPickerProps>) {
  return (
    <SwatchPicker aria-label="Palette" focusMode="tab" {...props}>
      <SwatchPicker.Row data-testid="row-a">
        <ColorSwatch value="a1" color="#d13438" aria-label="A1" />
        <ColorSwatch value="a2" color="#0f6cbd" aria-label="A2" />
      </SwatchPicker.Row>
      <SwatchPicker.Row>
        <ColorSwatch value="b1" color="#ffb900" aria-label="B1" />
        <ColorSwatch value="b2" color="#8764b8" aria-label="B2" disabled />

        <EmptySwatch />
      </SwatchPicker.Row>
    </SwatchPicker>
  );
}

const button = (name: string) => screen.getByRole('button', { name });

describe.each(['row', 'grid'] as const)('SwatchPicker tab focus mode — %s layout', (layout) => {
  it('is a group of toggle buttons: no radio, grid, row or gridcell roles', () => {
    render(<Rows layout={layout} defaultValue="a2" />);
    const group = screen.getByRole('group', { name: 'Palette' });
    expect(group).toHaveAttribute('data-focus-mode', 'tab');
    expect(group).toHaveAttribute('data-layout', layout);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('row')).toBeNull();
    expect(screen.queryByRole('gridcell')).toBeNull();
    expect(button('A2')).toHaveAttribute('aria-pressed', 'true');
    expect(button('A1')).toHaveAttribute('aria-pressed', 'false');
    expect(button('A1')).not.toHaveAttribute('aria-checked');
    expect(screen.getByTestId('row-a')).not.toHaveAttribute('role');
  });

  it('makes every enabled swatch a tab stop', async () => {
    const user = userEvent.setup();
    render(<Rows layout={layout} />);
    for (const name of ['A1', 'A2', 'B1']) {
      expect(button(name)).toHaveAttribute('tabindex', '0');
    }
    await user.tab();
    expect(button('A1')).toHaveFocus();
    await user.tab();
    expect(button('A2')).toHaveFocus();
    await user.tab();
    expect(button('B1')).toHaveFocus();
    await user.tab();
    expect(button('Add color')).toHaveFocus();
  });

  it('arrow keys, Home and End do nothing', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<Rows layout={layout} onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowLeft}{ArrowUp}{End}{Home}');
    expect(button('A1')).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('Space, Enter and a click select; pressing the selected swatch again keeps it selected', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <Rows layout={layout} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.tab();
    await user.keyboard(' ');
    expect(button('A1')).toHaveAttribute('aria-pressed', 'true');
    await user.tab();
    await user.keyboard('{Enter}');
    expect(button('A2')).toHaveAttribute('aria-pressed', 'true');
    expect(button('A1')).toHaveAttribute('aria-pressed', 'false');
    await user.click(button('B1'));
    expect(onValueChange.mock.calls).toEqual([['a1'], ['a2'], ['b1']]);
    await user.click(button('B1'));
    await user.keyboard('{Enter}');
    expect(button('B1')).toHaveAttribute('aria-pressed', 'true');
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it('never selects a disabled swatch', async () => {
    const user = userEvent.setup();
    render(<Rows layout={layout} />);
    await user.click(button('B2'));
    expect(button('B2')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders items as toggle buttons too', () => {
    render(
      <SwatchPicker
        layout={layout}
        focusMode="tab"
        aria-label="Palette"
        items={items}
        defaultValue="blue"
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(button('Blue')).toHaveAttribute('aria-pressed', 'true');
  });

  it('says "required" in its description, never aria-required (a consumer one dropped)', () => {
    render(<Rows layout={layout} name="color" required aria-required="true" />);
    const group = screen.getByRole('group', { name: 'Palette' });
    expect(group).not.toHaveAttribute('aria-required');
    expect(group).toHaveAccessibleDescription('Required');
  });

  it('takes the hint from labels.required and inside a required Field', () => {
    const { unmount } = render(
      <Rows layout={layout} required labels={{ required: 'Obligatoire' }} />,
    );
    expect(screen.getByRole('group')).toHaveAccessibleDescription('Obligatoire');
    unmount();
    renderWithFieldContext(<SwatchPicker layout={layout} focusMode="tab" items={items} />, {
      required: true,
    });
    const group = screen.getByRole('group');
    expect(group).not.toHaveAttribute('aria-required');
    expect(group).toHaveAccessibleDescription(/Required/);
  });

  it('ignores the arrow keys in RTL too', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Rows layout={layout} />, { dir: 'rtl' });
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(button('A1')).toHaveFocus();
  });

  it('has no axe violations, selected and required in a form', async () => {
    render(
      <form aria-label="Form">
        <Rows layout={layout} defaultValue="b1" name="color" required />
      </form>,
    );
    await expectNoA11yViolations();
  });

  it('lets a Tooltip name and describe a swatch', () => {
    render(
      <SwatchPicker layout={layout} focusMode="tab" aria-label="Palette">
        <Tooltip content="Ocean blue" relationship="label">
          <ColorSwatch value="blue" color="#0f6cbd" />
        </Tooltip>
        <Tooltip content="A calm, cool tone" relationship="description">
          <ColorSwatch value="teal" color="#008272" aria-label="Teal" />
        </Tooltip>
      </SwatchPicker>,
    );
    expect(button('Ocean blue')).toBeInTheDocument();
    expect(button('Teal')).toHaveAccessibleDescription('A calm, cool tone');
  });
});

describe('SwatchPicker tab mode — form', () => {
  it('blocks a required, empty submit on the first swatch, then submits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form aria-label="Form" onSubmit={onSubmit}>
        <Rows name="color" required />
        <button type="submit">Send</button>
      </form>,
    );
    await user.click(button('Send'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button('A1')).toHaveFocus();
    await user.click(button('B1'));
    await user.click(button('Send'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('SwatchPicker — D4 follow-ups', () => {
  it('shows the Required hint of the grid for a consumer aria-required alone', () => {
    render(<SwatchPicker layout="grid" aria-label="Palette" items={items} aria-required="true" />);
    const grid = screen.getByRole('grid');
    expect(grid).not.toHaveAttribute('aria-required');
    expect(grid).toHaveAccessibleDescription('Required');
  });

  it('warns once when a Row renders inside a Row', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <SwatchPicker layout="grid" aria-label="Palette">
          <SwatchPicker.Row>
            <SwatchPicker.Row>
              <ColorSwatch value="a" color="#d13438" aria-label="A" />
            </SwatchPicker.Row>
          </SwatchPicker.Row>
        </SwatchPicker>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] SwatchPicker.Row: a Row inside a Row nests rows. Rows must be direct children of the SwatchPicker ' +
            '(or inside a Fragment); a wrapper component around a Row lands in an implicit row.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it('shares the gap between the root and the rows', () => {
    render(
      <SwatchPicker aria-label="Palette" spacing="small">
        <SwatchPicker.Row data-testid="row">
          <ColorSwatch value="a" color="#d13438" aria-label="A" />
        </SwatchPicker.Row>
      </SwatchPicker>,
    );
    expect(screen.getByRole('radiogroup')).toHaveClass('gap-1');
    expect(screen.getByTestId('row')).toHaveClass('gap-1');
  });
});
