import * as React from 'react';
import { wcn } from '../../lib/cn';
import { navClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import {
  NAV_SHOWN_PART_LOCKS,
  NavContext,
  createCategoryStore,
  findCategoriesContaining,
  useNavListChildCheck,
  type NavCategoryToggleDetails,
  type NavContextValue,
  type NavDensity,
  type NavSelectDetails,
  type NavValueKind,
} from './Nav.context';
import { useAppClassName } from '../../hooks/useAppClassName';

export type { NavCategoryToggleDetails, NavDensity, NavSelectDetails } from './Nav.context';

/*
 * The Nav root, and `useNavRootState`, the one state model of Nav and NavDrawer: the selection,
 * the open categories, the duplicate-value registry and the category store. `Nav.tsx` attaches the
 * parts to `NavRoot` and re-exports `NavProps`; NavDrawer renders the state in its own panel.
 * Imports no part (the walks recognise them by their markers, `Nav.context.ts`).
 */

/** Properties for the Nav component. */
export interface NavProps extends Omit<React.HTMLAttributes<HTMLElement>, 'defaultValue'> {
  /** Controlled value of the selected nav item. */
  value?: string;
  /**
   * Selected nav item value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /**
   * Called with the new value when the selection changes (not when the current item is
   * re-selected), and with `details`: the `event` (the click) and the `category` the item sits in
   * (Fluent's `onNavItemSelect(event, { value, categoryValue })`). `details` is optional in the
   * type for code written before it existed; WaveUI always passes it.
   */
  onValueChange?: (value: string, details?: NavSelectDetails) => void;
  /** Controlled list of open category values. */
  openCategories?: readonly string[];
  /**
   * Categories open initially (uncontrolled). Without it, the categories that contain the
   * selected item (`value`, else `defaultValue`) start open, so the current page is visible on the
   * first render; an empty list keeps every category closed.
   */
  defaultOpenCategories?: readonly string[];
  /**
   * Called with the new list of open category values (a new array) when a category is toggled, and
   * with `details`: the `event` (the click), the toggled `category` and whether it is now `open`
   * (Fluent's `onNavCategoryItemToggle(event, { categoryValue })`). `details` is optional in the
   * type for code written before it existed; WaveUI always passes it.
   */
  onOpenCategoriesChange?: (openCategories: string[], details?: NavCategoryToggleDetails) => void;
  /**
   * Keep at most one category open (Fluent's `multiple`, which is `true` by default): opening a
   * category closes the one that was open, and a Nav that starts with several open
   * (`defaultOpenCategories`, or the categories that contain the selected item) keeps the first.
   * A controlled `openCategories` is yours: it is not trimmed, and the next toggle replaces it
   * (opening a category gives `[category]`, closing an open one removes only it).
   * @default true
   */
  multiple?: boolean;
  /**
   * How tightly the items and category buttons are set (Fluent's `density`): `medium` rows are
   * 36px high (28px for a sub-item) and `small` ones 8px shorter, with the same text and
   * indentation. Rendered as `data-density`.
   * @default 'medium'
   */
  density?: NavDensity;
  /**
   * The `value` of the category that contains the current item, for sub-items Nav cannot find by
   * itself (rendered by your own component inside a closed category). Usually not needed: Nav
   * finds sub-items among a category's children (through Fragments and wrapper elements) and
   * remembers the category of the current sub-item once it has been shown. A hint, not state:
   * unlike Fluent's `selectedCategoryValue` it has no default or change callback.
   */
  currentCategory?: string;
  /** Ref to the `<nav>` element. */
  ref?: React.Ref<HTMLElement>;
  /**
   * Props for the list the Nav draws inside its landmark, merged into its own: your classes after
   * its classes (yours win a conflict), your styles, attributes and handlers added, your ref beside
   * its ref. Every attribute it sets is locked and keeps the Nav's value. A part takes no
   * `children` (they are the Nav's). No handler of the Nav sits on the list: the events of the
   * items reach yours after their own handling. The `<nav>` takes the Nav's own props. Fluent UI
   * has no such part: its `Nav` holds the items itself.
   */
  slotProps?: {
    /**
     * The `<ul>` of the items (stable class `wave-nav__list`). Locked: no role (it stays a list
     * for its list items), no tab index and no roving container's marker, and no `hidden`, `inert`
     * or `aria-hidden`, since it holds the items.
     */
    list?: SlotPart<'ul'>;
  };
}

/** What useNavRootState reads: the root's props, with the defaults already applied. */
export interface UseNavRootStateOptions {
  /** The public component: the key and text prefix of the duplicate-value warnings. */
  componentName: string;
  /** Controlled selected value (`undefined`: uncontrolled). */
  value: string | undefined;
  /** Initial selected value of an uncontrolled root (`''`: nothing selected). */
  defaultValue: string;
  /** Called with the new value when it changes (`useControllable`), with the details. */
  onValueChange: ((value: string, details?: NavSelectDetails) => void) | undefined;
  /**
   * Called on every activation, re-selection included, after the value update (NavDrawer's
   * `onItemSelect`; Nav has no such callback).
   */
  onActivate?: (value: string, details?: NavSelectDetails) => void;
  /** Controlled list of open category values (`undefined`: uncontrolled). */
  openCategories: readonly string[] | undefined;
  /** Categories open initially; without it, the categories that contain the selected value. */
  defaultOpenCategories: readonly string[] | undefined;
  /** Called with the new list of open category values (a new array) and the details. */
  onOpenCategoriesChange:
    ((openCategories: string[], details?: NavCategoryToggleDetails) => void) | undefined;
  /** At most one open category (`multiple` off). @default false */
  singleOpen?: boolean;
  /** How tightly the rows are set. @default 'medium' */
  density?: NavDensity;
  /** The value of the category that contains the current item (the root's hint). */
  currentCategory: string | undefined;
  /**
   * Scanned once, at mount, for the categories that contain the selected value (when
   * `defaultOpenCategories` is absent).
   */
  children: React.ReactNode;
}

/** Warns once per duplicated value; `componentName` is the key and text prefix. */
function warnDuplicateValue(componentName: string, kind: NavValueKind, value: string): void {
  warnOnce(
    `${componentName}:duplicate-${kind}:${value}`,
    kind === 'item'
      ? `${componentName}: several items share the value "${value}". Nav.Item and Nav.SubItem values must be unique within a ${componentName}; every item with the current value is marked as the current page.`
      : `${componentName}: several categories share the value "${value}". Nav.Category values must be unique within a ${componentName}; they open and close together.`,
  );
}

/**
 * The state of a Nav root (Nav, NavDrawer). Returns the context value to provide through
 * `NavContext`, memoised: the same object while none of its fields changes.
 *
 * - The selection through `useControllable` (`onValueChange` only on a change); `select` sets the
 *   value, then calls `onActivate` on every activation.
 * - The open categories through `useControllable` (a new array to `onOpenCategoriesChange`),
 *   initially `defaultOpenCategories`, else the categories that contain `value ?? defaultValue`,
 *   found once in `children` (through Fragments and wrapper elements; parts written in a Server
 *   Component included).
 * - The duplicate-value registry (`${componentName}:duplicate-item:<value>` and
 *   `…:duplicate-category:<value>`, once per value) and the category store.
 */
export function useNavRootState({
  componentName,
  value: controlledValue,
  defaultValue,
  onValueChange,
  onActivate,
  openCategories: openCategoriesProp,
  defaultOpenCategories,
  onOpenCategoriesChange,
  singleOpen = false,
  density = 'medium',
  currentCategory,
  children,
}: UseNavRootStateOptions): NavContextValue {
  // The details of the request behind a change, written around the setter that `useControllable`
  // calls `onChange` inside of (synchronously, only on a change) and cleared right after.
  const selectDetailsRef = React.useRef<NavSelectDetails | undefined>(undefined);
  const [value, setValue] = useControllable(controlledValue, defaultValue, (next: string) =>
    onValueChange?.(next, selectDetailsRef.current),
  );
  const notifyActivate = useEventCallback(onActivate);
  const select = React.useCallback(
    (next: string, details?: NavSelectDetails) => {
      selectDetailsRef.current = details;
      try {
        setValue(next);
      } finally {
        selectDetailsRef.current = undefined;
      }
      // Event-named callback: every activation, re-selection included (C-NAMING).
      notifyActivate(next, details);
    },
    [setValue, notifyActivate],
  );

  const [initialOpenCategories] = React.useState<readonly string[]>(() => {
    const initial =
      defaultOpenCategories ?? findCategoriesContaining(children, controlledValue ?? defaultValue);
    return singleOpen ? initial.slice(0, 1) : initial;
  });
  const toggleDetailsRef = React.useRef<NavCategoryToggleDetails | undefined>(undefined);
  const [openCategories, setOpenCategories] = useControllable<readonly string[]>(
    openCategoriesProp,
    initialOpenCategories,
    (next) => onOpenCategoriesChange?.([...next], toggleDetailsRef.current),
  );
  const toggleCategory = React.useCallback(
    (category: string, event?: Event) => {
      try {
        setOpenCategories((previous) => {
          const open = !previous.includes(category);
          toggleDetailsRef.current = { event: event ?? new Event('click'), category, open };
          if (!open) return previous.filter((entry) => entry !== category);
          return singleOpen ? [category] : [...previous, category];
        });
      } finally {
        toggleDetailsRef.current = undefined;
      }
    },
    [setOpenCategories, singleOpen],
  );

  // Duplicate values (C-DEV): the mounted items and categories per value (written from their
  // effects only); a second one with a value already in use warns once per value.
  const valueCountsRef = React.useRef<Map<string, number> | null>(null);
  const registerValue = React.useCallback(
    (kind: NavValueKind, entry: string) => {
      const counts = (valueCountsRef.current ??= new Map<string, number>());
      const key = `${kind}:${entry}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      if (count > 1) warnDuplicateValue(componentName, kind, entry);
      return () => {
        const remaining = (counts.get(key) ?? 1) - 1;
        if (remaining > 0) counts.set(key, remaining);
        else counts.delete(key);
      };
    },
    [componentName],
  );

  const [categoryStore] = React.useState(createCategoryStore);

  return React.useMemo<NavContextValue>(
    () => ({
      value,
      select,
      openCategories,
      toggleCategory,
      density,
      registerValue,
      currentCategory,
      categoryStore,
    }),
    [
      value,
      select,
      openCategories,
      toggleCategory,
      density,
      registerValue,
      currentCategory,
      categoryStore,
    ],
  );
}

export const NavRoot = ({
  value,
  defaultValue,
  onValueChange,
  openCategories,
  defaultOpenCategories,
  onOpenCategoriesChange,
  multiple = true,
  density = 'medium',
  currentCategory,
  className,
  children,
  ref,
  slotProps,
  ...rest
}: NavProps) => {
  const appClassName = useAppClassName(navClassNames.root);

  const contextValue = useNavRootState({
    componentName: 'Nav',
    value,
    defaultValue: defaultValue ?? '',
    onValueChange,
    openCategories,
    defaultOpenCategories,
    onOpenCategoriesChange,
    singleOpen: !multiple,
    density,
    currentCategory,
    children,
  });
  // Development only: every child of the list is an <li> (`Nav:list-child`).
  const listRef = React.useRef<HTMLUListElement>(null);
  // A part's ref joins the list's own after the spread: an inline ref never detaches it.
  const listMergedRef = useMergedRefs<HTMLUListElement>(listRef, slotProps?.list?.ref);
  useNavListChildCheck(listRef, 'Nav', 'items');

  return (
    <NavContext.Provider value={contextValue}>
      <nav
        aria-label="Navigation"
        data-density={density}
        {...rest}
        ref={ref}
        className={wcn(
          navClassNames.root,
          'wave:w-60 wave:border-e wave:border-border wave:bg-background wave:py-2',
          appClassName,
          className,
        )}
      >
        <ul
          {...mergeSlotProps(slotProps?.list, {
            className: wcn(navClassNames.list, 'wave:m-0 wave:list-none wave:p-0'),
            locked: NAV_SHOWN_PART_LOCKS,
          })}
          ref={listMergedRef}
        >
          {children}
        </ul>
      </nav>
    </NavContext.Provider>
  );
};
NavRoot.displayName = 'Nav';
