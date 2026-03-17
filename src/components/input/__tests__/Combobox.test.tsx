import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, Option } from '../Combobox';
import { testCompoundExposure } from '../../../test-utils';

describe('Combobox', () => {
  testCompoundExposure(Combobox, ['Option', 'OptionGroup']);

  it('forwards ref to the root div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Combobox ref={ref} data-testid="combobox">
        <Option value="a">Alpha</Option>
      </Combobox>,
    );
    expect(ref.current).toBe(screen.getByTestId('combobox'));
    expect(ref.current?.tagName.toLowerCase()).toBe('div');
  });

  it('renders without crashing', () => {
    render(
      <Combobox data-testid="combobox">
        <Option value="a">Alpha</Option>
      </Combobox>,
    );
    expect(screen.getByTestId('combobox')).toBeInTheDocument();
  });

  it('renders combobox role input', () => {
    render(
      <Combobox>
        <Option value="a">Alpha</Option>
      </Combobox>,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows placeholder', () => {
    render(
      <Combobox placeholder="Search...">
        <Option value="a">Alpha</Option>
      </Combobox>,
    );
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('opens listbox on focus', async () => {
    const user = userEvent.setup();
    render(
      <Combobox data-testid="combobox">
        <Option value="a">Alpha</Option>
        <Option value="b">Beta</Option>
      </Combobox>,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects an option on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Combobox onOptionSelect={onSelect}>
        <Option value="a">Alpha</Option>
        <Option value="b">Beta</Option>
      </Combobox>,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Alpha'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('supports disabled state', () => {
    render(
      <Combobox disabled>
        <Option value="a">Alpha</Option>
      </Combobox>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(
      <Combobox className="my-class" data-testid="combobox">
        <Option value="a">Alpha</Option>
      </Combobox>,
    );
    expect(screen.getByTestId('combobox').className).toContain('my-class');
  });

  it('spreads rest props', () => {
    render(
      <Combobox data-testid="combobox" aria-label="combo">
        <Option value="a">Alpha</Option>
      </Combobox>,
    );
    expect(screen.getByTestId('combobox')).toHaveAttribute('aria-label', 'combo');
  });

  it('selects an option via keyboard navigation (ArrowDown + Enter)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Combobox onOptionSelect={onSelect}>
        <Option value="us">United States</Option>
        <Option value="uk">United Kingdom</Option>
      </Combobox>,
    );
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('us');
    // Verify the display label is the children text, not the value
    expect(input).toHaveValue('United States');
  });

  it('filters options as user types in freeform mode', async () => {
    const user = userEvent.setup();
    render(
      <Combobox freeform>
        <Option value="a">Alpha</Option>
        <Option value="b">Beta</Option>
      </Combobox>,
    );
    const input = screen.getByRole('combobox');
    await user.type(input, 'alp');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });
});
