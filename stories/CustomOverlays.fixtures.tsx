import * as React from 'react';
import {
  Portal,
  modalAllowProps,
  useDismiss,
  useMergedRefs,
  useModalLayer,
  usePopupPosition,
  useRestoreFocus,
} from '../src';

// Custom overlays built only on WaveUI's public overlay hooks. They behave like the built-in
// surfaces: Escape closes the topmost layer first, a press in the Toaster or in a region marked
// with `modalAllowProps` closes nothing, and focus returns to the opener.

/** Props of {@link CommandPalette}. */
export interface CommandPaletteProps {
  /** Whether the palette is open. */
  open: boolean;
  /** Called with `false` when the palette asks to close (Escape, a press outside). */
  onOpenChange: (open: boolean) => void;
  /** The element that opened the palette: focus returns to it. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Accessible name of the palette. @default 'Command palette' */
  label?: string;
}

/** A modal command palette: the page behind it is inert and Tab stays inside it. */
export function CommandPalette({
  open,
  onOpenChange,
  triggerRef,
  label = 'Command palette',
}: CommandPaletteProps) {
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(surfaceRef, setSurface);
  const { layerId } = useModalLayer({
    open,
    container: surface,
    onDismiss: () => onOpenChange(false),
    refs: [surfaceRef],
    triggerRef,
  });
  if (!open) return null;
  return (
    <Portal layerId={layerId}>
      <div
        ref={mergedRef}
        role="dialog"
        aria-label={label}
        className="fixed top-24 left-1/2 w-96 -translate-x-1/2 rounded-lg border border-border bg-background p-4 text-foreground shadow-16"
      >
        <input
          aria-label="Search commands"
          className="w-full rounded-md border border-border bg-background px-2 py-1"
        />
        <ul className="mt-2">
          <li>
            <button type="button" className="w-full text-start">
              Open file
            </button>
          </li>
          <li>
            <button type="button" className="w-full text-start">
              Save all
            </button>
          </li>
        </ul>
      </div>
    </Portal>
  );
}
CommandPalette.displayName = 'CommandPalette';

/** Props of {@link CustomPopup}. */
export interface CustomPopupProps {
  /** Accessible name of the popup and its toggle button. @default 'Details' */
  label?: string;
  /** Content of the popup: another WaveUI Popover opened inside it becomes its child layer. */
  children?: React.ReactNode;
}

/** A non-modal popup placed against its toggle button, on the positioning and dismiss hooks. */
export function CustomPopup({ label = 'Details', children }: CustomPopupProps) {
  const [open, setOpen] = React.useState(false);
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const { setReference, setFloating, floatingProps } = usePopupPosition({ open, side: 'bottom' });
  const { layerId } = useDismiss({
    open,
    onDismiss: () => setOpen(false),
    refs: [triggerRef, surfaceRef],
    anchorRef: triggerRef,
  });
  useRestoreFocus({ enabled: open, container: surface, triggerRef });
  const triggerMergedRef = useMergedRefs<HTMLButtonElement>(triggerRef, setReference);
  const surfaceMergedRef = useMergedRefs<HTMLDivElement>(surfaceRef, setSurface, setFloating);
  return (
    <>
      <button
        type="button"
        ref={triggerMergedRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open && (
        <Portal layerId={layerId}>
          <div
            ref={surfaceMergedRef}
            role="dialog"
            aria-label={label}
            {...floatingProps}
            className="rounded-lg border border-border bg-background p-3 text-foreground shadow-8"
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}
CustomPopup.displayName = 'CustomPopup';

/** An app-owned status region that a modal Dialog, Drawer or palette leaves usable. */
export function AppStatusRegion() {
  return (
    <Portal layer="toast">
      <div
        {...modalAllowProps}
        role="region"
        aria-label="App status"
        className="fixed end-4 bottom-4 rounded-lg border border-border bg-background p-3 text-foreground shadow-8"
      >
        <span>Offline</span> <button type="button">Retry</button>
      </div>
    </Portal>
  );
}
AppStatusRegion.displayName = 'AppStatusRegion';
