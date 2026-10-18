import * as React from 'react';
import { TAG_GROUP_SELECTOR, TAG_ITEM_SELECTOR } from '../data-display/TagGroup.context';

/*
 * The measuring of TagPicker's single-line layout (`overflow="count"`, D62): which tags give way
 * to the "+N" count. A store read through `useSyncExternalStore` (Overflow's pattern), connected
 * in a layout effect, so the first result renders before paint, with one ResizeObserver on the
 * control. Module-only.
 */

const EMPTY: ReadonlySet<string> = new Set<string>();

function getEmpty(): ReadonlySet<string> {
  return EMPTY;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/** A number of pixels from a computed length (`''` and `normal` are 0). */
function px(value: string): number {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

/** The elements the measuring reads. */
export interface TagOverflowElements {
  control: HTMLElement | null;
  group: HTMLElement | null;
  chip: HTMLElement | null;
  trigger: HTMLElement | null;
}

/** The hidden tag values of the single-line layout, and the tag widths seen while visible. */
class TagOverflowStore {
  private snapshot: ReadonlySet<string> = EMPTY;
  private readonly listeners = new Set<() => void>();
  /** Widths of the tags (by value), read while each was visible. */
  private readonly widths = new Map<string, number>();
  /** The chip's width at the last measure (0 while it does not render). */
  private chipWidth = 0;
  /** Whether the chip's next width change may measure once more (reset by every trigger). */
  private chipPassAllowed = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ReadonlySet<string> => this.snapshot;

  /** Shows every tag again (the layout wraps, or nothing is measured). */
  reset(): void {
    this.chipWidth = 0;
    this.chipPassAllowed = false;
    this.publish(EMPTY);
  }

  /** A measure from a trigger (connect, resize, new values): allows one chip pass after it. */
  measureFromTrigger(values: readonly string[], elements: TagOverflowElements): void {
    this.chipPassAllowed = true;
    this.measure(values, elements);
  }

  /**
   * After the chip rendered, unmounted or changed: measures once more when its width changed,
   * at most once per trigger, so a count that changes the chip's width cannot loop.
   */
  measureAfterChip(values: readonly string[], elements: TagOverflowElements): void {
    if (!this.chipPassAllowed) return;
    if ((elements.chip?.offsetWidth ?? 0) === this.chipWidth) return;
    this.chipPassAllowed = false;
    this.measure(values, elements);
  }

  /**
   * Measures and publishes the hidden values: the largest prefix of `values` whose tags (and the
   * gaps between them) fit the control's content width less the trigger's minimum width, the
   * chip's width and the gaps around them; at least one tag stays.
   */
  private measure(values: readonly string[], elements: TagOverflowElements): void {
    const { control, group, chip, trigger } = elements;
    const chipWidth = chip?.offsetWidth ?? 0;
    this.chipWidth = chipWidth;
    if (!control || !group || control.clientWidth === 0) {
      // No layout (the server, a hidden picker): every tag shows.
      this.publish(EMPTY);
      return;
    }
    const view = control.ownerDocument.defaultView;
    const controlStyle = view?.getComputedStyle(control);
    const groupStyle = view?.getComputedStyle(group);
    const controlGap = px(controlStyle?.columnGap ?? '');
    const tagGap = px(groupStyle?.columnGap ?? '');
    const triggerMin = trigger ? px(view?.getComputedStyle(trigger).minWidth ?? '') : 0;
    // The group and the trigger, plus the chip while it renders: one gap between each.
    const outerGaps = chip ? 2 : 1;
    const available =
      control.clientWidth -
      px(controlStyle?.paddingLeft ?? '') -
      px(controlStyle?.paddingRight ?? '') -
      triggerMin -
      chipWidth -
      controlGap * outerGaps;

    // The tags of this group in DOM order, which is the order of the selected values.
    const tags = Array.from(group.querySelectorAll<HTMLElement>(TAG_ITEM_SELECTOR)).filter(
      (element) => element.parentElement?.closest(TAG_GROUP_SELECTOR) === group,
    );
    values.forEach((value, index) => {
      const tag = tags[index];
      if (tag && !tag.hidden) this.widths.set(value, tag.offsetWidth);
    });

    let used = 0;
    let visible = 0;
    for (const value of values) {
      const width = this.widths.get(value) ?? 0;
      const next = used + (visible > 0 ? tagGap : 0) + width;
      if (visible > 0 && next > available) break;
      used = next;
      visible++;
    }
    this.publish(visible >= values.length ? EMPTY : new Set(values.slice(visible)));
  }

  private publish(next: ReadonlySet<string>): void {
    if (sameSet(next, this.snapshot)) return;
    this.snapshot = next;
    for (const listener of Array.from(this.listeners)) listener();
  }
}

/** Options of {@link useTagOverflow}. */
export interface UseTagOverflowOptions {
  /** Whether the tags stay on one line (count mode while collapsed); otherwise nothing is measured. */
  active: boolean;
  /** The selected values, in tag order. */
  values: readonly string[];
  control: React.RefObject<HTMLElement | null>;
  group: React.RefObject<HTMLElement | null>;
  chip: React.RefObject<HTMLElement | null>;
  trigger: React.RefObject<HTMLElement | null>;
}

/**
 * The values of the tags that give way to the "+N" count while TagPicker's single-line layout is
 * active (`undefined` otherwise). It measures when it becomes active, on a resize of the control
 * (one ResizeObserver, created only while active), when the selected values change, and once more
 * when the chip's width changes; it publishes only when the hidden set changes. The server render
 * and the first client render hide nothing.
 */
export function useTagOverflow(options: UseTagOverflowOptions): ReadonlySet<string> | undefined {
  const { active, values, control, group, chip, trigger } = options;
  const [store] = React.useState(() => new TagOverflowStore());
  const hidden = React.useSyncExternalStore(store.subscribe, store.getSnapshot, getEmpty);
  const valuesKey = values.join('\u0000');
  const valuesRef = React.useRef(values);

  React.useLayoutEffect(() => {
    valuesRef.current = values;
  });

  React.useLayoutEffect(() => {
    if (!active) {
      store.reset();
      return undefined;
    }
    const elements = (): TagOverflowElements => ({
      control: control.current,
      group: group.current,
      chip: chip.current,
      trigger: trigger.current,
    });
    const measure = () => store.measureFromTrigger(valuesRef.current, elements());
    measure();
    const observed = control.current;
    if (!observed || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(observed);
    return () => observer.disconnect();
    // `valuesKey` re-measures when the selected values change (compared by content).
  }, [active, valuesKey, store, control, group, chip, trigger]);

  // The chip mounts, unmounts or changes its text after a measure: when its width changed, measure
  // once more (a second change in that pass is left for the next trigger, so nothing loops).
  const hiddenCount = hidden.size;
  React.useLayoutEffect(() => {
    if (!active) return;
    store.measureAfterChip(valuesRef.current, {
      control: control.current,
      group: group.current,
      chip: chip.current,
      trigger: trigger.current,
    });
  }, [active, hiddenCount, store, control, group, chip, trigger]);

  return active ? hidden : undefined;
}
