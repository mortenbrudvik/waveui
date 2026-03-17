import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../Select';
import { testSystemProps, testFocusEvents } from '../../../test-utils';

describe('Select', () => {
  testSystemProps(Select, {
    expectedTag: 'select',
    displayName: 'Select',
    defaultProps: { 'aria-label': 'test', children: React.createElement('option', { value: 'a' }, 'A') },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  testFocusEvents(Select, { 'aria-label': 'test', children: React.createElement('option', { value: 'a' }, 'A') }, 'select');

  it('renders without crashing', () => {
    render(
      <Select data-testid="sel">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    expect(screen.getByTestId('sel')).toBeInTheDocument();
  });

  it('renders children options', () => {
    render(
      <Select data-testid="sel">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('sets aria-invalid when error is provided', () => {
    render(
      <Select error="Required" data-testid="sel">
        <option>A</option>
      </Select>,
    );
    expect(screen.getByTestId('sel')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(
      <Select data-testid="sel">
        <option>A</option>
      </Select>,
    );
    expect(screen.getByTestId('sel')).not.toHaveAttribute('aria-invalid');
  });

  it('applies error border styling', () => {
    render(
      <Select error="Required" data-testid="sel">
        <option>A</option>
      </Select>,
    );
    expect(screen.getByTestId('sel').className).toContain('border-destructive');
  });

  it('calls onChange when value changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select data-testid="sel" onChange={onChange}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    await user.selectOptions(screen.getByTestId('sel'), 'b');
    expect(onChange).toHaveBeenCalled();
  });

  it('applies disabled state', () => {
    render(
      <Select disabled data-testid="sel">
        <option>A</option>
      </Select>,
    );
    expect(screen.getByTestId('sel')).toBeDisabled();
  });
});
