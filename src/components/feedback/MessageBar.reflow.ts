import * as React from 'react';

/** The layout an `'auto'` MessageBar with actions renders. */
export type MessageBarReflowLayout = 'singleline' | 'multiline';

/**
 * One bar's measurement (spec D17): whether its text needs the multiline layout, and the bar width
 * at which the text fits on one line again. Read through `useSyncExternalStore`.
 */
class MessageBarReflowStore {
  private reflowing = false;
  /** The bar's client width at which its text fits on one line. */
  private neededWidth = 0;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): MessageBarReflowLayout => (this.reflowing ? 'multiline' : 'singleline');

  /** The server HTML and hydration use the one-row layout. */
  getServerSnapshot = (): MessageBarReflowLayout => 'singleline';

  /**
   * The two-way rule. One row: text wider than its column (`scrollWidth > clientWidth`; the column
   * does not wrap while measured) switches to multiline and remembers the bar width it needed,
   * `root.clientWidth + text.scrollWidth - text.clientWidth`. Multiline: a bar at least that wide
   * switches back.
   */
  measure(root: HTMLElement, text: HTMLElement): void {
    if (this.reflowing) {
      if (root.clientWidth < this.neededWidth) return;
      this.reflowing = false;
      this.neededWidth = 0;
    } else {
      const overflow = text.scrollWidth - text.clientWidth;
      if (overflow <= 0) return;
      this.reflowing = true;
      this.neededWidth = root.clientWidth + overflow;
    }
    this.emit();
  }

  /** Forgets the measurement: the next render uses the one-row layout and measures again. */
  reset(notify = true): void {
    if (!this.reflowing) return;
    this.reflowing = false;
    this.neededWidth = 0;
    if (notify) this.emit();
  }

  /**
   * Observes `root` and `text` until the returned teardown runs, which also forgets the
   * measurement.
   * - The root's size (a ResizeObserver): measured in the next animation frame, so the layout
   *   change never resizes the observed root while the observer is still delivering (browsers
   *   report that as a loop error). Without ResizeObserver: window size changes.
   * - Text changed inside the column without a render of the bar (a MutationObserver): measured at
   *   once in the one-row layout; in the multiline layout the measurement starts over from the
   *   one-row layout (the render that follows measures before paint).
   */
  connect(root: HTMLElement, text: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];
    const measure = () => this.measure(root, text);
    if (typeof ResizeObserver !== 'undefined') {
      let frame = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      });
      observer.observe(root, { box: 'border-box' });
      cleanups.push(() => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      });
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      cleanups.push(() => window.removeEventListener('resize', measure));
    }
    if (typeof MutationObserver !== 'undefined') {
      const mutations = new MutationObserver(() => {
        if (this.reflowing) this.reset();
        else measure();
      });
      mutations.observe(text, { childList: true, subtree: true, characterData: true });
      cleanups.push(() => mutations.disconnect());
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
      // Silent: on unmount the layout cleanups run before useSyncExternalStore unsubscribes, and a
      // notification would schedule an update on a deleted fiber. A bar that stays mounted reads
      // the reset snapshot on its next render (useSyncExternalStore re-checks it after each commit).
      this.reset(false);
    };
  }

  private emit(): void {
    for (const listener of Array.from(this.listeners)) listener();
  }
}

/**
 * The layout of a MessageBar with `layout="auto"` and actions: `'singleline'` on the server, on the
 * first client render and while the text fits on one line; `'multiline'` otherwise. `root` is the
 * bar's root element and `text` its text column, both held in state through callback refs
 * (C-POPUPS). With `enabled` false (every other bar) nothing is observed or measured and the result
 * is `'singleline'`.
 */
export function useMessageBarReflow(
  root: HTMLElement | null,
  text: HTMLElement | null,
  enabled: boolean,
): MessageBarReflowLayout {
  const [store] = React.useState(() => new MessageBarReflowStore());
  const layout = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [, forceRender] = React.useReducer((count: number) => count + 1, 0);

  // The observers follow the elements. Their teardown forgets the measurement, so a bar that
  // measures again (its actions back, or `layout` back to 'auto') starts from one row.
  React.useLayoutEffect(() => {
    if (!enabled || !root || !text) return undefined;
    return store.connect(root, text);
  }, [store, enabled, root, text]);

  // After every commit in the one-row layout, before paint: useSyncExternalStore subscribes only in
  // a passive effect, which can run after the browser painted, so a change found here re-renders
  // through `forceRender` (the pattern of Overflow's `useIsOverflowing`).
  React.useLayoutEffect(() => {
    if (!enabled || !root || !text || store.getSnapshot() !== 'singleline') return;
    const unsubscribe = store.subscribe(forceRender);
    store.measure(root, text);
    unsubscribe();
  });

  return enabled ? layout : 'singleline';
}
