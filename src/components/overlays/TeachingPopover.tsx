import * as React from 'react';
import { cn } from '../../lib/cn';
import { teachingPopoverClassNames } from '../../lib/classNames';
import { resolveDeprecatedProp, warnOnce } from '../../lib/dev';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { DismissIcon } from '../../lib/icons';
import { isElementOfType } from '../../lib/children';
import { resolveSlot, slotRendersContent, type SlotObject } from '../../lib/slot';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusRing, forcedColors } from '../../lib/styles';
import type { PopupAlign, PopupPositioning, PopupSide, VirtualElement } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useDismiss } from '../../hooks/useDismiss';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { resolvePositioning, usePopupPosition } from '../../hooks/usePopupPosition';
import { useTargetConflictWarning } from '../../hooks/useResolvedTarget';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useAnnounce } from '../../hooks/useAnnounce';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import { getTabbableThrough, PopoverBeak, usePopoverTabOrder } from './Popover.shared';

/**
 * A footer action of a TeachingPopover (`primaryAction`, `secondaryAction`): the label content, or
 * a Button-like slot (a `Button`, `<button>` or `<a>` element, or a slot object such as
 * `{ as: 'a', href, children }`; `as` changes the element, which stays a Wave Button).
 *
 * The consumer's `onClick` runs first; then the step's normal action runs (Next or Done for the
 * primary action, Back for the secondary one) unless the handler called `event.preventDefault()`.
 */
export type TeachingPopoverAction =
  | React.ReactNode
  | (SlotObject<'button'> &
      Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'download'>);

/** Defines a single step in a teaching popover sequence. */
export interface TeachingPopoverStep {
  /** Title text for the step. */
  title: string;
  /** Body content for the step. */
  body: React.ReactNode;
  /**
   * Replaces the Next (or, on the last step, Done) button on this step; wins over the
   * popover's `primaryAction`.
   */
  primaryAction?: TeachingPopoverAction;
  /**
   * Replaces the Back button on this step (also on a single-step popover, which has no Back);
   * wins over the popover's `secondaryAction`.
   */
  secondaryAction?: TeachingPopoverAction;
}

/** The built-in text of a TeachingPopover, for localization (see `TeachingPopoverProps.labels`). */
export interface TeachingPopoverLabels {
  /** Text of the Back button.
   * @default 'Back'
   */
  back?: string;
  /** Text of the Next button.
   * @default 'Next'
   */
  next?: string;
  /** Text of the button that replaces Next on the last step.
   * @default 'Done'
   */
  done?: string;
  /**
   * The position of the step at `index` (zero-based, like `activeStep`) out of `count` steps. It
   * follows the step title, after a comma, in the visually hidden part of the heading and in the
   * announcement of a step change.
   * @default (index, count) => `step ${index + 1} of ${count}`
   */
  step?: (index: number, count: number) => string;
}

const DEFAULT_BACK_LABEL = 'Back';
const DEFAULT_NEXT_LABEL = 'Next';
const DEFAULT_DONE_LABEL = 'Done';
const defaultStepLabel = (index: number, count: number) => `step ${index + 1} of ${count}`;

/** Properties for the TeachingPopover component. */
export interface TeachingPopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Steps to display in the teaching popover (a readonly array is accepted). */
  steps: readonly TeachingPopoverStep[];
  /**
   * Controlled index of the displayed step. Out-of-range values are clamped to the first or last
   * step (with a development warning).
   */
  activeStep?: number;
  /** Initial step index for uncontrolled usage.
   * @default 0
   */
  defaultActiveStep?: number;
  /** @deprecated Use `activeStep`. */
  currentStep?: number;
  /** @deprecated Use `defaultActiveStep`. */
  defaultCurrentStep?: number;
  /** Called with the requested step index when Next or Back is activated. */
  onStepChange?: (step: number) => void;
  /**
   * Called when the popover is dismissed with Close, Done or Escape.
   *
   * Done also calls it in 0.x, after `onFinish`, so that code written before `onFinish` keeps
   * working; from 1.0 only Close and Escape will.
   */
  onDismiss?: () => void;
  /**
   * Called when the tour is finished: Done, the button that replaces Next on the last step, or a
   * `primaryAction` on the last step whose click was not prevented. The popover closes first.
   * Close and Escape call only `onDismiss`. Fires on every activation, like `onStepChange`.
   */
  onFinish?: () => void;
  /**
   * Replaces the Next (or Done) button on every step that sets no `primaryAction` of its own.
   */
  primaryAction?: TeachingPopoverAction;
  /**
   * Replaces the Back button on every step that sets no `secondaryAction` of its own.
   */
  secondaryAction?: TeachingPopoverAction;
  /**
   * How the footer lays out the step dots and the buttons: side by side, or the dots above
   * buttons that fill the width. Rendered as `data-layout`.
   * @default 'horizontal'
   */
  footerLayout?: 'horizontal' | 'vertical';
  /** Controlled visibility of the teaching popover. */
  open?: boolean;
  /** Initial visibility for uncontrolled usage.
   * @default true
   */
  defaultOpen?: boolean;
  /** Called with `false` when Close, Done or Escape dismisses the popover. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Accessible name of the built-in Close button (an icon-only button). Localize it with the
   * page's language.
   * @default 'Close'
   */
  closeLabel?: string;
  /**
   * Text of the Back, Next and Done buttons and the wording of the step position (“step 2 of 3”),
   * for localization. Unset members keep their English defaults.
   */
  labels?: TeachingPopoverLabels;
  /**
   * The element the popover points at (a ref, the element, or a `VirtualElement`: a rectangle such as a
   * point; an inline object is fine). When given, the popover is
   * rendered in a portal, positioned next to it with a beak, and flips or shifts to stay in view;
   * without it (`undefined`) the popover renders inline where it is placed (0.4 behaviour).
   * While the target is `null` or has not been positioned against yet (an element held in state
   * that is not set yet, a ref that is not attached), the popover stays hidden: it is not
   * shown, takes no focus, announces no step change and does not handle Escape until it can
   * point at the target. It hides the same way when the target goes away later and shows again
   * when a target returns.
   *
   * An element (for example one held in state through a callback ref) is followed as soon as the
   * prop changes. A ref cannot be observed, so it is read after each render of the popover is
   * committed, wherever the target is in the tree: an element attaching to or detaching from the
   * ref is noticed the next time the popover renders (for example when the parent that mounts or
   * unmounts the target re-renders it), not in a commit that does not render the popover. A
   * memoized popover whose target mounts or unmounts in another subtree therefore stays hidden,
   * or keeps pointing at the removed element, until it renders again. A newly passed ref keeps
   * the previous visibility until it has been read, so a tour can move between attached refs
   * (`target={step === 0 ? aRef : bRef}`) without hiding, and a switch to a ref that is not
   * attached hides the popover right after that commit. Pass the element held in state when the
   * target can mount or unmount without the popover re-rendering.
   */
  target?: React.RefObject<HTMLElement | null> | HTMLElement | VirtualElement | null;
  /** Side of the `target` to open on; `start`/`end` follow the writing direction.
   * @default 'bottom'
   */
  side?: PopupSide;
  /** Alignment along the `target`'s edge.
   * @default 'center'
   */
  align?: PopupAlign;
  /**
   * Advanced positioning (Fluent's `positioning`): `offset`, `fitViewport`, `matchReferenceWidth`,
   * `fallbackPlacements` and `target` (used when the `target` prop is not set). `side` and `align`
   * stay separate props.
   * @default `{ offset: 12 }`
   */
  positioning?: PopupPositioning;
  /** Ref to the popover surface (`role="dialog"`). */
  ref?: React.Ref<HTMLDivElement>;
}

function isRefObject(
  target: NonNullable<TeachingPopoverProps['target']>,
): target is React.RefObject<HTMLElement | null> {
  return 'current' in target;
}

function isElementTarget(target: TeachingPopoverProps['target']): target is HTMLElement {
  return (
    target != null && !isRefObject(target) && typeof (target as Partial<Node>).nodeType === 'number'
  );
}

function isVirtualTarget(target: TeachingPopoverProps['target']): target is VirtualElement {
  return target != null && !isRefObject(target) && !isElementTarget(target);
}

function resolveTarget(target: TeachingPopoverProps['target']): HTMLElement | null {
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

/** The action a step shows: its own when it renders anything, else the popover's. */
function pickAction(
  own: TeachingPopoverAction | undefined,
  fallback: TeachingPopoverAction | undefined,
): TeachingPopoverAction | undefined {
  if (slotRendersContent(own)) return own;
  return slotRendersContent(fallback) ? fallback : undefined;
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

function clampStep(step: number, count: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(Math.max(Math.trunc(step), 0), count - 1);
}

/**
 * A step-by-step onboarding popover (a non-modal `role="dialog"`) with Back/Next (Done on the
 * last step) and Close.
 *
 * - Visibility is controllable: `open`/`defaultOpen` (default `true`)/`onOpenChange`; Close, Done
 *   and Escape (anywhere in the document) dismiss it and call `onDismiss`.
 * - The step is controllable with `activeStep`/`defaultActiveStep`/`onStepChange` and clamped to
 *   the available steps. The heading carries a visually hidden “step n of m”, the new step is
 *   announced politely, and Back stays focusable (`aria-disabled`) on the first step.
 * - `primaryAction` and `secondaryAction` (on the popover, or on a step, which wins) replace Next/Done
 *   and Back: a label, a Button-like element or a slot object. The consumer's `onClick` runs first,
 *   then the step's normal action unless it called `preventDefault()`. Done calls `onFinish`
 *   (and, in 0.x, `onDismiss`); `footerLayout` stacks the buttons.
 * - The built-in text is English: `labels` localizes Back, Next, Done and the step position, and
 *   `closeLabel` the Close button.
 * - Focus moves to the popover when it opens and returns to the element that had it when it
 *   closes (with `target`, to the target when nothing had focus, e.g. a tour opened on page load).
 * - With `target`, the popover is portaled and positioned next to that element with a beak (it
 *   inherits the surface colors); it stays hidden while the target is `null`, not positioned yet or
 *   no longer mounted (a ref target is read after each render of the popover; see `target`).
 * - With a `VirtualElement` target there is no element to follow: the popover keeps the place of
 *   its portal in the keyboard order.
 * - With an element or ref `target`, the keyboard order treats the popover as if it followed the target: Tab past
 *   its last button continues after the target, Shift+Tab from its first button (or from the
 *   popover itself) returns to the target (for a target outside the Tab order, to the last control
 *   inside it, else to the control before it), Tab from there enters the popover, and Shift+Tab
 *   from the control after the target enters it at its last button. Tab from the last control of
 *   the page moves past the popover (it was visited after the target), and Shift+Tab from outside
 *   the page reaches the page's last control first, so a lap visits it once and Tab never cycles.
 *   With no control at or before the target, the popover is reached where it is portaled, at the
 *   end of the page: Tab from the page's last control and Shift+Tab from outside the page enter
 *   it.
 */
export const TeachingPopover = ({
  steps,
  activeStep: activeStepProp,
  defaultActiveStep,
  currentStep,
  defaultCurrentStep,
  onStepChange,
  onDismiss,
  onFinish,
  primaryAction: primaryActionProp,
  secondaryAction: secondaryActionProp,
  footerLayout = 'horizontal',
  open: openProp,
  defaultOpen,
  onOpenChange,
  closeLabel = 'Close',
  labels,
  target: targetProp,
  positioning,
  side = 'bottom',
  align = 'center',
  className,
  style,
  onKeyDown,
  ref,
  ...rest
}: TeachingPopoverProps) => {
  useTargetConflictWarning('TeachingPopover', targetProp, positioning?.target);
  const target = (
    targetProp !== undefined ? targetProp : positioning?.target
  ) as TeachingPopoverProps['target'];
  const controlledStep = resolveDeprecatedProp(
    'TeachingPopover',
    activeStepProp,
    currentStep,
    'currentStep',
    'activeStep',
  );
  const initialStep =
    resolveDeprecatedProp(
      'TeachingPopover',
      defaultActiveStep,
      defaultCurrentStep,
      'defaultCurrentStep',
      'defaultActiveStep',
    ) ?? 0;
  const [rawStep, setStep] = useControllable(controlledStep, initialStep, onStepChange);
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? true, onOpenChange);
  const titleId = useId('teaching-popover-title');
  const announce = useAnnounce();

  const count = steps.length;
  const shown = open && count > 0;
  const index = count > 0 ? clampStep(rawStep, count) : 0;
  const outOfRange = count > 0 && index !== rawStep;
  const step = count > 0 ? steps[index] : undefined;
  const stepTitle = step?.title;
  const isFirst = index === 0;
  const isLast = index === count - 1;
  const hasTarget = target !== undefined;
  const stepPosition = count > 0 ? (labels?.step ?? defaultStepLabel)(index, count) : '';

  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  // Whether `target` pointed at an element when it was last read. An element (or `null`) is known
  // during render and is mirrored here right away (C-HOOKS: adjust state during render). A ref
  // cannot be read during render, React does not re-render when it attaches or detaches, and
  // floating-ui keeps `isPositioned` after `setReference(null)`, so the layout effect below reads
  // a ref after each commit and mirrors it here through a deferred update (C-HOOKS). Until that
  // update has read a newly passed ref, the ref keeps this last known availability: moving between
  // attached refs (a multi-target tour) or passing a new ref object on every render never hides
  // the popover, and a switch to a ref that is not attached hides it once the update lands.
  const pointsAtOneNow = (value: TeachingPopoverProps['target']) =>
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

  const dismiss = () => {
    setOpen(false);
    onDismiss?.();
  };
  // Done: close, then `onFinish`. `onDismiss` still follows in 0.x (see its JSDoc).
  const finish = () => {
    setOpen(false);
    onFinish?.();
    onDismiss?.();
  };

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

  React.useEffect(() => {
    if (!outOfRange) return;
    warnOnce(
      'TeachingPopover:activeStep-range',
      `TeachingPopover: activeStep ${rawStep} is out of range for ${count} steps; showing step ${index + 1}.`,
    );
  }, [outOfRange, rawStep, count, index]);

  if (!shown || !step) return null;

  const handleBack = () => {
    if (!isFirst) setStep(index - 1);
  };
  const handleNext = () => {
    if (isLast) finish();
    else setStep(index + 1);
  };
  const primaryAction = pickAction(step.primaryAction, primaryActionProp);
  const secondaryAction = pickAction(step.secondaryAction, secondaryActionProp);
  const vertical = footerLayout === 'vertical';

  return (
    <Portal disabled={!hasTarget} layerId={layerId}>
      <div
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-layout={footerLayout}
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
          teachingPopoverClassNames.root,
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

        <div
          className={cn(teachingPopoverClassNames.body, 'mb-4 text-body-1 text-muted-foreground')}
        >
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
            {steps.map((_, i) => (
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
                  handleBack,
                )
              : count > 1 && (
                  <Button
                    {...focusableDisabledProps(isFirst)}
                    className={teachingPopoverClassNames.backButton}
                    onClick={preventIfDisabled(isFirst, handleBack)}
                  >
                    {labels?.back ?? DEFAULT_BACK_LABEL}
                  </Button>
                )}
            {primaryAction ? (
              renderAction(
                primaryAction,
                'primary',
                teachingPopoverClassNames.primaryButton,
                handleNext,
              )
            ) : (
              <Button
                appearance="primary"
                className={teachingPopoverClassNames.nextButton}
                onClick={handleNext}
              >
                {isLast
                  ? (labels?.done ?? DEFAULT_DONE_LABEL)
                  : (labels?.next ?? DEFAULT_NEXT_LABEL)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};
TeachingPopover.displayName = 'TeachingPopover';
