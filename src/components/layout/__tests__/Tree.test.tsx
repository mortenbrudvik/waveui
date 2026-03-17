import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree } from '../Tree';
import { testCompoundExposure } from '../../../test-utils';

describe('Tree', () => {
  testCompoundExposure(Tree, ['Item']);

  it('forwards ref to the root div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Tree ref={ref} data-testid="tree">
        <Tree.Item value="a">Item A</Tree.Item>
      </Tree>,
    );
    expect(ref.current).toBe(screen.getByTestId('tree'));
    expect(ref.current?.tagName.toLowerCase()).toBe('div');
  });

  it('renders without crashing', () => {
    render(
      <Tree data-testid="tree">
        <Tree.Item value="a">Item A</Tree.Item>
      </Tree>,
    );
    expect(screen.getByTestId('tree')).toBeInTheDocument();
  });

  it('renders with role=tree', () => {
    render(
      <Tree>
        <Tree.Item value="a">Item A</Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });

  it('renders tree items', () => {
    render(
      <Tree>
        <Tree.Item value="a">Item A</Tree.Item>
        <Tree.Item value="b">Item B</Tree.Item>
      </Tree>,
    );
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
  });

  it('expands nested items on click', async () => {
    const user = userEvent.setup();
    render(
      <Tree>
        <Tree.Item value="parent">
          Parent
          <Tree.Item value="child">Child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    // Child should not be visible initially
    expect(screen.queryByText('Child')).toBeNull();
    // Click to expand
    await user.click(screen.getByText('Parent'));
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('collapses nested items on second click', async () => {
    const user = userEvent.setup();
    render(
      <Tree>
        <Tree.Item value="parent">
          Parent
          <Tree.Item value="child">Child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(screen.getByText('Parent'));
    expect(screen.getByText('Child')).toBeInTheDocument();
    await user.click(screen.getByText('Parent'));
    expect(screen.queryByText('Child')).toBeNull();
  });

  it('supports defaultExpandedItems', () => {
    render(
      <Tree defaultExpandedItems={['parent']}>
        <Tree.Item value="parent">
          Parent
          <Tree.Item value="child">Child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('sets aria-expanded on expandable items', () => {
    render(
      <Tree>
        <Tree.Item value="parent" data-testid="parent">
          Parent
          <Tree.Item value="child">Child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    // aria-expanded is on the inner treeitem role element, not the outer wrapper
    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders icon in tree item', () => {
    render(
      <Tree>
        <Tree.Item value="a" icon={<span data-testid="icon">IC</span>}>
          Item
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(
      <Tree className="my-class" data-testid="tree">
        <Tree.Item value="a">Item</Tree.Item>
      </Tree>,
    );
    expect(screen.getByTestId('tree').className).toContain('my-class');
  });

  it('spreads rest props', () => {
    render(
      <Tree data-testid="tree" aria-label="file tree">
        <Tree.Item value="a">Item</Tree.Item>
      </Tree>,
    );
    expect(screen.getByTestId('tree')).toHaveAttribute('aria-label', 'file tree');
  });
});
