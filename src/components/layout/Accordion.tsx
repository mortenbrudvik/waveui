import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnDeprecated, warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import type { SelectionMode } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/** Heading level of the element that wraps each Accordion trigger. */
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/* ------------------------------------------------------------------ */
/*  Contexts                                                           */
/* ------------------------------------------------------------------ */

interface AccordionContextValue {
  openItems: readonly string[];
  toggle: (value: string) => void;
  baseId: string;
  headingLevel: AccordionHeadingLevel;
}

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
  /** Id of the trigger button: the consumer `id` of the Item's Trigger, else a generated one. */
  triggerId: string;
  /** Id of the panel region: the consumer `id` of the Item's Panel, else a generated one. */
  panelId: string;
  /** Whether the Item renders a panel region while open (a Panel, or other content). */
  hasPanelContent: boolean;
  headingLevel: AccordionHeadingLevel;
  toggle: () => void;
}

/**
 * What an Accordion.Panel renders after its own children. Kept out of the item context, so a new
 * `extra` (a new array on every Item render) re-renders only the Panel.
 */
interface AccordionPanelSlotValue {
  /** Children of the Item that are neither Trigger nor Panel: rendered after the Panel content. */
  extra: React.ReactNode;
  /** `true` inside a Panel's content, where a Trigger or Panel is misplaced. */
  inPanel: boolean;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);
const AccordionPanelSlotContext = React.createContext<AccordionPanelSlotValue | null>(null);

const EMPTY: readonly string[] = [];

const INERT_ACCORDION: AccordionContextValue = {
  openItems: EMPTY,
  toggle: () => {},
  baseId: 'wave-accordion-inert',
  headingLevel: 3,
};

const INERT_ITEM: AccordionItemContextValue = {
  value: '',
  isOpen: false,
  triggerId: 'wave-accordion-inert-trigger',
  panelId: 'wave-accordion-inert-panel',
  hasPanelContent: false,
  headingLevel: 3,
  toggle: () => {},
};

const IN_PANEL: AccordionPanelSlotValue = { extra: null, inPanel: true };

/** C-CONTEXT: throws in development, logs and returns an inert value in production. */
function guardContext<T>(value: T | null, component: string, parent: string, inert: T): T {
  if (value) return value;
  const message = `[WaveUI] ${component} must be used within <${parent}>.`;
  if (isDev) throw new Error(message);
  console.error(message);
  return inert;
}

function useAccordionContext(component: string): AccordionContextValue {
  return guardContext(React.useContext(AccordionContext), component, 'Accordion', INERT_ACCORDION);
}

function useAccordionItemContext(component: string): AccordionItemContextValue {
  return guardContext(
    React.useContext(AccordionItemContext),
    component,
    'Accordion.Item',
    INERT_ITEM,
  );
}

/**
 * Encodes an item value for use inside a DOM id without collisions: every character outside
 * `[A-Za-z0-9-]` (including `_`) becomes `_<hex code>_`, so `'a b'`, `'a.b'` and `'a_b'` stay
 * distinct.
 */
function encodeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16)}_`);
}

/** The one id helper (C-IDS): `${baseId}-${part}-${encoded value}`; `baseId` comes from `useId`. */
function getAccordionId(baseId: string, part: 'trigger' | 'panel', value: string): string {
  return `${baseId}-${part}-${encodeIdPart(value)}`;
}

/* ------------------------------------------------------------------ */
/*  Accordion                                                          */
/* ------------------------------------------------------------------ */

interface AccordionBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Level of the heading element (`<h1>`–`<h6>`) that wraps every trigger button (WAI-ARIA
   * Accordion pattern). Each `Accordion.Item` can override it.
   * @default 3
   */
  headingLevel?: AccordionHeadingLevel;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Props of an Accordion in which at most one item is open (the default). */
export interface AccordionSingleProps extends AccordionBaseProps {
  /**
   * Whether only one or multiple items can be open at a time.
   * @default 'single'
   */
  type?: Extract<SelectionMode, 'single'>;
  /** Controlled open item (`null`: every item closed). */
  openItem?: string | null;
  /** Initially open item for uncontrolled usage. */
  defaultOpenItem?: string | null;
  /** Called with the new open item (`null` when it closed) when it changes. */
  onOpenItemChange?: (openItem: string | null) => void;
  /** @deprecated Use `openItem` (single mode); `openItems` belongs to `type="multiple"`. */
  openItems?: string[];
  /**
   * @deprecated Use `defaultOpenItem` (single mode); `defaultOpenItems` belongs to
   * `type="multiple"`.
   */
  defaultOpenItems?: string[];
  /**
   * @deprecated Use `onOpenItemChange` (single mode); `onOpenItemsChange` belongs to
   * `type="multiple"`.
   */
  onOpenItemsChange?: (openItems: string[]) => void;
}

/** Props of an Accordion in which any number of items can be open. */
export interface AccordionMultipleProps extends AccordionBaseProps {
  /** Whether only one or multiple items can be open at a time. */
  type: Extract<SelectionMode, 'multiple'>;
  /** Controlled array of open item values. */
  openItems?: string[];
  /**
   * Initially open items for uncontrolled usage.
   * @default []
   */
  defaultOpenItems?: string[];
  /** Called with the new open items when they change. */
  onOpenItemsChange?: (openItems: string[]) => void;
  openItem?: never;
  defaultOpenItem?: never;
  onOpenItemChange?: never;
}

/**
 * Properties for the Accordion component: a discriminated union on `type`. Single mode
 * (default) uses `openItem`/`defaultOpenItem`/`onOpenItemChange`; `type="multiple"` uses
 * `openItems`/`defaultOpenItems`/`onOpenItemsChange`.
 *
 * A union cannot be extended by an `interface` (TS2312), which 0.4's interface allowed: extend
 * `AccordionSingleProps` or `AccordionMultipleProps` instead
 * (`interface MyProps extends AccordionSingleProps {}`), or intersect the union
 * (`type MyProps = AccordionProps & { … }`).
 */
export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

function toItems(value: string | null | undefined): readonly string[] | undefined {
  if (value === undefined) return undefined;
  return value === null ? EMPTY : [value];
}

/**
 * A vertically stacked set of disclosure sections (WAI-ARIA Accordion pattern). Each
 * `Accordion.Item` renders an `Accordion.Trigger` button inside a heading (`headingLevel`) and an
 * `Accordion.Panel` region that is shown while the item is open.
 *
 * Sub-components are also exported under flat names (`AccordionItem`, `AccordionTrigger`,
 * `AccordionPanel`) for React Server Components, which cannot use the dotted form.
 */
const AccordionRoot = (props: AccordionProps) => {
  const {
    type,
    openItem,
    defaultOpenItem,
    onOpenItemChange,
    openItems: openItemsProp,
    defaultOpenItems,
    onOpenItemsChange,
    headingLevel = 3,
    className,
    children,
    ref,
    ...rest
  } = props as Omit<AccordionSingleProps, 'type'> & { type?: SelectionMode };
  const multiple = type === 'multiple';

  if (!multiple) {
    if (openItemsProp !== undefined) {
      warnDeprecated(
        'Accordion',
        'openItems',
        'openItem',
        'In single mode the Accordion takes one value.',
      );
    }
    if (defaultOpenItems !== undefined) {
      warnDeprecated(
        'Accordion',
        'defaultOpenItems',
        'defaultOpenItem',
        'In single mode the Accordion takes one value.',
      );
    }
    if (onOpenItemsChange !== undefined) {
      warnDeprecated(
        'Accordion',
        'onOpenItemsChange',
        'onOpenItemChange',
        'In single mode the Accordion reports one value.',
      );
    }
  }

  const controlledSingle = multiple ? undefined : openItem;
  const controlled = React.useMemo(
    () => toItems(controlledSingle) ?? openItemsProp,
    [controlledSingle, openItemsProp],
  );
  const [initialItems] = React.useState(
    () => (multiple ? undefined : toItems(defaultOpenItem)) ?? defaultOpenItems ?? EMPTY,
  );

  const handleChange = (next: readonly string[]) => {
    const list = [...next];
    if (!multiple) onOpenItemChange?.(list[0] ?? null);
    onOpenItemsChange?.(list);
  };

  const [openItems, setOpenItems] = useControllable<readonly string[]>(
    controlled,
    initialItems,
    handleChange,
  );

  const openCount = openItems.length;
  React.useEffect(() => {
    if (!multiple && openCount > 1) {
      warnOnce(
        'Accordion:single-multiple-open',
        `Accordion: type="single" allows one open item, but ${openCount} are open. Pass \`openItem\`, or use type="multiple".`,
      );
    }
  }, [multiple, openCount]);

  const toggle = React.useCallback(
    (value: string) => {
      setOpenItems((prev) => {
        if (prev.includes(value)) return prev.filter((v) => v !== value);
        return multiple ? [...prev, value] : [value];
      });
    },
    [multiple, setOpenItems],
  );

  const baseId = useId('accordion');
  const context = React.useMemo<AccordionContextValue>(
    () => ({ openItems, toggle, baseId, headingLevel }),
    [openItems, toggle, baseId, headingLevel],
  );

  return (
    <AccordionContext.Provider value={context}>
      {/* A nested Accordion's direct children are not inside the outer Item. */}
      <AccordionItemContext.Provider value={null}>
        <AccordionPanelSlotContext.Provider value={null}>
          <div ref={ref} className={cn('divide-y divide-border', className)} {...rest}>
            {children}
          </div>
        </AccordionPanelSlotContext.Provider>
      </AccordionItemContext.Provider>
    </AccordionContext.Provider>
  );
};
AccordionRoot.displayName = 'Accordion';

/* ------------------------------------------------------------------ */
/*  Accordion.Item                                                     */
/* ------------------------------------------------------------------ */

/** Properties for the AccordionItem sub-component. */
export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique value identifying this accordion item. */
  value: string;
  /** Heading level of this item's trigger; overrides the Accordion's `headingLevel`. */
  headingLevel?: AccordionHeadingLevel;
  /** Ref to the item `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Direct children with Fragments flattened (`null`, `undefined` and booleans dropped), each with
 * a key that is unique across the flattened list and keeps the consumer's own `key`.
 */
function flattenChildren(
  children: React.ReactNode,
  prefix = '',
): Array<{ key: string; node: React.ReactNode }> {
  const result: Array<{ key: string; node: React.ReactNode }> = [];
  React.Children.toArray(children).forEach((child, index) => {
    const key = `${prefix}${React.isValidElement(child) && child.key !== null ? child.key : index}`;
    if (
      React.isValidElement<{ children?: React.ReactNode }>(child) &&
      child.type === React.Fragment
    ) {
      result.push(...flattenChildren(child.props.children, `${key}/`));
    } else {
      result.push({ key, node: child });
    }
  });
  return result;
}

interface PartProps {
  id?: unknown;
  children?: unknown;
}

/**
 * The first element of `type` in `node`: the node itself, or an element found through Fragments
 * and the `children` of wrapper elements (a Tooltip around a Trigger). The search does not enter
 * `barrier` elements or a nested Accordion/Item, and cannot see what a component renders itself.
 */
function findPart(
  node: unknown,
  type: React.ElementType,
  barrier: React.ElementType,
): React.ReactElement<PartProps> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findPart(child, type, barrier);
      if (found) return found;
    }
    return undefined;
  }
  if (!React.isValidElement<PartProps>(node)) return undefined;
  if (node.type === type) return node;
  if (node.type === barrier || node.type === AccordionRoot || node.type === AccordionItem) {
    return undefined;
  }
  return findPart(node.props.children, type, barrier);
}

/**
 * The consumer `id` of a Trigger or Panel element, if it has one. An empty `id` counts as none,
 * here and where the Trigger and Panel render their id (`idProp || generated`).
 */
function idOf(element: React.ReactElement<PartProps> | undefined): string | undefined {
  const id = element?.props.id;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

function misplacedMessage(component: 'Accordion.Trigger' | 'Accordion.Panel'): string {
  return (
    `${component} was rendered inside the panel of an Accordion.Item, so it is not the item's ` +
    `${component === 'Accordion.Trigger' ? 'header' : 'panel'}. Place Accordion.Trigger and ` +
    'Accordion.Panel directly in Accordion.Item, in a Fragment, or in an element that wraps them ' +
    'as `children` (such as a Tooltip). The Item cannot see inside a component that renders them ' +
    'itself and treats that component as panel content.'
  );
}

/**
 * One section of an Accordion. Place an `Accordion.Trigger` and an `Accordion.Panel` inside it:
 * directly, in a Fragment, or in an element that wraps them as `children` (for example a Tooltip
 * around the Trigger). A component that renders a Trigger or Panel itself is not seen through: it
 * counts as panel content, and a development warning says so.
 *
 * Without a Trigger the item's `value` is the button label. Other children (plain text included)
 * are rendered in the panel, after the Panel's own content.
 */
const AccordionItem = ({
  value,
  headingLevel: headingLevelProp,
  className,
  children,
  ref,
  ...rest
}: AccordionItemProps) => {
  const accordion = useAccordionContext('Accordion.Item');
  const isOpen = accordion.openItems.includes(value);
  const { toggle: toggleValue, baseId } = accordion;
  const headingLevel = headingLevelProp ?? accordion.headingLevel;

  let triggerElement: React.ReactElement<PartProps> | undefined;
  let panelElement: React.ReactElement<PartProps> | undefined;
  const parts: React.ReactNode[] = [];
  const extra: React.ReactNode[] = [];
  for (const { key, node: child } of flattenChildren(children)) {
    const keyed = <React.Fragment key={key}>{child}</React.Fragment>;
    const trigger = findPart(child, AccordionTrigger, AccordionPanel);
    const panel = findPart(child, AccordionPanel, AccordionTrigger);
    if (trigger || panel) {
      triggerElement ??= trigger;
      panelElement ??= panel;
      parts.push(keyed);
    } else {
      extra.push(keyed);
    }
  }
  const hasTrigger = triggerElement !== undefined;
  const hasPanel = panelElement !== undefined;
  const triggerIdProp = idOf(triggerElement);
  const panelIdProp = idOf(panelElement);
  const hasPanelContent = hasPanel || extra.length > 0;
  const extraPanelContent = hasPanel && extra.length > 0 ? extra : null;

  const itemContext = React.useMemo<AccordionItemContextValue>(
    () => ({
      value,
      isOpen,
      triggerId: triggerIdProp ?? getAccordionId(baseId, 'trigger', value),
      panelId: panelIdProp ?? getAccordionId(baseId, 'panel', value),
      hasPanelContent,
      headingLevel,
      toggle: () => toggleValue(value),
    }),
    [value, isOpen, baseId, triggerIdProp, panelIdProp, hasPanelContent, headingLevel, toggleValue],
  );
  const panelSlot = React.useMemo<AccordionPanelSlotValue>(
    () => ({ extra: extraPanelContent, inPanel: false }),
    [extraPanelContent],
  );

  return (
    <AccordionItemContext.Provider value={itemContext}>
      <AccordionPanelSlotContext.Provider value={panelSlot}>
        <div ref={ref} data-state={isOpen ? 'open' : 'closed'} className={cn(className)} {...rest}>
          {hasTrigger ? null : <AccordionTrigger>{value}</AccordionTrigger>}
          {parts}
          {!hasPanel && extra.length > 0 ? <AccordionPanel>{extra}</AccordionPanel> : null}
        </div>
      </AccordionPanelSlotContext.Provider>
    </AccordionItemContext.Provider>
  );
};
AccordionItem.displayName = 'AccordionItem';

/* ------------------------------------------------------------------ */
/*  Accordion.Trigger                                                  */
/* ------------------------------------------------------------------ */

/** Properties for the AccordionTrigger sub-component (merged onto the trigger `<button>`). */
export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ref to the trigger `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * The button that opens and closes its Accordion.Item, wrapped in a heading (`headingLevel`).
 * Its props land on the `<button>`: `className` is merged (yours wins), `onClick` runs before the
 * toggle (call `event.preventDefault()` to keep the item as it is), `ref` receives the button, and
 * a non-empty `id` replaces the generated one (the panel's `aria-labelledby` follows it).
 */
const AccordionTrigger = ({
  id: idProp,
  className,
  children,
  onClick,
  ref,
  ...rest
}: AccordionTriggerProps) => {
  const item = useAccordionItemContext('Accordion.Trigger');
  const inPanel = React.useContext(AccordionPanelSlotContext)?.inPanel ?? false;
  React.useEffect(() => {
    if (inPanel) {
      warnOnce('Accordion.Trigger:inside-panel', misplacedMessage('Accordion.Trigger'));
    }
  }, [inPanel]);
  const Heading: `h${AccordionHeadingLevel}` = `h${item.headingLevel}`;
  const state = item.isOpen ? 'open' : 'closed';

  return (
    <Heading className="m-0">
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-body-1 font-semibold text-foreground',
          'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
          disabledStyles,
          focusRingInset,
          className,
        )}
        {...rest}
        // A misplaced Trigger (inside the panel) still toggles, but only the item's own trigger
        // carries the item's id and panel reference.
        id={idProp || (inPanel ? undefined : item.triggerId)}
        // Only a panel region the item renders is referenced (none without panel content).
        aria-controls={!inPanel && item.hasPanelContent ? item.panelId : undefined}
        aria-expanded={item.isOpen}
        data-state={state}
        onClick={composeEventHandlers(onClick, item.toggle)}
        ref={ref}
      >
        {children}
        <ChevronDownIcon
          size={16}
          className={cn(
            'shrink-0 transition-transform motion-reduce:transition-none',
            item.isOpen && 'rotate-180',
          )}
        />
      </button>
    </Heading>
  );
};
AccordionTrigger.displayName = 'AccordionTrigger';

/* ------------------------------------------------------------------ */
/*  Accordion.Panel                                                    */
/* ------------------------------------------------------------------ */

/** Properties for the AccordionPanel sub-component (merged onto the `role="region"` element). */
export interface AccordionPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the panel `<div role="region">`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The content region of an Accordion.Item, rendered only while the item is open and labelled by
 * its trigger. Its props (className merged, `ref`, `data-*`, handlers) land on the region, and a
 * non-empty `id` replaces the generated one (the trigger's `aria-controls` follows it).
 */
const AccordionPanel = ({ id: idProp, className, children, ref, ...rest }: AccordionPanelProps) => {
  const item = useAccordionItemContext('Accordion.Panel');
  const slot = React.useContext(AccordionPanelSlotContext);
  const inPanel = slot?.inPanel ?? false;
  React.useEffect(() => {
    if (inPanel) warnOnce('Accordion.Panel:inside-panel', misplacedMessage('Accordion.Panel'));
  }, [inPanel]);
  if (!item.isOpen) return null;
  if (inPanel) {
    // Misplaced: its content joins the enclosing region (one region and one panel id per item).
    return (
      <div className={cn(className)} {...rest} id={idProp || undefined} ref={ref}>
        {children}
      </div>
    );
  }
  return (
    <AccordionPanelSlotContext.Provider value={IN_PANEL}>
      <div
        role="region"
        className={cn('px-4 pb-3 text-body-1 text-muted-foreground', className)}
        {...rest}
        id={idProp || item.panelId}
        aria-labelledby={item.triggerId}
        data-state="open"
        ref={ref}
      >
        {children}
        {slot?.extra}
      </div>
    </AccordionPanelSlotContext.Provider>
  );
};
AccordionPanel.displayName = 'AccordionPanel';

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

/** Accordion compound component: `Accordion.Item`, `Accordion.Trigger`, `Accordion.Panel`. */
export const Accordion = /* @__PURE__ */ Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
});

export { AccordionItem, AccordionTrigger, AccordionPanel };
