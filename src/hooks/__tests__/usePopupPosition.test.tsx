import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import {
  usePopupPosition,
  type UsePopupPositionOptions,
  type UsePopupPositionResult,
} from '../usePopupPosition';
import { WaveProvider } from '../../components/provider/WaveProvider';
import { installResizeObserverMock } from '../../test-utils';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

let boxes: Record<string, Box> = {};

function rectFor(box: Box | undefined): DOMRect {
  const { x, y, width, height } = box ?? { x: 0, y: 0, width: 0, height: 0 };
  const full = { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
  return { ...full, toJSON: () => full } as DOMRect;
}

function boxOf(el: Element): Box | undefined {
  const id = el.getAttribute('data-testid');
  return id ? boxes[id] : undefined;
}

const html = document.documentElement;

beforeEach(() => {
  boxes = {
    reference: { x: 500, y: 100, width: 200, height: 20 },
    floating: { x: 0, y: 0, width: 100, height: 100 },
    arrow: { x: 0, y: 0, width: 8, height: 8 },
  };
  // A 1024×768 viewport and layout boxes for the elements under test (jsdom has no layout).
  Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
  Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectFor(boxOf(this));
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.width ?? 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.height ?? 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(html, 'clientWidth');
  Reflect.deleteProperty(html, 'clientHeight');
});

function Popup({
  open = true,
  withArrow = false,
  onResult,
  ...options
}: Partial<UsePopupPositionOptions> & {
  withArrow?: boolean;
  onResult?: (result: UsePopupPositionResult) => void;
}) {
  const arrowRef = React.useRef<HTMLDivElement>(null);
  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const result = usePopupPosition({
    open,
    ...(withArrow ? { arrowRef } : {}),
    ...options,
  });
  const { setReference, setFloating, floatingProps, arrowStyles } = result;
  React.useEffect(() => {
    onResult?.(result);
  });
  return (
    <>
      <button type="button" ref={setReference} data-testid="reference">
        Anchor
      </button>
      {open && (
        <div ref={setFloating} data-testid="floating" {...floatingProps}>
          Popup
          {withArrow && <div ref={arrowRef} data-testid="arrow" style={arrowStyles} />}
        </div>
      )}
    </>
  );
}

describe('usePopupPosition', () => {
  it('places the surface below the anchor by default (fixed strategy)', async () => {
    let last: UsePopupPositionResult | null = null;
    render(<Popup onResult={(r) => (last = r)} />);
    const floating = screen.getByTestId('floating');
    await waitFor(() => expect(last!.isPositioned).toBe(true));
    expect(floating).toHaveAttribute('data-side', 'bottom');
    expect(floating).toHaveAttribute('data-align', 'start');
    expect(last!.placement).toBe('bottom-start');
    expect(last!.side).toBe('bottom');
    expect(floating.style.position).toBe('fixed');
  });

  it('flips to the top when the bottom collides with the viewport', async () => {
    boxes.reference = { x: 500, y: 700, width: 200, height: 20 };
    render(<Popup />);
    const floating = screen.getByTestId('floating');
    await waitFor(() => expect(floating).toHaveAttribute('data-side', 'top'));
  });

  it('keeps the requested side when flip is disabled', async () => {
    boxes.reference = { x: 500, y: 700, width: 200, height: 20 };
    let last: UsePopupPositionResult | null = null;
    render(<Popup flip={false} onResult={(r) => (last = r)} />);
    await waitFor(() => expect(last!.isPositioned).toBe(true));
    expect(screen.getByTestId('floating')).toHaveAttribute('data-side', 'bottom');
  });

  it('resolves logical start/end sides with the direction', async () => {
    boxes.reference = { x: 400, y: 300, width: 100, height: 20 };
    const { unmount } = render(<Popup side="start" align="center" />);
    await waitFor(() =>
      expect(screen.getByTestId('floating')).toHaveAttribute('data-side', 'left'),
    );
    expect(screen.getByTestId('floating')).toHaveAttribute('data-align', 'center');
    unmount();

    render(
      <WaveProvider dir="rtl">
        <Popup side="start" align="center" />
      </WaveProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('floating')).toHaveAttribute('data-side', 'right'),
    );
  });

  it('aligns start/end with the direction: bottom-start hugs the anchor’s right edge in RTL', async () => {
    // Anchor spans x 500–700; the 100px wide surface below it.
    const translateX = (el: HTMLElement) => {
      const match = /translate\(\s*(-?[\d.]+)px/.exec(el.style.transform);
      return match ? Number(match[1]) : Number.NaN;
    };
    let last: UsePopupPositionResult | null = null;
    const { unmount } = render(<Popup side="bottom" align="start" onResult={(r) => (last = r)} />);
    await waitFor(() => expect(last!.isPositioned).toBe(true));
    // LTR: the surface's left edge meets the anchor's left edge.
    expect(translateX(screen.getByTestId('floating'))).toBe(500);
    unmount();

    last = null;
    render(
      <WaveProvider dir="rtl">
        <Popup side="bottom" align="start" onResult={(r) => (last = r)} />
      </WaveProvider>,
    );
    await waitFor(() => expect(last!.isPositioned).toBe(true));
    const floating = screen.getByTestId('floating');
    expect(floating).toHaveAttribute('data-side', 'bottom');
    expect(floating).toHaveAttribute('data-align', 'start');
    // RTL: the surface's right edge (x + 100) meets the anchor's right edge (700).
    expect(translateX(floating) + boxes.floating.width).toBe(
      boxes.reference.x + boxes.reference.width,
    );
  });

  it('uses the requested alignment', async () => {
    let last: UsePopupPositionResult | null = null;
    render(<Popup side="top" align="end" onResult={(r) => (last = r)} />);
    await waitFor(() => expect(last!.placement).toBe('top-end'));
    expect(screen.getByTestId('floating')).toHaveAttribute('data-align', 'end');
  });

  it('matches the reference width and exposes the available space as CSS variables', async () => {
    render(<Popup matchReferenceWidth fitViewport />);
    const floating = screen.getByTestId('floating');
    await waitFor(() =>
      expect(floating.style.getPropertyValue('--wave-popup-reference-width')).toBe('200px'),
    );
    expect(floating.style.width).toBe('var(--wave-popup-reference-width)');
    expect(floating.style.maxHeight).toBe('var(--wave-popup-available-height)');
    expect(floating.style.getPropertyValue('--wave-popup-available-height')).toMatch(/px$/);
  });

  it('positions an arrow element', async () => {
    let last: UsePopupPositionResult | null = null;
    render(<Popup withArrow onResult={(r) => (last = r)} />);
    await waitFor(() => expect(last!.arrowStyles.left).toMatch(/px$/));
    const arrow = screen.getByTestId('arrow');
    expect(arrow.style.position).toBe('absolute');
    // The arrow sticks out of the side facing the anchor (top for a surface below it).
    expect(arrow.style.top).toBe('calc(var(--wave-popup-arrow-size, 8px) / -2)');
  });

  it('supports the absolute strategy', async () => {
    let last: UsePopupPositionResult | null = null;
    render(<Popup strategy="absolute" onResult={(r) => (last = r)} />);
    await waitFor(() => expect(last!.isPositioned).toBe(true));
    expect(screen.getByTestId('floating').style.position).toBe('absolute');
  });

  it('does not crash without ResizeObserver or IntersectionObserver', async () => {
    expect(typeof globalThis.ResizeObserver).toBe('undefined');
    let last: UsePopupPositionResult | null = null;
    render(<Popup onResult={(r) => (last = r)} />);
    await waitFor(() => expect(last!.isPositioned).toBe(true));
  });

  it('observes element size changes when ResizeObserver exists', async () => {
    const ro = installResizeObserverMock();
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    try {
      let last: UsePopupPositionResult | null = null;
      render(<Popup onResult={(r) => (last = r)} />);
      await waitFor(() => expect(last!.isPositioned).toBe(true));
      const observed = observe.mock.calls.map(([target]) => target);
      expect(observed).toContain(screen.getByTestId('reference'));
      expect(observed).toContain(screen.getByTestId('floating'));
    } finally {
      ro.restore();
    }
  });

  it('is not positioned while closed', () => {
    let last: UsePopupPositionResult | null = null;
    render(<Popup open={false} onResult={(r) => (last = r)} />);
    expect(last!.isPositioned).toBe(false);
    expect(last!.floatingProps['data-side']).toBe('bottom');
  });
});
