import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getFirstTabbable } from '../../lib/focus';
import { InfoIcon } from '../../lib/icons';
import { getLayerTreeElements } from '../../lib/layers';
import { focusRing } from '../../lib/styles';
import type { CoreSize } from '../../lib/types';
import { useDismiss } from '../../hooks/useDismiss';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useHoverIntent } from '../../hooks/useHoverIntent';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { usePresence } from '../../hooks/usePresence';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { PopoverBeak, usePopoverTabOrder } from '../overlays/Popover.shared';
import { Portal } from '../portal/Portal';

/** Properties for the InfoButton component. */
export interface InfoButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /**
   * The information the note shows: text, links or other content. It also describes the button
   * (`aria-describedby`), from the server HTML on. It is rendered once: next to the button, not
   * displayed, while the note is closed, and inside the note while it is shown.
   */
  info: React.ReactNode;
  /**
   * Size of the glyph: 12, 16 or 20px. The button box stays 24×24px at every size, with negative
   * margins above and below, so it never makes a row that centres its items (as InfoLabel does)
   * taller.
   * @default 'medium'
   */
  size?: CoreSize;
  /**
   * Open the note when a mouse pointer rests on the button (after 250 ms; it closes 250 ms after
   * the pointer has left the button and the note, touch and pen never hover), and when the button
   * receives keyboard focus. `false` opens it only on a click, and so on Enter and Space (Fluent's
   * InfoButton opens on click only). A click always toggles the note: it pins a note that hover or
   * keyboard focus opened, and closes a pinned one.
   * @default true
   */
  openOnHover?: boolean;
  /**
   * Accessible name of the button, and of the note, which is labelled like the button. Localize it
   * here. With `aria-labelledby` listing the id of your text and the button's own `id`, the name is
   * your text followed by this one ("Billing Information").
   * @default 'Information'
   */
  'aria-label'?: string;
  /** Ref to the button. */
  ref?: React.Ref<HTMLButtonElement>;
}

/** Why the note is open: a click pins it; keyboard focus owns it; hover opens it transiently. */
type OpenReason = 'hover' | 'focus' | 'click';

/**
 * Glyph size and negative margins per size: the 24px box never makes a row that centres its items
 * taller.
 */
const GLYPH: Readonly<Record<CoreSize, { size: number; margin: string }>> = {
  small: { size: 12, margin: '-my-1' },
  medium: { size: 16, margin: '-my-0.5' },
  large: { size: 20, margin: '-my-px' },
};

/**
 * Milliseconds from a mouse pointer resting on the button to the opening, and from the pointer
 * leaving the button and the note to the hover close (the 0.7 InfoLabel delays).
 */
const HOVER_DELAY = 250;

/**
 * Whether focus is inside the note or in a layer opened from it (a popover of its content, whose
 * portal lives elsewhere): what keeps a hover-opened note open (Phase 2 D18). Focus on the button
 * does not count, although the button belongs to the dismiss layer.
 */
function isFocusInsideNote(note: HTMLElement | null, layerId: string): boolean {
  const active = note?.ownerDocument.activeElement;
  if (!note || !active) return false;
  if (note.contains(active)) return true;
  return getLayerTreeElements(layerId, { includeOwnElements: false }).some((el) =>
    el.contains(active),
  );
}

/**
 * A button with the info glyph that shows `info` in a note next to it: text, links or other rich
 * content, placed above the button with a beak (a toggletip).
 *
 * - **Naming.** The button is named "Information" (`aria-label`, which localizes it). Next to a
 *   heading or other text, pass `aria-labelledby` with that text's id and the button's own `id`:
 *   the button is then named "‹text› Information", so several info buttons on a page are told
 *   apart. The note (`role="note"`) is labelled like the button: by the same `aria-labelledby`
 *   ids, else by the button. The button has `aria-expanded`, and `aria-controls` while the note is
 *   open, but no `aria-haspopup`: a note is none of the popup kinds it names.
 * - **Opening.** A click pins the note open, and a click on a pinned note closes it. With
 *   `openOnHover` (the default) a mouse pointer resting on the button opens it after 250 ms, and
 *   it closes 250 ms after the pointer has left the button and the note (a pointer moving
 *   diagonally from the button into the note keeps it open; touch and pen never hover); keyboard
 *   focus on the button opens it too, while focus that comes from a pointer press waits for the
 *   click. A hover close moves no focus, and a note that keyboard focus opened or keeps never
 *   closes because of pointer movement. Opening never moves focus into the note. Escape, a press
 *   outside and focus moving outside the button and the note close it; Escape returns focus to
 *   the button when it was in the note, and a dismissed note opens again on keyboard focus only
 *   once focus has left both.
 * - **Tab path.** The note is portaled, but it keeps its place right after the button in the
 *   keyboard order: Tab from the open button enters the note's first element (a link in it), Tab
 *   past its last element continues after the button, and Shift+Tab from its first element
 *   returns to the button.
 * - **One copy of `info`.** While the note is closed, `info` renders next to the button in an
 *   element that is not displayed and describes the button (`aria-describedby`), so it is in the
 *   server HTML and is read when the button takes focus. While the note is shown, `info` renders
 *   only inside it, in an unnamed element that describes the button. `info` is never in the
 *   document twice, so content with ids or effects is safe; it remounts each time the note opens
 *   and closes, so state inside it starts over and its effects run again.
 * - **Structure.** The button is the root element: `ref`, `className`, `style` and every other
 *   attribute go to it, the consumer's handlers first. The description and the note render next
 *   to it, never inside it. Its box is 24×24px at every `size` and renders `data-size`. The note
 *   mounts through the presence core: it carries `data-presence`, `data-state` (`open`, and
 *   `closed` while it exits, `inert`) and the `data-wave-infolabel-surface` marker; it ships no
 *   motion of its own.
 *
 * Fluent's InfoButton takes the same `info` and `size`. It opens on click only
 * (`openOnHover={false}` here), renders its note in place, and moves focus into the note; this one
 * keeps focus on the button and renders the note in a portal. Fluent's `popover` props and a
 * controlled open state are not offered.
 *
 * @example
 * <h2 id="billing">Billing</h2>
 * <InfoButton
 *   id="billing-info"
 *   aria-labelledby="billing billing-info"
 *   info={<>Invoices are sent monthly. <a href="/help/billing">Learn more</a></>}
 * />
 */
export const InfoButton = ({
  info,
  size: sizeProp,
  openOnHover = true,
  id: idProp,
  type = 'button',
  'aria-label': ariaLabelProp,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  className,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
  onPointerDown,
  onMouseDown,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  ref,
  ...rest
}: InfoButtonProps) => {
  // A size from untyped code renders, and reports, the default.
  const size: CoreSize = sizeProp === 'small' || sizeProp === 'large' ? sizeProp : 'medium';
  const generatedId = useId('info-button');
  const id = idProp || generatedId;
  // An empty name would leave the button and the note unnamed: the glyph is decorative.
  const ariaLabel = ariaLabelProp || 'Information';
  const noteId = useId('info-note');
  // The one copy of `info`: not displayed while the note is closed, inside the note while shown.
  const infoId = useId('info');
  const [reason, setReason] = React.useState<OpenReason | null>(null);
  const open = reason !== null;

  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const noteRef = React.useRef<HTMLDivElement | null>(null);
  const arrowRef = React.useRef<HTMLDivElement | null>(null);
  // The button and the note held in state too (C-POPUPS): for the hover intent (the safe zone
  // measures both) and the focus restore.
  const [buttonElement, setButtonElement] = React.useState<HTMLButtonElement | null>(null);
  const [note, setNote] = React.useState<HTMLDivElement | null>(null);

  // The latest reason, for the hover close (read in the hover intent's pointer events and timers).
  const reasonRef = React.useRef(reason);
  React.useLayoutEffect(() => {
    reasonRef.current = reason;
  });
  // Set by a dismissal (Escape, outside press): keyboard focus reopens only after focus has left
  // both the button and the note (a focus restore must not reopen it). A click that closes the
  // note sets it too: in Safari a click leaves focus on <body>, and the focus restore follows. It
  // blocks only a reopening: keyboard focus still takes over a note that a click or hover opened.
  const dismissedRef = React.useRef(false);
  // A pointer press focuses the button; that focus waits for the click (0.7).
  const pointerPressRef = React.useRef(false);
  const pressTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A hover close in flight, set before its request: that close moves no focus. Every other close
  // request and every opening clears it.
  const hoverCloseRef = React.useRef(false);

  // The note mounts and unmounts through the presence core; the dismiss layer, the focus restore
  // and the positioning below key on `open`, so they go on close, not after an exit motion.
  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const { isMounted, ref: presenceRef, presenceProps } = usePresence(open);
  const { setReference, setFloating, floatingProps, arrowStyles, side } = usePopupPosition({
    open,
    side: 'top',
    align: 'center',
    offset: 8,
    arrowRef,
  });
  const { layerId } = useDismiss({
    open,
    onDismiss: (dismissReason) => {
      // Only a focusin elsewhere dismisses with 'focus-outside' (focus lost to <body> never does):
      // focus has left both then, so keyboard focus may reopen the note at once.
      if (dismissReason !== 'focus-outside') dismissedRef.current = true;
      hoverCloseRef.current = false;
      cancelHover();
      setReason(null);
    },
    refs: [buttonRef, noteRef],
    anchorRef: buttonRef,
    focusOutside: true,
  });
  // Focus returns to the button when the note closes with focus inside it (or lost to <body>); a
  // hover close returns only focus that is inside it, so it never moves focus.
  useRestoreFocus({
    enabled: open,
    container: note,
    triggerRef: buttonRef,
    onlyIfFocusInside: true,
    isHoverClose: () => hoverCloseRef.current,
  });

  const {
    triggerHandlers: hoverTriggerHandlers,
    surfaceHandlers: hoverSurfaceHandlers,
    cancel: cancelHover,
  } = useHoverIntent({
    enabled: openOnHover,
    open,
    openDelay: HOVER_DELAY,
    closeDelay: HOVER_DELAY,
    trigger: buttonElement,
    surface: note,
    onOpen: () => {
      hoverCloseRef.current = false;
      setReason((current) => current ?? 'hover');
    },
    onClose: () => {
      hoverCloseRef.current = true;
      setReason((current) => (current === 'hover' ? null : current));
    },
    // Only a note opened by hover, not pinned and not keyboard-owned, closes by hover; focus
    // inside the note (or a layer opened from it) blocks it too (Phase 2 D18).
    canClose: () => reasonRef.current === 'hover' && !isFocusInsideNote(note, layerId),
  });

  React.useEffect(() => () => clearTimeout(pressTimerRef.current), []);

  // A dismissal ends once focus has left both the button and the note: at the button's blur
  // (below) and at a focusout of the note. Focus the note loses to nothing is the note closing
  // (removed, or inert while it exits): that ends nothing.
  React.useEffect(() => {
    if (!note) return undefined;
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (!next || note.contains(next) || buttonRef.current?.contains(next)) return;
      dismissedRef.current = false;
    };
    note.addEventListener('focusout', onFocusOut);
    return () => note.removeEventListener('focusout', onFocusOut);
  }, [note]);

  // The handlers below read and write refs: useEventCallback keeps them out of render (C-HOOKS).
  const handleClick = useEventCallback(() => {
    cancelHover();
    hoverCloseRef.current = false;
    // Closed, or opened by hover or keyboard focus: pinned. Pinned: closed.
    const closing = reason === 'click';
    if (closing) dismissedRef.current = true;
    setReason(closing ? null : 'click');
  });

  const handleFocus = useEventCallback(() => {
    // Keyboard focus opens, as hovering's keyboard counterpart.
    if (!openOnHover || pointerPressRef.current || (dismissedRef.current && !open)) return;
    hoverCloseRef.current = false;
    cancelHover();
    // A note that hover opened becomes focus-owned; a pinned one stays pinned.
    setReason((current) => (current === 'click' ? current : 'focus'));
  });

  const handleBlur = useEventCallback((event: React.FocusEvent<HTMLButtonElement>) => {
    // Tab from the button into the note keeps a dismissal; focus lost to nothing (a press on a
    // spot that takes no focus) has left both.
    const next = event.relatedTarget as Node | null;
    if (next && note?.contains(next)) return;
    dismissedRef.current = false;
  });

  const handlePointerPress = useEventCallback(() => {
    pointerPressRef.current = true;
    // A press focuses the button (where it does) as the default action of `mousedown`, in the same
    // event turn. Forget the press after that turn: a press that does not focus the button (Safari
    // and Firefox on macOS, iOS) and ends without a click (dragged off, or a touch that becomes a
    // scroll) must not turn a later keyboard focus into pointer focus. A touch tap dispatches its
    // compatibility `mousedown` (and the focus) after the touch ends; that `mousedown` sets the
    // flag again.
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = undefined;
      pointerPressRef.current = false;
    }, 0);
  });

  // Tab from the open button enters the note. The button's own handler runs before a modal focus
  // trap's document listener, which would wrap the Tab when the button is the trap's last element.
  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Tab' || event.shiftKey || !open || !note) return;
    const first = getFirstTabbable(note);
    if (!first) return;
    event.preventDefault();
    first.focus();
  };
  // Tab past the note's last element continues after the button, Shift+Tab from its first element
  // returns to it, and the page order skips the note where its portal is.
  const onNoteKeyDown = usePopoverTabOrder({
    enabled: open,
    surface: note,
    anchorRef: buttonRef,
    getPreviousStop: () => buttonRef.current,
  });

  const buttonRefs = useMergedRefs<HTMLButtonElement>(
    ref,
    buttonRef,
    setButtonElement,
    setReference,
  );
  const noteRefs = useMergedRefs<HTMLDivElement>(noteRef, setNote, setFloating, presenceRef);

  return (
    <>
      <button
        type={type}
        id={id}
        data-size={size}
        {...rest}
        ref={buttonRefs}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={joinIds(ariaDescribedBy, infoId)}
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground',
          GLYPH[size].margin,
          'not-disabled:not-aria-disabled:hover:text-foreground',
          focusRing,
          className,
        )}
        onClick={composeEventHandlers(onClick, handleClick)}
        onFocus={composeEventHandlers(onFocus, handleFocus)}
        onKeyDown={composeEventHandlers(onKeyDown, onButtonKeyDown)}
        onPointerEnter={composeEventHandlers(onPointerEnter, hoverTriggerHandlers.onPointerEnter)}
        onPointerMove={composeEventHandlers(onPointerMove, hoverTriggerHandlers.onPointerMove)}
        onPointerLeave={composeEventHandlers(onPointerLeave, hoverTriggerHandlers.onPointerLeave)}
        // Bookkeeping that follows the DOM (where focus went, whether a press is under way): it
        // runs even when the consumer prevents the default.
        onBlur={composeEventHandlers(onBlur, handleBlur, { checkDefaultPrevented: false })}
        onPointerDown={composeEventHandlers(onPointerDown, handlePointerPress, {
          checkDefaultPrevented: false,
        })}
        onMouseDown={composeEventHandlers(onMouseDown, handlePointerPress, {
          checkDefaultPrevented: false,
        })}
      >
        <InfoIcon size={GLYPH[size].size} />
      </button>
      {/* The same element follows the button in every phase, so a row styled by position never
          shifts: it holds `info` while the note is not mounted, and nothing while the note does. */}
      <span id={isMounted ? undefined : infoId} hidden>
        {isMounted ? null : info}
      </span>
      {isMounted && (
        <Portal layerId={layerId}>
          <div
            ref={noteRefs}
            id={noteId}
            role="note"
            aria-labelledby={ariaLabelledBy || id}
            data-wave-infolabel-surface=""
            data-state={open ? 'open' : 'closed'}
            {...presenceProps}
            {...floatingProps}
            onKeyDown={onNoteKeyDown}
            onPointerEnter={hoverSurfaceHandlers.onPointerEnter}
            onPointerLeave={hoverSurfaceHandlers.onPointerLeave}
            className="w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-md border border-border bg-background px-3 py-2 text-caption-1 text-foreground shadow-16"
          >
            <PopoverBeak
              ref={arrowRef}
              side={side}
              style={arrowStyles}
              data-wave-popover-arrow=""
            />
            <div id={infoId}>{info}</div>
          </div>
        </Portal>
      )}
    </>
  );
};
InfoButton.displayName = 'InfoButton';
