import * as React from 'react';
import { wcn } from '../../lib/cn';
import {
  toastBodyClassNames,
  toastFooterClassNames,
  toastTitleClassNames,
} from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { mergeProps } from '../../lib/mergeProps';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useTriggerElement } from '../../hooks/useTriggerElement';
import { ToastUnscannedContext, useToastContext } from './Toast.context';

/**
 * Development warning (once, from an effect) for a part that renders inside the body a Toast made
 * for children in which its scan found no part: the part sits inside the app's own component.
 */
function useUnscannedWarning(part: 'Title' | 'Body' | 'Footer'): void {
  const unscanned = React.useContext(ToastUnscannedContext);
  React.useEffect(() => {
    if (!unscanned) return;
    warnOnce(
      `Toast.${part}:unscanned`,
      `Toast.${part} is not a direct child of Toast, so it renders inside the body that Toast makes for its children. Make it a direct child of Toast.`,
    );
  }, [unscanned, part]);
}

/**
 * What a text part locks unset: its text stays in the toast's name, description and announcement,
 * and the controls in it stay reachable.
 */
const TEXT_PART_LOCKS = {
  'aria-label': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/** Properties for the ToastTitle sub-component. */
export interface ToastTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content at the end of the title row, such as a link or a button (often in `Toast.Close`). */
  action?: Slot<'span'>;
  /** Ref to the title row. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the element the title row draws around your text, by part, merged into the part's
   * own: your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref beside its ref. Every attribute the title sets on the
   * part is locked and keeps the title's value; you add the attributes it does not set. A part
   * takes no `children`.
   */
  slotProps?: {
    /**
     * The title text `<span>` (stable class `wave-toast-title__label`), which names the toast: in
     * a Toaster the toast's container names itself by its `id`, and its text is announced. It
     * carries no handler of the title: an event on it bubbles as one on your text does. Locked:
     * `id` and, unset, `aria-label` (the text stays the name), `hidden`, `inert` and
     * `aria-hidden`.
     */
    label?: SlotPart<'span'>;
  };
}

/**
 * The title row: the title text (which names the toast) and an optional `action` at its end. A
 * direct child of Toast, or dispatched content of a Toaster.
 *
 * Also exported as `ToastTitle` (import the flat name from React Server Components).
 */
export const ToastTitle = ({
  action,
  slotProps,
  className,
  children,
  ref,
  ...rest
}: ToastTitleProps) => {
  const { titleId, registerPart } = useToastContext('Toast.Title');
  useUnscannedWarning('Title');
  const rowRef = React.useRef<HTMLDivElement>(null);
  const labelRef = React.useRef<HTMLSpanElement>(null);
  const mergedRef = useMergedRefs(ref, rowRef);
  // The Toaster reads the label through this ref: a part's ref goes beside it.
  const labelRefs = useMergedRefs(labelRef, slotProps?.label?.ref);
  const labelClassName = wcn(
    toastTitleClassNames.label,
    'wave:min-w-0 wave:flex-1 wave:text-body-2 wave:font-semibold wave:text-foreground',
  );
  React.useLayoutEffect(() => {
    if (titleId === undefined) return undefined;
    return registerPart({
      kind: 'title',
      id: titleId,
      getLabel: () => labelRef.current,
      getRow: () => rowRef.current,
    });
  }, [registerPart, titleId]);
  return (
    <div
      ref={mergedRef}
      {...rest}
      className={wcn(toastTitleClassNames.root, 'wave:flex wave:items-start wave:gap-2', className)}
    >
      <span
        id={titleId}
        className={labelClassName}
        {...(slotProps?.label &&
          mergeSlotProps(slotProps.label, {
            className: labelClassName,
            locked: { ...TEXT_PART_LOCKS, id: titleId },
          }))}
        ref={labelRefs}
      >
        {children}
      </span>
      {slotRendersContent(action)
        ? renderSlot(action, 'span', wcn(toastTitleClassNames.action, 'wave:shrink-0'))
        : null}
    </div>
  );
};
ToastTitle.displayName = 'ToastTitle';

/** Properties for the ToastBody sub-component. */
export interface ToastBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A secondary line under the body text. */
  subtitle?: React.ReactNode;
  /** Ref to the body element. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the element the body draws around `subtitle`, by part, merged into the part's own:
   * your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref beside its ref. Every attribute the body sets on the
   * part is locked and keeps the body's value; you add the attributes it does not set. A part
   * takes no `children`.
   */
  slotProps?: {
    /**
     * The `subtitle` line `<div>` (stable class `wave-toast-body__subtitle`), rendered while
     * `subtitle` renders content: part of the body, which describes the toast. Fluent's
     * `subtitle` slot takes both: here `subtitle` takes the content and this part the element's
     * props. It carries no handler of the body: an event on it bubbles as one on your content
     * does. Locked, unset: `aria-label` (its text stays in the description), `hidden`, `inert`
     * and `aria-hidden`.
     */
    subtitle?: SlotPart<'div'>;
  };
}

/**
 * The body text and an optional `subtitle`, which describe the toast. Your `id` is the id the
 * toast's description points at (a generated one otherwise).
 *
 * Also exported as `ToastBody` (import the flat name from React Server Components).
 */
export const ToastBody = ({
  subtitle,
  slotProps,
  id: idProp,
  className,
  children,
  ref,
  ...rest
}: ToastBodyProps) => {
  const { registerPart } = useToastContext('Toast.Body');
  useUnscannedWarning('Body');
  const generatedId = useId('wave-toast-body');
  const id = idProp ?? generatedId;
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(ref, bodyRef);
  React.useLayoutEffect(
    () => registerPart({ kind: 'body', id, getElement: () => bodyRef.current }),
    [registerPart, id],
  );
  let subtitleLine: React.ReactNode = null;
  if (slotRendersContent(subtitle)) {
    const subtitleClassName = wcn(
      toastBodyClassNames.subtitle,
      'wave:mt-1 wave:text-caption-1 wave:text-muted-foreground',
    );
    subtitleLine = (
      <div
        className={subtitleClassName}
        {...(slotProps?.subtitle &&
          mergeSlotProps(slotProps.subtitle, {
            className: subtitleClassName,
            locked: TEXT_PART_LOCKS,
          }))}
      >
        {materialiseSlotContent(subtitle)}
      </div>
    );
  }
  return (
    <div
      ref={mergedRef}
      {...rest}
      id={id}
      className={wcn(
        toastBodyClassNames.root,
        'wave:mt-0.5 wave:text-body-1 wave:text-muted-foreground',
        className,
      )}
    >
      {children}
      {subtitleLine}
    </div>
  );
};
ToastBody.displayName = 'ToastBody';

/** Properties for the ToastFooter sub-component. */
export interface ToastFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A row of actions under the body.
 *
 * Also exported as `ToastFooter` (import the flat name from React Server Components).
 */
export const ToastFooter = ({ className, ref, ...rest }: ToastFooterProps) => {
  const { registerPart } = useToastContext('Toast.Footer');
  useUnscannedWarning('Footer');
  const footerRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(ref, footerRef);
  React.useLayoutEffect(
    () => registerPart({ kind: 'footer', getElement: () => footerRef.current }),
    [registerPart],
  );
  return (
    <div
      ref={mergedRef}
      {...rest}
      className={wcn(
        toastFooterClassNames.root,
        'wave:mt-2 wave:flex wave:flex-wrap wave:gap-2',
        className,
      )}
    />
  );
};
ToastFooter.displayName = 'ToastFooter';

/** Props a `Toast.Close` puts on its element (and passes to a render-prop child), as `DialogCloseRenderProps`. */
export interface ToastCloseRenderProps extends React.HTMLAttributes<HTMLElement> {
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the ToastClose sub-component (as `DialogCloseProps`). */
export interface ToastCloseProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The element that dismisses the toast; a single element gets a composed `onClick`, a function the props. */
  children: React.ReactNode | ((props: ToastCloseRenderProps) => React.ReactNode);
  /** `false` renders a wrapper `<span>` that dismisses on click. @default true */
  asChild?: boolean;
  /** Ref to the close element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/**
 * Makes its single child dismiss the toast: it calls the Toast's `onDismiss` (when there is one),
 * then, inside the Toaster, dismisses the toast. Your `onClick` runs first; `preventDefault()`
 * keeps the toast. Works in dispatched content with or without a `Toast`. Fluent's `ToastTrigger`.
 *
 * Also exported as `ToastClose` (import the flat name from React Server Components).
 */
export const ToastClose = ({ children, asChild, ref, ...rest }: ToastCloseProps) => {
  const { dismiss } = useToastContext('Toast.Close');
  const mergedRef = useMergedRefs<HTMLElement>(ref);
  const hasDismiss = dismiss !== undefined;
  React.useEffect(() => {
    if (hasDismiss) return;
    warnOnce(
      'Toast.Close:no-dismiss',
      'Toast.Close has nothing to dismiss: render it in a toast dispatched to a Toaster, or in a Toast with `onDismiss`.',
    );
  }, [hasDismiss]);
  const close = React.useCallback(() => {
    dismiss?.();
  }, [dismiss]);
  const closeProps = mergeProps({ onClick: close, ref: mergedRef }, rest);
  return useTriggerElement(children, closeProps as ToastCloseRenderProps, {
    componentName: 'Toast.Close',
    asChild,
  });
};
ToastClose.displayName = 'ToastClose';
