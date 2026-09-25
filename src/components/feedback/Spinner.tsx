import * as React from 'react';
import { cn } from '../../lib/cn';
import { forcedColors } from '../../lib/styles';
import type { Size } from '../../lib/types';

/** Color treatment of a {@link Spinner}. */
export type SpinnerAppearance = 'primary' | 'inverted';

/** Properties for the Spinner component. */
export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Size of the spinner.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Text announced by the spinner's status region (and shown with `labelVisible`). Localize it.
   * @default 'Loading'
   */
  label?: string;
  /** Whether the label text is visually displayed alongside the spinner. */
  labelVisible?: boolean;
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
}

/** Whether a name prop (`aria-label`, `aria-labelledby`) holds more than whitespace. */
function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

const sizeClasses: Record<Size, string> = {
  'extra-small': 'w-3 h-3',
  small: 'w-4 h-4',
  medium: 'w-6 h-6',
  large: 'w-9 h-9',
  'extra-large': 'w-12 h-12',
};

/** Ring (track, then arc) and visible-label colors of each appearance. */
const appearanceClasses: Record<SpinnerAppearance, { ring: string; label: string }> = {
  primary: { ring: 'border-track border-t-primary', label: 'text-muted-foreground' },
  // The current text color matches any surface the spinner sits on (on-brand text in a primary
  // Button, the inverted foreground), so no token is needed.
  inverted: { ring: 'border-current/30 border-t-current', label: 'text-current' },
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
  size = 'medium',
  label = 'Loading',
  labelVisible,
  appearance = 'primary',
  delay = 0,
  className,
  // Destructured with a default rather than set before `{...rest}`: a wrapper that forwards
  // `role={props.role}` passes `undefined`, which must not strip the live region.
  role = 'status',
  ref,
  ...rest
}: SpinnerProps) => {
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
  const nameFromLabel =
    role === 'progressbar' && !isName(rest['aria-label']) && !isName(rest['aria-labelledby']);
  // An appearance outside the union (from untyped code) renders as primary instead of throwing.
  const resolvedAppearance: SpinnerAppearance = Object.hasOwn(appearanceClasses, appearance ?? '')
    ? appearance
    : 'primary';
  const colors = appearanceClasses[resolvedAppearance];

  return (
    <span
      data-appearance={resolvedAppearance}
      data-state={shown ? 'shown' : 'delayed'}
      {...rest}
      role={role}
      aria-label={nameFromLabel ? label : rest['aria-label']}
      ref={ref}
      className={cn('inline-flex items-center gap-2', className)}
    >
      {shown ? (
        <span
          aria-hidden="true"
          data-wave-spinner-ring=""
          className={cn(
            'rounded-full border-2 animate-wave-spin motion-reduce:animate-wave-spin-slow',
            colors.ring,
            forcedColors.ringArc,
            sizeClasses[size],
          )}
        />
      ) : null}
      <span
        data-wave-spinner-label=""
        className={labelVisible ? cn('text-body-1', colors.label) : 'sr-only'}
      >
        {announced ? label : null}
      </span>
    </span>
  );
};

Spinner.displayName = 'Spinner';
