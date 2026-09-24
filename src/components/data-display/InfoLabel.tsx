import * as React from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/styles';
import { InfoIcon } from '../../lib/icons';
import { useId } from '../../hooks/useId';
import { useDismiss } from '../../hooks/useDismiss';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { Portal } from '../portal/Portal';

/** Properties for the InfoLabel component. */
export interface InfoLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Primary label text to display. */
  label: string;
  /**
   * Additional information about the label. It describes the info button
   * (`aria-describedby`, available from the first render) and is shown in a popup on hover,
   * keyboard focus or click.
   */
  info: string;
  /**
   * Accessible name of the info button. Localise it here.
   * @default 'Information'
   */
  infoButtonLabel?: string;
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/** Why the popup is open: a click pins it; hover and keyboard focus open it transiently. */
type OpenReason = 'hover' | 'focus' | 'click';

/** Hover delay before the popup opens, and before it closes after the pointer leaves (ms). */
const SHOW_DELAY = 250;
const HIDE_DELAY = 250;

type Timer = ReturnType<typeof setTimeout>;

/**
 * A label with an info button that reveals additional information (a "toggletip").
 *
 * - The info button is a `<button type="button">` named `infoButtonLabel` ("Information"). The
 *   info text is rendered inline in a `hidden` element and linked with `aria-describedby`, so it is
 *   announced from the first render (also after server rendering), whether the popup is open or not.
 * - The visual popup is portaled only while open. It is `aria-hidden` because it duplicates the
 *   description, and it holds no focusable content, so focus stays on the button.
 * - Opens on keyboard focus (not on focus that comes from a pointer press), on hover after a
 *   short delay (the popup itself can be hovered) and on click. A click pins it: a click while it is
 *   open because of hover or focus keeps it open, a click on a pinned popup closes it.
 * - Closes on Escape, on a press outside, when focus moves elsewhere and — unless pinned — when
 *   the pointer leaves or the button loses focus (WCAG 1.4.13). A popup opened by hover that then
 *   receives keyboard focus stays open while the button keeps focus, even after the pointer leaves.
 *
 * @example
 * <InfoLabel label="Password" info="Use at least 8 characters." />
 */
export const InfoLabel = ({
  label,
  info,
  infoButtonLabel = 'Information',
  className,
  ref,
  ...props
}: InfoLabelProps) => {
  const descriptionId = useId('info-label-description');
  const [openReason, setOpenReason] = React.useState<OpenReason | null>(null);
  const open = openReason !== null;

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  /** Set by a pointer press on the button, so the focus that follows does not open the popup. */
  const pointerPressRef = React.useRef(false);
  const showTimerRef = React.useRef<Timer | null>(null);
  const hideTimerRef = React.useRef<Timer | null>(null);

  const clearShowTimer = () => {
    if (showTimerRef.current !== null) clearTimeout(showTimerRef.current);
    showTimerRef.current = null;
  };
  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  };

  React.useEffect(
    () => () => {
      if (showTimerRef.current !== null) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const close = () => {
    clearShowTimer();
    clearHideTimer();
    setOpenReason(null);
  };

  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open,
    side: 'top',
    align: 'center',
    offset: 8,
  });
  const { layerId } = useDismiss({
    open,
    onDismiss: close,
    refs: [triggerRef, surfaceRef],
    anchorRef: triggerRef,
    focusOutside: true,
  });
  const triggerRefs = useMergedRefs<HTMLButtonElement>(triggerRef, setReference);
  const surfaceRefs = useMergedRefs<HTMLDivElement>(surfaceRef, setFloating);

  /** Pointer left the button or the popup: a hover-opened popup closes after a delay. */
  const scheduleHide = () => {
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setOpenReason((reason) => (reason === 'hover' ? null : reason));
    }, HIDE_DELAY);
  };

  const handlePointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return;
    clearHideTimer();
    if (open || showTimerRef.current !== null) return;
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      setOpenReason((reason) => reason ?? 'hover');
    }, SHOW_DELAY);
  };

  const handlePointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return;
    scheduleHide();
  };

  const handlePointerDown = () => {
    pointerPressRef.current = true;
  };

  const handleFocus = () => {
    // Keyboard focus opens; focus that comes from a pointer press waits for the click.
    if (pointerPressRef.current) return;
    // A popup opened by hover becomes focus-owned, so it stays while the button has focus even
    // after the pointer leaves (WCAG 1.4.13 persistent). A pinned popup stays pinned.
    setOpenReason((reason) => (reason === 'click' ? reason : 'focus'));
  };

  const handleBlur = () => {
    pointerPressRef.current = false;
    setOpenReason((reason) => (reason === 'focus' ? null : reason));
  };

  const handleClick = () => {
    pointerPressRef.current = false;
    clearShowTimer();
    clearHideTimer();
    // Closed → pinned; open because of hover or focus → pinned; pinned → closed.
    setOpenReason((reason) => (reason === 'click' ? null : 'click'));
  };

  return (
    <span
      ref={ref}
      className={cn('inline-flex items-center gap-1 text-body-1', className)}
      {...props}
    >
      {label}
      <button
        ref={triggerRefs}
        type="button"
        aria-label={infoButtonLabel}
        aria-expanded={open}
        aria-describedby={descriptionId}
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground',
          'not-disabled:not-aria-disabled:hover:text-foreground',
          focusRing,
        )}
        onPointerDown={handlePointerDown}
        onMouseDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
      >
        <InfoIcon size={16} />
      </button>
      <span id={descriptionId} hidden>
        {info}
      </span>
      {open && (
        <Portal layerId={layerId}>
          <div
            ref={surfaceRefs}
            aria-hidden="true"
            data-wave-infolabel-surface=""
            data-state="open"
            {...floatingProps}
            className="w-max max-w-xs rounded-md border border-border bg-background px-3 py-2 text-caption-1 text-foreground shadow-16"
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          >
            {info}
          </div>
        </Portal>
      )}
    </span>
  );
};

InfoLabel.displayName = 'InfoLabel';
