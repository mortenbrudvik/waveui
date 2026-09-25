import * as React from 'react';
import { cn } from '../../lib/cn';
import { isDev, warnOnce } from '../../lib/dev';
import { forcedColors } from '../../lib/styles';
import type { ValidationState } from '../../lib/types';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useId } from '../../hooks/useId';

/** Color of a {@link ProgressBar}'s fill. */
export type ProgressBarColor = 'brand' | 'success' | 'warning' | 'error';

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
   * Inside a `Field`, the Field's label names the bar when neither `label` nor a consumer name is
   * given.
   */
  label?: string;
  /**
   * Renders `label` as visible text above the bar and names the bar with it (`aria-labelledby`)
   * instead of `aria-label`, unless a consumer `aria-label` or `aria-labelledby` names the bar
   * (keep the visible text in that name, WCAG 2.5.3). The label and the bar are then wrapped in a
   * `div`; `ref`, `className`, `style` and the other props stay on the progress bar element.
   */
  showLabel?: boolean;
  /**
   * Color of the fill. Inside a `Field` it follows the Field's validation state (error, warning,
   * success) unless you set it. `warning` fills with the dark orange of the `severe` color, which
   * keeps 3:1 against the track in every theme. The bar carries `data-color` with the resolved
   * color.
   * @default 'brand'
   */
  color?: ProgressBarColor;
  ref?: React.Ref<HTMLDivElement>;
}

const fillColorClasses: Record<ProgressBarColor, string> = {
  brand: 'bg-primary',
  success: 'bg-success',
  // The warning token (a light yellow) is 1.02:1 on the light track: the severe orange passes 3:1.
  warning: 'bg-severe',
  error: 'bg-error',
};

/** The fill color a Field's validation state gives the bar (`none` keeps the default). */
const fieldColors: Partial<Record<ValidationState, ProgressBarColor>> = {
  error: 'error',
  warning: 'warning',
  success: 'success',
};

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
 * - `color` picks the fill (`brand`, `success`, `warning`, `error`).
 * - Inside a `Field`, the Field's label names a bar that has no name of its own, its validation
 *   message and hint describe the bar, and its validation state (error, warning, success) colors
 *   the fill unless `color` is set. A progress bar is never invalid or required: the
 *   `aria-invalid` and `aria-required` a Field adds are not rendered. Next to another control in
 *   a Field's wrapper element, the bar gets an id of its own and leaves the Field's
 *   `<label htmlFor>` to that control.
 * - The indeterminate animation follows the writing direction and becomes a full-width pulse for
 *   reduced motion. In forced-colors mode the fill uses `Highlight` and the track gets a border.
 *
 * @example
 * <ProgressBar value={uploaded} max={total} label="Uploading photos" showLabel />
 *
 * @example
 * <Field label="Upload" validationState="warning" validationMessage="The connection is slow.">
 *   <ProgressBar value={uploaded} max={total} />
 * </Field>
 */
export const ProgressBar = ({
  value,
  max = 100,
  label,
  showLabel,
  color,
  id,
  'aria-describedby': ariaDescribedBy,
  // Field merges both into its first child; neither is allowed on role="progressbar".
  'aria-invalid': _ariaInvalid,
  'aria-required': _ariaRequired,
  className,
  ref,
  ...rest
}: ProgressBarProps) => {
  const labelId = useId('progress-label');
  const ownId = useId('progress');
  const field = useFieldContext();
  // A <label htmlFor> cannot name a progress bar, so inside a Field a bar without an id (Field
  // passes its control id to a first child as `id`) takes its own instead of claiming the
  // control id: that stays with the control the label names (an Input next to the bar in a
  // wrapper). No name props are passed, so with `labelable: false` the merged `aria-labelledby`
  // is exactly the Field's label id (or absent); it is used only when the bar has no name of its
  // own.
  const fieldProps = useFieldControl(
    { id: id ?? (field ? ownId : undefined), 'aria-describedby': ariaDescribedBy },
    { labelable: false },
  );
  // A context built before 0.6 has no validation state: read it from `invalid`.
  const fieldState = field ? (field.validationState ?? (field.invalid ? 'error' : 'none')) : 'none';
  const resolvedColor = color ?? fieldColors[fieldState] ?? 'brand';
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
  const fieldLabelledBy = fieldProps['aria-labelledby'];
  const hasFieldName = !hasLabel && !hasAriaLabel && !hasAriaLabelledBy && isName(fieldLabelledBy);

  // Development diagnostics (C-DEV): emitted from an effect, once per page.
  React.useEffect(() => {
    if (!isDev) return;
    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasFieldName) {
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
  }, [
    hasLabel,
    hasAriaLabel,
    hasAriaLabelledBy,
    hasFieldName,
    showLabel,
    validMax,
    validValue,
    max,
    value,
  ]);

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
    'data-color': resolvedColor,
  };
  // The consumer's id (or the control id Field passes to its first child), else its own id inside
  // a Field; the consumer's description, then the Field's validation message and hint.
  if (fieldProps.id !== undefined) barProps.id = fieldProps.id;
  if (fieldProps['aria-describedby'] !== undefined) {
    barProps['aria-describedby'] = fieldProps['aria-describedby'];
  }
  // A consumer `aria-label` or `aria-labelledby` wins over the name derived from `label`, also
  // with `showLabel` (the visible label then stays unreferenced text). The Field's label names
  // only a bar without a name of its own.
  if (!hasAriaLabel && !hasAriaLabelledBy) {
    if (visibleLabel) barProps['aria-labelledby'] = labelId;
    else if (hasLabel) barProps['aria-label'] = label;
    else if (hasFieldName) barProps['aria-labelledby'] = fieldLabelledBy;
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
          'h-full rounded-full',
          fillColorClasses[resolvedColor],
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
