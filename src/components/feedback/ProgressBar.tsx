import * as React from 'react';
import { cn } from '../../lib/cn';
import { isDev, warnOnce } from '../../lib/dev';
import { forcedColors } from '../../lib/styles';
import { useId } from '../../hooks/useId';

/** Properties for the ProgressBar component. */
export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Current progress value, clamped to `0…max` for both the fill and `aria-valuenow`. Omit for
   * indeterminate mode. A non-finite value renders 0% (development warning).
   */
  value?: number;
  /**
   * Maximum progress value. A `max` of 0 or less, or a non-finite `max`, renders 0% (development
   * warning) and is reported to assistive technology as 0 of 100.
   * @default 100
   */
  max?: number;
  /**
   * Accessible name of the progress bar: `aria-label` by default, or a visible label with
   * `showLabel`. A progress bar needs a name (`label`, `aria-label` or `aria-labelledby`); a
   * development warning fires without one. A consumer `aria-label` or `aria-labelledby` takes
   * precedence over `label`; an empty or whitespace-only one counts as absent (it is not rendered).
   */
  label?: string;
  /**
   * Renders `label` as visible text above the bar and names the bar with it (`aria-labelledby`)
   * instead of `aria-label`, unless a consumer `aria-label` or `aria-labelledby` names the bar
   * (keep the visible text in that name, WCAG 2.5.3). The label and the bar are then wrapped in a
   * `div`; `ref`, `className`, `style` and the other props stay on the progress bar element.
   */
  showLabel?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** Whether a name prop (`label`, `aria-label`, `aria-labelledby`) holds more than whitespace. */
function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Shows the progress of a task, or that a task is running (indeterminate, `value` omitted).
 *
 * - Name it with `label` (or `aria-label` / `aria-labelledby`); `showLabel` shows the label above
 *   the bar.
 * - `value` is clamped to `0…max`; invalid numbers render an empty bar and warn in development.
 * - The indeterminate animation follows the writing direction and becomes a full-width pulse for
 *   reduced motion. In forced-colors mode the fill uses `Highlight` and the track gets a border.
 *
 * @example
 * <ProgressBar value={uploaded} max={total} label="Uploading photos" showLabel />
 */
export const ProgressBar = ({
  value,
  max = 100,
  label,
  showLabel,
  className,
  ref,
  ...rest
}: ProgressBarProps) => {
  const labelId = useId('progress-label');
  const isIndeterminate = value === undefined;
  const validMax = Number.isFinite(max) && max > 0;
  const validValue = isIndeterminate || Number.isFinite(value);
  /** Clamped once, used for both the fill width and `aria-valuenow`. */
  const clamped =
    !isIndeterminate && validMax && validValue ? Math.min(max, Math.max(0, value)) : 0;
  const percentage = validMax ? (clamped / max) * 100 : 0;

  // An empty or whitespace-only `label`, `aria-label` or `aria-labelledby` names nothing: it is
  // treated like `undefined` by the precedence, the rendered attributes and the warning alike.
  const hasLabel = isName(label);
  const hasAriaLabel = isName(rest['aria-label']);
  const hasAriaLabelledBy = isName(rest['aria-labelledby']);

  // Development diagnostics (C-DEV): emitted from an effect, once per page.
  React.useEffect(() => {
    if (!isDev) return;
    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
      warnOnce(
        'ProgressBar:name',
        'ProgressBar: a progress bar needs an accessible name. Pass `label` (add `showLabel` to show it), `aria-label` or `aria-labelledby`.',
      );
    }
    if (showLabel && !hasLabel) {
      warnOnce(
        'ProgressBar:show-label',
        'ProgressBar: `showLabel` renders the `label` prop, which is empty.',
      );
    }
    if (!validMax) {
      warnOnce(
        'ProgressBar:max',
        `ProgressBar: \`max\` must be a finite number greater than 0 (got ${String(max)}); the bar renders 0%.`,
      );
    }
    if (!validValue) {
      warnOnce(
        'ProgressBar:value',
        `ProgressBar: \`value\` must be a finite number (got ${String(value)}); the bar renders 0%.`,
      );
    }
  }, [hasLabel, hasAriaLabel, hasAriaLabelledBy, showLabel, validMax, validValue, max, value]);

  const visibleLabel = Boolean(showLabel && hasLabel);

  /**
   * The bar's attributes. Defaults the consumer may override (C-COMPOSE) apply wherever the
   * consumer's value is `undefined` — also when the key is present, e.g. a wrapper that forwards
   * `aria-label={props['aria-label']}` — so a forwarded `undefined` never strips the role, the
   * values or the name derived from `label`. An empty `aria-label`/`aria-labelledby` is dropped
   * the same way instead of rendering a nameless attribute.
   */
  const barProps: Record<string, unknown> = {
    role: 'progressbar',
    'aria-valuenow': isIndeterminate ? undefined : clamped,
    'aria-valuemin': 0,
    'aria-valuemax': validMax ? max : 100,
  };
  // A consumer `aria-label` or `aria-labelledby` wins over the name derived from `label`, also
  // with `showLabel` (the visible label then stays unreferenced text).
  if (!hasAriaLabel && !hasAriaLabelledBy) {
    if (visibleLabel) barProps['aria-labelledby'] = labelId;
    else if (hasLabel) barProps['aria-label'] = label;
  }
  for (const [key, propValue] of Object.entries(rest)) {
    if (propValue === undefined) continue;
    if ((key === 'aria-label' || key === 'aria-labelledby') && !isName(propValue)) continue;
    barProps[key] = propValue;
  }

  const bar = (
    <div
      {...barProps}
      ref={ref}
      className={cn(
        'h-2 overflow-hidden rounded-full bg-track',
        'forced-colors:border',
        forcedColors.border,
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary',
          forcedColors.selectedLeaf,
          isIndeterminate &&
            'w-2/5 animate-wave-indeterminate wave-rtl:animate-wave-indeterminate-rtl motion-reduce:w-full motion-reduce:translate-x-0 motion-reduce:animate-wave-pulse wave-rtl:motion-reduce:animate-wave-pulse',
        )}
        style={isIndeterminate ? undefined : { width: `${percentage}%` }}
      />
    </div>
  );

  if (!visibleLabel) return bar;

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-body-1 text-foreground">
        {label}
      </span>
      {bar}
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';
