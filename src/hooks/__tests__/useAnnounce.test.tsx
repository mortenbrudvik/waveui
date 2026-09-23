import { describe, it, expect, afterEach } from 'vitest';
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
