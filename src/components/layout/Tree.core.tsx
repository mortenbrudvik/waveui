import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { treeClassNames, treeItemClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import { isHiddenInput } from '../../lib/focus';
import { CheckIcon, ChevronRightIcon, SubtractIcon } from '../../lib/icons';
import type { SelectionMode } from '../../lib/types';
import { materialiseSlotContent, renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { isHiddenByCss, useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import {
  TreeCheckForcedContext,
  TreeContext,
  TreeItemContext,
  TreeLabelContext,
  TreeParentContext,
  useTreeContext,
  type PersonaLayoutIds,
  type TreeContextValue,
  type TreeItemContextValue,
  type TreeSelectionEntry,
} from './Tree.context';
import {
  collectItems,
  computeCheckStates,
  toggleCheck,
  type CheckState,
  type TreeNode,
} from './Tree.selection';

const EMPTY: readonly string[] = [];

const ITEM_IN_LABEL_MESSAGE =
  'Tree.Item was rendered inside the label of another Tree.Item, so it is not part of that ' +
  "item's child group: the parent cannot expand, its name includes the nested text, and a " +
  'treeitem sits inside a label (axe aria-required-parent). A Tree.Item finds its nested items ' +
  'among its own children (written directly, in Fragments, or returned by a render function such ' +
  'as `children.map(renderNode)`), but not inside a component that renders Tree.Item itself. ' +
  'Build a data-driven tree with a render function instead of a recursive component.';

function warnDuplicateValue(value: string): void {
  warnOnce(
    `Tree:duplicate:${value}`,
    `Tree: several items share the value "${value}". Item values must be unique within a Tree; ` +
      'items with the same value share their expanded, selected and focus state.',
  );
}

const SELECTED_WITH_MULTIPLE_MESSAGE =
  'Tree: `selected` has no effect with selectionMode="multiple"; use `checkedItems`, and ' +
  '`current` for the item the user is on.';

const CHECKED_WITHOUT_MULTIPLE_MESSAGE =
  'Tree: `checkedItems` and `defaultCheckedItems` need selectionMode="multiple"; without it the ' +
  'tree draws no checkboxes and ignores them.';

const SINGLE_WITHOUT_SELECTED_MESSAGE =
  'Tree: selectionMode="single" draws a radio on every item for `selected`; pass `selected` ' +
  '(null while nothing is selected) and update it from `onItemSelect`.';

/** The registered top-level subtrees in document order, which is the tree order of their items. */
function forestInTreeOrder(
  entries: ReadonlySet<React.RefObject<TreeSelectionEntry | null>> | null,
): TreeNode[] {
  if (!entries) return [];
  return Array.from(entries, (entry) => entry.current)
    .filter((entry): entry is TreeSelectionEntry => entry !== null)
    .sort((a, b) => {
      if (!a.element || !b.element || a.element === b.element) return 0;
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    })
    .map((entry) => entry.node);
}

/**
 * The tree's own items for the tab stop and the arrow keys: the treeitems. A row's actions are a
 * roving container of their own, which the default selector would count as one more item.
 */
const TREE_ITEM_SELECTOR = '[role="treeitem"]';

/** Every focusable control a row's actions can hold (Toolbar's rule). */
const ACTION_ITEM_SELECTOR = 'button, [href], input, select, textarea, [role="button"], [tabindex]';

/** Shows a row's actions while its item has focus (`:focus`, also after a click, so Tab reaches them). */
const ACTIONS_ON_ITEM_FOCUS = '[&:focus>[data-tree-row]_[data-tree-actions]]:visible';

/** Makes the aside invisible while its item has focus, where the actions take its place. */
const ASIDE_OFF_ON_ITEM_FOCUS =
  '[@media(hover:hover)]:not-forced-colors:[&:focus>[data-tree-row]_[data-tree-aside]]:invisible';

/**
 * The actions stay invisible until the row is hovered or the item or an action has focus, and
 * always show in forced colors and without hover (touch). An invisible action takes no focus.
 */
const ACTIONS_VISIBILITY =
  'invisible group-hover/row:visible focus-within:visible forced-colors:visible [@media(hover:none)]:visible';

/** The aside gives way to the actions where the two share one place. */
const ASIDE_OFF_WITH_ACTIONS =
  'not-forced-colors:group-hover/row:invisible [@media(hover:hover)]:not-forced-colors:group-focus-within/end:invisible';

/** Aside and actions share one cell, and sit side by side where the actions always show. */
const END_CELL_SHARED = '[&>*]:[grid-area:1/1] forced-colors:flex [@media(hover:none)]:flex';

/**
 * Focuses the first action of an item's own row that takes focus, trying them in order and
 * skipping what the roving hook skips: natively disabled, marked `data-roving-disabled`,
 * `aria-disabled` unless focusable-disabled, hidden form inputs, anything inside a `hidden` or
 * `inert` element of the toolbar, and what CSS hides (the hook's own `isHiddenByCss`). `false` when
 * focus did not move into the row's actions.
 */
function focusFirstAction(item: HTMLElement): boolean {
  const toolbar = item.querySelector<HTMLElement>(':scope > [data-tree-row] [data-tree-actions]');
  if (!toolbar) return false;
  const cssHidden = new Map<Element, boolean>();
  for (const el of Array.from(toolbar.querySelectorAll<HTMLElement>(ACTION_ITEM_SELECTOR))) {
    if (isHiddenInput(el) || el.matches(':disabled')) continue;
    const concealed = el.closest('[hidden], [inert]');
    if (concealed && toolbar.contains(concealed)) continue;
    const marker = el.getAttribute('data-roving-disabled');
    if (marker !== null && marker !== 'false') continue;
    if (
      el.getAttribute('aria-disabled') === 'true' &&
      !el.hasAttribute('data-disabled-focusable')
    ) {
      continue;
    }
    if (isHiddenByCss(el, toolbar, cssHidden)) continue;
    el.focus();
    if (el.ownerDocument.activeElement === el) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Tree                                                               */
/* ------------------------------------------------------------------ */

/** The second argument of `onCheckedItemsChange`. */
export interface TreeCheckedItemsChangeDetails {
  /** The item that was toggled. */
  value: string;
  /** Its new state (a toggle never leaves it mixed). */
  checked: boolean;
  /** The DOM event of the toggle: a keyboard event for Space, a mouse event for a click. */
  event: Event;
}

/** Properties for the Tree component. */
export interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled list of expanded item values. */
  expandedItems?: readonly string[];
  /**
   * Item values that are expanded initially (uncontrolled).
   * @default []
   */
  defaultExpandedItems?: readonly string[];
  /** Called with the new list of expanded item values when an item expands or collapses. */
  onExpandedItemsChange?: (expandedItems: string[]) => void;
  /**
   * Called with an item's value every time it is activated (a click on its row, Enter, or Space
   * unless the tree has checkboxes), also when the same item is activated again.
   */
  onItemSelect?: (value: string) => void;
  /**
   * Value of the selected item. When set (also to `null`), every item carries `aria-selected`, and
   * the selected item is where keyboard focus enters the tree. It has no effect with
   * `selectionMode="multiple"` (a development warning): items carry `aria-checked` instead. With
   * `selectionMode="single"` every item carries `aria-selected` even while it is not set (a
   * development warning: the radios need it).
   */
  selected?: string | null;
  /** Value of the current item (for example the open page): it gets `aria-current="true"`. */
  current?: string | null;
  /**
   * How items are selected. `'none'`: activation only (0.7; `selected` highlights one item).
   * `'single'`: a radio indicator on every item for `selected`/`onItemSelect`. `'multiple'`: a
   * checkbox on every item, bound to `checkedItems`; checking an item checks its descendants, and a
   * parent shows checked, mixed or unchecked from them. Fluent's `'multiselect'` is `'multiple'`.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
  /** Controlled checked items (`selectionMode="multiple"`); see the cascade rule in the component docs. */
  checkedItems?: readonly string[];
  /**
   * Initially checked items (uncontrolled).
   * @default []
   */
  defaultCheckedItems?: readonly string[];
  /**
   * Called with every checked item (in tree order) when a check changes (Fluent's `onCheckedChange`).
   * WaveUI always passes `details`; it is typed optional until 1.0.
   */
  onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void;
  /**
   * `'tree'`: Tab from a focused item enters its actions. `'treegrid'`: the "next" arrow
   * (ArrowRight, ArrowLeft in RTL) moves into an item's actions and "previous" returns; on an
   * expanded parent "next" no longer moves to the first child (ArrowDown does). The roles stay
   * `tree` and `treeitem` (Fluent's `navigationMode`).
   * @default 'tree'
   */
  navigationMode?: 'tree' | 'treegrid';
  /** Ref to the `role="tree"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

export const TreeRoot = ({
  expandedItems,
  defaultExpandedItems,
  onExpandedItemsChange,
  onItemSelect,
  selected,
  current,
  selectionMode = 'none',
  navigationMode = 'tree',
  checkedItems,
  defaultCheckedItems,
  onCheckedItemsChange,
  className,
  children,
  onKeyDown,
  onKeyDownCapture,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TreeProps) => {
  const [initialExpanded] = React.useState<readonly string[]>(() => defaultExpandedItems ?? EMPTY);
  const [expandedList, setExpandedList] = useControllable<readonly string[]>(
    expandedItems,
    initialExpanded,
    (next) => onExpandedItemsChange?.([...next]),
  );
  const expanded = React.useMemo(() => new Set(expandedList), [expandedList]);

  const toggle = React.useCallback(
    (value: string) => {
      setExpandedList((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
    },
    [setExpandedList],
  );

  const expand = React.useCallback(
    (values: readonly string[]) => {
      setExpandedList((prev) => {
        const added = values.filter((v) => !prev.includes(v));
        return added.length > 0 ? [...prev, ...added] : prev;
      });
    },
    [setExpandedList],
  );

  const activate = useEventCallback((value: string) => {
    onItemSelect?.(value);
  });

  // Checked items (`selectionMode="multiple"`). useControllable passes the value only, so a toggle
  // hands `details` to the change callback through a ref it writes and clears in the same event.
  const [initialChecked] = React.useState<readonly string[]>(() => defaultCheckedItems ?? EMPTY);
  const pendingDetails = React.useRef<TreeCheckedItemsChangeDetails | undefined>(undefined);
  const [checkedList, setCheckedList] = useControllable<readonly string[]>(
    checkedItems,
    initialChecked,
    (next) => onCheckedItemsChange?.([...next], pendingDetails.current),
  );
  const checked = React.useMemo(() => new Set(checkedList), [checkedList]);

  // The top-level items' subtrees (each item scans its own children), read when a check toggles:
  // they give the emitted list its tree order.
  const topLevel = React.useRef<Set<React.RefObject<TreeSelectionEntry | null>> | null>(null);
  const registerTopLevel = React.useCallback(
    (entry: React.RefObject<TreeSelectionEntry | null>) => {
      topLevel.current ??= new Set();
      const entries = topLevel.current;
      entries.add(entry);
      return () => {
        entries.delete(entry);
      };
    },
    [],
  );
  const toggleChecked = useEventCallback((value: string, event: Event) => {
    const forest = forestInTreeOrder(topLevel.current);
    setCheckedList((previous) => {
      const next = toggleCheck(forest, previous, value);
      pendingDetails.current = { value, checked: next.includes(value), event };
      return next;
    });
    pendingDetails.current = undefined;
  });

  // An item carries aria-checked or aria-selected, never both (APG); in single mode every item
  // carries aria-selected from the first render, so the radios and the state agree.
  const effectiveSelected =
    selectionMode === 'multiple'
      ? undefined
      : selectionMode === 'single'
        ? (selected ?? null)
        : selected;

  React.useEffect(() => {
    if (selectionMode === 'multiple' && selected !== undefined) {
      warnOnce('Tree:selected-with-multiple', SELECTED_WITH_MULTIPLE_MESSAGE);
    }
  }, [selectionMode, selected]);
  React.useEffect(() => {
    if (selectionMode === 'single' && selected === undefined) {
      warnOnce('Tree:single-without-selected', SINGLE_WITHOUT_SELECTED_MESSAGE);
    }
  }, [selectionMode, selected]);
  const hasCheckedProps = checkedItems !== undefined || defaultCheckedItems !== undefined;
  React.useEffect(() => {
    if (selectionMode !== 'multiple' && hasCheckedProps) {
      warnOnce('Tree:checked-without-multiple', CHECKED_WITHOUT_MULTIPLE_MESSAGE);
    }
  }, [selectionMode, hasCheckedProps]);

  // The item that has focus while focus is inside the tree: it holds the tab stop, so Shift+Tab
  // leaves the tree. Cleared when focus leaves; the next entry goes to `selected`, else the first.
  const [focusedItem, setFocusedItem] = React.useState<string | null>(null);

  // How many mounted items carry each value (written from the items' effects only).
  const valueCounts = React.useRef<Map<string, number> | null>(null);
  const registerValue = React.useCallback((value: string) => {
    if (!isDev) return () => {};
    valueCounts.current ??= new Map();
    const counts = valueCounts.current;
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > 1) warnDuplicateValue(value);
    return () => {
      const remaining = (counts.get(value) ?? 1) - 1;
      if (remaining > 0) counts.set(value, remaining);
      else counts.delete(value);
    };
  }, []);

  const { containerProps, getTabIndex, focusValue } = useRovingTabIndex({
    activeValue: focusedItem ?? effectiveSelected ?? null,
    itemSelector: TREE_ITEM_SELECTOR,
    orientation: 'vertical',
    loop: false,
    typeahead: true,
  });

  const context = React.useMemo<TreeContextValue>(
    () => ({
      expanded,
      toggle,
      expand,
      activate,
      selected: effectiveSelected,
      current,
      getTabIndex,
      focusValue,
      onItemFocus: setFocusedItem,
      focusedItem,
      navigationMode,
      registerValue,
      selectionMode,
      checked,
      toggleChecked,
      registerTopLevel,
    }),
    [
      expanded,
      toggle,
      expand,
      activate,
      effectiveSelected,
      current,
      getTabIndex,
      focusValue,
      focusedItem,
      navigationMode,
      registerValue,
      selectionMode,
      checked,
      toggleChecked,
      registerTopLevel,
    ],
  );

  const mergedRef = useMergedRefs<HTMLDivElement>(ref, containerProps.ref);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Typeahead reads `data-roving-text` at key time: fill it from each item's label first.
    if (event.key.length === 1) syncTypeaheadText(event.currentTarget);
    containerProps.onKeyDown(event);
  };

  // A Space that continues a search is typeahead too, taken before the item would activate on it.
  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ') syncTypeaheadText(event.currentTarget);
    containerProps.onKeyDownCapture(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !event.currentTarget.contains(next)) setFocusedItem(null);
  };

  return (
    <TreeContext.Provider value={context}>
      <TreeParentContext.Provider value={null}>
        <TreeCheckForcedContext.Provider value={false}>
          <div
            role="tree"
            data-selection-mode={selectionMode}
            aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
            className={cn(treeClassNames.root, 'text-body-1', className)}
            {...rest}
            data-roving-container=""
            onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
            onKeyDownCapture={composeEventHandlers(onKeyDownCapture, handleKeyDownCapture)}
            onFocus={composeEventHandlers(onFocus, containerProps.onFocus, {
              checkDefaultPrevented: false,
            })}
            onBlur={composeEventHandlers(onBlur, handleBlur, { checkDefaultPrevented: false })}
            ref={mergedRef}
          >
            {/* A Tree has its own items, also when it renders inside a label (a portaled popup). */}
            <TreeLabelContext.Provider value={false}>{children}</TreeLabelContext.Provider>
          </div>
        </TreeCheckForcedContext.Provider>
      </TreeParentContext.Provider>
    </TreeContext.Provider>
  );
};
TreeRoot.displayName = 'Tree';

/* ------------------------------------------------------------------ */
/*  Tree.Item                                                          */
/* ------------------------------------------------------------------ */

/** Properties for the TreeItem sub-component. */
export interface TreeItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique value identifying this tree item. */
  value: string;
  /**
   * Icon displayed before the label. Rendered in a `<span>` hidden from assistive technology
   * (`aria-hidden`); pass a slot object (`{ className, children, … }`) to customise it. A falsy
   * icon (`''`, `0`) or a list of nothing renders no span.
   */
  icon?: Slot<'span'>;
  /** Icon after the label (decorative, `aria-hidden`; a falsy value renders nothing, as `icon`). */
  iconAfter?: Slot<'span'>;
  /**
   * Replaces the expand chevron (decorative). `null`/`undefined` keep the chevron; `false`, or
   * anything that renders nothing, hides it (`aria-expanded` still reports the state). Not rotated.
   */
  expandIcon?: Slot<'span'>;
  /**
   * Non-interactive content at the end of the row, such as a count or a badge. It describes the item
   * (`aria-describedby`); it hides while the actions show on hover or focus.
   */
  aside?: React.ReactNode;
  /**
   * Buttons at the end of the row (a toolbar named by the item's label). Shown while the row is
   * hovered or the item or its actions have focus, and always in forced colors and without hover
   * (touch). Tab reaches them from the focused item (`navigationMode="tree"`), or the arrow keys do
   * (`"treegrid"`). Keys and clicks on them never activate or check the item.
   */
  actions?: React.ReactNode;
  /**
   * Renders the item as a leaf even when it has nested `Tree.Item`s: they are not rendered, and
   * the item has no `aria-expanded` and does not expand. An item is expandable only while it has
   * nested items, so `leaf={false}` does not make an item without them expandable. To load the
   * children on first expansion, give the item a placeholder child (a "Loading…" `Tree.Item`)
   * until they arrive.
   * @default false
   */
  leaf?: boolean;
  /** Ref to the `role="treeitem"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Sets the typeahead text (`data-roving-text`, read by the roving hook) of every rendered
 * treeitem to the text of its label (a persona layout's name when the label holds one), so neither the icon nor the nested items take part. A
 * consumer `data-roving-text` on a Tree.Item is kept on its label and wins.
 */
function syncTypeaheadText(tree: HTMLElement): void {
  tree.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((treeitem) => {
    const label = treeitem.querySelector<HTMLElement>(
      ':scope > [data-tree-row] > [data-tree-label]',
    );
    if (!label) return;
    // A persona layout's name is the item's name, so it is its typeahead text too (not the media,
    // such as an avatar's initials, or the description).
    const personaName = label.querySelector<HTMLElement>('[data-tree-persona-name]');
    const text =
      label.getAttribute('data-roving-text') ?? personaName?.textContent ?? label.textContent ?? '';
    if (treeitem.getAttribute('data-roving-text') !== text) {
      treeitem.setAttribute('data-roving-text', text);
    }
  });
}

/**
 * Whether a keyboard event belongs to this treeitem: its target (the focused element) is this
 * treeitem or inside its row, not a nested item and not the row's actions (their keys are theirs).
 */
function isOwnKeyEvent(event: React.KeyboardEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  if (target?.closest?.('[data-tree-actions]')) return false;
  return target?.closest?.('[role="treeitem"]') === event.currentTarget;
}

/**
 * Whether a click landed on this treeitem's own row (or on the treeitem element itself). Clicks
 * in its child group, including the indentation gutter beside the nested rows, clicks on nested
 * items, on its checkbox and on its actions are not its own.
 */
function isOwnClick(event: React.MouseEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  if (target === event.currentTarget) return true;
  if (target?.closest?.('[data-tree-checkbox], [data-tree-actions]')) return false;
  return target?.closest?.('[data-tree-row]')?.parentElement === event.currentTarget;
}

interface TreeItemActionsProps {
  /** Id of the element that names the item. */
  labelledBy: string;
  /**
   * `'last-focused'` while the actions hold a Tab stop (their item has focus, tree mode), else
   * `'none'`.
   */
  tabStop: 'last-focused' | 'none';
  /** `'treegrid'`: the arrows do not wrap, and "previous" on the first action returns to the item. */
  navigationMode: 'tree' | 'treegrid';
  /** Moves focus back to the item. */
  onReturn: () => void;
  children: React.ReactNode;
}

/**
 * A row's actions: the consumer's controls rove with the arrow keys and hold at most one Tab
 * stop. A key pressed on an action is the action's: ArrowDown and ArrowUp on an action that opens
 * a popup (`aria-haspopup`) never move focus to another item. In treegrid navigation, "previous"
 * on the first action returns to the item.
 */
const TreeItemActions = ({
  labelledBy,
  tabStop,
  navigationMode,
  onReturn,
  children,
}: TreeItemActionsProps) => {
  const treegrid = navigationMode === 'treegrid';
  const {
    containerProps: { ref: rovingRef },
    handleKeyDown: rovingKeyDown,
    handleFocus: rovingFocus,
  } = useRovingTabIndex({
    itemSelector: ACTION_ITEM_SELECTOR,
    manageTabIndex: true,
    orientation: 'horizontal',
    loop: !treegrid,
    tabStop,
  });

  /** Whether the key is treegrid's "previous" for an action (the roving order settles it). */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>): boolean => {
    // A key from a popup an action opened reaches here through the React tree: not ours.
    if (event.defaultPrevented || !isOwnEvent(event)) return false;
    const target = event.target as HTMLElement;
    const popup = target.getAttribute('aria-haspopup');
    if (
      (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
      popup !== null &&
      popup !== 'false'
    ) {
      event.preventDefault();
      return false;
    }
    if (!treegrid || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(target)) {
      return false;
    }
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    });
    return intent === 'prev';
  };

  const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    const isPrev = handleKeyDown(event);
    if (event.defaultPrevented) return;
    rovingKeyDown(event);
    // "Previous" that the roving order did not take (the first action it reaches) returns.
    if (isPrev && event.target === document.activeElement) {
      event.preventDefault();
      onReturn();
    }
  };

  return (
    <span
      role="toolbar"
      aria-labelledby={labelledBy}
      aria-orientation="horizontal"
      data-tree-actions=""
      data-roving-container=""
      ref={rovingRef}
      onKeyDown={handleToolbarKeyDown}
      onFocus={rovingFocus}
      className={cn(
        treeItemClassNames.actions,
        'inline-flex items-center gap-1',
        ACTIONS_VISIBILITY,
      )}
    >
      {children}
    </span>
  );
};
TreeItemActions.displayName = 'TreeItemActions';

/**
 * One node of a Tree. Text and other content are the label; nested `Tree.Item` children form its
 * child group, which is shown while the item is expanded.
 *
 * Nested items must be `Tree.Item` elements among the item's own children: written directly, in
 * Fragments, or returned by a render function (`{node.children.map(renderNode)}`). A component
 * that renders `Tree.Item` itself (a recursive `<NodeView node={child} />`) is not recognised:
 * its output becomes part of the label, so the parent cannot expand (a development warning names
 * this). Render data-driven trees with a render function instead. The checks of a
 * `selectionMode="multiple"` tree cascade by the same rule, so an item that such a component
 * renders is not checked with its parent.
 *
 * `ref` and every other prop land on the `role="treeitem"` element, which contains the label row
 * and the child group. Its `onClick` receives only clicks on its own row (not on its child group
 * or nested items) and its `onKeyDown` only keys pressed while focus is on it or in its row; both
 * run before the built-in behaviour (call `event.preventDefault()` to skip it). In a checkbox
 * tree, a click on the item's checkbox toggles its check and is not passed to `onClick`, and
 * neither is a click on its actions; `onKeyDown` receives no keys pressed in the actions. Its
 * other event handlers (`onFocus`, `onDoubleClick`, `onContextMenu` and the rest) are not
 * filtered: as DOM events bubble, they also receive events from its child group and nested items
 * (compare `event.target` with `event.currentTarget` to tell them apart).
 *
 * `actions` render in a toolbar at the end of the row, named by the item; keys and clicks on them
 * belong to them and never activate or check the item. `aside` sits before them and describes the
 * item.
 *
 * The item is named by its label (`aria-labelledby`), not by its icon or nested items; an
 * `aria-label` or `aria-labelledby` prop replaces that name. Typeahead matches the label text too
 * (a `data-roving-text` prop replaces it).
 */
export const TreeItem = ({
  value,
  icon,
  iconAfter,
  expandIcon,
  aside,
  actions,
  leaf = false,
  className,
  children,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  ref,
  ...props
}: TreeItemProps) => {
  const { 'data-roving-text': typeaheadText, ...rest } = props as typeof props & {
    'data-roving-text'?: string;
  };
  const ctx = useTreeContext('Tree.Item');
  const parent = React.useContext(TreeParentContext);
  const insideLabel = React.useContext(TreeLabelContext);
  const isExpanded = ctx.expanded.has(value);
  const labelId = useId('tree-item-label');
  const asideId = useId('tree-item-aside');
  const ancestorListed = React.useContext(TreeCheckForcedContext);
  const itemRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, itemRef);
  // A Tree.ItemPersonaLayout in the label registers its name and description: the item is named
  // by the name only and described by the description.
  const [layoutIds, setLayoutIds] = React.useState<PersonaLayoutIds | null>(null);
  const registerLayout = React.useCallback((ids: PersonaLayoutIds) => {
    setLayoutIds(ids);
    return () => setLayoutIds((current) => (current === ids ? null : current));
  }, []);
  const itemContext = React.useMemo<TreeItemContextValue>(
    () => ({ registerLayout }),
    [registerLayout],
  );
  const nameId = layoutIds?.nameId ?? labelId;

  const { registerValue, registerTopLevel } = ctx;
  React.useEffect(() => registerValue(value), [registerValue, value]);
  React.useEffect(() => {
    if (insideLabel) warnOnce('Tree.Item:inside-label', ITEM_IN_LABEL_MESSAGE);
  }, [insideLabel]);

  // Nested Tree.Items (and, as in 0.4, nested Trees) form the child group; the rest is the label.
  // Parts are identified through their element type, so parts written in a Server Component
  // (lazy references) count too.
  const nestedItems: React.ReactNode[] = [];
  const labelContent: React.ReactNode[] = [];
  let firstChildValue: string | undefined;
  flattenChildren(children).forEach(({ key, node: child }) => {
    const keyed = <React.Fragment key={key}>{child}</React.Fragment>;
    if (isElementOfType<TreeItemProps>(child, TreeItem)) {
      firstChildValue ??= child.props.value;
      nestedItems.push(keyed);
    } else if (isElementOfType(child, TreeRoot)) {
      nestedItems.push(keyed);
    } else {
      labelContent.push(keyed);
    }
  });

  // A falsy icon (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in 0.4
  // and as in Avatar, and so is a collection whose items render nothing: no empty span adds a gap
  // to the row. The check does not consume a generator: renderSlot still renders its items.
  const iconNode =
    icon && slotRendersContent(icon)
      ? renderSlot(icon, 'span', cn(treeItemClassNames.icon, 'inline-flex shrink-0'), {
          'aria-hidden': true,
        })
      : null;
  const iconAfterNode =
    iconAfter && slotRendersContent(iconAfter)
      ? renderSlot(iconAfter, 'span', cn(treeItemClassNames.iconAfter, 'inline-flex shrink-0'), {
          'aria-hidden': true,
        })
      : null;
  // No empty aside and no empty toolbar (`actions={cond && <Button />}` with `cond` false).
  const hasAside = slotRendersContent(aside);
  const hasActions = slotRendersContent(actions);
  const hasChildren = nestedItems.length > 0 && !leaf;

  // The optional-indicator slot rule (C-SLOTS): `null`/`undefined` keep the chevron, `false` or
  // content that renders nothing hides it (the spacer keeps the column), and a custom glyph is
  // rendered as given, not rotated.
  let chevron: React.ReactNode = <span className="w-3 shrink-0" aria-hidden="true" />;
  if (hasChildren && (expandIcon === undefined || expandIcon === null)) {
    chevron = (
      <ChevronRightIcon
        className={cn(
          treeItemClassNames.expandIcon,
          'shrink-0 transition-transform motion-reduce:transition-none',
          isExpanded ? 'rotate-90' : 'wave-rtl:-scale-x-100',
        )}
      />
    );
  } else if (hasChildren && slotRendersContent(expandIcon)) {
    chevron = renderSlot(
      expandIcon,
      'span',
      cn(treeItemClassNames.expandIcon, 'inline-flex shrink-0'),
      { 'aria-hidden': true },
    );
  }

  // Checkbox tree: the item computes its state from its own subtree (the child-group rule) and
  // the checked list, so every state renders on the server and needs no other item. A top-level
  // item also hands its subtree to the root, which orders a toggle's list by it.
  const multiple = ctx.selectionMode === 'multiple';
  const ownNode = React.useMemo<TreeNode | null>(
    () =>
      multiple
        ? {
            value,
            children: leaf ? [] : collectItems(children, { item: TreeItem, tree: TreeRoot }),
          }
        : null,
    [multiple, value, leaf, children],
  );
  const checkState: CheckState | undefined = ownNode
    ? computeCheckStates([ownNode], ctx.checked, ancestorListed).get(value)
    : undefined;
  const selectionEntry = React.useRef<TreeSelectionEntry | null>(null);
  React.useLayoutEffect(() => {
    selectionEntry.current = ownNode ? { node: ownNode, element: itemRef.current } : null;
  });
  const isTopLevel = parent === null && !insideLabel;
  React.useLayoutEffect(
    () => (multiple && isTopLevel ? registerTopLevel(selectionEntry) : undefined),
    [multiple, isTopLevel, registerTopLevel],
  );
  const isSelected = ctx.selected !== undefined ? ctx.selected === value : undefined;
  const isCurrent = ctx.current !== undefined && ctx.current !== null && ctx.current === value;

  const activate = () => {
    if (hasChildren) ctx.toggle(value);
    ctx.activate(value);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOwnClick(event)) return;
    onClick?.(event);
    if (!event.defaultPrevented) activate();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOwnKeyEvent(event)) return;
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        activate();
        return;
      case ' ':
        event.preventDefault();
        // A checkbox tree toggles the focused item's check (APG); the other modes activate.
        if (checkState !== undefined) ctx.toggleChecked(value, event.nativeEvent);
        else activate();
        return;
      case '*': {
        event.preventDefault();
        const siblings = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
          ':scope > [role="treeitem"][aria-expanded="false"][data-roving-value]',
        );
        ctx.expand(
          Array.from(siblings ?? [], (el) => el.getAttribute('data-roving-value') ?? '').filter(
            Boolean,
          ),
        );
        return;
      }
      default:
    }

    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    });
    if (intent === 'next') {
      event.preventDefault();
      if (hasChildren && !isExpanded) {
        ctx.toggle(value);
        return;
      }
      // Treegrid navigation moves into the row's actions, also from an open parent (Down reaches
      // its first child), where APG's tree moves to the first child.
      if (ctx.navigationMode === 'treegrid' && focusFirstAction(event.currentTarget)) return;
      if (hasChildren && firstChildValue !== undefined) ctx.focusValue(firstChildValue);
    } else if (intent === 'prev') {
      event.preventDefault();
      if (hasChildren && isExpanded) ctx.toggle(value);
      else if (parent !== null) ctx.focusValue(parent);
    }
  };

  // Focus in the actions: tracked from the events, because a removed element fires no reliable
  // blur. A blur that leaves for another element, or from an element still in the document, ends it.
  const focusedAction = React.useRef<Element | null>(null);
  const inOwnActions = (event: React.FocusEvent<HTMLElement>) =>
    (event.target as Element).closest('[data-tree-actions]')?.closest('[role="treeitem"]') ===
    event.currentTarget;
  // Focus on the item, or on one of its own actions (a click), makes it the active item.
  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget || inOwnActions(event)) ctx.onItemFocus(value);
    if (inOwnActions(event)) focusedAction.current = event.target as Element;
  };

  const handleActionsBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (inOwnActions(event) && (event.relatedTarget !== null || event.target.isConnected)) {
      focusedAction.current = null;
    }
  };
  // An action that had focus is gone (no longer in the document) and focus fell to the page: it
  // goes to the item instead. Focus anywhere else ends the record at the next render.
  React.useLayoutEffect(() => {
    const action = focusedAction.current;
    if (!action) return;
    const item = itemRef.current;
    const active = item?.ownerDocument.activeElement;
    if (active && active !== item.ownerDocument.body) {
      focusedAction.current = null;
    } else if (item && !action.isConnected) {
      focusedAction.current = null;
      item.focus({ preventScroll: true });
    }
  });

  // The checkbox never takes focus (APG: focus stays on tree items): a press on it focuses its
  // item instead, and its click toggles the check without activating the item.
  const keepFocusOnItem = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    itemRef.current?.focus({ preventScroll: true });
  };
  const handleCheckboxClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    ctx.toggleChecked(value, event.nativeEvent);
  };

  const checkbox =
    checkState === undefined ? null : (
      <span
        role="checkbox"
        aria-checked={checkState === 'mixed' ? 'mixed' : checkState === 'checked'}
        aria-labelledby={nameId}
        tabIndex={-1}
        data-tree-checkbox=""
        onMouseDown={keepFocusOnItem}
        onClick={handleCheckboxClick}
        className={cn(
          treeItemClassNames.indicator,
          // Checkbox's box: 16px inside a 24px target (the pseudo-element), WCAG 2.5.8.
          'relative inline-flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors motion-reduce:transition-none',
          'before:absolute before:-inset-1',
          checkState === 'unchecked'
            ? cn('border-stroke-accessible bg-transparent', forcedColors.control)
            : 'border-primary bg-primary text-primary-foreground forced-colors:border-[Highlight] forced-colors:bg-[Highlight]',
        )}
      >
        {checkState === 'mixed' ? (
          <SubtractIcon size={12} className={forcedColors.selectedLeaf} />
        ) : checkState === 'checked' ? (
          <CheckIcon size={12} className={forcedColors.selectedLeaf} />
        ) : null}
      </span>
    );

  // Single mode: a decorative radio (the treeitem's aria-selected carries the state). A click on
  // it is a click on the row, so it activates the item.
  const radio =
    ctx.selectionMode === 'single' ? (
      <span
        aria-hidden="true"
        className={cn(
          treeItemClassNames.indicator,
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none',
          isSelected
            ? 'border-2 border-primary forced-colors:border-[Highlight]'
            : cn('border-stroke-accessible', forcedColors.control),
        )}
      >
        {isSelected && (
          <span className={cn('block size-2 rounded-full bg-primary', forcedColors.selectedLeaf)} />
        )}
      </span>
    ) : null;
  // A tree item shows its checkbox in multiple mode, its radio in single mode, and nothing else.
  const indicator = checkbox ?? radio;

  // Items in this item's group are checked when the list checks this item or an ancestor.
  const groupListed = ancestorListed || (multiple && ctx.checked.has(value));

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isCurrent ? true : undefined}
      data-checked={checkState === 'checked' ? '' : undefined}
      data-mixed={checkState === 'mixed' ? '' : undefined}
      className={cn(
        treeItemClassNames.root,
        // The focus ring is drawn on the row: an outline on the treeitem would surround its
        // whole subtree.
        'block outline-none',
        '[&:focus-visible>[data-tree-row]]:outline-2 [&:focus-visible>[data-tree-row]]:-outline-offset-2 [&:focus-visible>[data-tree-row]]:outline-ring',
        hasActions && ACTIONS_ON_ITEM_FOCUS,
        hasActions && hasAside && ASIDE_OFF_ON_ITEM_FOCUS,
        className,
      )}
      {...rest}
      // Named by its label only: the treeitem also contains its icon and its child group. A
      // consumer aria-labelledby or aria-label replaces it.
      aria-labelledby={
        rest['aria-labelledby'] ?? (rest['aria-label'] === undefined ? nameId : undefined)
      }
      // The aside describes the item, after a consumer description.
      aria-describedby={joinIds(
        rest['aria-describedby'],
        hasAside ? asideId : undefined,
        layoutIds?.descriptionId,
      )}
      aria-expanded={hasChildren ? isExpanded : undefined}
      // From the checked list, after the rest props, so a consumer cannot contradict it.
      aria-checked={
        checkState === undefined
          ? undefined
          : checkState === 'mixed'
            ? 'mixed'
            : checkState === 'checked'
      }
      tabIndex={ctx.getTabIndex(value)}
      data-roving-value={value}
      data-selected={isSelected ? '' : undefined}
      data-current={isCurrent ? '' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={(event) =>
        composeEventHandlers(onFocus, handleFocus, { checkDefaultPrevented: false })(event)
      }
      onBlur={(event) =>
        composeEventHandlers(onBlur, handleActionsBlur, { checkDefaultPrevented: false })(event)
      }
      ref={mergedRef}
    >
      <div
        data-tree-row=""
        className={cn(
          treeItemClassNames.row,
          'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-subtle-hover',
          hasActions && 'group/row',
          isSelected && cn('bg-subtle-selected font-semibold', forcedColors.selectedContainer),
        )}
      >
        {chevron}
        {indicator}
        {iconNode}
        <span
          id={labelId}
          data-tree-label=""
          data-roving-text={typeaheadText}
          // The label shrinks (and truncates) when the row has content after it.
          className={cn(
            treeItemClassNames.label,
            'truncate',
            (iconAfterNode || hasAside || hasActions) && 'min-w-0',
          )}
        >
          <TreeCheckForcedContext.Provider value={false}>
            <TreeLabelContext.Provider value>
              <TreeItemContext.Provider value={itemContext}>
                {labelContent}
              </TreeItemContext.Provider>
            </TreeLabelContext.Provider>
          </TreeCheckForcedContext.Provider>
        </span>
        {iconAfterNode}
        {(hasAside || hasActions) && (
          <span
            data-tree-end=""
            className={cn(
              'group/end ms-auto inline-grid shrink-0 items-center gap-1',
              hasAside && hasActions && END_CELL_SHARED,
            )}
          >
            {hasAside && (
              <span
                id={asideId}
                data-tree-aside=""
                className={cn(
                  treeItemClassNames.aside,
                  'inline-flex items-center text-caption-1 text-muted-foreground',
                  hasActions && ASIDE_OFF_WITH_ACTIONS,
                )}
              >
                {materialiseSlotContent(aside)}
              </span>
            )}
            {hasActions && (
              <TreeItemActions
                labelledBy={nameId}
                tabStop={
                  ctx.navigationMode === 'tree' && ctx.focusedItem === value
                    ? 'last-focused'
                    : 'none'
                }
                navigationMode={ctx.navigationMode}
                onReturn={() => ctx.focusValue(value)}
              >
                {materialiseSlotContent(actions)}
              </TreeItemActions>
            )}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <TreeParentContext.Provider value={value}>
          <TreeCheckForcedContext.Provider value={groupListed}>
            <TreeLabelContext.Provider value={false}>
              <div role="group" className={cn(treeItemClassNames.group, 'ps-4')}>
                {nestedItems}
              </div>
            </TreeLabelContext.Provider>
          </TreeCheckForcedContext.Provider>
        </TreeParentContext.Provider>
      )}
    </div>
  );
};
TreeItem.displayName = 'TreeItem';
