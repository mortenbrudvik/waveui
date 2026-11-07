import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useObservedElement } from '../useObservedElement';
import { useFocusObserved } from '../useFocusObserved';
import { getObservedElement, focusObservedElement } from '../../lib/observedElements';
import { Button } from '../../components/button/Button';
import { Input } from '../../components/input/Input';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Panel({
  names = 'target',
  mounted = true,
  disabled = false,
}: {
  names?: string | readonly string[];
  mounted?: boolean;
  disabled?: boolean;
}) {
  const observed = useObservedElement(names);
  return mounted ? (
    <button type="button" disabled={disabled} {...observed}>
      Target
    </button>
  ) : null;
}

function Focuser({
  name = 'target',
  timeout,
  onRequest,
}: {
  name?: string;
  timeout?: number;
  onRequest?: (request: ReturnType<ReturnType<typeof useFocusObserved>>) => void;
}) {
  const focus = useFocusObserved(name, { timeout });
  return (
    <button type="button" onClick={() => onRequest?.(focus())}>
      Go
    </button>
  );
}

describe('useObservedElement and useFocusObserved (foundation-29)', () => {
  it('focuses the element that has the name', async () => {
    let request: ReturnType<ReturnType<typeof useFocusObserved>> | undefined;
    render(
      <>
        <Panel />
        <Focuser onRequest={(r) => (request = r)} />
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Go' }).click());
    await expect(request!.result).resolves.toBe(true);
    expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
  });

  it('waits for an element that mounts later, within the timeout', async () => {
    let request: ReturnType<ReturnType<typeof useFocusObserved>> | undefined;
    const { rerender } = render(
      <>
        <Panel mounted={false} />
        <Focuser onRequest={(r) => (request = r)} />
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Go' }).click());
    act(() => void vi.advanceTimersByTime(300));
    rerender(
      <>
        <Panel mounted />
        <Focuser onRequest={(r) => (request = r)} />
      </>,
    );
    await expect(request!.result).resolves.toBe(true);
    expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
  });

  it('retries while the element exists but cannot take focus yet', async () => {
    let request: ReturnType<ReturnType<typeof useFocusObserved>> | undefined;
    const { rerender } = render(
      <>
        <Panel disabled />
        <Focuser onRequest={(r) => (request = r)} />
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Go' }).click());
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.getByRole('button', { name: 'Target' })).not.toHaveFocus();
    rerender(
      <>
        <Panel />
        <Focuser onRequest={(r) => (request = r)} />
      </>,
    );
    act(() => void vi.advanceTimersByTime(60));
    await expect(request!.result).resolves.toBe(true);
    expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
  });

  it('resolves false when the time is up, and a timeout of 0 makes one attempt', async () => {
    let request: ReturnType<ReturnType<typeof useFocusObserved>> | undefined;
    render(<Focuser name="missing" timeout={500} onRequest={(r) => (request = r)} />);
    act(() => screen.getByRole('button', { name: 'Go' }).click());
    act(() => void vi.advanceTimersByTime(499));
    let settled = false;
    void request!.result.then(() => (settled = true));
    await act(async () => {});
    expect(settled).toBe(false);
    act(() => void vi.advanceTimersByTime(2));
    await expect(request!.result).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    const immediate = focusObservedElement('missing', 0);
    await expect(immediate.result).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancel() settles false and stops the waiting', async () => {
    const request = focusObservedElement('missing', 5000);
    request.cancel();
    await expect(request.result).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    request.cancel();
  });

  it('cancels a request that is still waiting when the component unmounts', async () => {
    let request: ReturnType<ReturnType<typeof useFocusObserved>> | undefined;
    const { unmount } = render(
      <Focuser name="missing" timeout={5000} onRequest={(r) => (request = r)} />,
    );
    act(() => screen.getByRole('button', { name: 'Go' }).click());
    unmount();
    await expect(request!.result).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives an element several names, and a name may belong to several elements (the latest wins)', () => {
    const { rerender } = render(
      <>
        <Panel names={['one', 'two']} />
      </>,
    );
    const first = screen.getByRole('button', { name: 'Target' });
    expect(getObservedElement('one')).toBe(first);
    expect(getObservedElement('two')).toBe(first);

    function Second() {
      const observed = useObservedElement('one');
      return (
        <button type="button" {...observed}>
          Second
        </button>
      );
    }
    rerender(
      <>
        <Panel names={['one', 'two']} />
        <Second />
      </>,
    );
    expect(getObservedElement('one')).toBe(screen.getByRole('button', { name: 'Second' }));
    expect(getObservedElement('two')).toBe(first);
  });

  it('follows a change of the name and forgets the name when the element unmounts', () => {
    const { rerender, unmount } = render(<Panel names="old" />);
    expect(getObservedElement('old')).not.toBeNull();
    rerender(<Panel names="new" />);
    expect(getObservedElement('old')).toBeNull();
    expect(getObservedElement('new')).toBe(screen.getByRole('button', { name: 'Target' }));
    unmount();
    expect(getObservedElement('new')).toBeNull();
  });

  it('keeps its ref while the names are equal, however they are written', () => {
    const refs: unknown[] = [];
    function Probe({ names }: { names: readonly string[] }) {
      refs.push(useObservedElement(names).ref);
      return null;
    }
    const { rerender } = render(<Probe names={['a', 'b']} />);
    rerender(<Probe names={['a', 'b']} />);
    expect(refs[1]).toBe(refs[0]);
    rerender(<Probe names={['b', 'a']} />);
    expect(refs[2]).not.toBe(refs[0]);
  });

  it('does not take a name from an element that is not connected any more', () => {
    const { unmount } = render(<Panel names="gone" />);
    const element = getObservedElement('gone')!;
    unmount();
    expect(element.isConnected).toBe(false);
    expect(getObservedElement('gone')).toBeNull();
  });

  it('works with the ref of a Wave component, which reaches its focusable element', async () => {
    function Wired() {
      const observed = useObservedElement('wave-input');
      return <Input aria-label="Name" {...observed} />;
    }
    render(<Wired />);
    const request = focusObservedElement('wave-input', 0);
    await expect(request.result).resolves.toBe(true);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('works on a Wave Button spread, under StrictMode, focusing once the element has mounted', async () => {
    function Wired() {
      const observed = useObservedElement('strict');
      const focus = useFocusObserved('strict');
      React.useEffect(() => {
        void focus();
      }, [focus]);
      return <Button {...observed}>Strict</Button>;
    }
    render(
      <React.StrictMode>
        <Wired />
      </React.StrictMode>,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Strict' })).toHaveFocus();
    expect(getObservedElement('strict')).toBe(screen.getByRole('button', { name: 'Strict' }));
  });

  it('passes scrollIntoView=false as preventScroll to focus()', async () => {
    render(<Panel names="scroll" />);
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    function Quiet() {
      const request = useFocusObserved('scroll', { scrollIntoView: false, timeout: 0 });
      React.useEffect(() => {
        void request();
      }, [request]);
      return null;
    }
    render(<Quiet />);
    await act(async () => {});
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('keeps the request function while name and options do, and changes it with them', () => {
    const seen: unknown[] = [];
    function Probe({ name, timeout }: { name: string; timeout: number }) {
      seen.push(useFocusObserved(name, { timeout }));
      return null;
    }
    const { rerender } = render(<Probe name="a" timeout={10} />);
    rerender(<Probe name="a" timeout={10} />);
    expect(seen[1]).toBe(seen[0]);
    rerender(<Probe name="b" timeout={10} />);
    expect(seen[2]).not.toBe(seen[0]);
  });

  it('renders on the server without touching the registry', () => {
    expect(renderToString(<Panel names="ssr" />)).toContain('Target');
    expect(getObservedElement('ssr')).toBeNull();
  });
});
