import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { List } from '../List';
import { testSystemProps, testCompoundExposure } from '../../../test-utils';

describe('List', () => {
  testSystemProps(List, {
    expectedTag: 'ul',
    displayName: 'List',
  });

  testCompoundExposure(List, ['Item']);

  it('renders without crashing', () => {
    render(
      <List data-testid="list">
        <List.Item>Item 1</List.Item>
      </List>,
    );
    expect(screen.getByTestId('list')).toBeInTheDocument();
  });

  it('renders list items', () => {
    render(
      <List>
        <List.Item>Apple</List.Item>
        <List.Item>Banana</List.Item>
        <List.Item>Cherry</List.Item>
      </List>,
    );
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('has list role by default', () => {
    render(<List data-testid="list" />);
    expect(screen.getByTestId('list')).toHaveAttribute('role', 'list');
  });

  it('has listbox role when selectable', () => {
    render(<List selectable data-testid="list" />);
    expect(screen.getByTestId('list')).toHaveAttribute('role', 'listbox');
  });

  it('renders action slot in ListItem', () => {
    render(
      <List>
        <List.Item action={<button>Delete</button>}>Item</List.Item>
      </List>,
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('selects item on click (single select)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <List selectable onSelectionChange={onChange}>
        <List.Item value="a">Item A</List.Item>
        <List.Item value="b">Item B</List.Item>
      </List>,
    );
    await user.click(screen.getByText('Item A'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('deselects on second click (single select)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <List selectable onSelectionChange={onChange}>
        <List.Item value="a">Item A</List.Item>
      </List>,
    );
    await user.click(screen.getByText('Item A'));
    await user.click(screen.getByText('Item A'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('multi-select: allows multiple selected items', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <List selectable selectionMode="multi" onSelectionChange={onChange}>
        <List.Item value="a">Item A</List.Item>
        <List.Item value="b">Item B</List.Item>
      </List>,
    );
    await user.click(screen.getByText('Item A'));
    await user.click(screen.getByText('Item B'));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('sets aria-selected on selected items', async () => {
    const user = userEvent.setup();
    render(
      <List selectable>
        <List.Item value="a">Item A</List.Item>
      </List>,
    );
    const item = screen.getByRole('option');
    expect(item).toHaveAttribute('aria-selected', 'false');
    await user.click(item);
    expect(item).toHaveAttribute('aria-selected', 'true');
  });

  it('sets aria-multiselectable for multi-select mode', () => {
    render(
      <List selectable selectionMode="multi" data-testid="list">
        <List.Item value="a">A</List.Item>
      </List>,
    );
    expect(screen.getByTestId('list')).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('controlled: respects selectedItems prop', () => {
    render(
      <List selectable selectedItems={['b']}>
        <List.Item value="a">Item A</List.Item>
        <List.Item value="b">Item B</List.Item>
      </List>,
    );
    const items = screen.getAllByRole('option');
    expect(items[0]).toHaveAttribute('aria-selected', 'false');
    expect(items[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('keyboard: selects item on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <List selectable onSelectionChange={onChange}>
        <List.Item value="a">Item A</List.Item>
      </List>,
    );
    const item = screen.getByRole('option');
    item.focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['a']);
  });
});
