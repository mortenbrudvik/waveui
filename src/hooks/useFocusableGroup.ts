import * as React from 'react';
import { focusElement, getFirstTabbable, getTabbableElements } from '../lib/focus';
import { useEventCallback } from './useEventCallback';

/** How Tab and Enter treat the elements inside a focusable group. */
export type FocusableGroupTabBehavior = 'unlimited' | 'limited' | 'limited-trap-focus';

/** Options of {@link useFocusableGroup}. */
export interface UseFocusableGroupOptions {
  /**
   * How the group treats the elements inside it (Fluent's `tabBehavior`):
   *
   * - `'unlimited'`: the group is one more tab stop and the elements inside it stay reachable by
   *   Tab; no key is intercepted.
   * - `'limited'`: the group is one tab stop, in both directions. Enter or F2 on it moves focus to
   *   its first tabbable element, Tab and Shift+Tab then move between the elements inside, Tab
   *   past the last one leaves the group, and Escape returns focus to the group.
   * - `'limited-trap-focus'`: as `'limited'`, but Tab past the last element wraps to the first and
   *   Shift+Tab before the first wraps to the last, until Escape.
   *
   * @default 'unlimited'
   */
  tabBehavior?: FocusableGroupTabBehavior;
}

/** Props to spread onto the group element (compose its handlers with your own). */
export interface FocusableGroupProps {
  /** The group is itself focusable. */
  tabIndex: 0;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onFocusCapture: React.FocusEventHandler<HTMLElement>;
  /** Marks the element as a group: nested groups own their own contents. */
  'data-focusable-group': '';
}

/** Result of {@link useFocusableGroup}. */
export interface UseFocusableGroupResult {
  /** Spread onto the group element. */
  groupProps: FocusableGroupProps;
}

const GROUP_ATTRIBUTE = 'data-focusable-group';

/** Focus events a group has already redirected, so a group nested in it does not redirect again. */
const redirected = new WeakSet<Event>();

/** The group that owns `element`: the nearest group element above it. */
function owningGroup(element: Element): Element | null {
  return element.closest(`[${GROUP_ATTRIBUTE}]`);
}

/** The first tabbable element after the group's own subtree in document order, or `null`. */
function firstTabbableAfter(group: HTMLElement): HTMLElement | null {
  const candidates = getTabbableElements(group.ownerDocument.body);
  return (
    candidates.find(
      (element) =>
        !group.contains(element) &&
        (group.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ) ?? null
  );
}

/**
 * A focusable group (Fluent's `useFocusableGroup`, tabster's groupper): one tab stop that holds
 * several focusable elements, so a long list of rich rows does not cost a Tab press per control.
 * With `tabBehavior: 'limited'` or `'limited-trap-focus'`, Tab skips the elements inside while focus
 * is on the group element itself, and Shift+Tab from outside lands on the group element instead of
 * its last element; Enter or F2 enters the group, and Escape leaves it. A group is entered while
 * focus is on an element inside it, however it got there (a click, a popup returning focus, a
 * script). No tabindex is rewritten: components with their own tab stops (Toolbar, TabList) work
 * inside a group. A key from a popup portaled out of the group, a key that belongs to a nested
 * group and a key an inner element already handled (`preventDefault()`, as an input consuming
 * Escape does) are left alone.
 *
 * @example
 * const { groupProps } = useFocusableGroup({ tabBehavior: 'limited' });
 * <li role="group" aria-label="Message" {...groupProps}>
 *   <button>Reply</button> <button>Forward</button>
 * </li>
 */
export function useFocusableGroup(options: UseFocusableGroupOptions = {}): UseFocusableGroupResult {
  const { tabBehavior = 'unlimited' } = options;
  const limited = tabBehavior !== 'unlimited';
  // Whether the focus that is arriving was caused by Shift+Tab (written by document listeners).
  const pendingShiftTab = React.useRef(false);
  const arrivedByShiftTab = React.useRef(false);

  React.useEffect(() => {
    if (!limited) return;
    const onKeyDown = (event: KeyboardEvent) => {
      pendingShiftTab.current = event.key === 'Tab' && event.shiftKey;
    };
    const onFocusIn = () => {
      arrivedByShiftTab.current = pendingShiftTab.current;
      pendingShiftTab.current = false;
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [limited]);

  const onKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!limited || event.defaultPrevented) return;
    const group = event.currentTarget;
    const target = event.target;
    // A key from a portaled popup, or from a nested group, is not this group's.
    if (!(target instanceof Element) || !group.contains(target)) return;
    if (owningGroup(target) !== group) return;
    const modified = event.altKey || event.ctrlKey || event.metaKey;

    if (target === group) {
      if (modified) return;
      if (!event.shiftKey && (event.key === 'Enter' || event.key === 'F2')) {
        const first = getFirstTabbable(group);
        if (first && focusElement(first)) event.preventDefault();
      } else if (!event.shiftKey && event.key === 'Tab') {
        // One tab stop: skip the elements inside.
        const next = firstTabbableAfter(group);
        if (next && focusElement(next)) event.preventDefault();
      } else if (!event.shiftKey && event.key === 'Escape') {
        // A nested group's Escape goes to the group around it.
        const parent = group.parentElement ? owningGroup(group.parentElement) : null;
        if (parent instanceof HTMLElement) {
          event.preventDefault();
          parent.focus();
        }
      }
      return;
    }

    if (modified) return;
    if (!event.shiftKey && event.key === 'Escape') {
      event.preventDefault();
      group.focus();
      return;
    }

    if (tabBehavior === 'limited-trap-focus' && event.key === 'Tab') {
      const tabbables = getTabbableElements(group);
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      if (!event.shiftKey && target === last && first) {
        event.preventDefault();
        focusElement(first);
      } else if (event.shiftKey && target === first && last) {
        event.preventDefault();
        focusElement(last);
      }
    }
  });

  // Capture phase: the outermost group sees the focus first, and a group inside it stands down.
  const onFocusCapture = useEventCallback((event: React.FocusEvent<HTMLElement>) => {
    if (!limited || redirected.has(event.nativeEvent)) return;
    const group = event.currentTarget;
    const target = event.target;
    const from = event.relatedTarget;
    if (target === group || !(target instanceof Node) || !group.contains(target)) return;
    // Focus that arrives from outside by Shift+Tab lands on the group element, not on its last
    // element. Any other arrival (a click, a script, a popup returning focus) enters the group.
    if (!arrivedByShiftTab.current || !(from instanceof Node) || group.contains(from)) return;
    redirected.add(event.nativeEvent);
    group.focus();
  });

  const groupProps = React.useMemo<FocusableGroupProps>(
    () => ({
      tabIndex: 0,
      onKeyDown,
      onFocusCapture,
      [GROUP_ATTRIBUTE]: '',
    }),
    [onKeyDown, onFocusCapture],
  );

  return { groupProps };
}
