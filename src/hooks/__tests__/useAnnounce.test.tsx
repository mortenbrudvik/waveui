import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import { announce, useAnnounce, __getAnnouncerText, __resetAnnouncer } from '../useAnnounce';

/** Resolves after the announcer's own next-frame callbacks (frames run in registration order). */
async function nextFrame() {
  await act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}

function getRoot(): HTMLElement | null {
  return document.querySelector('[data-wave-announcer]');
}

describe('useAnnounce / announce', () => {
  afterEach(() => {
    __resetAnnouncer();
  });

  it('creates the regions on the first announce() call and writes the message on the next frame', async () => {
    expect(getRoot()).toBeNull();
    announce('Cherry removed, 2 selected');

    const root = getRoot();
    expect(root).not.toBeNull();
    // The live region must exist before its content changes, so the first message waits a frame.
    expect(__getAnnouncerText('polite')).toBe('');

    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('Cherry removed, 2 selected');
  });

  it('renders a visually hidden container with a polite status region and an assertive region', () => {
    announce('x');
    const root = getRoot()!;
    expect(root.parentElement).toBe(document.body);
    expect(root.style.position).toBe('absolute');
    expect(root.style.width).toBe('1px');
    expect(root.style.overflow).toBe('hidden');

    const polite = root.querySelector('[role="status"]');
    expect(polite).toHaveAttribute('aria-live', 'polite');
    expect(polite).toHaveAttribute('aria-atomic', 'true');
    const assertive = root.querySelector('[aria-live="assertive"]');
    expect(assertive).not.toBeNull();
    expect(assertive).toHaveAttribute('aria-atomic', 'true');
  });

  it('creates the regions when the hook mounts, so later messages are written at once', async () => {
    const { result } = renderHook(() => useAnnounce());
    expect(getRoot()).not.toBeNull();
    await nextFrame();

    act(() => result.current('Tag added, 3 selected'));
    expect(__getAnnouncerText('polite')).toBe('Tag added, 3 selected');
  });

  it('does not lose a message announced in the same tick the regions are created', async () => {
    function Announcer() {
      const say = useAnnounce();
      React.useEffect(() => {
        say('Step 1 of 3');
      }, [say]);
      return null;
    }
    render(<Announcer />);
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('Step 1 of 3');
  });

  it('writes assertive messages to the assertive region', async () => {
    announce('Error', 'assertive');
    await nextFrame();
    expect(__getAnnouncerText('assertive')).toBe('Error');
    expect(__getAnnouncerText('polite')).toBe('');
  });

  it('clears and re-sets a repeated identical message on the next frame', async () => {
    announce('Saved');
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('Saved');

    announce('Saved');
    expect(__getAnnouncerText('polite')).toBe('');
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('Saved');
  });

  it('keeps a newer message sent in the same frame as a pending repeat', async () => {
    announce('Searching…');
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('Searching…');

    announce('Searching…');
    announce('3 results');
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('3 results');
  });

  it('keeps the region cleared until the next frame when a pending repeat is repeated again', async () => {
    announce('Saved');
    await nextFrame();

    announce('Saved');
    announce('Saved');
    expect(__getAnnouncerText('polite')).toBe('');
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('Saved');
  });

  it('keeps a pending repeat on the other politeness when a newer message is written', async () => {
    announce('Saved');
    announce('Error', 'assertive');
    await nextFrame();

    announce('Saved');
    announce('Retrying', 'assertive');
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('Saved');
    expect(__getAnnouncerText('assertive')).toBe('Retrying');
  });

  it('keeps a single container for every caller', () => {
    renderHook(() => useAnnounce());
    renderHook(() => useAnnounce());
    announce('a');
    expect(document.querySelectorAll('[data-wave-announcer]')).toHaveLength(1);
  });

  it('is reference counted: the last unmount removes the regions', () => {
    const first = renderHook(() => useAnnounce());
    const second = renderHook(() => useAnnounce());
    first.unmount();
    expect(getRoot()).not.toBeNull();
    second.unmount();
    expect(getRoot()).toBeNull();
    expect(__getAnnouncerText('polite')).toBe('');
  });

  it('survives StrictMode mount/unmount/mount', async () => {
    const { result } = renderHook(() => useAnnounce(), { wrapper: React.StrictMode });
    expect(getRoot()).not.toBeNull();
    await nextFrame();
    act(() => result.current('ok'));
    expect(__getAnnouncerText('polite')).toBe('ok');
  });

  it('re-creates the regions when they were removed from the document', async () => {
    announce('first');
    getRoot()!.remove();
    announce('second');
    expect(getRoot()).not.toBeNull();
    await nextFrame();
    expect(__getAnnouncerText('polite')).toBe('second');
  });

  it('returns a stable function', () => {
    const { result, rerender } = renderHook(() => useAnnounce());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('renders nothing on the server', () => {
    function Probe() {
      useAnnounce();
      return <span>ok</span>;
    }
    expect(renderToString(<Probe />)).toBe('<span>ok</span>');
  });
});

describe('announce — options (announce-1, foundation-30, foundation-31, foundation-32)', () => {
  /** Runs the frame and the end-of-task queue run, then `ms` of timers. */
  async function advance(ms: number) {
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    __resetAnnouncer();
    delete (document as { ariaNotify?: unknown }).ariaNotify;
    delete (document.body as { ariaNotify?: unknown }).ariaNotify;
    vi.useRealTimers();
  });

  it('keeps a call with an options object that sets only the politeness a plain call', async () => {
    announce('Plain');
    await advance(20);
    announce('Urgent', { politeness: 'assertive' });
    expect(__getAnnouncerText('assertive')).toBe('Urgent');
    // Written at once, as a plain call: no queue, no gap.
    announce('Again', { politeness: 'assertive' });
    expect(__getAnnouncerText('assertive')).toBe('Again');
  });

  it('reads an unknown politeness (untyped code) as polite', async () => {
    announce('Hello', { politeness: 'shout' as 'polite' });
    await advance(20);
    expect(__getAnnouncerText('polite')).toBe('Hello');
    expect(__getAnnouncerText('assertive')).toBe('');
  });

  describe('batchId', () => {
    it('reads only the latest message of a batch sent together', async () => {
      announce('3 results', { batchId: 'results' });
      announce('5 results', { batchId: 'results' });
      announce('8 results', { batchId: 'results' });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('8 results');
      // Nothing of the batch is left to read.
      await advance(2000);
      expect(__getAnnouncerText('polite')).toBe('8 results');
    });

    it('queues the messages of different batches and reads each, 400 ms apart', async () => {
      announce('Saved', { batchId: 'save' });
      announce('3 results', { batchId: 'results' });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('Saved');
      // Written on the frame (16 ms), so the gap ends at 416 ms.
      await advance(390);
      expect(__getAnnouncerText('polite')).toBe('Saved');
      await advance(10);
      expect(__getAnnouncerText('polite')).toBe('3 results');
    });

    it('replaces a message that still waits in the queue by a later one of its batch', async () => {
      announce('First', { batchId: 'a' });
      announce('3 results', { batchId: 'results' });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('First');
      // "3 results" waits for its turn: the next count takes its place.
      announce('5 results', { batchId: 'results' });
      await advance(400);
      expect(__getAnnouncerText('polite')).toBe('5 results');
      await advance(2000);
      expect(__getAnnouncerText('polite')).toBe('5 results');
    });

    it('does not replace a message without a batchId, nor one of another batch', async () => {
      announce('One', { batchId: 'a' });
      announce('Two', { batchId: 'b' });
      announce('Three', { priority: 0 });
      await advance(20);
      const read = [__getAnnouncerText('polite')];
      await advance(400);
      read.push(__getAnnouncerText('polite'));
      await advance(400);
      read.push(__getAnnouncerText('polite'));
      expect(read).toEqual(['One', 'Two', 'Three']);
    });

    it('writes to the region of its politeness', async () => {
      announce('Calm', { batchId: 'a' });
      announce('Alarm', { batchId: 'b', politeness: 'assertive' });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('Calm');
      await advance(400);
      expect(__getAnnouncerText('assertive')).toBe('Alarm');
    });
  });

  describe('priority', () => {
    it('reads a higher priority first among messages sent together', async () => {
      announce('Low', { priority: 0 });
      announce('Urgent', { priority: 2 });
      announce('Normal', { priority: 1 });
      await advance(20);
      const read = [__getAnnouncerText('polite')];
      await advance(400);
      read.push(__getAnnouncerText('polite'));
      await advance(400);
      read.push(__getAnnouncerText('polite'));
      expect(read).toEqual(['Urgent', 'Normal', 'Low']);
    });

    it('keeps the order of the calls among equal priorities', async () => {
      announce('A', { priority: 1 });
      announce('B', { priority: 1 });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('A');
      await advance(400);
      expect(__getAnnouncerText('polite')).toBe('B');
    });

    it('lets a message that arrives while others wait jump ahead of them by priority', async () => {
      announce('One', { priority: 0 });
      announce('Two', { priority: 0 });
      announce('Three', { priority: 0 });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('One');
      announce('Urgent', { priority: 5 });
      await advance(400);
      expect(__getAnnouncerText('polite')).toBe('Urgent');
      await advance(400);
      expect(__getAnnouncerText('polite')).toBe('Two');
    });

    it('treats a non-finite priority as 0', async () => {
      announce('NaN', { priority: Number.NaN });
      announce('One', { priority: 1 });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('One');
    });

    it('does not touch the order of plain calls: they are written at once', async () => {
      announce('First');
      await advance(20);
      announce('Second');
      expect(__getAnnouncerText('polite')).toBe('Second');
    });
  });

  describe('deferWhileTyping', () => {
    const type = (field: Element) => {
      act(() => {
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    it('writes at once when nobody has typed', async () => {
      announce('12 results', { deferWhileTyping: true });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('12 results');
    });

    it('holds the message until 700 ms after the last text entered into a field', async () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        announce('Ready');
        await advance(20);
        type(input);
        announce('12 results', { deferWhileTyping: true, batchId: 'results' });
        await advance(600);
        expect(__getAnnouncerText('polite')).toBe('Ready');
        // More typing starts the pause again.
        type(input);
        await advance(600);
        expect(__getAnnouncerText('polite')).toBe('Ready');
        await advance(100);
        expect(__getAnnouncerText('polite')).toBe('12 results');
      } finally {
        input.remove();
      }
    });

    it('lets a message that does not defer pass while another waits', async () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      try {
        announce('Ready');
        await advance(20);
        type(textarea);
        announce('12 results', { deferWhileTyping: true });
        announce('Saved', { priority: 1 });
        await advance(0);
        expect(__getAnnouncerText('polite')).toBe('Saved');
        await advance(2000);
        expect(__getAnnouncerText('polite')).toBe('12 results');
      } finally {
        textarea.remove();
      }
    });

    it('counts text entered into a contenteditable element, never into a button or a checkbox', async () => {
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      document.body.append(editable, checkbox);
      try {
        announce('Ready');
        await advance(20);
        type(checkbox);
        announce('Not held', { deferWhileTyping: true });
        await advance(0);
        expect(__getAnnouncerText('polite')).toBe('Not held');
        type(editable);
        announce('Held', { deferWhileTyping: true });
        await advance(600);
        expect(__getAnnouncerText('polite')).toBe('Not held');
        await advance(150);
        expect(__getAnnouncerText('polite')).toBe('Held');
      } finally {
        editable.remove();
        checkbox.remove();
      }
    });
  });

  describe('ariaNotify', () => {
    it('sends a plain message through the browser, not a live region', async () => {
      const notify = vi.fn();
      (document as { ariaNotify?: unknown }).ariaNotify = notify;
      announce('Saved', { ariaNotify: true });
      await advance(20);
      expect(notify).toHaveBeenCalledExactlyOnceWith('Saved', { priority: 'normal' });
      expect(__getAnnouncerText('polite')).toBe('');
    });

    it('maps a priority above 0 to a high notification, also through the queue', async () => {
      const notify = vi.fn();
      (document.body as { ariaNotify?: unknown }).ariaNotify = notify;
      announce('Failed', { ariaNotify: true, priority: 1 });
      await advance(20);
      expect(notify).toHaveBeenCalledExactlyOnceWith('Failed', { priority: 'high' });
    });

    it('falls back to the live regions where the browser has no ariaNotify, and without the option', async () => {
      announce('Saved', { ariaNotify: true });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('Saved');
      const notify = vi.fn();
      (document as { ariaNotify?: unknown }).ariaNotify = notify;
      announce('Plain call');
      await advance(20);
      expect(notify).not.toHaveBeenCalled();
      expect(__getAnnouncerText('polite')).toBe('Plain call');
    });

    it('keeps the queue rules for a notified message (batch, typing)', async () => {
      const notify = vi.fn();
      (document as { ariaNotify?: unknown }).ariaNotify = notify;
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        // Typing is tracked while the announcer exists.
        announce('Ready');
        await advance(20);
        act(() => {
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        announce('3 results', { ariaNotify: true, batchId: 'r', deferWhileTyping: true });
        announce('5 results', { ariaNotify: true, batchId: 'r', deferWhileTyping: true });
        await advance(600);
        expect(notify).not.toHaveBeenCalled();
        await advance(150);
        expect(notify).toHaveBeenCalledExactlyOnceWith('5 results', { priority: 'normal' });
      } finally {
        input.remove();
      }
    });
  });

  describe('lifecycle', () => {
    it('drops the queue and its timers when the regions are removed', async () => {
      announce('One', { priority: 0 });
      announce('Two', { priority: 0 });
      await advance(20);
      expect(__getAnnouncerText('polite')).toBe('One');
      __resetAnnouncer();
      await advance(2000);
      expect(document.querySelector('[data-wave-announcer]')).toBeNull();
    });

    it('keeps the waiting messages when the regions were removed from the document', async () => {
      announce('One', { priority: 0 });
      announce('Two', { priority: 0 });
      await advance(20);
      document.querySelector('[data-wave-announcer]')!.remove();
      announce('Three', { priority: 0 });
      await advance(2000);
      const read = __getAnnouncerText('polite');
      expect(['Two', 'Three']).toContain(read);
      expect(document.querySelectorAll('[data-wave-announcer]')).toHaveLength(1);
    });

    it('stops listening for typing when the regions go', async () => {
      const remove = vi.spyOn(document, 'removeEventListener');
      announce('x');
      __resetAnnouncer();
      expect(remove).toHaveBeenCalledWith('input', expect.any(Function), true);
      remove.mockRestore();
    });

    it('also works through the hook, once the caller has mounted', async () => {
      const { result } = renderHook(() => useAnnounce());
      await advance(20);
      act(() => {
        result.current('Hook', { batchId: 'h' });
      });
      await advance(0);
      expect(__getAnnouncerText('polite')).toBe('Hook');
    });
  });
});
