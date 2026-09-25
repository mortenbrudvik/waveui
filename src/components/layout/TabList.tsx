import * as React from 'react';
import { flattenChildren, getElementType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import {
  reportMissingContext,
  resolveDeprecatedProp,
  warnDeprecated,
  warnOnce,
} from '../../lib/dev';
import { disabledStyles, focusRing, focusRingInset } from '../../lib/styles';
import type { Orientation } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { getPartId } from './disclosureIds';

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

type TabListPart = 'tab' | 'panel';

/**
 * The ids of the mounted Tabs and Panels by value. A Tab references a panel only while one with
 * its value is mounted (a TabList used as a filter bar has none), and each side references the
 * other's actual id, a consumer `id` included. Read with `useSyncExternalStore`.
 *
 * Before the TabList has mounted (server HTML, hydration and the first client render) the
 * registry is not ready and the static structure of the children stands in for it; once it is
 * ready, it alone decides, so a Panel that is in the element tree but never mounts (inside a
 * wrapper that renders nothing) is not referenced.
 */
interface TabListRegistry {
  /** Registers a mounted Tab or Panel; returns the unregister function. */
  register: (part: TabListPart, value: string, id: string) => () => void;
  /**
   * Id of the first mounted Tab or Panel with this value, `null` when none is mounted, or
   * `undefined` while the registry is not ready (use the static structure then).
   */
  get: (part: TabListPart, value: string) => string | null | undefined;
  /** Called by the TabList once it (and so every Tab and Panel mounted with it) has mounted. */
  markReady: () => void;
  subscribe: (listener: () => void) => () => void;
}

/** Tabs that share a value share one id, and are selected and tab stops together. */
function warnDuplicateTabValue(value: string): void {
  warnOnce(
    `TabList:duplicate:${value}`,
    `TabList: several tabs share the value "${value}". Tab values must be unique within a ` +
      'TabList; tabs with the same value share one id and are selected (and tab stops) together.',
  );
}

function createRegistry(): TabListRegistry {
  const entries: Record<TabListPart, Map<string, string[]>> = { tab: new Map(), panel: new Map() };
  const listeners = new Set<() => void>();
  let ready = false;
  const emit = () => {
    listeners.forEach((listener) => listener());
  };
  return {
    register(part, value, id) {
      const map = entries[part];
      const ids = map.get(value) ?? [];
      // Called from the part's layout effect (C-DEV). Two Panels may share a value (the Tab links
      // to the first mounted one); two Tabs may not.
      if (part === 'tab' && ids.length > 0) warnDuplicateTabValue(value);
      map.set(value, [...ids, id]);
      emit();
      return () => {
        const ids = [...(map.get(value) ?? [])];
        const index = ids.indexOf(id);
        if (index !== -1) ids.splice(index, 1);
        if (ids.length > 0) map.set(value, ids);
        else map.delete(value);
        emit();
      };
    },
    get: (part, value) => (ready ? (entries[part].get(value)?.[0] ?? null) : undefined),
    markReady() {
      if (ready) return;
      ready = true;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const INERT_REGISTRY: TabListRegistry = {
  register: () => () => {},
  get: () => undefined,
  markReady: () => {},
  subscribe: () => () => {},
};

/**
 * What the TabList's children show before anything mounts (server HTML and the first render):
 * found in the element tree through Fragments and the `children` of wrapper elements, but not
 * inside a component that renders a Tab or Panel itself (the registry covers those once mounted).
 */
interface TabListStructure {
  /** Value of the first Tab without `disabled`/`aria-disabled`: the uncontrolled default. */
  firstEnabled?: string;
  /** Consumer `id`s of Tabs, by value. */
  tabIds: Array<[string, string]>;
  /** Values of the Panels, each with its consumer `id` or `null`. */
  panels: Array<[string, string | null]>;
}

interface TabListContextValue {
  orientation: Orientation;
  /** Whether the tab with this value is the selected one (explicit value, else the tab stop). */
  isSelected: (value: string) => boolean;
  /** Activates a tab (click, or focus moved by the arrow keys). */
  select: (value: string) => void;
  getTabIndex: (value: string) => 0 | -1;
  /** The generated id of a Tab or Panel (used when it has no consumer `id`). */
  getGeneratedId: (part: TabListPart, value: string) => string;
  /**
   * Id of the Tab with this value before the TabList mounts: its consumer `id`, else the
   * generated one.
   */
  getStaticTabId: (value: string) => string;
  /**
   * Id of the Panel with this value before the TabList mounts, or `undefined` when the children
   * have none.
   */
  getStaticPanelId: (value: string) => string | undefined;
  registry: TabListRegistry;
}

const TabListContext = React.createContext<TabListContextValue | null>(null);

const INERT_CONTEXT: TabListContextValue = {
  orientation: 'horizontal',
  isSelected: () => false,
  select: () => {},
  getTabIndex: () => -1,
  getGeneratedId: (part, value) => `wave-tablist-inert-${part}-${value}`,
  getStaticTabId: (value) => `wave-tablist-inert-tab-${value}`,
  getStaticPanelId: () => undefined,
  registry: INERT_REGISTRY,
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
function useTabListContext(component: string): TabListContextValue {
  const context = React.useContext(TabListContext);
  if (context) return context;
  reportMissingContext(component, '<TabList>');
  return INERT_CONTEXT;
}

interface StructureProps {
  value?: unknown;
  id?: unknown;
  disabled?: unknown;
  'aria-disabled'?: unknown;
  children?: unknown;
}

/** Whether a Tab's props make it unavailable (it cannot be selected and is skipped by keys). */
function isUnavailable(props: StructureProps): boolean {
  const ariaDisabled = props['aria-disabled'];
  return props.disabled === true || ariaDisabled === true || ariaDisabled === 'true';
}

/** A consumer `id` that replaces the generated one: a non-empty string (`''` counts as none). */
function consumerId(id: unknown): string | null {
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Walks the element tree of the TabList's children (see {@link TabListStructure}). Parts are
 * identified through their element type, so parts written in a Server Component (lazy
 * references) count too. A `React.lazy` still loading (inside the consumer's own `<Suspense>`,
 * such as code-split panels in `TabList.Panels`) is no part and never suspends the TabList: its
 * children are walked instead. Runs during render only.
 */
function collectStructure(node: unknown, into: TabListStructure): TabListStructure {
  if (Array.isArray(node)) {
    node.forEach((child) => collectStructure(child, into));
    return into;
  }
  if (!React.isValidElement<StructureProps>(node)) return into;
  const { props } = node;
  const type = getElementType(node, { suspend: false });
  const value = typeof props.value === 'string' ? props.value : undefined;
  if (type === Tab) {
    if (value !== undefined) {
      if (into.firstEnabled === undefined && !isUnavailable(props)) into.firstEnabled = value;
      const id = consumerId(props.id);
      if (id !== null) into.tabIds.push([value, id]);
    }
    return into;
  }
  if (type === TabPanel) {
    if (value !== undefined) into.panels.push([value, consumerId(props.id)]);
    return into;
  }
  if (type === TabListRoot) return into;
  return collectStructure(props.children, into);
}

/**
 * Whether an element tree shows a Tab, or a Panel (`TabList.Panel` or `TabList.Panels`), found as
 * in {@link collectStructure}: through Fragments and the `children` of wrapper elements, not inside
 * a nested TabList or a component that renders the part itself.
 */
function containsPart(node: unknown, part: TabListPart): boolean {
  if (Array.isArray(node)) return node.some((child) => containsPart(child, part));
  if (!React.isValidElement<StructureProps>(node)) return false;
  const type = getElementType(node, { suspend: false });
  if (type === Tab) return part === 'tab';
  if (type === TabPanel || type === TabPanels) return part === 'panel';
  if (type === TabListRoot) return false;
  return containsPart(node.props.children, part);
}

/**
 * Whether a child of the TabList renders after the tablist: a Panel, `TabList.Panels`, or a
 * wrapper (an element, `Suspense`, an error boundary) that holds panels and no tab.
 */
function rendersAfterTablist(child: React.ReactNode): boolean {
  return containsPart(child, 'panel') && !containsPart(child, 'tab');
}

/**
 * Where the TabList renders its children: inside the `role="tablist"` element (`'tabs'`) or after
 * it (`'panels'`). A Panel that ends up inside the tablist warns in development.
 */
const TabListAreaContext = React.createContext<'tabs' | 'panels' | null>(null);

const PANEL_IN_TABLIST_MESSAGE =
  'TabList.Panel was rendered inside the role="tablist" element, where only tabs belong (axe ' +
  'aria-required-children). The TabList moves a Panel after the tablist when it is its child, or ' +
  'in a wrapper that holds no Tab, but it cannot see a Panel that a component renders itself, or ' +
  "separate a wrapper's Panels from its Tabs. Place such panels inside TabList.Panels, which " +
  'renders after the tablist.';

/* ------------------------------------------------------------------ */
/*  TabList                                                            */
/* ------------------------------------------------------------------ */

/** Properties for the TabList component. */
export interface TabListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /**
   * Controlled value of the selected tab (`''`: no tab selected). A controlled value that becomes
   * `undefined` also selects no tab: the TabList stays controlled.
   */
  value?: string;
  /**
   * Selected tab for uncontrolled usage. When it is omitted (or `''`), the first enabled tab
   * written in the TabList's children is selected, from the first render (and in server-rendered
   * HTML) on. Tabs written directly in the children, in Fragments or in wrapper elements that
   * pass them as `children` (such as a Tooltip) count; a tab rendered by a custom component that
   * renders `TabList.Tab` itself does not, even when it comes first in the DOM, so that server
   * and client pick the same tab. When every tab comes from such a component, the first enabled
   * tab in the DOM is selected once the tabs mount. To select a tab that a custom component
   * renders, pass `defaultValue`.
   */
  defaultValue?: string;
  /** Called with the new value when the selected tab changes (not when it is activated again). */
  onValueChange?: (value: string) => void;
  /**
   * Layout and arrow-key axis: `'horizontal'` (Left/Right, mirrored in RTL) or `'vertical'`
   * (Up/Down).
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /** @deprecated Use `value`. */
  selectedValue?: string;
  /** @deprecated Use `defaultValue`. */
  defaultSelectedValue?: string;
  /**
   * @deprecated Use `onValueChange`. Unlike `onValueChange`, it is called on every activation,
   * including a click on the tab that is already selected.
   */
  onTabSelect?: (value: string) => void;
  /** @deprecated Use `orientation="vertical"`. */
  vertical?: boolean;
  /** Ref to the `role="tablist"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

const TabListRoot = ({
  value: valueProp,
  defaultValue: defaultValueProp,
  onValueChange,
  orientation: orientationProp,
  selectedValue,
  defaultSelectedValue,
  onTabSelect,
  vertical,
  className,
  children,
  onKeyDown,
  onFocus,
  ref,
  ...rest
}: TabListProps) => {
  const value = resolveDeprecatedProp(
    'TabList',
    valueProp,
    selectedValue,
    'selectedValue',
    'value',
  );
  const defaultValue = resolveDeprecatedProp(
    'TabList',
    defaultValueProp,
    defaultSelectedValue,
    'defaultSelectedValue',
    'defaultValue',
  );
  const orientation =
    resolveDeprecatedProp<Orientation>(
      'TabList',
      orientationProp,
      vertical === undefined ? undefined : vertical ? 'vertical' : 'horizontal',
      'vertical',
      'orientation',
    ) ?? 'horizontal';
  if (onTabSelect) {
    warnDeprecated(
      'TabList',
      'onTabSelect',
      'onValueChange',
      '`onValueChange` is called only when the selected tab changes.',
    );
  }

  // The sticky mode: a controlled value that becomes `undefined` clears the selection (`''`).
  const [selected, setSelected, isControlled] = useControllable(
    value,
    defaultValue ?? '',
    onValueChange,
  );

  // The children are a new element tree on every parent render: memoized by content, so the
  // context value stays stable while the tabs and panels stay the same.
  const structureKey = JSON.stringify(collectStructure(children, { tabIds: [], panels: [] }));
  const structure = React.useMemo(() => {
    const parsed = JSON.parse(structureKey) as TabListStructure;
    return {
      firstEnabled: parsed.firstEnabled,
      tabIds: new Map(parsed.tabIds),
      panels: new Map(parsed.panels),
    };
  }, [structureKey]);

  // Uncontrolled without a selection: the first enabled tab is selected. It is the tab stop the
  // roving store resolves from `activeValue` (the first enabled tab of the children, replaced by
  // the first enabled tab in the DOM once the store sees it disabled), so the selection is
  // derived during render, present from the first render on, and follows tabs that disable
  // themselves.
  const derivesSelection = !isControlled && selected === '';

  const { containerProps, getTabIndex } = useRovingTabIndex({
    activeValue: derivesSelection ? (structure.firstEnabled ?? null) : selected,
    orientation,
    loop: true,
    // Automatic activation (APG Tabs): moving focus selects the tab.
    onFocusMove: (next) => select(next),
  });

  const isSelected = React.useCallback(
    (tabValue: string) => (derivesSelection ? getTabIndex(tabValue) === 0 : selected === tabValue),
    [derivesSelection, getTabIndex, selected],
  );

  const select = useEventCallback((next: string) => {
    onTabSelect?.(next);
    if (!isSelected(next)) setSelected(next);
  });

  const baseId = useId('tablist');
  const [registry] = React.useState(createRegistry);
  // Runs after the layout effects of the Tabs and Panels mounted with the TabList, which have
  // registered by then: from here on the registry, not the static structure, decides the links.
  React.useLayoutEffect(() => registry.markReady(), [registry]);
  const context = React.useMemo<TabListContextValue>(
    () => ({
      orientation,
      isSelected,
      select,
      getTabIndex,
      getGeneratedId: (part, itemValue) => getPartId(baseId, part, itemValue),
      getStaticTabId: (tabValue) =>
        structure.tabIds.get(tabValue) ?? getPartId(baseId, 'tab', tabValue),
      getStaticPanelId: (tabValue) => {
        const panel = structure.panels.get(tabValue);
        if (panel === undefined) return undefined;
        return panel ?? getPartId(baseId, 'panel', tabValue);
      },
      registry,
    }),
    [orientation, isSelected, select, getTabIndex, baseId, structure, registry],
  );

  const mergedRef = useMergedRefs<HTMLDivElement>(ref, containerProps.ref);

  const tabs: React.ReactNode[] = [];
  const panels: React.ReactNode[] = [];
  flattenChildren(children).forEach(({ key, node: child }) => {
    const keyed = <React.Fragment key={key}>{child}</React.Fragment>;
    (rendersAfterTablist(child) ? panels : tabs).push(keyed);
  });

  const isVertical = orientation === 'vertical';
  return (
    <TabListContext.Provider value={context}>
      <div className={cn(isVertical && 'flex')}>
        <div
          role="tablist"
          aria-orientation={orientation}
          className={cn(
            isVertical
              ? 'flex w-40 flex-col border-e border-border'
              : 'flex border-b border-border',
            className,
          )}
          {...rest}
          data-roving-container=""
          onKeyDown={composeEventHandlers(onKeyDown, containerProps.onKeyDown)}
          onFocus={composeEventHandlers(onFocus, containerProps.onFocus, {
            checkDefaultPrevented: false,
          })}
          ref={mergedRef}
        >
          <TabListAreaContext.Provider value="tabs">{tabs}</TabListAreaContext.Provider>
        </div>
        <TabListAreaContext.Provider value="panels">{panels}</TabListAreaContext.Provider>
      </div>
    </TabListContext.Provider>
  );
};
TabListRoot.displayName = 'TabList';

/* ------------------------------------------------------------------ */
/*  TabList.Tab                                                        */
/* ------------------------------------------------------------------ */

/** Properties for the Tab sub-component. */
export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Unique value identifying this tab (and its panel). */
  value: string;
  /** Ref to the tab `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * A tab button. `onClick` runs before the selection (call `event.preventDefault()` to keep the
 * current tab). A `disabled` (or `aria-disabled="true"`) tab is skipped by the keyboard and cannot
 * be selected. A non-empty `id` replaces the generated one (its panel's `aria-labelledby` follows
 * it). The selected tab references its panel with `aria-controls` only while a `TabList.Panel`
 * with its value is mounted.
 */
const Tab = ({ value, id: idProp, className, children, onClick, ref, ...rest }: TabProps) => {
  const ctx = useTabListContext('TabList.Tab');
  const selected = ctx.isSelected(value);
  const isVertical = ctx.orientation === 'vertical';
  const unavailable = isUnavailable(rest);

  const { registry } = ctx;
  const id = consumerId(idProp) ?? ctx.getGeneratedId('tab', value);
  React.useLayoutEffect(() => registry.register('tab', value, id), [registry, value, id]);
  const mountedPanelId = React.useSyncExternalStore(
    registry.subscribe,
    () => registry.get('panel', value),
    () => undefined,
  );
  // Before the TabList mounts the static structure stands in; after that only a mounted panel is
  // referenced (`null`: none).
  const panelId =
    mountedPanelId === undefined ? ctx.getStaticPanelId(value) : (mountedPanelId ?? undefined);

  return (
    <button
      type="button"
      role="tab"
      className={cn(
        'px-4 py-2 text-body-1 font-semibold transition-colors motion-reduce:transition-none',
        isVertical && 'text-start',
        selected
          ? cn(
              'text-primary',
              isVertical ? 'border-s-2 border-s-primary' : 'border-b-2 border-b-primary',
            )
          : 'text-muted-foreground not-disabled:not-aria-disabled:hover:text-foreground',
        disabledStyles,
        focusRingInset,
        className,
      )}
      {...rest}
      id={id}
      aria-selected={selected}
      aria-controls={selected ? panelId : undefined}
      tabIndex={ctx.getTabIndex(value)}
      data-roving-value={value}
      data-selected={selected ? '' : undefined}
      onClick={composeEventHandlers(onClick, () => {
        if (!unavailable) ctx.select(value);
      })}
      ref={ref}
    >
      {children}
    </button>
  );
};
Tab.displayName = 'Tab';

/* ------------------------------------------------------------------ */
/*  TabList.Panel                                                      */
/* ------------------------------------------------------------------ */

/** Properties for the TabPanel sub-component. */
export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value of the Tab that shows this panel. */
  value: string;
  /** Ref to the `role="tabpanel"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The content of one tab, rendered only while its tab is selected and labelled by it (while a Tab
 * with its value is mounted). A non-empty `id` replaces the generated one (the tab's
 * `aria-controls` follows it).
 */
const TabPanel = ({ value, id: idProp, children, className, ref, ...rest }: TabPanelProps) => {
  const ctx = useTabListContext('TabList.Panel');
  const insideTablist = React.useContext(TabListAreaContext) === 'tabs';
  React.useEffect(() => {
    if (insideTablist) warnOnce('TabList.Panel:inside-tablist', PANEL_IN_TABLIST_MESSAGE);
  }, [insideTablist]);
  const { registry } = ctx;
  const id = consumerId(idProp) ?? ctx.getGeneratedId('panel', value);
  // Registered while mounted, also while hidden: the tab that selects it links to it.
  React.useLayoutEffect(() => registry.register('panel', value, id), [registry, value, id]);
  const mountedTabId = React.useSyncExternalStore(
    registry.subscribe,
    () => registry.get('tab', value),
    () => undefined,
  );
  if (!ctx.isSelected(value)) return null;
  // As for the Tab's aria-controls: the static structure only before the TabList mounts.
  const tabId =
    mountedTabId === undefined ? ctx.getStaticTabId(value) : (mountedTabId ?? undefined);
  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={cn('p-4', focusRing, className)}
      {...rest}
      id={id}
      aria-labelledby={tabId}
      ref={ref}
    >
      {children}
    </div>
  );
};
TabPanel.displayName = 'TabPanel';

/* ------------------------------------------------------------------ */
/*  TabList.Panels                                                     */
/* ------------------------------------------------------------------ */

/** Properties for the TabPanels sub-component. */
export interface TabPanelsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the container `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Optional container for the panels, rendered after the tablist. Use it to style the panel area,
 * and for panels that components render themselves: the TabList finds a Panel in its children, in
 * a Fragment or in a wrapper that holds no Tab, but a component that renders a Panel itself
 * renders inside the tablist unless it is placed in `TabList.Panels`.
 */
const TabPanels = ({ className, children, ref, ...rest }: TabPanelsProps) => (
  <div ref={ref} className={cn('min-w-0 flex-1', className)} {...rest}>
    {children}
  </div>
);
TabPanels.displayName = 'TabPanels';

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

/**
 * A set of tabs with their panels (WAI-ARIA Tabs pattern, automatic activation): the arrow keys
 * (Left/Right, mirrored in RTL; Up/Down when vertical), Home and End move focus and select; the
 * selected tab is the only tab stop; disabled tabs are skipped. Every tab needs a `value` that is
 * unique within the TabList (a development warning names a value that several tabs share).
 *
 * Tabs register through context and are found in DOM order, so they may be wrapped (a Fragment,
 * a Tooltip). The children render inside the `role="tablist"` element, except panels, which render
 * after it: a `TabList.Panel` or `TabList.Panels` child, or a wrapper (an element, `Suspense`, an
 * error boundary) that holds panels and no Tab. A Panel that a component renders itself cannot be
 * seen from the children: put that component inside `TabList.Panels` (a development warning names
 * a Panel that ends up inside the tablist). Content that is not a tab, such as a button next to
 * the tabs, does not belong in a tablist either: render it outside the TabList.
 *
 * Sub-components are also exported under flat names (`TabListTab`, `TabListPanel`,
 * `TabListPanels`) for React Server Components, which cannot use the dotted form.
 */
export const TabList = /* @__PURE__ */ Object.assign(TabListRoot, {
  Tab,
  Panel: TabPanel,
  Panels: TabPanels,
});

export { Tab as TabListTab, TabPanel as TabListPanel, TabPanels as TabListPanels };
