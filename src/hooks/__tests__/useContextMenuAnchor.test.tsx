import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  useContextMenuAnchor,
  type ContextMenuAnchor,
  type ContextOrigin,
  type UseContextMenuAnchorOptions,
} from '../useContextMenuAnchor';
import { useDismiss } from '../useDismiss';
import { Portal } from '../../components/portal/Portal';
import type { VirtualElement } from '../../lib/types';
import { mockRect } from '../../test-utils';

interface Snapshot {
  anchor: ContextMenuAnchor['anchor'];
  fromContext: boolean;
  origin: ContextOrigin | null;
  opener: HTMLElement | null;
  open: boolean;
}

interface HarnessProps {
  onOpen?: UseContextMenuAnchorOptions['onOpen'];
  onClose?: UseContextMenuAnchorOptions['onClose'];
  onSnapshot?: (snapshot: Snapshot) => void;
  enabled?: boolean;
}

/**
 * A region of rows that opens a menu on context gestures. The menu is a real dismiss layer in a
 * portal; "Open from outside" opens it without a gesture (a controlled open).
 */
function ContextHarness({ onOpen, onClose, onSnapshot, enabled = true }: HarnessProps) {
  const [open, setOpen] = React.useState(false);
  const [trigger, setTrigger] = React.useState<HTMLElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({ open, onDismiss: () => setOpen(false), refs: [surfaceRef] });
  const { anchor, fromContext, origin, opener, triggerHandlers, surfaceHandlers } =
    useContextMenuAnchor({
      enabled,
      open,
      trigger,
      layerId,
      onOpen: (gestureOrigin, event) => {
        onOpen?.(gestureOrigin, event);
        setOpen(true);
      },
      onClose: (reason, event) => {
        onClose?.(reason, event);
        setOpen(false);
      },
    });
  React.useLayoutEffect(() => {
    onSnapshot?.({ anchor, fromContext, origin, opener: opener.current, open });
  });
  const [portalHost, setPortalHost] = React.useState<HTMLElement | null>(null);
  return (
    <>
      <div
        ref={setTrigger}
        role="group"
        aria-label="Files"
        tabIndex={0}
        data-testid="region"
        {...triggerHandlers}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button">{`Row ${n}`}</button>
        ))}
        <button type="button" aria-disabled="true">
          Locked row
        </button>
        <button type="button" onContextMenu={(event) => event.preventDefault()}>
          Own menu row
        </button>
        <input aria-label="Rename" />
        {portalHost && createPortal(<button type="button">In a portal</button>, portalHost)}
      </div>
      <div ref={setPortalHost} />
      <button type="button" onClick={() => setOpen(true)}>
        Open from outside
      </button>
      <button type="button">Outside</button>
      {open && (
        <Portal layerId={layerId}>
          <div
            ref={surfaceRef}
            role="menu"
            aria-label="Actions"
            tabIndex={-1}
            data-testid="surface"
            {...surfaceHandlers}
          >
            <div role="menuitem" tabIndex={-1}>
              Rename
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

const row = (n: number) => screen.getByRole('button', { name: `Row ${n}` });
const region = () => screen.getByTestId('region');
const surface = () => screen.queryByTestId('surface');

/** Renders the harness and returns its latest snapshot getter and the spies. */
function setup(props: Omit<HarnessProps, 'onSnapshot' | 'onOpen' | 'onClose'> = {}) {
  let latest: Snapshot | null = null;
  const onOpen = vi.fn<UseContextMenuAnchorOptions['onOpen']>();
  const onClose = vi.fn<UseContextMenuAnchorOptions['onClose']>();
  const utils = render(
    <ContextHarness
      {...props}
      onOpen={onOpen}
      onClose={onClose}
      onSnapshot={(snapshot) => (latest = snapshot)}
    />,
  );
  return { ...utils, onOpen, onClose, snapshot: () => latest! };
}

function rectOf(anchor: ContextMenuAnchor['anchor']) {
  const rect = (anchor as VirtualElement).getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

describe('useContextMenuAnchor', () => {
  let error: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    error = vi.spyOn(console, 'error');
    warn = vi.spyOn(console, 'warn');
  });
  afterEach(() => {
    try {
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });

  describe('pointer gestures', () => {
    it('a right click stores the point, records the focused element and prevents the default', () => {
      const { onOpen, snapshot } = setup();
      act(() => row(3).focus());
      const notPrevented = fireEvent.contextMenu(row(3), { button: 2, clientX: 40, clientY: 60 });
      expect(notPrevented).toBe(false);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0][0]).toBe('pointer');
      expect(onOpen.mock.calls[0][1].type).toBe('contextmenu');
      const { anchor, origin, fromContext, opener } = snapshot();
      expect(origin).toBe('pointer');
      expect(fromContext).toBe(true);
      expect(opener).toBe(row(3));
      expect(rectOf(anchor)).toEqual({ x: 40, y: 60, width: 0, height: 0 });
      expect((anchor as VirtualElement).contextElement).toBe(region());
      expect(surface()).not.toBeNull();
    });

    it('a macOS Ctrl+click (button 0) is a pointer gesture at its point', () => {
      const { onOpen, snapshot } = setup();
      expect(
        fireEvent.contextMenu(row(2), { button: 0, ctrlKey: true, clientX: 15, clientY: 25 }),
      ).toBe(false);
      expect(onOpen).toHaveBeenCalledWith('pointer', expect.any(MouseEvent));
      expect(rectOf(snapshot().anchor)).toEqual({ x: 15, y: 25, width: 0, height: 0 });
    });

    it('a touch long press (the contextmenu after a touch pointerdown) is a pointer gesture', () => {
      const { onOpen, snapshot } = setup();
      fireEvent.pointerDown(row(1), { pointerType: 'touch' });
      fireEvent.contextMenu(row(1), { clientX: 30, clientY: 12 });
      expect(onOpen).toHaveBeenCalledWith('pointer', expect.any(MouseEvent));
      expect(rectOf(snapshot().anchor)).toEqual({ x: 30, y: 12, width: 0, height: 0 });
    });

    it('does not record <body> as the opener', () => {
      const { snapshot } = setup();
      expect(document.activeElement).toBe(document.body);
      fireEvent.contextMenu(row(1), { button: 2, clientX: 1, clientY: 1 });
      expect(snapshot().opener).toBeNull();
    });

    it('a second right click while open moves the point', () => {
      const { onOpen, snapshot } = setup();
      fireEvent.contextMenu(row(1), { button: 2, clientX: 10, clientY: 10 });
      fireEvent.contextMenu(row(4), { button: 2, clientX: 50, clientY: 90 });
      expect(onOpen).toHaveBeenCalledTimes(2);
      expect(rectOf(snapshot().anchor)).toEqual({ x: 50, y: 90, width: 0, height: 0 });
      expect(snapshot().fromContext).toBe(true);
    });
  });

  describe('keyboard gestures', () => {
    it('Shift+F10 opens with keyboard origin, the focused row as anchor and opener', async () => {
      const user = userEvent.setup();
      const { onOpen, snapshot } = setup();
      act(() => row(2).focus());
      await user.keyboard('{Shift>}{F10}{/Shift}');
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0][0]).toBe('keyboard');
      expect(onOpen.mock.calls[0][1].type).toBe('keydown');
      expect(snapshot().anchor).toBe(row(2));
      expect(snapshot().opener).toBe(row(2));
      expect(snapshot().origin).toBe('keyboard');
      expect(snapshot().fromContext).toBe(true);
    });

    it('the ContextMenu key opens too, and prevents its default', () => {
      const { onOpen, snapshot } = setup();
      act(() => row(5).focus());
      expect(fireEvent.keyDown(row(5), { key: 'ContextMenu' })).toBe(false);
      expect(onOpen).toHaveBeenCalledWith('keyboard', expect.any(KeyboardEvent));
      expect(snapshot().anchor).toBe(row(5));
    });

    it('anchors to nothing (the trigger) when the key is pressed on the region itself', () => {
      const { snapshot } = setup();
      act(() => region().focus());
      fireEvent.keyDown(region(), { key: 'F10', shiftKey: true });
      expect(snapshot().anchor).toBeNull();
      expect(snapshot().opener).toBe(region());
    });

    it('ignores the keys with Ctrl, Alt or Meta, and F10 without Shift', () => {
      const { onOpen } = setup();
      fireEvent.keyDown(row(1), { key: 'F10' });
      fireEvent.keyDown(row(1), { key: 'F10', shiftKey: true, ctrlKey: true });
      fireEvent.keyDown(row(1), { key: 'ContextMenu', altKey: true });
      fireEvent.keyDown(row(1), { key: 'ContextMenu', metaKey: true });
      expect(onOpen).not.toHaveBeenCalled();
    });

    it.each([
      ['without coordinates', {}],
      ['with coordinates', { clientX: 400, clientY: 300 }],
    ])('the contextmenu that follows the key press (%s) keeps the keyboard anchor', (_, coords) => {
      const { onOpen, snapshot } = setup();
      act(() => row(2).focus());
      fireEvent.keyDown(row(2), { key: 'F10', shiftKey: true });
      expect(fireEvent.contextMenu(row(2), { button: 0, ...coords })).toBe(false);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(snapshot().anchor).toBe(row(2));
      expect(snapshot().origin).toBe('keyboard');
    });

    it('a pointerdown clears the keyboard flag: the next contextmenu is a pointer gesture', () => {
      const { onOpen, snapshot } = setup();
      act(() => row(2).focus());
      fireEvent.keyDown(row(2), { key: 'ContextMenu' });
      fireEvent.pointerDown(row(4), { button: 2 });
      fireEvent.contextMenu(row(4), { button: 2, clientX: 70, clientY: 80 });
      expect(onOpen.mock.calls.map(([origin]) => origin)).toEqual(['keyboard', 'pointer']);
      expect(rectOf(snapshot().anchor)).toEqual({ x: 70, y: 80, width: 0, height: 0 });
    });

    it('another key clears the keyboard flag too', () => {
      const { onOpen } = setup();
      act(() => row(2).focus());
      fireEvent.keyDown(row(2), { key: 'ContextMenu' });
      fireEvent.keyDown(row(2), { key: 'ArrowDown' });
      fireEvent.contextMenu(row(3), { button: 2, clientX: 5, clientY: 5 });
      expect(onOpen.mock.calls.map(([origin]) => origin)).toEqual(['keyboard', 'pointer']);
    });

    it('closing the surface clears the keyboard flag', () => {
      const { onOpen } = setup();
      mockRect(row(2), { x: 0, y: 20, width: 100, height: 20 });
      act(() => row(2).focus());
      fireEvent.keyDown(row(2), { key: 'ContextMenu' });
      expect(surface()).not.toBeNull();
      // A close that involves no key and no pointer: a scroll that moved the row.
      mockRect(row(2), { x: 0, y: 60, width: 100, height: 20 });
      fireEvent.scroll(document);
      expect(surface()).toBeNull();
      fireEvent.contextMenu(row(3), { button: 2, clientX: 5, clientY: 5 });
      expect(onOpen.mock.calls.map(([origin]) => origin)).toEqual(['keyboard', 'pointer']);
    });
  });

  describe('events that keep the browser menu or are not the region’s', () => {
    it('ignores an aria-disabled element, a default-prevented event and a portal inside the region', () => {
      const { onOpen } = setup();
      const locked = screen.getByRole('button', { name: 'Locked row' });
      expect(fireEvent.contextMenu(locked, { button: 2 })).toBe(true);
      fireEvent.keyDown(locked, { key: 'ContextMenu' });
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Own menu row' }), { button: 2 });
      expect(
        fireEvent.contextMenu(screen.getByRole('button', { name: 'In a portal' }), { button: 2 }),
      ).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('leaves an editable field its browser menu: nothing opens and nothing is prevented', () => {
      const { onOpen } = setup();
      const input = screen.getByRole('textbox', { name: 'Rename' });
      expect(fireEvent.contextMenu(input, { button: 2 })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'F10', shiftKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'ContextMenu' })).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('does nothing while disabled (enabled: false)', () => {
      const { onOpen } = setup({ enabled: false });
      expect(fireEvent.contextMenu(row(1), { button: 2 })).toBe(true);
      expect(fireEvent.keyDown(row(1), { key: 'ContextMenu' })).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('prevents the browser’s context menu inside the surface', () => {
      setup();
      fireEvent.contextMenu(row(1), { button: 2 });
      expect(fireEvent.contextMenu(screen.getByRole('menuitem'), { button: 2 })).toBe(false);
    });

    it('prevents it inside a surface opened from outside too, while enabled', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Open from outside' }));
      expect(fireEvent.contextMenu(screen.getByRole('menuitem'), { button: 2 })).toBe(false);
    });

    it('leaves the browser’s context menu inside the surface while disabled (enabled: false)', () => {
      const { onOpen, onClose } = setup({ enabled: false });
      fireEvent.click(screen.getByRole('button', { name: 'Open from outside' }));
      expect(surface()).not.toBeNull();
      expect(fireEvent.contextMenu(screen.getByRole('menuitem'), { button: 2 })).toBe(true);
      expect(fireEvent.contextMenu(surface()!, { button: 2 })).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('follows a change of enabled while the surface is open', () => {
      const { rerender } = render(<ContextHarness enabled={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open from outside' }));
      expect(fireEvent.contextMenu(screen.getByRole('menuitem'), { button: 2 })).toBe(true);
      rerender(<ContextHarness enabled />);
      expect(fireEvent.contextMenu(screen.getByRole('menuitem'), { button: 2 })).toBe(false);
      rerender(<ContextHarness enabled={false} />);
      expect(fireEvent.contextMenu(screen.getByRole('menuitem'), { button: 2 })).toBe(true);
    });
  });

  describe('closing a context-opened surface', () => {
    it('a right click outside closes it without preventing its default', () => {
      const { onClose } = setup();
      fireEvent.contextMenu(row(1), { button: 2, clientX: 5, clientY: 5 });
      expect(
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Outside' }), { button: 2 }),
      ).toBe(true);
      expect(onClose).toHaveBeenCalledWith('outside-context-menu', expect.any(MouseEvent));
      expect(surface()).toBeNull();
    });

    it('a scroll outside that moves the region more than 2 px closes it', () => {
      const { onClose } = setup();
      mockRect(region(), { x: 0, y: 100, width: 300, height: 200 });
      fireEvent.contextMenu(row(1), { button: 2, clientX: 5, clientY: 105 });

      // Not moved, then 2 px: stays open.
      fireEvent.scroll(document);
      mockRect(region(), { x: 0, y: 98, width: 300, height: 200 });
      fireEvent.scroll(document);
      expect(onClose).not.toHaveBeenCalled();
      // Moved 3 px: closes.
      mockRect(region(), { x: 0, y: 97, width: 300, height: 200 });
      fireEvent.scroll(document);
      expect(onClose).toHaveBeenCalledWith('scroll', expect.any(Event));
      expect(surface()).toBeNull();
    });

    it('a scroll inside the surface does not close it, even when the region moved', () => {
      const { onClose } = setup();
      mockRect(region(), { x: 0, y: 100, width: 300, height: 200 });
      fireEvent.contextMenu(row(1), { button: 2, clientX: 5, clientY: 105 });
      mockRect(region(), { x: 0, y: 50, width: 300, height: 200 });
      fireEvent.scroll(surface()!);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('measures a keyboard gesture against the focused row', () => {
      const { onClose } = setup();
      mockRect(region(), { x: 0, y: 100, width: 300, height: 200 });
      mockRect(row(2), { x: 0, y: 120, width: 300, height: 20 });
      act(() => row(2).focus());
      fireEvent.keyDown(row(2), { key: 'ContextMenu' });
      // The region moves, the row does not (it scrolled inside the region): stays open.
      mockRect(region(), { x: 0, y: 60, width: 300, height: 200 });
      fireEvent.scroll(document);
      expect(onClose).not.toHaveBeenCalled();
      mockRect(row(2), { x: 0, y: 140, width: 300, height: 20 });
      fireEvent.scroll(document);
      expect(onClose).toHaveBeenCalledWith('scroll', expect.any(Event));
    });

    it('listens to outside context menus and scrolls only while opened by a gesture', () => {
      const { onClose } = setup();
      fireEvent.click(screen.getByRole('button', { name: 'Open from outside' }));
      expect(surface()).not.toBeNull();
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Outside' }), { button: 2 });
      mockRect(region(), { x: 0, y: 500, width: 300, height: 200 });
      fireEvent.scroll(document);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('fromContext and the kept anchor', () => {
    it('is false for an open from outside, and becomes true with a gesture while open', () => {
      const { snapshot } = setup();
      fireEvent.click(screen.getByRole('button', { name: 'Open from outside' }));
      expect(snapshot().open).toBe(true);
      expect(snapshot().fromContext).toBe(false);
      fireEvent.contextMenu(row(1), { button: 2, clientX: 5, clientY: 5 });
      expect(snapshot().fromContext).toBe(true);
    });

    it('keeps the anchor, origin and fromContext after the close, until the next gesture', async () => {
      const user = userEvent.setup();
      const { snapshot } = setup();
      fireEvent.contextMenu(row(1), { button: 2, clientX: 5, clientY: 6 });
      const anchor = snapshot().anchor;
      await user.keyboard('{Escape}');
      expect(snapshot().open).toBe(false);
      expect(snapshot().anchor).toBe(anchor);
      expect(snapshot().origin).toBe('pointer');
      expect(snapshot().fromContext).toBe(true);

      act(() => row(3).focus());
      fireEvent.keyDown(row(3), { key: 'ContextMenu' });
      expect(snapshot().anchor).toBe(row(3));
      expect(snapshot().origin).toBe('keyboard');
    });

    it('a controlled open after a context-opened one is not from context', async () => {
      const user = userEvent.setup();
      const { snapshot } = setup();
      fireEvent.contextMenu(row(1), { button: 2, clientX: 5, clientY: 6 });
      await user.keyboard('{Escape}');
      fireEvent.click(screen.getByRole('button', { name: 'Open from outside' }));
      expect(snapshot().open).toBe(true);
      expect(snapshot().fromContext).toBe(false);
    });
  });

  it('calls onOpen once per gesture under StrictMode', () => {
    const onOpen = vi.fn();
    render(
      <React.StrictMode>
        <ContextHarness onOpen={onOpen} />
      </React.StrictMode>,
    );
    fireEvent.contextMenu(row(1), { button: 2 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('leaves no document listener behind after unmount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    try {
      const { unmount } = setup();
      act(() => row(2).focus());
      // The keyboard flag's listeners and the open surface's outside listeners.
      fireEvent.keyDown(row(2), { key: 'ContextMenu' });
      const added = add.mock.calls.map(([type, listener]) => [type, listener]);
      expect(added.map(([type]) => type)).toEqual(
        expect.arrayContaining(['pointerdown', 'keydown', 'contextmenu', 'scroll']),
      );
      unmount();
      const removed = remove.mock.calls.map(([type, listener]) => [type, listener]);
      const left = added.filter(
        ([type, listener]) => !removed.some(([t, l]) => t === type && l === listener),
      );
      expect(left).toEqual([]);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it('has the documented types', () => {
    expectTypeOf<ContextOrigin>().toEqualTypeOf<'pointer' | 'keyboard'>();
    expectTypeOf<ContextMenuAnchor['anchor']>().toEqualTypeOf<
      HTMLElement | VirtualElement | null
    >();
    expectTypeOf<ContextMenuAnchor['opener']>().toEqualTypeOf<
      React.RefObject<HTMLElement | null>
    >();
    expectTypeOf<UseContextMenuAnchorOptions['onClose']>().toEqualTypeOf<
      (reason: 'outside-context-menu' | 'scroll', event: Event) => void
    >();
  });
});
