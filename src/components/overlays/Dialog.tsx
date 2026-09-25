import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { slotRendersContent } from '../../lib/slot';
import type { ModalOpenChangeReason, ModalType, OpenChangeDetails } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useModalLayer } from '../../hooks/useModalLayer';
import { Button } from '../button/Button';
import { Portal } from '../portal/Portal';
import {
  inertModalTrigger,
  keepFocusOnBackdropPress,
  ModalSurfaceContext,
  useModalClosePart,
  useModalDismiss,
  useModalOpenState,
  useModalTitle,
  useModalTrigger,
  useModalTriggerPart,
  useModalTriggerSession,
  useRequiredContext,
  useTitleRegistry,
  useUnnamedModalWarning,
  type ModalRequestOpen,
  type ModalSurfaceContextValue,
  type ModalTrigger,
} from './Dialog.shared';

/**
 * Why a {@link Dialog} asks to open or close: `trigger` (`Dialog.Trigger`), `close`
 * (`Dialog.Close`), `close-button` (the built-in Close button), `escape`, `outside-press` (the
 * backdrop). The shared `ModalOpenChangeReason`.
 */
export type DialogOpenChangeReason = ModalOpenChangeReason;

/** The second argument of a {@link Dialog}'s `onOpenChange`: the reason and the DOM event. */
export type DialogOpenChangeDetails = OpenChangeDetails<DialogOpenChangeReason>;

/**
 * How a {@link Dialog} blocks the page (the shared `ModalType`; Drawer reuses it when it gains
 * `modalType`).
 */
export type DialogModalType = ModalType;

/** Properties for the Dialog component. */
export interface DialogProps {
  /**
   * Controlled open state of the dialog. The surface renders only in the browser: an open dialog
   * is closed in the server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Default open state for uncontrolled usage. The surface renders only in the browser: a dialog
   * open by default is closed in the server HTML and opens once it has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called with the new open state when it changes. `details.reason` tells how — `trigger`,
   * `close` (a `.Close` part), `close-button` (the built-in Close button), `escape` or
   * `outside-press` (the backdrop) — so a controlled dialog can refuse only some ways of closing
   * (for example keep a form with unsaved changes open on `outside-press`); `details.event` is the
   * DOM event behind the request. WaveUI always passes `details`; it is typed optional until 1.0
   * so that code which calls this prop itself keeps compiling.
   *
   * Fires only when the value changes; a controlled dialog stays as it is until the parent updates
   * `open`.
   */
  onOpenChange?: (open: boolean, details?: DialogOpenChangeDetails) => void;
  /**
   * `modal`: a backdrop press, Escape, the Close button and `Dialog.Close` close it. `alert`: a
   * confirmation that needs an answer — `role="alertdialog"`, and a backdrop press does not close
   * it (Escape still does). Initial focus goes to the first focusable element, the built-in Close
   * button; give the least destructive action `autoFocus` to focus it instead. (`'non-modal'` is
   * planned.)
   * @default 'modal'
   */
  modalType?: DialogModalType;
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
  /** Ref to the dialog surface (`role="dialog"`, or `alertdialog` with `modalType="alert"`). */
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
  /** Asks the root to open or close, with the reason and event for `onOpenChange`. */
  requestOpen: ModalRequestOpen;
  /** The resolved `modalType`. */
  modalType: DialogModalType;
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
  requestOpen: () => {},
  modalType: 'modal',
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
const DialogRoot = ({
  open,
  defaultOpen,
  onOpenChange,
  modalType = 'modal',
  finalFocusRef,
  children,
}: DialogProps) => {
  const [openState, requestOpen] = useModalOpenState(open, defaultOpen, onOpenChange);
  // The surface lives in a portal, which renders only in the browser: until then (the server
  // HTML, hydration) the dialog reports itself closed, so the trigger's aria-expanded never
  // describes a dialog that is not there.
  const isClient = useIsClient();
  const isOpen = openState && isClient;
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
      requestOpen,
      modalType,
      trigger,
      finalFocusRef,
      contentId,
      registerContentId,
    }),
    [isOpen, requestOpen, modalType, trigger, finalFocusRef, contentId, registerContentId],
  );

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
};
DialogRoot.displayName = 'Dialog';

/**
 * Opens the dialog. Puts `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), a
 * click handler and a ref on its single child (no wrapper element), or passes them to a
 * render-prop child. A custom child component must forward `ref` and spread its props; one that
 * does not is wrapped in a `<span>` automatically (with a development warning), the span that
 * `asChild={false}` renders. Focus returns to the trigger when the dialog closes (with several
 * triggers, to the one that opened it). On the span, the state ARIA goes to the first element in
 * the tab order inside it, and focus returns to that element (to the span when you made it the
 * trigger with a `role` such as `button` and `tabIndex={0}`, or when nothing inside it can take
 * focus).
 */
export const DialogTrigger = (props: DialogTriggerProps) => {
  const { open, requestOpen, trigger, contentId } = useDialogContext('Dialog.Trigger');
  return useModalTriggerPart<DialogTriggerRenderProps>(
    { open, requestOpen, trigger, controlsId: contentId },
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
  const { requestOpen } = useDialogContext('Dialog.Close');
  return useModalClosePart<DialogCloseRenderProps>(requestOpen, props, 'Dialog.Close');
};
DialogClose.displayName = 'DialogClose';

const sizeClasses: Record<'small' | 'medium', string> = {
  small: 'max-w-[400px]',
  medium: 'max-w-[600px]',
};

/**
 * The dialog surface, rendered in a portal (inheriting the WaveProvider theme) while the dialog is
 * open: backdrop, title, Close button and a scrolling body. It takes the full width up to its
 * `size` and never exceeds the viewport (the body scrolls). It is `role="dialog"`, or
 * `role="alertdialog"` when the Dialog has `modalType="alert"` (a `role` you pass wins), and
 * carries `data-modal-type` with the resolved type.
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
  const { open, requestOpen, modalType, trigger, finalFocusRef, registerContentId } =
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

  const onDismiss = useModalDismiss(requestOpen, 'Dialog');
  const layer = useModalLayer({
    open,
    onDismiss,
    refs: [surfaceRef],
    // An alert dialog needs an answer: a backdrop press does not close it (Escape still does).
    outsidePress: modalType !== 'alert',
    container: surface,
    triggerRef: trigger.focusRef,
    finalFocusRef,
  });
  useUnnamedModalWarning(open ? surface : null, titles.hasTitle, 'Dialog.Content', 'Dialog.Title');

  // The height of the sticky Dialog.Footer, reserved as the body's scroll padding.
  const [footerHeight, setFooterHeight] = React.useState<number | null>(null);
  const surfaceContext = React.useMemo<ModalSurfaceContextValue>(
    () => ({ ...titles.context, setFooterHeight }),
    [titles.context],
  );

  if (!open) return null;

  const hasTitle = slotRendersContent(title);

  return (
    <Portal layerId={layer.layerId}>
      <div
        className="fixed inset-0 flex items-center justify-center bg-backdrop p-4"
        onMouseDown={keepFocusOnBackdropPress}
      >
        <div
          ref={mergedRef}
          role={modalType === 'alert' ? 'alertdialog' : 'dialog'}
          id={contentId}
          aria-labelledby={hasTitle ? propTitleId : titles.titleId}
          tabIndex={-1}
          data-modal-type={modalType}
          {...rest}
          className={cn(
            // The border marks the surface where the shadow cannot: in high contrast the page,
            // the backdrop and the surface are black, and forced colors drop shadows.
            'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg border border-border bg-background p-6 text-foreground shadow-64',
            sizeClasses[size],
            className,
          )}
        >
          <ModalSurfaceContext.Provider value={surfaceContext}>
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
              onClick={(event) =>
                requestOpen(false, { reason: 'close-button', event: event.nativeEvent })
              }
              className="absolute end-4 top-4 text-muted-foreground"
            />
            <div
              // The scroll padding keeps a focused field above the sticky footer (WCAG 2.4.11).
              className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto scroll-pb-(--wave-dialog-footer-height) p-1 text-body-1 text-muted-foreground"
              style={
                footerHeight === null
                  ? undefined
                  : ({ '--wave-dialog-footer-height': `${footerHeight}px` } as React.CSSProperties)
              }
            >
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
 * Action row at the end of the dialog body. It stays where you render it in the DOM and sticks to
 * the bottom of the body while long content scrolls under it (with an opaque background); the body
 * reserves its height as scroll padding, so a focused field is never hidden behind it. Inside a
 * `<form>` that wraps the fields and the footer it sticks too: make it the form's last child.
 * Render it inside `Dialog.Content`: outside it, it would stay on the page while the dialog is
 * closed (a development warning says so). Render one `Dialog.Footer` per `Dialog.Content`: with
 * two at once, the body reserves the height of the one measured last, and unmounting either
 * clears it until the other resizes (swapping one footer for another is fine).
 */
export const DialogFooter = ({ children, className, ref, ...rest }: DialogFooterProps) => {
  const surfaceContext = React.useContext(ModalSurfaceContext);
  const outsideContent = surfaceContext === null;
  const setFooterHeight = surfaceContext?.setFooterHeight;
  const [footer, setFooter] = React.useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, setFooter);

  React.useEffect(() => {
    if (!outsideContent) return;
    warnOnce(
      'Dialog.Footer:outside-content',
      'Dialog.Footer must be rendered inside Dialog.Content. Outside it, the footer stays on the page while the dialog is closed.',
    );
  }, [outsideContent]);

  // Reports the footer's border-box height to Dialog.Content. The observer's first callback,
  // delivered before the next paint, supplies the first value; without ResizeObserver the body
  // keeps its default scroll padding.
  React.useLayoutEffect(() => {
    if (!footer || !setFooterHeight || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setFooterHeight(entry.borderBoxSize?.[0]?.blockSize ?? footer.offsetHeight);
    });
    observer.observe(footer, { box: 'border-box' });
    return () => {
      observer.disconnect();
      setFooterHeight(null);
    };
  }, [footer, setFooterHeight]);

  return (
    <div
      ref={mergedRef}
      {...rest}
      className={cn(
        // The body is `p-1`, and sticky positioning stops at its padding edge: `-bottom-1` with
        // `-mb-1 pb-2` covers the body's bottom padding, `-mx-1 px-1` its focus-ring inset, and
        // `pt-3` separates the actions from the content scrolling under them.
        'sticky -bottom-1 z-10 -mx-1 -mb-1 mt-6 flex justify-end gap-2 bg-background px-1 pb-2 pt-3',
        className,
      )}
    >
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
 *   `onOpenChange` gets the reason as its second argument (`details.reason`), so a controlled
 *   dialog can refuse some of them. A backdrop press that does not close the dialog leaves focus
 *   where it was. Focus returns to the first of these that can take focus: `finalFocusRef`, the
 *   element that had focus when the dialog opened, the trigger, an element next to where that
 *   opener was.
 * - **Alert dialogs**: `modalType="alert"` renders `role="alertdialog"` for a confirmation that
 *   needs an answer; a backdrop press does not close it.
 * - **Footer**: `Dialog.Footer` sticks to the bottom of the scrolling body, and the body keeps a
 *   focused field above it.
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
