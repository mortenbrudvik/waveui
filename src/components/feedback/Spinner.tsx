import * as React from 'react';
import { cn } from '../../lib/cn';
import { forcedColors } from '../../lib/styles';
import type { Size } from '../../lib/types';

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

/**
 * An indeterminate loading indicator.
 *
 * - The root is a `role="status"` live region (override `role`, e.g. `role="none"` inside a region
 *   that already announces the busy state, or `role="progressbar"`, which `label` names unless you
 *   pass `aria-label` or `aria-labelledby`).
 * - The region mounts **empty** and receives its `label` (default "Loading") one animation frame
 *   later, so screen readers announce it (a live region that mounts with its content is often not
 *   announced). With `labelVisible` the label also shows next to the ring from that frame on.
 * - The ring is decorative (`aria-hidden`) and spins slower for reduced motion. In forced-colors
 *   mode its arc is drawn in `Highlight` on a `Canvas` track, so the rotation stays perceivable.
 *
 * @example
 * <Spinner label="Loading results" />
 */
export const Spinner = ({
  size = 'medium',
  label = 'Loading',
  labelVisible,
  className,
  // Destructured with a default rather than set before `{...rest}`: a wrapper that forwards
  // `role={props.role}` passes `undefined`, which must not strip the live region.
  role = 'status',
  ref,
  ...rest
}: SpinnerProps) => {
  const [announced, setAnnounced] = React.useState(false);

  // C-HOOKS deferred update: the state is set in the frame callback, never in the effect body.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setAnnounced(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // A progressbar takes its name from the author, never from its content (the label text): name it
  // with `label` unless the consumer does. Also applies to a forwarded `aria-label={undefined}`.
  const nameFromLabel =
    role === 'progressbar' && !isName(rest['aria-label']) && !isName(rest['aria-labelledby']);

  return (
    <span
      {...rest}
      role={role}
      aria-label={nameFromLabel ? label : rest['aria-label']}
      ref={ref}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <span
        aria-hidden="true"
        data-wave-spinner-ring=""
        className={cn(
          'rounded-full border-2 border-track border-t-primary animate-wave-spin motion-reduce:animate-wave-spin-slow',
          forcedColors.ringArc,
          sizeClasses[size],
        )}
      />
      <span
        data-wave-spinner-label=""
        className={labelVisible ? 'text-body-1 text-muted-foreground' : 'sr-only'}
      >
        {announced ? label : null}
      </span>
    </span>
  );
};

Spinner.displayName = 'Spinner';
