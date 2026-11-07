import * as React from 'react';
import { spinnerClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { isDev, warnOnce } from '../../lib/dev';
import { HIDDEN_PART_LOCKS, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { forcedColors } from '../../lib/styles';
import type { LabelPosition } from '../../lib/types';
import { SpinnerContext } from './Spinner.context';
import type { SpinnerContextValue, SpinnerSize } from './Spinner.context';

export type { SpinnerContextValue, SpinnerSize } from './Spinner.context';

/** Color treatment of a {@link Spinner}. */
export type SpinnerAppearance = 'primary' | 'inverted';

/** Properties for the Spinner component. */
export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Size of the spinner: `extra-tiny` (16px), `tiny` (20px), `extra-small` (12px), `small` (16px),
   * `medium` (24px), `large` (36px), `huge` (44px) or `extra-large` (48px). The five sizes of 0.x
   * keep their pixel sizes, so `medium` is 24px where Fluent's is 32px; `extra-tiny`, `tiny` and
   * `huge` are Fluent's names with Fluent's pixel sizes. Without one, a surrounding
   * `SpinnerContextProvider` gives the size (Fluent's `SpinnerContext`).
   * @default 'medium', or the size of the surrounding `SpinnerContextProvider`
   */
  size?: SpinnerSize;
  /**
   * What the spinner's status region announces (and what shows with `labelVisible`): a string, or
   * any content (Fluent's `label` slot, which takes a ReactNode). Localize it. With
   * `role="progressbar"` only a string names the spinner (`aria-label`): pass an `aria-label` or
   * `aria-labelledby` of your own with other content.
   * @default 'Loading'
   */
  label?: React.ReactNode;
  /** Whether the label text is visually displayed alongside the spinner. */
  labelVisible?: boolean;
  /**
   * Where the visible label sits relative to the ring: `after` (the ring first, in the reading
   * direction), `before`, `below` or `above`. The DOM order is the same in each; only the layout
   * changes, so the status region announces the label alike. The root carries it as
   * `data-label-position`. Fluent's `labelPosition`.
   * @default 'after'
   */
  labelPosition?: LabelPosition;
  /**
   * `primary`: a primary arc on the track color. `inverted`: drawn in the current text color (a
   * 30% track), for brand or inverted surfaces such as a primary Button.
   * @default 'primary'
   */
  appearance?: SpinnerAppearance;
  /**
   * Milliseconds to wait before the ring and the label appear, so a fast load does not flash the
   * spinner. The status region is mounted (empty) at once and announces the label once shown.
   * A non-finite or negative value means 0.
   * @default 0
   */
  delay?: number;
  /**
   * Role of the root; a forwarded `undefined` keeps the default live region. Use `none` inside a
   * region that already announces the busy state, or `progressbar`, which `label` names
   * (`aria-label`) unless you pass `aria-label` or `aria-labelledby` (a progress bar is not named by
   * its content).
   * @default 'status'
   */
  role?: React.AriaRole;
  ref?: React.Ref<HTMLSpanElement>;
  /**
   * Props for the elements the spinner draws inside its root, by part, merged into each part's
   * own (Fluent UI's `spinner` and `label` slot props): your classes after the part's (yours win
   * a conflict), your styles over its styles, your attributes and handlers added, your ids added
   * to its `aria-labelledby` and `aria-describedby`, and your ref beside its ref. Every attribute
   * the spinner sets on a part is locked and keeps its value; you add the attributes it does not
   * set. A part takes no `children`. The root, the status region (or the role you give it), takes
   * the component's own props. Neither part carries a handler of the spinner.
   */
  slotProps?: {
    /**
     * The ring `<span>`, rendered once the spinner is shown (stable class `wave-spinner__spinner`):
     * decorative, so locked: `aria-hidden` and its marker `data-wave-spinner-ring`, and, unset,
     * `role`, `tabIndex` and `hidden`.
     */
    spinner?: SlotPart<'span'>;
    /**
     * The label `<span>` (stable class `wave-spinner__label`), whose text the status region
     * announces, shown with `labelVisible` and visually hidden otherwise. Locked: its marker
     * `data-wave-spinner-label` and, unset, `role` and `aria-live` (the label never becomes a live
     * region of its own, nor silences the root's), `aria-label` (the text stays what is
     * announced), `hidden`, `inert` and `aria-hidden`.
     */
    label?: SlotPart<'span'>;
  };
}

/** What the ring part locks: it stays decorative, and never a widget of its own. */
const RING_LOCKS = {
  'aria-hidden': 'true',
  'data-wave-spinner-ring': '',
  role: undefined,
  tabIndex: undefined,
  hidden: undefined,
} as const;

/** What the label part locks: its text stays what the status region announces. */
const LABEL_LOCKS = {
  'data-wave-spinner-label': '',
  role: undefined,
  'aria-live': undefined,
  'aria-label': undefined,
  ...HIDDEN_PART_LOCKS,
} as const;

/** Whether a name prop (`aria-label`, `aria-labelledby`) holds more than whitespace. */
function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

const sizeClasses: Record<SpinnerSize, string> = {
  'extra-tiny': 'wave:w-4 wave:h-4',
  tiny: 'wave:w-5 wave:h-5',
  'extra-small': 'wave:w-3 wave:h-3',
  small: 'wave:w-4 wave:h-4',
  medium: 'wave:w-6 wave:h-6',
  large: 'wave:w-9 wave:h-9',
  huge: 'wave:w-11 wave:h-11',
  'extra-large': 'wave:w-12 wave:h-12',
};

/**
 * The root's flex direction per label position. The label is the last child, so `after` is the
 * row, `before` its reverse (which also follows the writing direction), `below` the column and
 * `above` its reverse.
 */
const labelPositionClasses: Record<LabelPosition, string> = {
  after: 'wave:flex-row',
  before: 'wave:flex-row-reverse',
  below: 'wave:flex-col',
  above: 'wave:flex-col-reverse',
};

/** Ring (track, then arc) and visible-label colors of each appearance. */
const appearanceClasses: Record<SpinnerAppearance, { ring: string; label: string }> = {
  primary: { ring: 'wave:border-track wave:border-t-primary', label: 'wave:text-muted-foreground' },
  // The current text color matches any surface the spinner sits on (on-brand text in a primary
  // Button, the inverted foreground), so no token is needed.
  inverted: { ring: 'wave:border-current/30 wave:border-t-current', label: 'wave:text-current' },
};

/**
 * An indeterminate loading indicator.
 *
 * - The root is a `role="status"` live region (override `role`, e.g. `role="none"` inside a region
 *   that already announces the busy state, or `role="progressbar"`, which `label` names unless you
 *   pass `aria-label` or `aria-labelledby`).
 * - The region mounts **empty** and receives its `label` (default "Loading") one animation frame
 *   after the spinner is shown, so screen readers announce it (a live region that mounts with its
 *   content is often not announced). With `labelVisible` the label also shows next to the ring
 *   from that frame on.
 * - `delay` holds back the ring and the label for that many milliseconds (the region mounts at
 *   once), so a fast load does not flash the spinner. The root's `data-state` is `delayed`, then
 *   `shown`.
 * - `labelPosition` places the visible label `before`, `after`, `above` or `below` the ring, and
 *   the root carries it as `data-label-position`. `label` takes any content, not only text.
 * - `size` falls back to the size of a surrounding `SpinnerContextProvider` (a parent that sizes
 *   the spinners it holds), then `medium`.
 * - `appearance="inverted"` draws the spinner in the current text color, for a primary Button or
 *   another brand or inverted surface. The root carries `data-appearance`.
 * - The ring is decorative (`aria-hidden`) and spins slower for reduced motion. In forced-colors
 *   mode its arc is drawn in `Highlight` on a `Canvas` track, so the rotation stays perceivable.
 *
 * @example
 * <Spinner label="Loading results" delay={300} />
 *
 * @example
 * // In a primary Button's (decorative) icon slot; the Button's text names the busy state.
 * <Button appearance="primary" icon={<Spinner appearance="inverted" size="extra-small" />}>
 *   Saving
 * </Button>
 */
export const Spinner = ({
  size: sizeProp,
  label = 'Loading',
  labelVisible,
  labelPosition = 'after',
  appearance = 'primary',
  delay = 0,
  slotProps,
  className,
  // Destructured with a default rather than set before `{...rest}`: a wrapper that forwards
  // `role={props.role}` passes `undefined`, which must not strip the live region.
  role = 'status',
  ref,
  ...rest
}: SpinnerProps) => {
  const contextSize = React.useContext(SpinnerContext)?.size;
  const requestedSize = sizeProp ?? contextSize ?? 'medium';
  // A size or position outside the unions (from untyped code) renders as the default instead of
  // throwing.
  const size: SpinnerSize = Object.hasOwn(sizeClasses, requestedSize) ? requestedSize : 'medium';
  const resolvedPosition: LabelPosition = Object.hasOwn(labelPositionClasses, labelPosition ?? '')
    ? labelPosition
    : 'after';
  const wait = Number.isFinite(delay) && delay > 0 ? delay : 0;
  const [shown, setShown] = React.useState(wait === 0);
  const [announced, setAnnounced] = React.useState(false);

  // C-HOOKS deferred updates: each state is set in its callback, never in the effect body. Once
  // shown, the spinner stays shown; a delay that changes while it waits starts the wait again.
  React.useEffect(() => {
    if (shown) return;
    const handle = setTimeout(() => setShown(true), wait);
    return () => clearTimeout(handle);
  }, [shown, wait]);

  React.useEffect(() => {
    if (!shown) return;
    const frame = requestAnimationFrame(() => setAnnounced(true));
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  // A progressbar takes its name from the author, never from its content (the label text): name it
  // with `label` unless the consumer does. Also applies to a forwarded `aria-label={undefined}`.
  const needsName =
    role === 'progressbar' && !isName(rest['aria-label']) && !isName(rest['aria-labelledby']);
  const nameFromLabel = needsName && typeof label === 'string';
  const unnamedProgressbar = needsName && typeof label !== 'string';
  React.useEffect(() => {
    if (!isDev || !unnamedProgressbar) return;
    warnOnce(
      'Spinner:progressbar-name',
      'Spinner: `role="progressbar"` needs an accessible name, and only a string `label` names it. Pass `aria-label` or `aria-labelledby`.',
    );
  }, [unnamedProgressbar]);
  // An appearance outside the union (from untyped code) renders as primary instead of throwing.
  const resolvedAppearance: SpinnerAppearance = Object.hasOwn(appearanceClasses, appearance ?? '')
    ? appearance
    : 'primary';
  const colors = appearanceClasses[resolvedAppearance];
  // The parts merge only when given.
  const ringPart = slotProps?.spinner;
  const ringClassName = shown
    ? wcn(
        spinnerClassNames.spinner,
        'wave:rounded-full wave:border-2 wave:animate-wave-spin wave:motion-reduce:animate-wave-spin-slow',
        colors.ring,
        forcedColors.ringArc,
        sizeClasses[size],
      )
    : undefined;
  const labelPart = slotProps?.label;
  const labelClassName = wcn(
    spinnerClassNames.label,
    labelVisible ? wcn('wave:text-body-1', colors.label) : 'wave:sr-only',
  );

  return (
    <span
      data-appearance={resolvedAppearance}
      data-label-position={resolvedPosition}
      data-state={shown ? 'shown' : 'delayed'}
      {...rest}
      role={role}
      aria-label={nameFromLabel ? label : rest['aria-label']}
      ref={ref}
      className={wcn(
        spinnerClassNames.root,
        'wave:inline-flex wave:items-center wave:gap-2',
        labelPositionClasses[resolvedPosition],
        className,
      )}
    >
      {shown ? (
        <span
          aria-hidden="true"
          data-wave-spinner-ring=""
          className={ringClassName}
          {...(ringPart &&
            mergeSlotProps(ringPart, { className: ringClassName, locked: RING_LOCKS }))}
        />
      ) : null}
      <span
        data-wave-spinner-label=""
        className={labelClassName}
        {...(labelPart &&
          mergeSlotProps(labelPart, { className: labelClassName, locked: LABEL_LOCKS }))}
      >
        {announced ? label : null}
      </span>
    </span>
  );
};

Spinner.displayName = 'Spinner';

/** Properties for the SpinnerContextProvider component. */
export interface SpinnerContextProviderProps extends SpinnerContextValue {
  children?: React.ReactNode;
}

/**
 * Gives every Spinner below it a `size`, so a component that sizes its icons or its status area
 * (a Button, a card, your own loading state) sizes the spinners it holds without passing `size`
 * to each. A Spinner's own `size` wins. Renders no element. Fluent's `SpinnerContextProvider`.
 *
 * @example
 * <SpinnerContextProvider size="tiny">
 *   <Spinner label="Saving" labelVisible />
 * </SpinnerContextProvider>
 */
export const SpinnerContextProvider = ({ size, children }: SpinnerContextProviderProps) => {
  const value = React.useMemo<SpinnerContextValue>(() => ({ size }), [size]);
  return <SpinnerContext.Provider value={value}>{children}</SpinnerContext.Provider>;
};
SpinnerContextProvider.displayName = 'SpinnerContextProvider';
