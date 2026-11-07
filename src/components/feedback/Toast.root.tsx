import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { wcn } from '../../lib/cn';
import { toastClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { HIDDEN_PART_LOCKS, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';
import { ToastAppearanceContext, ToastContext, ToastUnscannedContext } from './Toast.context';
import type { ToastContextValue } from './Toast.context';
import { ToastBody, ToastFooter, ToastTitle } from './Toast.parts';
import type { ToastAppearance } from './Toaster';

/** Properties for the Toast component. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the toast color, icon and status text.
   * @default 'info'
   */
  status?: Status;
  /**
   * `inverted` draws the toast on the inverted surface, as a Tooltip is: its background, border,
   * text and icon take the inverted colors (the status shows in the start border), and so do the
   * text of `Toast.Title`, `Toast.Body` and its subtitle. Buttons of your own in the footer keep
   * their appearance (an `inverted` Spinner, a `transparent` Button suit it). The toast carries
   * it as `data-appearance`. Fluent's `Toast` `appearance`.
   * @default 'default'
   */
  appearance?: ToastAppearance;
  /**
   * Whether the Dismiss button shows. Inside a Toaster it shows by default, a `Toast` outside one
   * shows it with `onDismiss`. `false` hides it (Delete, Backspace, Escape, `dismissToast` and the
   * timeout still dismiss the toast), for a toast that reports a running task; a `Toast.Close` of
   * yours is not affected. Fluent has no such prop: its Dismiss button is a `ToastTrigger` you add.
   * @default true in a Toaster, else whether `onDismiss` is given
   */
  showDismissButton?: boolean;
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
  /**
   * Replaces the status icon (decorative, `aria-hidden`). Only `undefined` keeps the default;
   * `null`, or anything that renders nothing, shows no icon (the status-icon slot rule, as
   * `MessageBar.icon`). Fluent's `ToastTitle` `media`.
   */
  icon?: Slot<'span'>;
  /**
   * Called when the Dismiss button or a `Toast.Close` is activated; passing it renders the button.
   * Inside the Toaster every Toast shows the button and it dismisses the toast (your `onDismiss`
   * runs first). A timeout, Escape, Delete and `dismissToast` do not call it.
   */
  onDismiss?: () => void;
  /**
   * Accessible name of the dismiss button. Pass a translation for other languages.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the elements the Toast draws around your content, by part, merged into the part's
   * own: your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref beside its ref. Every attribute the Toast sets on a
   * part is locked and keeps the Toast's value; you add the attributes it does not set. A part
   * takes no `children`.
   */
  slotProps?: {
    /**
     * The text column `<div>` (stable class `wave-toast__content`) that holds the visually hidden
     * status text, then the title, the body and the footer. It carries no handler of the Toast:
     * an event on it bubbles as one on your content does. Locked, unset: `hidden`, `inert` and
     * `aria-hidden`, so the controls inside it stay reachable.
     */
    content?: SlotPart<'div'>;
    /**
     * The Dismiss `<button>` (stable class `wave-toast__dismiss-button`), rendered while the Toast
     * has `onDismiss` or sits in a Toaster. A `Toast.Close` child is your own element, not this
     * part. Your handlers run first: `preventDefault()` in your `onClick` skips the component's
     * handling of the event, its own `onDismiss` prop included, and the toast stays. Locked:
     * `type`, the click, `aria-label` (`dismissLabel`) and, unset, `role`, `disabled`,
     * `tabIndex`, `hidden`, `inert` and `aria-hidden`.
     */
    dismissButton?: SlotPart<'button'>;
  };
}

const registerNothing: ToastContextValue['registerPart'] = () => () => {};

/** What the Dismiss button part locks besides its click and name: a button that always works. */
const DISMISS_BUTTON_LOCKS = {
  type: 'button',
  role: undefined,
  disabled: undefined,
  tabIndex: undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

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
  appearance: appearanceProp,
  showDismissButton,
  title,
  statusLabel,
  icon,
  onDismiss,
  dismissLabel = 'Dismiss',
  slotProps,
  className,
  children,
  ref,
  ...rest
}: ToastProps) => {
  // Inside the Toaster's container, whose context has `registerToast`, the Toast registers its
  // severity, `onDismiss` and Dismiss button there and its parts use that context (the container's
  // ids); everywhere else it provides its own context and is a live region (D9, D10).
  const host = React.useContext(ToastContext);
  const registerToast = host?.registerToast ?? null;
  const inToaster = registerToast !== null;
  const label = getStatusLabel(status, statusLabel);
  const statusTextId = useId('wave-toast-status');
  const titleId = useId('wave-toast-title');
  const handleDismiss = useEventCallback(onDismiss);
  const hasOnDismiss = onDismiss !== undefined;
  const dismissButtonRef = React.useRef<HTMLButtonElement>(null);
  // The Toaster finds the Dismiss button through this ref: a part's ref goes beside it.
  const dismissButtonRefs = useMergedRefs(dismissButtonRef, slotProps?.dismissButton?.ref);

  React.useLayoutEffect(() => {
    if (!registerToast) return undefined;
    return registerToast({
      status,
      statusLabel: label,
      statusTextId: label ? statusTextId : undefined,
      onDismiss: hasOnDismiss ? handleDismiss : undefined,
      getDismissButton: () => dismissButtonRef.current,
    });
  }, [registerToast, status, label, statusTextId, hasOnDismiss, handleDismiss]);

  const ownContext = React.useMemo<ToastContextValue>(
    () => ({
      titleId,
      dismiss: hasOnDismiss ? handleDismiss : undefined,
      registerPart: registerNothing,
      registerToast: null,
    }),
    [titleId, hasOnDismiss, handleDismiss],
  );
  // Inside the Toaster every Toast shows the Dismiss button (D11); elsewhere `onDismiss` does;
  // `showDismissButton={false}` hides it in both.
  const dismiss =
    showDismissButton === false ? undefined : inToaster ? host?.dismiss : ownContext.dismiss;
  // An appearance outside the union (untyped code) is the default.
  const appearance = appearanceProp === 'inverted' ? 'inverted' : 'default';
  const inverted = appearance === 'inverted';

  const { content, titleTwice } = renderParts(title, children);
  React.useEffect(() => {
    if (!titleTwice) return;
    warnOnce(
      'Toast:title-twice',
      'Toast: `title` is ignored because a Toast.Title is among the children. Remove one of them.',
    );
  }, [titleTwice]);

  // The status icon: only `undefined` keeps the default; `null`, or anything that renders
  // nothing, shows none (C-SLOTS status-icon rule). The class rides in the slot's base classes,
  // so a slot object that swaps the element keeps it.
  const iconClassName = wcn(
    toastClassNames.icon,
    'wave:mt-0.5 wave:inline-flex wave:shrink-0',
    inverted ? 'wave:text-inverted-foreground' : STATUS_ICON_COLOR[status],
  );
  const renderedIcon =
    icon === undefined ? (
      <span aria-hidden="true" className={iconClassName}>
        <StatusIcon status={status} />
      </span>
    ) : slotRendersContent(icon) ? (
      renderSlot(icon, 'span', iconClassName, { 'aria-hidden': true })
    ) : null;

  const liveRegion: React.HTMLAttributes<HTMLDivElement> = inToaster
    ? {}
    : status === 'error'
      ? { role: 'alert', 'aria-live': 'assertive' }
      : { role: 'status', 'aria-live': 'polite' };
  // Each part merges only when given, so a toast without `slotProps` allocates no lock object.
  const contentClassName = wcn(toastClassNames.content, 'wave:min-w-0 wave:flex-1');
  let dismissButton: React.ReactNode = null;
  if (dismiss) {
    const dismissClassName = wcn(
      toastClassNames.dismissButton,
      'wave:inline-flex wave:shrink-0 wave:cursor-pointer wave:items-center wave:justify-center wave:rounded wave:border-none wave:bg-transparent wave:p-1',
      inverted
        ? 'wave:text-inverted-foreground/80 wave:not-disabled:not-aria-disabled:hover:bg-inverted-foreground/10 wave:not-disabled:not-aria-disabled:hover:text-inverted-foreground wave:not-disabled:not-aria-disabled:active:bg-inverted-foreground/20'
        : 'wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed',
      focusRing,
    );
    const handleDismissClick = () => dismiss();
    dismissButton = (
      <button
        type="button"
        onClick={handleDismissClick}
        className={dismissClassName}
        aria-label={dismissLabel}
        {...(slotProps?.dismissButton &&
          mergeSlotProps(slotProps.dismissButton, {
            className: dismissClassName,
            locked: {
              ...DISMISS_BUTTON_LOCKS,
              'aria-label': dismissLabel,
              onClick: handleDismissClick,
            },
          }))}
        ref={dismissButtonRefs}
      >
        <DismissIcon />
      </button>
    );
  }
  const root = (
    <div
      ref={ref}
      data-appearance={appearance}
      {...liveRegion}
      {...rest}
      className={wcn(
        toastClassNames.root,
        inverted
          ? 'wave:flex wave:items-start wave:gap-3 wave:rounded wave:border wave:border-s-4 wave:border-inverted-border wave:bg-inverted wave:p-3 wave:text-inverted-foreground wave:shadow-4'
          : 'wave:flex wave:items-start wave:gap-3 wave:rounded wave:border wave:border-s-4 wave:border-border wave:bg-background wave:p-3 wave:text-foreground wave:shadow-4',
        STATUS_BORDER[status],
        className,
      )}
    >
      {renderedIcon}
      <div
        className={contentClassName}
        {...(slotProps?.content &&
          mergeSlotProps(slotProps.content, {
            className: contentClassName,
            locked: HIDDEN_PART_LOCKS,
          }))}
      >
        <StatusText label={label} id={statusTextId} />
        <ToastAppearanceContext.Provider value={appearance}>
          {content}
        </ToastAppearanceContext.Provider>
      </div>
      {dismissButton}
    </div>
  );
  return inToaster ? (
    root
  ) : (
    <ToastContext.Provider value={ownContext}>{root}</ToastContext.Provider>
  );
};
ToastRoot.displayName = 'Toast';
