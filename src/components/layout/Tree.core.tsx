import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { treeClassNames, treeItemClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import { isHiddenInput } from '../../lib/focus';
import { CheckIcon, ChevronRightIcon, SubtractIcon } from '../../lib/icons';
import type { MotionSlot, SelectionMode } from '../../lib/types';
import { materialiseSlotContent, renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import {
  composeAfterPart,
  HIDDEN_PART_LOCKS,
  mergeSlotProps,
  type SlotPart,
} from '../../lib/slotProps';
import { forcedColors } from '../../lib/styles';
import { useCollapsePresence } from '../../hooks/useCollapsePresence';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { isHiddenByCss, useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import {
  TREE_PART_LOCKS,
  TreeCheckForcedContext,
  TreeContext,
  TreeItemContext,
  TreeLabelContext,
  TreeParentContext,
  useTreeContext,
  type PersonaLayoutIds,
  type TreeContextValue,
  type TreeItemContextValue,
  type TreeAppearance,
  type TreeItemOpenControl,
  type TreeOpenChangeDetails,
  type TreeSelectionEntry,
  type TreeSize,
} from './Tree.context';

export type { TreeAppearance, TreeOpenChangeDetails, TreeSize };
import {
  allItemValues,
  checkItems,
  checkItemsIndependent,
  collectItems,
  computeCheckStates,
  toggleCheck,
  toggleCheckIndependent,
  type CheckState,
  type TreeNode,
} from './Tree.selection';
import { useAppClassName } from '../../hooks/useAppClassName';

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

/** The gap and vertical padding of a row, per size (24 and 28px high). Literal strings only. */
const ROW_SIZE_CLASSES: Readonly<Record<TreeSize, { gap: string; padding: string }>> = {
  small: { gap: 'wave:gap-1', padding: 'wave:py-0.5' },
  medium: { gap: 'wave:gap-1.5', padding: 'wave:py-1' },
};

/** The hover and selected fills of a row, per appearance. Literal strings only. */
const ROW_LOOKS: Readonly<Record<TreeAppearance, { hover: string; selected: string }>> = {
  subtle: { hover: 'wave:hover:bg-subtle-hover', selected: 'wave:bg-subtle-selected' },
  'subtle-alpha': {
    hover: 'wave:hover:bg-subtle-hover/60',
    selected: 'wave:bg-subtle-selected/70',
  },
  transparent: { hover: '', selected: '' },
};

/** Every focusable control a row's actions can hold (Toolbar's rule). */
const ACTION_ITEM_SELECTOR = 'button, [href], input, select, textarea, [role="button"], [tabindex]';

/**
 * Shows a row's actions while focus is on its item (also after a click) or inside the item's own
 * row, never in its child group (a grandchild of the item: the group sits in its collapse
 * element), so Tab and the treegrid arrows reach them. The item's `:focus-within`, not its
 * `:focus`: while focus moves from the item into an action, Chromium has already ended the item's
 * `:focus` (but keeps `:focus-within` on it, the common ancestor) when it checks that the action
 * can take focus, and a hidden action refuses it.
 */
const ACTIONS_ON_ITEM_FOCUS =
  'wave:[&:focus-within:not(:has(>*>[role=group]_:focus))>[data-tree-row]_[data-tree-actions]]:visible';

/** Makes the aside invisible while its actions show for focus, where they take its place. */
const ASIDE_OFF_ON_ITEM_FOCUS =
  'wave:[@media(hover:hover)]:not-forced-colors:[&:focus-within:not(:has(>*>[role=group]_:focus))>[data-tree-row]_[data-tree-aside]]:invisible';

/**
 * The actions stay invisible until the row is hovered or the item or an action has focus, and
 * always show in forced colors and without hover (touch). An invisible action takes no focus.
 * They also show while a surface opened from an action is open (its trigger is expanded) and
 * while focus is in such a surface (`data-focus-in-popup`), so the surface's focus return, which
 * runs after its trigger already reports it closed, reaches the action.
 */
const ACTIONS_VISIBILITY =
  'wave:invisible wave:group-hover/row:visible wave:focus-within:visible wave:forced-colors:visible wave:[@media(hover:none)]:visible wave:has-[[aria-expanded=true]]:visible wave:data-[focus-in-popup]:visible';

/** The aside gives way to the actions where the two share one place. */
const ASIDE_OFF_WITH_ACTIONS =
  'wave:not-forced-colors:group-hover/row:invisible wave:[@media(hover:hover)]:not-forced-colors:group-focus-within/end:invisible wave:[@media(hover:hover)]:not-forced-colors:group-has-[[aria-expanded=true]]/end:invisible wave:[@media(hover:hover)]:not-forced-colors:group-has-[[data-focus-in-popup]]/end:invisible';

/** Aside and actions share one cell, and sit side by side where the actions always show. */
const END_CELL_SHARED =
  'wave:[&>*]:[grid-area:1/1] wave:forced-colors:flex wave:[@media(hover:none)]:flex';

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
  /**
   * The DOM event of the toggle: a keyboard event for Space, a mouse event for a click (for
   * `useFlatTree`'s `setChecked`, the event it got, else an untrusted `check` event with no
   * target).
   */
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
  /**
   * Called with the new list of expanded item values when an item expands or collapses, and with
   * the item, its new state and the click or key press behind it (Fluent UI's
   * `onOpenChange(event, { open, value, openItems })`; the open items are the first argument).
   * An item with its own `open` is not in this list and does not call it.
   */
  onExpandedItemsChange?: (expandedItems: string[], details?: TreeOpenChangeDetails) => void;
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
   * WaveUI always passes `details`.
   */
  onCheckedItemsChange?: (checkedItems: string[], details: TreeCheckedItemsChangeDetails) => void;
  /**
   * Size of the rows (Fluent UI's `Tree size`): `small` rows are 24px high, `medium` 28px. Rendered
   * as `data-size` on the tree.
   * @default 'medium'
   */
  size?: TreeSize;
  /**
   * With `selectionMode="multiple"`, makes the checks independent: checking an item checks only
   * that item, and a parent is neither checked by its children nor mixed (the default cascades,
   * Fluent UI's behaviour). `checkedItems` then lists exactly the items checked. Rendered as
   * `data-independent-checks` on the tree.
   * @default false
   */
  independentChecks?: boolean;
  /**
   * Look of the rows (Fluent UI's `Tree appearance`): `subtle` fills a hovered or selected row with
   * the subtle colors, `subtle-alpha` with translucent versions of them, so a surface behind the
   * tree shows through, and `transparent` draws no fill at all: a selected row then shows by its
   * bold text (and its outline in forced colors). Rendered as `data-appearance` on the tree.
   * @default 'subtle'
   */
  appearance?: TreeAppearance;
  /**
   * `'tree'`: Tab from a focused item enters its actions. `'treegrid'`: the "next" arrow
   * (ArrowRight, ArrowLeft in RTL) moves into an item's actions and "previous" returns; on an
   * expanded parent "next" no longer moves to the first child (ArrowDown does). The roles stay
   * `tree` and `treeitem` (Fluent's `navigationMode`).
   * @default 'tree'
   */
  navigationMode?: 'tree' | 'treegrid';
  /**
   * Replaces the collapse of every child group in the tree (Fluent's `Tree collapseMotion`), on
   * the element around each `role="group"` element: by default the space a group takes opens
   * from nothing and closes back to it, with a fade, over the normal duration (200 ms) with the
   * max easy-ease curve, both ways. `null` turns it off (a group appears and disappears at once);
   * a class string or `{ className }` replaces it, written as `MotionSlot` describes. A
   * `WaveProvider` with `motion="none"` turns the default off, and a value here still applies
   * under it. The expand chevron's turn is not part of it, and a nested `Tree` takes its own.
   * @default the collapse described above
   */
  motion?: MotionSlot | null;
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
  motion,
  size = 'medium',
  appearance = 'subtle',
  independentChecks = false,
  className,
  children,
  onKeyDown,
  onKeyDownCapture,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TreeProps) => {
  const appClassName = useAppClassName(treeClassNames.root);

  const [initialExpanded] = React.useState<readonly string[]>(() => defaultExpandedItems ?? EMPTY);
  // The request that changes the expanded list, held for `useControllable`'s change callback
  // (called synchronously from the event path) and cleared after it.
  const openRequest = React.useRef<{ value: string; event: Event; open?: boolean } | null>(null);
  const [expandedList, setExpandedList] = useControllable<readonly string[]>(
    expandedItems,
    initialExpanded,
    (next) => {
      const request = openRequest.current;
      onExpandedItemsChange?.(
        [...next],
        request ? { ...request, open: request.open ?? next.includes(request.value) } : undefined,
      );
    },
  );
  const expanded = React.useMemo(() => new Set(expandedList), [expandedList]);

  // The items with an `open` or an `onOpenChange` of their own, so `*` reaches them too.
  const openControls = React.useRef<Map<string, TreeItemOpenControl> | null>(null);
  const registerOpenControl = React.useCallback((value: string, control: TreeItemOpenControl) => {
    openControls.current ??= new Map();
    const controls = openControls.current;
    controls.set(value, control);
    return () => {
      if (controls.get(value) === control) controls.delete(value);
    };
  }, []);

  const requestExpandedChange = useEventCallback(
    (
      value: string,
      event: Event,
      change: (prev: readonly string[]) => readonly string[],
      open?: boolean,
    ) => {
      openRequest.current = { value, event, open };
      try {
        setExpandedList(change);
      } finally {
        openRequest.current = null;
      }
    },
  );

  const toggle = React.useCallback(
    (value: string, event: Event) => {
      requestExpandedChange(value, event, (prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
    },
    [requestExpandedChange],
  );

  const expand = React.useCallback(
    (values: readonly string[], event: Event, origin: string) => {
      // An item with an `open` of its own is asked to open and left out of the list.
      const listed: string[] = [];
      for (const value of values) {
        const control = openControls.current?.get(value);
        control?.open(event);
        if (!control?.owns) listed.push(value);
      }
      if (listed.length === 0) return;
      requestExpandedChange(
        origin,
        event,
        (prev) => {
          const added = listed.filter((v) => !prev.includes(v));
          return added.length > 0 ? [...prev, ...added] : prev;
        },
        true,
      );
    },
    [requestExpandedChange],
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
    (next) => {
      const details = pendingDetails.current;
      if (details) onCheckedItemsChange?.([...next], details);
    },
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
  // The item checked last, where Shift+Space starts a range.
  const anchorRef = React.useRef<string | null>(null);
  const treeRef = React.useRef<HTMLDivElement | null>(null);
  const toggleChecked = useEventCallback((value: string, event: Event) => {
    const forest = forestInTreeOrder(topLevel.current);
    anchorRef.current = value;
    setCheckedList((previous) => {
      const next = (independentChecks ? toggleCheckIndependent : toggleCheck)(
        forest,
        previous,
        value,
      );
      pendingDetails.current = { value, checked: next.includes(value), event };
      return next;
    });
    pendingDetails.current = undefined;
  });
  // The treeitems that are visible: not in a group that is collapsing (`inert`).
  const getVisibleItems = useEventCallback(() =>
    Array.from(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []).filter(
      (el) => !el.closest('[inert]'),
    ),
  );
  const checkValues = (values: readonly string[], value: string, event: Event) => {
    const forest = forestInTreeOrder(topLevel.current);
    setCheckedList((previous) => {
      const next = (independentChecks ? checkItemsIndependent : checkItems)(
        forest,
        previous,
        values,
      );
      pendingDetails.current = { value, checked: true, event };
      return next;
    });
    pendingDetails.current = undefined;
  };
  const checkRange = useEventCallback((value: string, event: Event) => {
    const values = getVisibleItems().map((el) => el.getAttribute('data-roving-value') ?? '');
    const from = values.indexOf(anchorRef.current ?? value);
    const to = values.indexOf(value);
    const range =
      from === -1 || to === -1 ? [value] : values.slice(Math.min(from, to), Math.max(from, to) + 1);
    anchorRef.current ??= value;
    checkValues(range, value, event);
  });
  const checkAll = useEventCallback((value: string, event: Event) => {
    anchorRef.current = value;
    checkValues(allItemValues(forestInTreeOrder(topLevel.current)), value, event);
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
      registerOpenControl,
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
      motion,
      independentChecks,
      checkRange,
      checkAll,
      getVisibleItems,
      size,
      appearance,
    }),
    [
      expanded,
      toggle,
      expand,
      registerOpenControl,
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
      motion,
      independentChecks,
      checkRange,
      checkAll,
      getVisibleItems,
      size,
      appearance,
    ],
  );

  const mergedRef = useMergedRefs<HTMLDivElement>(ref, containerProps.ref, treeRef);

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
            data-size={size}
            data-appearance={appearance}
            data-independent-checks={
              selectionMode === 'multiple' && independentChecks ? '' : undefined
            }
            aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
            className={wcn(treeClassNames.root, 'wave:text-body-1', appClassName, className)}
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
   *
   * They also stay shown while a Menu, Popover or Dialog rendered inside them holds focus or its
   * trigger among them is expanded, so its focus return reaches the action. A dialog your app
   * renders elsewhere and opens from an action through state (a "Delete…" menu item that opens a
   * confirm Dialog) closes after the actions have hidden again (on devices with hover, outside
   * forced colors): a hidden action cannot take focus, so focus returns to the nearest element
   * that can, normally the item. Render such a Dialog inside `actions` (its `Dialog.Trigger`
   * there, or the controlled Dialog next to the Menu that opens it) to return focus to the action;
   * `finalFocusRef` cannot name it, since it is still hidden when the dialog closes.
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
  /**
   * Keeps the `actions` shown whatever the pointer and focus do, so a hidden action cannot refuse
   * the focus that a surface returns to it. Set it while a Dialog, Menu or Popover that your app
   * renders outside `actions` and opens through state (a "Delete…" menu item that opens a confirm
   * Dialog) is open, and clear it after the surface has closed and returned focus: the actions
   * then take that focus instead of the item. The actions also give way to the `aside` while held,
   * as while they have focus. Rendered as `data-focus-in-popup` on the actions.
   * @default false
   */
  actionsVisible?: boolean;
  /**
   * Controls this item's expanded state from outside the tree's list (Fluent UI's `TreeItem
   * open`): `true` shows the child group, `false` hides it, whatever `expandedItems` and
   * `defaultExpandedItems` say about this item. The item's chevron, Enter, Space, the arrow keys
   * and a click ask for a change through `onOpenChange` and nothing else changes until you pass the
   * new value; the tree's `onExpandedItemsChange` is not called for an item with its own `open`.
   * The `*` key asks every collapsed sibling with an `open` through its `onOpenChange` as well.
   * Without it the tree's `expandedItems` decides.
   */
  open?: boolean;
  /**
   * Called when the item expands or collapses by the user, with the new state and the click or key
   * press behind it (Fluent UI's `onOpenChange(event, { open })`): for an item with its own `open`
   * (which you then update) and for one in the tree's list, before the tree's
   * `onExpandedItemsChange`. Not called for an item that has no nested items.
   */
  onOpenChange?: (open: boolean, details: TreeOpenChangeDetails) => void;
  /** Ref to the `role="treeitem"` element. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the elements the item draws, by part, merged into each part's own: your classes
   * after the part's (yours win a conflict), your styles over its styles, your attributes and
   * handlers added, your ref attached. Every attribute the item sets on a part is locked and keeps
   * the item's value, and no part takes a role, a tab index or the markers by which the tree reads
   * an item (its row, label, checkbox, aside and actions, a persona layout's name, a roving
   * container), so a part changes neither the tree's items, its one tab stop, its typeahead nor
   * which clicks and keys an item takes. A part takes no `children` (the item draws their
   * content); the treeitem element itself takes the item's own props, and each nested `Tree.Item`
   * takes its own `slotProps`. Apart from the checkbox and the actions (below), no part carries a
   * handler of the item: an event on a part reaches the item and its tree after your handler, as
   * one on the label does, and `preventDefault()` in yours skips their handling of it there too.
   * A click you prevent on the row, the label, the aside or the radio neither activates nor
   * expands the item, while the item's `onClick` is still called, as for a prevented click on the
   * label. Fluent UI's TreeItemLayout gives most of these parts slots of their own (`main` for the
   * label, `aside`, `actions`, `selector` for the checkbox or radio).
   */
  slotProps?: {
    /**
     * The `<div>` of the item's row, which holds the chevron, the checkbox or radio, the icons,
     * the label, the aside and the actions, and draws the focus ring and the selected look
     * (stable class `wave-tree-item__row`). Locked: its marker (the item's clicks, its focus ring
     * and the reveal of its actions find the row by it), no role or tab index, the tree's other
     * markers, and no `hidden`, `inert` or `aria-hidden`, since it holds the item's name and its
     * actions.
     */
    row?: SlotPart<'div'>;
    /**
     * The checkbox `<span>` of a `selectionMode="multiple"` tree, or the radio `<span>` of a
     * `"single"` one, before the icon (stable class `wave-tree-item__indicator`); absent with
     * `selectionMode="none"`. Locked on the checkbox: its role, `aria-checked`, its name
     * (`aria-labelledby`, the item's name; your ids are joined after it), its tab index (-1: it
     * never takes focus) and marker, no `hidden`, `inert` or `aria-hidden`, and its handlers: a
     * press focuses the item instead, a click toggles the check, and `preventDefault()` in your
     * `onMouseDown` or `onClick` skips that handling. Locked on the radio: `aria-hidden` (the
     * item's `aria-selected` carries the state), no role or tab index; a click on it is a click on
     * the row.
     */
    indicator?: SlotPart<'span'>;
    /**
     * The `<span>` of the label (the item's content other than its nested items), which names the
     * item (stable class `wave-tree-item__label`). Locked: its `id` (the item's
     * `aria-labelledby`), its marker and the item's `data-roving-text` (typeahead reads the label
     * through them), no `aria-label` (it would replace the label's text in the item's name), no
     * role or tab index, the tree's other markers, and no `hidden`, `inert` or `aria-hidden`.
     */
    label?: SlotPart<'span'>;
    /**
     * The `<span>` of `aside`, rendered while `aside` renders content, which describes the item
     * (stable class `wave-tree-item__aside`). Locked: its `id` (the item's `aria-describedby`),
     * its marker (it gives way to the actions by it), no `aria-label`, no role or tab index, the
     * tree's other markers, and no `hidden`, `inert` or `aria-hidden`.
     */
    aside?: SlotPart<'span'>;
    /**
     * The toolbar `<span>` of `actions`, rendered while `actions` renders content (stable class
     * `wave-tree-item__actions`). Locked: its role (`toolbar`), its name (`aria-labelledby`, the
     * item's name; your ids are joined after it), `aria-orientation`, its markers (the item's
     * clicks and keys tell its actions apart by them, the tree's arrow keys leave them to the
     * actions, and a surface an action opened keeps them shown while it holds focus), no tab
     * index (the actions themselves hold the tab stops), the tree's other markers, and no
     * `hidden`, `inert` or `aria-hidden`. Its `onKeyDown` (the arrow keys between the actions and,
     * with `navigationMode="treegrid"`, back to the item) is locked: `preventDefault()` in yours
     * skips it. Its focus and blur bookkeeping (which action holds the tab stop, and whether
     * focus is in a surface an action opened) always runs, after your `onFocus` and `onBlur`.
     */
    actions?: SlotPart<'span'>;
    /**
     * The `role="group"` `<div>` of the nested items, rendered while the item is expanded and
     * while it collapses, inside the element the Tree's `motion` collapses (stable class
     * `wave-tree-item__group`). Locked: its role, no tab index, the tree's markers, and no
     * `hidden`, `inert` or `aria-hidden`, since it holds the nested items. It carries no handler
     * of the item: the clicks and keys of the nested items reach your handler after their own
     * handling and before the tree's, so `preventDefault()` in yours skips the tree's handling of
     * them (its arrow keys and typeahead), as a nested item's own handler would.
     */
    group?: SlotPart<'div'>;
  };
}

/**
 * Sets the typeahead text (`data-roving-text`, read by the roving hook) of every rendered
 * treeitem to the text of its label (a persona layout's name when the label holds one), so neither
 * the icon nor the nested items take part. A consumer `data-roving-text` on a Tree.Item is kept on
 * its label and wins.
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
 *
 * While the child group exits, its collapse element is `inert`, which hit-tests like an element
 * the pointer passes through: a pointer click in the group's box lands on the treeitem element
 * itself, and is not its own either (it would expand the item again and activate it). A click
 * without a pointer (`detail` 0: Enter on a focused item, a screen reader's click) still is.
 */
function isOwnClick(event: React.MouseEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  if (target === event.currentTarget) {
    return event.detail === 0 || !event.currentTarget.querySelector(':scope > [inert]');
  }
  if (target?.closest?.('[data-tree-checkbox], [data-tree-actions]')) return false;
  return target?.closest?.('[data-tree-row]')?.parentElement === event.currentTarget;
}

/**
 * The checkbox never takes focus (APG: focus stays on tree items): a press on it focuses its item
 * instead, the treeitem its row sits in (the row is the checkbox's parent and the treeitem's
 * child, `isOwnClick`'s rule). Found from the event, so a part can take it as its own handler.
 */
function keepFocusOnItem(event: React.MouseEvent<HTMLSpanElement>): void {
  event.preventDefault();
  event.currentTarget.closest('[data-tree-row]')?.parentElement?.focus({ preventScroll: true });
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
  /** The item's `actionsVisible`: the actions stay shown whatever the pointer and focus do. */
  held: boolean;
  /** The item's `slotProps.actions`, merged only when given. */
  part: SlotPart<'span'> | undefined;
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
  held,
  part,
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

  // Focus in a surface opened from an action (a Menu, Popover or Dialog rendered in a portal, whose
  // focus events reach the toolbar through the React tree): `'inside'`. Once focus leaves such a
  // surface for anywhere but the toolbar, `'leaving'` until the next frame, because the surface's
  // focus return comes later in that close (its layout phase, or a microtask).
  const [popupFocus, setPopupFocus] = React.useState<'inside' | 'leaving' | null>(null);
  React.useEffect(() => {
    if (popupFocus !== 'leaving') return;
    const frame = requestAnimationFrame(() => setPopupFocus(null));
    return () => cancelAnimationFrame(frame);
  }, [popupFocus]);

  const handleToolbarFocus = (event: React.FocusEvent<HTMLSpanElement>) => {
    rovingFocus(event);
    setPopupFocus(event.currentTarget.contains(event.target) ? null : 'inside');
  };

  const handleToolbarBlur = (event: React.FocusEvent<HTMLSpanElement>) => {
    // An action's own blur: its focus-within reveal decides.
    if (event.currentTarget.contains(event.target)) return;
    const next = event.relatedTarget;
    // Back to an action: its focus clears the hold.
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setPopupFocus('leaving');
  };

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

  // A part's ref joins the roving container's after the spread, so an inline ref never detaches
  // the container (which would hand its stamped tab stops back).
  const toolbarRef = useMergedRefs<HTMLSpanElement>(rovingRef, part?.ref);
  const focusInPopup = popupFocus === null && !held ? undefined : '';
  const className = wcn(
    treeItemClassNames.actions,
    'wave:inline-flex wave:items-center wave:gap-1',
    ACTIONS_VISIBILITY,
  );

  return (
    <span
      role="toolbar"
      aria-labelledby={labelledBy}
      aria-orientation="horizontal"
      data-tree-actions=""
      data-roving-container=""
      data-focus-in-popup={focusInPopup}
      onKeyDown={handleToolbarKeyDown}
      className={className}
      {...(part &&
        mergeSlotProps(part, {
          className,
          locked: {
            ...TREE_PART_LOCKS,
            ...HIDDEN_PART_LOCKS,
            role: 'toolbar',
            'aria-labelledby': labelledBy,
            'aria-orientation': 'horizontal',
            'data-tree-actions': '',
            'data-roving-container': '',
            'data-focus-in-popup': focusInPopup,
            onKeyDown: handleToolbarKeyDown,
          },
        }))}
      // Bookkeeping that follows focus whatever a part's handlers do: after them, never skipped.
      onFocus={composeAfterPart(part?.onFocus, handleToolbarFocus)}
      onBlur={composeAfterPart(part?.onBlur, handleToolbarBlur)}
      ref={toolbarRef}
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
 * The child group renders as the only child of a collapse element (its stable class
 * `wave-tree-item__collapse`), which opens and closes the group's space (the Tree's `motion`) and
 * has no box of its own while the item is expanded, so the group lays out in the item as before.
 * An item expanded by default appears without motion. After a collapse the group stays in the
 * document until the collapse ends, `inert` (its items leave the arrow keys and typeahead at once)
 * while the item already reports itself collapsed; expanding the item again during the collapse
 * keeps the same group. Focus inside the group when the item collapses moves to the item. A
 * pointer click that falls through the exiting group onto the item (an `inert` element lets the
 * pointer through) is not the item's: it neither expands nor activates it.
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
 * and the child group (in its collapse element). Its `onClick` receives only clicks on its own
 * row (not on its child group or nested items) and its `onKeyDown` only keys pressed while focus
 * is on it or in its row; both run before the built-in behaviour (call `event.preventDefault()`
 * to skip it). In a checkbox tree, a click on the item's checkbox toggles its check and is not
 * passed to `onClick`, and neither is a click on its actions; `onKeyDown` receives no keys pressed
 * in the actions. Its other event handlers (`onFocus`, `onDoubleClick`, `onContextMenu` and the
 * rest) are not filtered: as DOM events bubble, they also receive events from its child group and
 * nested items (compare `event.target` with `event.currentTarget` to tell them apart).
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
  actionsVisible = false,
  open,
  onOpenChange,
  className,
  children,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  ref,
  slotProps,
  ...props
}: TreeItemProps) => {
  const appClassName = useAppClassName(treeItemClassNames.root);

  const { 'data-roving-text': typeaheadText, ...rest } = props as typeof props & {
    'data-roving-text'?: string;
  };
  const ctx = useTreeContext('Tree.Item');
  const parent = React.useContext(TreeParentContext);
  const insideLabel = React.useContext(TreeLabelContext);
  const ownsOpen = open !== undefined;
  const isExpanded = ownsOpen ? open : ctx.expanded.has(value);
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

  const { registerValue, registerTopLevel, registerOpenControl } = ctx;
  React.useEffect(() => registerValue(value), [registerValue, value]);

  // Asks for the item to open or close: the item's own callback first, then the tree's list unless
  // the item has an `open` of its own.
  const requestOpen = useEventCallback((next: boolean, event: Event) => {
    onOpenChange?.(next, { value, open: next, event });
    if (!ownsOpen) ctx.toggle(value, event);
  });
  const hasOpenCallback = onOpenChange !== undefined;
  const openForKey = useEventCallback((event: Event) => {
    // The key's request: only the callback of an item with its own `open` (the tree changes its
    // list for the others).
    onOpenChange?.(true, { value, open: true, event });
  });
  React.useLayoutEffect(
    () =>
      ownsOpen || hasOpenCallback
        ? registerOpenControl(value, { owns: ownsOpen, open: openForKey })
        : undefined,
    [registerOpenControl, value, ownsOpen, hasOpenCallback, openForKey],
  );
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
      ? renderSlot(icon, 'span', wcn(treeItemClassNames.icon, 'wave:inline-flex wave:shrink-0'), {
          'aria-hidden': true,
        })
      : null;
  const iconAfterNode =
    iconAfter && slotRendersContent(iconAfter)
      ? renderSlot(
          iconAfter,
          'span',
          wcn(treeItemClassNames.iconAfter, 'wave:inline-flex wave:shrink-0'),
          {
            'aria-hidden': true,
          },
        )
      : null;
  // No empty aside and no empty toolbar (`actions={cond && <Button />}` with `cond` false).
  const hasAside = slotRendersContent(aside);
  const hasActions = slotRendersContent(actions);
  const hasChildren = nestedItems.length > 0 && !leaf;

  // The child group renders in a collapse element (the presence element) while the item is
  // expanded and, after a collapse, until that element's motion ends; focus inside the group when
  // the item collapses moves to this item, which the roving hook then treats as the focused item.
  const groupRef = React.useRef<HTMLDivElement | null>(null);
  const {
    isMounted: isGroupMounted,
    wrapperRef: collapseRef,
    presenceProps: collapsePresenceProps,
    className: collapseClassName,
  } = useCollapsePresence(hasChildren && isExpanded, {
    motion: ctx.motion,
    partRef: groupRef,
    getTrigger: () => itemRef.current,
  });
  // A group part's ref joins the group's own after the spread: an inline ref never detaches it.
  const groupPartRef = useMergedRefs<HTMLDivElement>(groupRef, slotProps?.group?.ref);

  // The optional-indicator slot rule (C-SLOTS): `null`/`undefined` keep the chevron, `false` or
  // content that renders nothing hides it (the spacer keeps the column), and a custom glyph is
  // rendered as given, not rotated.
  let chevron: React.ReactNode = <span className="wave:w-3 wave:shrink-0" aria-hidden="true" />;
  if (hasChildren && (expandIcon === undefined || expandIcon === null)) {
    chevron = (
      <ChevronRightIcon
        className={wcn(
          treeItemClassNames.expandIcon,
          'wave:shrink-0 wave:transition-transform wave:motion-reduce:transition-none',
          isExpanded ? 'wave:rotate-90' : 'wave:wave-rtl:-scale-x-100',
        )}
      />
    );
  } else if (hasChildren && slotRendersContent(expandIcon)) {
    chevron = renderSlot(
      expandIcon,
      'span',
      wcn(treeItemClassNames.expandIcon, 'wave:inline-flex wave:shrink-0'),
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
    ? ctx.independentChecks
      ? ctx.checked.has(value)
        ? 'checked'
        : 'unchecked'
      : computeCheckStates([ownNode], ctx.checked, ancestorListed).get(value)
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

  const activate = (event: Event) => {
    if (hasChildren) requestOpen(!isExpanded, event);
    ctx.activate(value);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOwnClick(event)) return;
    onClick?.(event);
    if (!event.defaultPrevented) activate(event.nativeEvent);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOwnKeyEvent(event)) return;
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    // Range selection in a checkbox tree (APG, optional): Ctrl+A checks every item, Shift+Space
    // the items between the last one checked and this one, Shift+Up and Down move and toggle.
    if (checkState !== undefined && !event.altKey) {
      const key = event.key;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key.toLowerCase() === 'a') {
        event.preventDefault();
        ctx.checkAll(value, event.nativeEvent);
        return;
      }
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
        if (key === ' ') {
          event.preventDefault();
          ctx.checkRange(value, event.nativeEvent);
          return;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
          const visible = ctx.getVisibleItems();
          const index = visible.indexOf(event.currentTarget);
          const target = visible[index + (key === 'ArrowDown' ? 1 : -1)];
          event.preventDefault();
          const targetValue = target?.getAttribute('data-roving-value');
          if (target && targetValue != null) {
            ctx.focusValue(targetValue);
            ctx.toggleChecked(targetValue, event.nativeEvent);
          }
          return;
        }
      }
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        activate(event.nativeEvent);
        return;
      case ' ':
        event.preventDefault();
        // A checkbox tree toggles the focused item's check (APG); the other modes activate.
        if (checkState !== undefined) ctx.toggleChecked(value, event.nativeEvent);
        else activate(event.nativeEvent);
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
          event.nativeEvent,
          value,
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
        requestOpen(true, event.nativeEvent);
        return;
      }
      // Treegrid navigation moves into the row's actions, also from an open parent (Down reaches
      // its first child), where APG's tree moves to the first child.
      if (ctx.navigationMode === 'treegrid' && focusFirstAction(event.currentTarget)) return;
      if (hasChildren && firstChildValue !== undefined) ctx.focusValue(firstChildValue);
    } else if (intent === 'prev') {
      event.preventDefault();
      if (hasChildren && isExpanded) requestOpen(false, event.nativeEvent);
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

  // The checkbox never takes focus (`keepFocusOnItem`), and its click toggles the check without
  // activating the item.
  const handleCheckboxClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    ctx.toggleChecked(value, event.nativeEvent);
  };

  // The parts are merged only when given: a tree renders many items.
  const indicatorPart = slotProps?.indicator;
  const ariaChecked = checkState === 'mixed' ? 'mixed' : checkState === 'checked';
  const checkboxClasses =
    checkState === undefined
      ? undefined
      : wcn(
          treeItemClassNames.indicator,
          // Checkbox's box: 16px inside a 24px target (the pseudo-element), WCAG 2.5.8.
          'wave:relative wave:inline-flex wave:size-4 wave:shrink-0 wave:items-center wave:justify-center wave:rounded-xs wave:border wave:transition-colors wave:motion-reduce:transition-none',
          'wave:before:absolute wave:before:-inset-1',
          checkState === 'unchecked'
            ? wcn('wave:border-stroke-accessible wave:bg-transparent', forcedColors.control)
            : 'wave:border-primary wave:bg-primary wave:text-primary-foreground wave:forced-colors:border-[Highlight] wave:forced-colors:bg-[Highlight]',
        );
  const checkbox =
    checkState === undefined ? null : (
      <span
        role="checkbox"
        aria-checked={ariaChecked}
        aria-labelledby={nameId}
        tabIndex={-1}
        data-tree-checkbox=""
        onMouseDown={keepFocusOnItem}
        onClick={handleCheckboxClick}
        className={checkboxClasses}
        {...(indicatorPart &&
          mergeSlotProps(indicatorPart, {
            className: checkboxClasses,
            locked: {
              ...TREE_PART_LOCKS,
              ...HIDDEN_PART_LOCKS,
              role: 'checkbox',
              'aria-checked': ariaChecked,
              'aria-labelledby': nameId,
              tabIndex: -1,
              'data-tree-checkbox': '',
              onMouseDown: keepFocusOnItem,
              onClick: handleCheckboxClick,
            },
          }))}
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
  const radioClasses =
    ctx.selectionMode === 'single'
      ? wcn(
          treeItemClassNames.indicator,
          'wave:inline-flex wave:size-4 wave:shrink-0 wave:items-center wave:justify-center wave:rounded-full wave:border wave:transition-colors wave:motion-reduce:transition-none',
          isSelected
            ? 'wave:border-2 wave:border-primary wave:forced-colors:border-[Highlight]'
            : wcn('wave:border-stroke-accessible', forcedColors.control),
        )
      : undefined;
  const radio =
    ctx.selectionMode === 'single' ? (
      <span
        aria-hidden="true"
        className={radioClasses}
        {...(indicatorPart &&
          mergeSlotProps(indicatorPart, {
            className: radioClasses,
            locked: { ...TREE_PART_LOCKS, 'aria-hidden': true },
          }))}
      >
        {isSelected && (
          <span
            className={wcn(
              'wave:block wave:size-2 wave:rounded-full wave:bg-primary',
              forcedColors.selectedLeaf,
            )}
          />
        )}
      </span>
    ) : null;
  // A tree item shows its checkbox in multiple mode, its radio in single mode, and nothing else.
  const indicator = checkbox ?? radio;

  // Items in this item's group are checked when the list checks this item or an ancestor.
  const groupListed =
    !ctx.independentChecks && (ancestorListed || (multiple && ctx.checked.has(value)));

  const looks = ROW_LOOKS[ctx.appearance];
  const rowClasses = wcn(
    treeItemClassNames.row,
    'wave:flex wave:cursor-pointer wave:items-center',
    ROW_SIZE_CLASSES[ctx.size].gap,
    'wave:rounded wave:px-2',
    ROW_SIZE_CLASSES[ctx.size].padding,
    looks.hover,
    hasActions && 'wave:group/row',
    isSelected && wcn(looks.selected, 'wave:font-semibold', forcedColors.selectedContainer),
  );
  // The label shrinks (and truncates) when the row has content after it.
  const labelClasses = wcn(
    treeItemClassNames.label,
    'wave:truncate',
    (iconAfterNode || hasAside || hasActions) && 'wave:min-w-0',
  );
  const asideClasses = hasAside
    ? wcn(
        treeItemClassNames.aside,
        'wave:inline-flex wave:items-center wave:text-caption-1 wave:text-muted-foreground',
        hasActions && ASIDE_OFF_WITH_ACTIONS,
      )
    : undefined;
  const groupClasses = isGroupMounted ? wcn(treeItemClassNames.group, 'wave:ps-4') : undefined;

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isCurrent ? true : undefined}
      data-checked={checkState === 'checked' ? '' : undefined}
      data-mixed={checkState === 'mixed' ? '' : undefined}
      className={wcn(
        treeItemClassNames.root,
        // The focus ring is drawn on the row: an outline on the treeitem would surround its
        // whole subtree.
        'wave:block wave:outline-none',
        'wave:[&:focus-visible>[data-tree-row]]:outline-2 wave:[&:focus-visible>[data-tree-row]]:-outline-offset-2 wave:[&:focus-visible>[data-tree-row]]:outline-ring',
        hasActions && ACTIONS_ON_ITEM_FOCUS,
        hasActions && hasAside && ASIDE_OFF_ON_ITEM_FOCUS,
        appClassName,
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
      aria-checked={checkState === undefined ? undefined : ariaChecked}
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
        className={rowClasses}
        {...(slotProps?.row &&
          mergeSlotProps(slotProps.row, {
            className: rowClasses,
            locked: { ...TREE_PART_LOCKS, ...HIDDEN_PART_LOCKS, 'data-tree-row': '' },
          }))}
      >
        {chevron}
        {indicator}
        {iconNode}
        <span
          id={labelId}
          data-tree-label=""
          data-roving-text={typeaheadText}
          className={labelClasses}
          {...(slotProps?.label &&
            mergeSlotProps(slotProps.label, {
              className: labelClasses,
              locked: {
                ...TREE_PART_LOCKS,
                ...HIDDEN_PART_LOCKS,
                id: labelId,
                'aria-label': undefined,
                'data-tree-label': '',
                'data-roving-text': typeaheadText,
              },
            }))}
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
            className={wcn(
              'wave:group/end wave:ms-auto wave:inline-grid wave:shrink-0 wave:items-center wave:gap-1',
              hasAside && hasActions && END_CELL_SHARED,
            )}
          >
            {hasAside && (
              <span
                id={asideId}
                data-tree-aside=""
                className={asideClasses}
                {...(slotProps?.aside &&
                  mergeSlotProps(slotProps.aside, {
                    className: asideClasses,
                    locked: {
                      ...TREE_PART_LOCKS,
                      ...HIDDEN_PART_LOCKS,
                      id: asideId,
                      'aria-label': undefined,
                      'data-tree-aside': '',
                    },
                  }))}
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
                held={actionsVisible}
                part={slotProps?.actions}
              >
                {materialiseSlotContent(actions)}
              </TreeItemActions>
            )}
          </span>
        )}
      </div>
      {isGroupMounted && (
        <TreeParentContext.Provider value={value}>
          <TreeCheckForcedContext.Provider value={groupListed}>
            <TreeLabelContext.Provider value={false}>
              <div
                ref={collapseRef}
                {...collapsePresenceProps}
                className={wcn(treeItemClassNames.collapse, collapseClassName)}
              >
                <div
                  role="group"
                  className={groupClasses}
                  {...(slotProps?.group &&
                    mergeSlotProps(slotProps.group, {
                      className: groupClasses,
                      locked: { ...TREE_PART_LOCKS, ...HIDDEN_PART_LOCKS, role: 'group' },
                    }))}
                  ref={groupPartRef}
                >
                  {nestedItems}
                </div>
              </div>
            </TreeLabelContext.Provider>
          </TreeCheckForcedContext.Provider>
        </TreeParentContext.Provider>
      )}
    </div>
  );
};
TreeItem.displayName = 'TreeItem';
