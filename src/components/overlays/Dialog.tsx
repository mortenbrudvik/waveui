import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { slotRendersContent } from '../../lib/slot';
import { useControllable, type SetValue } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useModalLayer } from '../../hooks/useModalLayer';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import {
  inertModalTrigger,
  ModalSurfaceContext,
  useModalClosePart,
  useModalTitle,
  useModalTrigger,
  useModalTriggerPart,
  useModalTriggerSession,
  useRequiredContext,
  useTitleRegistry,
  useUnnamedModalWarning,
  type ModalTrigger,
} from './Dialog.shared';

/** Properties for the Dialog component. */
export interface DialogProps {
  /** Controlled open state of the dialog. */
  open?: boolean;
  /** Default open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called when the dialog asks to open or close: its trigger, Escape, a backdrop click, the Close
   * button or `Dialog.Close`. Fires only when the value changes; a controlled dialog stays as it is
   * until the parent updates `open`.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Where focus goes when the dialog closes, if it can take focus. Otherwise focus returns to the
   * element that had focus when the dialog opened, then to the trigger, then to an element next to
   * where that opener was (the next row's action after a confirm dialog deleted the row). Use it to
   * send focus somewhere else.
   */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** `Dialog.Trigger` and `Dialog.Content`. */
  children: React.ReactNode;
}

/** Properties for the DialogContent sub-component. */
export interface DialogContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Title rendered as the dialog's heading; it names the dialog (`aria-labelledby`). Without it,
   * render a `Dialog.Title` or pass `aria-label`/`aria-labelledby`. A title that renders nothing
   * (`''`, `[]`, `true`) counts as none.
   */
  title?: React.ReactNode;
  /** Maximum width of the dialog: 400px (`small`) or 600px (`medium`); it never exceeds the viewport.
   * @default 'medium'
   */
  size?: 'small' | 'medium';
  /**
   * Accessible name of the built-in Close button (an icon-only button). Localize it with the
   * page's language.
   * @default 'Close'
   */
  closeLabel?: string;
  /** Content rendered inside the dialog body (put `Dialog.Footer` here as well). */
  children: React.ReactNode;
  /** Ref to the dialog surface (`role="dialog"`). */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DialogFooter sub-component. */
export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Footer content, typically action buttons (wrap closing buttons in `Dialog.Close`). */
  children: React.ReactNode;
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DialogTitle sub-component. */
export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** The title; any content. */
  children: React.ReactNode;
  /** Ref to the heading element. */
  ref?: React.Ref<HTMLHeadingElement>;
}

/** Props a `Dialog.Trigger` puts on its element (and passes to a render-prop child). */
export interface DialogTriggerRenderProps extends React.HTMLAttributes<HTMLElement> {
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  /** The dialog surface's id, while the dialog is open. */
  'aria-controls'?: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the DialogTrigger sub-component. */
export interface DialogTriggerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The element that opens the dialog. A single element receives the trigger props (merged with
   * its own: handlers composed, classes joined, its own `id` kept); a function receives them.
   */
  children: React.ReactNode | ((props: DialogTriggerRenderProps) => React.ReactNode);
  /**
   * `false` renders the 0.4 wrapper `<span>` around the children instead of merging the trigger
   * props onto the child. The span carries the click handler; `aria-haspopup`, `aria-expanded`
   * and `aria-controls` go to the first element in the tab order inside it.
   * @default true
   */
  asChild?: boolean;
  /** Ref to the trigger element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/** Props a `Dialog.Close` puts on its element (and passes to a render-prop child). */
export interface DialogCloseRenderProps extends React.HTMLAttributes<HTMLElement> {
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the DialogClose sub-component. */
export interface DialogCloseProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The element that closes the dialog, typically a footer button. A single element receives an
   * `onClick` composed with its own (its handler runs first; `preventDefault()` keeps the dialog
   * open); a function receives the props.
   */
  children: React.ReactNode | ((props: DialogCloseRenderProps) => React.ReactNode);
  /** `false` renders a wrapper `<span>` that closes the dialog on click. @default true */
  asChild?: boolean;
  /** Ref to the close element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

interface DialogContextValue {
  open: boolean;
  setOpen: SetValue<boolean>;
  /** The trigger element (`attach`) and the focus-restore target resolved from it (`focusRef`). */
  trigger: ModalTrigger;
  finalFocusRef: React.RefObject<HTMLElement | null> | undefined;
  /** The id of the open dialog surface (for the trigger's `aria-controls`), or `undefined`. */
  contentId: string | undefined;
  /** Registers the surface's id while it is mounted; returns the unregister function. */
  registerContentId: (id: string) => () => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);
DialogContext.displayName = 'DialogContext';

const inertDialogContext: DialogContextValue = {
  open: false,
  setOpen: () => {},
  trigger: inertModalTrigger,
  finalFocusRef: undefined,
  contentId: undefined,
  registerContentId: () => () => {},
};

function useDialogContext(componentName: string): DialogContextValue {
  return useRequiredContext(DialogContext, componentName, 'Dialog', () => inertDialogContext);
}

// The root of `Dialog` (documented on the export below). A const arrow (like DrawerRoot): its type
// can be named in consumers' declaration files, e.g. a story's `satisfies Meta<typeof Dialog>` (a
// function declaration's `typeof` cannot, TS4023).
const DialogRoot = ({ open, defaultOpen, onOpenChange, finalFocusRef, children }: DialogProps) => {
  const [isOpen, setOpen] = useControllable(open, defaultOpen ?? false, onOpenChange);
  const trigger = useModalTrigger();
  // After Dialog.Content's focus restore (a child's layout effects run first), start the trigger
  // session, or end it and forget the trigger that opened it.
  useModalTriggerSession(trigger, isOpen);
  const [contentId, setContentId] = React.useState<string | undefined>(undefined);
  const registerContentId = React.useCallback((id: string) => {
    setContentId(id);
    return () => setContentId((current) => (current === id ? undefined : current));
  }, []);

  const context = React.useMemo<DialogContextValue>(
    () => ({
      open: isOpen,
      setOpen,
      trigger,
      finalFocusRef,
      contentId,
      registerContentId,
    }),
    [isOpen, setOpen, trigger, finalFocusRef, contentId, registerContentId],
  );

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
};
DialogRoot.displayName = 'Dialog';

/**
 * Opens the dialog. Puts `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), a
 * click handler and a ref on its single child (no wrapper element), or passes them to a
 * render-prop child. A custom child component must forward `ref` and spread its props; one that
 * does not is wrapped in a `<span>` automatically (with a development warning). Focus returns to
 * the trigger when the dialog closes (with several triggers, to the one that opened it); with a
 * wrapper span, to the first focusable element in it.
 */
export const DialogTrigger = (props: DialogTriggerProps) => {
  const { open, setOpen, trigger, contentId } = useDialogContext('Dialog.Trigger');
  return useModalTriggerPart<DialogTriggerRenderProps>(
    { open, setOpen, trigger, controlsId: contentId },
    props,
    'Dialog.Trigger',
  );
};
DialogTrigger.displayName = 'DialogTrigger';

/**
 * Closes the dialog: composes a click handler onto its single child (its own `onClick` runs first;
 * calling `preventDefault()` there keeps the dialog open), or passes it to a render-prop child.
 *
 * @example
 * <Dialog.Close><Button appearance="subtle">Cancel</Button></Dialog.Close>
 */
export const DialogClose = (props: DialogCloseProps) => {
  const { setOpen } = useDialogContext('Dialog.Close');
  return useModalClosePart<DialogCloseRenderProps>(setOpen, props, 'Dialog.Close');
};
DialogClose.displayName = 'DialogClose';

const sizeClasses: Record<'small' | 'medium', string> = {
  small: 'max-w-[400px]',
  medium: 'max-w-[600px]',
};

/**
 * The dialog surface, rendered in a portal (inheriting the WaveProvider theme) while the dialog is
 * open: backdrop, title, Close button and a scrolling body. It takes the full width up to its
 * `size` and never exceeds the viewport (the body scrolls).
 */
export const DialogContent = ({
  title,
  size = 'medium',
  closeLabel = 'Close',
  children,
  className,
  id,
  ref,
  ...rest
}: DialogContentProps) => {
  const { open, setOpen, trigger, finalFocusRef, registerContentId } =
    useDialogContext('Dialog.Content');
  const generatedId = useId('wave-dialog');
  const contentId = id ?? generatedId;
  const propTitleId = useId('wave-dialog-title');
  const titles = useTitleRegistry();

  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const attachSurface = React.useCallback((node: HTMLDivElement | null) => {
    surfaceRef.current = node;
    setSurface(node);
  }, []);
  // Reports the surface's id to the root (the trigger's `aria-controls`) while it is mounted. A new
  // `id` makes a new callback, which useMergedRefs re-attaches after the commit (re-registering).
  const registerId = React.useCallback(
    (node: HTMLDivElement | null) => (node ? registerContentId(contentId) : undefined),
    [registerContentId, contentId],
  );
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, attachSurface, registerId);

  const close = React.useCallback(() => setOpen(false), [setOpen]);
  const layer = useModalLayer({
    open,
    onDismiss: close,
    refs: [surfaceRef],
    container: surface,
    triggerRef: trigger.focusRef,
    finalFocusRef,
  });
  useUnnamedModalWarning(open ? surface : null, titles.hasTitle, 'Dialog.Content', 'Dialog.Title');

  if (!open) return null;

  const hasTitle = slotRendersContent(title);

  return (
    <Portal layerId={layer.layerId}>
      <div className="fixed inset-0 flex items-center justify-center bg-backdrop p-4">
        <div
          ref={mergedRef}
          role="dialog"
          id={contentId}
          aria-labelledby={hasTitle ? propTitleId : titles.titleId}
          tabIndex={-1}
          {...rest}
          className={cn(
            // The border marks the surface where the shadow cannot: in high contrast the page,
            // the backdrop and the surface are black, and forced colors drop shadows.
            'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg border border-border bg-background p-6 text-foreground shadow-64',
            sizeClasses[size],
            className,
          )}
        >
          <ModalSurfaceContext.Provider value={titles.context}>
            {hasTitle && (
              <h2 id={propTitleId} className="pe-8 text-subtitle-1 font-semibold">
                {title}
              </h2>
            )}
            <Button
              appearance="subtle"
              size="small"
              icon={<DismissIcon />}
              aria-label={closeLabel}
              onClick={close}
              className="absolute end-4 top-4 text-muted-foreground"
            />
            <div className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto p-1 text-body-1 text-muted-foreground">
              {children}
            </div>
          </ModalSurfaceContext.Provider>
        </div>
      </div>
    </Portal>
  );
};
DialogContent.displayName = 'DialogContent';

/**
 * A heading that names the dialog (`aria-labelledby`), for rich titles or custom layouts. Render it
 * inside `Dialog.Content` (instead of the `title` prop). Like the `title` heading it reserves end
 * padding (`pe-8`) so a long first line stays clear of the Close button; a `className` padding wins.
 */
export const DialogTitle = ({ id, className, children, ref, ...rest }: DialogTitleProps) => {
  const { id: titleId, ref: titleRef } = useModalTitle('Dialog.Title', 'Dialog.Content', id, ref);
  return (
    <h2
      {...rest}
      id={titleId}
      ref={titleRef}
      className={cn('pe-8 text-subtitle-1 font-semibold text-foreground', className)}
    >
      {children}
    </h2>
  );
};
DialogTitle.displayName = 'DialogTitle';

/**
 * Action row at the end of the dialog body. Render it inside `Dialog.Content`: outside it, it would
 * stay on the page while the dialog is closed (a development warning says so).
 */
export const DialogFooter = ({ children, className, ref, ...rest }: DialogFooterProps) => {
  const outsideContent = React.useContext(ModalSurfaceContext) === null;

  React.useEffect(() => {
    if (!outsideContent) return;
    warnOnce(
      'Dialog.Footer:outside-content',
      'Dialog.Footer must be rendered inside Dialog.Content. Outside it, the footer stays on the page while the dialog is closed.',
    );
  }, [outsideContent]);

  return (
    <div ref={ref} {...rest} className={cn('mt-6 flex justify-end gap-2', className)}>
      {children}
    </div>
  );
};
DialogFooter.displayName = 'DialogFooter';

/**
 * A modal dialog (Fluent UI v2 style): `Dialog` holds the open state; `Dialog.Trigger` opens it and
 * `Dialog.Content` renders the surface in a portal while open.
 *
 * - **Modal**: focus moves into the dialog and Tab stays inside it (toasts included), the rest of
 *   the page is `inert` (instead of `aria-modal`, so toasts and live regions stay announced), and
 *   the page does not scroll.
 * - **Closing**: Escape (only the topmost layer: a popup opened inside closes first), a click on
 *   the backdrop (a drag that starts inside does not close it), the Close button and `Dialog.Close`.
 *   Focus returns to the first of these that can take focus: `finalFocusRef`, the element that had
 *   focus when the dialog opened, the trigger, an element next to where that opener was.
 * - **Naming**: give `Dialog.Content` a `title`, a `Dialog.Title`, or `aria-label`.
 *
 * The sub-components are also exported under flat names (`DialogTrigger`, `DialogContent`,
 * `DialogFooter`, `DialogTitle`, `DialogClose`) for React Server Components, which cannot use the
 * dotted form; dotted access (`Dialog.Content`) needs a client file.
 *
 * @example
 * <Dialog>
 *   <Dialog.Trigger><Button>Delete</Button></Dialog.Trigger>
 *   <Dialog.Content title="Delete file?">
 *     This cannot be undone.
 *     <Dialog.Footer>
 *       <Dialog.Close><Button appearance="subtle">Cancel</Button></Dialog.Close>
 *       <Button appearance="primary" onClick={remove}>Delete</Button>
 *     </Dialog.Footer>
 *   </Dialog.Content>
 * </Dialog>
 */
export const Dialog = /* @__PURE__ */ Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Footer: DialogFooter,
  Title: DialogTitle,
  Close: DialogClose,
});
