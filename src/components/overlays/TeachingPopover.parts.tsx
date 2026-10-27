import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  teachingPopoverBodyClassNames,
  teachingPopoverCarouselClassNames,
  teachingPopoverCarouselFooterClassNames,
  teachingPopoverCarouselNavClassNames,
  teachingPopoverCarouselPageCountClassNames,
  teachingPopoverClassNames,
  teachingPopoverFooterClassNames,
  teachingPopoverHeaderClassNames,
  teachingPopoverSurfaceClassNames,
  teachingPopoverTitleClassNames,
} from '../../lib/classNames';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { isElementOfType } from '../../lib/children';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import {
  materialiseSlotContent,
  renderSlot,
  resolveSlot,
  slotRendersContent,
  type Slot,
} from '../../lib/slot';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusRing, forcedColors } from '../../lib/styles';
import type { VirtualElement } from '../../lib/types';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useDismiss } from '../../hooks/useDismiss';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { resolvePositioning, usePopupPosition } from '../../hooks/usePopupPosition';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { useTriggerElement, useTriggerFocusRef } from '../../hooks/useTriggerElement';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import { useTitleRegistry } from './Dialog.shared';
import { ModalCloseButton } from './Dialog.slots';
import { getTabbableThrough, PopoverBeak, usePopoverTabOrder } from './Popover.shared';
import { useCarouselFooterStacked } from './TeachingPopover.stack';
import {
  TeachingPopoverSurfaceContext,
  useTeachingPopoverContext,
  type TeachingPopoverAction,
  type TeachingPopoverContextValue,
  type TeachingPopoverTarget,
} from './TeachingPopover.context';

/*
 * The TeachingPopover's parts and the surface they share with the root: `TeachingSurface` holds
 * the surface's hooks (positioning, dismissal, focus, keyboard order, announcements, the title
 * registry), so the `steps` form and `TeachingPopover.Surface` render one element the same way.
 * The content parts (Header, Title, Body, Footer) show the current step without children; the
 * `steps` form renders them that way (Pattern 15), so both forms render the same markup. The
 * carousel parts (Carousel, CarouselNav, CarouselPageCount, CarouselFooter) read the same state,
 * and both footers share the step dots and the step buttons. Imports the context module only
 * (never the root or `TeachingPopover.tsx`).
 */

/**
 * Props a `TeachingPopover.Trigger` puts on its element; a render-prop child receives them (spread
 * them onto the element that opens the popover).
 */
export type TeachingPopoverTriggerChildProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  'children'
> & {
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  /** The surface's id, only while the popover is open. */
  'aria-controls': string | undefined;
  onClick: React.MouseEventHandler<HTMLElement>;
  ref: React.RefCallback<HTMLElement>;
};

/** Properties for the TeachingPopoverTrigger sub-component. */
export interface TeachingPopoverTriggerProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'children'
> {
  /**
   * The element that opens and closes the popover (its props are merged onto it), or a render
   * function that receives the trigger props.
   */
  children: React.ReactNode | ((props: TeachingPopoverTriggerChildProps) => React.ReactNode);
  /**
   * `false` renders a wrapper `<span>` carrying the trigger props around the children instead of
   * merging them onto the child. `aria-haspopup`, `aria-expanded` and `aria-controls`, which a
   * generic element cannot carry, go to the first element in the tab order inside the span. A
   * render-prop child ignores `asChild` and receives every prop.
   * @default true
   */
  asChild?: boolean;
  /** Ref to the trigger element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the TeachingPopoverSurface sub-component. */
export interface TeachingPopoverSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The popover's content. Without children (or with children that render nothing) the surface
   * shows the current step as the `steps` form does: `TeachingPopover.Header`, `Title`, `Body` and
   * `Footer` without children of their own (the Close button, the step title, its body, and the
   * footer with the step dots and the buttons). Children replace all of that: build it from those
   * parts, each showing its share of the current step unless you give it children, or from your
   * own content. A `TeachingPopover.Title` among the children (at any depth) names the surface;
   * without one, name it with `aria-label` or `aria-labelledby`.
   */
  children?: React.ReactNode;
  /** Ref to the popover surface (`role="dialog"`). */
  ref?: React.Ref<HTMLDivElement>;
}

function isRefObject(
  target: NonNullable<TeachingPopoverTarget>,
): target is React.RefObject<HTMLElement | null> {
  return 'current' in target;
}

function isElementTarget(target: TeachingPopoverTarget | undefined): target is HTMLElement {
  return (
    target != null && !isRefObject(target) && typeof (target as Partial<Node>).nodeType === 'number'
  );
}

function isVirtualTarget(target: TeachingPopoverTarget | undefined): target is VirtualElement {
  return target != null && !isRefObject(target) && !isElementTarget(target);
}

function resolveTarget(target: TeachingPopoverTarget | undefined): HTMLElement | null {
  if (!target || isVirtualTarget(target)) return null;
  return isRefObject(target) ? target.current : target;
}

const isButtonLikeElement = (action: unknown): action is React.ReactElement<ActionElementProps> =>
  isElementOfType<ActionElementProps>(action as React.ReactNode, Button, 'button', 'a');

interface ActionElementProps {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  appearance?: string;
}

/**
 * Renders a footer action as a button: content gets a Button around it, a slot object renders as
 * a Button (or its `as`), and a Button-like element is used as given. Every form composes its own
 * `onClick` before `onActivate`.
 */
function renderAction(
  action: TeachingPopoverAction,
  appearance: 'primary' | 'outline',
  className: string,
  onActivate: () => void,
): React.ReactElement | null {
  const activate = (event: React.MouseEvent<HTMLElement>) => {
    if (!event.defaultPrevented) onActivate();
  };
  if (isButtonLikeElement(action)) {
    const { className: own, onClick, appearance: ownAppearance } = action.props;
    const isWaveButton = isElementOfType(action, Button);
    return React.cloneElement(action, {
      className: cn(className, own),
      onClick: composeEventHandlers(onClick, activate),
      ...(isWaveButton ? { appearance: ownAppearance ?? appearance } : undefined),
    });
  }
  const resolved = resolveSlot<React.ElementType>(action, Button, className);
  if (!resolved) return null;
  const { onClick, ...props } = resolved.props as ActionElementProps & Record<string, unknown>;
  // The slot's `as` changes Button's element, never the component: Button keeps the link behaviour,
  // `role="button"` and the keyboard activation of a non-interactive element, the focus ring and
  // the look. `appearance` is Button's own prop, so it never reaches the DOM.
  return React.createElement(
    Button as React.ElementType,
    {
      appearance,
      ...props,
      ...(resolved.Component === Button ? undefined : { as: resolved.Component }),
      onClick: composeEventHandlers(onClick, activate),
    },
    resolved.children,
  );
}

/** Properties of {@link TeachingSurface}. */
interface TeachingSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The context of the TeachingPopover the surface belongs to. */
  context: TeachingPopoverContextValue;
  /** The stable classes of the component that renders the surface, first in its classes. */
  rootClassName: string;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The popover surface (internal): the non-modal `role="dialog"` element, rendered in place, or
 * portaled and positioned next to the target with a beak, with its dismissal, focus, keyboard
 * order and step announcements. The root renders it with its own props while no
 * `TeachingPopover.Surface` is among its children; `TeachingPopover.Surface` renders it with its
 * props. Its children replace the content parts of the current step; a `TeachingPopover.Title`
 * among them registers its id, which names the surface.
 */
export const TeachingSurface = ({
  context,
  rootClassName,
  id,
  className,
  style,
  onKeyDown,
  children,
  ref,
  ...rest
}: TeachingSurfaceProps) => {
  const {
    target,
    side,
    align,
    positioning,
    shown,
    index,
    step,
    stepPosition,
    titleId,
    footerLayout,
    dismiss,
    hasTrigger,
    triggerRef,
    surfaceId,
  } = context;
  const announce = useAnnounce();
  // The titles among the children of a surface with content of its own (see the provider below).
  const titles = useTitleRegistry();
  const stepTitle = step?.title;
  const hasTarget = target !== undefined;

  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  // Whether `target` pointed at an element when it was last read. An element (or `null`) is known
  // during render and is mirrored here right away (C-HOOKS: adjust state during render). A ref
  // cannot be read during render, React does not re-render when it attaches or detaches, and
  // floating-ui keeps `isPositioned` after `setReference(null)`, so the layout effect below reads
  // a ref after each commit and mirrors it here through a deferred update (C-HOOKS). Until that
  // update has read a newly passed ref, the ref keeps this last known availability: moving between
  // attached refs (a multi-target tour) or passing a new ref object on every render never hides
  // the popover, and a switch to a ref that is not attached hides it once the update lands.
  const pointsAtOneNow = (value: TeachingPopoverTarget | undefined) =>
    isElementTarget(value) || isVirtualTarget(value);
  const [targetResolved, setTargetResolved] = React.useState(() => pointsAtOneNow(target));
  const elementAvailable = target === null ? false : pointsAtOneNow(target) ? true : undefined;
  if (elementAvailable !== undefined && elementAvailable !== targetResolved) {
    setTargetResolved(elementAvailable);
  }
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const targetRef = React.useRef<HTMLElement | null>(null);
  // The latest `target` prop and committed availability, read by the deferred update so that the
  // newest target and attachment win and an unchanged resolution sets no state.
  const targetPropRef = React.useRef(target);
  const availabilityRef = React.useRef(targetResolved);
  const arrowRef = React.useRef<HTMLDivElement | null>(null);

  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const {
    setReference,
    setFloating,
    floatingProps,
    arrowStyles,
    side: placedSide,
    isPositioned,
  } = usePopupPosition({
    open: shown && hasTarget,
    side,
    align,
    arrowRef,
    ...resolvePositioning(positioning, { offset: 12 }),
  });
  // An anchored popover is shown only while it points at a resolved target: otherwise the surface
  // is rendered (so it can be measured) but hidden, unfocused, silent and without an Escape layer.
  const targetAvailable = target != null && (isRefObject(target) ? targetResolved : true);
  const anchorReady = !hasTarget || (targetAvailable && isPositioned);
  const visible = shown && anchorReady;
  const elementRef = useMergedRefs<HTMLDivElement>(ref, surfaceRef, setSurface, setFloating);

  // Point the positioning at the target after every commit. A ref is read once more when the whole
  // commit is done (the C-HOOKS deferred-update pattern): a target that comes after the popover in
  // the tree attaches its ref after this effect has run. That update re-reads the latest target,
  // and only a changed element or availability updates the reference or the state.
  React.useLayoutEffect(() => {
    targetPropRef.current = target;
    availabilityRef.current = targetResolved;
    const element = resolveTarget(target);
    targetRef.current = element;
    setReference(isVirtualTarget(target) ? target : element);
    if (target == null || !isRefObject(target)) return;
    queueMicrotask(() => {
      const latest = resolveTarget(targetPropRef.current);
      if (latest !== targetRef.current) {
        targetRef.current = latest;
        setReference(latest);
      }
      const available = latest !== null;
      if (available !== availabilityRef.current) {
        availabilityRef.current = available;
        setTargetResolved(available);
      }
    });
  });

  const { layerId } = useDismiss({
    open: visible,
    onDismiss: dismiss,
    refs: [surfaceRef],
    anchorRef: targetRef,
    kind: 'popover',
    outsidePress: false,
  });

  // Focus returns to the Trigger when there is one (as `Popover.Trigger`), else to the element that
  // had it, else to the target.
  const triggerFocusRef = useTriggerFocusRef(triggerRef);
  useRestoreFocus({
    enabled: visible,
    container: surface,
    triggerRef: triggerFocusRef,
    fallback: () => targetRef.current,
    onlyIfFocusInside: true,
  });

  // Portaled next to a target: the keyboard order of the popover placed right after the target.
  const onSurfaceKeyDown = usePopoverTabOrder({
    enabled: visible && hasTarget,
    surface,
    anchorRef: targetRef,
    getPreviousStop: getTabbableThrough,
  });

  // Move focus into the popover when it becomes visible (and when a new surface mounts).
  React.useEffect(() => {
    if (visible && surface) surface.focus({ preventScroll: hasTarget });
  }, [visible, surface, hasTarget]);

  // Announce the new step politely after a step change (not on mount, and not while hidden: the
  // heading, which carries the step position, is read when the popover shows and takes focus).
  const announcedIndexRef = React.useRef(index);
  React.useEffect(() => {
    if (announcedIndexRef.current === index) return;
    announcedIndexRef.current = index;
    if (visible && stepTitle !== undefined) {
      announce(`${stepTitle}, ${stepPosition}`);
    }
  }, [index, visible, stepTitle, stepPosition, announce]);

  if (!shown || !step) return null;

  // Children replace the content parts of the step. The parts without children name the surface
  // by the title id known while rendering (the server HTML too); with children of yours, the
  // first TeachingPopover.Title that registers does, and no title means no `aria-labelledby`.
  const hasContent = slotRendersContent(children);
  const ownId = id || undefined;

  return (
    <Portal disabled={!hasTarget} layerId={layerId}>
      <div
        role="dialog"
        aria-labelledby={hasContent ? titles.titleId : titleId}
        tabIndex={-1}
        data-layout={footerLayout}
        id={ownId ?? (hasTrigger ? surfaceId : undefined)}
        {...rest}
        ref={elementRef}
        onKeyDown={composeEventHandlers(onKeyDown, onSurfaceKeyDown)}
        {...(hasTarget
          ? {
              'data-side': floatingProps['data-side'],
              'data-align': floatingProps['data-align'],
              style: {
                ...style,
                ...floatingProps.style,
                ...(anchorReady ? undefined : { visibility: 'hidden' as const }),
              },
            }
          : { style })}
        className={cn(
          rootClassName,
          'relative w-80 rounded-md border border-border bg-background p-5 text-foreground shadow-8',
          focusRing,
          className,
        )}
      >
        {hasTarget && (
          <PopoverBeak
            ref={arrowRef}
            side={placedSide}
            style={arrowStyles}
            data-wave-teaching-popover-arrow=""
            className={teachingPopoverClassNames.beak}
          />
        )}

        {/* Titles among your children register here; the default content's does not (its id is
            known while rendering), and a popover nested inside provides its own registry. */}
        <TeachingPopoverSurfaceContext.Provider value={hasContent ? titles.context : null}>
          {hasContent ? (
            children
          ) : (
            <>
              <TeachingPopoverHeader />
              <TeachingPopoverTitle />
              <TeachingPopoverBody />
              <TeachingPopoverFooter />
            </>
          )}
        </TeachingPopoverSurfaceContext.Provider>
      </div>
    </Portal>
  );
};
TeachingSurface.displayName = 'TeachingSurface';

/**
 * The element that opens and closes the popover (Fluent's `TeachingPopoverTrigger`, as
 * `Popover.Trigger`). Its props are merged onto the single child (no wrapper element):
 * `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), a composed `onClick`
 * that opens the popover, or dismisses it while it is open (as Close does: `onOpenChange(false)`,
 * then `onDismiss`), and a ref. The child's own handlers and classes are kept; the live state ARIA
 * always wins. A render function receives the props instead; `asChild={false}` renders a wrapper
 * span, and a custom child that neither forwards `ref` nor spreads its props falls back to that
 * span automatically (with a development warning). On the span, the state ARIA goes to the first
 * element in the tab order inside it.
 *
 * When TeachingPopover has no `target` (and no `positioning.target`), the popover points at the
 * trigger: it is portaled next to it with a beak and takes its place in the keyboard order right
 * after it. Focus returns to the trigger when the popover closes, with a `target` too (as with
 * `Popover.Trigger`). Place it directly inside TeachingPopover (a Fragment is fine): the popover
 * then starts closed unless `defaultOpen` says otherwise. A trigger nested deeper still works, but
 * leaves `defaultOpen` at `true` and becomes the target once it has mounted.
 *
 * @example
 * <TeachingPopover steps={steps}>
 *   <TeachingPopover.Trigger>
 *     <Button>Take the tour</Button>
 *   </TeachingPopover.Trigger>
 * </TeachingPopover>
 *
 * Also exported as `TeachingPopoverTrigger` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Trigger` (that needs a client file).
 */
export const TeachingPopoverTrigger = ({
  children,
  asChild,
  onClick,
  ref,
  ...rest
}: TeachingPopoverTriggerProps) => {
  const { shown, requestOpen, dismiss, surfaceId, triggerElementRef } =
    useTeachingPopoverContext('TeachingPopover.Trigger');
  // A popover that points at its trigger lives in a portal, which renders only in the browser:
  // until then (the server HTML, hydration) the trigger reports it closed, so its aria-expanded
  // and aria-controls never describe a surface that is not there.
  const isClient = useIsClient();
  const expanded = shown && isClient;
  const elementRef = useMergedRefs<HTMLElement>(ref, triggerElementRef);

  const triggerProps = {
    ...rest,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': expanded,
    'aria-controls': expanded ? surfaceId : undefined,
    onClick: composeEventHandlers(onClick, () => (shown ? dismiss() : requestOpen())),
    ref: elementRef,
  } as TeachingPopoverTriggerChildProps;

  return useTriggerElement(children, triggerProps, {
    componentName: 'TeachingPopover.Trigger',
    asChild,
  });
};
TeachingPopoverTrigger.displayName = 'TeachingPopoverTrigger';

/**
 * The popover surface (Fluent's `TeachingPopoverSurface`): the non-modal `role="dialog"` element
 * that the `steps` form renders, with the same behaviour (in place, or portaled next to the
 * target with a beak; focus, dismissal, keyboard order and step announcements), so your
 * `className`, `style`, `ref` and other props reach the element the `steps` form gives
 * TeachingPopover's own. Without children it shows the current step as the `steps` form does;
 * children replace that content: build it from `TeachingPopover.Header`, `Title`, `Body` and
 * `Footer`, or from your own (then name the surface with `aria-label` or `aria-labelledby`).
 *
 * Render one inside TeachingPopover; TeachingPopover then renders no surface of its own, and its
 * own `className`, `style`, `ref` and other element props are ignored (a development warning says
 * so). Write it directly inside TeachingPopover (a Fragment is fine) where you can: there it is
 * found while rendering. One inside an element or a component of yours is found once it has
 * mounted, so until then TeachingPopover's own surface renders next to it: in the server HTML, and
 * in the browser's first commit (before anything is painted or focused). A second Surface renders
 * a second popover (a development warning says so).
 *
 * Also exported as `TeachingPopoverSurface` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Surface` (that needs a client file).
 */
export const TeachingPopoverSurface = ({ id, ref, ...rest }: TeachingPopoverSurfaceProps) => {
  const context = useTeachingPopoverContext('TeachingPopover.Surface');
  const { registerSurface, setCustomSurfaceId } = context;
  // Registered wherever it is among TeachingPopover's children: the root then drops its own
  // surface (in the commit after this one when the root's scan did not find it), and warns when
  // more than one registers.
  React.useLayoutEffect(() => registerSurface(), [registerSurface]);
  // Its id is the one the Trigger's `aria-controls` names.
  const ownId = id || undefined;
  React.useEffect(() => {
    setCustomSurfaceId(ownId);
    return () => setCustomSurfaceId(undefined);
  }, [ownId, setCustomSurfaceId]);

  return (
    <TeachingSurface
      context={context}
      rootClassName={cn(teachingPopoverClassNames.root, teachingPopoverSurfaceClassNames.root)}
      id={id}
      {...rest}
      ref={ref}
    />
  );
};
TeachingPopoverSurface.displayName = 'TeachingPopoverSurface';

/** Properties for the TeachingPopoverHeader sub-component. */
export interface TeachingPopoverHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A short caption above the title, such as “Tip” or “New”. Without it (and without `icon`) the
   * header holds only the Close button, as the `steps` form's does; with either, they sit in a row
   * at the top of the popover, next to the Close button.
   */
  children?: React.ReactNode;
  /**
   * A decorative icon before the caption (`aria-hidden`), such as a light bulb. None by default
   * (Fluent's header shows a light bulb). A value that renders nothing renders no element.
   */
  icon?: Slot<'span'>;
  /**
   * The Close button at the popover's top end, which dismisses it (`onOpenChange(false)`, then
   * `onDismiss`) and is named by TeachingPopover's `closeLabel`. Content (an icon) replaces the
   * dismiss glyph inside the built-in button. A `<button>` or a `Button`, or a slot object whose
   * `as` is one, is merged into it, never nested: its props and handlers (called first) reach the
   * built-in button, its content goes inside, and a development warning says so; a text label of
   * two or more letters or digits in it names the button instead of `closeLabel` (WCAG 2.5.3,
   * Label in Name), as does its own `aria-label`. `null` renders no Close button; `undefined` and
   * booleans keep the default.
   */
  dismissButton?: Slot<'span'>;
  /** Ref to the header element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The top of the popover (Fluent's `TeachingPopoverHeader`): the Close button, and an optional
 * caption with a decorative `icon` before the title. Without children it holds only the Close
 * button, as the `steps` form does. Place it first in a `TeachingPopover.Surface`.
 *
 * Also exported as `TeachingPopoverHeader` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Header` (that needs a client file).
 */
export const TeachingPopoverHeader = ({
  icon,
  dismissButton,
  className,
  children,
  ref,
  ...rest
}: TeachingPopoverHeaderProps) => {
  const { step, closeLabel, dismiss } = useTeachingPopoverContext('TeachingPopover.Header');
  if (!step) return null;

  const hasIcon = slotRendersContent(icon);
  const hasCaption = slotRendersContent(children);
  return (
    // The row lines up with the Close button, which keeps its place at the top end of the surface
    // whether or not the header has a caption.
    <div
      ref={ref}
      className={cn(
        teachingPopoverHeaderClassNames.root,
        (hasIcon || hasCaption) &&
          '-mt-2 mb-2 flex min-h-6 items-center gap-1.5 pe-8 text-caption-1 font-semibold text-primary',
        className,
      )}
      {...rest}
    >
      {hasIcon &&
        renderSlot(
          icon,
          'span',
          cn(teachingPopoverHeaderClassNames.icon, 'inline-flex shrink-0 items-center'),
          { 'aria-hidden': true },
        )}
      {hasCaption && materialiseSlotContent(children)}
      <ModalCloseButton
        componentName="TeachingPopover.Header"
        closeButton={dismissButton}
        slotName="dismissButton"
        closeLabel={closeLabel}
        onClose={dismiss}
        className={cn(teachingPopoverClassNames.closeButton, 'absolute end-3 top-3')}
      />
    </div>
  );
};
TeachingPopoverHeader.displayName = 'TeachingPopoverHeader';

/** The TeachingPopover.Title's own props (component-specific props only). */
export interface TeachingPopoverTitleOwnProps {
  /**
   * The title text: the current step's `title` without children (or with children that render
   * nothing). A visually hidden step position (“, step 2 of 3”, worded by `labels.step`) follows
   * either, so the heading, which names the popover, says where the tour is.
   */
  children?: React.ReactNode;
}

/** Props of {@link TeachingPopoverTitle} rendered as `C` (default `'h3'`), including `ref`. */
export type TeachingPopoverTitleProps<C extends React.ElementType = 'h3'> = PolymorphicProps<
  C,
  TeachingPopoverTitleOwnProps
>;

/** The props the implementation reads, for any `as` (the public typing is `PolymorphicComponent`). */
type TeachingPopoverTitleImplProps = TeachingPopoverTitleOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * The step title (Fluent's `TeachingPopoverTitle`): an `<h3>` (another level, or any element,
 * with `as`) holding the current step's `title`, or your children, and a visually hidden step
 * position. It names the surface: the surface's `aria-labelledby` points at its `id` (yours, or a
 * generated one), wherever it is among the Surface's children (inside `TeachingPopover.Body`, as
 * in Fluent, works too).
 *
 * Also exported as `TeachingPopoverTitle` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Title` (that needs a client file).
 */
export const TeachingPopoverTitle: PolymorphicComponent<'h3', TeachingPopoverTitleOwnProps> = (
  props,
) => {
  const {
    as,
    id: idProp,
    className,
    children,
    ref,
    ...rest
  } = props as TeachingPopoverTitleImplProps;
  const { step, stepPosition, titleId } = useTeachingPopoverContext('TeachingPopover.Title');
  const registry = React.useContext(TeachingPopoverSurfaceContext);
  const id = idProp || titleId;
  // Registered while the element is mounted: the surface is named by the titles it renders.
  const registerTitle = registry?.registerTitle;
  const register = React.useCallback(
    (node: HTMLElement | null) => (node && registerTitle ? registerTitle(id) : undefined),
    [registerTitle, id],
  );
  const mergedRef = useMergedRefs<HTMLElement>(ref, register);
  if (!step) return null;

  const Component: React.ElementType = as ?? 'h3';
  return (
    <Component
      id={id}
      className={cn(
        teachingPopoverTitleClassNames.root,
        teachingPopoverClassNames.title,
        'mb-2 pe-8 text-subtitle-1 font-semibold text-foreground',
        className,
      )}
      {...rest}
      ref={mergedRef}
    >
      {slotRendersContent(children) ? materialiseSlotContent(children) : step.title}
      <span className="sr-only">{`, ${stepPosition}`}</span>
    </Component>
  );
};
TeachingPopoverTitle.displayName = 'TeachingPopoverTitle';

/** Properties for the TeachingPopoverBody sub-component. */
export interface TeachingPopoverBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The body content: the current step's `body` without children (or with children that render
   * nothing).
   */
  children?: React.ReactNode;
  /**
   * Media above the content, such as a picture or a short video of the feature, inside a `<span>`
   * (`media={<img src="…" alt="…" />}`; a slot object sets the span's own attributes). It is
   * content, not decoration: give a picture its `alt` (`alt=""` when the text says it all). A
   * value that renders nothing renders no element.
   */
  media?: Slot<'span'>;
  /** Ref to the body element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The step body (Fluent's `TeachingPopoverBody`): the current step's `body`, or your children,
 * after an optional `media` element.
 *
 * Also exported as `TeachingPopoverBody` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Body` (that needs a client file).
 */
export const TeachingPopoverBody = ({
  media,
  className,
  children,
  ref,
  ...rest
}: TeachingPopoverBodyProps) => {
  const { step } = useTeachingPopoverContext('TeachingPopover.Body');
  if (!step) return null;

  return (
    <div
      ref={ref}
      className={cn(
        teachingPopoverBodyClassNames.root,
        teachingPopoverClassNames.body,
        'mb-4 text-body-1 text-muted-foreground',
        className,
      )}
      {...rest}
    >
      {slotRendersContent(media) &&
        renderSlot(
          media,
          'span',
          cn(teachingPopoverBodyClassNames.media, 'mb-3 block overflow-hidden rounded-md'),
        )}
      {slotRendersContent(children) ? materialiseSlotContent(children) : step.body}
    </div>
  );
};
TeachingPopoverBody.displayName = 'TeachingPopoverBody';

/** Properties for the TeachingPopoverFooter sub-component. */
export interface TeachingPopoverFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The footer content. Without children (or with children that render nothing) the step dots and
   * the buttons of the current step: Back and Next (Done on the last step), or the
   * `primaryAction` and `secondaryAction` that replace them.
   */
  children?: React.ReactNode;
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The bottom row (Fluent's `TeachingPopoverFooter`): the step dots and the buttons of the current
 * step, laid out by TeachingPopover's `footerLayout` (rendered as `data-layout` here too), or your
 * children. The steps, the actions and their labels stay on TeachingPopover.
 *
 * Also exported as `TeachingPopoverFooter` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Footer` (that needs a client file).
 */
export const TeachingPopoverFooter = ({
  className,
  children,
  ref,
  ...rest
}: TeachingPopoverFooterProps) => {
  const context = useTeachingPopoverContext('TeachingPopover.Footer');
  const { step, footerLayout } = context;
  if (!step) return null;

  const vertical = footerLayout === 'vertical';
  return (
    <div
      ref={ref}
      data-layout={footerLayout}
      className={cn(
        teachingPopoverFooterClassNames.root,
        teachingPopoverClassNames.footer,
        'flex gap-2',
        vertical ? 'flex-col items-stretch gap-4' : 'items-center justify-between',
        className,
      )}
      {...rest}
    >
      {slotRendersContent(children) ? (
        materialiseSlotContent(children)
      ) : (
        <TeachingFooterContent context={context} />
      )}
    </div>
  );
};
TeachingPopoverFooter.displayName = 'TeachingPopoverFooter';

/**
 * The default content of the footer (internal): the step dots and the buttons of the current
 * step (Back and Next or Done, or the actions that replace them).
 */
function TeachingFooterContent({ context }: { context: TeachingPopoverContextValue }) {
  const vertical = context.footerLayout === 'vertical';
  const { secondary, primary } = renderStepButtons(context);

  return (
    <>
      <TeachingStepDots
        count={context.count}
        index={context.index}
        className={vertical && 'justify-center'}
      />

      <div className={cn('flex gap-2', vertical ? 'flex-col items-stretch' : 'items-center')}>
        {secondary}
        {primary}
      </div>
    </>
  );
}
TeachingFooterContent.displayName = 'TeachingFooterContent';

/**
 * The decorative step dots (internal): one per step, the current one wider and marked
 * `aria-current`, all hidden from assistive technology (the heading carries the step position).
 * The default indicator of both footers.
 */
function TeachingStepDots({
  count,
  index,
  className,
}: {
  count: number;
  index: number;
  className?: string | false;
}) {
  return (
    <div aria-hidden="true" className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          data-wave-teaching-popover-dot=""
          aria-current={i === index ? 'step' : undefined}
          className={cn(
            teachingPopoverClassNames.dot,
            'h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none',
            i === index
              ? cn('w-4 bg-primary', forcedColors.fill)
              : 'w-1.5 bg-stroke-accessible forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none',
          )}
        />
      ))}
    </div>
  );
}
TeachingStepDots.displayName = 'TeachingStepDots';

/** What a TeachingPopover.CarouselFooter changes about the buttons of {@link renderStepButtons}. */
interface StepButtonTexts {
  /** The text of the first step's secondary button, which then dismisses the popover. */
  initialStepText?: string;
  /** The text of the primary button on the last step, in place of Done. */
  finalStepText?: string;
}

/**
 * The secondary and primary buttons of the current step (internal), shared by both footers: the
 * actions that replace them, else Back (focusable and `aria-disabled` on the first step; none for
 * a single step) and Next (Done on the last step). With `initialStepText`, the first step's
 * secondary button shows it and dismisses the popover; with `finalStepText`, the last step's
 * primary button shows it. Each stays in its place across steps, so a button that has focus
 * keeps it when the step changes.
 */
function renderStepButtons(
  context: TeachingPopoverContextValue,
  { initialStepText, finalStepText }: StepButtonTexts = {},
): { secondary: React.ReactNode; primary: React.ReactNode } {
  const {
    count,
    isFirst,
    isLast,
    goBack,
    goNext,
    dismiss,
    primaryAction,
    secondaryAction,
    backLabel,
    nextLabel,
    doneLabel,
  } = context;

  let secondary: React.ReactNode;
  if (secondaryAction) {
    secondary = renderAction(
      secondaryAction,
      'outline',
      teachingPopoverClassNames.secondaryButton,
      goBack,
    );
  } else if (isFirst && initialStepText) {
    secondary = (
      <Button className={teachingPopoverClassNames.backButton} onClick={dismiss}>
        {initialStepText}
      </Button>
    );
  } else if (count > 1) {
    secondary = (
      <Button
        {...focusableDisabledProps(isFirst)}
        className={teachingPopoverClassNames.backButton}
        onClick={preventIfDisabled(isFirst, goBack)}
      >
        {backLabel}
      </Button>
    );
  }

  const primary = primaryAction ? (
    renderAction(primaryAction, 'primary', teachingPopoverClassNames.primaryButton, goNext)
  ) : (
    <Button appearance="primary" className={teachingPopoverClassNames.nextButton} onClick={goNext}>
      {isLast ? finalStepText || doneLabel : nextLabel}
    </Button>
  );

  return { secondary, primary };
}

/** Properties for the TeachingPopoverCarousel sub-component. */
export interface TeachingPopoverCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The carousel's content. Without children (or with children that render nothing) the current
   * step as a carousel page: `TeachingPopover.Title`, `TeachingPopover.Body` and
   * `TeachingPopover.CarouselFooter` without children of their own.
   */
  children?: React.ReactNode;
  /** Ref to the carousel element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The tour as a carousel (Fluent's `TeachingPopoverCarousel`): it holds the current step's page
 * and the carousel footer. The steps stay on TeachingPopover (its `steps` are the pages, so there
 * is no card part), and so do the step state and the callbacks: the carousel parts read them
 * wherever they are in the popover. Without children it shows the step title and body and a
 * `TeachingPopover.CarouselFooter`.
 *
 * Also exported as `TeachingPopoverCarousel` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Carousel` (that needs a client file).
 */
export const TeachingPopoverCarousel = ({
  className,
  children,
  ref,
  ...rest
}: TeachingPopoverCarouselProps) => {
  const { step } = useTeachingPopoverContext('TeachingPopover.Carousel');
  if (!step) return null;

  return (
    <div ref={ref} className={cn(teachingPopoverCarouselClassNames.root, className)} {...rest}>
      {slotRendersContent(children) ? (
        materialiseSlotContent(children)
      ) : (
        <>
          <TeachingPopoverTitle />
          <TeachingPopoverBody />
          <TeachingPopoverCarouselFooter />
        </>
      )}
    </div>
  );
};
TeachingPopoverCarousel.displayName = 'TeachingPopoverCarousel';

/** Properties for the TeachingPopoverCarouselNav sub-component. */
export interface TeachingPopoverCarouselNavProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Ref to the element of the step buttons. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Interactive step buttons (Fluent's `TeachingPopoverCarouselNav`): a group named by
 * `labels.nav` (“Choose step”) with one button per step, each named by `labels.navButton`
 * (“Step 2 of 3”) and a Tab stop. The current step's button has `aria-current="step"`; activating
 * another one shows its step (`onStepChange`, then the step announcement), and focus stays on it.
 * Opt-in: the footers show decorative dots unless you place it, for example as the children of
 * `TeachingPopover.CarouselFooter`.
 *
 * Also exported as `TeachingPopoverCarouselNav` for React Server Components, which cannot use the
 * dotted `TeachingPopover.CarouselNav` (that needs a client file).
 */
export const TeachingPopoverCarouselNav = ({
  className,
  ref,
  ...rest
}: TeachingPopoverCarouselNavProps) => {
  const { step, count, index, goToStep, navLabel, navButtonLabel } = useTeachingPopoverContext(
    'TeachingPopover.CarouselNav',
  );
  if (!step) return null;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={navLabel}
      className={cn(teachingPopoverCarouselNavClassNames.root, 'flex items-center', className)}
      {...rest}
    >
      {Array.from({ length: count }, (_, i) => {
        const current = i === index;
        return (
          <button
            key={i}
            type="button"
            aria-label={navButtonLabel(i, count)}
            aria-current={current ? 'step' : undefined}
            onClick={() => goToStep(i)}
            className={cn(
              teachingPopoverCarouselNavClassNames.button,
              'group inline-flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0',
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                teachingPopoverCarouselNavClassNames.indicator,
                'block h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none',
                current
                  ? cn('w-4 bg-primary', forcedColors.fill)
                  : 'w-1.5 bg-stroke-accessible group-hover:bg-foreground forced-colors:bg-[ButtonText] forced-colors:forced-color-adjust-none',
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
TeachingPopoverCarouselNav.displayName = 'TeachingPopoverCarouselNav';

const defaultPageCount = (current: number, total: number) => `${current} of ${total}`;

/** Properties for the TeachingPopoverCarouselPageCount sub-component. */
export interface TeachingPopoverCarouselPageCountProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /**
   * The text from the one-based number of the current step and the step count (Fluent's render
   * function); it also localizes the text. A result that renders nothing keeps the default. A
   * Server Component cannot pass a function: write the part with one in a client file.
   * @default (current, total) => `${current} of ${total}`
   */
  children?: (current: number, total: number) => React.ReactNode;
  /** Ref to the count element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The visible step count (Fluent's `TeachingPopoverCarouselPageCount`), such as “2 of 3”: the
 * current step and the step count, worded by a render function child. Place it in a footer,
 * for example in `TeachingPopover.CarouselFooter` next to or instead of `TeachingPopover.CarouselNav`.
 *
 * Also exported as `TeachingPopoverCarouselPageCount` for React Server Components, which cannot
 * use the dotted `TeachingPopover.CarouselPageCount` (that needs a client file).
 */
export const TeachingPopoverCarouselPageCount = ({
  className,
  children,
  ref,
  ...rest
}: TeachingPopoverCarouselPageCountProps) => {
  const { step, count, index } = useTeachingPopoverContext('TeachingPopover.CarouselPageCount');
  if (!step) return null;

  const text = children?.(index + 1, count);
  return (
    <div
      ref={ref}
      className={cn(
        teachingPopoverCarouselPageCountClassNames.root,
        'shrink-0 text-caption-1 text-muted-foreground',
        className,
      )}
      {...rest}
    >
      {slotRendersContent(text) ? materialiseSlotContent(text) : defaultPageCount(index + 1, count)}
    </div>
  );
};
TeachingPopoverCarouselPageCount.displayName = 'TeachingPopoverCarouselPageCount';

/** Properties for the TeachingPopoverCarouselFooter sub-component. */
export interface TeachingPopoverCarouselFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Where the indicator sits: `'offset'` puts it at the start and the buttons together at the
   * end, as `TeachingPopover.Footer` does, and the buttons wrap to a row of their own (at the end)
   * when both do not fit in one row; `'centered'` puts it between the secondary button at the
   * start and the primary button at the end, in the middle of the footer whatever the buttons'
   * widths (also without a secondary button), and when that row does not fit, the indicator takes
   * a row of its own above the buttons and the footer gets `data-stacked`. While stacked, the
   * visual order differs from the Tab order, which stays the secondary button, the indicator's
   * step buttons, then the primary button. The indicator never shrinks below its content. Rendered as `data-carousel-layout`. (Fluent's default is
   * `'centered'`; WaveUI keeps its own footer's arrangement.) TeachingPopover's `footerLayout`
   * applies to `TeachingPopover.Footer` only.
   * @default 'offset'
   */
  layout?: 'offset' | 'centered';
  /**
   * The text of the first step's secondary button (“Not now”). Given, that button is enabled and
   * dismisses the popover as Close does (`onOpenChange(false)`, then `onDismiss`; not
   * `onFinish`), also on a single step. Without it the first step keeps Back, focusable and
   * `aria-disabled`, and a single step has none. A `secondaryAction` replaces the button.
   */
  initialStepText?: string;
  /**
   * The text of the primary button on the last step (“Got it”), which finishes the tour as Done
   * does. A `primaryAction` replaces the button.
   * @default TeachingPopover's `labels.done` ('Done')
   */
  finalStepText?: string;
  /**
   * The indicator: without children (or with children that render nothing) the decorative step
   * dots; give it `TeachingPopover.CarouselNav` for interactive step buttons, or
   * `TeachingPopover.CarouselPageCount` for a visible count. The buttons always render.
   */
  children?: React.ReactNode;
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The carousel's bottom row (Fluent's `TeachingPopoverCarouselFooter`): an indicator (the
 * decorative step dots, or your children) and the buttons of the current step, as in
 * `TeachingPopover.Footer`: Back and Next (Done on the last step), or the `secondaryAction` and
 * `primaryAction` that replace them. `initialStepText` turns the first step's Back into a button
 * that dismisses the popover (“Not now”), `finalStepText` relabels Done, and `layout` places the
 * indicator; the footer wraps instead of letting the indicator and the buttons overlap. The steps,
 * the actions and the callbacks stay on TeachingPopover.
 *
 * Also exported as `TeachingPopoverCarouselFooter` for React Server Components, which cannot use
 * the dotted `TeachingPopover.CarouselFooter` (that needs a client file).
 */
export const TeachingPopoverCarouselFooter = ({
  layout = 'offset',
  initialStepText,
  finalStepText,
  className,
  children,
  ref,
  ...rest
}: TeachingPopoverCarouselFooterProps) => {
  const context = useTeachingPopoverContext('TeachingPopover.CarouselFooter');
  const centered = layout === 'centered';
  const [footer, setFooter] = React.useState<HTMLDivElement | null>(null);
  const footerRef = useMergedRefs<HTMLDivElement>(ref, setFooter);
  const stacked = useCarouselFooterStacked(footer, centered && context.step !== undefined);
  if (!context.step) return null;

  const { secondary, primary } = renderStepButtons(context, { initialStepText, finalStepText });
  // The indicator is as wide as its content: it never shrinks under the buttons. Content wider
  // than the whole footer wraps inside it.
  const indicator = slotRendersContent(children) ? (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        centered && 'w-max max-w-full justify-center',
      )}
    >
      {materialiseSlotContent(children)}
    </div>
  ) : (
    <TeachingStepDots count={context.count} index={context.index} />
  );

  if (!centered) {
    // The indicator at the start and the buttons at the end; when both do not fit in one row, the
    // buttons wrap to a row of their own, still at the end.
    return (
      <div
        ref={footerRef}
        data-carousel-layout={layout}
        className={cn(
          teachingPopoverCarouselFooterClassNames.root,
          teachingPopoverClassNames.footer,
          'flex flex-wrap items-center justify-between gap-2',
          className,
        )}
        {...rest}
      >
        {indicator}
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {secondary}
          {primary}
        </div>
      </div>
    );
  }

  // Centered: one row of three columns, the outer two of equal width, so the indicator sits in
  // the middle of the footer whatever the buttons' widths, with or without a secondary button.
  // When that row does not fit (useCarouselFooterStacked measures it), the indicator takes a row
  // of its own above the buttons. The DOM order stays secondary, indicator, primary in both, so
  // a button keeps focus when the layout changes.
  return (
    <div
      ref={footerRef}
      data-carousel-layout={layout}
      data-stacked={stacked ? '' : undefined}
      className={cn(
        teachingPopoverCarouselFooterClassNames.root,
        teachingPopoverClassNames.footer,
        'items-center gap-2',
        stacked ? 'flex flex-wrap' : 'grid grid-cols-[1fr_auto_1fr]',
        className,
      )}
      {...rest}
    >
      {slotRendersContent(secondary) && (
        <div
          data-wave-carousel-footer-slot="secondary"
          className={cn('flex w-max max-w-full', !stacked && 'col-start-1 justify-self-start')}
        >
          {secondary}
        </div>
      )}
      <div
        data-wave-carousel-footer-slot="indicator"
        className={cn('flex justify-center', stacked ? 'order-first basis-full' : 'col-start-2')}
      >
        {indicator}
      </div>
      <div
        data-wave-carousel-footer-slot="primary"
        className={cn(
          'flex w-max max-w-full',
          stacked ? 'ms-auto' : 'col-start-3 justify-self-end',
        )}
      >
        {primary}
      </div>
    </div>
  );
};
TeachingPopoverCarouselFooter.displayName = 'TeachingPopoverCarouselFooter';
