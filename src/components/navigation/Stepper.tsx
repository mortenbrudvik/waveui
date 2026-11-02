import * as React from 'react';
import { flattenChildren } from '../../lib/children';
import { wcn } from '../../lib/cn';
import { stepperClassNames, stepperStepClassNames } from '../../lib/classNames';
import { reportMissingContext } from '../../lib/dev';
import { CheckIcon, DismissIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { HIDDEN_PART_LOCKS, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { focusRing, forcedColors } from '../../lib/styles';
import type { Orientation } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';

/** Properties for the Stepper component. */
export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled index (0-based) of the currently active step. */
  activeStep?: number;
  /** Default active step index for uncontrolled usage.
   * @default 0
   */
  defaultActiveStep?: number;
  /**
   * Called with the step index whenever a step is activated (click, Enter or Space) — also when the
   * active step is activated again (0.4 semantics). Not called for disabled or unreachable steps.
   */
  onStepChange?: (step: number) => void;
  /** Layout orientation of the stepper.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /**
   * Whether navigation is restricted to sequential steps: only steps up to the one after the active
   * step can be activated; later steps are `aria-disabled` and leave the tab order.
   * @default false
   */
  linear?: boolean;
  /**
   * Visually hidden status text read before the number of a completed or error step ("Completed:
   * 2. Profile"), for localization: `{ completed: 'Fullført:', error: 'Feil:' }`. A label that is
   * not given keeps its English default; `''` leaves that status out of the step names.
   * @default { completed: 'Completed:', error: 'Error:' }
   */
  statusLabels?: { completed?: string; error?: string };
  /** Ref to the root `<div>` element. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the list the stepper draws inside its root, merged into its own: your classes after
   * its classes (yours win a conflict), your styles over its styles, your attributes and handlers
   * added, your ref attached beside the stepper's own. Every attribute the stepper sets on it is
   * locked. A part takes no `children` (the steps are yours, and each takes `slotProps` of its
   * own). Fluent UI has no Stepper.
   */
  slotProps?: {
    /**
     * The `<ol>` of the steps (stable class `wave-stepper__list`), which the stepper watches to
     * number its steps in document order. Locked: `role="list"`, and no `hidden`, `inert` or
     * `aria-hidden`, since it holds the steps.
     */
    list?: SlotPart<'ol'>;
  };
}

const DEFAULT_COMPLETED_LABEL = 'Completed:';
const DEFAULT_ERROR_LABEL = 'Error:';

/** Properties for the Step sub-component. */
export interface StepProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label text for the step. */
  label: string;
  /** Optional description text displayed below the label (the step button's description). */
  description?: string;
  /**
   * Custom icon to display in the step indicator (`Slot<'span'>`: a node, or a slot object for full
   * control). Decorative: rendered with `aria-hidden="true"`; the step number stays in the name. A
   * falsy icon (`''`, `0`) or a list of nothing is no icon: the step shows its number (or its check
   * mark when completed).
   */
  icon?: Slot<'span'>;
  /**
   * Whether the step is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /** Whether the step is marked as completed. Defaults to `true` for steps before the active step. */
  completed?: boolean;
  /**
   * Whether the step is in an error state.
   * @default false
   */
  error?: boolean;
  /**
   * Zero-based position of the step. Normally derived from the step's position in the Stepper
   * (Fragments, conditional steps and wrapper components included); set it only to override that.
   * In server HTML (and the first client render, before the steps register) each Stepper child
   * counts as one step, so steps inside a wrapper component that renders more or fewer than one
   * step are numbered correctly only after hydration; set `index` on them to pin the server HTML.
   */
  index?: number;
  /** Ref to the step's root `<div>` (rendered inside the step's `<li>`). */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the elements the step draws, by part, merged into each part's own: your classes
   * after the part's (yours win a conflict), your styles over its styles, your attributes and
   * handlers added, your ref attached. Every attribute the step sets on a part is locked. A part
   * takes no `children` (the step draws their content); the step's root `<div>` takes its own
   * props, and `icon` fills its own slot. A click on a part inside the button is a click on the
   * step, after yours: `preventDefault()` in yours keeps the active step. While the step cannot be
   * activated (`disabled`, or past the next step of a `linear` stepper) your `onClick` on the
   * button and on the parts inside it is not called, as the step's own is not. Fluent UI has no
   * Stepper.
   */
  slotProps?: {
    /**
     * The `<li>` around the step (stable class `wave-stepper-step__list-item`), by which the
     * stepper numbers its steps: your ref is attached beside the stepper's. Locked: no role (it
     * stays a list item), and no `hidden`, `inert` or `aria-hidden`, since it holds the step.
     */
    listItem?: SlotPart<'li'>;
    /**
     * The step's button, a `<div role="button">` that holds the indicator, the label and the
     * description (stable class `wave-stepper-step__button`). Locked: `role`, `tabIndex` (`-1`
     * while the step cannot be activated), `aria-current` (`step` on the active step, else none),
     * `aria-disabled` (only while the step cannot be activated), its name `aria-labelledby` (the
     * label) and description `aria-describedby` (the description; ids of yours are joined after
     * them), and no `hidden`, `inert` or `aria-hidden`. Its click (the step's own `onClick`, then
     * the step change) and its Enter and Space keys (they click it) are locked too: your handler
     * runs first, and `preventDefault()` in yours skips the step's handling of the event, its own
     * `onClick` included.
     */
    button?: SlotPart<'div'>;
    /**
     * The circle with the step's number, check mark, error mark or `icon` (stable class
     * `wave-stepper-step__indicator`). Locked: its `aria-hidden`, and no role or tab index (it is
     * decorative).
     */
    indicator?: SlotPart<'span'>;
    /**
     * The `<span>` of `label`, with the step's status and number for screen readers (stable class
     * `wave-stepper-step__label`), which names the button. Locked: its `id` (the button's
     * `aria-labelledby`), no `aria-label` (it would replace the text in the name), and no
     * `hidden`, `inert` or `aria-hidden`.
     */
    label?: SlotPart<'span'>;
    /**
     * The `<span>` of `description`, rendered only with one (stable class
     * `wave-stepper-step__description`), which describes the button. Locked as the label: its
     * `id` (the button's `aria-describedby`), no `aria-label`, and no `hidden`, `inert` or
     * `aria-hidden`.
     */
    description?: SlotPart<'span'>;
    /**
     * The line to the next step, rendered on every step but the last (stable class
     * `wave-stepper-step__connector`). Locked: its `aria-hidden`, its marker
     * `data-wave-stepper-connector`, and no role or tab index.
     */
    connector?: SlotPart<'div'>;
  };
}

// ---------------------------------------------------------------------------
// Step registry: a useId-keyed descendant list in DOM order
// ---------------------------------------------------------------------------

const EMPTY_ORDER: readonly string[] = [];
const getServerOrder = () => EMPTY_ORDER;

interface StepRegistry {
  /** Registers a step's list item under its key; returns the cleanup that unregisters it. */
  register: (key: string, element: HTMLElement) => () => void;
  subscribe: (listener: () => void) => () => void;
  /** Keys of the registered steps in DOM order (a new array only when the order changed). */
  getOrder: () => readonly string[];
  /**
   * Re-reads the DOM order and notifies subscribers when it changed. Cheap when nothing moved (one
   * pass over adjacent pairs), so every Step calls it after each of its commits. A commit that
   * re-renders all n steps (an `activeStep` change) therefore costs n passes, O(n²) position
   * checks, and the root's observer adds one pass per list mutation (indicator swaps included):
   * negligible for step counts a stepper can show. If that ever matters, coalesce the per-step calls
   * into one pass per commit (a dirty flag set by the steps, flushed once) — keeping this per-step
   * call or the observer as the path for commits in which the root does not re-render.
   */
  sync: () => void;
}

function createStepRegistry(): StepRegistry {
  const elements = new Map<string, HTMLElement>();
  const listeners = new Set<() => void>();
  let order = EMPTY_ORDER;

  /** Whether `order` still lists exactly the registered elements, in DOM order. */
  const isCurrent = () => {
    if (order.length !== elements.size) return false;
    let previous: HTMLElement | undefined;
    for (const key of order) {
      const element = elements.get(key);
      if (!element) return false;
      if (
        previous &&
        !(previous.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      ) {
        return false;
      }
      previous = element;
    }
    return true;
  };

  const sync = () => {
    if (isCurrent()) return;
    const next = Array.from(elements.entries())
      .sort(([, a], [, b]) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map(([key]) => key);
    if (next.length === order.length && next.every((key, i) => key === order[i])) return;
    order = next;
    listeners.forEach((listener) => listener());
  };

  return {
    register(key, element) {
      elements.set(key, element);
      sync();
      return () => {
        if (elements.get(key) === element) elements.delete(key);
        sync();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getOrder: () => order,
    sync,
  };
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

interface StepperContextValue {
  activeStep: number;
  /** Activates a step: updates the (uncontrolled) state and calls `onStepChange`. */
  select: (step: number) => void;
  orientation: Orientation;
  linear: boolean;
  /** Registered step keys in DOM order (empty on the server and before the first commit). */
  order: readonly string[];
  /** Number of element children after flattening Fragments (the pre-registration step count). */
  childCount: number;
  /** Resolved `statusLabels.completed`. */
  completedLabel: string;
  /** Resolved `statusLabels.error`. */
  errorLabel: string;
  register: StepRegistry['register'];
  sync: StepRegistry['sync'];
}

const StepperContext = React.createContext<StepperContextValue | null>(null);

/**
 * Position of a Stepper child among the element children (Fragments flattened), set by the root
 * around each child. It numbers the steps on the server and in the first render; after mount the
 * registry's DOM order takes over (it also covers wrappers that render several steps or none, which
 * the slot numbering gets wrong — documented on `Stepper` and `StepProps.index`).
 */
const StepSlotContext = React.createContext<number | null>(null);

const noop = () => {};
const INERT_CONTEXT: StepperContextValue = {
  activeStep: 0,
  select: noop,
  orientation: 'horizontal',
  linear: false,
  order: EMPTY_ORDER,
  childCount: 0,
  completedLabel: DEFAULT_COMPLETED_LABEL,
  errorLabel: DEFAULT_ERROR_LABEL,
  register: () => noop,
  sync: noop,
};

/**
 * Reads the Stepper context; a Step outside a Stepper throws in development and logs once in
 * production, where it renders inert (C-CONTEXT).
 */
function useStepperContext(componentName: string): StepperContextValue {
  const context = React.useContext(StepperContext);
  if (context) return context;
  reportMissingContext(componentName, 'Stepper');
  return INERT_CONTEXT;
}

/** A Stepper child after flattening; an element carries its position among the elements. */
interface StepperChild {
  key: string;
  node: React.ReactNode;
  slot: number | null;
}

/**
 * The Stepper's children with Fragments flattened at any depth (`flattenChildren`: keys unique,
 * `null`/booleans dropped) and every element numbered in order.
 */
function numberChildren(children: React.ReactNode): StepperChild[] {
  let slot = 0;
  return flattenChildren(children).map(({ key, node }) => ({
    key,
    node,
    slot: React.isValidElement(node) ? slot++ : null,
  }));
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

const indicatorSlotClasses = 'inline-flex items-center justify-center';

/**
 * Connector colors. A connector is drawn by its background only, which forced colors replace with
 * Canvas, so it opts out there: a completed one is painted `Highlight` (`forcedColors.fill`), the
 * others `CanvasText`, like a Slider rail.
 */
const connectorCompletedClasses = wcn('bg-success', forcedColors.fill);
const connectorPendingClasses =
  'bg-border forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none';

/**
 * The `blockHandlers` of the button and the parts inside it while the step cannot be activated:
 * no click of a part, as no click of the step.
 */
const BLOCK_CLICK = ['onClick'] as const;

/** What the list and a step's list item lock unset: a role, and their hidden state. */
const LIST_PART_LOCKS = {
  role: undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/** What the label and the description lock unset besides their ids: a name, and being hidden. */
const TEXT_PART_LOCKS = {
  'aria-label': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/**
 * What the indicator and the connector lock: hidden from assistive technology, and no role or tab
 * stop.
 */
const DECORATIVE_PART_LOCKS = {
  'aria-hidden': 'true',
  role: undefined,
  tabIndex: undefined,
} as const;

/**
 * One step of a {@link Stepper}: a `role="button"` step (indicator, label, optional description)
 * inside its own `<li>`, followed by a connector unless it is the last step. `ref`, `className` and
 * rest props land on the step's root `<div>`; `onClick` runs on activation by mouse, Enter or Space
 * (not for disabled or unreachable steps). Must be rendered inside a `Stepper` (throws in
 * development otherwise). Flat name `StepperStep`, importable from React Server Components.
 */
const StepperStep = ({
  label,
  description,
  icon,
  disabled = false,
  completed,
  error = false,
  index: indexProp,
  className,
  onClick,
  ref,
  slotProps,
  ...rest
}: StepProps) => {
  const {
    activeStep,
    select,
    orientation,
    linear,
    order,
    childCount,
    completedLabel,
    errorLabel,
    register,
    sync,
  } = useStepperContext('Stepper.Step');
  const slotIndex = React.useContext(StepSlotContext);
  const key = useId('wave-step');
  const labelId = `${key}-label`;
  const descriptionId = `${key}-description`;

  // The list item registers itself under this step's id; the registry sorts by DOM position.
  const registerItem = React.useCallback(
    (element: HTMLLIElement | null) => (element ? register(key, element) : undefined),
    [register, key],
  );
  // A list item part's ref joins it, so an inline one never takes the step out of the registry.
  const itemRef = useMergedRefs(registerItem, slotProps?.listItem?.ref);
  // A keyed reorder moves list items without re-running their ref callbacks, and a wrapper component
  // can reorder its own steps without re-rendering the root: re-read the DOM order after every commit
  // of this step (a changed order re-renders before paint). Moves that re-render no step at all
  // (reused elements) are caught by the root's MutationObserver.
  React.useLayoutEffect(() => {
    sync();
  });

  const position = order.indexOf(key);
  const index = indexProp ?? (position !== -1 ? position : (slotIndex ?? 0));
  const stepCount = position !== -1 ? order.length : childCount;
  const isLast = index >= stepCount - 1;
  const isActive = index === activeStep;
  const isCompleted = completed ?? index < activeStep;
  const isClickable = !disabled && (!linear || index <= activeStep + 1);
  const horizontal = orientation === 'horizontal';

  /**
   * The single activation path for mouse and keyboard (Enter/Space dispatch a click): an
   * unavailable step does nothing — neither the consumer `onClick` nor `onStepChange` runs; a
   * consumer `onClick` that calls `preventDefault()` suppresses the step change (C-COMPOSE).
   */
  const activate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isClickable) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (event.defaultPrevented) return;
    select(index);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.click();
    } else if (event.key === ' ') {
      // Space activates on keyup, like a native button; stop the page from scrolling.
      event.preventDefault();
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.key !== ' ') return;
    event.preventDefault();
    event.currentTarget.click();
  };

  const status = error ? errorLabel : isCompleted ? completedLabel : '';
  const statusText = status ? `${status} ${index + 1}.` : `${index + 1}.`;

  // A falsy icon (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in Menu,
  // Nav, Tree and Avatar, and so is a collection whose items render nothing: the step keeps its
  // number or check mark. The check does not consume a generator: renderSlot still renders it.
  const hasIcon = !!icon && slotRendersContent(icon);
  let indicator: React.ReactNode;
  if (error) {
    indicator = <DismissIcon />;
  } else if (isCompleted && !hasIcon) {
    indicator = <CheckIcon />;
  } else if (hasIcon) {
    indicator = renderSlot(icon, 'span', wcn(stepperStepClassNames.icon, indicatorSlotClasses), {
      'aria-hidden': true,
    });
  } else {
    indicator = <span className="text-caption-1 font-semibold">{index + 1}</span>;
  }

  const toneClass = error
    ? 'text-error'
    : isActive
      ? 'text-primary'
      : isCompleted
        ? 'text-success'
        : 'text-foreground';

  // The parts, merged only when given. While the step cannot be activated, the button and the
  // parts inside it get no click of a part, as the step's own `onClick` is not called.
  const blockHandlers = isClickable ? undefined : BLOCK_CLICK;
  // The button's own attributes and handlers, also its part's locked ones.
  const buttonProps = {
    role: 'button',
    tabIndex: isClickable ? 0 : -1,
    'aria-current': isActive ? 'step' : undefined,
    'aria-disabled': isClickable ? undefined : true,
    'aria-labelledby': labelId,
    'aria-describedby': description ? descriptionId : undefined,
    onClick: activate,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
  } as const;
  const listItemClassName = wcn(
    stepperStepClassNames.listItem,
    'flex min-w-0',
    horizontal && !isLast && 'flex-1',
  );
  const buttonClassName = wcn(
    stepperStepClassNames.button,
    'relative flex rounded',
    horizontal ? 'flex-col items-center gap-1' : 'items-center gap-3',
    focusRing,
    isClickable ? 'cursor-pointer' : 'cursor-default',
    disabled && 'opacity-50',
  );
  const indicatorClassName = wcn(
    stepperStepClassNames.indicator,
    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none',
    error
      ? 'border-error bg-error-tint text-error-tint-foreground'
      : isActive
        ? wcn('border-primary bg-primary text-primary-foreground', forcedColors.selectedLeaf)
        : isCompleted
          ? 'border-success bg-success-tint text-success-tint-foreground'
          : 'border-border bg-background text-muted-foreground',
  );
  const labelClassName = wcn(
    stepperStepClassNames.label,
    'font-semibold',
    horizontal ? 'text-caption-1 whitespace-nowrap' : 'text-body-1',
    toneClass,
  );
  const descriptionClassName = description
    ? wcn(
        stepperStepClassNames.description,
        'text-muted-foreground',
        horizontal ? 'text-caption-2 whitespace-nowrap' : 'text-caption-1',
      )
    : undefined;
  const connectorClassName = isLast
    ? undefined
    : wcn(
        stepperStepClassNames.connector,
        'transition-colors motion-reduce:transition-none',
        // Vertical: centred under the size-8 circle, (8 - 0.5) / 2 spacing units in, so the
        // offset scales with the circle at any root font size.
        horizontal ? 'mx-2 h-0.5 flex-1' : 'my-1 ms-3.75 min-h-6 w-0.5',
        isCompleted ? connectorCompletedClasses : connectorPendingClasses,
      );

  return (
    <li
      className={listItemClassName}
      {...(slotProps?.listItem &&
        mergeSlotProps(slotProps.listItem, {
          className: listItemClassName,
          locked: LIST_PART_LOCKS,
        }))}
      ref={itemRef}
    >
      <div
        ref={ref}
        data-active={isActive ? '' : undefined}
        data-completed={isCompleted ? '' : undefined}
        data-error={error ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        {...rest}
        className={wcn(
          stepperStepClassNames.root,
          horizontal ? 'flex flex-1 items-center' : 'flex flex-1 flex-col',
          className,
        )}
      >
        <div
          {...buttonProps}
          className={buttonClassName}
          {...(slotProps?.button &&
            mergeSlotProps(slotProps.button, {
              className: buttonClassName,
              locked: { ...HIDDEN_PART_LOCKS, ...buttonProps },
              blockHandlers,
            }))}
        >
          <span
            aria-hidden="true"
            className={indicatorClassName}
            {...(slotProps?.indicator &&
              mergeSlotProps(slotProps.indicator, {
                className: indicatorClassName,
                locked: DECORATIVE_PART_LOCKS,
                blockHandlers,
              }))}
          >
            {indicator}
          </span>
          <span className={wcn('flex flex-col', horizontal && 'items-center text-center')}>
            <span
              id={labelId}
              className={labelClassName}
              {...(slotProps?.label &&
                mergeSlotProps(slotProps.label, {
                  className: labelClassName,
                  locked: { ...TEXT_PART_LOCKS, id: labelId },
                  blockHandlers,
                }))}
            >
              <span className="sr-only">{statusText}</span> {label}
            </span>
            {description && (
              <span
                id={descriptionId}
                className={descriptionClassName}
                {...(slotProps?.description &&
                  mergeSlotProps(slotProps.description, {
                    className: descriptionClassName,
                    locked: { ...TEXT_PART_LOCKS, id: descriptionId },
                    blockHandlers,
                  }))}
              >
                {description}
              </span>
            )}
          </span>
        </div>
        {!isLast && (
          <div
            data-wave-stepper-connector=""
            aria-hidden="true"
            className={connectorClassName}
            {...(slotProps?.connector &&
              mergeSlotProps(slotProps.connector, {
                className: connectorClassName,
                locked: { ...DECORATIVE_PART_LOCKS, 'data-wave-stepper-connector': '' },
              }))}
          />
        )}
      </div>
    </li>
  );
};
StepperStep.displayName = 'Step';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const StepperRoot = ({
  activeStep: controlledStep,
  defaultActiveStep = 0,
  onStepChange,
  orientation = 'horizontal',
  linear = false,
  statusLabels,
  className,
  children,
  ref,
  slotProps,
  ...rest
}: StepperProps) => {
  // Resolved to strings, so an inline `statusLabels` object does not change the context each render.
  const completedLabel = statusLabels?.completed ?? DEFAULT_COMPLETED_LABEL;
  const errorLabel = statusLabels?.error ?? DEFAULT_ERROR_LABEL;
  const [activeStep, setActiveStep] = useControllable(controlledStep, defaultActiveStep);
  const emitStepChange = useEventCallback(onStepChange);
  // Event callback semantics (C-NAMING): every activation emits, also of the active step.
  const select = React.useCallback(
    (step: number) => {
      setActiveStep(step);
      emitStepChange(step);
    },
    [setActiveStep, emitStepChange],
  );

  const [registry] = React.useState(createStepRegistry);
  const order = React.useSyncExternalStore(registry.subscribe, registry.getOrder, getServerOrder);
  // Steps re-sync after each of their commits. A move that re-renders no step (a wrapper reordering
  // reused step elements) only shows up in the DOM: observe the list for it (C-HOOKS DOM-derived
  // collection; the callback runs in a microtask, before paint).
  const listRef = React.useRef<HTMLOListElement>(null);
  const listPart = slotProps?.list;
  // The list part's ref joins the stepper's, so an inline one never detaches it.
  const mergedListRef = useMergedRefs(listRef, listPart?.ref);
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new MutationObserver(registry.sync);
    observer.observe(list, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [registry]);

  const items = React.useMemo(() => numberChildren(children), [children]);
  const childCount = items.filter((item) => item.slot !== null).length;

  const context = React.useMemo<StepperContextValue>(
    () => ({
      activeStep,
      select,
      orientation,
      linear,
      order,
      childCount,
      completedLabel,
      errorLabel,
      register: registry.register,
      sync: registry.sync,
    }),
    [
      activeStep,
      select,
      orientation,
      linear,
      order,
      childCount,
      completedLabel,
      errorLabel,
      registry,
    ],
  );

  const horizontal = orientation === 'horizontal';
  const listClassName = wcn(
    stepperClassNames.list,
    'm-0 flex list-none p-0',
    horizontal ? 'flex-1 flex-row items-start' : 'flex-col',
  );

  return (
    <StepperContext.Provider value={context}>
      <div
        ref={ref}
        role="group"
        aria-label="Progress"
        data-orientation={orientation}
        {...rest}
        className={wcn(
          stepperClassNames.root,
          'flex',
          horizontal ? 'flex-row items-start' : 'flex-col',
          className,
        )}
      >
        {/* role="list" is not redundant: WebKit/VoiceOver drops list semantics from a
            `list-style: none` list outside a <nav> unless the role is explicit. */}
        <ol
          role="list"
          className={listClassName}
          {...(listPart &&
            mergeSlotProps(listPart, {
              className: listClassName,
              locked: { ...LIST_PART_LOCKS, role: 'list' },
            }))}
          ref={mergedListRef}
        >
          {items.map((item) =>
            item.slot === null ? (
              item.node
            ) : (
              <StepSlotContext.Provider key={item.key} value={item.slot}>
                {item.node}
              </StepSlotContext.Provider>
            ),
          )}
        </ol>
      </div>
    </StepperContext.Provider>
  );
};
StepperRoot.displayName = 'Stepper';

/**
 * A multi-step progress indicator. Steps are `Stepper.Step` children (Fragments, conditional steps
 * and wrapper components are numbered in DOM order) rendered as an ordered list inside a
 * `role="group"` root named "Progress" (override with `aria-label`). The active step's button
 * carries `aria-current="step"`; completed and error steps announce their status ("Completed:",
 * "Error:"; localized with `statusLabels`).
 *
 * Server rendering: before hydration, steps are numbered by their position among the Stepper's
 * children (Fragments flattened), so a wrapper component that renders more or fewer than one step
 * is numbered correctly only after hydration. Pin such steps with `index` if the server HTML must
 * already be exact.
 *
 * Compound access (`Stepper.Step`) needs a client module; React Server Components import the flat
 * name `StepperStep` instead.
 */
export const Stepper = /* @__PURE__ */ Object.assign(StepperRoot, { Step: StepperStep });

// Flat name of `Stepper.Step` (C-COMPOUND).
export { StepperStep };
