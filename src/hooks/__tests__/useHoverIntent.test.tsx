import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import * as React from 'react';
import {
  createHoverIntentGroup,
  useHoverIntent,
  type HoverIntent,
  type HoverIntentGroup,
  type UseHoverIntentOptions,
} from '../useHoverIntent';
import { mockRect } from '../../test-utils';

interface HarnessApi {
  cancel: HoverIntent['cancel'];
  startClose: HoverIntent['startClose'];
  setOpen: (open: boolean) => void;
}

interface HarnessProps {
  name: string;
  openDelay?: number;
  closeDelay?: number;
  canClose?: () => boolean;
  group?: HoverIntentGroup;
  enabled?: boolean;
  /** Marks the trigger `aria-disabled`. */
  disabled?: boolean;
  /** Puts an `aria-disabled` element inside the trigger instead. */
  disabledInside?: boolean;
  /** The trigger's `key`: a new one renders the trigger as a new DOM node. */
  triggerKey?: string;
  onOpen?: UseHoverIntentOptions['onOpen'];
  onClose?: UseHoverIntentOptions['onClose'];
  apiRef?: React.RefObject<HarnessApi | null>;
}

/** A trigger and the surface it opens, with the hook's handlers composed on both. */
function HoverHarness({
  name,
  openDelay = 250,
  closeDelay = 250,
  canClose = () => true,
  group,
  enabled = true,
  disabled = false,
  disabledInside = false,
  triggerKey,
  onOpen,
  onClose,
  apiRef,
}: HarnessProps) {
  const [open, setOpen] = React.useState(false);
  const [trigger, setTrigger] = React.useState<HTMLElement | null>(null);
  const [surface, setSurface] = React.useState<HTMLElement | null>(null);
  const { triggerHandlers, surfaceHandlers, cancel, startClose } = useHoverIntent({
    enabled,
    open,
    openDelay,
    closeDelay,
    trigger,
    surface,
    group,
    canClose,
    onOpen: (event) => {
      onOpen?.(event);
      setOpen(true);
    },
    onClose: (event) => {
      onClose?.(event);
      setOpen(false);
    },
  });
  React.useLayoutEffect(() => {
    if (apiRef) apiRef.current = { cancel, startClose, setOpen };
  }, [apiRef, cancel, startClose]);
  return (
    <>
      <div
        key={triggerKey}
        ref={setTrigger}
        data-testid={`${name}-trigger`}
        aria-disabled={disabled || undefined}
        {...triggerHandlers}
      >
        {disabledInside ? (
          <button type="button" aria-disabled="true">
            {name}
          </button>
        ) : (
          name
        )}
      </div>
      {open && (
        <div ref={setSurface} data-testid={`${name}-surface`} {...surfaceHandlers}>
          <button type="button">{`${name} action`}</button>
        </div>
      )}
    </>
  );
}

const triggerOf = (name: string) => screen.getByTestId(`${name}-trigger`);
const surfaceOf = (name: string) => screen.queryByTestId(`${name}-surface`);

/** Advances the fake clock inside act() (timers set state). */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useHoverIntent', () => {
  let user: UserEvent;
  let error: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    error = vi.spyOn(console, 'error');
    warn = vi.spyOn(console, 'warn');
  });
  afterEach(() => {
    vi.useRealTimers();
    try {
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });

  /** Opens `name` by hover and gives trigger and surface their boxes. */
  async function hoverOpen(
    name: string,
    triggerBox: Partial<DOMRect>,
    surfaceBox: Partial<DOMRect>,
    at: { clientX: number; clientY: number },
  ) {
    mockRect(triggerOf(name), triggerBox);
    await user.pointer({ target: triggerOf(name), coords: at });
    advance(300);
    expect(surfaceOf(name)).not.toBeNull();
    mockRect(surfaceOf(name)!, surfaceBox);
  }

  describe('opening', () => {
    it('opens after openDelay, passing the pointer event', async () => {
      const onOpen = vi.fn();
      render(<HoverHarness name="a" onOpen={onOpen} />);
      await user.hover(triggerOf('a'));
      advance(150);
      expect(surfaceOf('a')).toBeNull();
      advance(130);
      expect(surfaceOf('a')).not.toBeNull();
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0][0]).toBeInstanceOf(PointerEvent);
    });

    it('leaving the trigger before openDelay cancels the opening', async () => {
      render(<HoverHarness name="a" />);
      await user.hover(triggerOf('a'));
      advance(150);
      await user.unhover(triggerOf('a'));
      advance(500);
      expect(surfaceOf('a')).toBeNull();
    });

    it.each(['touch', 'pen'] as const)('ignores %s pointers', async (pointerType) => {
      const onOpen = vi.fn();
      render(<HoverHarness name="a" onOpen={onOpen} />);
      const trigger = triggerOf('a');
      act(() => {
        trigger.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType }));
        trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType }));
        trigger.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType }));
      });
      advance(500);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('counts a pointer event without pointerType as a mouse', async () => {
      render(<HoverHarness name="a" />);
      const trigger = triggerOf('a');
      act(() => {
        // What an environment without PointerEvent reports: no pointerType.
        trigger.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      });
      advance(300);
      expect(surfaceOf('a')).not.toBeNull();
    });

    it('does not open from an aria-disabled trigger, or an aria-disabled element inside it', async () => {
      const onOpen = vi.fn();
      const { rerender } = render(<HoverHarness name="a" disabled onOpen={onOpen} />);
      await user.hover(triggerOf('a'));
      advance(500);
      await user.unhover(triggerOf('a'));
      rerender(<HoverHarness name="a" disabledInside onOpen={onOpen} />);
      await user.hover(screen.getByRole('button', { name: 'a' }));
      advance(500);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('does nothing while disabled (enabled: false)', async () => {
      render(<HoverHarness name="a" enabled={false} />);
      await user.hover(triggerOf('a'));
      advance(500);
      expect(surfaceOf('a')).toBeNull();
    });

    it('restarts nothing on pointermove unless an opening was held', async () => {
      const onOpen = vi.fn();
      render(<HoverHarness name="a" onOpen={onOpen} />);
      mockRect(triggerOf('a'), { x: 0, y: 0, width: 100, height: 20 });
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 10, clientY: 10 } });
      advance(150);
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 20, clientY: 10 } });
      advance(130);
      // 280 ms after entering, although only 130 ms after the move.
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('closing', () => {
    it('closes closeDelay after the pointer leaves both, and re-entering cancels', async () => {
      const onClose = vi.fn();
      render(<HoverHarness name="a" onClose={onClose} />);
      await user.hover(triggerOf('a'));
      advance(300);
      await user.unhover(triggerOf('a'));
      advance(150);
      // Back on the trigger: the close is cancelled.
      await user.hover(triggerOf('a'));
      advance(500);
      expect(surfaceOf('a')).not.toBeNull();

      // Onto the surface, then off both.
      await user.hover(surfaceOf('a')!);
      advance(500);
      expect(surfaceOf('a')).not.toBeNull();
      await user.unhover(surfaceOf('a')!);
      advance(150);
      expect(surfaceOf('a')).not.toBeNull();
      advance(130);
      expect(surfaceOf('a')).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('reads canClose() when the close would start and again when it fires', async () => {
      let closable = false;
      render(<HoverHarness name="a" canClose={() => closable} />);
      await user.hover(triggerOf('a'));
      advance(300);
      // Not closable when the pointer leaves: no timer.
      await user.unhover(triggerOf('a'));
      closable = true;
      advance(500);
      expect(surfaceOf('a')).not.toBeNull();

      // Closable at the start, not at expiry: stays open.
      await user.hover(triggerOf('a'));
      await user.unhover(triggerOf('a'));
      closable = false;
      advance(500);
      expect(surfaceOf('a')).not.toBeNull();
    });

    it('starts the close when focus leaves the surface while the pointer is on neither', async () => {
      let focusInside = true;
      render(
        <>
          <HoverHarness name="a" canClose={() => !focusInside} />
          <button type="button">elsewhere</button>
        </>,
      );
      await user.hover(triggerOf('a'));
      advance(300);
      act(() => screen.getByRole('button', { name: 'a action' }).focus());
      await user.unhover(triggerOf('a'));
      advance(500);
      expect(surfaceOf('a')).not.toBeNull();
      focusInside = false;
      act(() => screen.getByRole('button', { name: 'elsewhere' }).focus());
      advance(150);
      expect(surfaceOf('a')).not.toBeNull();
      advance(130);
      expect(surfaceOf('a')).toBeNull();
    });

    it('startClose() starts the timer only while the pointer is on neither', async () => {
      let pinned = true;
      const apiRef = React.createRef<HarnessApi>() as React.RefObject<HarnessApi | null>;
      render(<HoverHarness name="a" canClose={() => !pinned} apiRef={apiRef} />);
      await user.hover(triggerOf('a'));
      advance(300);
      await user.hover(surfaceOf('a')!);
      pinned = false;
      act(() => apiRef.current!.startClose(new Event('focusout')));
      advance(500);
      expect(surfaceOf('a')).not.toBeNull();

      pinned = true;
      await user.unhover(surfaceOf('a')!);
      pinned = false;
      act(() => apiRef.current!.startClose(new Event('focusout')));
      advance(150);
      expect(surfaceOf('a')).not.toBeNull();
      advance(130);
      expect(surfaceOf('a')).toBeNull();
    });

    it('cancel() clears a running close', async () => {
      const apiRef = React.createRef<HarnessApi>() as React.RefObject<HarnessApi | null>;
      render(<HoverHarness name="a" apiRef={apiRef} />);
      await user.hover(triggerOf('a'));
      advance(300);
      await user.unhover(triggerOf('a'));
      act(() => apiRef.current!.cancel());
      advance(500);
      expect(surfaceOf('a')).not.toBeNull();
    });
  });

  describe('dismissed stays dismissed', () => {
    it('after a close the hook did not cause, hovering on opens nothing until the pointer leaves', async () => {
      const apiRef = React.createRef<HarnessApi>() as React.RefObject<HarnessApi | null>;
      const onOpen = vi.fn();
      render(<HoverHarness name="a" apiRef={apiRef} onOpen={onOpen} />);
      mockRect(triggerOf('a'), { x: 0, y: 0, width: 100, height: 20 });
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 10, clientY: 10 } });
      advance(300);
      expect(onOpen).toHaveBeenCalledTimes(1);

      // Escape, an outside press or a controlled close.
      act(() => apiRef.current!.setOpen(false));
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 30, clientY: 10 } });
      advance(400);
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 50, clientY: 12 } });
      advance(400);
      expect(surfaceOf('a')).toBeNull();

      await user.unhover(triggerOf('a'));
      await user.hover(triggerOf('a'));
      advance(300);
      expect(surfaceOf('a')).not.toBeNull();
      expect(onOpen).toHaveBeenCalledTimes(2);
    });

    it('a trigger rendered anew under the resting pointer opens nothing until the pointer leaves it', async () => {
      const apiRef = React.createRef<HarnessApi>() as React.RefObject<HarnessApi | null>;
      const onOpen = vi.fn();
      const { rerender } = render(
        <HoverHarness name="a" triggerKey="first" apiRef={apiRef} onOpen={onOpen} />,
      );
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 10, clientY: 10 } });
      advance(300);
      expect(onOpen).toHaveBeenCalledTimes(1);

      // Dismissed while the pointer rests on the trigger, which then renders as a new node: the
      // pointer enters the new node without ever leaving the old one.
      act(() => apiRef.current!.setOpen(false));
      const previous = triggerOf('a');
      rerender(<HoverHarness name="a" triggerKey="second" apiRef={apiRef} onOpen={onOpen} />);
      expect(triggerOf('a')).not.toBe(previous);
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 12, clientY: 10 } });
      advance(400);
      expect(surfaceOf('a')).toBeNull();
      expect(onOpen).toHaveBeenCalledTimes(1);

      await user.unhover(triggerOf('a'));
      await user.hover(triggerOf('a'));
      advance(300);
      expect(surfaceOf('a')).not.toBeNull();
      expect(onOpen).toHaveBeenCalledTimes(2);
    });

    it('a hover close is no dismissal, also when the pointer is back on the trigger as it commits', async () => {
      // The pointer reaches the trigger again after the close timer fired, before the close
      // commits.
      const backOnTrigger = () =>
        triggerOf('a').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      const { rerender } = render(
        <HoverHarness name="a" triggerKey="first" onClose={backOnTrigger} />,
      );
      await user.hover(triggerOf('a'));
      advance(300);
      await user.unhover(triggerOf('a'));
      advance(300);
      expect(surfaceOf('a')).toBeNull();

      // The trigger renders as a new node under the resting pointer, which enters it without a
      // leave: hover opens it as usual.
      rerender(<HoverHarness name="a" triggerKey="second" onClose={backOnTrigger} />);
      await user.pointer({ target: triggerOf('a'), coords: { clientX: 12, clientY: 10 } });
      advance(300);
      expect(surfaceOf('a')).not.toBeNull();
    });

    it('a close the hook caused leaves hover opening as usual', async () => {
      render(<HoverHarness name="a" />);
      await user.hover(triggerOf('a'));
      advance(300);
      await user.unhover(triggerOf('a'));
      advance(300);
      expect(surfaceOf('a')).toBeNull();
      await user.hover(triggerOf('a'));
      advance(300);
      expect(surfaceOf('a')).not.toBeNull();
    });
  });

  describe('the safe zone', () => {
    // Trigger a at x 0–100, y 0–20; its surface to the right at x 100–200, y 0–100. Sibling
    // trigger b sits below a (y 20–80), in the path of a diagonal move into a's surface.
    const TRIGGER_A = { x: 0, y: 0, width: 100, height: 20 };
    const SURFACE_A = { x: 100, y: 0, width: 100, height: 100 };
    const TRIGGER_B = { x: 0, y: 20, width: 100, height: 60 };

    function Siblings({ group }: { group: HoverIntentGroup }) {
      return (
        <>
          <HoverHarness name="a" group={group} />
          <HoverHarness name="b" group={group} />
        </>
      );
    }

    async function leaveATowards(target: Element, clientX: number, clientY: number) {
      await user.pointer({ target, coords: { clientX, clientY } });
    }

    it('keeps the surface open along a diagonal path across a sibling trigger, which it holds', async () => {
      const group = createHoverIntentGroup();
      render(<Siblings group={group} />);
      mockRect(triggerOf('b'), TRIGGER_B);
      await hoverOpen('a', TRIGGER_A, SURFACE_A, { clientX: 90, clientY: 10 });

      // Out of a at (90, 20), onto b, then down and to the right inside the triangle.
      await leaveATowards(triggerOf('b'), 90, 20);
      for (const [x, y] of [
        [92, 25],
        [93, 30],
        [94, 34],
        [95, 38],
        [96, 42],
        [97, 46],
        [98, 50],
      ]) {
        advance(100);
        await user.pointer({ target: triggerOf('b'), coords: { clientX: x, clientY: y } });
      }
      expect(surfaceOf('a')).not.toBeNull();
      expect(surfaceOf('b')).toBeNull();

      // Into a's surface: the zone ends; nothing closes and b never opened.
      await user.pointer({ target: surfaceOf('a')!, coords: { clientX: 110, clientY: 55 } });
      advance(1000);
      expect(surfaceOf('a')).not.toBeNull();
      expect(surfaceOf('b')).toBeNull();
    });

    it('retries a held opening at the next move over the sibling, which opens once the zone is gone', async () => {
      const group = createHoverIntentGroup();
      render(<Siblings group={group} />);
      mockRect(triggerOf('b'), TRIGGER_B);
      await hoverOpen('a', TRIGGER_A, SURFACE_A, { clientX: 90, clientY: 10 });

      // Onto b inside a's zone: b's opening fires while the zone holds the point.
      await leaveATowards(triggerOf('b'), 90, 20);
      advance(100);
      await user.pointer({ target: triggerOf('b'), coords: { clientX: 93, clientY: 30 } });
      advance(200);
      expect(surfaceOf('b')).toBeNull();

      // A move over b outside the triangle: it ends a's zone and starts b's opening again.
      await user.pointer({ target: triggerOf('b'), coords: { clientX: 20, clientY: 70 } });
      advance(150);
      expect(surfaceOf('b')).toBeNull();
      advance(130);
      expect(surfaceOf('b')).not.toBeNull();
    });

    it('a held opening stays off when a move retries it after a dismissal on its trigger', async () => {
      const group = createHoverIntentGroup();
      const apiRef = React.createRef<HarnessApi>() as React.RefObject<HarnessApi | null>;
      const onOpenB = vi.fn();
      render(
        <>
          <HoverHarness name="a" group={group} />
          <HoverHarness name="b" group={group} apiRef={apiRef} onOpen={onOpenB} />
        </>,
      );
      mockRect(triggerOf('b'), TRIGGER_B);
      await hoverOpen('a', TRIGGER_A, SURFACE_A, { clientX: 90, clientY: 10 });

      // Onto b inside a's zone: b's opening fires while the zone holds the point.
      await leaveATowards(triggerOf('b'), 90, 20);
      advance(100);
      await user.pointer({ target: triggerOf('b'), coords: { clientX: 93, clientY: 30 } });
      advance(200);
      expect(surfaceOf('b')).toBeNull();

      // b opens another way (the app's controlled open) and is dismissed while the pointer rests
      // on its trigger; then a move over b retries the held opening.
      act(() => apiRef.current!.setOpen(true));
      act(() => apiRef.current!.setOpen(false));
      await user.pointer({ target: triggerOf('b'), coords: { clientX: 20, clientY: 70 } });
      advance(400);
      expect(surfaceOf('b')).toBeNull();
      expect(onOpenB).not.toHaveBeenCalled();

      await user.unhover(triggerOf('b'));
      await user.hover(triggerOf('b'));
      advance(300);
      expect(surfaceOf('b')).not.toBeNull();
      expect(onOpenB).toHaveBeenCalledTimes(1);
    });

    it('a move outside the triangle ends the zone; the surface closes closeDelay after the leave', async () => {
      render(<HoverHarness name="a" closeDelay={500} />);
      await hoverOpen('a', TRIGGER_A, SURFACE_A, { clientX: 90, clientY: 10 });
      await user.pointer({ target: document.body, coords: { clientX: 90, clientY: 21 } });
      advance(300);
      // (60, 60) is outside the triangle (90, 21) – (100, 0) – (100, 100): no restart.
      await user.pointer({ target: document.body, coords: { clientX: 60, clientY: 60 } });
      expect(surfaceOf('a')).not.toBeNull();
      // Measured from the leave (500 ms), not from the move outside (which would be 800 ms).
      advance(250);
      expect(surfaceOf('a')).toBeNull();
    });

    it('resting inside the triangle closes closeDelay after the last move', async () => {
      render(<HoverHarness name="a" />);
      await hoverOpen('a', TRIGGER_A, SURFACE_A, { clientX: 90, clientY: 10 });
      await user.pointer({ target: document.body, coords: { clientX: 90, clientY: 21 } });
      advance(200);
      await user.pointer({ target: document.body, coords: { clientX: 94, clientY: 30 } });
      advance(150);
      expect(surfaceOf('a')).not.toBeNull();
      advance(130);
      expect(surfaceOf('a')).toBeNull();
    });

    it('faces the right edge of a surface on the trigger’s left (RTL placement)', async () => {
      render(<HoverHarness name="a" />);
      await hoverOpen(
        'a',
        { x: 200, y: 0, width: 100, height: 20 },
        { x: 0, y: 0, width: 100, height: 100 },
        { clientX: 210, clientY: 10 },
      );
      // Out of the trigger's left edge at (199, 10), towards the surface's right edge (x 100).
      await user.pointer({ target: document.body, coords: { clientX: 199, clientY: 10 } });
      for (const [x, y] of [
        [180, 15],
        [160, 25],
        [140, 35],
      ]) {
        advance(150);
        await user.pointer({ target: document.body, coords: { clientX: x, clientY: y } });
      }
      advance(150);
      expect(surfaceOf('a')).not.toBeNull();
      // (150, 80) is outside that triangle: the zone ends and the close runs out.
      await user.pointer({ target: document.body, coords: { clientX: 150, clientY: 80 } });
      advance(120);
      expect(surfaceOf('a')).toBeNull();
    });

    it('faces the top edge of a surface below the trigger', async () => {
      render(<HoverHarness name="a" />);
      await hoverOpen(
        'a',
        { x: 0, y: 0, width: 100, height: 20 },
        { x: 0, y: 24, width: 200, height: 100 },
        { clientX: 50, clientY: 10 },
      );
      await user.pointer({ target: document.body, coords: { clientX: 50, clientY: 20 } });
      for (const [x, y] of [
        [55, 21],
        [60, 22],
        [66, 23],
      ]) {
        advance(150);
        await user.pointer({ target: document.body, coords: { clientX: x, clientY: y } });
      }
      advance(150);
      expect(surfaceOf('a')).not.toBeNull();
      // (180, 21) is beside the triangle.
      await user.pointer({ target: document.body, coords: { clientX: 180, clientY: 21 } });
      advance(120);
      expect(surfaceOf('a')).toBeNull();
    });

    it('listens to the document only while a zone is active', async () => {
      const add = vi.spyOn(document, 'addEventListener');
      const remove = vi.spyOn(document, 'removeEventListener');
      const moves = (spy: typeof add) =>
        spy.mock.calls.filter(([type]) => type === 'pointermove').length;
      render(<HoverHarness name="a" />);
      await hoverOpen('a', TRIGGER_A, SURFACE_A, { clientX: 90, clientY: 10 });
      expect(moves(add)).toBe(0);
      await user.pointer({ target: document.body, coords: { clientX: 90, clientY: 21 } });
      expect(moves(add)).toBe(1);
      await user.pointer({ target: surfaceOf('a')!, coords: { clientX: 120, clientY: 50 } });
      expect(moves(remove)).toBe(1);
      add.mockRestore();
      remove.mockRestore();
    });
  });

  it('calls onOpen once under StrictMode', async () => {
    const onOpen = vi.fn();
    render(
      <React.StrictMode>
        <HoverHarness name="a" onOpen={onOpen} />
      </React.StrictMode>,
    );
    await user.hover(triggerOf('a'));
    advance(300);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('leaves no timer behind after unmount', async () => {
    const onOpen = vi.fn();
    const { unmount } = render(<HoverHarness name="a" onOpen={onOpen} />);
    await user.hover(triggerOf('a'));
    unmount();
    advance(1000);
    expect(onOpen).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('has the documented types', () => {
    expectTypeOf<UseHoverIntentOptions['onOpen']>().toEqualTypeOf<(event: PointerEvent) => void>();
    expectTypeOf<HoverIntentGroup['isHeld']>().toEqualTypeOf<(x: number, y: number) => boolean>();
    expectTypeOf<HoverIntent['startClose']>().toEqualTypeOf<(event: Event) => void>();
  });
});
