import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { toastClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';
import { ToastContext, ToastUnscannedContext, ToasterRegionContext } from './Toast.context';
import type { ToastContextValue } from './Toast.context';
import { ToastBody, ToastFooter, ToastTitle } from './Toast.parts';

/** Properties for the Toast component. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the toast color, icon and status text.
   * @default 'info'
   */
  status?: Status;
  /**
   * Title text (the 0.5 form; renders as a `Toast.Title`). A `Toast.Title` among the children wins
   * over it (development warning).
   */
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

const registerNothing: ToastContextValue['registerPart'] = () => () => {};

/**
 * The content column's parts. With a `Toast.Title`, `Toast.Body` or `Toast.Footer` among the
 * direct children (Fragments and Server Component references included), the children render as
 * given, after a Title made from the `title` prop when there is no Title part. Otherwise the 0.5
 * form: the `title` prop as a Title and the children as a Body (none for content that renders
 * nothing).
 */
function renderParts(
  title: string | undefined,
  children: React.ReactNode,
): { content: React.ReactNode; titleTwice: boolean } {
  // A generator is read once here (and cached), so the scan and the render see the same items.
  const items = materialiseSlotContent(children);
  const flat = flattenChildren(items);
  if (flat.some(({ node }) => isElementOfType(node, ToastTitle, ToastBody, ToastFooter))) {
    const hasTitlePart = flat.some(({ node }) => isElementOfType(node, ToastTitle));
    return {
      content: (
        <>
          {title && !hasTitlePart ? <ToastTitle>{title}</ToastTitle> : null}
          {items}
        </>
      ),
      titleTwice: Boolean(title) && hasTitlePart,
    };
  }
  return {
    content: (
      <>
        {title ? <ToastTitle>{title}</ToastTitle> : null}
        {slotRendersContent(items) ? (
          <ToastBody>
            <ToastUnscannedContext.Provider value={true}>{items}</ToastUnscannedContext.Provider>
          </ToastBody>
        ) : null}
      </>
    ),
    titleTwice: false,
  };
}

export const ToastRoot = ({
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
  const titleId = useId('wave-toast-title');
  const handleDismiss = useEventCallback(onDismiss);
  const hasOnDismiss = onDismiss !== undefined;
  const context = React.useMemo<ToastContextValue>(
    () => ({
      titleId,
      dismiss: hasOnDismiss ? handleDismiss : undefined,
      registerPart: registerNothing,
      registerToast: null,
    }),
    [titleId, hasOnDismiss, handleDismiss],
  );
  const { content, titleTwice } = renderParts(title, children);
  React.useEffect(() => {
    if (!titleTwice) return;
    warnOnce(
      'Toast:title-twice',
      'Toast: `title` is ignored because a Toast.Title is among the children. Remove one of them.',
    );
  }, [titleTwice]);
  const liveRegion: React.HTMLAttributes<HTMLDivElement> = inToasterRegion
    ? {}
    : status === 'error'
      ? { role: 'alert', 'aria-live': 'assertive' }
      : { role: 'status', 'aria-live': 'polite' };
  return (
    <ToastContext.Provider value={context}>
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
          {content}
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
    </ToastContext.Provider>
  );
};
ToastRoot.displayName = 'Toast';
