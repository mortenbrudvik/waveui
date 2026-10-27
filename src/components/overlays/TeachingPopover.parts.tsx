import * as React from 'react';
import { cn } from '../../lib/cn';
import { teachingPopoverClassNames, teachingPopoverSurfaceClassNames } from '../../lib/classNames';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { DismissIcon } from '../../lib/icons';
import { isElementOfType } from '../../lib/children';
import { resolveSlot, slotRendersContent } from '../../lib/slot';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusRing, forcedColors } from '../../lib/styles';
import type { VirtualElement } from '../../lib/types';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useDismiss } from '../../hooks/useDismiss';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { resolvePositioning, usePopupPosition } from '../../hooks/usePopupPosition';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { useTriggerElement } from '../../hooks/useTriggerElement';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import { getTabbableThrough, PopoverBeak, usePopoverTabOrder } from './Popover.shared';
import {
  useTeachingPopoverContext,
  type TeachingPopoverAction,
  type TeachingPopoverContextValue,
  type TeachingPopoverStep,
  type TeachingPopoverTarget,
} from './TeachingPopover.context';

/*
 * The TeachingPopover's parts and the surface they share with the root: `TeachingSurface` holds
 * the surface's hooks (positioning, dismissal, focus, keyboard order, announcements), so the
 * `steps` form and `TeachingPopover.Surface` render one element the same way. Imports the context
 * module only (never the root or `TeachingPopover.tsx`).
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
   * shows the current step as the `steps` form does: the Close button, the step title, its body
   * and the footer with the step dots and the buttons. Children replace all of that; the surface
   * is then named by your `aria-label` or `aria-labelledby`.
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

/** Properties of {@link TeachingDefaultContent}. */
interface TeachingDefaultContentProps {
  context: TeachingPopoverContextValue;
  step: TeachingPopoverStep;
}

/**
 * The content of the current step (internal): the Close button, the title with the hidden step
 * position, the body and the footer with the step dots and the buttons. The `steps` form and a
 * `TeachingPopover.Surface` without children render it.
 */
function TeachingDefaultContent({ context, step }: TeachingDefaultContentProps) {
  const {
    count,
    index,
    isFirst,
    isLast,
    stepPosition,
    titleId,
    dismiss,
    goBack,
    goNext,
    primaryAction,
    secondaryAction,
    footerLayout,
    backLabel,
    nextLabel,
    doneLabel,
    closeLabel,
  } = context;
  const vertical = footerLayout === 'vertical';

  return (
    <>
      <Button
        appearance="subtle"
        size="small"
        icon={<DismissIcon />}
        aria-label={closeLabel}
        className={cn(teachingPopoverClassNames.closeButton, 'absolute end-3 top-3')}
        onClick={dismiss}
      />

      <h3
        id={titleId}
        className={cn(
          teachingPopoverClassNames.title,
          'mb-2 pe-8 text-subtitle-1 font-semibold text-foreground',
        )}
      >
        {step.title}
        <span className="sr-only">{`, ${stepPosition}`}</span>
      </h3>

      <div className={cn(teachingPopoverClassNames.body, 'mb-4 text-body-1 text-muted-foreground')}>
        {step.body}
      </div>

      <div
        className={cn(
          teachingPopoverClassNames.footer,
          'flex gap-2',
          vertical ? 'flex-col items-stretch gap-4' : 'items-center justify-between',
        )}
      >
        <div
          aria-hidden="true"
          className={cn('flex items-center gap-1.5', vertical && 'justify-center')}
        >
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

        <div className={cn('flex gap-2', vertical ? 'flex-col items-stretch' : 'items-center')}>
          {secondaryAction
            ? renderAction(
                secondaryAction,
                'outline',
                teachingPopoverClassNames.secondaryButton,
                goBack,
              )
            : count > 1 && (
                <Button
                  {...focusableDisabledProps(isFirst)}
                  className={teachingPopoverClassNames.backButton}
                  onClick={preventIfDisabled(isFirst, goBack)}
                >
                  {backLabel}
                </Button>
              )}
          {primaryAction ? (
            renderAction(primaryAction, 'primary', teachingPopoverClassNames.primaryButton, goNext)
          ) : (
            <Button
              appearance="primary"
              className={teachingPopoverClassNames.nextButton}
              onClick={goNext}
            >
              {isLast ? doneLabel : nextLabel}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
TeachingDefaultContent.displayName = 'TeachingDefaultContent';

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
 * order and step announcements. The root renders it with its own props when no
 * `TeachingPopover.Surface` is among its children; `TeachingPopover.Surface` renders it with its
 * props. Its children replace the content of the current step.
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
    surfaceId,
    setCustomSurfaceId,
    registerSurface,
  } = context;
  const announce = useAnnounce();
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

  useRestoreFocus({
    enabled: visible,
    container: surface,
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

  // The root checks after each commit that it has one surface.
  React.useLayoutEffect(() => registerSurface(), [registerSurface]);

  // The consumer's id names the surface for the Trigger's `aria-controls`.
  const ownId = id || undefined;
  React.useEffect(() => {
    setCustomSurfaceId(ownId);
    return () => setCustomSurfaceId(undefined);
  }, [ownId, setCustomSurfaceId]);

  if (!shown || !step) return null;

  // Children replace the step content, and with it the title that names the surface.
  const hasContent = slotRendersContent(children);

  return (
    <Portal disabled={!hasTarget} layerId={layerId}>
      <div
        role="dialog"
        aria-labelledby={hasContent ? undefined : titleId}
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

        {hasContent ? children : <TeachingDefaultContent context={context} step={step} />}
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
 * trigger: it is portaled next to it with a beak, takes its place in the keyboard order right
 * after it, and focus returns to it. Place it directly inside TeachingPopover (a Fragment is
 * fine): the popover then starts closed unless `defaultOpen` says otherwise. A trigger nested
 * deeper still works, but leaves `defaultOpen` at `true` and becomes the target once it has
 * mounted.
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
 * children replace that content (name the surface with `aria-label` or `aria-labelledby` then).
 *
 * Render one, directly inside TeachingPopover (a Fragment is fine); TeachingPopover then renders
 * no surface of its own, and its own `className`, `style`, `ref` and other element props are
 * ignored (a development warning says so). A Surface inside an element or a component of yours is
 * not found there: TeachingPopover renders its own surface as well, and a development warning says
 * so.
 *
 * Also exported as `TeachingPopoverSurface` for React Server Components, which cannot use the
 * dotted `TeachingPopover.Surface` (that needs a client file).
 */
export const TeachingPopoverSurface = ({ ref, ...rest }: TeachingPopoverSurfaceProps) => {
  const context = useTeachingPopoverContext('TeachingPopover.Surface');
  return (
    <TeachingSurface
      context={context}
      rootClassName={cn(teachingPopoverClassNames.root, teachingPopoverSurfaceClassNames.root)}
      {...rest}
      ref={ref}
    />
  );
};
TeachingPopoverSurface.displayName = 'TeachingPopoverSurface';
