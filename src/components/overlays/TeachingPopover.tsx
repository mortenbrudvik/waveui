import * as React from 'react';
import { cn } from '../../lib/cn';
import { resolveDeprecatedProp, warnOnce } from '../../lib/dev';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { DismissIcon } from '../../lib/icons';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusRing, forcedColors } from '../../lib/styles';
import type { PopupAlign, PopupSide } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useDismiss } from '../../hooks/useDismiss';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useAnnounce } from '../../hooks/useAnnounce';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import { getTabbableThrough, PopoverBeak, usePopoverTabOrder } from './Popover.shared';

/** Defines a single step in a teaching popover sequence. */
export interface TeachingPopoverStep {
  /** Title text for the step. */
  title: string;
  /** Body content for the step. */
  body: React.ReactNode;
}

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
  /** Called when the popover is dismissed with Close, Done or Escape. */
  onDismiss?: () => void;
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
   * The element the popover points at (a ref or the element). When given, the popover is
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
  target?: React.RefObject<HTMLElement | null> | HTMLElement | null;
  /** Side of the `target` to open on; `start`/`end` follow the writing direction.
   * @default 'bottom'
   */
  side?: PopupSide;
  /** Alignment along the `target`'s edge.
   * @default 'center'
   */
  align?: PopupAlign;
  /** Ref to the popover surface (`role="dialog"`). */
  ref?: React.Ref<HTMLDivElement>;
}

function isRefObject(
  target: NonNullable<TeachingPopoverProps['target']>,
): target is React.RefObject<HTMLElement | null> {
  return 'current' in target;
}

function isElementTarget(target: TeachingPopoverProps['target']): target is HTMLElement {
  return target != null && !isRefObject(target);
}

function resolveTarget(target: TeachingPopoverProps['target']): HTMLElement | null {
  if (!target) return null;
  return isRefObject(target) ? target.current : target;
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
 * - Focus moves to the popover when it opens and returns to the element that had it when it
 *   closes (with `target`, to the target when nothing had focus, e.g. a tour opened on page load).
 * - With `target`, the popover is portaled and positioned next to that element with a beak (it
 *   inherits the surface colors); it stays hidden while the target is `null`, not positioned yet or
 *   no longer mounted (a ref target is read after each render of the popover; see `target`).
 * - With `target`, the keyboard order treats the popover as if it followed the target: Tab past
 *   its last button continues after the target, Shift+Tab from its first button (or from the
 *   popover itself) returns to the target (for a target outside the Tab order, to the last control
 *   inside it, else to the control before it), Tab from there enters the popover, and Shift+Tab
 *   from the control after the target enters it at its last button. Reached natively from the far
 *   end of the page, it follows the document order, so Tab never cycles.
 */
export const TeachingPopover = ({
  steps,
  activeStep: activeStepProp,
  defaultActiveStep,
  currentStep,
  defaultCurrentStep,
  onStepChange,
  onDismiss,
  open: openProp,
  defaultOpen,
  onOpenChange,
  closeLabel = 'Close',
  target,
  side = 'bottom',
  align = 'center',
  className,
  style,
  onKeyDown,
  ref,
  ...rest
}: TeachingPopoverProps) => {
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

  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  // Whether `target` pointed at an element when it was last read. An element (or `null`) is known
  // during render and is mirrored here right away (C-HOOKS: adjust state during render). A ref
  // cannot be read during render, React does not re-render when it attaches or detaches, and
  // floating-ui keeps `isPositioned` after `setReference(null)`, so the layout effect below reads
  // a ref after each commit and mirrors it here through a deferred update (C-HOOKS). Until that
  // update has read a newly passed ref, the ref keeps this last known availability: moving between
  // attached refs (a multi-target tour) or passing a new ref object on every render never hides
  // the popover, and a switch to a ref that is not attached hides it once the update lands.
  const [targetResolved, setTargetResolved] = React.useState(() => isElementTarget(target));
  const elementAvailable = target === null ? false : isElementTarget(target) ? true : undefined;
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
  } = usePopupPosition({ open: shown && hasTarget, side, align, offset: 12, arrowRef });
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
    setReference(element);
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
      announce(`${stepTitle}, step ${index + 1} of ${count}`);
    }
  }, [index, visible, stepTitle, count, announce]);

  React.useEffect(() => {
    if (!outOfRange) return;
    warnOnce(
      'TeachingPopover:activeStep-range',
      `TeachingPopover: activeStep ${rawStep} is out of range for ${count} steps; showing step ${index + 1}.`,
    );
  }, [outOfRange, rawStep, count, index]);

  if (!shown || !step) return null;

  const handleBack = () => setStep(index - 1);
  const handleNext = () => {
    if (isLast) dismiss();
    else setStep(index + 1);
  };

  return (
    <Portal disabled={!hasTarget} layerId={layerId}>
      <div
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
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
          />
        )}

        <Button
          appearance="subtle"
          size="small"
          icon={<DismissIcon />}
          aria-label={closeLabel}
          className="absolute end-3 top-3"
          onClick={dismiss}
        />

        <h3 id={titleId} className="mb-2 pe-8 text-subtitle-1 font-semibold text-foreground">
          {step.title}
          <span className="sr-only">{`, step ${index + 1} of ${count}`}</span>
        </h3>

        <div className="mb-4 text-body-1 text-muted-foreground">{step.body}</div>

        <div className="flex items-center justify-between gap-2">
          <div aria-hidden="true" className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                data-wave-teaching-popover-dot=""
                aria-current={i === index ? 'step' : undefined}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none',
                  i === index
                    ? cn('w-4 bg-primary', forcedColors.fill)
                    : 'w-1.5 bg-stroke-accessible forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {count > 1 && (
              <Button
                {...focusableDisabledProps(isFirst)}
                onClick={preventIfDisabled(isFirst, handleBack)}
              >
                Back
              </Button>
            )}
            <Button appearance="primary" onClick={handleNext}>
              {isLast ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
TeachingPopover.displayName = 'TeachingPopover';
