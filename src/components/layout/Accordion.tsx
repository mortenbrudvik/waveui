import * as React from 'react';
import { flattenChildren, getElementType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext, warnDeprecated, warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import type { SelectionMode } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { getPartId } from './disclosureIds';

/** Heading level of the element that wraps each Accordion trigger. */
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/* ------------------------------------------------------------------ */
/*  Contexts                                                           */
/* ------------------------------------------------------------------ */

interface AccordionContextValue {
  openItems: readonly string[];
  toggle: (value: string) => void;
  /** Counts a mounted Item's value (warns when several Items share it); returns the unregister. */
  registerItem: (value: string) => () => void;
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
  registerItem: () => () => {},
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

/**
 * `true` inside a wrapper component chain that holds only the item's Trigger (a Tooltip): the Item
 * renders the heading around the wrapper, so the Trigger renders its button without one.
 */
const AccordionHeadingOutsideContext = React.createContext(false);

/**
 * Classes of the heading around each trigger button. `grid` stretches its child to the full row,
 * so a wrapper between the heading and the button (a Tooltip's inline-block `<span>`) does not
 * shrink the full-width button and move its chevron away from the row end.
 */
const HEADING_CLASS = 'm-0 grid';

/**
 * C-CONTEXT: throws in development; in production logs once (`reportMissingContext`) and returns
 * the inert value.
 */
function useAccordionContext(component: string): AccordionContextValue {
  const context = React.useContext(AccordionContext);
  if (context) return context;
  reportMissingContext(component, '<Accordion>');
  return INERT_ACCORDION;
}

function useAccordionItemContext(component: string): AccordionItemContextValue {
  const context = React.useContext(AccordionItemContext);
  if (context) return context;
  reportMissingContext(component, '<Accordion.Item>');
  return INERT_ITEM;
}

function warnDuplicateValue(value: string): void {
  warnOnce(
    `Accordion:duplicate:${value}`,
    `Accordion: several items share the value "${value}". Item values must be unique within an ` +
      'Accordion; items with the same value open and close together and share their trigger and ' +
      'panel ids.',
  );
}

/* ------------------------------------------------------------------ */
/*  Accordion                                                          */
/* ------------------------------------------------------------------ */

/** Props shared by {@link AccordionSingleProps} and {@link AccordionMultipleProps}. */
export interface AccordionBaseProps extends React.HTMLAttributes<HTMLDivElement> {
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
  openItems?: readonly string[];
  /**
   * @deprecated Use `defaultOpenItem` (single mode); `defaultOpenItems` belongs to
   * `type="multiple"`.
   */
  defaultOpenItems?: readonly string[];
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
  /** Controlled array of open item values (a readonly array is accepted). */
  openItems?: readonly string[];
  /**
   * Initially open items for uncontrolled usage.
   * @default []
   */
  defaultOpenItems?: readonly string[];
  /** Called with the new open items (a new array) when they change. */
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

// The Accordion root, documented on the exported `Accordion` const.
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

  // How many mounted Items hold each value, to warn about a repeated value (R12). Only the Items'
  // effects touch it (through `registerItem`), never render.
  const itemCountsRef = React.useRef<Map<string, number>>(null);
  const registerItem = React.useCallback((value: string) => {
    itemCountsRef.current ??= new Map();
    const counts = itemCountsRef.current;
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > 1) warnDuplicateValue(value);
    return () => {
      const remaining = (counts.get(value) ?? 1) - 1;
      if (remaining > 0) counts.set(value, remaining);
      else counts.delete(value);
    };
  }, []);

  const baseId = useId('accordion');
  const context = React.useMemo<AccordionContextValue>(
    () => ({ openItems, toggle, registerItem, baseId, headingLevel }),
    [openItems, toggle, registerItem, baseId, headingLevel],
  );

  return (
    <AccordionContext.Provider value={context}>
      {/* A nested Accordion's direct children are not inside the outer Item. */}
      <AccordionItemContext.Provider value={null}>
        <AccordionPanelSlotContext.Provider value={null}>
          <AccordionHeadingOutsideContext.Provider value={false}>
            <div ref={ref} className={cn('divide-y divide-border', className)} {...rest}>
              {children}
            </div>
          </AccordionHeadingOutsideContext.Provider>
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

interface PartProps {
  id?: unknown;
  children?: unknown;
}

/**
 * The first `part` element in `node`: the node itself, or an element found through Fragments
 * and the `children` of wrapper elements (a Tooltip around a Trigger). The search does not enter
 * `barrier` elements or a nested Accordion/Item, and cannot see what a component renders itself.
 * Parts are identified by their unwrapped element type, so parts written in a Server Component
 * (lazy client references) are found too. A `React.lazy` still loading (content inside the
 * consumer's own `<Suspense>`) is no part and never suspends the Item: its children are searched.
 */
function findPart(
  node: unknown,
  part: React.ElementType,
  barrier: React.ElementType,
): React.ReactElement<PartProps> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findPart(child, part, barrier);
      if (found) return found;
    }
    return undefined;
  }
  if (!React.isValidElement<PartProps>(node)) return undefined;
  const type = getElementType(node, { suspend: false });
  if (type === part) return node;
  if (type === barrier || type === AccordionRoot || type === AccordionItem) return undefined;
  return findPart(node.props.children, part, barrier);
}

/**
 * The consumer `id` of a Trigger or Panel element, if it has one. An empty `id` counts as none,
 * here and where the Trigger and Panel render their id (`idProp || generated`).
 */
function idOf(element: React.ReactElement<PartProps> | undefined): string | undefined {
  const id = element?.props.id;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

/**
 * Whether `node` is a chain of wrapper components, each with the next as its only child, that ends
 * at an Accordion.Trigger: a Tooltip around the Trigger. The Item puts the heading around such a
 * chain instead of inside it, so no heading ends up in a wrapper's phrasing `<span>`. Elements
 * (`<div>`, `<span>`) render as written: the heading stays inside them.
 */
function wrapsTriggerOnly(node: unknown): boolean {
  if (!React.isValidElement<PartProps>(node)) return false;
  const type = getElementType(node, { suspend: false });
  if (
    typeof type === 'string' ||
    type === AccordionTrigger ||
    type === AccordionPanel ||
    type === AccordionRoot ||
    type === AccordionItem
  ) {
    return false;
  }
  const child = node.props.children as React.ReactNode;
  return getElementType(child, { suspend: false }) === AccordionTrigger || wrapsTriggerOnly(child);
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
 * The trigger button sits in a heading (`headingLevel`). A wrapper component whose only child is
 * the Trigger (a Tooltip, also several nested) goes inside that heading, around the button, so
 * the heading never ends up in the wrapper's inline `<span>` and the button keeps the full row.
 * An element such as a `<div>`, or a wrapper that holds more than the Trigger, renders as written,
 * with the heading inside it.
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
  const { toggle: toggleValue, baseId, registerItem } = accordion;
  React.useEffect(() => registerItem(value), [registerItem, value]);
  const headingLevel = headingLevelProp ?? accordion.headingLevel;
  const Heading: `h${AccordionHeadingLevel}` = `h${headingLevel}`;

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
      parts.push(
        wrapsTriggerOnly(child) ? (
          <Heading key={key} className={HEADING_CLASS}>
            <AccordionHeadingOutsideContext.Provider value={true}>
              {child}
            </AccordionHeadingOutsideContext.Provider>
          </Heading>
        ) : (
          keyed
        ),
      );
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
      triggerId: triggerIdProp ?? getPartId(baseId, 'trigger', value),
      panelId: panelIdProp ?? getPartId(baseId, 'panel', value),
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
 * The button that opens and closes its Accordion.Item, wrapped in a heading (`headingLevel`); when
 * it is the only child of a wrapper component in the Item (a Tooltip), the heading goes around
 * that wrapper instead (see `Accordion.Item`). Its props land on the `<button>`: `className` is
 * merged (yours wins), `onClick` runs before the toggle (call `event.preventDefault()` to keep the
 * item as it is), `ref` receives the button, and a non-empty `id` replaces the generated one (the
 * panel's `aria-labelledby` follows it).
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
  const headingOutside = React.useContext(AccordionHeadingOutsideContext);
  const Heading: `h${AccordionHeadingLevel}` = `h${item.headingLevel}`;
  const state = item.isOpen ? 'open' : 'closed';

  const button = (
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
  );
  // Inside a wrapper chain (a Tooltip) the Item has rendered the heading around the wrapper.
  return headingOutside ? button : <Heading className={HEADING_CLASS}>{button}</Heading>;
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

/**
 * A vertically stacked set of disclosure sections (WAI-ARIA Accordion pattern). Each
 * `Accordion.Item` renders an `Accordion.Trigger` button inside a heading (`headingLevel`) and an
 * `Accordion.Panel` region that is shown while the item is open.
 *
 * Single mode (the default) keeps at most one item open (`openItem`, `defaultOpenItem`,
 * `onOpenItemChange`); `type="multiple"` lets any number of items open (`openItems`,
 * `defaultOpenItems`, `onOpenItemsChange`). Each Item's `value` must be unique within its
 * Accordion: a development warning names a repeated value.
 *
 * Sub-components are also exported under flat names (`AccordionItem`, `AccordionTrigger`,
 * `AccordionPanel`) for React Server Components, which cannot use the dotted form.
 */
export const Accordion = /* @__PURE__ */ Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
});

export { AccordionItem, AccordionTrigger, AccordionPanel };
