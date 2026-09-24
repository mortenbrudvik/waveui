import * as React from 'react';
import { cn } from '../../lib/cn';
import { isDev, warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { mergeProps } from '../../lib/mergeProps';
import { STATE_ARIA } from '../../lib/renderTrigger';
import { useControllable, type SetValue } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useModalLayer } from '../../hooks/useModalLayer';
import { useTriggerElement } from '../../hooks/useTriggerElement';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import {
  inertModalTrigger,
  ModalSurfaceContext,
  useModalTitle,
  useModalTrigger,
  useModalTriggerElement,
  useModalTriggerSession,
  useRequiredContext,
  useTitleRegistry,
  useUnnamedModalWarning,
  type ModalTrigger,
} from './Dialog.shared';

/**
 * Side of the screen the drawer is attached to. `start`/`end` follow the text direction (in a
 * right-to-left layout `end` is the left edge); `left`/`right` are physical sides.
 */
export type DrawerPosition = 'start' | 'end' | 'left' | 'right';

/** Properties for the Drawer component. */
export interface DrawerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Controlled open state of the drawer. */
  open?: boolean;
  /** Default open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called when the drawer asks to open or close: `Drawer.Trigger`, Escape, a backdrop click, the
   * Close button or `Drawer.Close`. Fires only when the value changes; a controlled drawer stays as
   * it is until the parent updates `open`.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Side of the screen the drawer is attached to. `start`/`end` follow the text direction;
   * `left`/`right` are physical sides.
   * @default 'end'
   */
  position?: DrawerPosition;
  /**
   * Title displayed in the drawer header; it names the drawer (`aria-labelledby`). Without it,
   * render a `Drawer.Title` or pass `aria-label`/`aria-labelledby`.
   */
  title?: React.ReactNode;
  /**
   * Element that receives focus when the drawer closes. By default focus returns to the trigger
   * (or the element that opened the drawer).
   */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * The drawer body. `Drawer.Trigger` children placed directly inside the Drawer render in place
   * (outside the panel); everything else renders in the panel's scrolling body. A `Drawer.Trigger`
   * nested in another element or a Fragment, or rendered by a component, is panel content, so it
   * only exists while the drawer is open (development warnings say so, also when an uncontrolled
   * drawer has no direct trigger and can therefore never open; a controlled drawer whose trigger a
   * component such as a Tooltip wraps warns only once it opens). Put wrappers inside the trigger
   * instead: see `Drawer.Trigger`.
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
   * onto the child (the span carries the click handler only, no ARIA state).
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
  setOpen: SetValue<boolean>;
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
  setOpen: () => {},
  trigger: inertModalTrigger,
  panelId: '',
  inPanel: false,
};

function useDrawerContext(componentName: string): DrawerContextValue {
  return useRequiredContext(DrawerContext, componentName, 'Drawer', () => inertDrawerContext);
}

const positionClasses: Record<DrawerPosition, string> = {
  start: 'start-0',
  end: 'end-0',
  left: 'left-0', // wave-allow-physical: the consumer asked for the physical left edge
  right: 'right-0', // wave-allow-physical: the consumer asked for the physical right edge
};

const NESTED_TRIGGER_WARNING_KEY = 'Drawer.Trigger:nested';
const NESTED_TRIGGER_WARNING =
  'Drawer.Trigger must be a direct child of Drawer. Inside another element, a Fragment or a component it is rendered as panel content, which exists only while the drawer is open, so it cannot open the drawer. Make it a direct child, or control the Drawer with `open`/`onOpenChange` and open it from your own button.';

const UNREACHABLE_WARNING_KEY = 'Drawer:unreachable';
const UNREACHABLE_WARNING =
  'Drawer can never open: it is uncontrolled (no `open` prop), closed, and has no Drawer.Trigger as a direct child. A Drawer.Trigger rendered by a component or nested in an element is panel content, which exists only while the drawer is open. Make the trigger a direct child of Drawer, or control the Drawer with `open`/`onOpenChange`.';

/**
 * Opens the drawer. Place it directly inside `Drawer` (not inside a wrapper element, a Fragment or
 * a component of your own): it renders in place, not in the panel; a misplaced one warns in
 * development. A Drawer may have several triggers: focus returns to the one that opened it. Puts
 * `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), a click handler and a
 * ref on its single child, or passes them to a render-prop child. A custom child component must
 * forward `ref` and spread its props; one that does not is wrapped in a `<span>` automatically
 * (with a development warning). Focus returns to the trigger when the drawer closes; with a
 * wrapper span, to the first focusable element in it.
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
export const DrawerTrigger = ({ children, asChild, ref, ...rest }: DrawerTriggerProps) => {
  const { open, setOpen, trigger, panelId, inPanel } = useDrawerContext('Drawer.Trigger');
  const { attach, activate } = useModalTriggerElement(trigger);
  const mergedRef = useMergedRefs<HTMLElement>(attach, ref);
  const openDrawer = React.useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      // Focus returns to this trigger, also when the drawer has several (overlays#9), and also when
      // a render-prop child calls `onClick()` without the event.
      activate(event);
      setOpen(true);
    },
    [activate, setOpen],
  );

  // Rendered inside its own drawer's panel (e.g. by a component): it only exists while open.
  React.useEffect(() => {
    if (inPanel) warnOnce(NESTED_TRIGGER_WARNING_KEY, NESTED_TRIGGER_WARNING);
  }, [inPanel]);

  // The explicit wrapper span carries no ARIA state: a generic span cannot.
  const stateAria =
    asChild === false && typeof children !== 'function'
      ? {}
      : {
          'aria-haspopup': 'dialog' as const,
          'aria-expanded': open,
          'aria-controls': open ? panelId : undefined,
        };
  const triggerProps = mergeProps({ ...stateAria, onClick: openDrawer, ref: mergedRef }, rest, {
    oursWin: STATE_ARIA,
  });

  return useTriggerElement(children, triggerProps as DrawerTriggerRenderProps, {
    componentName: 'Drawer.Trigger',
    asChild,
  });
};
DrawerTrigger.displayName = 'DrawerTrigger';

/**
 * Closes the drawer: composes a click handler onto its single child (its own `onClick` runs first;
 * calling `preventDefault()` there keeps the drawer open), or passes it to a render-prop child.
 */
export const DrawerClose = ({ children, asChild, ref, ...rest }: DrawerCloseProps) => {
  const { setOpen } = useDrawerContext('Drawer.Close');
  const mergedRef = useMergedRefs<HTMLElement>(ref);
  const close = React.useCallback(() => setOpen(false), [setOpen]);
  const closeProps = mergeProps({ onClick: close, ref: mergedRef }, rest);
  return useTriggerElement(children, closeProps as DrawerCloseRenderProps, {
    componentName: 'Drawer.Close',
    asChild,
  });
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
 * Development check: whether the Drawer's children hold a `Drawer.Trigger` below the top level
 * (inside a host element's or a Fragment's `children`), which would become panel content. Walks
 * the element tree the consumer wrote, not rendered output, so it descends only into host elements
 * (`<div>`, `<span>`, …) and Fragments, which render their `children` as written. A component's
 * output is unknown here — a wrapper that renders its own Drawer around its children, for one —
 * so components are not walked; a trigger rendered by a component is caught when it renders in the
 * open panel, or, while the drawer can never open, by the unreachable-drawer check.
 */
function hasNestedTrigger(children: React.ReactNode): boolean {
  const visit = (node: unknown, depth: number): boolean => {
    if (depth > NESTED_TRIGGER_MAX_DEPTH || typeof node !== 'object' || node === null) return false;
    if (Array.isArray(node)) return node.some((item) => visit(item, depth));
    if (!React.isValidElement(node)) return false;
    if (node.type === DrawerTrigger) return depth > 0;
    if (typeof node.type !== 'string' && node.type !== React.Fragment) return false;
    return visit((node.props as { children?: unknown }).children, depth + 1);
  };
  return visit(children, 0);
}

/** Splits the Drawer's children into its direct `Drawer.Trigger` elements and the panel content. */
function splitChildren(children: React.ReactNode): {
  triggers: React.ReactNode[];
  content: React.ReactNode[];
} {
  const triggers: React.ReactNode[] = [];
  const content: React.ReactNode[] = [];
  for (const child of React.Children.toArray(children)) {
    if (React.isValidElement(child) && child.type === DrawerTrigger) triggers.push(child);
    else content.push(child);
  }
  return { triggers, content };
}

/**
 * A modal panel attached to a side of the screen (Fluent UI v2 style), rendered in a portal
 * (inheriting the WaveProvider theme) while open.
 *
 * - **Opening**: controlled (`open`), or uncontrolled with a `Drawer.Trigger` placed directly inside
 *   the Drawer (it renders in place, outside the panel).
 * - **Modal**: focus moves into the panel and Tab stays inside it (toasts included), the rest of the
 *   page is `inert` (instead of `aria-modal`), and the page does not scroll.
 * - **Closing**: Escape (only the topmost layer: a popup opened inside closes first), a click on the
 *   backdrop (a drag that starts inside does not close it), the Close button and `Drawer.Close`.
 *   Focus returns to the trigger, the element that opened the drawer, or `finalFocusRef`.
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
const DrawerRoot = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  position = 'end',
  title,
  finalFocusRef,
  children,
  className,
  id,
  ref,
  ...rest
}: DrawerProps) => {
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
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

  const close = React.useCallback(() => setOpen(false), [setOpen]);
  const layer = useModalLayer({
    open,
    onDismiss: close,
    refs: [panelRef],
    container: panel,
    triggerRef: trigger.focusRef,
    finalFocusRef,
  });
  // After useModalLayer's focus restore (effects run in order), forget the trigger that opened
  // this session.
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

  // Checked once, at mount: an uncontrolled closed drawer without a direct trigger can never open
  // (e.g. `<Drawer><FilterTrigger /></Drawer>`, whose trigger is panel content). A trigger nested
  // in an element or a Fragment already has the more specific warning above.
  const unreachable = openProp === undefined && !defaultOpen && triggers.length === 0;
  const reachabilityCheckedRef = React.useRef(false);
  React.useEffect(() => {
    if (reachabilityCheckedRef.current) return;
    reachabilityCheckedRef.current = true;
    if (isDev && unreachable && !hasNestedTrigger(children)) {
      warnOnce(UNREACHABLE_WARNING_KEY, UNREACHABLE_WARNING);
    }
  }, [unreachable, children]);

  const context = React.useMemo<DrawerContextValue>(
    () => ({ open, setOpen, trigger, panelId, inPanel: false }),
    [open, setOpen, trigger, panelId],
  );
  const panelContext = React.useMemo<DrawerContextValue>(
    () => ({ ...context, inPanel: true }),
    [context],
  );

  const hasTitle = title !== undefined && title !== null && title !== false && title !== '';

  return (
    <DrawerContext.Provider value={context}>
      {triggers}
      {open && (
        <Portal layerId={layer.layerId}>
          <div className="fixed inset-0 bg-backdrop">
            <div
              ref={mergedRef}
              role="dialog"
              id={panelId}
              aria-labelledby={hasTitle ? propTitleId : titles.titleId}
              tabIndex={-1}
              {...rest}
              className={cn(
                'fixed top-0 flex h-full w-80 max-w-full flex-col bg-background text-foreground shadow-64',
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
                      aria-label="Close"
                      onClick={close}
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

export const Drawer = /* @__PURE__ */ Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Close: DrawerClose,
  Title: DrawerTitle,
});
