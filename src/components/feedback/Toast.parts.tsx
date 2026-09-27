import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  toastBodyClassNames,
  toastFooterClassNames,
  toastTitleClassNames,
} from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
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

/** Properties for the ToastTitle sub-component. */
export interface ToastTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content at the end of the title row, such as a link or a button (often in `Toast.Close`). */
  action?: Slot<'span'>;
  /** Ref to the title row. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The title row: the title text (which names the toast) and an optional `action` at its end. A
 * direct child of Toast, or dispatched content of a Toaster.
 *
 * Also exported as `ToastTitle` (import the flat name from React Server Components).
 */
export const ToastTitle = ({ action, className, children, ref, ...rest }: ToastTitleProps) => {
  const { titleId, registerPart } = useToastContext('Toast.Title');
  useUnscannedWarning('Title');
  const rowRef = React.useRef<HTMLDivElement>(null);
  const labelRef = React.useRef<HTMLSpanElement>(null);
  const mergedRef = useMergedRefs(ref, rowRef);
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
      className={cn(toastTitleClassNames.root, 'flex items-start gap-2', className)}
    >
      <span
        ref={labelRef}
        id={titleId}
        className={cn(
          toastTitleClassNames.label,
          'min-w-0 flex-1 text-body-2 font-semibold text-foreground',
        )}
      >
        {children}
      </span>
      {slotRendersContent(action)
        ? renderSlot(action, 'span', cn(toastTitleClassNames.action, 'shrink-0'))
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
}

/**
 * The body text and an optional `subtitle`, which describe the toast. Your `id` is the id the
 * toast's description points at (a generated one otherwise).
 *
 * Also exported as `ToastBody` (import the flat name from React Server Components).
 */
export const ToastBody = ({
  subtitle,
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
  return (
    <div
      ref={mergedRef}
      {...rest}
      id={id}
      className={cn(
        toastBodyClassNames.root,
        'mt-0.5 text-body-1 text-muted-foreground',
        className,
      )}
    >
      {children}
      {slotRendersContent(subtitle) ? (
        <div
          className={cn(toastBodyClassNames.subtitle, 'mt-1 text-caption-1 text-muted-foreground')}
        >
          {materialiseSlotContent(subtitle)}
        </div>
      ) : null}
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
      className={cn(toastFooterClassNames.root, 'mt-2 flex flex-wrap gap-2', className)}
    />
  );
};
ToastFooter.displayName = 'ToastFooter';
