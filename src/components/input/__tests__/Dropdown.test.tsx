import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from '../Dropdown';
import { Option } from '../Combobox';

describe('Dropdown', () => {
  it('forwards ref to the root div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Dropdown ref={ref} data-testid="dropdown">
        <Option value="a">Alpha</Option>
      </Dropdown>,
    );
    expect(ref.current).toBe(screen.getByTestId('dropdown'));
    expect(ref.current?.tagName.toLowerCase()).toBe('div');
  });

  it('renders without crashing', () => {
    render(
      <Dropdown data-testid="dropdown">
        <Option value="a">Alpha</Option>
      </Dropdown>,
    );
    expect(screen.getByTestId('dropdown')).toBeInTheDocument();
  });

  it('renders combobox role button', () => {
    render(
      <Dropdown>
        <Option value="a">Alpha</Option>
      </Dropdown>,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows placeholder when no value selected', () => {
    render(
      <Dropdown placeholder="Pick one">
        <Option value="a">Alpha</Option>
      </Dropdown>,
    );
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('opens listbox on click', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <Option value="a">Alpha</Option>
        <Option value="b">Beta</Option>
      </Dropdown>,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects an option on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Dropdown onOptionSelect={onSelect}>
        <Option value="a">Alpha</Option>
        <Option value="b">Beta</Option>
      </Dropdown>,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Alpha'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('shows selected value text', async () => {
    render(
      <Dropdown defaultValue="a">
        <Option value="a">Alpha</Option>
        <Option value="b">Beta</Option>
      </Dropdown>,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('supports disabled state', () => {
    render(
      <Dropdown disabled>
        <Option value="a">Alpha</Option>
      </Dropdown>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(
      <Dropdown className="my-class" data-testid="dropdown">
        <Option value="a">Alpha</Option>
      </Dropdown>,
    );
    expect(screen.getByTestId('dropdown').className).toContain('my-class');
  });

  it('spreads rest props', () => {
    render(
      <Dropdown data-testid="dropdown" aria-label="dd">
        <Option value="a">Alpha</Option>
      </Dropdown>,
    );
    expect(screen.getByTestId('dropdown')).toHaveAttribute('aria-label', 'dd');
  });
});
