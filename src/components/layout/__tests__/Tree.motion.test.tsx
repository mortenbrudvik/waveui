import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, type TreeProps } from '../Tree';
import { treeClassNames, treeItemClassNames } from '../../../lib/classNames';
import { collapseMotion, collapseStructure } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-TREE (spec §5.2, §2.5, D7, D9, D12): an expanded Tree.Item's `role="group"` sits in a
 * collapse wrapper, the presence element, whose default motion (the Tree's `motion`, for every
 * nested group) opens and closes its rows track with a fade. While a group exits it is `inert`, so
 * its items leave the arrow order and typeahead, and focus inside it at the collapse moves to the
 * item that collapsed. jsdom loads no CSS, so the phases wait only where `mockAnimations` gives the
 * wrapper a running animation.
 */

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

/**
 * docs
 *   work
 *     report
 *   personal
 * images
 *   photo
 * readme
 */
function Files(props: Partial<TreeProps>) {
  return (
    <Tree aria-label="Files" {...props}>
      <Tree.Item value="docs">
        Documents
        <Tree.Item value="work">
          Work
          <Tree.Item value="report">Report.docx</Tree.Item>
        </Tree.Item>
        <Tree.Item value="personal">Personal.txt</Tree.Item>
      </Tree.Item>
      <Tree.Item value="images">
        Images
        <Tree.Item value="photo">Photo.jpg</Tree.Item>
      </Tree.Item>
      <Tree.Item value="readme">Readme.md</Tree.Item>
    </Tree>
  );
}

/** A treeitem by its name (exiting ones included: role queries ignore `inert` in jsdom). */
const item = (name: string) => screen.getByRole('treeitem', { name });
const queryItem = (name: string) => screen.queryByRole('treeitem', { name });
/** The item's own child group (the first group inside it: nested groups sit inside this one). */
const groupOf = (name: string) => queryItem(name)?.querySelector<HTMLElement>('[role="group"]');
/** The collapse wrapper around the item's child group. */
const wrapperOf = (name: string) => groupOf(name)?.parentElement ?? null;
/** The item's own chevron (in its row, before its group). */
const chevronOf = (name: string) =>
  item(name).querySelector<Element>('.' + treeItemClassNames.expandIcon)!;
/** The presence element of every Tree group: its collapse wrapper. */
const isCollapse = (el: Element) => el.classList.contains(treeItemClassNames.collapse);
const collapseElements = () => document.querySelectorAll('.' + treeItemClassNames.collapse);

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

describe('the collapse wrapper (§5.2 markup)', () => {
  it('wraps an expanded item’s group: structure, default motion, entered, the group its only child', () => {
    render(<Files defaultExpandedItems={['docs']} />);
    const docs = item('Documents');
    const group = groupOf('Documents')!;
    const wrapper = group.parentElement!;
    expect(wrapper).toHaveClass(
      treeItemClassNames.collapse,
      ...motionClasses(collapseStructure),
      ...motionClasses(collapseMotion),
    );
    expect(wrapper.classList[0]).toBe(treeItemClassNames.collapse);
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper).toHaveAttribute('data-presence', 'entered');
    expect(wrapper).not.toHaveAttribute('inert');
    expect(Array.from(wrapper.children)).toEqual([group]);
    // The treeitem holds its row and the wrapper, in that order.
    expect(wrapper.parentElement).toBe(docs);
    expect(Array.from(docs.children)).toEqual([
      docs.querySelector(':scope > [data-tree-row]'),
      wrapper,
    ]);

    // The group keeps its 0.14 element; the wrapper takes nothing else.
    expect(group).toHaveClass(treeItemClassNames.group, 'ps-4');
    expect(group.classList[0]).toBe(treeItemClassNames.group);
    expect(group.getAttributeNames().sort()).toEqual(['class', 'role']);
    expect(within(group).getByRole('treeitem', { name: 'Work' })).toBe(item('Work'));
    expect(wrapper.getAttributeNames().sort()).toEqual(['class', 'data-presence']);
  });

  it('a collapsed item and a leaf render no wrapper', () => {
    render(<Files />);
    expect(collapseElements()).toHaveLength(0);
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(groupOf('Documents')).toBeNull();
    expect(groupOf('Readme.md')).toBeNull();
  });

  it('a leaf item with nested items renders no wrapper', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['a']}>
        <Tree.Item value="a" leaf>
          Leaf
          <Tree.Item value="b">Hidden child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(collapseElements()).toHaveLength(0);
    expect(screen.queryByText('Hidden child')).toBeNull();
  });
});

describe('presence (D7, the presence pair on the wrapper)', () => {
  it('a collapse keeps the group, inert, its item already collapsed, until the exit ends', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs']} />);
    const group = groupOf('Documents')!;
    const wrapper = group.parentElement!;
    const work = item('Work');

    await user.click(screen.getByText('Documents'));
    expect(groupOf('Documents')).toBe(group);
    expect(item('Work')).toBe(work);
    expect(wrapper).toHaveAttribute('data-presence', 'exiting');
    expect(group.closest('[inert]')).toBe(wrapper);
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(groupOf('Documents')).toBeNull();
    expect(wrapper).not.toBeInTheDocument();
    expect(queryItem('Work')).toBeNull();
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('an expansion enters from the wrapper’s motion (never on mount, D9)', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs']} />);
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'entered');
    expect(motion.started).toBe(0);

    await user.click(screen.getByText('Images'));
    expect(wrapperOf('Images')).toHaveAttribute('data-presence', 'entering');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
    await finish(motion);
    expect(wrapperOf('Images')).toHaveAttribute('data-presence', 'entered');
  });

  it('collapsed and expanded again before the exit ends: the same group and items, entering, not inert', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs']} />);
    const group = groupOf('Documents')!;
    const work = item('Work');

    await user.click(screen.getByText('Documents'));
    expect(group.parentElement).toHaveAttribute('data-presence', 'exiting');
    await user.click(screen.getByText('Documents'));

    expect(groupOf('Documents')).toBe(group);
    expect(item('Work')).toBe(work);
    expect(group.parentElement).toHaveAttribute('data-presence', 'entering');
    expect(group.closest('[inert]')).toBeNull();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');

    await finish(motion);
    expect(groupOf('Documents')).toBe(group);
    expect(group.parentElement).toHaveAttribute('data-presence', 'entered');
  });

  it('collapsing a parent leaves an inner group’s wrapper entered: it goes with its parent, no second exit', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs', 'work']} />);
    const outer = wrapperOf('Documents')!;
    const inner = wrapperOf('Work')!;
    expect(outer.contains(inner)).toBe(true);

    await user.click(screen.getByText('Documents'));
    expect(outer).toHaveAttribute('data-presence', 'exiting');
    expect(inner).toHaveAttribute('data-presence', 'entered');
    expect(inner).not.toHaveAttribute('inert');
    expect(inner.closest('[inert]')).toBe(outer);
    expect(item('Work')).toHaveAttribute('aria-expanded', 'true');
    expect(motion.started).toBe(1);

    await finish(motion);
    expect(outer).not.toBeInTheDocument();
    expect(inner).not.toBeInTheDocument();
    expect(collapseElements()).toHaveLength(0);

    // Expanded again: the outer group enters; the inner one, still expanded, mounts entered.
    await user.click(screen.getByText('Documents'));
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'entering');
    expect(wrapperOf('Work')).toHaveAttribute('data-presence', 'entered');
    expect(motion.started).toBe(2);
    await finish(motion);
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'entered');
  });

  it('under reduced motion a collapse removes the group within the same act', async () => {
    mockAnimations({ animated: isCollapse });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs']} />);
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'entered');
    await user.click(screen.getByText('Documents'));
    expect(groupOf('Documents')).toBeNull();
    expect(collapseElements()).toHaveLength(0);
  });

  it('without reduced motion the same collapse waits for the wrapper’s motion', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs']} />);
    await user.click(screen.getByText('Documents'));
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(groupOf('Documents')).toBeNull();
  });
});

describe('keyboard while a group exits', () => {
  it('ArrowDown from the collapsed parent skips the exiting items, and ArrowUp returns to it', async () => {
    mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs']} />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowLeft}');
    expect(item('Documents')).toHaveFocus();
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');

    await user.keyboard('{ArrowDown}');
    expect(item('Images')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('Documents')).toHaveFocus();
    await user.keyboard('{End}');
    expect(item('Readme.md')).toHaveFocus();
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');
  });

  it('typeahead does not land in an exiting group', async () => {
    mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Files defaultExpandedItems={['docs', 'work']} />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowLeft}');
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');
    // "Report.docx" (exiting) comes before "Readme.md" in tree order.
    await user.keyboard('r');
    expect(item('Readme.md')).toHaveFocus();
  });

  it('a selected item in an exiting group gives up the tab stop, as when it unmounted', async () => {
    mockAnimations({ animated: isCollapse });
    render(<Files defaultExpandedItems={['docs']} selected="work" />);
    expect(item('Work')).toHaveAttribute('tabindex', '0');
    fireEvent.click(chevronOf('Documents'));
    // The roving store reads the DOM through a MutationObserver: let it see the inert wrapper.
    await act(async () => {});
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');
    expect(item('Work')).toHaveAttribute('tabindex', '-1');
    expect(item('Documents')).toHaveAttribute('tabindex', '0');
  });
});

describe('focus inside a collapsing group (§2.5, §5.2)', () => {
  it('a chevron click with focus on a child collapses the parent and focuses its treeitem, which holds the tab stop', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    render(<Files defaultExpandedItems={['docs']} />);
    act(() => item('Work').focus());
    expect(item('Work')).toHaveAttribute('tabindex', '0');

    // A click that moves no focus itself (assistive technology, a programmatic click).
    fireEvent.click(chevronOf('Documents'));
    await act(async () => {});
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');
    expect(item('Work').closest('[inert]')).toBe(wrapperOf('Documents'));
    expect(item('Documents')).toHaveFocus();
    expect(item('Documents')).toHaveAttribute('tabindex', '0');
    expect(item('Work')).toHaveAttribute('tabindex', '-1');

    await finish(motion);
    expect(queryItem('Work')).toBeNull();
    expect(item('Documents')).toHaveFocus();
    expect(item('Documents')).toHaveAttribute('tabindex', '0');
  });

  it('a child’s action that collapses its parent (controlled) moves focus to the parent', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    const user = userEvent.setup();
    function ControlledFiles() {
      const [expanded, setExpanded] = React.useState<string[]>(['docs']);
      return (
        <Tree aria-label="Files" expandedItems={expanded} onExpandedItemsChange={setExpanded}>
          <Tree.Item value="docs">
            Documents
            <Tree.Item
              value="work"
              actions={
                <button type="button" onClick={() => setExpanded([])}>
                  Close Documents
                </button>
              }
            >
              Work
            </Tree.Item>
          </Tree.Item>
          <Tree.Item value="readme">Readme.md</Tree.Item>
        </Tree>
      );
    }
    render(<ControlledFiles />);
    const close = screen.getByRole('button', { name: 'Close Documents' });

    await user.click(close);
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');
    expect(close.closest('[inert]')).toBe(wrapperOf('Documents'));
    expect(item('Documents')).toHaveFocus();
    expect(item('Documents')).toHaveAttribute('tabindex', '0');

    await finish(motion);
    expect(queryItem('Work')).toBeNull();
    expect(item('Documents')).toHaveFocus();
  });

  it('with no motion focus moves before the group unmounts', async () => {
    honourInert();
    render(<Files defaultExpandedItems={['docs', 'work']} motion={null} />);
    act(() => item('Report.docx').focus());

    fireEvent.click(chevronOf('Documents'));
    await act(async () => {});
    expect(groupOf('Documents')).toBeNull();
    expect(item('Documents')).toHaveFocus();
    expect(item('Documents')).toHaveAttribute('tabindex', '0');
  });

  it('focus on an inner item lands on the item that collapsed, not on the inner parent', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    render(<Files defaultExpandedItems={['docs', 'work']} />);
    act(() => item('Report.docx').focus());

    fireEvent.click(chevronOf('Documents'));
    await act(async () => {});
    expect(item('Documents')).toHaveFocus();
    expect(wrapperOf('Work')).toHaveAttribute('data-presence', 'entered');
    await finish(motion);
    expect(item('Documents')).toHaveFocus();
  });

  it('focus outside the group (another item) stays where it is', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    render(<Files defaultExpandedItems={['docs']} />);
    act(() => item('Images').focus());

    fireEvent.click(chevronOf('Documents'));
    await act(async () => {});
    expect(wrapperOf('Documents')).toHaveAttribute('data-presence', 'exiting');
    expect(item('Images')).toHaveFocus();
    await finish(motion);
    expect(item('Images')).toHaveFocus();
  });
});

describe('checks while a group exits (selectionMode="multiple")', () => {
  it.each([
    ['while its group exits', false],
    ['with its group gone at once, as in 0.14', true],
  ])(
    'Space on a just-collapsed parent %s: the same aria-checked values and change',
    async (_, reduce) => {
      mockAnimations({ animated: isCollapse });
      mockMatchMedia({ '(prefers-reduced-motion: reduce)': reduce });
      const user = userEvent.setup();
      const onCheckedItemsChange = vi.fn();
      render(
        <Files
          selectionMode="multiple"
          defaultExpandedItems={['docs']}
          defaultCheckedItems={['report']}
          onCheckedItemsChange={onCheckedItemsChange}
        />,
      );
      expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
      expect(item('Work')).toHaveAttribute('aria-checked', 'true');

      act(() => item('Documents').focus());
      await user.keyboard('{ArrowLeft}');
      expect(wrapperOf('Documents')?.getAttribute('data-presence') ?? null).toBe(
        reduce ? null : 'exiting',
      );
      await user.keyboard(' ');

      expect(onCheckedItemsChange.mock.calls).toEqual([
        [
          ['docs', 'work', 'report', 'personal'],
          { value: 'docs', checked: true, event: expect.any(KeyboardEvent) },
        ],
      ]);
      expect(item('Documents')).toHaveAttribute('aria-checked', 'true');
      expect(item('Images')).toHaveAttribute('aria-checked', 'false');
      expect(item('Readme.md')).toHaveAttribute('aria-checked', 'false');
      if (!reduce) {
        // The exiting items agree with their parent.
        expect(item('Work')).toHaveAttribute('aria-checked', 'true');
        expect(item('Personal.txt')).toHaveAttribute('aria-checked', 'true');
      }

      // Expanded again, the group shows the cascade.
      await user.keyboard('{ArrowRight}');
      expect(item('Work')).toHaveAttribute('aria-checked', 'true');
      expect(item('Personal.txt')).toHaveAttribute('aria-checked', 'true');
    },
  );
});

describe('motion slot (D5, the slot table through Tree motion)', () => {
  const EXPANDED = ['docs', 'work'];
  const wrappers = () => [wrapperOf('Documents'), wrapperOf('Work')];

  it('undefined: the default motion on every nested group', () => {
    render(<Files defaultExpandedItems={EXPANDED} />);
    for (const wrapper of wrappers()) {
      expect(wrapper).toHaveClass(...motionClasses(collapseMotion));
    }
  });

  it('null: no motion; the structure and data-presence stay', () => {
    render(<Files defaultExpandedItems={EXPANDED} motion={null} />);
    for (const wrapper of wrappers()) {
      expectNoWordOf(wrapper, collapseMotion);
      expect(wrapper).toHaveClass(...motionClasses(collapseStructure));
      expect(wrapper).toHaveAttribute('data-presence', 'entered');
    }
  });

  it.each<[string, MotionSlot]>([
    ['a string', 'my-motion'],
    ['{ className }', { className: 'my-motion' }],
  ])('%s replaces the default motion on every nested group', (_, slot) => {
    render(<Files defaultExpandedItems={EXPANDED} motion={slot} />);
    for (const wrapper of wrappers()) {
      expect(wrapper).toHaveClass('my-motion', ...motionClasses(collapseStructure));
      expectNoWordOf(wrapper, collapseMotion);
    }
    const tree = screen.getByRole('tree', { name: 'Files' });
    expect(tree).toHaveClass(treeClassNames.root);
    expect(tree).not.toHaveAttribute('motion');
    expect(tree).not.toHaveClass('my-motion');
    expect(groupOf('Documents')).not.toHaveClass('my-motion');
  });

  it('the provider’s none drops the default motion; the Tree’s own motion still applies', () => {
    const { unmount } = renderWithProviders(<Files defaultExpandedItems={EXPANDED} />, {
      motion: 'none',
    });
    for (const wrapper of wrappers()) {
      expectNoWordOf(wrapper, collapseMotion);
      expect(wrapper).toHaveClass(...motionClasses(collapseStructure));
    }
    unmount();

    renderWithProviders(<Files defaultExpandedItems={EXPANDED} motion="my-motion" />, {
      motion: 'none',
    });
    for (const wrapper of wrappers()) expect(wrapper).toHaveClass('my-motion');
  });

  it('a nested Tree takes its own motion for its groups', async () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']} motion="outer-motion">
        <Tree.Item value="docs">
          Documents
          <Tree aria-label="Documents" defaultExpandedItems={['work']}>
            <Tree.Item value="work">
              Work
              <Tree.Item value="report">Report.docx</Tree.Item>
            </Tree.Item>
          </Tree>
        </Tree.Item>
      </Tree>,
    );
    // The roving stores observe the mounted items (a MutationObserver): let them settle.
    await act(async () => {});
    expect(wrapperOf('Documents')).toHaveClass('outer-motion');
    expect(wrapperOf('Work')).toHaveClass(...motionClasses(collapseMotion));
    expect(wrapperOf('Work')).not.toHaveClass('outer-motion');
  });
});

describe('the chevron (§5.2: not a motion slot)', () => {
  it.each([
    ['the provider’s none', { motion: 'none' as const }, undefined],
    ['the Tree’s motion={null}', {}, null],
  ])('keeps its own transition classes under %s', (_, options, motion) => {
    renderWithProviders(<Files defaultExpandedItems={['docs']} motion={motion} />, options);
    expect(chevronOf('Documents')).toHaveClass(
      'transition-transform',
      'motion-reduce:transition-none',
      'rotate-90',
    );
    expect(chevronOf('Images')).toHaveClass(
      'transition-transform',
      'motion-reduce:transition-none',
    );
  });
});

describe('server rendering (D9)', () => {
  const page = <Files defaultExpandedItems={['docs', 'work']} />;

  it('an expanded item’s wrapper is entered in the server HTML, and hydration logs nothing', async () => {
    const html = renderToString(page);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      const wrappers = Array.from(container.querySelectorAll('.' + treeItemClassNames.collapse));
      expect(wrappers).toHaveLength(2);
      for (const wrapper of wrappers) {
        expect(wrapper).toHaveAttribute('data-presence', 'entered');
        expect(wrapper).not.toHaveAttribute('inert');
        expect(wrapper).toHaveClass(
          ...motionClasses(collapseStructure),
          ...motionClasses(collapseMotion),
        );
        expect(wrapper.children).toHaveLength(1);
        expect(wrapper.firstElementChild).toHaveAttribute('role', 'group');
        expect(wrapper.parentElement).toHaveAttribute('role', 'treeitem');
      }

      await act(async () => {
        root = hydrateRoot(container, page, { onRecoverableError });
      });
      expect(Array.from(container.querySelectorAll('.' + treeItemClassNames.collapse))).toEqual(
        wrappers,
      );
      for (const wrapper of wrappers) expect(wrapper).toHaveAttribute('data-presence', 'entered');
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});
