import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioItem } from '../RadioGroup';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

const requiredProps = { 'aria-label': 'Test group' };

describe('RadioGroup', () => {
  testForwardRef(RadioGroup, 'div', requiredProps);
  testRestSpread(RadioGroup, requiredProps);
  testClassName(RadioGroup, requiredProps);

  it('renders without crashing', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('renders radio items', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('selects defaultValue', () => {
    render(
      <RadioGroup defaultValue="b" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('selects item in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    await user.click(screen.getAllByRole('radio')[1]);
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('respects controlled value prop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup value="a" onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    await user.click(radios[1]);
    // Controlled: value stays as "a"
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders vertical orientation by default', () => {
    render(
      <RadioGroup aria-label="Options" data-testid="rg">
        <RadioItem value="a" label="Alpha" />
      </RadioGroup>,
    );
    expect(screen.getByTestId('rg').className).toContain('flex-col');
  });

  it('renders horizontal orientation', () => {
    render(
      <RadioGroup orientation="horizontal" aria-label="Options" data-testid="rg">
        <RadioItem value="a" label="Alpha" />
      </RadioGroup>,
    );
    expect(screen.getByTestId('rg').className).toContain('flex-row');
  });

  it('disables individual RadioItem', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" disabled />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeDisabled();
    expect(radios[1]).not.toBeDisabled();
  });

  it('throws when RadioItem is used outside RadioGroup', () => {
    expect(() => render(<RadioItem value="a" label="Orphan" />)).toThrow(
      'RadioItem must be used within a RadioGroup',
    );
  });
});

describe('RadioGroup - roving tabindex', () => {
  it('only the selected radio has tabIndex 0', () => {
    render(
      <RadioGroup defaultValue="b" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('tabindex', '-1');
    expect(radios[1]).toHaveAttribute('tabindex', '0');
    expect(radios[2]).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowDown moves focus and selects next item (vertical)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledWith('b');
    expect(radios[1]).toHaveFocus();
  });

  it('ArrowUp moves focus and selects previous item (vertical)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="b" onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    radios[1].focus();
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenCalledWith('a');
    expect(radios[0]).toHaveFocus();
  });

  it('ArrowRight/Left moves in horizontal orientation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup
        orientation="horizontal"
        defaultValue="a"
        onChange={onChange}
        aria-label="Options"
      >
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('b');
    expect(radios[1]).toHaveFocus();
  });

  it('wraps from last to first item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="c" onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    radios[2].focus();
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledWith('a');
    expect(radios[0]).toHaveFocus();
  });

  it('disabled items are excluded from roving tabindex', () => {
    render(
      <RadioGroup defaultValue="a" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" disabled />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    // Disabled item should have tabIndex -1
    expect(radios[1]).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowDown skips disabled items during navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" disabled />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    await user.keyboard('{ArrowDown}');
    // Should skip disabled "b" and go straight to "c"
    expect(onChange).toHaveBeenCalledWith('c');
    expect(radios[2]).toHaveFocus();
  });

  it('Home moves to first item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="c" onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    radios[2].focus();
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('a');
    expect(radios[0]).toHaveFocus();
  });

  it('End moves to last item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" onChange={onChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('c');
    expect(radios[2]).toHaveFocus();
  });
});
