import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { tableResizeHandleClassNames } from '../../../lib/classNames';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
import { Table, TableResizeHandle } from '../Table';
import type { TableResizeHandleProps } from '../Table';
import type { TableResizeHandleBindings } from '../useTableFeatures';

const noop = () => {};
const handle = () => screen.getByRole('separator', { name: 'Resize column' });

/** A handle in a column of 200 px, between 80 and no maximum unless given. */
function renderHandle(props: Partial<TableResizeHandleProps> = {}) {
  const onResize = vi.fn();
  const onReset = vi.fn();
  const onLeave = vi.fn();
  const ui = (extra: Partial<TableResizeHandleProps> = {}) => (
    <Table.ResizeHandle
      width={200}
      minWidth={80}
      onResize={onResize}
      onReset={onReset}
      onLeave={onLeave}
      {...props}
      {...extra}
    />
  );
  const utils = render(ui());
  return { ...utils, ui, onResize, onReset, onLeave };
}

describe('Table.ResizeHandle', () => {
  testSystemProps(TableResizeHandle, {
    expectedTag: 'div',
    displayName: 'TableResizeHandle',
    defaultProps: { width: 200, minWidth: 80, onResize: noop },
    a11yVariants: [
      { name: 'with a maximum', props: { maxWidth: 400 } },
      { name: 'with a label', props: { label: 'Resize the Name column' } },
    ],
  });

  testCompoundExposure(Table, ['ResizeHandle']);

  it('is the flat export of Table.ResizeHandle and carries its stable class', () => {
    expect(Table.ResizeHandle).toBe(TableResizeHandle);
    renderHandle();
    expect(handle()).toHaveClass(tableResizeHandleClassNames.root);
  });

  describe('attributes', () => {
    it('is a vertical separator that no Tab stop reaches, marked as an auxiliary grid widget', () => {
      renderHandle();
      expect(handle()).toHaveAttribute('aria-orientation', 'vertical');
      expect(handle()).toHaveAttribute('tabindex', '-1');
      expect(handle()).toHaveAttribute('data-grid-auxiliary', '');
    });

    it('reports the width as aria-valuenow, the minimum as aria-valuemin and a text in pixels', () => {
      const { rerender, ui } = renderHandle();
      expect(handle()).toHaveAttribute('aria-valuenow', '200');
      expect(handle()).toHaveAttribute('aria-valuemin', '80');
      expect(handle()).toHaveAttribute('aria-valuetext', '200 pixels');
      rerender(ui({ width: 250 }));
      expect(handle()).toHaveAttribute('aria-valuenow', '250');
      expect(handle()).toHaveAttribute('aria-valuetext', '250 pixels');
    });

    it('has aria-valuemax only when a maximum is set', () => {
      const { rerender, ui } = renderHandle();
      expect(handle()).not.toHaveAttribute('aria-valuemax');
      rerender(ui({ maxWidth: 400 }));
      expect(handle()).toHaveAttribute('aria-valuemax', '400');
    });

    it('takes the label and the value text from props', () => {
      renderHandle({ label: 'Resize Name', valueText: (width) => `${width / 10} cm` });
      const separator = screen.getByRole('separator', { name: 'Resize Name' });
      expect(separator).toHaveAttribute('aria-valuetext', '20 cm');
    });

    it('is not draggable by default: data-dragging is absent', () => {
      renderHandle();
      expect(handle()).not.toHaveAttribute('data-dragging');
    });

    it('renders on the server without a document', () => {
      const html = renderToString(<Table.ResizeHandle width={120} minWidth={80} onResize={noop} />);
      expect(html).toContain('role="separator"');
      expect(html).toContain('aria-valuenow="120"');
    });
  });

  describe('inside a header cell', () => {
    it('passes axe in the aside slot of a sortable header', async () => {
      render(
        <Table aria-label="Team">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell
                sortable
                className="relative"
                aside={<Table.ResizeHandle width={200} minWidth={80} onResize={noop} />}
              >
                Name
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Alice</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      );
      expect(screen.getByRole('separator', { name: 'Resize column' })).toBeInTheDocument();
      await expectNoA11yViolations();
    });
  });

  describe('pointer', () => {
    const CAPTURE_METHODS = [
      'setPointerCapture',
      'releasePointerCapture',
      'hasPointerCapture',
    ] as const;
    let saved: Array<[string, PropertyDescriptor | undefined]> = [];
    let frames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;

    /** Runs the animation frames that are waiting, as the browser does before a paint. */
    const flushFrames = () => {
      act(() => {
        const waiting = [...frames.values()];
        frames = new Map();
        for (const callback of waiting) callback(0);
      });
    };

    beforeEach(() => {
      // jsdom has no pointer capture: a stand-in that remembers the captured pointer ids.
      const captured = new WeakMap<Element, Set<number>>();
      saved = CAPTURE_METHODS.map((name) => [
        name,
        Object.getOwnPropertyDescriptor(Element.prototype, name),
      ]);
      Object.defineProperties(Element.prototype, {
        setPointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            const ids = captured.get(this) ?? new Set<number>();
            ids.add(pointerId);
            captured.set(this, ids);
          },
        },
        releasePointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            captured.get(this)?.delete(pointerId);
          },
        },
        hasPointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            return captured.get(this)?.has(pointerId) ?? false;
          },
        },
      });
      // The frames wait until the test runs them.
      frames = new Map();
      nextFrameId = 1;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        frames.delete(id);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
        else Reflect.deleteProperty(Element.prototype, name);
      }
    });

    const down = (pointerType: string, init: PointerEventInit = {}) =>
      fireEvent.pointerDown(handle(), {
        pointerId: 1,
        pointerType,
        isPrimary: true,
        button: 0,
        clientX: 100,
        ...init,
      });
    const move = (pointerType: string, clientX: number, init: PointerEventInit = {}) =>
      fireEvent.pointerMove(handle(), {
        pointerId: 1,
        pointerType,
        isPrimary: true,
        clientX,
        ...init,
      });
    const up = (pointerType: string, type: 'pointerUp' | 'pointerCancel' = 'pointerUp') =>
      fireEvent[type](handle(), { pointerId: 1, pointerType, isPrimary: true });

    it.each(['mouse', 'touch', 'pen'])(
      'a %s drag of 40 px calls onResize with the width plus 40 once the frame runs',
      (pointerType) => {
        const { onResize } = renderHandle();
        down(pointerType);
        expect(handle()).toHaveAttribute('data-dragging');
        expect(handle().hasPointerCapture(1)).toBe(true);
        move(pointerType, 140);
        expect(onResize).not.toHaveBeenCalled();
        flushFrames();
        expect(onResize).toHaveBeenCalledTimes(1);
        expect(onResize).toHaveBeenCalledWith(240, { event: expect.any(Event) });
      },
    );

    it('mirrors the delta in RTL: moving 40 px toward the end narrows the column', () => {
      const onResize = vi.fn();
      renderWithProviders(<Table.ResizeHandle width={200} minWidth={80} onResize={onResize} />, {
        dir: 'rtl',
      });
      down('mouse');
      move('mouse', 140);
      flushFrames();
      expect(onResize).toHaveBeenCalledWith(160, { event: expect.any(Event) });
      move('mouse', 60);
      flushFrames();
      expect(onResize).toHaveBeenLastCalledWith(240, { event: expect.any(Event) });
    });

    it('batches several moves of one frame into one call with the last position', () => {
      const { onResize } = renderHandle();
      down('mouse');
      move('mouse', 110);
      move('mouse', 120);
      move('mouse', 150);
      flushFrames();
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(250, { event: expect.any(Event) });
      move('mouse', 160);
      flushFrames();
      expect(onResize).toHaveBeenCalledTimes(2);
      expect(onResize).toHaveBeenLastCalledWith(260, { event: expect.any(Event) });
    });

    it('measures the delta from the width at the start of the drag, also after the width changed', () => {
      const { onResize, rerender, ui } = renderHandle();
      down('mouse');
      move('mouse', 130);
      flushFrames();
      expect(onResize).toHaveBeenLastCalledWith(230, { event: expect.any(Event) });
      rerender(ui({ width: 230 }));
      move('mouse', 150);
      flushFrames();
      expect(onResize).toHaveBeenLastCalledWith(250, { event: expect.any(Event) });
    });

    it('never calls onResize below minWidth or above maxWidth', () => {
      const { onResize } = renderHandle({ maxWidth: 300 });
      down('mouse');
      move('mouse', -200);
      flushFrames();
      expect(onResize).toHaveBeenLastCalledWith(80, { event: expect.any(Event) });
      move('mouse', 900);
      flushFrames();
      expect(onResize).toHaveBeenLastCalledWith(300, { event: expect.any(Event) });
      for (const [width] of onResize.mock.calls as Array<[number]>) {
        expect(width).toBeGreaterThanOrEqual(80);
        expect(width).toBeLessThanOrEqual(300);
      }
    });

    it('does not repeat a width it already reported', () => {
      const { onResize } = renderHandle();
      down('mouse');
      move('mouse', -200);
      flushFrames();
      move('mouse', -300);
      flushFrames();
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(80, { event: expect.any(Event) });
    });

    it('ignores a press that is not the primary button or not the primary pointer', () => {
      const { onResize } = renderHandle();
      down('mouse', { button: 2 });
      expect(handle()).not.toHaveAttribute('data-dragging');
      move('mouse', 160);
      flushFrames();
      down('touch', { isPrimary: false, pointerId: 2 });
      expect(handle()).not.toHaveAttribute('data-dragging');
      move('touch', 160, { pointerId: 2, isPrimary: false });
      flushFrames();
      expect(onResize).not.toHaveBeenCalled();
    });

    it('ignores moves of another pointer and moves without a press', () => {
      const { onResize } = renderHandle();
      move('mouse', 160);
      flushFrames();
      down('mouse');
      move('mouse', 180, { pointerId: 9 });
      flushFrames();
      expect(onResize).not.toHaveBeenCalled();
    });

    it('shows data-dragging only while the pointer is down', () => {
      renderHandle();
      expect(handle()).not.toHaveAttribute('data-dragging');
      down('mouse');
      expect(handle()).toHaveAttribute('data-dragging');
      up('mouse');
      expect(handle()).not.toHaveAttribute('data-dragging');
      expect(handle().hasPointerCapture(1)).toBe(false);
      down('mouse');
      up('mouse', 'pointerCancel');
      expect(handle()).not.toHaveAttribute('data-dragging');
      down('mouse');
      fireEvent.lostPointerCapture(handle(), { pointerId: 1 });
      expect(handle()).not.toHaveAttribute('data-dragging');
    });

    it('applies the pending move when the pointer is released, and nothing after the release', () => {
      const { onResize } = renderHandle();
      down('mouse');
      move('mouse', 140);
      up('mouse');
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(240, { event: expect.any(Event) });
      flushFrames();
      move('mouse', 200);
      flushFrames();
      expect(onResize).toHaveBeenCalledTimes(1);
    });

    it('drops the pending move when the drag is cancelled', () => {
      const { onResize } = renderHandle();
      down('mouse');
      move('mouse', 140);
      up('mouse', 'pointerCancel');
      flushFrames();
      expect(onResize).not.toHaveBeenCalled();
    });

    it('drops the pending frame when it unmounts mid-drag', () => {
      const { onResize, unmount } = renderHandle();
      down('mouse');
      move('mouse', 140);
      unmount();
      flushFrames();
      expect(onResize).not.toHaveBeenCalled();
    });

    it('composes the consumer pointer handlers with the drag', () => {
      const onPointerDown = vi.fn();
      const onPointerMove = vi.fn();
      const { onResize } = renderHandle({ onPointerDown, onPointerMove });
      down('mouse');
      move('mouse', 120);
      flushFrames();
      expect(onPointerDown).toHaveBeenCalledTimes(1);
      expect(onPointerMove).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(220, { event: expect.any(Event) });
    });

    it('a consumer onPointerDown that calls preventDefault() starts no drag', () => {
      const { onResize } = renderHandle({ onPointerDown: (event) => event.preventDefault() });
      down('mouse');
      move('mouse', 140);
      flushFrames();
      expect(handle()).not.toHaveAttribute('data-dragging');
      expect(onResize).not.toHaveBeenCalled();
    });
  });

  describe('keyboard', () => {
    it.each([
      ['{ArrowRight}', 220],
      ['{ArrowLeft}', 180],
      ['{Shift>}{ArrowRight}{/Shift}', 205],
      ['{Shift>}{ArrowLeft}{/Shift}', 195],
    ])('%s resizes a column of 200 px to %i in LTR', async (keys, expected) => {
      const user = userEvent.setup();
      const { onResize } = renderHandle();
      handle().focus();
      await user.keyboard(keys);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(expected, { event: expect.any(Event) });
    });

    it.each([
      ['{ArrowRight}', 180],
      ['{ArrowLeft}', 220],
      ['{Shift>}{ArrowRight}{/Shift}', 195],
      ['{Shift>}{ArrowLeft}{/Shift}', 205],
    ])('%s resizes a column of 200 px to %i in RTL', async (keys, expected) => {
      const user = userEvent.setup();
      const onResize = vi.fn();
      renderWithProviders(<Table.ResizeHandle width={200} minWidth={80} onResize={onResize} />, {
        dir: 'rtl',
      });
      handle().focus();
      await user.keyboard(keys);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(expected, { event: expect.any(Event) });
    });

    it('Home sets the minimum width, End the maximum when there is one', async () => {
      const user = userEvent.setup();
      const { onResize, rerender, ui } = renderHandle();
      handle().focus();
      await user.keyboard('{Home}');
      expect(onResize).toHaveBeenLastCalledWith(80, { event: expect.any(Event) });
      onResize.mockClear();
      // Without a maximum End does nothing and the key is not consumed.
      expect(fireEvent.keyDown(handle(), { key: 'End' })).toBe(true);
      expect(onResize).not.toHaveBeenCalled();
      rerender(ui({ maxWidth: 400 }));
      await user.keyboard('{End}');
      expect(onResize).toHaveBeenCalledWith(400, { event: expect.any(Event) });
    });

    it('holds the width within the limits and reports nothing at a limit', async () => {
      const user = userEvent.setup();
      const { onResize, rerender, ui } = renderHandle({ maxWidth: 210 });
      handle().focus();
      await user.keyboard('{ArrowRight}');
      expect(onResize).toHaveBeenLastCalledWith(210, { event: expect.any(Event) });
      onResize.mockClear();
      rerender(ui({ width: 210 }));
      await user.keyboard('{ArrowRight}');
      expect(onResize).not.toHaveBeenCalled();
      rerender(ui({ width: 85 }));
      await user.keyboard('{ArrowLeft}');
      expect(onResize).toHaveBeenLastCalledWith(80, { event: expect.any(Event) });
      onResize.mockClear();
      rerender(ui({ width: 80 }));
      await user.keyboard('{ArrowLeft}{Home}');
      expect(onResize).not.toHaveBeenCalled();
    });

    it.each(['{Enter}', ' ', '{Escape}'])(
      '%j calls onLeave once and does not reach the ancestors',
      async (keys) => {
        const user = userEvent.setup();
        const onAncestorKeyDown = vi.fn();
        const onLeave = vi.fn();
        render(
          <div onKeyDown={onAncestorKeyDown}>
            <Table.ResizeHandle width={200} minWidth={80} onResize={noop} onLeave={onLeave} />
          </div>,
        );
        handle().focus();
        await user.keyboard(keys);
        expect(onLeave).toHaveBeenCalledTimes(1);
        expect(onAncestorKeyDown).not.toHaveBeenCalled();
      },
    );

    it('keeps Enter, Space and Escape for the ancestors when there is no onLeave', async () => {
      const user = userEvent.setup();
      const onAncestorKeyDown = vi.fn();
      render(
        <div onKeyDown={onAncestorKeyDown}>
          <Table.ResizeHandle width={200} minWidth={80} onResize={noop} />
        </div>,
      );
      handle().focus();
      await user.keyboard('{Escape}');
      expect(onAncestorKeyDown).toHaveBeenCalledTimes(1);
    });

    it.each(['ArrowRight', 'ArrowLeft', 'Home'])(
      '%s is consumed: it does not move the grid',
      (key) => {
        const onAncestorKeyDown = vi.fn();
        render(
          <div onKeyDown={onAncestorKeyDown}>
            <Table.ResizeHandle width={200} minWidth={80} onResize={noop} />
          </div>,
        );
        const notPrevented = fireEvent.keyDown(handle(), { key });
        expect(notPrevented).toBe(false);
        expect(onAncestorKeyDown).not.toHaveBeenCalled();
      },
    );

    it('leaves other keys and modified arrows alone', () => {
      const { onResize } = renderHandle();
      expect(fireEvent.keyDown(handle(), { key: 'a' })).toBe(true);
      expect(fireEvent.keyDown(handle(), { key: 'ArrowUp' })).toBe(true);
      expect(fireEvent.keyDown(handle(), { key: 'ArrowRight', ctrlKey: true })).toBe(true);
      expect(onResize).not.toHaveBeenCalled();
    });

    it('a consumer onKeyDown that calls preventDefault() suppresses the resize', () => {
      const { onResize } = renderHandle({ onKeyDown: (event) => event.preventDefault() });
      fireEvent.keyDown(handle(), { key: 'ArrowRight' });
      expect(onResize).not.toHaveBeenCalled();
    });
  });

  describe('double click', () => {
    it('calls onReset with the event', () => {
      const { onReset, onResize } = renderHandle();
      fireEvent.doubleClick(handle());
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onReset).toHaveBeenCalledWith({ event: expect.any(Event) });
      expect(onResize).not.toHaveBeenCalled();
    });

    it('composes the consumer onDoubleClick with the reset', () => {
      const onDoubleClick = vi.fn();
      const { onReset } = renderHandle({ onDoubleClick });
      fireEvent.doubleClick(handle());
      expect(onDoubleClick).toHaveBeenCalledTimes(1);
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('a consumer onDoubleClick that calls preventDefault() suppresses the reset', () => {
      const { onReset } = renderHandle({ onDoubleClick: (event) => event.preventDefault() });
      fireEvent.doubleClick(handle());
      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('types', () => {
    it('takes the bindings of getResizeHandleProps spread onto it', () => {
      const bindings: TableResizeHandleBindings = {
        width: 200,
        minWidth: 80,
        onResize: noop,
      };
      render(<Table.ResizeHandle {...bindings} />);
      expect(handle()).toHaveAttribute('aria-valuenow', '200');
      expectTypeOf<TableResizeHandleBindings>().toExtend<
        Pick<TableResizeHandleProps, 'width' | 'minWidth' | 'onResize'>
      >();
    });

    it('has the documented props', () => {
      expectTypeOf<TableResizeHandleProps['width']>().toEqualTypeOf<number>();
      expectTypeOf<TableResizeHandleProps['maxWidth']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<TableResizeHandleProps['onResize']>().toEqualTypeOf<
        (width: number, details: { event: Event }) => void
      >();
      expectTypeOf<TableResizeHandleProps['onReset']>().toEqualTypeOf<
        ((details: { event: Event }) => void) | undefined
      >();
      expectTypeOf<TableResizeHandleProps['onLeave']>().toEqualTypeOf<(() => void) | undefined>();
      expectTypeOf<TableResizeHandleProps['valueText']>().toEqualTypeOf<
        ((width: number) => string) | undefined
      >();
      expectTypeOf<TableResizeHandleProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLDivElement> | undefined
      >();
    });
  });
});
