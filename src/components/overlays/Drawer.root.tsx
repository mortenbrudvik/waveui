import * as React from 'react';
import { flattenChildren, getElementType, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import {
  drawerBodyClassNames,
  drawerClassNames,
  drawerTitleClassNames,
} from '../../lib/classNames';
import { isDev, warnOnce } from '../../lib/dev';
import { slotRendersContent } from '../../lib/slot';
import { focusRingInset } from '../../lib/styles';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useModalLayer } from '../../hooks/useModalLayer';
import { Portal } from '../portal/Portal';
import {
  ModalSurfaceContext,
  useBackdropPress,
  useModalDismiss,
  useModalOpenState,
  useModalTrigger,
  useModalTriggerSession,
  useTitleRegistry,
  useUnnamedModalWarning,
  type ModalRequestOpen,
} from './Dialog.shared';
import {
  DrawerContext,
  DrawerHeaderContext,
  DrawerPartContext,
  DrawerScrollStateContext,
  type DrawerContextValue,
  type DrawerOpenChangeDetails,
  type DrawerPosition,
  type DrawerSize,
} from './Drawer.context';
import { getOverlayPanelClasses } from './Drawer.panel';
import {
  DrawerBody,
  DrawerCloseButton,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
  NESTED_TRIGGER_WARNING,
  NESTED_TRIGGER_WARNING_KEY,
  type DrawerBodyProps,
} from './Drawer.parts';
import { scrollSeparatorClasses, useScrollState } from './Drawer.scroll';

/*
 * The Drawer root: its props, the child scan, the layout and the development checks. Imports the
 * parts, panel, scroll and context modules (never `Drawer.tsx`, which holds the compound).
 */

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
   * `left`/`right` are physical sides; `bottom` runs along the bottom edge (`size` sets its
   * height). Rendered as `data-position`.
   * @default 'end'
   */
  position?: DrawerPosition;
  /**
   * The panel's width at a side — `small` 320px, `medium` 592px, `large` 940px, `full` the
   * viewport's width — or its height at the bottom (the same values; `full` the viewport's height).
   * It never exceeds the viewport. A width class in `className` (a height class for `bottom`)
   * replaces it. Rendered as `data-size`. Fluent's `size`.
   * @default 'small'
   */
  size?: DrawerSize;
  /**
   * Title displayed in the built-in header; it names the drawer (`aria-labelledby`). Without it,
   * render a `Drawer.HeaderTitle` (in a `Drawer.Header`) or a `Drawer.Title`, or pass
   * `aria-label`/`aria-labelledby`. A title that renders nothing (`''`, `[]`, `true`) counts as
   * none. Ignored, with a development warning, when the children hold a `Drawer.Header`, which
   * replaces the built-in header. The heading is an `<h2>`; for another level use
   * `Drawer.HeaderTitle` with `headingLevel`.
   */
  title?: React.ReactNode;
  /**
   * Accessible name of the built-in Close button (an icon-only button), in the built-in header and
   * in every `Drawer.HeaderTitle`. Localize it with the page's language.
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
   * The drawer's content, placed by the Drawer, also from a Fragment (`{isMobile && <>…</>}`) and
   * when written in a Server Component: `Drawer.Trigger` children render in place (outside the
   * panel); a `Drawer.Header` replaces the built-in header (the `title` and Close button row); a
   * `Drawer.Body` gives the scrolling body its props; `Drawer.Footer` renders below the scrolling
   * body, outside it, wherever it is written among the children; everything else renders in the
   * scrolling body. A part nested in another element (a `<form>`) or rendered by a component of
   * yours renders where it is, in the body (a development warning says so). A `Drawer.Trigger`
   * nested in another element, or rendered by a component, is panel content, so it only exists
   * while the drawer is open (development warnings say so, also when an uncontrolled drawer still
   * has no direct trigger a second after it mounts and therefore cannot open; a controlled drawer
   * whose trigger a component such as a Tooltip wraps warns only once it opens).
   * Put wrappers inside the trigger instead: see `Drawer.Trigger`.
   */
  children: React.ReactNode;
  /** Ref to the drawer panel (`role="dialog"`). */
  ref?: React.Ref<HTMLDivElement>;
}

const UNREACHABLE_WARNING_KEY = 'Drawer:unreachable';
const UNREACHABLE_WARNING =
  'Drawer has no way to open: a second after mounting it is still uncontrolled (no `open` prop), closed, and has no Drawer.Trigger as a direct child (or in a Fragment there). A Drawer.Trigger rendered by a component or nested in an element is panel content, which exists only while the drawer is open. Make the trigger a direct child of Drawer, or control the Drawer with `open`/`onOpenChange`.';

/**
 * How long after mount (ms) the development check for a drawer without a trigger waits: long
 * enough for a trigger that a conditional Fragment renders once the page knows its layout.
 */
const REACHABILITY_CHECK_DELAY = 1000;

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

const TITLE_IGNORED_WARNING_KEY = 'Drawer:title-ignored';
const TITLE_IGNORED_WARNING =
  'Drawer: `title` and `titleAction` are ignored because a Drawer.Header is among the children. Put a Drawer.HeaderTitle (with its `action`) in the header instead.';

const BODY_DUPLICATE_WARNING_KEY = 'Drawer.Body:duplicate';
const BODY_DUPLICATE_WARNING =
  'Drawer has more than one Drawer.Body: the props of the first one apply to the scrolling body, and the children of every one render in their place. Render one Drawer.Body.';

/** How the Drawer sorts its direct children ({@link splitChildren}). */
interface DrawerPartition {
  /** The direct `Drawer.Trigger` elements, rendered in place. */
  triggers: React.ReactNode[];
  /** The direct `Drawer.Header` elements, rendered in the header area in written order. */
  headers: React.ReactNode[];
  /** The props of the first direct `Drawer.Body` (its `children` render in `content`). */
  bodyProps: DrawerBodyProps | undefined;
  /** How many direct `Drawer.Body` elements there are. */
  bodyCount: number;
  /** The body content in written order; a `Drawer.Body` is replaced by its children. */
  content: React.ReactNode[];
  /** The direct `Drawer.Footer` elements, rendered after the body in written order. */
  footers: React.ReactNode[];
}

/**
 * Sorts the Drawer's children: its direct `Drawer.Trigger`, `Drawer.Header`, `Drawer.Body` and
 * `Drawer.Footer` elements and the body content. Fragments are flattened (recursively), so a part
 * in a Fragment — `{isMobile && <><Drawer.Trigger>…</Drawer.Trigger><Filters /></>}` — counts as a
 * direct child. Every element keeps the key `flattenChildren` gives it: unique across Fragments and
 * stable when a sibling Fragment toggles, so body content keeps its state when a part appears. A
 * part is recognised also when it was written in a Server Component (a lazy type). Runs during
 * render, so the placement is the same on the server.
 */
function splitChildren(children: React.ReactNode): DrawerPartition {
  const partition: DrawerPartition = {
    triggers: [],
    headers: [],
    bodyProps: undefined,
    bodyCount: 0,
    content: [],
    footers: [],
  };
  for (const { key, node } of flattenChildren(children)) {
    if (isElementOfType<DrawerBodyProps>(node, DrawerBody)) {
      // The first Body's props go on the scrolling body; every Body's children render in place.
      partition.bodyCount += 1;
      if (partition.bodyCount === 1) partition.bodyProps = node.props;
      partition.content.push(<React.Fragment key={key}>{node.props.children}</React.Fragment>);
      continue;
    }
    const keyed = React.isValidElement(node) ? React.cloneElement(node, { key }) : node;
    if (isElementOfType(node, DrawerTrigger)) partition.triggers.push(keyed);
    else if (isElementOfType(node, DrawerHeader)) partition.headers.push(keyed);
    else if (isElementOfType(node, DrawerFooter)) partition.footers.push(keyed);
    else partition.content.push(keyed);
  }
  return partition;
}

/** Properties of the built-in header ({@link DrawerBuiltInHeader}). */
interface DrawerBuiltInHeaderProps {
  /** The `title` prop, when it renders content. */
  title: React.ReactNode;
  /** Whether `title` renders content (else no heading renders). */
  hasTitle: boolean;
  /** The heading's id (the panel's `aria-labelledby`). */
  titleId: string;
  requestOpen: ModalRequestOpen;
  closeLabel: string;
}

/**
 * The 0.10 header row of the `title` form (no `Drawer.Header` among the children): the `title`
 * heading and the Close button as its direct children. It reads the body's scroll state for its
 * separator.
 */
function DrawerBuiltInHeader({
  title,
  hasTitle,
  titleId,
  requestOpen,
  closeLabel,
}: DrawerBuiltInHeaderProps) {
  const scrollState = React.useContext(DrawerScrollStateContext) ?? 'none';
  return (
    <div
      data-scroll-state={scrollState}
      className={cn(
        drawerClassNames.header,
        'flex shrink-0 items-center justify-between gap-2 p-4',
        scrollSeparatorClasses.header,
      )}
    >
      {hasTitle && (
        <h2
          id={titleId}
          className={cn(drawerTitleClassNames.root, 'text-subtitle-1 font-semibold')}
        >
          {title}
        </h2>
      )}
      <DrawerCloseButton
        requestOpen={requestOpen}
        label={closeLabel}
        className="ms-auto text-muted-foreground"
      />
    </div>
  );
}
DrawerBuiltInHeader.displayName = 'DrawerBuiltInHeader';

/** Properties of {@link DrawerLayout}. */
interface DrawerLayoutProps {
  /** The header area: the built-in header, or the placed `Drawer.Header` elements. */
  header: React.ReactNode;
  /** The props of the placed `Drawer.Body`, put on the scrolling body. */
  bodyProps: DrawerBodyProps | undefined;
  /** The body content. */
  content: React.ReactNode;
  /** The placed `Drawer.Footer` elements. */
  footers: React.ReactNode;
}

/**
 * The panel's layout (internal): the header area, the scrolling body and the footers. It owns the
 * body's scroll state (`useScrollState`), so a change of the state re-renders this component, the
 * body element and the parts that read the state (the header area and the footers), never the
 * consumer's content: the elements it receives as props are the same objects, so React skips them.
 */
function DrawerLayout({ header, bodyProps, content, footers }: DrawerLayoutProps) {
  const [body, setBody] = React.useState<HTMLDivElement | null>(null);
  const scrollState = useScrollState(body);
  const { children: _children, className, ref, ...bodyRest } = bodyProps ?? {};
  const bodyRef = useMergedRefs<HTMLDivElement>(setBody, ref);
  return (
    <DrawerScrollStateContext.Provider value={scrollState}>
      <DrawerHeaderContext.Provider value={false}>
        <DrawerPartContext.Provider value="placed">{header}</DrawerPartContext.Provider>
        <div
          data-scroll-state={scrollState}
          {...bodyRest}
          ref={bodyRef}
          className={cn(
            drawerClassNames.body,
            bodyProps && drawerBodyClassNames.root,
            'min-h-0 flex-1 overflow-y-auto p-4',
            focusRingInset,
            className,
          )}
        >
          <DrawerPartContext.Provider value="content">{content}</DrawerPartContext.Provider>
        </div>
        <DrawerPartContext.Provider value="placed">{footers}</DrawerPartContext.Provider>
      </DrawerHeaderContext.Provider>
    </DrawerScrollStateContext.Provider>
  );
}
DrawerLayout.displayName = 'DrawerLayout';

// The root of `Drawer` (documented on the export in Drawer.tsx).
export const DrawerRoot = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  position = 'end',
  size = 'small',
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
  useUnnamedModalWarning(
    open ? panel : null,
    titles.hasTitle,
    'Drawer',
    'Drawer.HeaderTitle or a Drawer.Title',
  );

  const { triggers, headers, bodyProps, bodyCount, content, footers } = splitChildren(children);
  const hasHeader = headers.length > 0;
  // A Drawer.Header replaces the built-in header, whose `title` it cannot show.
  const titleRendersContent = slotRendersContent(title);
  const hasTitle = titleRendersContent && !hasHeader;
  const titleIgnored = titleRendersContent && hasHeader;
  React.useEffect(() => {
    if (titleIgnored) warnOnce(TITLE_IGNORED_WARNING_KEY, TITLE_IGNORED_WARNING);
  }, [titleIgnored]);
  const duplicateBody = bodyCount > 1;
  React.useEffect(() => {
    if (duplicateBody) warnOnce(BODY_DUPLICATE_WARNING_KEY, BODY_DUPLICATE_WARNING);
  }, [duplicateBody]);

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
    () => ({ open, requestOpen, trigger, panelId, inPanel: false, closeLabel }),
    [open, requestOpen, trigger, panelId, closeLabel],
  );
  const panelContext = React.useMemo<DrawerContextValue>(
    () => ({ ...context, inPanel: true }),
    [context],
  );

  return (
    <DrawerContext.Provider value={context}>
      {triggers}
      {open && (
        <Portal layerId={layer.layerId}>
          <div
            className={cn(drawerClassNames.backdrop, 'fixed inset-0 bg-backdrop')}
            onMouseDown={backdropPress.onMouseDown}
          >
            <div
              ref={mergedRef}
              role="dialog"
              id={panelId}
              aria-labelledby={hasTitle ? propTitleId : titles.titleId}
              tabIndex={-1}
              data-position={position}
              data-size={size}
              {...rest}
              className={cn(
                drawerClassNames.root,
                'fixed flex flex-col border-border bg-background text-foreground shadow-64',
                getOverlayPanelClasses(position, size),
                className,
              )}
            >
              <DrawerContext.Provider value={panelContext}>
                <ModalSurfaceContext.Provider value={titles.context}>
                  <DrawerLayout
                    header={
                      hasHeader ? (
                        headers
                      ) : (
                        <DrawerBuiltInHeader
                          title={title}
                          hasTitle={hasTitle}
                          titleId={propTitleId}
                          requestOpen={requestOpen}
                          closeLabel={closeLabel}
                        />
                      )
                    }
                    bodyProps={bodyProps}
                    content={content}
                    footers={footers}
                  />
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
