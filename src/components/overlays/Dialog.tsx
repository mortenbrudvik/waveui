import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import {
  dialogContentClassNames,
  dialogFooterClassNames,
  dialogTitleClassNames,
} from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { dialogBackdropMotion, dialogMotion } from '../../lib/motion';
import { renderSlot, slotRendersContent, type Slot, type SlotObject } from '../../lib/slot';
import type {
  BackdropAppearance,
  ModalOpenChangeReason,
  ModalType,
  MotionSlot,
  OpenChangeDetails,
  SurfaceSize,
} from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useModalLayer } from '../../hooks/useModalLayer';
import { useMotionClasses } from '../../hooks/useMotion';
import { usePresence } from '../../hooks/usePresence';
import { Portal } from '../portal/Portal';
import {
  inertModalTrigger,
  ModalSurfaceContext,
  useBackdropPress,
  useModalClosePart,
  useModalDismiss,
  useModalOpener,
  useModalOpenState,
  useModalTitle,
  useModalTrigger,
  useModalTriggerPart,
  useModalTriggerSession,
  useOpenInsideWarning,
  useRaiseOnOpen,
  useRequiredContext,
  useTitleRegistry,
  useUnnamedModalWarning,
  type ModalRequestOpen,
  type ModalSurfaceContextValue,
  type ModalTrigger,
} from './Dialog.shared';
import { ModalBackdrop, ModalCloseButton } from './Dialog.slots';
import { getTabbableThrough, usePopoverTabOrder } from './Popover.shared';

/**
 * Why a {@link Dialog} asks to open or close: `trigger` (`Dialog.Trigger`), `close`
 * (`Dialog.Close`), `close-button` (the built-in Close button), `escape`, `outside-press` (the
 * backdrop). The shared `ModalOpenChangeReason`.
 */
export type DialogOpenChangeReason = ModalOpenChangeReason;

/** The second argument of a {@link Dialog}'s `onOpenChange`: the reason and the DOM event. */
export type DialogOpenChangeDetails = OpenChangeDetails<DialogOpenChangeReason>;

/**
 * How a {@link Dialog} relates to the page: `modal`, `alert` or `non-modal` (the shared
 * `ModalType`; `DrawerModalType` is the same type).
 */
export type DialogModalType = ModalType;

/**
 * The width cap of a {@link Dialog}'s surface: `small` 400px, `medium` 600px, `large` 940px, or
 * `full`, the whole viewport (the shared `SurfaceSize`; `DrawerSize` is the same type).
 */
export type DialogSize = SurfaceSize;

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
   * `modal`: the page behind is `inert` and does not scroll; a backdrop press, Escape, the Close
   * button and `Dialog.Close` close it. `alert`: a confirmation that needs an answer —
   * `role="alertdialog"`, and a backdrop press does not close it (Escape still does). `non-modal`:
   * the page stays usable — no backdrop, no focus trap, nothing inert, the page scrolls; Tab and
   * Shift+Tab leave the dialog in the page's order right after the element that opened it, Escape
   * closes it while focus is inside it, presses on the page never close it, and focus returns to
   * the opener only when it was inside the dialog. A non-modal dialog covers the page under it
   * while Tab still reaches that page: keep the controls the user works with outside it, or use
   * `modal` (with `size="full"` it covers everything, and a development warning says so). Every
   * type moves focus to the first focusable element on open (a title action, else the built-in
   * Close button); give another element `autoFocus` to start there (an alert dialog's least
   * destructive action). `Dialog.Trigger` toggles the dialog. Fluent's `modalType`.
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
  /**
   * Removes `Dialog.Content` (the surface and everything in it) when the dialog closes, once its
   * exit motion has ended. `false` keeps it mounted while closed, `hidden` and `inert`, so a form
   * inside keeps what was typed and the components inside keep their state; the surface then
   * mounts with the Dialog, closed (in the browser only, as an open one), and an `autoFocus`
   * inside it never applies (each open focuses the first focusable element). A popup opened inside
   * that is still open when the dialog closes stays open over the page (a development warning says
   * so): close it first. Fluent's `unmountOnClose`.
   * @default true
   */
  unmountOnClose?: boolean;
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
  /**
   * Width cap: 400px (`small`), 600px (`medium`) or 940px (`large`), never wider than the viewport
   * (a 1rem margin). `full` covers the viewport: no margin, radius or border, the viewport's
   * dynamic height, and the safe-area insets as padding (with `viewport-fit=cover`); the body
   * scrolls under the sticky `Dialog.Footer`. Rendered as `data-size`. Fluent has no size. For
   * another width, put a width cap in `className` (it replaces the size's).
   * @default 'medium'
   */
  size?: DialogSize;
  /**
   * The backdrop of a modal or alert dialog: a `div` behind the dialog, `aria-hidden`. Shorthand
   * content renders inside it; a slot object's `className` (merged last), `style`, data
   * attributes, `ref` and handlers go to it, and its `appearance` (`'dimmed'` or `'transparent'`)
   * overrides the automatic one: while another modal Dialog or Drawer is open below this one the
   * backdrop is transparent, so the page is dimmed once. `null` renders no backdrop (the page stays
   * inert, and a press outside still closes a modal dialog); a boolean is no slot. Ignored with
   * `modalType="non-modal"` (a development warning says so). Fluent's `backdrop`.
   */
  backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
  /**
   * The surface's motion. By default it scales up from 85% of its size and fades in over 250 ms
   * with a decelerating curve, and scales down and fades out over 200 ms with an accelerating
   * curve; under reduced motion it appears and disappears at once. `null` turns the motion off
   * (the surface still renders its `data-presence` phases, which then end at once); a class string
   * or `{ className }` replaces the default classes with yours (see `MotionSlot`), also under a
   * `WaveProvider` with `motion="none"`, which otherwise turns the default off. A `className` that
   * holds `data-[presence=…]` classes while `motion` is unset keeps 0.14's behaviour: no default
   * motion, your classes animate the surface. Fluent's `Dialog` `surfaceMotion`.
   * @default the scale and fade above
   */
  motion?: MotionSlot | null;
  /**
   * The backdrop's motion. By default it fades in over 250 ms and out over 200 ms, the surface's
   * exit, with an easy-ease curve; under reduced motion it appears and disappears at once. `null`
   * turns the motion off; a class string or `{ className }` replaces the default classes with yours
   * (see `MotionSlot`), also under a `WaveProvider` with `motion="none"`, which otherwise turns the
   * default off. The surface's motion decides when the dialog unmounts or hides: a replacement
   * longer than the surface's exit is cut off there. Ignored with `modalType="non-modal"` (a
   * development warning says so). Fluent's `DialogSurface` `backdropMotion`.
   * @default the fade above
   */
  backdropMotion?: MotionSlot | null;
  /**
   * Content of the built-in Close button (the dismiss glyph by default). It renders inside the
   * button, decorative (`aria-hidden`), so the button keeps the name `closeLabel`; a slot object's
   * `aria-label`, `aria-labelledby` or `title` names it instead, and its handlers run before the
   * close (`preventDefault()` keeps the dialog open). `null` hides the button (Escape and
   * `Dialog.Close` still close); a boolean is no slot, so `closeButton={cond && <MyIcon />}` keeps
   * the default; content that renders nothing keeps the default glyph. A `<button>` or Wave
   * `Button` passed here is merged into the built-in button, never nested (a development warning
   * says so): its props apply, its text label (`<button>Done</button>`) names the button instead
   * of `closeLabel`, and a Button's `icon`, `iconPosition` and `disabledFocusable` apply while
   * `appearance` and `size` are ignored. Fluent's `DialogTitle` `action` holds Fluent's close
   * button; WaveUI renders its own.
   */
  closeButton?: Slot<'span'>;
  /**
   * Header buttons for the `title` prop form, placed before the built-in Close button in the
   * dialog's top end corner, in DOM and Tab order (an expand toggle, a menu). The title's end
   * padding makes room for them. Interactive: name icon-only buttons. Renders nothing when empty.
   * See also `Dialog.Title`'s `action`. Fluent's `DialogTitle` `action`, for the `title` prop
   * form.
   */
  titleAction?: Slot<'span'>;
  /**
   * Accessible name of the built-in Close button (an icon-only button). Localize it with the
   * page's language. A text label of a button merged into `closeButton` names it instead.
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
  /**
   * Header buttons for this title, placed before the built-in Close button in the dialog's top end
   * corner (after `Dialog.Content`'s `titleAction`), not inside the heading, so they never become
   * part of the dialog's name. Outside `Dialog.Content` (in a Drawer) they render right after the
   * heading. Interactive: name icon-only buttons. Renders nothing when empty. Fluent's
   * `DialogTitle` `action`; unlike Fluent's, it is never filled by default (the Close button is
   * the Content's).
   */
  action?: Slot<'span'>;
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
   * The element that opens and closes the dialog. A single element receives the trigger props
   * (merged with its own: handlers composed, classes joined, its own `id` kept); a function
   * receives them.
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
  /** The resolved `unmountOnClose`: `false` keeps `Dialog.Content` mounted while closed. */
  unmountOnClose: boolean;
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
  unmountOnClose: true,
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
  unmountOnClose = true,
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
      unmountOnClose,
      contentId,
      registerContentId,
    }),
    [
      isOpen,
      requestOpen,
      modalType,
      trigger,
      finalFocusRef,
      unmountOnClose,
      contentId,
      registerContentId,
    ],
  );

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
};
DialogRoot.displayName = 'Dialog';

/**
 * Opens and closes the dialog: a click while it is open asks it to close (reason `trigger`). Only a
 * non-modal dialog's trigger, or a trigger rendered inside the dialog's own content, can receive
 * one (a modal dialog makes the page inert). Fluent's `DialogTrigger` never toggles (outside the
 * surface it only opens, inside it only closes); this trigger always does. Puts
 * `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), a click handler and a
 * ref on its single child (no wrapper element), or passes them to a render-prop child. A custom
 * child component must forward `ref` and spread its props; one that does not is wrapped in a
 * `<span>` automatically (with a development warning), the span that `asChild={false}` renders.
 * Focus returns to the trigger when the dialog closes (with several triggers, to the one that
 * opened it). On the span, the state ARIA goes to the first element in the tab order inside it,
 * and focus returns to that element (to the span when you made it the trigger with a `role` such
 * as `button` and `tabIndex={0}`, or when nothing inside it can take focus).
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

/**
 * The surface's width cap per size. `full` lifts the caps, the margin, the radius and the border,
 * takes the viewport's dynamic height and pads the safe-area insets (`max()` keeps the 24px
 * padding where there is no inset, and never adds the two). The side insets are physical (the
 * left inset pads the left side in either direction), so the side padding is too: one class per
 * side, with no direction override that a consumer's padding class would leave behind.
 */
const sizeClasses: Record<DialogSize, string> = {
  small: 'max-w-[400px]',
  medium: 'max-w-[600px]',
  large: 'max-w-[940px]',
  full: 'm-0 h-dvh max-h-none max-w-none rounded-none border-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]', // wave-allow-physical: the safe-area insets are physical sides
};

/** The title-actions area of a `full` dialog moves by the safe-area insets, as the padding does. */
const fullTitleActionsClasses =
  'top-[max(1rem,env(safe-area-inset-top))] end-[max(1rem,env(safe-area-inset-right))] wave-rtl:end-[max(1rem,env(safe-area-inset-left))]';

/** The gap (px) between the titles' text and the title-actions area. */
const TITLE_ACTIONS_GAP = 8;

const BACKDROP_IGNORED_WARNING_KEY = 'Dialog.Content:backdrop-ignored';
const BACKDROP_IGNORED_WARNING =
  'Dialog.Content: `backdrop` and `backdropMotion` are ignored with `modalType="non-modal"`: a non-modal dialog has no backdrop, so the page behind it stays usable.';

const NON_MODAL_FULL_WARNING_KEY = 'Dialog.Content:non-modal-full';
const NON_MODAL_FULL_WARNING =
  'Dialog.Content: `size="full"` with `modalType="non-modal"` covers the whole page while leaving it usable, so Tab reaches controls hidden behind the dialog. Use `modalType="modal"`, or a smaller size with the page\'s controls kept clear of it.';

/**
 * The width (px) of the title-actions area, measured with a `ResizeObserver` (`null` until the
 * first measurement, and without `ResizeObserver`). The observer's first callback arrives before
 * the next paint.
 */
function useTitleActionsWidth(area: HTMLElement | null): number | null {
  const [width, setWidth] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    if (!area || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setWidth(entry.borderBoxSize?.[0]?.inlineSize ?? area.offsetWidth);
    });
    observer.observe(area, { box: 'border-box' });
    return () => {
      observer.disconnect();
      setWidth(null);
    };
  }, [area]);
  return width;
}

/**
 * The dialog surface, rendered in a portal (inheriting the WaveProvider theme) while the dialog is
 * open, and kept there while it is closed, `hidden` and `inert`, when the Dialog has
 * `unmountOnClose={false}`: the backdrop, and the surface centred in the positioner (the
 * backdrop's sibling) with the title, the title-actions area (title actions, then the Close
 * button) and a scrolling body. It takes the full width up to its `size` and never exceeds the
 * viewport (the body scrolls, also sideways for content wider than the dialog); `size="full"`
 * fills the viewport. Its 1rem gap to the viewport edges is its own margin, so a margin in
 * `className` replaces the gap: with the width and height caps lifted as well and its height set
 * to the viewport's, it fills the viewport. It is `role="dialog"`, or `role="alertdialog"` when the
 * Dialog has `modalType="alert"` (a `role` you pass wins), and carries `data-modal-type` and
 * `data-size` with the resolved values. A non-modal dialog has no backdrop: the positioner only
 * centres the surface and lets presses through to the page. The titles' end padding follows the
 * width of the title-actions area (`--wave-dialog-title-end-padding`, 2rem until it is measured).
 *
 * It moves in and out: the surface scales up from 85% of its size and fades in over 250 ms, and
 * scales down and fades out over 200 ms, while the backdrop fades in over 250 ms and out with the
 * surface; a dialog open by default animates in when it mounts in the browser. Under reduced
 * motion both appear and disappear at once. `motion` (the surface) and `backdropMotion` (the
 * backdrop) turn each motion off (`null`) or replace its classes, and a `WaveProvider` with
 * `motion="none"` turns both defaults off. It mounts through the presence core: the backdrop, the
 * positioner and the surface render `data-presence` (`entering` and `exiting` while the surface's
 * motion runs, `entered` while open, `exited` while kept closed), and the backdrop and the
 * positioner are `inert` while exiting and `hidden` and `inert` while kept closed. A closed
 * surface waits for its motion before it unmounts or hides, while focus, the trap, the isolation
 * and the scroll lock follow the open state at once: an exiting dialog lets clicks through to the
 * page (an `inert` element takes no pointer events), and the page's scrollbar comes back while the
 * dialog still fades. Opened again during its exit, the same surface enters again.
 */
export const DialogContent = ({
  title,
  size = 'medium',
  backdrop,
  motion,
  backdropMotion,
  closeButton,
  titleAction,
  closeLabel = 'Close',
  children,
  className,
  style,
  id,
  onKeyDown,
  ref,
  ...rest
}: DialogContentProps) => {
  const {
    open,
    requestOpen,
    modalType,
    trigger,
    finalFocusRef,
    unmountOnClose,
    registerContentId,
  } = useDialogContext('Dialog.Content');
  // Every surface mounts through the presence core (D5, D103), and enters also when it mounts open
  // (D9: a dialog open by default animates in on a client render as after hydration): kept
  // mounted while closed with `unmountOnClose={false}`, else removed once it has exited.
  const {
    isMounted,
    ref: presenceRef,
    presenceProps,
  } = usePresence(open, { appear: true, unmountOnExit: unmountOnClose });
  const exiting = presenceProps['data-presence'] === 'exiting';
  // The motion classes of the surface (a `className` with presence variants keeps 0.14's own
  // motion, D19) and of the backdrop.
  const surfaceMotion = useMotionClasses(motion, dialogMotion, className);
  const backdropMotionClassName = useMotionClasses(backdropMotion, dialogBackdropMotion);
  const keptMounted = !unmountOnClose;
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
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, attachSurface, registerId, presenceRef);
  // The portal wrapper: a kept-mounted surface moves to the top of its stack when it opens
  // (before the layer registers and the trap moves focus in).
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  useRaiseOnOpen(open, keptMounted, portalRef);

  // An alert dialog needs an answer: a backdrop press does not close it (Escape still does;
  // useModalLayer registers its layer without outside presses).
  const backdropPress = useBackdropPress(surfaceRef, modalType !== 'alert');
  const onDismiss = useModalDismiss(requestOpen, 'Dialog', backdropPress.afterOutsidePress);
  const layer = useModalLayer({
    open,
    modalType,
    onDismiss,
    refs: [surfaceRef],
    container: surface,
    triggerRef: trigger.focusRef,
    finalFocusRef,
  });
  // A non-modal dialog keeps its place in the page's keyboard order right after its opener. The
  // opener is captured whenever the dialog opens, so a modal dialog that turns non-modal while open
  // (focus inside it by then) still knows it.
  const nonModal = modalType === 'non-modal';
  const opener = useModalOpener(open, trigger, surface);
  const onTabOrderKeyDown = usePopoverTabOrder({
    enabled: open && nonModal,
    surface,
    anchorRef: opener,
    getPreviousStop: getTabbableThrough,
  });
  useUnnamedModalWarning(open ? surface : null, titles.hasTitle, 'Dialog.Content', 'Dialog.Title');
  useOpenInsideWarning(open, keptMounted, layer.layerId, 'Dialog');

  // A non-modal dialog has no backdrop: a given slot (not undefined, null or a boolean) and a
  // given backdrop motion are ignored.
  const backdropIgnored =
    nonModal &&
    ((backdrop !== undefined && backdrop !== null && typeof backdrop !== 'boolean') ||
      backdropMotion !== undefined);
  React.useEffect(() => {
    if (backdropIgnored) warnOnce(BACKDROP_IGNORED_WARNING_KEY, BACKDROP_IGNORED_WARNING);
  }, [backdropIgnored]);
  // A full non-modal dialog covers the page it leaves usable (D87.8).
  const coversUsablePage = open && nonModal && size === 'full';
  React.useEffect(() => {
    if (coversUsablePage) warnOnce(NON_MODAL_FULL_WARNING_KEY, NON_MODAL_FULL_WARNING);
  }, [coversUsablePage]);

  // The title-actions area (held in state) and the outlet `Dialog.Title` actions portal into. Both
  // attach in the commit that mounts the surface, so a title's action is in the DOM in the next
  // commit, the one in which the focus trap starts (it waits for the surface held in state). The
  // area is measured while the dialog is open and while it exits, so the titles keep their end
  // padding through the exit motion (a kept-mounted closed one measures nothing).
  const [titleActionsArea, setTitleActionsArea] = React.useState<HTMLDivElement | null>(null);
  const [titleActionsOutlet, setTitleActionsOutlet] = React.useState<HTMLSpanElement | null>(null);
  const titleActionsWidth = useTitleActionsWidth(open || exiting ? titleActionsArea : null);

  // The height of the sticky Dialog.Footer, reserved as the body's scroll padding.
  const [footerHeight, setFooterHeight] = React.useState<number | null>(null);
  const surfaceContext = React.useMemo<ModalSurfaceContextValue>(
    () => ({ ...titles.context, setFooterHeight, titleActionsOutlet }),
    [titles.context, titleActionsOutlet],
  );

  if (!isMounted) return null;

  const hasTitle = slotRendersContent(title);
  // The titles' end padding: the area's width and a gap while it has a size, none while it is
  // empty; unset (the 2rem fallback) until it is measured.
  const titleEndPadding =
    titleActionsWidth === null
      ? undefined
      : titleActionsWidth > 0
        ? `${titleActionsWidth + TITLE_ACTIONS_GAP}px`
        : '0px';
  const surfaceStyle =
    titleEndPadding === undefined
      ? style
      : ({ '--wave-dialog-title-end-padding': titleEndPadding, ...style } as React.CSSProperties);

  return (
    <Portal ref={portalRef} layerId={layer.layerId}>
      {/* Each top-level element carries the presence attributes (D7, D103): hidden and inert while
          kept closed, so a closed dialog leaves no backdrop over the page. */}
      {!nonModal && (
        <ModalBackdrop
          backdrop={backdrop}
          className={dialogContentClassNames.backdrop}
          layerId={layer.layerId}
          open={open}
          onMouseDown={backdropPress.onMouseDown}
          presenceProps={presenceProps}
          motionClassName={backdropMotionClassName}
        />
      )}
      <div
        {...presenceProps}
        // Centres the surface and lets presses through to the backdrop (modal) or the page
        // (non-modal) around it.
        className={cn(
          dialogContentClassNames.positioner,
          'pointer-events-none fixed inset-0 flex items-center justify-center',
        )}
      >
        <div
          ref={mergedRef}
          role={modalType === 'alert' ? 'alertdialog' : 'dialog'}
          id={contentId}
          aria-labelledby={hasTitle ? propTitleId : titles.titleId}
          tabIndex={-1}
          data-modal-type={modalType}
          data-size={size}
          {...rest}
          data-presence={presenceProps['data-presence']}
          style={surfaceStyle}
          onKeyDown={composeEventHandlers(onKeyDown, onTabOrderKeyDown)}
          className={cn(
            dialogContentClassNames.root,
            // The border marks the surface where the shadow cannot: in high contrast the page,
            // the backdrop and the surface are black, and forced colors drop shadows. The 1rem gap
            // to the viewport edges is the surface's own margin, not the positioner's padding, so
            // a margin in `className` replaces it and a full-screen dialog can reach the edges.
            // Its minimum width is zero, so content wider than the room inside the gap scrolls in
            // the body instead of pushing the surface over the gap.
            'pointer-events-auto relative m-4 flex min-w-0 max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg border border-border bg-background p-6 text-foreground shadow-64',
            sizeClasses[size],
            surfaceMotion,
            className,
          )}
        >
          <ModalSurfaceContext.Provider value={surfaceContext}>
            {hasTitle && (
              <h2
                id={propTitleId}
                className={cn(
                  dialogTitleClassNames.root,
                  'pe-[var(--wave-dialog-title-end-padding,2rem)] text-subtitle-1 font-semibold',
                )}
              >
                {title}
              </h2>
            )}
            <div
              ref={setTitleActionsArea}
              className={cn(
                dialogContentClassNames.titleActions,
                'absolute end-4 top-4 flex items-start gap-1',
                size === 'full' && fullTitleActionsClasses,
              )}
            >
              {slotRendersContent(titleAction)
                ? renderSlot(
                    titleAction,
                    'span',
                    cn(dialogContentClassNames.titleAction, 'inline-flex items-center gap-1'),
                  )
                : null}
              {/* Each Dialog.Title action portals here, in mount order. */}
              <span ref={setTitleActionsOutlet} className="contents" />
              <ModalCloseButton
                componentName="Dialog.Content"
                closeButton={closeButton}
                closeLabel={closeLabel}
                onClose={(event) => requestOpen(false, { reason: 'close-button', event })}
                className={cn(dialogContentClassNames.closeButton, 'text-muted-foreground')}
              />
            </div>
            <div
              // The scroll padding keeps a focused field above the sticky footer (WCAG 2.4.11).
              className={cn(
                dialogContentClassNames.body,
                '-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto scroll-pb-(--wave-dialog-footer-height) p-1 text-body-1',
              )}
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
 * inside `Dialog.Content` (instead of the `title` prop). Like the `title` heading, its end padding
 * follows the width of the dialog's title-actions area (2rem until it is measured), so a long first
 * line stays clear of the title actions and the Close button; a `className` padding wins. Its
 * `action` renders in that area, before the Close button, and never inside the heading.
 */
export const DialogTitle = ({
  id,
  action,
  className,
  children,
  ref,
  ...rest
}: DialogTitleProps) => {
  const { id: titleId, ref: titleRef } = useModalTitle('Dialog.Title', 'Dialog.Content', id, ref);
  // `undefined` outside Dialog.Content (a Drawer), `null` until the content's outlet is attached.
  const outlet = React.useContext(ModalSurfaceContext)?.titleActionsOutlet;
  const heading = (
    <h2
      {...rest}
      id={titleId}
      ref={titleRef}
      className={cn(
        dialogTitleClassNames.root,
        'pe-[var(--wave-dialog-title-end-padding,2rem)] text-subtitle-1 font-semibold text-foreground',
        className,
      )}
    >
      {children}
    </h2>
  );
  if (!slotRendersContent(action)) return heading;
  const actionElement = renderSlot(
    action,
    'span',
    cn(dialogTitleClassNames.action, 'inline-flex items-center gap-1'),
  );
  return (
    <>
      {heading}
      {outlet === undefined ? actionElement : outlet && createPortal(actionElement, outlet)}
    </>
  );
};
DialogTitle.displayName = 'DialogTitle';

/**
 * `Dialog.Footer` inside `Dialog.Content`. The body is `p-1`, and sticky positioning stops at its
 * padding edge: `-bottom-1` with `-mb-1 pb-2` covers the body's bottom padding, `-mx-1 px-1` its
 * focus-ring inset, and `pt-3` separates the actions from the content scrolling under them.
 */
const stickyFooterClasses =
  'sticky -bottom-1 z-10 -mx-1 -mb-1 mt-6 flex justify-end gap-2 bg-background px-1 pb-2 pt-3';

/**
 * `Dialog.Footer` where no body reserves its height as scroll padding (a Drawer's body): a plain
 * action row, which never covers a focused field.
 */
const footerRowClasses = 'mt-6 flex justify-end gap-2';

/**
 * Action row at the end of the dialog body. It stays where you render it in the DOM and sticks to
 * the bottom of the body while long content scrolls under it (with an opaque background); the body
 * reserves its height as scroll padding, so a focused field is never hidden behind it. Inside a
 * `<form>` that wraps the fields and the footer it sticks too: make it the form's last child.
 * Render it inside `Dialog.Content`: outside it, it would stay on the page while the dialog is
 * closed (a development warning says so). Inside a `Drawer`, whose body reserves no footer height,
 * it does not stick: it is an action row at the end of the content. Render one `Dialog.Footer` per
 * `Dialog.Content`: with two at once, the body reserves the height of the one measured last, and
 * unmounting either clears it until the other resizes (swapping one footer for another is fine).
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
      // Sticky only where the surface reserves the footer's height (Dialog.Content).
      className={cn(
        dialogFooterClassNames.root,
        setFooterHeight ? stickyFooterClasses : footerRowClasses,
        className,
      )}
    >
      {children}
    </div>
  );
};
DialogFooter.displayName = 'DialogFooter';

/**
 * A dialog (Fluent UI v2 style), modal by default: `Dialog` holds the open state; `Dialog.Trigger`
 * opens and closes it and `Dialog.Content` renders the surface in a portal while open (and, with
 * `unmountOnClose={false}`, keeps it there while closed, `hidden` and `inert`).
 *
 * - **Modal**: focus moves into the dialog and Tab stays inside it (toasts included), the rest of
 *   the page is `inert` (instead of `aria-modal`, so toasts and live regions stay announced), and
 *   the page does not scroll.
 * - **Closing**: Escape (only the topmost layer: a popup opened inside closes first), a click on
 *   the backdrop (a drag that starts inside does not close it), the Close button and `Dialog.Close`.
 *   `onOpenChange` gets the reason as its second argument (`details.reason`), so a controlled
 *   dialog can refuse some of them. A backdrop press blurs the focused field before the dialog
 *   closes, so a typed value is committed as with the Close button; when a controlled dialog
 *   refuses the press, the field gets focus back (an alert dialog's press leaves focus where it
 *   was). Focus returns to the first of these that can take focus: `finalFocusRef`, the element
 *   that had focus when the dialog opened, the trigger, an element next to where that opener was.
 * - **Alert dialogs**: `modalType="alert"` renders `role="alertdialog"` for a confirmation that
 *   needs an answer; a backdrop press does not close it.
 * - **Non-modal dialogs**: `modalType="non-modal"` leaves the page usable (no backdrop, no focus
 *   trap, nothing inert, the page scrolls). Focus moves in on open; Tab and Shift+Tab leave the
 *   dialog in the page's order right after the element that opened it; Escape closes it only while
 *   focus is inside it; presses on the page never close it; focus returns to the opener only from
 *   inside. Keep the page's controls clear of the dialog, which covers the page under it.
 * - **Size**: `Dialog.Content` `size` caps the width at 400px (`small`), 600px (`medium`, the
 *   default) or 940px (`large`); `full` covers the viewport and pads its safe-area insets.
 * - **Backdrop**: the backdrop is the surface's sibling and a slot (`backdrop`: `null` removes it,
 *   `appearance` picks `dimmed` or `transparent`). A modal opened over another modal dims the page
 *   once: its backdrop is transparent while the lower one is open.
 * - **Close button and title actions**: `closeButton` sets the built-in Close button's content, or
 *   hides it (`null`); a button passed there is merged into it. `titleAction` and `Dialog.Title`'s
 *   `action` place header buttons before the Close button in the top end corner, in DOM and Tab
 *   order, and the titles' end padding makes room for them. Initial focus goes to the first
 *   focusable element: a title action, else the Close button.
 * - **Footer**: `Dialog.Footer` sticks to the bottom of the scrolling body, and the body keeps a
 *   focused field above it.
 * - **Kept mounted**: `unmountOnClose={false}` keeps the content mounted while the dialog is
 *   closed, so a form keeps what was typed and the components inside keep their state; each open
 *   focuses the first focusable element again (an `autoFocus` inside never applies), and a kept
 *   dialog opened while another overlay is open stacks above it.
 * - **Motion**: the surface scales and fades in and out and the backdrop fades with it (none under
 *   reduced motion); `Dialog.Content`'s `motion` and `backdropMotion` turn each off (`null`) or
 *   replace it, and `WaveProvider motion="none"` turns both off. The surface mounts through the
 *   presence core and renders `data-presence`; while it exits it stays on screen, `inert`, and
 *   focus, the trap and the scroll lock are already released.
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
