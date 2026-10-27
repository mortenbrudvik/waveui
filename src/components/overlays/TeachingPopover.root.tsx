import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { teachingPopoverClassNames } from '../../lib/classNames';
import { resolveDeprecatedProp, warnOnce } from '../../lib/dev';
import { slotRendersContent } from '../../lib/slot';
import type { PopupAlign, PopupPositioning, PopupSide, VirtualElement } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useTargetConflictWarning } from '../../hooks/useResolvedTarget';
import {
  TeachingPopoverContext,
  type TeachingPopoverAction,
  type TeachingPopoverContextValue,
  type TeachingPopoverLabels,
  type TeachingPopoverStep,
} from './TeachingPopover.context';
import {
  TeachingPopoverSurface,
  TeachingPopoverTrigger,
  TeachingSurface,
} from './TeachingPopover.parts';

/*
 * The TeachingPopover root: its props, the state of both forms (the open state, the step and the
 * step's resolved content), the child scan for the Trigger and the Surface, and the surface it
 * renders when no Surface is among its children. Imports the context and parts modules (never
 * `TeachingPopover.tsx`, which holds the compound).
 */

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
   * Called when the popover is dismissed with Close, Done, Escape or a `TeachingPopover.Trigger`
   * that closes it.
   *
   * Done also calls it in 0.x, after `onFinish`, so that code written before `onFinish` keeps
   * working; from 1.0 only Close, Escape and the Trigger will.
   */
  onDismiss?: () => void;
  /**
   * Called when the tour is finished: Done, the button that replaces Next on the last step, or a
   * `primaryAction` on the last step whose click was not prevented. The popover closes first.
   * Close, Escape and the Trigger call only `onDismiss`. Fires on every activation, like
   * `onStepChange`.
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
  /**
   * Initial visibility for uncontrolled usage: `true` (a tour that shows on page load), or
   * `false` when a `TeachingPopover.Trigger` is a direct child (a Fragment is fine), which then
   * opens it.
   * @default true (false with a direct TeachingPopover.Trigger)
   */
  defaultOpen?: boolean;
  /**
   * Called with `false` when Close, Done or Escape dismisses the popover, and with the new state
   * when a `TeachingPopover.Trigger` opens or closes it.
   */
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
   * without it (`undefined`) the popover renders inline where it is placed (0.4 behaviour), or,
   * with a `TeachingPopover.Trigger`, points at the trigger.
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
  /**
   * `TeachingPopover.Trigger` and `TeachingPopover.Surface` (Fluent's composition), rendered where
   * they are written. Without a `TeachingPopover.Surface` among the direct children (a Fragment is
   * fine), the popover renders its surface itself, after the children, with the element props
   * given here (`className`, `style`, `ref`, …); with one, the Surface takes them instead.
   */
  children?: React.ReactNode;
  /**
   * Ref to the popover surface (`role="dialog"`). Ignored next to a `TeachingPopover.Surface`
   * (pass it to the Surface).
   */
  ref?: React.Ref<HTMLDivElement>;
}

/** The action a step shows: its own when it renders anything, else the popover's. */
function pickAction(
  own: TeachingPopoverAction | undefined,
  fallback: TeachingPopoverAction | undefined,
): TeachingPopoverAction | undefined {
  if (slotRendersContent(own)) return own;
  return slotRendersContent(fallback) ? fallback : undefined;
}

function clampStep(step: number, count: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(Math.max(Math.trunc(step), 0), count - 1);
}

/**
 * Which parts are direct children (Fragments flattened, lazy types of a Server Component
 * unwrapped): a Trigger closes `defaultOpen`, a Surface replaces the root's own surface. Runs
 * during render, so the server HTML agrees.
 */
function findParts(children: React.ReactNode): { trigger: boolean; surface: boolean } {
  const found = { trigger: false, surface: false };
  if (children === null || children === undefined) return found;
  for (const { node } of flattenChildren(children)) {
    if (isElementOfType(node, TeachingPopoverTrigger)) found.trigger = true;
    else if (isElementOfType(node, TeachingPopoverSurface)) found.surface = true;
  }
  return found;
}

const SURFACE_PLACEMENT_WARNING_KEY = 'TeachingPopover.Surface:placement';
const SURFACE_PLACEMENT_WARNING =
  'TeachingPopover.Surface: render one TeachingPopover.Surface, directly inside TeachingPopover (a Fragment is fine). A second Surface, or one inside an element or a component of your own, renders a second popover.';

const SURFACE_PROPS_WARNING_KEY = 'TeachingPopover:surface-props';
const SURFACE_PROPS_WARNING =
  'TeachingPopover: the props of the surface element on TeachingPopover (`className`, `style`, `ref`, `onKeyDown` and the other element props) are ignored next to a TeachingPopover.Surface: pass them to the Surface.';

// The root of `TeachingPopover` (documented on the export in TeachingPopover.tsx).
export const TeachingPopoverRoot = ({
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
  children,
  className,
  style,
  onKeyDown,
  ref,
  ...rest
}: TeachingPopoverProps) => {
  useTargetConflictWarning('TeachingPopover', targetProp, positioning?.target);
  const explicitTarget = (
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
  const parts = findParts(children);
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? !parts.trigger, onOpenChange);
  const titleId = useId('teaching-popover-title');

  const count = steps.length;
  const shown = open && count > 0;
  const index = count > 0 ? clampStep(rawStep, count) : 0;
  const outOfRange = count > 0 && index !== rawStep;
  const step = count > 0 ? steps[index] : undefined;
  const isFirst = index === 0;
  const isLast = index === count - 1;
  const stepPosition = count > 0 ? (labels?.step ?? defaultStepLabel)(index, count) : '';
  const primaryAction = step ? pickAction(step.primaryAction, primaryActionProp) : undefined;
  const secondaryAction = step ? pickAction(step.secondaryAction, secondaryActionProp) : undefined;
  const backLabel = labels?.back ?? DEFAULT_BACK_LABEL;
  const nextLabel = labels?.next ?? DEFAULT_NEXT_LABEL;
  const doneLabel = labels?.done ?? DEFAULT_DONE_LABEL;

  // A Trigger is the target when neither `target` nor `positioning.target` is set: a direct one
  // from the first render (the surface stays hidden until its element attaches), a nested one
  // once its element has attached.
  const [triggerElement, setTriggerElement] = React.useState<HTMLElement | null>(null);
  const hasTrigger = parts.trigger || triggerElement !== null;
  const target =
    explicitTarget !== undefined ? explicitTarget : hasTrigger ? triggerElement : undefined;

  // The Trigger's `aria-controls`: the id a surface's consumer gave it, else a generated one.
  const generatedSurfaceId = useId('teaching-popover');
  const [customSurfaceId, setCustomSurfaceId] = React.useState<string | undefined>(undefined);
  const surfaceId = customSurfaceId ?? generatedSurfaceId;

  const requestOpen = useEventCallback(() => setOpen(true));
  const dismiss = useEventCallback(() => {
    setOpen(false);
    onDismiss?.();
  });
  // Done: close, then `onFinish`. `onDismiss` still follows in 0.x (see its JSDoc).
  const finish = useEventCallback(() => {
    setOpen(false);
    onFinish?.();
    onDismiss?.();
  });
  const goBack = useEventCallback(() => {
    if (!isFirst) setStep(index - 1);
  });
  const goNext = useEventCallback(() => {
    if (isLast) finish();
    else setStep(index + 1);
  });

  // Surfaces register while mounted; after every commit (every surface's layout effect has run)
  // there must be one: a Surface the scan above did not find renders next to the root's own.
  const surfaceCountRef = React.useRef(0);
  const registerSurface = React.useCallback(() => {
    surfaceCountRef.current += 1;
    return () => {
      surfaceCountRef.current -= 1;
    };
  }, []);
  React.useEffect(() => {
    if (surfaceCountRef.current > 1) {
      warnOnce(SURFACE_PLACEMENT_WARNING_KEY, SURFACE_PLACEMENT_WARNING);
    }
  });

  // Next to a Surface the root renders no surface element, so its element props go nowhere.
  const ignoresSurfaceProps =
    parts.surface &&
    (className !== undefined ||
      style !== undefined ||
      onKeyDown !== undefined ||
      ref !== undefined ||
      Object.keys(rest).length > 0);
  React.useEffect(() => {
    if (ignoresSurfaceProps) warnOnce(SURFACE_PROPS_WARNING_KEY, SURFACE_PROPS_WARNING);
  }, [ignoresSurfaceProps]);

  React.useEffect(() => {
    if (!outOfRange) return;
    warnOnce(
      'TeachingPopover:activeStep-range',
      `TeachingPopover: activeStep ${rawStep} is out of range for ${count} steps; showing step ${index + 1}.`,
    );
  }, [outOfRange, rawStep, count, index]);

  const context = React.useMemo<TeachingPopoverContextValue>(
    () => ({
      open,
      shown,
      requestOpen,
      dismiss,
      finish,
      count,
      index,
      step,
      isFirst,
      isLast,
      stepPosition,
      goBack,
      goNext,
      primaryAction,
      secondaryAction,
      footerLayout,
      backLabel,
      nextLabel,
      doneLabel,
      closeLabel,
      titleId,
      target,
      side,
      align,
      positioning,
      hasTrigger,
      triggerElementRef: setTriggerElement,
      surfaceId,
      setCustomSurfaceId,
      registerSurface,
    }),
    [
      open,
      shown,
      requestOpen,
      dismiss,
      finish,
      count,
      index,
      step,
      isFirst,
      isLast,
      stepPosition,
      goBack,
      goNext,
      primaryAction,
      secondaryAction,
      footerLayout,
      backLabel,
      nextLabel,
      doneLabel,
      closeLabel,
      titleId,
      target,
      side,
      align,
      positioning,
      hasTrigger,
      surfaceId,
      registerSurface,
    ],
  );

  return (
    <TeachingPopoverContext.Provider value={context}>
      {children}
      {parts.surface ? null : (
        <TeachingSurface
          context={context}
          rootClassName={teachingPopoverClassNames.root}
          className={className}
          style={style}
          onKeyDown={onKeyDown}
          {...rest}
          ref={ref}
        />
      )}
    </TeachingPopoverContext.Provider>
  );
};
TeachingPopoverRoot.displayName = 'TeachingPopover';
