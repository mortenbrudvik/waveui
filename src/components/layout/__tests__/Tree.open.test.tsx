import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, type TreeItemProps, type TreeOpenChangeDetails, type TreeProps } from '../Tree';
import { expectNoA11yViolations } from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const item = (name: string) => screen.getByRole('treeitem', { name });

/**
 * docs
 *   work
 *   personal
 * images
 *   photo
 * readme
 */
const fileTree = (
  <>
    <Tree.Item value="docs">
      Documents
      <Tree.Item value="work">Work</Tree.Item>
      <Tree.Item value="personal">Personal</Tree.Item>
    </Tree.Item>
    <Tree.Item value="images">
      Images
      <Tree.Item value="photo">Photo</Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme">Readme</Tree.Item>
  </>
);

describe('Tree - open-change event data (tree-5)', () => {
  it('passes the item, its new state and the click as the second argument', async () => {
    const user = userEvent.setup();
    const onExpandedItemsChange = vi.fn();
    render(
      <Tree aria-label="Files" onExpandedItemsChange={onExpandedItemsChange}>
        {fileTree}
      </Tree>,
    );
    await user.click(item('Documents'));
    expect(onExpandedItemsChange).toHaveBeenLastCalledWith(['docs'], {
      value: 'docs',
      open: true,
      event: expect.objectContaining({ type: 'click' }),
    });
    await user.click(item('Documents'));
    expect(onExpandedItemsChange).toHaveBeenLastCalledWith([], {
      value: 'docs',
      open: false,
      event: expect.objectContaining({ type: 'click' }),
    });
  });

  it('names the key that expanded or collapsed: Enter, Space, the arrow keys', async () => {
    const user = userEvent.setup();
    const onExpandedItemsChange = vi.fn();
    render(
      <Tree aria-label="Files" onExpandedItemsChange={onExpandedItemsChange}>
        {fileTree}
      </Tree>,
    );
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onExpandedItemsChange).toHaveBeenLastCalledWith(
      ['docs'],
      expect.objectContaining({
        value: 'docs',
        open: true,
        event: expect.objectContaining({ key: 'Enter' }),
      }),
    );
    await user.keyboard('{ArrowLeft}');
    expect(onExpandedItemsChange).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        value: 'docs',
        open: false,
        event: expect.objectContaining({ key: 'ArrowLeft' }),
      }),
    );
    await user.keyboard('{ArrowRight}');
    expect(onExpandedItemsChange).toHaveBeenLastCalledWith(
      ['docs'],
      expect.objectContaining({
        open: true,
        event: expect.objectContaining({ key: 'ArrowRight' }),
      }),
    );
    await user.keyboard('{ArrowLeft}');
    await user.keyboard(' ');
    expect(onExpandedItemsChange).toHaveBeenLastCalledWith(
      ['docs'],
      expect.objectContaining({ open: true, event: expect.objectContaining({ key: ' ' }) }),
    );
  });

  it('the * key reports the focused item, opening, with every sibling in the list', async () => {
    const user = userEvent.setup();
    const onExpandedItemsChange = vi.fn();
    render(
      <Tree aria-label="Files" onExpandedItemsChange={onExpandedItemsChange}>
        {fileTree}
      </Tree>,
    );
    await user.tab();
    await user.keyboard('*');
    expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
    expect(onExpandedItemsChange).toHaveBeenCalledWith(['docs', 'images'], {
      value: 'docs',
      open: true,
      event: expect.objectContaining({ key: '*' }),
    });
  });

  it('is called once per click in StrictMode, and a controlled parent that ignores it is told again', async () => {
    const user = userEvent.setup();
    const onExpandedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <Tree aria-label="Files" expandedItems={[]} onExpandedItemsChange={onExpandedItemsChange}>
          {fileTree}
        </Tree>
      </React.StrictMode>,
    );
    await user.click(item('Documents'));
    await user.click(item('Documents'));
    expect(onExpandedItemsChange).toHaveBeenCalledTimes(2);
    expect(onExpandedItemsChange.mock.calls.map(([, details]) => details.open)).toEqual([
      true,
      true,
    ]);
  });

  it('types: details are optional, and a handler that takes only the list still fits', () => {
    expectTypeOf<TreeProps['onExpandedItemsChange']>().toEqualTypeOf<
      ((expandedItems: string[], details?: TreeOpenChangeDetails) => void) | undefined
    >();
    expectTypeOf<TreeOpenChangeDetails>().toEqualTypeOf<{
      value: string;
      open: boolean;
      event: Event;
    }>();
    const handler: TreeProps['onExpandedItemsChange'] = (items: string[]) => void items;
    expect(handler).toBeTypeOf('function');
  });
});

describe('Tree.Item - open and onOpenChange (tree-6)', () => {
  it('open={true} shows the child group whatever the tree’s list says, and false hides it', () => {
    const { rerender } = render(
      <Tree aria-label="Files" expandedItems={['images']}>
        <Tree.Item value="docs" open>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
        <Tree.Item value="images" open={false}>
          Images
          <Tree.Item value="photo">Photo</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('treeitem', { name: 'Work' })).toBeInTheDocument();
    expect(item('Images')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: 'Photo' })).toBeNull();
    rerender(
      <Tree aria-label="Files" expandedItems={['images']}>
        <Tree.Item value="docs" open={false}>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
        <Tree.Item value="images">
          Images
          <Tree.Item value="photo">Photo</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
  });

  it('asks for a change through onOpenChange; nothing changes until the parent passes the value', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onExpandedItemsChange = vi.fn();
    render(
      <Tree aria-label="Files" onExpandedItemsChange={onExpandedItemsChange}>
        <Tree.Item value="docs" open={false} onOpenChange={onOpenChange}>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(item('Documents'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true, {
      value: 'docs',
      open: true,
      event: expect.objectContaining({ type: 'click' }),
    });
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    // The tree's list does not hold this item.
    expect(onExpandedItemsChange).not.toHaveBeenCalled();
  });

  it('a parent that passes the value controls the item, with every key', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = React.useState(false);
      return (
        <Tree aria-label="Files">
          <Tree.Item
            value="docs"
            open={open}
            onOpenChange={(next, details) => {
              onOpenChange(next, details);
              setOpen(next);
            }}
          >
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
        </Tree>
      );
    }
    render(<Controlled />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    await user.click(item('Documents'));
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true, false, true, false]);
  });

  it('an item in the tree’s list also calls its onOpenChange, before the tree’s callback', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <Tree aria-label="Files" onExpandedItemsChange={() => calls.push('tree')}>
        <Tree.Item value="docs" onOpenChange={(open) => calls.push(`item ${open}`)}>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(item('Documents'));
    expect(calls).toEqual(['item true', 'tree']);
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('the * key reaches the siblings with an onOpenChange or an open of their own', async () => {
    const user = userEvent.setup();
    const onDocs = vi.fn();
    const onImages = vi.fn();
    const onExpandedItemsChange = vi.fn();
    render(
      <Tree aria-label="Files" onExpandedItemsChange={onExpandedItemsChange}>
        <Tree.Item value="docs" open={false} onOpenChange={onDocs}>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
        <Tree.Item value="images" onOpenChange={onImages}>
          Images
          <Tree.Item value="photo">Photo</Tree.Item>
        </Tree.Item>
        <Tree.Item value="music">
          Music
          <Tree.Item value="song">Song</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.tab();
    await user.keyboard('*');
    expect(onDocs).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ value: 'docs', open: true }),
    );
    expect(onImages).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ value: 'images', open: true }),
    );
    // The item with its own open stays shut until the parent opens it; the others expand.
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Music')).toHaveAttribute('aria-expanded', 'true');
    expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
    expect(onExpandedItemsChange).toHaveBeenCalledWith(
      ['images', 'music'],
      expect.objectContaining({ value: 'docs', open: true }),
    );
  });

  it('is not called for an item without nested items, and is called once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <Tree aria-label="Files">
          <Tree.Item value="docs" onOpenChange={onOpenChange}>
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
          <Tree.Item value="readme" open onOpenChange={onOpenChange}>
            Readme
          </Tree.Item>
        </Tree>
      </React.StrictMode>,
    );
    await user.click(item('Readme'));
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(item('Documents'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('types the two props', () => {
    expectTypeOf<TreeItemProps['open']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<TreeItemProps['onOpenChange']>().toEqualTypeOf<
      ((open: boolean, details: TreeOpenChangeDetails) => void) | undefined
    >();
  });

  it('has no axe violations', async () => {
    const view = render(
      <Tree aria-label="Files">
        <Tree.Item value="docs" open>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await expectNoA11yViolations(view.container);
  });
});
