import { describe, it, expect, afterEach, vi, expectTypeOf } from 'vitest';
import { render, renderHook, screen, act, cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import { useDirection } from '../useDirection';
import { WaveProvider } from '../../components/provider/WaveProvider';

function Probe() {
  return <span data-testid="dir">{useDirection()}</span>;
}

describe('useDirection', () => {
  afterEach(() => {
    // Unmount first: a hook outside a provider observes the document direction, so resetting it
    // while the hook is still mounted would re-render the hook outside act().
    cleanup();
    document.documentElement.removeAttribute('dir');
    document.dir = '';
  });

  it('returns the WaveProvider direction', () => {
    render(
      <WaveProvider dir="rtl">
        <Probe />
      </WaveProvider>,
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
  });

  it('returns the nearest provider direction when providers are nested', () => {
    render(
      <WaveProvider dir="rtl">
        <WaveProvider dir="ltr">
          <Probe />
        </WaveProvider>
      </WaveProvider>,
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
  });

  it('defaults to ltr outside a provider', () => {
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('ltr');
  });

  it('falls back to the document direction outside a provider (<html dir="rtl">)', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('rtl');
  });

  it('follows a change of the document direction outside a provider', async () => {
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('ltr');
    await act(async () => {
      document.documentElement.setAttribute('dir', 'rtl');
      // the MutationObserver callback runs in a microtask
      await Promise.resolve();
    });
    expect(result.current).toBe('rtl');
  });

  it('prefers the provider over the document direction', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    render(
      <WaveProvider dir="ltr">
        <Probe />
      </WaveProvider>,
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
  });

  it('is ltr on the server', () => {
    expect(renderToString(<Probe />)).toContain('ltr');
  });

  describe('inside a provider (button-provider#28)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function documentObserveCalls(spy: { mock: { calls: unknown[][] } }) {
      return spy.mock.calls.filter(
        ([target]) => target === document.documentElement || target === document.body,
      );
    }

    it('does not observe the document or compute its direction', () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
      const styleSpy = vi.spyOn(window, 'getComputedStyle');
      const { rerender } = render(
        <WaveProvider dir="rtl">
          <Probe />
        </WaveProvider>,
      );
      rerender(
        <WaveProvider dir="rtl">
          <Probe />
          <Probe />
        </WaveProvider>,
      );
      expect(documentObserveCalls(observeSpy)).toHaveLength(0);
      expect(
        styleSpy.mock.calls.filter(
          ([el]) => el === document.body || el === document.documentElement,
        ),
      ).toHaveLength(0);
    });

    it('still observes the document outside a provider', () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
      renderHook(() => useDirection());
      expect(documentObserveCalls(observeSpy).length).toBeGreaterThan(0);
    });
  });

  describe('for an element: useDirection(el) (layout#27)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** Reports the direction of its own rendered element (the Carousel call shape). */
    function ElementProbe({ testId, dir }: { testId: string; dir?: 'ltr' | 'rtl' }) {
      const [el, setEl] = React.useState<HTMLElement | null>(null);
      return (
        <span ref={setEl} data-testid={testId} dir={dir}>
          {useDirection(el)}
        </span>
      );
    }

    function documentWideObserveCalls(spy: { mock: { calls: unknown[][] } }) {
      return spy.mock.calls.filter(
        ([target, options]) =>
          target === document.documentElement &&
          (options as MutationObserverInit | undefined)?.subtree === true,
      );
    }

    it('follows an ancestor dir attribute of the given element, and later changes to it', async () => {
      const host = document.createElement('div');
      host.setAttribute('dir', 'rtl');
      const el = document.createElement('span');
      host.appendChild(el);
      document.body.appendChild(host);
      try {
        const { result } = renderHook(() => useDirection(el));
        expect(result.current).toBe('rtl');
        await act(async () => {
          host.setAttribute('dir', 'ltr');
        });
        expect(result.current).toBe('ltr');
      } finally {
        cleanup();
        host.remove();
      }
    });

    it('follows the element: an RTL section inside an LTR provider, and later dir changes', async () => {
      render(
        <WaveProvider dir="ltr">
          <section data-testid="section" dir="rtl">
            <ElementProbe testId="probe" />
          </section>
        </WaveProvider>,
      );
      expect(screen.getByTestId('probe')).toHaveTextContent('rtl');
      await act(async () => {
        screen.getByTestId('section').setAttribute('dir', 'ltr');
      });
      expect(screen.getByTestId('probe')).toHaveTextContent('ltr');
    });

    it('follows the element: an LTR section inside an RTL provider', () => {
      render(
        <WaveProvider dir="rtl">
          <ElementProbe testId="outside" />
          <section dir="ltr">
            <ElementProbe testId="inside" />
          </section>
        </WaveProvider>,
      );
      expect(screen.getByTestId('outside')).toHaveTextContent('rtl');
      expect(screen.getByTestId('inside')).toHaveTextContent('ltr');
    });

    it("uses the element's own dir attribute and follows changes to it", async () => {
      const { rerender } = render(
        <WaveProvider dir="ltr">
          <ElementProbe testId="probe" dir="rtl" />
        </WaveProvider>,
      );
      expect(screen.getByTestId('probe')).toHaveTextContent('rtl');
      rerender(
        <WaveProvider dir="ltr">
          <ElementProbe testId="probe" dir="ltr" />
        </WaveProvider>,
      );
      // The attribute changes in the commit; the shared observer reports it in a microtask.
      await act(async () => {});
      expect(screen.getByTestId('probe')).toHaveTextContent('ltr');
    });

    it('follows an ancestor dir outside a provider', () => {
      render(
        <div dir="rtl">
          <ElementProbe testId="probe" />
        </div>,
      );
      expect(screen.getByTestId('probe')).toHaveTextContent('rtl');
    });

    it('follows a change of the WaveProvider dir', async () => {
      const { rerender } = render(
        <WaveProvider dir="ltr">
          <ElementProbe testId="probe" />
        </WaveProvider>,
      );
      expect(screen.getByTestId('probe')).toHaveTextContent('ltr');
      rerender(
        <WaveProvider dir="rtl">
          <ElementProbe testId="probe" />
        </WaveProvider>,
      );
      await act(async () => {});
      expect(screen.getByTestId('probe')).toHaveTextContent('rtl');
    });

    it('falls back to the provider direction before the element mounts (null)', () => {
      const { result } = renderHook(() => useDirection(null), {
        wrapper: ({ children }) => <WaveProvider dir="rtl">{children}</WaveProvider>,
      });
      expect(result.current).toBe('rtl');
    });

    it('falls back to the document direction before the element mounts outside a provider', () => {
      document.documentElement.setAttribute('dir', 'rtl');
      const { result } = renderHook(() => useDirection(null));
      expect(result.current).toBe('rtl');
    });

    it('falls back to the provider direction on the server', () => {
      const html = renderToString(
        <WaveProvider dir="rtl">
          <ElementProbe testId="probe" />
        </WaveProvider>,
      );
      expect(html).toMatch(/data-testid="probe"[^>]*>rtl</);
      expect(renderToString(<ElementProbe testId="probe" />)).toMatch(/>ltr</);
    });

    it('shares one document observer between element subscribers', () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      render(
        <WaveProvider>
          <ElementProbe testId="a" />
          <ElementProbe testId="b" />
          <ElementProbe testId="c" />
        </WaveProvider>,
      );
      expect(documentWideObserveCalls(observe)).toHaveLength(1);
    });

    it('shares the observer with document subscribers outside a provider', () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      render(
        <>
          <Probe />
          <ElementProbe testId="a" />
          <ElementProbe testId="b" />
        </>,
      );
      expect(documentWideObserveCalls(observe)).toHaveLength(1);
      expect(observe.mock.calls.filter(([target]) => target === document.body)).toHaveLength(0);
    });

    it('disconnects the shared observer when the last subscriber unmounts', () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
      const { rerender, unmount } = render(
        <WaveProvider>
          <ElementProbe testId="a" />
          <ElementProbe testId="b" />
        </WaveProvider>,
      );
      rerender(
        <WaveProvider>
          <ElementProbe testId="a" />
        </WaveProvider>,
      );
      expect(disconnect).not.toHaveBeenCalled();
      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);

      // A later subscriber starts a new observer.
      render(
        <WaveProvider>
          <ElementProbe testId="c" />
        </WaveProvider>,
      );
      expect(documentWideObserveCalls(observe)).toHaveLength(2);
    });

    it('does not read the computed style on every render (cached until a dir attribute changes)', async () => {
      // No dir attribute anywhere: getDirection falls through to the computed style.
      const styleSpy = vi.spyOn(window, 'getComputedStyle');
      const { rerender } = render(<ElementProbe testId="probe" />);
      const probe = screen.getByTestId('probe');
      expect(probe).toHaveTextContent('ltr');
      const readsOfProbe = () => styleSpy.mock.calls.filter(([el]) => el === probe).length;
      const afterMount = readsOfProbe();

      rerender(<ElementProbe testId="probe" />);
      rerender(<ElementProbe testId="probe" />);
      rerender(<ElementProbe testId="probe" />);
      expect(readsOfProbe()).toBe(afterMount);

      // A dir change anywhere in the document invalidates the cache once.
      await act(async () => {
        document.documentElement.setAttribute('dir', 'rtl');
      });
      expect(probe).toHaveTextContent('rtl');
    });

    it('keeps the no-argument call shape unchanged (typed overload)', () => {
      expectTypeOf(useDirection).parameters.toEqualTypeOf<[el?: Element | null]>();
      expectTypeOf(useDirection).returns.toEqualTypeOf<'ltr' | 'rtl'>();
    });
  });
});
