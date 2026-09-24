import * as React from 'react';
import { cn } from '../../lib/cn';
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
  ref?: React.Ref<HTMLSpanElement>;
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
 *   that already announces the busy state, or `role="progressbar"` with an `aria-label`).
 * - The region mounts **empty** and receives its `label` (default "Loading") one animation frame
 *   later, so screen readers announce it (a live region that mounts with its content is often not
 *   announced). With `labelVisible` the label also shows next to the ring from that frame on.
 * - The ring is decorative (`aria-hidden`) and spins slower for reduced motion.
 *
 * @example
 * <Spinner label="Loading results" />
 */
export const Spinner = ({
  size = 'medium',
  label = 'Loading',
  labelVisible,
  className,
  ref,
  ...rest
}: SpinnerProps) => {
  const [announced, setAnnounced] = React.useState(false);

  // C-HOOKS deferred update: the state is set in the frame callback, never in the effect body.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setAnnounced(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span
      role="status"
      {...rest}
      ref={ref}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <span
        aria-hidden="true"
        data-wave-spinner-ring=""
        className={cn(
          'rounded-full border-2 border-track border-t-primary animate-wave-spin motion-reduce:animate-wave-spin-slow',
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
