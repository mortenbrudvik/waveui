import * as React from 'react';
import { describe, it, expect, vi, afterEach, onTestFinished } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { Tree, type TreeProps } from '../Tree';
import { Menu } from '../../navigation/Menu';
import { MenuButton } from '../../button/MenuButton';
import { treeItemClassNames } from '../../../lib/classNames';
import type { Slot } from '../../../lib/types';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

const item = (name: string) => screen.getByRole('treeitem', { name });
const button = (name: string) => screen.getByRole('button', { name });
const toolbar = (name: string) => screen.getByRole('toolbar', { name });
const rowOf = (name: string) => item(name).querySelector<HTMLElement>(':scope > [data-tree-row]')!;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Documents (expanded) › Work, and Readme.md; every row has actions. */
function Rows({ onRename, ...props }: Partial<TreeProps> & { onRename?: () => void }) {
  return (
    <>
      <button type="button">Before</button>
      <Tree aria-label="Files" defaultExpandedItems={['docs']} {...props}>
        <Tree.Item
          value="docs"
          actions={
            <>
              <button type="button" onClick={onRename}>
                Rename Documents
              </button>
              <button type="button">Delete Documents</button>
            </>
          }
        >
          Documents
          <Tree.Item value="work" actions={<button type="button">Rename Work</button>}>
            Work
          </Tree.Item>
        </Tree.Item>
        <Tree.Item value="readme" actions={<button type="button">Rename Readme</button>}>
          Readme.md
        </Tree.Item>
      </Tree>
      <button type="button">After</button>
    </>
  );
}

describe('Tree.Item - row content', () => {
  it('lays the row out as chevron, icon, label, iconAfter, then the aside and the actions at the end', () => {
    render(
      <Tree aria-label="Files">
        <Tree.Item
          value="docs"
          icon="📁"
          iconAfter={<svg data-testid="after" />}
          aside="3 files"
          actions={<button type="button">Rename Documents</button>}
        >
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    const [chevron, icon, label, after, end] = Array.from(rowOf('Documents').children);
    expect(chevron).toHaveClass(treeItemClassNames.expandIcon);
    expect(icon).toHaveClass(treeItemClassNames.icon);
    expect(label).toHaveClass(treeItemClassNames.label, 'min-w-0');
    expect(after).toHaveClass(treeItemClassNames.iconAfter);
    expect(after).toHaveAttribute('aria-hidden', 'true');
    expect(within(after as HTMLElement).getByTestId('after')).toBeInTheDocument();
    expect(end).toHaveAttribute('data-tree-end', '');
    const [aside, actions] = Array.from(end.children);
    expect(aside).toHaveClass(treeItemClassNames.aside);
    expect(aside).toHaveTextContent('3 files');
    expect(actions).toBe(toolbar('Documents'));
    expect(actions).toHaveClass(treeItemClassNames.actions);
    expect(item('Documents')).toHaveAccessibleName('Documents');
  });

  it.each<[string, Slot<'span'>]>([
    ["''", ''],
    ['0', 0],
    ['false', false],
    ['null', null],
    ['an empty array', []],
    ['an array of empty items', [null, '']],
  ])('renders no iconAfter span for %s, as for icon', (_name, iconAfter) => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="plain">Plain</Tree.Item>
        <Tree.Item value="empty" iconAfter={iconAfter}>
          Empty
        </Tree.Item>
      </Tree>,
    );
    expect(rowOf('Empty').children).toHaveLength(rowOf('Plain').children.length);
    expect(rowOf('Empty').querySelector(`.${treeItemClassNames.iconAfter}`)).toBeNull();
  });

  describe('expandIcon (optional indicator)', () => {
    const parent = (expandIcon: Slot<'span'> | undefined, expanded = false) =>
      render(
        <Tree aria-label="Files" defaultExpandedItems={expanded ? ['docs'] : []}>
          <Tree.Item value="docs" expandIcon={expandIcon}>
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
        </Tree>,
      );

    it.each<[string, Slot<'span'> | undefined]>([
      ['undefined', undefined],
      ['null', null],
    ])('%s keeps the default chevron', (_name, expandIcon) => {
      parent(expandIcon);
      const chevron = rowOf('Documents').children[0];
      expect(chevron.tagName.toLowerCase()).toBe('svg');
      expect(chevron).toHaveClass(treeItemClassNames.expandIcon, 'wave-rtl:-scale-x-100');
    });

    it('a custom glyph replaces it, decorative and not rotated', () => {
      parent(<span data-testid="glyph">+</span>, true);
      const glyph = rowOf('Documents').children[0];
      expect(glyph.tagName.toLowerCase()).toBe('span');
      expect(glyph).toHaveClass(treeItemClassNames.expandIcon);
      expect(glyph).toHaveAttribute('aria-hidden', 'true');
      expect(glyph).not.toHaveClass('rotate-90');
      expect(within(glyph as HTMLElement).getByTestId('glyph')).toBeInTheDocument();
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    });

    it.each<[string, Slot<'span'>]>([
      ['false', false],
      ["''", ''],
      ['an empty array', []],
    ])(
      '%s hides it; the column stays and aria-expanded still reports the state',
      (_name, expandIcon) => {
        parent(expandIcon);
        expect(rowOf('Documents').querySelector(`.${treeItemClassNames.expandIcon}`)).toBeNull();
        expect(rowOf('Documents').children[0]).toHaveAttribute('aria-hidden', 'true');
        expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
      },
    );

    it('a leaf ignores it', () => {
      render(
        <Tree aria-label="Files">
          <Tree.Item value="readme" expandIcon={<span>+</span>}>
            Readme.md
          </Tree.Item>
        </Tree>,
      );
      expect(rowOf('Readme.md').querySelector(`.${treeItemClassNames.expandIcon}`)).toBeNull();
    });
  });

  describe('aside', () => {
    it('describes the item, after a consumer description', () => {
      render(
        <>
          <Tree aria-label="Files">
            <Tree.Item value="docs" aside="3 files" aria-describedby="hint">
              Documents
            </Tree.Item>
          </Tree>
          <span id="hint">Shared</span>
        </>,
      );
      expect(item('Documents')).toHaveAccessibleDescription('Shared 3 files');
      expect(item('Documents')).toHaveAccessibleName('Documents');
    });

    it('gives way to the actions only where they share its place', () => {
      render(
        <Tree aria-label="Files">
          <Tree.Item
            value="docs"
            aside="3 files"
            actions={<button type="button">Rename Documents</button>}
          >
            Documents
          </Tree.Item>
          <Tree.Item value="readme" aside="New">
            Readme.md
          </Tree.Item>
        </Tree>,
      );
      const shared = rowOf('Documents').querySelector(`.${treeItemClassNames.aside}`)!;
      expect(shared).toHaveClass(
        'not-forced-colors:group-hover/row:invisible',
        '[@media(hover:hover)]:not-forced-colors:group-focus-within/end:invisible',
        '[@media(hover:hover)]:not-forced-colors:group-has-[[aria-expanded=true]]/end:invisible',
        '[@media(hover:hover)]:not-forced-colors:group-has-[[data-focus-in-popup]]/end:invisible',
      );
      expect(item('Documents')).toHaveClass(
        '[@media(hover:hover)]:not-forced-colors:[&:focus-within:not(:has(>*>[role=group]_:focus))>[data-tree-row]_[data-tree-aside]]:invisible',
      );
      expect(rowOf('Documents').querySelector('[data-tree-end]')).toHaveClass(
        'group/end',
        '[&>*]:[grid-area:1/1]',
        'forced-colors:flex',
        '[@media(hover:none)]:flex',
      );
      const alone = rowOf('Readme.md').querySelector(`.${treeItemClassNames.aside}`)!;
      expect(alone.className).not.toMatch(/invisible/);
      expect(item('Readme.md').className).not.toMatch(/data-tree-aside/);
      expect(item('Readme.md')).toHaveAccessibleDescription('New');
    });

    it('a click on the aside activates the item, as a click on its label does', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      render(
        <Tree aria-label="Files" onItemSelect={onItemSelect}>
          <Tree.Item value="docs" aside="3 files">
            Documents
          </Tree.Item>
        </Tree>,
      );
      await user.click(screen.getByText('3 files'));
      expect(onItemSelect.mock.calls).toEqual([['docs']]);
    });
  });
});

describe('Tree.Item - actions', () => {
  it('renders a toolbar named by the item, invisible until the row is hovered or the item or an action has focus', () => {
    render(<Rows />);
    const actions = toolbar('Documents');
    expect(actions).toHaveAttribute('aria-orientation', 'horizontal');
    expect(actions).toHaveAttribute('data-tree-actions', '');
    expect(actions).toHaveClass(
      treeItemClassNames.actions,
      'invisible',
      'group-hover/row:visible',
      'focus-within:visible',
      'forced-colors:visible',
      '[@media(hover:none)]:visible',
      // While a surface opened from an action is open, and while focus is in it: its focus return
      // must reach the action (E2-fix2 review).
      'has-[[aria-expanded=true]]:visible',
      'data-[focus-in-popup]:visible',
    );
    expect(rowOf('Documents')).toHaveClass('group/row');
    expect(item('Documents')).toHaveClass(
      '[&:focus-within:not(:has(>*>[role=group]_:focus))>[data-tree-row]_[data-tree-actions]]:visible',
    );
    // Not `:focus` on the item alone: Chromium ends it while focus moves from the item into an
    // action, so the hidden action refused the focus (E2b R6).
    expect(item('Documents').className).not.toMatch(/\[&:focus>/);
  });

  it('reveals an item’s actions for focus on the item or its own actions, never for a child item', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs', 'work']}>
        <Tree.Item value="docs" actions={<button type="button">Rename Documents</button>}>
          Documents
          <Tree.Item value="work" actions={<button type="button">Rename Work</button>}>
            Work
            <Tree.Item value="plan" actions={<button type="button">Rename Plan</button>}>
              Plan
            </Tree.Item>
          </Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    // The selector of the item's reveal variant as the browser reads it, taken from the
    // component's own class (the arbitrary variant, its underscores as spaces).
    const suffix = '>[data-tree-row]_[data-tree-actions]]:visible';
    const variant = Array.from(item('Documents').classList).find((name) => name.endsWith(suffix))!;
    const ownFocus = variant.slice('[&'.length, -suffix.length).replaceAll('_', ' ');
    // The child group is a grandchild of the item: it sits in its collapse element (0.15).
    expect(ownFocus).toBe(':focus-within:not(:has(>*>[role=group] :focus))');
    const shown = () =>
      ['Documents', 'Work', 'Plan'].filter((name) => item(name).matches(ownFocus));
    act(() => item('Documents').focus());
    expect(shown()).toEqual(['Documents']);
    act(() => button('Rename Documents').focus());
    expect(shown()).toEqual(['Documents']);
    act(() => item('Work').focus());
    expect(shown()).toEqual(['Work']);
    act(() => button('Rename Work').focus());
    expect(shown()).toEqual(['Work']);
    // A grandchild: neither its parent nor its grandparent.
    act(() => item('Plan').focus());
    expect(shown()).toEqual(['Plan']);
    act(() => button('Rename Plan').focus());
    expect(shown()).toEqual(['Plan']);
  });

  describe('focus in a surface opened from an action', () => {
    /** An action that renders a popup button into a portal, as a Menu, Popover or Dialog does. */
    function PortalAction() {
      return (
        <>
          <button type="button">Open</button>
          {createPortal(<button type="button">In popup</button>, document.body)}
        </>
      );
    }

    function PortalRows() {
      return (
        <>
          <Tree aria-label="Files">
            <Tree.Item value="docs" actions={<PortalAction />}>
              Documents
            </Tree.Item>
          </Tree>
          <button type="button">Elsewhere</button>
        </>
      );
    }

    it('keeps the toolbar shown while focus is in the popup, so the focus return reaches the action', () => {
      render(<PortalRows />);
      const actions = toolbar('Documents');
      act(() => button('Open').focus());
      expect(actions).not.toHaveAttribute('data-focus-in-popup');
      act(() => button('In popup').focus());
      expect(actions).toHaveAttribute('data-focus-in-popup', '');
      // The popup's close returns focus to its trigger: the hold ends.
      act(() => button('Open').focus());
      expect(actions).not.toHaveAttribute('data-focus-in-popup');
    });

    it('ends the hold on the next frame once focus has left the popup for somewhere else', async () => {
      render(<PortalRows />);
      const actions = toolbar('Documents');
      act(() => button('In popup').focus());
      expect(actions).toHaveAttribute('data-focus-in-popup', '');
      act(() => button('Elsewhere').focus());
      // Still held in this task: a close returning focus to the trigger comes before the frame.
      expect(actions).toHaveAttribute('data-focus-in-popup', '');
      await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      expect(actions).not.toHaveAttribute('data-focus-in-popup');
    });

    it('a Menu opened from an action: held while open, released once focus is back on its trigger', async () => {
      const user = userEvent.setup();
      render(
        <Tree aria-label="Files" navigationMode="treegrid">
          <Tree.Item
            value="docs"
            actions={
              <Menu>
                <Menu.Trigger>
                  <MenuButton size="small" aria-label="More" />
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.Popover>
              </Menu>
            }
          >
            Documents
          </Tree.Item>
        </Tree>,
      );
      const actions = toolbar('Documents');
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(button('More')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
      expect(button('More')).toHaveAttribute('aria-expanded', 'true');
      expect(actions).toHaveAttribute('data-focus-in-popup', '');
      // The hold is still on when the close's focus return reaches the trigger (the trigger
      // already reports the menu closed then), so the action can take focus.
      const onReturn: [hold: string | null, expanded: string | null][] = [];
      const more = button('More');
      const recordHold = () => {
        onReturn.push([
          actions.getAttribute('data-focus-in-popup'),
          more.getAttribute('aria-expanded'),
        ]);
      };
      more.addEventListener('focus', recordHold);
      onTestFinished(() => more.removeEventListener('focus', recordHold));
      await user.keyboard('{Escape}');
      expect(onReturn).not.toHaveLength(0);
      for (const entry of onReturn) expect(entry).toEqual(['', 'false']);
      expect(button('More')).toHaveFocus();
      expect(actions).not.toHaveAttribute('data-focus-in-popup');
    });
  });

  it.each<[string, React.ReactNode]>([
    ['[]', []],
    ['false', false],
    ['<></>', <></>],
    ["[null, '']", [null, '']],
  ])('renders no toolbar, end cell or visibility classes for actions=%s', (_name, actions) => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="a" actions={actions}>
          Alpha
        </Tree.Item>
        <Tree.Item value="b">Beta</Tree.Item>
      </Tree>,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(rowOf('Alpha').querySelector('[data-tree-end]')).toBeNull();
    expect(rowOf('Alpha').children).toHaveLength(rowOf('Beta').children.length);
    expect(item('Alpha').className).toBe(item('Beta').className);
    expect(rowOf('Alpha')).not.toHaveClass('group/row');
  });

  it('tree mode: Tab from the focused item enters its actions (one stop), the arrows move inside with wrapping, Shift+Tab returns, Tab leaves', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    for (const name of ['Rename Documents', 'Delete Documents', 'Rename Work', 'Rename Readme']) {
      expect(button(name)).toHaveAttribute('tabindex', '-1');
    }
    act(() => item('Documents').focus());
    expect(button('Rename Documents')).toHaveAttribute('tabindex', '0');
    expect(button('Delete Documents')).toHaveAttribute('tabindex', '-1');
    expect(button('Rename Work')).toHaveAttribute('tabindex', '-1');
    expect(button('Rename Readme')).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.tab({ shift: true });
    expect(item('Documents')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(button('After')).toHaveFocus();
    // Focus left the tree: no toolbar keeps a Tab stop.
    expect(button('Rename Documents')).toHaveAttribute('tabindex', '-1');
  });

  it('the arrow keys move between items, never into a row actions', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Readme.md')).toHaveFocus();
  });

  it('ArrowDown and ArrowUp on an action move to the next and previous item', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    act(() => item('Documents').focus());
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
    act(() => item('Readme.md').focus());
    await user.tab();
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('Work')).toHaveFocus();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])(
    '%s on an action runs only the action: no activation, expansion or check toggle',
    async (_name, key) => {
      const user = userEvent.setup();
      const onRename = vi.fn();
      const onItemSelect = vi.fn();
      const onCheckedItemsChange = vi.fn();
      render(
        <Rows
          onRename={onRename}
          onItemSelect={onItemSelect}
          selectionMode="multiple"
          onCheckedItemsChange={onCheckedItemsChange}
        />,
      );
      act(() => item('Documents').focus());
      await user.tab();
      expect(button('Rename Documents')).toHaveFocus();
      await user.keyboard(key);
      expect(onRename).toHaveBeenCalledTimes(1);
      expect(onItemSelect).not.toHaveBeenCalled();
      expect(onCheckedItemsChange).not.toHaveBeenCalled();
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    },
  );

  it('a click on an action runs only the action', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onItemSelect = vi.fn();
    render(<Rows onRename={onRename} onItemSelect={onItemSelect} />);
    await user.click(button('Rename Documents'));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('a click on an action in another row makes that row the active item: its actions take the Tab stop and Shift+Tab returns to it', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    act(() => item('Documents').focus());
    expect(button('Rename Documents')).toHaveAttribute('tabindex', '0');
    await user.click(button('Rename Readme'));
    expect(button('Rename Readme')).toHaveFocus();
    expect(button('Rename Readme')).toHaveAttribute('tabindex', '0');
    expect(button('Rename Documents')).toHaveAttribute('tabindex', '-1');
    await user.tab({ shift: true });
    expect(item('Readme.md')).toHaveFocus();
  });

  it('a click on an action changes no check in a checkbox tree', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    render(
      <Rows
        selectionMode="multiple"
        defaultCheckedItems={['readme']}
        onCheckedItemsChange={onCheckedItemsChange}
      />,
    );
    await user.click(button('Rename Documents'));
    await user.click(button('Rename Readme'));
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'true');
    expect(item('Documents')).toHaveAttribute('aria-checked', 'false');
  });

  describe('a focused action that disappears while its item stays', () => {
    const Dynamic = ({ actions }: { actions: React.ReactNode }) => (
      <>
        <Tree aria-label="Files">
          <Tree.Item value="readme" actions={actions}>
            Readme.md
          </Tree.Item>
        </Tree>
        <button type="button">After</button>
      </>
    );

    it('moves focus to the item when the actions go away', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Dynamic actions={<button type="button">Rename Readme</button>} />,
      );
      act(() => item('Readme.md').focus());
      await user.tab();
      expect(button('Rename Readme')).toHaveFocus();
      rerender(<Dynamic actions={false} />);
      expect(item('Readme.md')).toHaveFocus();
    });

    it('moves focus to the item when the focused action is removed from the others', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Dynamic
          actions={[
            <button key="rename" type="button">
              Rename Readme
            </button>,
            <button key="delete" type="button">
              Delete Readme
            </button>,
          ]}
        />,
      );
      act(() => item('Readme.md').focus());
      await user.tab();
      expect(button('Rename Readme')).toHaveFocus();
      rerender(
        <Dynamic
          actions={[
            <button key="delete" type="button">
              Delete Readme
            </button>,
          ]}
        />,
      );
      expect(item('Readme.md')).toHaveFocus();
      await act(async () => {});
    });

    it('leaves focus alone when the action was blurred to the page before it went away', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Dynamic actions={<button type="button">Rename Readme</button>} />,
      );
      act(() => item('Readme.md').focus());
      await user.tab();
      expect(button('Rename Readme')).toHaveFocus();
      act(() => button('Rename Readme').blur());
      rerender(<Dynamic actions={false} />);
      expect(document.body).toHaveFocus();
    });

    it('does not jump to the item on a later render once focus has been elsewhere', async () => {
      const user = userEvent.setup();
      let hide: () => void = () => {};
      function SelfHiding() {
        const [shown, setShown] = React.useState(true);
        React.useEffect(() => {
          hide = () => setShown(false);
        }, []);
        return shown ? <button type="button">Rename Readme</button> : null;
      }
      const ui = (note: string) => (
        <>
          <Tree aria-label="Files">
            <Tree.Item value="readme" actions={<SelfHiding />} data-note={note}>
              Readme.md
            </Tree.Item>
          </Tree>
          <button type="button">After</button>
        </>
      );
      const { rerender } = render(ui('a'));
      act(() => item('Readme.md').focus());
      await user.tab();
      expect(button('Rename Readme')).toHaveFocus();
      // The action removes itself: only SelfHiding re-renders, the item does not.
      act(() => hide());
      expect(document.body).toHaveFocus();
      await user.click(button('After'));
      rerender(ui('b'));
      expect(button('After')).toHaveFocus();
      await user.click(document.body);
      rerender(ui('c'));
      expect(document.body).toHaveFocus();
    });

    it('leaves focus alone when it was not in the actions', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Dynamic actions={<button type="button">Rename Readme</button>} />,
      );
      await user.click(button('After'));
      rerender(<Dynamic actions={false} />);
      expect(button('After')).toHaveFocus();
    });
  });

  it('* and a letter pressed on an action do nothing to the tree; * on the item still expands its siblings', async () => {
    const user = userEvent.setup();
    render(<Rows defaultExpandedItems={[]} />);
    act(() => item('Readme.md').focus());
    await user.tab();
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard('*');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('d');
    expect(button('Rename Readme')).toHaveFocus();
    act(() => item('Readme.md').focus());
    await user.keyboard('*');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('ArrowDown on a MenuButton action opens its menu instead of moving to the next item', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files">
        <Tree.Item
          value="readme"
          actions={
            <Menu>
              <Menu.Trigger>
                <MenuButton>More for Readme</MenuButton>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Delete</Menu.Item>
              </Menu.Popover>
            </Menu>
          }
        >
          Readme.md
        </Tree.Item>
        <Tree.Item value="notes">Notes.md</Tree.Item>
      </Tree>,
    );
    act(() => item('Readme.md').focus());
    await user.tab();
    expect(button('More for Readme')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(button('More for Readme')).toHaveFocus();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('RTL: the arrows inside the actions are mirrored', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Rows />, { dir: 'rtl' });
    act(() => item('Documents').focus());
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(button('Delete Documents')).toHaveFocus();
  });

  it('StrictMode: one Tab stop per toolbar, on the focused item only', () => {
    render(
      <React.StrictMode>
        <Rows />
      </React.StrictMode>,
    );
    act(() => item('Documents').focus());
    const stops = screen
      .getAllByRole('button')
      .filter((el) => el.closest('[data-tree-actions]') && el.tabIndex === 0);
    expect(stops).toEqual([button('Rename Documents')]);
  });

  it('has no accessibility violations with actions and an aside', async () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Tree.Item
          value="docs"
          aside="2 files"
          actions={<button type="button">Rename Documents</button>}
        >
          Documents
          <Tree.Item value="work" actions={<button type="button">Rename Work</button>}>
            Work
          </Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await expectNoA11yViolations();
  });
});

describe('Tree - navigationMode="treegrid"', () => {
  it('gives no action a Tab stop: Tab from the focused item leaves the tree', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Documents').focus());
    for (const name of ['Rename Documents', 'Delete Documents', 'Rename Work', 'Rename Readme']) {
      expect(button(name)).toHaveAttribute('tabindex', '-1');
    }
    await user.tab();
    expect(button('After')).toHaveFocus();
  });

  it('"next" expands a collapsed parent, then moves into its actions, not to its first child; the arrows walk the actions without wrapping; "previous" on the first action returns', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" defaultExpandedItems={[]} />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Delete Documents')).toHaveFocus();
    // The last action: "next" does nothing, and is still taken (default prevented).
    expect(fireEvent.keyDown(button('Delete Documents'), { key: 'ArrowRight' })).toBe(false);
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Documents')).toHaveFocus();
  });

  it('a leaf with actions: "next" moves into them', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Readme')).toHaveFocus();
  });

  it('Home and End move to the first and last action, not to the first and last item', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{End}');
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(button('Rename Documents')).toHaveFocus();
  });

  it('ArrowDown and ArrowUp on an action focus the next and previous visible item', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowUp}');
    expect(item('Work')).toHaveFocus();
  });

  it('a row without actions behaves as in tree mode: "next" on an open parent moves to its first child', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files" navigationMode="treegrid" defaultExpandedItems={['docs']}>
        <Tree.Item value="docs" actions={false}>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Work')).toHaveFocus();
  });

  it('Enter on an action never activates the item, and letters typed there are no typeahead', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onItemSelect = vi.fn();
    render(<Rows navigationMode="treegrid" onRename={onRename} onItemSelect={onItemSelect} />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onItemSelect).not.toHaveBeenCalled();
    await user.keyboard('w');
    expect(button('Rename Documents')).toHaveFocus();
  });

  it('skips a disabled first action: "next" lands on the first enabled one, and "previous" there returns', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files" navigationMode="treegrid">
        <Tree.Item
          value="readme"
          actions={
            <>
              <button type="button" disabled>
                Locked
              </button>
              <button type="button">Rename Readme</button>
            </>
          }
        >
          Readme.md
        </Tree.Item>
      </Tree>,
    );
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Readme.md')).toHaveFocus();
  });

  it('RTL: ArrowLeft moves into the actions and ArrowRight on the first action returns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Rows navigationMode="treegrid" />, { dir: 'rtl' });
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowLeft}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(item('Documents')).toHaveFocus();
  });

  it('keeps the tree roles', () => {
    render(<Rows navigationMode="treegrid" />);
    expect(screen.getByRole('tree', { name: 'Files' })).toBeInTheDocument();
    expect(screen.queryByRole('treegrid')).toBeNull();
    expect(item('Documents')).toHaveAttribute('role', 'treeitem');
  });
});

describe('Tree - navigationMode="treegrid" (fix round)', () => {
  it('an action hidden by CSS is skipped: "next" lands on the first visible action and "previous" there returns', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files" navigationMode="treegrid">
        <Tree.Item
          value="readme"
          actions={
            <>
              <button type="button" style={{ display: 'none' }}>
                Responsive
              </button>
              <button type="button">Rename Readme</button>
            </>
          }
        >
          Readme.md
        </Tree.Item>
      </Tree>,
    );
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Readme.md')).toHaveFocus();
  });

  it('an action inside a closed details element is skipped by the shared roving rule', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files" navigationMode="treegrid">
        <Tree.Item
          value="readme"
          actions={
            <>
              <details>
                <summary>More</summary>
                <button type="button">Inside details</button>
              </details>
              <button type="button">Rename Readme</button>
            </>
          }
        >
          Readme.md
        </Tree.Item>
      </Tree>,
    );
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Readme')).toHaveFocus();
  });

  it('Space and * on an action change no check, selection or expansion', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onItemSelect = vi.fn();
    render(
      <Rows
        navigationMode="treegrid"
        defaultExpandedItems={[]}
        selectionMode="multiple"
        onCheckedItemsChange={onCheckedItemsChange}
        onItemSelect={onItemSelect}
      />,
    );
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard(' ');
    await user.keyboard('*');
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
  });

  it('Space on an action changes nothing in a single-select tree', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    render(
      <Rows
        navigationMode="treegrid"
        selectionMode="single"
        selected={null}
        onItemSelect={onItemSelect}
      />,
    );
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');
    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('a nested item: "next" enters its actions and "previous" returns to it, not to its parent', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Work').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Work')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Work')).toHaveFocus();
  });
});
