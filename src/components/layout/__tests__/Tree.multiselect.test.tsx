import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, type TreeCheckedItemsChangeDetails, type TreeProps } from '../Tree';
import { treeItemClassNames } from '../../../lib/classNames';
import { forcedColors } from '../../../lib/styles';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/**
 * docs
 *   work
 *     report
 *     slides
 *   personal
 * images
 *   photo
 * readme
 * Tree order: docs, work, report, slides, personal, images, photo, readme.
 */
const files = (
  <>
    <Tree.Item value="docs">
      Documents
      <Tree.Item value="work">
        Work
        <Tree.Item value="report">Report.docx</Tree.Item>
        <Tree.Item value="slides">Slides.pptx</Tree.Item>
      </Tree.Item>
      <Tree.Item value="personal">Personal.txt</Tree.Item>
    </Tree.Item>
    <Tree.Item value="images">
      Images
      <Tree.Item value="photo">Photo.jpg</Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme">Readme.md</Tree.Item>
  </>
);

const ALL_EXPANDED = ['docs', 'work', 'images'];

const item = (name: string) => screen.getByRole('treeitem', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });

/** The `[WaveUI]` warnings logged so far (asserted, never silenced). */
const warnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.map(([message]) => String(message));

const ITEM_IN_LABEL_WARNING =
  '[WaveUI] Tree.Item was rendered inside the label of another Tree.Item, so it is not part ' +
  "of that item's child group: the parent cannot expand, its name includes the nested " +
  'text, and a treeitem sits inside a label (axe aria-required-parent). A Tree.Item finds ' +
  'its nested items among its own children (written directly, in Fragments, or returned ' +
  'by a render function such as `children.map(renderNode)`), but not inside a component ' +
  'that renders Tree.Item itself. Build a data-driven tree with a render function instead ' +
  'of a recursive component.';

function renderChecks(props: Partial<TreeProps> = {}) {
  return render(
    <Tree aria-label="Files" selectionMode="multiple" {...props}>
      {files}
    </Tree>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Tree - selectionMode="multiple"', () => {
  it('marks the tree multiselectable and renders each item state with aria-checked and data-*', () => {
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['report'] });
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('aria-multiselectable', 'true');
    expect(tree).toHaveAttribute('data-selection-mode', 'multiple');

    expect(item('Report.docx')).toHaveAttribute('aria-checked', 'true');
    expect(item('Report.docx')).toHaveAttribute('data-checked', '');
    expect(item('Report.docx')).not.toHaveAttribute('data-mixed');
    expect(item('Work')).toHaveAttribute('aria-checked', 'mixed');
    expect(item('Work')).toHaveAttribute('data-mixed', '');
    expect(item('Work')).not.toHaveAttribute('data-checked');
    expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
    expect(item('Slides.pptx')).toHaveAttribute('aria-checked', 'false');
    expect(item('Slides.pptx')).not.toHaveAttribute('data-checked');
    expect(item('Slides.pptx')).not.toHaveAttribute('data-mixed');
    // An item carries aria-checked or aria-selected, never both (APG).
    expect(item('Readme.md')).not.toHaveAttribute('aria-selected');

    expect(checkbox('Report.docx')).toHaveAttribute('aria-checked', 'true');
    expect(checkbox('Work')).toHaveAttribute('aria-checked', 'mixed');
    expect(checkbox('Slides.pptx')).toHaveAttribute('aria-checked', 'false');
  });

  it('a listed parent checks every descendant, and a parent whose collapsed descendants are all listed is checked', () => {
    const { unmount } = renderChecks({
      defaultExpandedItems: ALL_EXPANDED,
      defaultCheckedItems: ['docs'],
    });
    for (const name of ['Documents', 'Work', 'Report.docx', 'Slides.pptx', 'Personal.txt']) {
      expect(item(name)).toHaveAttribute('aria-checked', 'true');
    }
    expect(item('Images')).toHaveAttribute('aria-checked', 'false');
    unmount();

    // Collapsed: the nested items are not rendered, but they are the parent's descendants.
    renderChecks({ defaultCheckedItems: ['report', 'slides', 'personal'] });
    expect(item('Documents')).toHaveAttribute('aria-checked', 'true');
  });

  it('draws an exposed checkbox after the chevron: outside the Tab order, named by the item, skipped by the arrow keys', async () => {
    const user = userEvent.setup();
    renderChecks({ defaultExpandedItems: ['docs'] });
    const box = checkbox('Documents');
    expect(box).toHaveAttribute('tabindex', '-1');
    expect(box).toHaveClass(treeItemClassNames.indicator);
    expect(box).not.toHaveAttribute('data-roving-value');
    const row = item('Documents').querySelector('[data-tree-row]')!;
    expect(row.children[0].tagName.toLowerCase()).toBe('svg');
    expect(row.children[1]).toBe(box);

    act(() => item('Documents').focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
  });

  it('Space toggles the focused item with details { value, checked, event }; Enter activates without toggling', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onItemSelect = vi.fn();
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, onCheckedItemsChange, onItemSelect });

    act(() => item('Work').focus());
    await user.keyboard(' ');
    expect(onCheckedItemsChange.mock.calls).toEqual([
      [
        ['work', 'report', 'slides'],
        { value: 'work', checked: true, event: expect.any(KeyboardEvent) },
      ],
    ]);
    expect(item('Work')).toHaveAttribute('aria-checked', 'true');
    expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
    expect(item('Work')).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(onCheckedItemsChange).toHaveBeenLastCalledWith([], {
      value: 'work',
      checked: false,
      event: expect.any(KeyboardEvent),
    });

    act(() => item('Readme.md').focus());
    await user.keyboard('{Enter}');
    expect(onItemSelect.mock.calls).toEqual([['readme']]);
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(2);
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'false');
  });

  it('a click on the checkbox toggles the check, does not activate or expand, and keeps focus on the item', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onItemSelect = vi.fn();
    renderChecks({ onCheckedItemsChange, onItemSelect });
    await user.click(checkbox('Documents'));
    expect(onCheckedItemsChange.mock.calls).toEqual([
      [
        ['docs', 'work', 'report', 'slides', 'personal'],
        { value: 'docs', checked: true, event: expect.any(MouseEvent) },
      ],
    ]);
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Documents')).toHaveFocus();
  });

  it('a click elsewhere on the row activates the item and does not toggle', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onItemSelect = vi.fn();
    renderChecks({ onCheckedItemsChange, onItemSelect });
    await user.click(screen.getByText('Readme.md'));
    expect(onItemSelect.mock.calls).toEqual([['readme']]);
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'false');
  });

  it('uncontrolled: defaultCheckedItems seeds the checks and each toggle calls back', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const initial = ['photo'];
    renderChecks({
      defaultExpandedItems: ['images'],
      defaultCheckedItems: initial,
      onCheckedItemsChange,
    });
    expect(item('Images')).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox('Photo.jpg'));
    expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ value: 'photo', checked: false }),
    );
    expect(item('Images')).toHaveAttribute('aria-checked', 'false');
    expect(Object.isFrozen(onCheckedItemsChange.mock.calls[0][0])).toBe(false);
    expect(onCheckedItemsChange.mock.calls[0][0]).not.toBe(initial);
  });

  it('controlled: the checks follow a parent that accepts the change', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [checked, setChecked] = React.useState<string[]>([]);
      return (
        <Tree
          aria-label="Files"
          selectionMode="multiple"
          checkedItems={checked}
          onCheckedItemsChange={setChecked}
        >
          {files}
        </Tree>
      );
    }
    render(<Controlled />);
    await user.click(checkbox('Images'));
    expect(item('Images')).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox('Readme.md'));
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'true');
    expect(item('Images')).toHaveAttribute('aria-checked', 'true');
  });

  it('a controlled parent that ignores the callback keeps the rendered checks, and each click emits from them again', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    renderChecks({ checkedItems: ['readme'], onCheckedItemsChange });
    await user.click(checkbox('Images'));
    await user.click(checkbox('Images'));
    expect(onCheckedItemsChange.mock.calls.map(([items]) => items)).toEqual([
      ['images', 'photo', 'readme'],
      ['images', 'photo', 'readme'],
    ]);
    expect(item('Images')).toHaveAttribute('aria-checked', 'false');
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'true');
  });

  it('accepts readonly lists and emits a mutable one', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const listed = ['readme'] as const;
    renderChecks({ checkedItems: listed, onCheckedItemsChange });
    await user.click(checkbox('Images'));
    expect(Object.isFrozen(onCheckedItemsChange.mock.calls[0][0])).toBe(false);
    expect(onCheckedItemsChange.mock.calls[0][0]).not.toBe(listed);
  });

  it('StrictMode: onCheckedItemsChange fires exactly once per toggle', async () => {
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
    await user.click(checkbox('Documents'));
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    act(() => item('Readme.md').focus());
    await user.keyboard(' ');
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(2);
  });

  it('a Space that continues a typeahead search does not toggle', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    render(
      <Tree
        aria-label="States"
        selectionMode="multiple"
        onCheckedItemsChange={onCheckedItemsChange}
      >
        <Tree.Item value="al">Alabama</Tree.Item>
        <Tree.Item value="nj">New Jersey</Tree.Item>
        <Tree.Item value="ny">New York</Tree.Item>
      </Tree>,
    );
    act(() => item('Alabama').focus());
    await user.keyboard('new y');
    expect(item('New York')).toHaveFocus();
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
  });

  it('keeps * (expand siblings) and current', async () => {
    const user = userEvent.setup();
    renderChecks({ current: 'readme' });
    act(() => item('Documents').focus());
    await user.keyboard('*');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Readme.md')).toHaveAttribute('aria-current', 'true');
  });

  it('draws the checkbox with Checkbox forced-colors recipe', () => {
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['report'] });
    expect(checkbox('Report.docx')).toHaveClass(
      'forced-colors:border-[Highlight]',
      'forced-colors:bg-[Highlight]',
    );
    expect(checkbox('Slides.pptx')).toHaveClass(...forcedColors.control.split(' '));
    expect(checkbox('Report.docx').querySelector('svg')).toHaveClass(
      ...forcedColors.selectedLeaf.split(' '),
    );
    expect(checkbox('Work').querySelector('svg')).toHaveClass(
      ...forcedColors.selectedLeaf.split(' '),
    );
    expect(checkbox('Slides.pptx').querySelector('svg')).toBeNull();
  });

  it('renders the states on the server and hydrates without warnings', async () => {
    const tree = (
      <Tree
        aria-label="Files"
        selectionMode="multiple"
        defaultExpandedItems={['docs']}
        defaultCheckedItems={['personal']}
      >
        {files}
      </Tree>
    );
    const html = renderToString(tree);
    expect(html).toContain('aria-multiselectable="true"');
    expect(html).toMatch(/role="checkbox" aria-checked="mixed"/);
    expect(html).toMatch(/role="checkbox" aria-checked="true"/);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
      expect(item('Personal.txt')).toHaveAttribute('aria-checked', 'true');
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
      warn.mockRestore();
    }
  });

  it('RTL: the checkbox sits after the chevron, at the start side', () => {
    renderWithProviders(
      <Tree aria-label="Files" selectionMode="multiple">
        {files}
      </Tree>,
      { dir: 'rtl' },
    );
    const row = item('Documents').querySelector('[data-tree-row]')!;
    expect(row.children[0].tagName.toLowerCase()).toBe('svg');
    expect(row.children[1]).toHaveAttribute('role', 'checkbox');
  });

  it('has no accessibility violations with a mixed parent', async () => {
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['report'] });
    await expectNoA11yViolations();
  });

  describe('warnings (C-DEV)', () => {
    it('selected has no effect in a checkbox tree', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ui = (
        <Tree aria-label="Files" selectionMode="multiple" selected="readme">
          {files}
        </Tree>
      );
      const { rerender } = render(ui);
      rerender(ui);
      expect(item('Readme.md')).not.toHaveAttribute('aria-selected');
      expect(warnings(warn)).toEqual([
        '[WaveUI] Tree: `selected` has no effect with selectionMode="multiple"; use ' +
          '`checkedItems`, and `current` for the item the user is on.',
      ]);
    });

    it('checkedItems or defaultCheckedItems without selectionMode="multiple"', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tree aria-label="Files" defaultCheckedItems={['readme']}>
          {files}
        </Tree>,
      );
      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(item('Readme.md')).not.toHaveAttribute('aria-checked');
      expect(warnings(warn)).toEqual([
        '[WaveUI] Tree: `checkedItems` and `defaultCheckedItems` need selectionMode="multiple"; ' +
          'without it the tree draws no checkboxes and ignores them.',
      ]);
    });
  });

  describe('edge cases', () => {
    it('duplicate values: no crash, the value is emitted once, every item with it shows the state', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onCheckedItemsChange = vi.fn();
      render(
        <Tree
          aria-label="Files"
          selectionMode="multiple"
          onCheckedItemsChange={onCheckedItemsChange}
        >
          <Tree.Item value="a">First</Tree.Item>
          <Tree.Item value="a">Copy</Tree.Item>
          <Tree.Item value="b">Second</Tree.Item>
        </Tree>,
      );
      await user.click(checkbox('Copy'));
      expect(onCheckedItemsChange.mock.calls.map(([items]) => items)).toEqual([['a']]);
      expect(item('First')).toHaveAttribute('aria-checked', 'true');
      expect(item('Copy')).toHaveAttribute('aria-checked', 'true');
      expect(warnings(warn)).toEqual([
        '[WaveUI] Tree: several items share the value "a". Item values must be unique within a ' +
          'Tree; items with the same value share their expanded, selected and focus state.',
      ]);
    });

    it('app components at the top level: each item scans its own children, so checks cascade', async () => {
      const user = userEvent.setup();
      const onCheckedItemsChange = vi.fn();
      function FolderNode({ id, name, entries }: { id: string; name: string; entries: string[] }) {
        return (
          <Tree.Item value={id}>
            {name}
            {entries.map((entry) => (
              <Tree.Item key={entry} value={entry}>
                {entry}
              </Tree.Item>
            ))}
          </Tree.Item>
        );
      }
      render(
        <Tree
          aria-label="Files"
          selectionMode="multiple"
          defaultExpandedItems={['docs']}
          onCheckedItemsChange={onCheckedItemsChange}
        >
          <FolderNode id="docs" name="Documents" entries={['a.txt', 'b.txt']} />
          <Tree.Item value="readme">Readme.md</Tree.Item>
        </Tree>,
      );
      await user.click(checkbox('Documents'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['docs', 'a.txt', 'b.txt'],
        expect.objectContaining({ value: 'docs', checked: true }),
      );
      expect(item('a.txt')).toHaveAttribute('aria-checked', 'true');
      await user.click(checkbox('a.txt'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['b.txt'],
        expect.objectContaining({ value: 'a.txt', checked: false }),
      );
      expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
    });

    it('an item a nested component renders lands in the parent label (0.7 warning): the parent check does not reach it, and it toggles its own value', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onCheckedItemsChange = vi.fn();
      function FileNode({ value }: { value: string }) {
        return <Tree.Item value={value}>{value}</Tree.Item>;
      }
      render(
        <Tree
          aria-label="Files"
          selectionMode="multiple"
          onCheckedItemsChange={onCheckedItemsChange}
        >
          <Tree.Item value="docs">
            Documents
            <FileNode value="a.txt" />
          </Tree.Item>
        </Tree>,
      );
      const [docsBox, fileBox] = screen.getAllByRole('checkbox');
      await user.click(docsBox);
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['docs'],
        expect.objectContaining({ value: 'docs' }),
      );
      expect(fileBox).toHaveAttribute('aria-checked', 'false');
      await user.click(fileBox);
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['docs', 'a.txt'],
        expect.objectContaining({ value: 'a.txt', checked: true }),
      );
      expect(warnings(warn)).toEqual([ITEM_IN_LABEL_WARNING]);
    });

    it('an item rendered in the label of an item under a listed grandparent is not checked with it, and toggles normally', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onCheckedItemsChange = vi.fn();
      function FileNode({ value }: { value: string }) {
        return <Tree.Item value={value}>{value}</Tree.Item>;
      }
      render(
        <Tree
          aria-label="Files"
          selectionMode="multiple"
          defaultExpandedItems={['g']}
          checkedItems={['g']}
          onCheckedItemsChange={onCheckedItemsChange}
        >
          <Tree.Item value="g">
            Grand
            <Tree.Item value="w">
              Wrapper
              <FileNode value="x.txt" />
            </Tree.Item>
          </Tree.Item>
        </Tree>,
      );
      expect(screen.getByRole('treeitem', { name: /^Wrapper/ })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(item('x.txt')).toHaveAttribute('aria-checked', 'false');
      await user.click(checkbox('x.txt'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['g', 'w', 'x.txt'],
        expect.objectContaining({ value: 'x.txt', checked: true }),
      );
      expect(warnings(warn)).toEqual([ITEM_IN_LABEL_WARNING]);
    });

    it('children added later under a listed parent render checked; a listed placeholder value is kept as unmatched', async () => {
      const user = userEvent.setup();
      const onCheckedItemsChange = vi.fn();
      function Remote({ loaded, checked }: { loaded: boolean; checked: string[] }) {
        return (
          <Tree
            aria-label="Remote files"
            selectionMode="multiple"
            defaultExpandedItems={['remote']}
            checkedItems={checked}
            onCheckedItemsChange={onCheckedItemsChange}
          >
            <Tree.Item value="remote">
              Remote
              {loaded ? (
                <>
                  <Tree.Item value="r1">One</Tree.Item>
                  <Tree.Item value="r2">Two</Tree.Item>
                </>
              ) : (
                <Tree.Item value="remote-loading">Loading…</Tree.Item>
              )}
            </Tree.Item>
          </Tree>
        );
      }
      const { rerender } = render(<Remote loaded={false} checked={['remote']} />);
      expect(item('Loading…')).toHaveAttribute('aria-checked', 'true');
      rerender(<Remote loaded checked={['remote']} />);
      expect(item('One')).toHaveAttribute('aria-checked', 'true');
      expect(item('Two')).toHaveAttribute('aria-checked', 'true');
      await user.click(checkbox('One'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['r2'],
        expect.objectContaining({ value: 'r1', checked: false }),
      );

      rerender(<Remote loaded checked={['remote', 'remote-loading']} />);
      await user.click(checkbox('Two'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['r1', 'remote-loading'],
        expect.objectContaining({ value: 'r2', checked: false }),
      );
    });
  });

  it('types: the mode union, readonly lists, a mutable emitted list and the details (C-NAMING)', () => {
    expectTypeOf<TreeProps['selectionMode']>().toEqualTypeOf<
      'none' | 'single' | 'multiple' | undefined
    >();
    expectTypeOf<TreeProps['checkedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TreeProps['defaultCheckedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<NonNullable<TreeProps['onCheckedItemsChange']>>()
      .parameter(0)
      .toEqualTypeOf<string[]>();
    expectTypeOf<NonNullable<TreeProps['onCheckedItemsChange']>>()
      .parameter(1)
      .toEqualTypeOf<TreeCheckedItemsChangeDetails | undefined>();
    expectTypeOf<TreeCheckedItemsChangeDetails>().toEqualTypeOf<{
      value: string;
      checked: boolean;
      event: Event;
    }>();
    // A one-argument callback and a state setter are accepted.
    expectTypeOf<(items: string[]) => void>().toExtend<
      NonNullable<TreeProps['onCheckedItemsChange']>
    >();
    expectTypeOf<React.Dispatch<React.SetStateAction<string[]>>>().toExtend<
      NonNullable<TreeProps['onCheckedItemsChange']>
    >();
    // @ts-expect-error Fluent's 'multiselect' is spelled 'multiple' in WaveUI
    const fluentName = <Tree aria-label="x" selectionMode="multiselect" />;
    expect(fluentName).toBeTruthy();
  });
});

describe('Tree - selectionMode="single"', () => {
  /** The row's indicator: the decorative radio in single mode. */
  const radioOf = (name: string) =>
    item(name).querySelector<HTMLElement>(
      `:scope > [data-tree-row] > .${treeItemClassNames.indicator}`,
    );

  it('draws a decorative radio on every item and fills the selected one', () => {
    render(
      <Tree
        aria-label="Files"
        selectionMode="single"
        selected="readme"
        defaultExpandedItems={ALL_EXPANDED}
      >
        {files}
      </Tree>,
    );
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('data-selection-mode', 'single');
    expect(tree).not.toHaveAttribute('aria-multiselectable');
    expect(screen.queryByRole('checkbox')).toBeNull();
    for (const name of ['Documents', 'Work', 'Report.docx', 'Readme.md']) {
      expect(radioOf(name)).toHaveAttribute('aria-hidden', 'true');
    }
    expect(radioOf('Readme.md')!.children).toHaveLength(1);
    expect(radioOf('Documents')!.children).toHaveLength(0);
    expect(item('Readme.md')).toHaveAttribute('aria-selected', 'true');
    expect(item('Documents')).toHaveAttribute('aria-selected', 'false');
    expect(item('Readme.md')).not.toHaveAttribute('aria-checked');
  });

  it('with selected={null}, every item carries aria-selected="false" and nothing warns', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <Tree aria-label="Files" selectionMode="single" selected={null}>
        {files}
      </Tree>,
    );
    for (const treeitem of screen.getAllByRole('treeitem')) {
      expect(treeitem).toHaveAttribute('aria-selected', 'false');
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('without selected, warns once and still puts aria-selected="false" on every item', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ui = (
      <Tree aria-label="Files" selectionMode="single">
        {files}
      </Tree>
    );
    const { rerender } = render(ui);
    rerender(ui);
    for (const treeitem of screen.getAllByRole('treeitem')) {
      expect(treeitem).toHaveAttribute('aria-selected', 'false');
    }
    expect(warnings(warn)).toEqual([
      '[WaveUI] Tree: selectionMode="single" draws a radio on every item for `selected`; pass ' +
        '`selected` (null while nothing is selected) and update it from `onItemSelect`.',
    ]);
  });

  it('a click on the radio, Space and Enter activate the item, as in 0.7', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    render(
      <Tree aria-label="Files" selectionMode="single" selected={null} onItemSelect={onItemSelect}>
        {files}
      </Tree>,
    );
    await user.click(radioOf('Readme.md')!);
    act(() => item('Images').focus());
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onItemSelect.mock.calls).toEqual([['readme'], ['images'], ['images']]);
  });

  it('a controlled selection moves the filled radio', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [selected, setSelected] = React.useState<string | null>(null);
      return (
        <Tree
          aria-label="Files"
          selectionMode="single"
          selected={selected}
          onItemSelect={setSelected}
        >
          {files}
        </Tree>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByText('Readme.md'));
    expect(item('Readme.md')).toHaveAttribute('aria-selected', 'true');
    expect(radioOf('Readme.md')!.children).toHaveLength(1);
    expect(radioOf('Images')!.children).toHaveLength(0);
  });

  it('has no accessibility violations', async () => {
    render(
      <Tree
        aria-label="Files"
        selectionMode="single"
        selected="work"
        defaultExpandedItems={ALL_EXPANDED}
      >
        {files}
      </Tree>,
    );
    await expectNoA11yViolations();
  });
});

describe('Tree - selectionMode="none" (the default)', () => {
  it('adds only data-selection-mode: no indicator, aria-checked, data-checked or aria-selected', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        {files}
      </Tree>,
    );
    expect(screen.getByRole('tree')).toHaveAttribute('data-selection-mode', 'none');
    expect(document.querySelector(`.${treeItemClassNames.indicator}`)).toBeNull();
    for (const treeitem of screen.getAllByRole('treeitem')) {
      expect(treeitem).not.toHaveAttribute('aria-checked');
      expect(treeitem).not.toHaveAttribute('data-checked');
      expect(treeitem).not.toHaveAttribute('data-mixed');
      expect(treeitem).not.toHaveAttribute('aria-selected');
    }
    // The spacer and the label: nothing is added to a 0.7 row.
    expect(item('Readme.md').querySelector('[data-tree-row]')!.children).toHaveLength(2);
  });
});
