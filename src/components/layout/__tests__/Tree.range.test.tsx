import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, type TreeProps } from '../Tree';
import { expectNoA11yViolations } from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

/** docs > work > (report, slides); docs > personal; images > photo; readme. */
const files = (
  <>
    <Tree.Item value="docs">
      Documents
      <Tree.Item value="work">
        Work
        <Tree.Item value="report">Report</Tree.Item>
        <Tree.Item value="slides">Slides</Tree.Item>
      </Tree.Item>
      <Tree.Item value="personal">Personal</Tree.Item>
    </Tree.Item>
    <Tree.Item value="images">
      Images
      <Tree.Item value="photo">Photo</Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme">Readme</Tree.Item>
  </>
);

function setup(props: Partial<TreeProps> = {}) {
  const onCheckedItemsChange = vi.fn();
  render(
    <Tree
      aria-label="Files"
      selectionMode="multiple"
      defaultExpandedItems={['docs', 'work', 'images']}
      onCheckedItemsChange={onCheckedItemsChange}
      {...props}
    >
      {files}
    </Tree>,
  );
  return { onCheckedItemsChange };
}
const item = (name: string) => screen.getByRole('treeitem', { name });
const checked = () =>
  screen
    .getAllByRole('treeitem')
    .filter((el) => el.getAttribute('aria-checked') === 'true')
    .map((el) => el.getAttribute('data-roving-value'));
const lastChecked = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.at(-1)?.[0];

describe('Tree - independent checks', () => {
  it('checks only the item: no cascade down, no checked or mixed parent', async () => {
    const user = userEvent.setup();
    const { onCheckedItemsChange } = setup({ independentChecks: true });
    expect(screen.getByRole('tree')).toHaveAttribute('data-independent-checks', '');
    await user.click(screen.getByRole('checkbox', { name: 'Work' }));
    expect(lastChecked(onCheckedItemsChange)).toEqual(['work']);
    expect(checked()).toEqual(['work']);
    expect(item('Report')).toHaveAttribute('aria-checked', 'false');
    expect(item('Documents')).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('checkbox', { name: 'Report' }));
    await user.click(screen.getByRole('checkbox', { name: 'Slides' }));
    // Both children checked, the parent stays as it is.
    expect(lastChecked(onCheckedItemsChange)).toEqual(['work', 'report', 'slides']);
    await user.click(screen.getByRole('checkbox', { name: 'Work' }));
    expect(checked()).toEqual(['report', 'slides']);
  });

  it('shows a listed parent checked without checking its children, and Space toggles it', async () => {
    const user = userEvent.setup();
    setup({ independentChecks: true, defaultCheckedItems: ['docs'] });
    expect(item('Documents')).toHaveAttribute('aria-checked', 'true');
    expect(item('Work')).toHaveAttribute('aria-checked', 'false');
    await user.tab();
    await user.keyboard(' ');
    expect(item('Documents')).toHaveAttribute('aria-checked', 'false');
  });

  it('cascades by default and has no attribute', () => {
    setup();
    expect(screen.getByRole('tree')).not.toHaveAttribute('data-independent-checks');
  });

  it('has no axe violations', async () => {
    setup({ independentChecks: true, defaultCheckedItems: ['work'] });
    await expectNoA11yViolations();
  });
});

describe('Tree - range selection (Shift+Arrow, Shift+Space, Ctrl+A)', () => {
  it('Ctrl+A checks every item, once', async () => {
    const user = userEvent.setup();
    const { onCheckedItemsChange } = setup();
    await user.tab();
    await user.keyboard('{Control>}a{/Control}');
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    expect(lastChecked(onCheckedItemsChange)).toEqual([
      'docs',
      'work',
      'report',
      'slides',
      'personal',
      'images',
      'photo',
      'readme',
    ]);
    expect(onCheckedItemsChange.mock.calls[0]?.[1]).toMatchObject({ checked: true });
  });

  it('Ctrl+A checks the items of collapsed groups too', async () => {
    const user = userEvent.setup();
    const { onCheckedItemsChange } = setup({ defaultExpandedItems: [] });
    await user.tab();
    await user.keyboard('{Control>}a{/Control}');
    expect(lastChecked(onCheckedItemsChange)).toHaveLength(8);
  });

  it('Shift+ArrowDown moves focus and toggles the item it moves to; Shift+ArrowUp too', async () => {
    const user = userEvent.setup();
    const { onCheckedItemsChange } = setup({ independentChecks: true });
    await user.tab();
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(checked()).toEqual(['work', 'report']);
    expect(item('Report')).toHaveFocus();
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    // Moving back up toggles the item it arrives on: Work is unchecked again.
    expect(item('Work')).toHaveFocus();
    expect(checked()).toEqual(['report']);
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(3);
  });

  it('Shift+ArrowUp from the first item stays put and checks nothing', async () => {
    const user = userEvent.setup();
    const { onCheckedItemsChange } = setup();
    await user.tab();
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(item('Documents')).toHaveFocus();
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
  });

  it('Shift+Space checks the visible items from the last one checked to the focused one', async () => {
    const user = userEvent.setup();
    const { onCheckedItemsChange } = setup({ independentChecks: true });
    await user.click(screen.getByRole('checkbox', { name: 'Work' }));
    item('Photo').focus();
    await user.keyboard('{Shift>} {/Shift}');
    expect(lastChecked(onCheckedItemsChange)).toEqual([
      'work',
      'report',
      'slides',
      'personal',
      'images',
      'photo',
    ]);
  });

  it('Shift+Space works upwards, and with the cascade checks whole subtrees', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('checkbox', { name: 'Images' }));
    item('Personal').focus();
    await user.keyboard('{Shift>} {/Shift}');
    // Personal up to Images (the anchor); the checked Images brings its Photo.
    expect(checked()).toEqual(['personal', 'images', 'photo']);
  });

  it('Shift+Space without an anchor checks the focused item', async () => {
    const user = userEvent.setup();
    setup({ independentChecks: true });
    item('Readme').focus();
    await user.keyboard('{Shift>} {/Shift}');
    expect(checked()).toEqual(['readme']);
  });

  it('a tree without checkboxes ignores the keys', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    render(
      <Tree aria-label="Files" onCheckedItemsChange={onCheckedItemsChange}>
        {files}
      </Tree>,
    );
    await user.tab();
    await user.keyboard('{Control>}a{/Control}');
    await user.keyboard('{Shift>} {/Shift}');
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
  });

  it('is called once per key in StrictMode', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <Tree
          aria-label="Files"
          selectionMode="multiple"
          onCheckedItemsChange={onCheckedItemsChange}
        >
          {files}
        </Tree>
      </React.StrictMode>,
    );
    await user.tab();
    await user.keyboard('{Control>}a{/Control}');
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
  });
});
