import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, reportMissingContext, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { ChevronRightIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

/* ------------------------------------------------------------------ */
/*  Contexts                                                           */
/* ------------------------------------------------------------------ */

interface TreeContextValue {
  expanded: ReadonlySet<string>;
  toggle: (value: string) => void;
  expand: (values: readonly string[]) => void;
  activate: (value: string) => void;
  selected: string | null | undefined;
  current: string | null | undefined;
  getTabIndex: (value: string) => 0 | -1;
  focusValue: (value: string) => void;
  onItemFocus: (value: string) => void;
  /**
   * Development only: counts a mounted item's value and warns once per value that several items
   * share. Returns the unregistration.
   */
  registerValue: (value: string) => () => void;
}

const TreeContext = React.createContext<TreeContextValue | null>(null);

/** Value of the enclosing Tree.Item (`null` at the top level), for ArrowLeft → parent. */
const TreeParentContext = React.createContext<string | null>(null);

/**
 * `true` inside the label of a Tree.Item, where a nested Tree.Item ends up when a component
 * renders it (the parent cannot see it among its children); its child group and every Tree root
 * reset it.
 */
const TreeLabelContext = React.createContext(false);

const EMPTY: readonly string[] = [];

const INERT_CONTEXT: TreeContextValue = {
  expanded: new Set(),
  toggle: () => {},
  expand: () => {},
  activate: () => {},
  selected: undefined,
  current: undefined,
  getTabIndex: () => -1,
  focusValue: () => {},
  onItemFocus: () => {},
  registerValue: () => () => {},
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
function useTreeContext(component: string): TreeContextValue {
  const context = React.useContext(TreeContext);
  if (context) return context;
  reportMissingContext(component, '<Tree>');
  return INERT_CONTEXT;
}

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

/* ------------------------------------------------------------------ */
/*  Tree                                                               */
/* ------------------------------------------------------------------ */

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
   * Called with an item's value every time it is activated (click, Enter or Space), also when the
   * same item is activated again.
   */
  onItemSelect?: (value: string) => void;
  /**
   * Value of the selected item. When set (also to `null`), every item carries `aria-selected`, and
   * the selected item is where keyboard focus enters the tree.
   */
  selected?: string | null;
  /** Value of the current item (for example the open page): it gets `aria-current="true"`. */
  current?: string | null;
  /** Ref to the `role="tree"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

const TreeRoot = ({
  expandedItems,
  defaultExpandedItems,
  onExpandedItemsChange,
  onItemSelect,
  selected,
  current,
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
    activeValue: focusedItem ?? selected ?? null,
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
      selected,
      current,
      getTabIndex,
      focusValue,
      onItemFocus: setFocusedItem,
      registerValue,
    }),
    [expanded, toggle, expand, activate, selected, current, getTabIndex, focusValue, registerValue],
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
        <div
          role="tree"
          className={cn('text-body-1', className)}
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
 * treeitem to the text of its label, so neither the icon nor the nested items take part. A
 * consumer `data-roving-text` on a Tree.Item is kept on its label and wins.
 */
function syncTypeaheadText(tree: HTMLElement): void {
  tree.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((treeitem) => {
    const label = treeitem.querySelector<HTMLElement>(
      ':scope > [data-tree-row] > [data-tree-label]',
    );
    if (!label) return;
    const text = label.getAttribute('data-roving-text') ?? label.textContent ?? '';
    if (treeitem.getAttribute('data-roving-text') !== text) {
      treeitem.setAttribute('data-roving-text', text);
    }
  });
}

/**
 * Whether a keyboard event belongs to this treeitem: its target (the focused element) is this
 * treeitem or inside its row, not a nested item.
 */
function isOwnKeyEvent(event: React.KeyboardEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  return target?.closest?.('[role="treeitem"]') === event.currentTarget;
}

/**
 * Whether a click landed on this treeitem's own row (or on the treeitem element itself). Clicks
 * in its child group, including the indentation gutter beside the nested rows, and clicks on
 * nested items are not its own.
 */
function isOwnClick(event: React.MouseEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  if (target === event.currentTarget) return true;
  return target?.closest?.('[data-tree-row]')?.parentElement === event.currentTarget;
}

/**
 * One node of a Tree. Text and other content are the label; nested `Tree.Item` children form its
 * child group, which is shown while the item is expanded.
 *
 * Nested items must be `Tree.Item` elements among the item's own children: written directly, in
 * Fragments, or returned by a render function (`{node.children.map(renderNode)}`). A component
 * that renders `Tree.Item` itself (a recursive `<NodeView node={child} />`) is not recognised:
 * its output becomes part of the label, so the parent cannot expand (a development warning names
 * this). Render data-driven trees with a render function instead.
 *
 * `ref` and every other prop land on the `role="treeitem"` element, which contains the label row
 * and the child group. Its `onClick` receives only clicks on its own row (not on its child group
 * or nested items) and its `onKeyDown` only keys pressed while focus is on it or in its row; both
 * run before the built-in behaviour (call `event.preventDefault()` to skip it). Its other event
 * handlers (`onFocus`, `onDoubleClick`, `onContextMenu` and the rest) are not filtered: as DOM
 * events bubble, they also receive events from its child group and nested items (compare
 * `event.target` with `event.currentTarget` to tell them apart).
 *
 * The item is named by its label (`aria-labelledby`), not by its icon or nested items; an
 * `aria-label` or `aria-labelledby` prop replaces that name. Typeahead matches the label text too
 * (a `data-roving-text` prop replaces it).
 */
const TreeItem = ({
  value,
  icon,
  leaf = false,
  className,
  children,
  onClick,
  onKeyDown,
  onFocus,
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

  const { registerValue } = ctx;
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
      ? renderSlot(icon, 'span', 'inline-flex shrink-0', { 'aria-hidden': true })
      : null;
  const hasChildren = nestedItems.length > 0 && !leaf;
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

    const rtl = getDirection(event.currentTarget) === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        activate();
        return;
      case forward:
        event.preventDefault();
        if (!hasChildren) return;
        if (!isExpanded) ctx.toggle(value);
        else if (firstChildValue !== undefined) ctx.focusValue(firstChildValue);
        return;
      case back:
        event.preventDefault();
        if (hasChildren && isExpanded) ctx.toggle(value);
        else if (parent !== null) ctx.focusValue(parent);
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
  };

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) ctx.onItemFocus(value);
  };

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isCurrent ? true : undefined}
      className={cn(
        // The focus ring is drawn on the row: an outline on the treeitem would surround its
        // whole subtree.
        'block outline-none',
        '[&:focus-visible>[data-tree-row]]:outline-2 [&:focus-visible>[data-tree-row]]:-outline-offset-2 [&:focus-visible>[data-tree-row]]:outline-ring',
        className,
      )}
      {...rest}
      // Named by its label only: the treeitem also contains its icon and its child group. A
      // consumer aria-labelledby or aria-label replaces it.
      aria-labelledby={
        rest['aria-labelledby'] ?? (rest['aria-label'] === undefined ? labelId : undefined)
      }
      aria-expanded={hasChildren ? isExpanded : undefined}
      tabIndex={ctx.getTabIndex(value)}
      data-roving-value={value}
      data-selected={isSelected ? '' : undefined}
      data-current={isCurrent ? '' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={composeEventHandlers(onFocus, handleFocus, { checkDefaultPrevented: false })}
      ref={ref}
    >
      <div
        data-tree-row=""
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-subtle-hover',
          isSelected && cn('bg-subtle-selected font-semibold', forcedColors.selectedContainer),
        )}
      >
        {hasChildren ? (
          <ChevronRightIcon
            className={cn(
              'shrink-0 transition-transform motion-reduce:transition-none',
              isExpanded ? 'rotate-90' : 'wave-rtl:-scale-x-100',
            )}
          />
        ) : (
          <span className="w-3 shrink-0" aria-hidden="true" />
        )}
        {iconNode}
        <span id={labelId} data-tree-label="" data-roving-text={typeaheadText} className="truncate">
          <TreeLabelContext.Provider value>{labelContent}</TreeLabelContext.Provider>
        </span>
      </div>
      {hasChildren && isExpanded && (
        <TreeParentContext.Provider value={value}>
          <TreeLabelContext.Provider value={false}>
            <div role="group" className="ps-4">
              {nestedItems}
            </div>
          </TreeLabelContext.Provider>
        </TreeParentContext.Provider>
      )}
    </div>
  );
};
TreeItem.displayName = 'TreeItem';

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

/**
 * A hierarchical list (WAI-ARIA Tree View pattern) with a single tab stop: Up/Down move between
 * visible items, Home/End to the first/last, Right expands or moves to the first child, Left
 * collapses or moves to the parent (both mirrored in RTL), Enter/Space activate (and toggle a
 * parent), `*` expands the siblings, and typing jumps to an item by its text.
 *
 * Keyboard focus enters at the `selected` item, else the first item; while focus is inside, the
 * tab stop follows it, so Shift+Tab leaves the tree.
 *
 * Items are `Tree.Item` elements; nested items are written in their parent's children (directly,
 * in Fragments, or returned by a render function), not rendered by a component of their own.
 * Every item needs a `value` that is unique within the Tree.
 *
 * `Tree.Item` is also exported as `TreeItem` for React Server Components, which cannot use the
 * dotted form.
 */
export const Tree = /* @__PURE__ */ Object.assign(TreeRoot, {
  Item: TreeItem,
});

export { TreeItem };
