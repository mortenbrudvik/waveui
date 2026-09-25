import * as React from 'react';
import { flattenChildren, getElementType, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { isDev, warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { slotRendersContent } from '../../lib/slot';
import type { ModalOpenChangeReason, OpenChangeDetails } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useModalLayer } from '../../hooks/useModalLayer';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import {
  inertModalTrigger,
  ModalSurfaceContext,
  useBackdropPress,
  useModalClosePart,
  useModalDismiss,
  useModalOpenState,
  useModalTitle,
  useModalTrigger,
  useModalTriggerPart,
  useModalTriggerSession,
  useRequiredContext,
  useTitleRegistry,
  useUnnamedModalWarning,
  type ModalRequestOpen,
  type ModalTrigger,
} from './Dialog.shared';

/**
 * Side of the screen the drawer is attached to. `start`/`end` follow the text direction (in a
 * right-to-left layout `end` is the left edge); `left`/`right` are physical sides.
 */
export type DrawerPosition = 'start' | 'end' | 'left' | 'right';

/**
 * Why a {@link Drawer} asks to open or close: `trigger` (`Drawer.Trigger`), `close`
 * (`Drawer.Close`), `close-button` (the built-in Close button), `escape`, `outside-press` (the
 * backdrop). The shared `ModalOpenChangeReason`, as for Dialog.
 */
export type DrawerOpenChangeReason = ModalOpenChangeReason;

/** The second argument of a {@link Drawer}'s `onOpenChange`: the reason and the DOM event. */
export type DrawerOpenChangeDetails = OpenChangeDetails<DrawerOpenChangeReason>;

/** Properties for the Drawer component. */
export interface DrawerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Controlled open state of the drawer. The panel renders only in the browser: an open drawer
   * is closed in the server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Default open state for uncontrolled usage. The panel renders only in the browser: a drawer
   * open by default is closed in the server HTML and opens once it has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called with the new open state when it changes. `details.reason` tells how — `trigger`,
   * `close` (a `.Close` part), `close-button` (the built-in Close button), `escape` or
   * `outside-press` (the backdrop) — so a controlled drawer can refuse only some ways of closing
   * (for example keep a form with unsaved changes open on `outside-press`); `details.event` is the
   * DOM event behind the request. WaveUI always passes `details`; it is typed optional until 1.0
   * so that code which calls this prop itself keeps compiling.
   *
   * Fires only when the value changes; a controlled drawer stays as it is until the parent updates
   * `open`.
   */
  onOpenChange?: (open: boolean, details?: DrawerOpenChangeDetails) => void;
  /**
   * Side of the screen the drawer is attached to. `start`/`end` follow the text direction;
   * `left`/`right` are physical sides.
   * @default 'end'
   */
  position?: DrawerPosition;
  /**
   * Title displayed in the drawer header; it names the drawer (`aria-labelledby`). Without it,
   * render a `Drawer.Title` or pass `aria-label`/`aria-labelledby`. A title that renders nothing
   * (`''`, `[]`, `true`) counts as none.
   */
  title?: React.ReactNode;
  /**
   * Accessible name of the built-in Close button (an icon-only button). Localize it with the
   * page's language.
   * @default 'Close'
   */
  closeLabel?: string;
  /**
   * Where focus goes when the drawer closes, if it can take focus. Otherwise focus returns to the
   * element that had focus when the drawer opened, then to the trigger, then to an element next to
   * where that opener was.
   */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * The drawer body. `Drawer.Trigger` children placed directly inside the Drawer, or in a Fragment
   * there (`{isMobile && <>…</>}`), render in place (outside the panel); everything else renders in
   * the panel's scrolling body. A `Drawer.Trigger` nested in another element, or rendered by a
   * component, is panel content, so it only exists while the drawer is open (development warnings
   * say so, also when an uncontrolled drawer still has no direct trigger a second after it mounts
   * and therefore cannot open; a controlled drawer whose trigger a component such as a Tooltip
   * wraps warns only once it opens).
   * Put wrappers inside the trigger instead: see `Drawer.Trigger`.
   */
  children: React.ReactNode;
  /** Ref to the drawer panel (`role="dialog"`). */
  ref?: React.Ref<HTMLDivElement>;
}

/** Props a `Drawer.Trigger` puts on its element (and passes to a render-prop child). */
export interface DrawerTriggerRenderProps extends React.HTMLAttributes<HTMLElement> {
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  /** The panel's id, while the drawer is open. */
  'aria-controls'?: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the DrawerTrigger sub-component. */
export interface DrawerTriggerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The element that opens the drawer. A single element receives the trigger props (merged with its
   * own); a function receives them.
   */
  children: React.ReactNode | ((props: DrawerTriggerRenderProps) => React.ReactNode);
  /**
   * `false` renders a wrapper `<span>` around the children instead of merging the trigger props
   * onto the child. The span carries the click handler; `aria-haspopup`, `aria-expanded` and
   * `aria-controls` go to the first element in the tab order inside it.
   * @default true
   */
  asChild?: boolean;
  /** Ref to the trigger element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/** Props a `Drawer.Close` puts on its element (and passes to a render-prop child). */
export interface DrawerCloseRenderProps extends React.HTMLAttributes<HTMLElement> {
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the DrawerClose sub-component. */
export interface DrawerCloseProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The element that closes the drawer. A single element receives an `onClick` composed with its own
   * (its handler runs first; `preventDefault()` keeps the drawer open); a function receives the
   * props.
   */
  children: React.ReactNode | ((props: DrawerCloseRenderProps) => React.ReactNode);
  /** `false` renders a wrapper `<span>` that closes the drawer on click. @default true */
  asChild?: boolean;
  /** Ref to the close element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the DrawerTitle sub-component. */
export interface DrawerTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** The title; any content. */
  children: React.ReactNode;
  /** Ref to the heading element. */
  ref?: React.Ref<HTMLHeadingElement>;
}

interface DrawerContextValue {
  open: boolean;
  /** Asks the root to open or close, with the reason and event for `onOpenChange`. */
  requestOpen: ModalRequestOpen;
  /** The trigger element (`attach`) and the focus-restore target resolved from it (`focusRef`). */
  trigger: ModalTrigger;
  /** The panel's id (for the trigger's `aria-controls`). */
  panelId: string;
  /** `true` for sub-components rendered inside the panel (a `Drawer.Trigger` there is misplaced). */
  inPanel: boolean;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);
DrawerContext.displayName = 'DrawerContext';

const inertDrawerContext: DrawerContextValue = {
  open: false,
  requestOpen: () => {},
  trigger: inertModalTrigger,
  panelId: '',
  inPanel: false,
};

function useDrawerContext(componentName: string): DrawerContextValue {
  return useRequiredContext(DrawerContext, componentName, 'Drawer', () => inertDrawerContext);
}

/**
 * The side the panel is pinned to, and a border on its inner edge (the one facing the page): it
 * marks the panel where the shadow cannot, in high contrast (page, backdrop and panel are black)
 * and in forced colors (which drop shadows).
 */
const positionClasses: Record<DrawerPosition, string> = {
  start: 'start-0 border-e',
  end: 'end-0 border-s',
  left: 'left-0 border-r', // wave-allow-physical: the consumer asked for the physical left edge
  right: 'right-0 border-l', // wave-allow-physical: the consumer asked for the physical right edge
};

const NESTED_TRIGGER_WARNING_KEY = 'Drawer.Trigger:nested';
const NESTED_TRIGGER_WARNING =
  'Drawer.Trigger must be a direct child of Drawer (a Fragment is fine). Inside another element or a component it is rendered as panel content, which exists only while the drawer is open, so it cannot open the drawer. Make it a direct child, put wrappers such as a Tooltip inside the trigger, or control the Drawer with `open`/`onOpenChange` and open it from your own button.';

const UNREACHABLE_WARNING_KEY = 'Drawer:unreachable';
const UNREACHABLE_WARNING =
  'Drawer has no way to open: a second after mounting it is still uncontrolled (no `open` prop), closed, and has no Drawer.Trigger as a direct child (or in a Fragment there). A Drawer.Trigger rendered by a component or nested in an element is panel content, which exists only while the drawer is open. Make the trigger a direct child of Drawer, or control the Drawer with `open`/`onOpenChange`.';

/**
 * How long after mount (ms) the development check for a drawer without a trigger waits: long
 * enough for a trigger that a conditional Fragment renders once the page knows its layout.
 */
const REACHABILITY_CHECK_DELAY = 1000;

/**
 * Opens the drawer. Place it directly inside `Drawer`, or in a Fragment there (not inside a wrapper
 * element or a component of your own): it renders in place, not in the panel; a misplaced one warns
 * in development. A Drawer may have several triggers: focus returns to the one that opened it. Puts
 * `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), a click handler and a
 * ref on its single child, or passes them to a render-prop child. A custom child component must
 * forward `ref` and spread its props; one that does not is wrapped in a `<span>` automatically
 * (with a development warning), the span that `asChild={false}` renders. Focus returns to the
 * trigger when the drawer closes. On the span, the state ARIA goes to the first element in the tab
 * order inside it, and focus returns to that element (to the span when you made it the trigger
 * with a `role` such as `button` and `tabIndex={0}`, or when nothing inside it can take focus).
 *
 * A Tooltip (or any other wrapper) goes inside the trigger, not around it. Use a render-prop child
 * so the trigger props land on the button and the Tooltip describes that same button:
 *
 * @example
 * <Drawer title="Filters">
 *   <Drawer.Trigger>
 *     {(triggerProps) => (
 *       <Tooltip content="Narrow the list">
 *         <Button {...triggerProps}>Filters</Button>
 *       </Tooltip>
 *     )}
 *   </Drawer.Trigger>
 *   <FilterForm />
 * </Drawer>
 */
export const DrawerTrigger = (props: DrawerTriggerProps) => {
  const { open, requestOpen, trigger, panelId, inPanel } = useDrawerContext('Drawer.Trigger');

  // Rendered inside its own drawer's panel (e.g. by a component): it only exists while open.
  React.useEffect(() => {
    if (inPanel) warnOnce(NESTED_TRIGGER_WARNING_KEY, NESTED_TRIGGER_WARNING);
  }, [inPanel]);

  return useModalTriggerPart<DrawerTriggerRenderProps>(
    { open, requestOpen, trigger, controlsId: panelId },
    props,
    'Drawer.Trigger',
  );
};
DrawerTrigger.displayName = 'DrawerTrigger';

/**
 * Closes the drawer: composes a click handler onto its single child (its own `onClick` runs first;
 * calling `preventDefault()` there keeps the drawer open), or passes it to a render-prop child.
 */
export const DrawerClose = (props: DrawerCloseProps) => {
  const { requestOpen } = useDrawerContext('Drawer.Close');
  return useModalClosePart<DrawerCloseRenderProps>(requestOpen, props, 'Drawer.Close');
};
DrawerClose.displayName = 'DrawerClose';

/**
 * A heading that names the drawer (`aria-labelledby`), for rich titles or custom layouts. Render it
 * inside the Drawer's content (instead of the `title` prop).
 */
export const DrawerTitle = ({ id, className, children, ref, ...rest }: DrawerTitleProps) => {
  const { id: titleId, ref: titleRef } = useModalTitle('Drawer.Title', 'Drawer', id, ref);
  return (
    <h2
      {...rest}
      id={titleId}
      ref={titleRef}
      className={cn('text-subtitle-1 font-semibold text-foreground', className)}
    >
      {children}
    </h2>
  );
};
DrawerTitle.displayName = 'DrawerTitle';

/** Deepest element level the development check for nested triggers looks at. */
const NESTED_TRIGGER_MAX_DEPTH = 32;

/**
 * Development check: whether the Drawer's children hold a `Drawer.Trigger` inside a host element
 * (at any depth, also through Fragments), which would become panel content; a trigger inside
 * Fragments only is direct (see `splitChildren`). Walks the element tree the consumer wrote, not
 * rendered output, so it descends only into host elements (`<div>`, `<span>`, …) and Fragments,
 * which render their `children` as written. A component's
 * output is unknown here — a wrapper that renders its own Drawer around its children, for one —
 * so components are not walked; a trigger rendered by a component is caught when it renders in the
 * open panel, or, while the drawer cannot open, by the unreachable-drawer check.
 */
function hasNestedTrigger(children: React.ReactNode): boolean {
  // `depth` counts host elements only: a Fragment adds no level, as `splitChildren` flattens it.
  const visit = (node: unknown, depth: number, level: number): boolean => {
    if (level > NESTED_TRIGGER_MAX_DEPTH || typeof node !== 'object' || node === null) return false;
    if (Array.isArray(node)) return node.some((item) => visit(item, depth, level));
    if (!React.isValidElement(node)) return false;
    // A part written in a Server Component has a lazy type. The walk runs in effects, outside
    // render: a lazy part that is still loading must not throw its thenable there, so it counts
    // as no trigger (`suspend: false` returns the lazy itself, which matches nothing).
    const type = getElementType(node, { suspend: false });
    if (type === DrawerTrigger) return depth > 0;
    const isFragment = type === React.Fragment;
    if (typeof type !== 'string' && !isFragment) return false;
    const { children: nested } = node.props as { children?: unknown };
    return visit(nested, isFragment ? depth : depth + 1, level + 1);
  };
  return visit(children, 0, 0);
}

/**
 * Splits the Drawer's children into its direct `Drawer.Trigger` elements and the panel content.
 * Fragments are flattened (recursively), so a `Drawer.Trigger` in a Fragment —
 * `{isMobile && <><Drawer.Trigger>…</Drawer.Trigger><Filters /></>}` — counts as a direct child.
 * Every element keeps the key `flattenChildren` gives it: unique across Fragments and stable when a
 * sibling Fragment toggles, so panel content keeps its state. A trigger is recognised also when it
 * was written in a Server Component (a lazy type).
 */
function splitChildren(children: React.ReactNode): {
  triggers: React.ReactNode[];
  content: React.ReactNode[];
} {
  const triggers: React.ReactNode[] = [];
  const content: React.ReactNode[] = [];
  for (const { key, node } of flattenChildren(children)) {
    const keyed = React.isValidElement(node) ? React.cloneElement(node, { key }) : node;
    if (isElementOfType(node, DrawerTrigger)) triggers.push(keyed);
    else content.push(keyed);
  }
  return { triggers, content };
}

// The root of `Drawer` (documented on the export below).
const DrawerRoot = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  position = 'end',
  title,
  closeLabel = 'Close',
  finalFocusRef,
  children,
  className,
  id,
  ref,
  ...rest
}: DrawerProps) => {
  const [openState, requestOpen] = useModalOpenState(openProp, defaultOpen, onOpenChange);
  // The panel lives in a portal, which renders only in the browser: until then (the server HTML,
  // hydration) the drawer reports itself closed, so the trigger's aria-expanded and aria-controls
  // never describe a panel that is not there.
  const isClient = useIsClient();
  const open = openState && isClient;
  const trigger = useModalTrigger();
  const generatedId = useId('wave-drawer');
  const panelId = id ?? generatedId;
  const propTitleId = useId('wave-drawer-title');
  const titles = useTitleRegistry();

  const [panel, setPanel] = React.useState<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const attachPanel = React.useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanel(node);
  }, []);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, attachPanel);

  // Every backdrop press asks the drawer to close.
  const backdropPress = useBackdropPress(panelRef, true);
  const onDismiss = useModalDismiss(requestOpen, 'Drawer', backdropPress.afterOutsidePress);
  const layer = useModalLayer({
    open,
    onDismiss,
    refs: [panelRef],
    container: panel,
    triggerRef: trigger.focusRef,
    finalFocusRef,
  });
  // After useModalLayer's focus restore (effects run in order), start the trigger session, or end
  // it and forget the trigger that opened it.
  useModalTriggerSession(trigger, open);
  useUnnamedModalWarning(open ? panel : null, titles.hasTitle, 'Drawer', 'Drawer.Title');

  const { triggers, content } = splitChildren(children);

  // A trigger nested in the children is panel content: never rendered while the drawer is closed.
  // The children change on every parent render; once this drawer has warned, it stops walking.
  const nestedWarnedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isDev || nestedWarnedRef.current || !hasNestedTrigger(children)) return;
    nestedWarnedRef.current = true;
    warnOnce(NESTED_TRIGGER_WARNING_KEY, NESTED_TRIGGER_WARNING);
  }, [children]);

  // An uncontrolled closed drawer without a direct trigger cannot open (e.g.
  // `<Drawer><FilterTrigger /></Drawer>`, whose trigger is panel content). Checked once, a moment
  // after mount, against the latest render: a trigger that a conditional Fragment adds right after
  // mount (`{isMobile && <>…</>}` with an SSR-safe media query) counts. A trigger nested in an
  // element already has the more specific warning above.
  const unreachable = openProp === undefined && !defaultOpen && triggers.length === 0;
  const latestRef = React.useRef({ unreachable, children });
  React.useLayoutEffect(() => {
    latestRef.current = { unreachable, children };
  });
  React.useEffect(() => {
    if (!isDev || !latestRef.current.unreachable) return;
    const timer = setTimeout(() => {
      const latest = latestRef.current;
      if (latest.unreachable && !hasNestedTrigger(latest.children)) {
        warnOnce(UNREACHABLE_WARNING_KEY, UNREACHABLE_WARNING);
      }
    }, REACHABILITY_CHECK_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const context = React.useMemo<DrawerContextValue>(
    () => ({ open, requestOpen, trigger, panelId, inPanel: false }),
    [open, requestOpen, trigger, panelId],
  );
  const panelContext = React.useMemo<DrawerContextValue>(
    () => ({ ...context, inPanel: true }),
    [context],
  );

  const hasTitle = slotRendersContent(title);

  return (
    <DrawerContext.Provider value={context}>
      {triggers}
      {open && (
        <Portal layerId={layer.layerId}>
          <div className="fixed inset-0 bg-backdrop" onMouseDown={backdropPress.onMouseDown}>
            <div
              ref={mergedRef}
              role="dialog"
              id={panelId}
              aria-labelledby={hasTitle ? propTitleId : titles.titleId}
              tabIndex={-1}
              {...rest}
              className={cn(
                'fixed top-0 flex h-full w-80 max-w-full flex-col border-border bg-background text-foreground shadow-64',
                positionClasses[position],
                className,
              )}
            >
              <DrawerContext.Provider value={panelContext}>
                <ModalSurfaceContext.Provider value={titles.context}>
                  <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                    {hasTitle && (
                      <h2 id={propTitleId} className="text-subtitle-1 font-semibold">
                        {title}
                      </h2>
                    )}
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<DismissIcon />}
                      aria-label={closeLabel}
                      onClick={(event) =>
                        requestOpen(false, { reason: 'close-button', event: event.nativeEvent })
                      }
                      className="ms-auto text-muted-foreground"
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">{content}</div>
                </ModalSurfaceContext.Provider>
              </DrawerContext.Provider>
            </div>
          </div>
        </Portal>
      )}
    </DrawerContext.Provider>
  );
};
DrawerRoot.displayName = 'Drawer';

/**
 * A modal panel attached to a side of the screen (Fluent UI v2 style), rendered in a portal
 * (inheriting the WaveProvider theme) while open.
 *
 * - **Opening**: controlled (`open`), or uncontrolled with a `Drawer.Trigger` placed directly inside
 *   the Drawer or in a Fragment there (it renders in place, outside the panel).
 * - **Modal**: focus moves into the panel and Tab stays inside it (toasts included), the rest of the
 *   page is `inert` (instead of `aria-modal`), and the page does not scroll.
 * - **Closing**: Escape (only the topmost layer: a popup opened inside closes first), a click on the
 *   backdrop (a drag that starts inside does not close it), the Close button and `Drawer.Close`.
 *   `onOpenChange` gets the reason as its second argument (`details.reason`), so a controlled
 *   drawer can refuse some of them. A backdrop press blurs the focused field before the drawer
 *   closes, so a typed value is committed as with the Close button; when a controlled drawer
 *   refuses the press, the field gets focus back. Focus returns to the first of these that can
 *   take focus: `finalFocusRef`, the element that had focus when the drawer opened, the trigger,
 *   an element next to where that opener was.
 * - **Position**: `end` (default) and `start` follow the text direction.
 *
 * The sub-components are also exported under flat names (`DrawerTrigger`, `DrawerClose`,
 * `DrawerTitle`) for React Server Components, which cannot use the dotted form; dotted access
 * (`Drawer.Trigger`) needs a client file.
 *
 * @example
 * <Drawer title="Filters">
 *   <Drawer.Trigger><Button>Filters</Button></Drawer.Trigger>
 *   <FilterForm />
 *   <Drawer.Close><Button appearance="primary">Apply</Button></Drawer.Close>
 * </Drawer>
 */
export const Drawer = /* @__PURE__ */ Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Close: DrawerClose,
  Title: DrawerTitle,
});
