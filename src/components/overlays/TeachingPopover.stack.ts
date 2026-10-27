import * as React from 'react';

/**
 * The attribute that marks the slots of a centered `TeachingPopover.CarouselFooter` (its direct
 * children): the secondary button, the indicator (whose first element child is measured) and the
 * primary button.
 */
const CAROUSEL_FOOTER_SLOT = 'data-wave-carousel-footer-slot';

type CarouselFooterSlot = 'secondary' | 'indicator' | 'primary';

/** The slot element of `footer` named `slot`, if it is rendered. */
function slotOf(footer: HTMLElement, slot: CarouselFooterSlot): HTMLElement | null {
  for (const child of Array.from(footer.children)) {
    if (child.getAttribute(CAROUSEL_FOOTER_SLOT) === slot) return child as HTMLElement;
  }
  return null;
}

/** The elements whose width is measured: both button slots and the indicator itself. */
function measuredElements(footer: HTMLElement): {
  secondary: HTMLElement | null;
  indicator: HTMLElement | null;
  primary: HTMLElement | null;
} {
  const indicatorSlot = slotOf(footer, 'indicator');
  return {
    secondary: slotOf(footer, 'secondary'),
    indicator: (indicatorSlot?.firstElementChild as HTMLElement | null | undefined) ?? null,
    primary: slotOf(footer, 'primary'),
  };
}

/**
 * One footer's measurement: whether its one row (the indicator centred between the buttons) does
 * not fit. Read through `useSyncExternalStore`.
 */
class CarouselFooterStackStore {
  private stacked = false;
  private readonly listeners = new Set<() => void>();
  private observer: ResizeObserver | null = null;
  private readonly observed = new Set<Element>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): boolean => this.stacked;

  /** The server HTML and hydration use the one-row layout. */
  getServerSnapshot = (): boolean => false;

  /**
   * The rule. The slots of the buttons and the indicator are as wide as their content in both
   * layouts (the one row and the stacked rows), so the measurement does not depend on the layout
   * it is made in. The one row has three columns, the outer two of equal width: it fits when
   * twice the wider button, the indicator and the two gaps fit in the footer's content box. A row
   * that would need unequal columns stacks instead, so the indicator of a row is always centred.
   * A footer without a box (not displayed, or not laid out yet) has no room to compare and keeps
   * its layout.
   */
  measure(footer: HTMLElement): void {
    if (!footer.clientWidth) return;
    const { secondary, indicator, primary } = measuredElements(footer);
    let padding = 0;
    let gap = 0;
    const view = footer.ownerDocument.defaultView;
    if (view) {
      const style = view.getComputedStyle(footer);
      padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      gap = parseFloat(style.columnGap) || 0;
    }
    const available = footer.clientWidth - padding;
    const side = Math.max(secondary?.offsetWidth ?? 0, primary?.offsetWidth ?? 0);
    const needed = 2 * side + (indicator?.offsetWidth ?? 0) + 2 * gap;
    // Half a pixel of slack for fractional widths that the integer box sizes round.
    this.set(needed - available > 0.5);
  }

  /** Observes `footer` and the elements it measures until the returned teardown runs. */
  connect(footer: HTMLElement): () => void {
    const measure = () => this.measure(footer);
    if (typeof ResizeObserver !== 'undefined') {
      // Measured in the next animation frame: the layout change resizes the observed footer, which
      // the browser would report as a loop error if it happened while the observer delivers.
      let frame = 0;
      this.observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      });
      this.follow(footer);
      return () => {
        this.observer?.disconnect();
        this.observer = null;
        this.observed.clear();
        cancelAnimationFrame(frame);
      };
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    return () => {};
  }

  /** Keeps the observer on the footer and on the elements measured now (slots come and go). */
  follow(footer: HTMLElement): void {
    const observer = this.observer;
    if (!observer) return;
    const { secondary, indicator, primary } = measuredElements(footer);
    const current = new Set<Element>(
      [footer, secondary, indicator, primary].filter((el): el is HTMLElement => el !== null),
    );
    for (const el of Array.from(this.observed)) {
      if (current.has(el)) continue;
      observer.unobserve(el);
      this.observed.delete(el);
    }
    for (const el of current) {
      if (this.observed.has(el)) continue;
      observer.observe(el);
      this.observed.add(el);
    }
  }

  private set(stacked: boolean): void {
    if (stacked === this.stacked) return;
    this.stacked = stacked;
    for (const listener of Array.from(this.listeners)) listener();
  }
}

/**
 * Whether a centered `TeachingPopover.CarouselFooter` stacks: `false` (one row, the indicator
 * centred between the buttons) on the server, on the first client render and while that row fits;
 * `true` (the indicator on its own row above the buttons) while it does not. `footer` is the
 * footer element, held in state through a callback ref. With `enabled` false (the offset layout,
 * which wraps by itself) nothing is observed or measured and the result is `false`.
 */
export function useCarouselFooterStacked(footer: HTMLElement | null, enabled: boolean): boolean {
  const [store] = React.useState(() => new CarouselFooterStackStore());
  const stacked = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [, forceRender] = React.useReducer((count: number) => count + 1, 0);

  React.useLayoutEffect(() => {
    if (!enabled || !footer) return undefined;
    return store.connect(footer);
  }, [store, enabled, footer]);

  // After every commit, before paint: a step changes the buttons and the indicator without a
  // resize of the footer. useSyncExternalStore subscribes only in a passive effect, which can run
  // after the browser painted, so a change found here re-renders through `forceRender` (the
  // pattern of MessageBar's reflow).
  React.useLayoutEffect(() => {
    if (!enabled || !footer) return;
    store.follow(footer);
    const unsubscribe = store.subscribe(forceRender);
    store.measure(footer);
    unsubscribe();
  });

  return enabled && stacked;
}
