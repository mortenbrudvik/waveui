import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from '../SearchBox';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('SearchBox', () => {
  testForwardRef(SearchBox, 'div');
  testRestSpread(SearchBox);
  testClassName(SearchBox);

  it('renders without crashing', () => {
    render(<SearchBox />);
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(<SearchBox placeholder="Find..." />);
    expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument();
  });

  it('renders contentBefore as ReactNode shorthand', () => {
    render(<SearchBox contentBefore={<span data-testid="before">*</span>} />);
    expect(screen.getByTestId('before')).toBeInTheDocument();
  });

  it('renders contentBefore as SlotObject', () => {
    render(<SearchBox contentBefore={{ children: <span data-testid="before-slot">*</span> }} />);
    expect(screen.getByTestId('before-slot')).toBeInTheDocument();
  });

  it('renders contentAfter as ReactNode shorthand', () => {
    render(<SearchBox defaultValue="test" contentAfter={<span data-testid="after">!</span>} />);
    expect(screen.getByTestId('after')).toBeInTheDocument();
  });

  it('renders dismiss as SlotObject', () => {
    render(
      <SearchBox
        defaultValue="test"
        dismiss={{ children: <span data-testid="dismiss-slot">X</span> }}
      />,
    );
    expect(screen.getByTestId('dismiss-slot')).toBeInTheDocument();
  });

  it('shows clear button when value is present', () => {
    render(<SearchBox defaultValue="hello" />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchBox />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('clears value on clear button click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBox defaultValue="hello" onChange={onChange} />);
    await user.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('calls onClear on clear button click', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<SearchBox defaultValue="hello" onClear={onClear} />);
    await user.click(screen.getByLabelText('Clear search'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('types in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBox onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('Search'), 'hi');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('hi');
  });

  it('respects controlled value prop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBox value="fixed" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search');
    expect(input).toHaveValue('fixed');
    await user.type(input, 'x');
    // Controlled: value stays as "fixed"
    expect(input).toHaveValue('fixed');
    expect(onChange).toHaveBeenCalled();
  });
});
