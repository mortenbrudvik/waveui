import * as React from 'react';
import { cn } from '../../lib/cn';
import { resolveDeprecatedProp } from '../../lib/dev';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { renderTrigger } from '../../lib/renderTrigger';
import type { PopupAlign, PopupSide } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useDismiss } from '../../hooks/useDismiss';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useEventCallback } from '../../hooks/useEventCallback';
import { Portal } from '../portal/Portal';

/** Color treatment of a tooltip. */
type TooltipAppearance = 'inverted' | 'normal';

/** Properties for the Tooltip component. */
export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  /** Content to display inside the tooltip (short, non-interactive text). */
  content: React.ReactNode;
  /**
   * Color treatment: `inverted` (dark surface in the light theme) or `normal` (the page
   * background with a border).
   * @default 'inverted'
   */
  appearance?: TooltipAppearance;
  /**
   * @deprecated Use `appearance` (`'dark'` → `'inverted'`, `'light'` → `'normal'`).
   */
  variant?: 'dark' | 'light';
  /** Delay in milliseconds before the tooltip appears on hover or focus.
   * @default 200
   */
  delay?: number;
  /**
   * How the tooltip relates to its child: `description` adds it to the child's
   * `aria-describedby`; `label` adds it to the child's `aria-labelledby`, naming an icon-only
   * button.
   * @default 'description'
   */
  relationship?: 'description' | 'label';
  /**
   * Side of the target the tooltip opens on. `start`/`end` follow the writing direction; the
   * tooltip flips to the opposite side when there is not enough room.
   * @default 'top'
   */
  side?: PopupSide;
  /** Alignment along the target's edge.
   * @default 'center'
   */
  align?: PopupAlign;
  /**
   * A single element that triggers the tooltip on hover and focus (it receives the
   * `aria-describedby`/`aria-labelledby`). Other children are wrapped in a described `<span>`
   * with a development warning.
   */
  children: React.ReactElement;
  /** Ref to the wrapper `<span>` (the positioning anchor). */
  ref?: React.Ref<HTMLSpanElement>;
}

const VARIANT_APPEARANCE: Record<'dark' | 'light', TooltipAppearance> = {
  dark: 'inverted',
  light: 'normal',
};

const appearanceClasses: Record<TooltipAppearance, string> = {
  inverted: 'border border-inverted-border bg-inverted text-inverted-foreground',
  normal: 'border border-border bg-background text-foreground',
};

/**
 * Transparent `::before` hover bridge across the 8px gap (the positioning offset) on the side that
 * faces the trigger only, so the pointer can move onto the tooltip; the other sides get no bridge,
 * which would otherwise catch hovers and clicks meant for neighbouring controls.
 */
const bridgeClasses = [
  'before:absolute',
  // Tooltip above the trigger: a strip below it.
  'data-[side=top]:before:inset-x-0 data-[side=top]:before:top-full data-[side=top]:before:h-2',
  // Tooltip below the trigger: a strip above it.
  'data-[side=bottom]:before:inset-x-0 data-[side=bottom]:before:bottom-full data-[side=bottom]:before:h-2',
  // wave-allow-physical: data-side is the physical side resolved by the positioning
  'data-[side=left]:before:inset-y-0 data-[side=left]:before:left-full data-[side=left]:before:w-2',
  // wave-allow-physical: data-side is the physical side resolved by the positioning
  'data-[side=right]:before:inset-y-0 data-[side=right]:before:right-full data-[side=right]:before:w-2',
].join(' ');

/**
 * The visual surface: wrapping text, typography reset against the host (header cells, muted
 * panels), and the hover bridge towards the trigger.
 */
const surfaceClasses = `max-w-60 whitespace-normal break-words rounded px-3 py-1.5 text-caption-1 font-normal normal-case tracking-normal text-start shadow-8 ${bridgeClasses}`;

/** Grace period before hiding after the pointer leaves, so it can move onto the tooltip. */
const HIDE_DELAY_MS = 100;

/**
 * Shows a short text label or description for its child on hover and keyboard focus.
 *
 * - The text is always present as a hidden `role="tooltip"` element referenced by the child's
 *   `aria-describedby` (or `aria-labelledby` with `relationship="label"`), so screen readers get
 *   it on focus without waiting for the delay; the child's own ids are kept.
 * - The visual surface is rendered in a portal only while visible (it is `aria-hidden`, a copy of
 *   the description), positioned on `side`/`align` with flipping and shifting to stay in view.
 * - It stays visible while the pointer moves onto it, hides shortly after the pointer leaves or
 *   immediately on blur, and Escape hides it without closing an enclosing dialog or popover.
 */
export const Tooltip = ({
  content,
  appearance: appearanceProp,
  variant,
  delay = 200,
  relationship = 'description',
  side = 'top',
  align = 'center',
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TooltipProps) => {
  const appearance =
    resolveDeprecatedProp(
      'Tooltip',
      appearanceProp,
      variant === undefined ? undefined : VARIANT_APPEARANCE[variant],
      'variant',
      'appearance',
    ) ?? 'inverted';
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);
  const surfaceRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId('tooltip');

  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open: visible,
    side,
    align,
    offset: 8,
  });
  const wrapperElementRef = useMergedRefs<HTMLSpanElement>(ref, wrapperRef, setReference);
  const surfaceElementRef = useMergedRefs<HTMLSpanElement>(surfaceRef, setFloating);

  // Timer handlers are event callbacks (stable, latest state): they are composed with the
  // consumer's handlers during render but only run from events and timers.
  const clearTimer = useEventCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  });

  const show = useEventCallback(() => {
    clearTimer();
    if (visible) return;
    if (delay <= 0) {
      setVisible(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      setVisible(true);
    }, delay);
  });

  const hide = useEventCallback(() => {
    clearTimer();
    setVisible(false);
  });

  const scheduleHide = useEventCallback(() => {
    clearTimer();
    if (!visible) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      setVisible(false);
    }, HIDE_DELAY_MS);
  });

  // An Escape-only layer while visible: Escape hides the tooltip before any enclosing overlay.
  useDismiss({
    open: visible,
    onDismiss: hide,
    refs: [wrapperRef, surfaceRef],
    kind: 'tooltip',
    outsidePress: false,
  });

  React.useEffect(() => {
    const timer = timerRef;
    return () => clearTimeout(timer.current);
  }, []);

  const triggerProps =
    relationship === 'label' ? { 'aria-labelledby': tooltipId } : { 'aria-describedby': tooltipId };
  const child = renderTrigger(children, triggerProps, { componentName: 'Tooltip' });

  return (
    <span
      ref={wrapperElementRef}
      {...rest}
      className={cn('inline-block', className)}
      onMouseEnter={composeEventHandlers(onMouseEnter, show)}
      onMouseLeave={composeEventHandlers(onMouseLeave, scheduleHide)}
      onFocus={composeEventHandlers(onFocus, show)}
      onBlur={composeEventHandlers(onBlur, hide)}
    >
      {child}
      <span id={tooltipId} role="tooltip" hidden>
        {content}
      </span>
      {visible && (
        <Portal layer="tooltip">
          <span
            ref={surfaceElementRef}
            aria-hidden="true"
            data-wave-tooltip-surface=""
            {...floatingProps}
            className={cn(surfaceClasses, appearanceClasses[appearance])}
          >
            {content}
          </span>
        </Portal>
      )}
    </span>
  );
};

Tooltip.displayName = 'Tooltip';
