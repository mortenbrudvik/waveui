import * as React from 'react';
import {
  accordionClassNames,
  accordionItemClassNames,
  accordionPanelClassNames,
  accordionTriggerClassNames,
} from '../../lib/classNames';
import { flattenChildren, getElementType } from '../../lib/children';
import { wcn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import type { HeadingLevel, MotionSlot, SelectionMode } from '../../lib/types';
import { useCollapsePresence } from '../../hooks/useCollapsePresence';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { getPartId } from './disclosureIds';

/** Heading level of the element that wraps each Accordion trigger: the shared {@link HeadingLevel}. */
export type AccordionHeadingLevel = HeadingLevel;

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
const HEADING_CLASS = 'wave:m-0 wave:grid';

/**
 * What the heading part locks unset: a role and a level (it stays the heading `headingLevel`
 * sets) and its hidden state (it holds the trigger).
 */
const HEADING_PART_LOCKS = {
  role: undefined,
  'aria-level': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/** What the chevron part locks: decorative, never a tab stop or focusable. */
const EXPAND_ICON_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'aria-hidden': true,
  focusable: 'false',
} as const;

/** The `blockHandlers` of the chevron of a disabled trigger: no click, as no toggle. */
const BLOCK_CLICK = ['onClick'] as const;

/**
 * The props of the heading around a trigger, its `slotProps.heading` merged in when given (the
 * Trigger renders the heading, or the Item around a wrapper of the Trigger).
 */
function headingProps(part: SlotPart<'h3'> | undefined): Record<string, unknown> {
  const className = wcn(accordionTriggerClassNames.heading, HEADING_CLASS);
  return part ? mergeSlotProps(part, { className, locked: HEADING_PART_LOCKS }) : { className };
}

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
  /** `type="multiple"` only: a single Accordion takes `openItem`. */
  openItems?: never;
  /** `type="multiple"` only: a single Accordion takes `defaultOpenItem`. */
  defaultOpenItems?: never;
  /** `type="multiple"` only: a single Accordion reports through `onOpenItemChange`. */
  onOpenItemsChange?: never;
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

/** The props only `type="multiple"` takes (`never` in single mode). */
type MultipleOnly = 'openItems' | 'defaultOpenItems' | 'onOpenItemsChange';

function toItems(value: string | null | undefined): readonly string[] | undefined {
  if (value === undefined) return undefined;
  return value === null ? EMPTY : [value];
}

// The Accordion root, documented on the exported `Accordion` const.
const AccordionRoot = (props: AccordionProps) => {
  // Both modes' props, read by mode: a single Accordion ignores the multiple-mode ones (and the
  // other way round), so neither reaches the root element.
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
  } = props as Omit<AccordionSingleProps, 'type' | MultipleOnly> &
    Pick<AccordionMultipleProps, MultipleOnly> & { type?: SelectionMode };
  const multiple = type === 'multiple';

  const controlled = React.useMemo(
    () => (multiple ? openItemsProp : toItems(openItem)),
    [multiple, openItem, openItemsProp],
  );
  const [initialItems] = React.useState(
    () => (multiple ? defaultOpenItems : toItems(defaultOpenItem)) ?? EMPTY,
  );

  const handleChange = (next: readonly string[]) => {
    const list = [...next];
    if (multiple) onOpenItemsChange?.(list);
    else onOpenItemChange?.(list[0] ?? null);
  };

  const [openItems, setOpenItems] = useControllable<readonly string[]>(
    controlled,
    initialItems,
    handleChange,
  );

  const toggle = React.useCallback(
    (value: string) => {
      setOpenItems((prev) => {
        if (prev.includes(value)) return prev.filter((v) => v !== value);
        return multiple ? [...prev, value] : [value];
      });
    },
    [multiple, setOpenItems],
  );

  // How many mounted Items hold each value, to warn about a repeated value (C-DEV). Only the Items'
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
            <div
              ref={ref}
              className={wcn(
                accordionClassNames.root,
                'wave:divide-y wave:divide-border',
                className,
              )}
              {...rest}
            >
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
  /** A Trigger's parts: the Item renders the heading around a wrapper of the Trigger. */
  slotProps?: AccordionTriggerProps['slotProps'];
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
          <Heading key={key} {...headingProps(trigger?.props.slotProps?.heading)}>
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
        <div
          ref={ref}
          data-state={isOpen ? 'open' : 'closed'}
          className={wcn(accordionItemClassNames.root, className)}
          {...rest}
        >
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
  /**
   * Props for the elements the trigger draws around and inside its button, by part, merged into
   * each part's own: your classes after the part's (yours win a conflict), your styles over its
   * styles, your attributes and handlers added, your ref attached. Every attribute the trigger
   * sets on a part is locked. A part takes no `children` (the trigger draws their content); the
   * button takes the trigger's own props. Fluent UI's AccordionHeader has a `button` and an
   * `expandIcon` slot instead: here the button is the trigger itself.
   */
  slotProps?: {
    /**
     * The heading around the button, an `<h1>` to `<h6>` by `headingLevel` (stable class
     * `wave-accordion-trigger__heading`); around a wrapper of the trigger (a Tooltip) the Item
     * draws it, with this part merged in all the same. Locked: no role or `aria-level` (it stays
     * the heading of its level), and no `hidden`, `inert` or `aria-hidden`, since it holds the
     * button. It receives the button's events after the trigger has handled them.
     */
    heading?: SlotPart<'h3'>;
    /**
     * The chevron after the button's content (stable class
     * `wave-accordion-trigger__expand-icon`), turned while the item is open. Locked:
     * `aria-hidden`, `focusable="false"`, no role and no tab index (it is decorative). A click on
     * it is a click on the button, after yours: `preventDefault()` in yours keeps the item as it
     * is, and the trigger's own `onClick` still runs. While the button is `disabled` your
     * `onClick` here is not called.
     */
    expandIcon?: SlotPart<'svg'>;
  };
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
  slotProps,
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
  const iconPart = slotProps?.expandIcon;
  const iconClassName = wcn(
    accordionTriggerClassNames.expandIcon,
    'wave:shrink-0 wave:transition-transform wave:motion-reduce:transition-none',
    item.isOpen && 'wave:rotate-180',
  );

  const button = (
    <button
      type="button"
      className={wcn(
        accordionTriggerClassNames.root,
        'wave:flex wave:w-full wave:items-center wave:justify-between wave:gap-2 wave:px-4 wave:py-3 wave:text-start wave:text-body-1 wave:font-semibold wave:text-foreground',
        'wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed',
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
        className={iconClassName}
        {...(iconPart &&
          mergeSlotProps(iconPart, {
            className: iconClassName,
            locked: EXPAND_ICON_LOCKS,
            // A disabled button does not toggle: no click of the part either.
            blockHandlers: rest.disabled ? BLOCK_CLICK : undefined,
          }))}
      />
    </button>
  );
  // Inside a wrapper chain (a Tooltip) the Item has rendered the heading around the wrapper.
  return headingOutside ? (
    button
  ) : (
    <Heading {...headingProps(slotProps?.heading)}>{button}</Heading>
  );
};
AccordionTrigger.displayName = 'AccordionTrigger';

/* ------------------------------------------------------------------ */
/*  Accordion.Panel                                                    */
/* ------------------------------------------------------------------ */

/** Properties for the AccordionPanel sub-component (merged onto the `role="region"` element). */
export interface AccordionPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Replaces the panel's collapse (Fluent's `AccordionPanel collapseMotion`), on the element
   * around the region: by default the space the region takes opens from nothing and closes back
   * to it, with a fade, over the normal duration (200 ms) with the max easy-ease curve, both ways.
   * `null` turns it off (the region appears and disappears at once); a class string or
   * `{ className }` replaces it, written as `MotionSlot` describes. A `WaveProvider` with
   * `motion="none"` turns the default off, and a value here still applies under it. A panel
   * rendered inside another panel has no motion of its own.
   * @default the collapse described above
   */
  motion?: MotionSlot | null;
  /** Ref to the panel `<div role="region">`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The content region of an Accordion.Item, labelled by its trigger and rendered while the item is
 * open and while it collapses after a close. Its props (className merged, `ref`, `data-*`,
 * handlers) land on the region, and a non-empty `id` replaces the generated one (the trigger's
 * `aria-controls` follows it).
 *
 * The region renders as the only child of a collapse element (its stable class
 * `wave-accordion-panel__collapse`), which opens and closes the region's space (`motion`) and has
 * no box of its own while the item is open, so the region lays out in the Item as before. An item
 * opened by default appears without motion. After a close the region stays in the document until
 * the collapse ends, `inert` and with `data-state="closed"`, while its trigger already reports the
 * item collapsed; opening the item again during the collapse keeps the same region and the state
 * of its content. Focus inside the region when the item closes moves to the item's trigger.
 */
const AccordionPanel = ({
  id: idProp,
  className,
  children,
  motion,
  ref,
  ...rest
}: AccordionPanelProps) => {
  const item = useAccordionItemContext('Accordion.Panel');
  const slot = React.useContext(AccordionPanelSlotContext);
  const inPanel = slot?.inPanel ?? false;
  React.useEffect(() => {
    if (inPanel) warnOnce('Accordion.Panel:inside-panel', misplacedMessage('Accordion.Panel'));
  }, [inPanel]);

  // The region, and its document for the trigger lookup (kept after the region unmounts, so an
  // item's panel removed while open with focus inside still finds its trigger).
  const regionRef = React.useRef<HTMLDivElement | null>(null);
  const documentRef = React.useRef<Document | null>(null);
  const attachRegion = React.useCallback((node: HTMLDivElement | null) => {
    regionRef.current = node;
    if (node) documentRef.current = node.ownerDocument;
  }, []);
  const mergedRegionRef = useMergedRefs(ref, attachRegion);
  const { triggerId } = item;
  // A misplaced panel collapses with the region it sits in: it has no wrapper of its own.
  const {
    isMounted,
    wrapperRef,
    presenceProps,
    className: collapseClassName,
  } = useCollapsePresence(item.isOpen && !inPanel, {
    motion,
    partRef: regionRef,
    getTrigger: () => documentRef.current?.getElementById(triggerId),
  });

  if (inPanel) {
    // Misplaced: its content joins the enclosing region (one region and one panel id per item),
    // and stays while that region is mounted, so it also stays while the region collapses.
    return (
      <div
        className={wcn(accordionPanelClassNames.root, className)}
        {...rest}
        id={idProp || undefined}
        ref={ref}
      >
        {children}
      </div>
    );
  }
  if (!isMounted) return null;
  return (
    <AccordionPanelSlotContext.Provider value={IN_PANEL}>
      <div
        ref={wrapperRef}
        {...presenceProps}
        className={wcn(accordionPanelClassNames.collapse, collapseClassName)}
      >
        <div
          role="region"
          className={wcn(
            accordionPanelClassNames.root,
            'wave:px-4 wave:pb-3 wave:text-body-1 wave:text-muted-foreground',
            className,
          )}
          {...rest}
          id={idProp || item.panelId}
          aria-labelledby={item.triggerId}
          data-state={item.isOpen ? 'open' : 'closed'}
          ref={mergedRegionRef}
        >
          {children}
          {slot?.extra}
        </div>
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
 * `Accordion.Panel` region that is shown while the item is open. A panel opens and closes its
 * space with a short collapse and fade (`Accordion.Panel`'s `motion`; none under reduced motion or
 * a `WaveProvider` with `motion="none"`), and focus inside a closing panel moves to its trigger.
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
