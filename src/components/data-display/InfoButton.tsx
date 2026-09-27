import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { InfoIcon } from '../../lib/icons';
import { focusRing } from '../../lib/styles';
import type { CoreSize } from '../../lib/types';
import { useDismiss } from '../../hooks/useDismiss';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { usePresence } from '../../hooks/usePresence';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { PopoverBeak } from '../overlays/Popover.shared';
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
   * margins above and below, so it never makes the line it sits in taller.
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

/** Glyph size and negative margins per size: the 24px box never makes its line taller. */
const GLYPH: Readonly<Record<CoreSize, { size: number; margin: string }>> = {
  small: { size: 12, margin: '-my-1' },
  medium: { size: 16, margin: '-my-0.5' },
  large: { size: 20, margin: '-my-px' },
};

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
 *   closes because of pointer movement. Opening never moves focus: it stays on the button. Escape,
 *   a press outside and focus moving outside the button and the note close it; Escape returns
 *   focus to the button when it was in the note, and a dismissed note opens again on keyboard
 *   focus only once focus has left both.
 * - **Tab path.** The note is portaled, but it keeps its place right after the button in the
 *   keyboard order: Tab from the open button enters the note's first element (a link in it), Tab
 *   past its last element continues after the button, and Shift+Tab from its first element
 *   returns to the button.
 * - **One copy of `info`.** While the note is closed, `info` renders next to the button in an
 *   element that is not displayed and describes the button (`aria-describedby`), so it is in the
 *   server HTML and is read when the button takes focus. While the note is shown, `info` renders
 *   only inside it, in an unnamed element that describes the button. `info` is never in the
 *   document twice, so content with ids or effects is safe.
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
  openOnHover,
  id: idProp,
  type = 'button',
  'aria-label': ariaLabel = 'Information',
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  className,
  onClick,
  ref,
  ...rest
}: InfoButtonProps) => {
  // A size from untyped code renders, and reports, the default.
  const size: CoreSize = sizeProp === 'small' || sizeProp === 'large' ? sizeProp : 'medium';
  const generatedId = useId('info-button');
  const id = idProp || generatedId;
  const noteId = useId('info-note');
  // The one copy of `info`: not displayed while the note is closed, inside the note while shown.
  const infoId = useId('info');
  const [reason, setReason] = React.useState<OpenReason | null>(null);
  const open = reason !== null;

  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const noteRef = React.useRef<HTMLDivElement | null>(null);
  const arrowRef = React.useRef<HTMLDivElement | null>(null);
  // The note held in state too (C-POPUPS), for the focus restore.
  const [note, setNote] = React.useState<HTMLDivElement | null>(null);

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
    onDismiss: () => setReason(null),
    refs: [buttonRef, noteRef],
    anchorRef: buttonRef,
    focusOutside: true,
  });
  // Focus returns to the button when the note closes with focus inside it.
  useRestoreFocus({
    enabled: open,
    container: note,
    triggerRef: buttonRef,
    onlyIfFocusInside: true,
  });

  const buttonRefs = useMergedRefs<HTMLButtonElement>(ref, buttonRef, setReference);
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
        // Closed, or opened by hover or keyboard focus: pinned. Pinned: closed.
        onClick={composeEventHandlers(onClick, () =>
          setReason((current) => (current === 'click' ? null : 'click')),
        )}
      >
        <InfoIcon size={GLYPH[size].size} />
      </button>
      {isMounted ? null : (
        <span id={infoId} hidden>
          {info}
        </span>
      )}
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
