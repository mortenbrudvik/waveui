import * as React from 'react';
import { cn } from '../../lib/cn';
import { toastClassNames } from '../../lib/classNames';
import { DismissIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';
import { ToasterRegionContext } from './Toast.context';

/* ------------------------------------------------------------------ */
/*  Toast (individual notification)                                   */
/* ------------------------------------------------------------------ */

/** Properties for the Toast component. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the toast color, icon and status text.
   * @default 'info'
   */
  status?: Status;
  /** Title text displayed in the toast. */
  title?: string;
  /**
   * Visually hidden status text read before the toast (`'Info:'`, `'Success:'`, `'Warning:'`,
   * `'Error:'` by default). Pass a translation for other languages, or `''` to omit it.
   */
  statusLabel?: string;
  /** Called when the dismiss button is activated. Passing it renders the dismiss button. */
  onDismiss?: () => void;
  /**
   * Accessible name of the dismiss button. Pass a translation for other languages.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The visual of a single notification: status icon, visually hidden status text, title, body and an
 * optional dismiss button. Usually rendered by `<Toaster>` through `useToastController()`.
 *
 * - **In a Toaster** (dispatched with `useToastController()`): not a live region itself; the
 *   Toaster announces it through its permanent live regions.
 * - **On its own** (your own container, an inline notice): a live region, as in 0.4 —
 *   `role="status"` with `aria-live="polite"`, or `role="alert"` with `aria-live="assertive"` for
 *   `error` (override with `role`/`aria-live`). A live region that is added together with its
 *   text is not announced by every screen reader, so render the Toast in advance and change its
 *   content, or dispatch it through a Toaster.
 */
export const Toast = ({
  status = 'info',
  title,
  statusLabel,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  children,
  ref,
  ...rest
}: ToastProps) => {
  const inToasterRegion = React.useContext(ToasterRegionContext);
  // Content that renders nothing (`''`, `[]`, `<></>`) gets no body element; a generator is read
  // once by the check and its items render.
  const body = materialiseSlotContent(children);
  const hasBody = slotRendersContent(body);
  const liveRegion: React.HTMLAttributes<HTMLDivElement> = inToasterRegion
    ? {}
    : status === 'error'
      ? { role: 'alert', 'aria-live': 'assertive' }
      : { role: 'status', 'aria-live': 'polite' };
  return (
    <div
      ref={ref}
      {...liveRegion}
      {...rest}
      className={cn(
        toastClassNames.root,
        'flex items-start gap-3 rounded border border-s-4 border-border bg-background p-3 text-foreground shadow-4',
        STATUS_BORDER[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          toastClassNames.icon,
          'mt-0.5 inline-flex shrink-0',
          STATUS_ICON_COLOR[status],
        )}
      >
        <StatusIcon status={status} />
      </span>
      <div className={cn(toastClassNames.content, 'min-w-0 flex-1')}>
        <StatusText label={getStatusLabel(status, statusLabel)} />
        {title ? <div className="text-body-2 font-semibold text-foreground">{title}</div> : null}
        {hasBody ? <div className="mt-0.5 text-body-1 text-muted-foreground">{body}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={() => onDismiss()}
          className={cn(
            toastClassNames.dismissButton,
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
            'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground',
            'not-disabled:not-aria-disabled:active:bg-subtle-pressed',
            focusRing,
          )}
          aria-label={dismissLabel}
        >
          <DismissIcon />
        </button>
      ) : null}
    </div>
  );
};
Toast.displayName = 'Toast';
