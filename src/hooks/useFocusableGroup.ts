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
   * - `'limited'`: the group is one tab stop. Enter or F2 on it moves focus to its first tabbable
   *   element, Tab and Shift+Tab then move between the elements inside, Tab past the last one
   *   leaves the group, and Escape returns focus to the group.
   * - `'limited-trap-focus'`: as `'limited'`, but Tab past the last element wraps to the first and
   *   Shift+Tab before the first wraps to the last, until Escape.
   *
   * @default 'unlimited'
   */
  tabBehavior?: FocusableGroupTabBehavior;
}

/** Props to spread onto the group element (compose its handlers with your own). */
export interface FocusableGroupProps {
  /** Ref callback for the group element. */
  ref: React.RefCallback<HTMLElement>;
  /** The group is itself focusable. */
  tabIndex: 0;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onBlur: React.FocusEventHandler<HTMLElement>;
  /** Marks the element as a group: nested groups own their own contents. */
  'data-focusable-group': '';
}

/** Result of {@link useFocusableGroup}. */
export interface UseFocusableGroupResult {
  /** Spread onto the group element. */
  groupProps: FocusableGroupProps;
}

const GROUP_ATTRIBUTE = 'data-focusable-group';
const STAMP_ATTRIBUTE = 'data-focusable-group-tabindex';

/** The tabbable elements that belong to `group` itself: those of a nested group are its own. */
function ownedTabbables(group: HTMLElement): HTMLElement[] {
  return getTabbableElements(group).filter(
    (element) => element.parentElement?.closest(`[${GROUP_ATTRIBUTE}]`) === group,
  );
}

/** Takes the group's tabbable elements out of the Tab order, remembering their own tabindex. */
function stamp(group: HTMLElement): void {
  for (const element of ownedTabbables(group)) {
    element.setAttribute(STAMP_ATTRIBUTE, element.getAttribute('tabindex') ?? '');
    element.setAttribute('tabindex', '-1');
  }
}

/** Gives the stamped elements of the group back the tabindex they had. */
function unstamp(group: HTMLElement): void {
  for (const element of group.querySelectorAll<HTMLElement>(`[${STAMP_ATTRIBUTE}]`)) {
    if (element.parentElement?.closest(`[${GROUP_ATTRIBUTE}]`) !== group) continue;
    const original = element.getAttribute(STAMP_ATTRIBUTE);
    if (original) element.setAttribute('tabindex', original);
    else element.removeAttribute('tabindex');
    element.removeAttribute(STAMP_ATTRIBUTE);
  }
}

/**
 * A focusable group (Fluent's `useFocusableGroup`, tabster's groupper): one tab stop that holds
 * several focusable elements, so a long list of rich rows does not cost a Tab press per control.
 * With `tabBehavior: 'limited'` or `'limited-trap-focus'`, the elements inside are skipped by Tab
 * until Enter or F2 enters the group, and Escape (or moving focus away) leaves it again. A key
 * from a popup portaled out of the group, a key that belongs to a nested group and a key an inner
 * element already handled (`preventDefault()`, as an input consuming Escape does) are left alone.
 *
 * While the group is not entered, its tabbable elements, also those added later, get
 * `tabindex="-1"`; they get their own tabindex back on entering.
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
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  // Whether the group is entered (its elements are in the Tab order). Written in handlers and
  // effects only.
  const entered = React.useRef(false);

  React.useLayoutEffect(() => {
    if (!container || !limited) return;
    entered.current = false;
    stamp(container);
    const observer = new MutationObserver(() => {
      if (!entered.current) stamp(container);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      unstamp(container);
    };
  }, [container, limited]);

  const leave = (group: HTMLElement) => {
    entered.current = false;
    stamp(group);
  };

  const onKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!limited || event.defaultPrevented) return;
    const group = event.currentTarget;
    const target = event.target;
    // A key from a portaled popup, or from a nested group, is not this group's.
    if (!(target instanceof Element) || !group.contains(target)) return;
    if (target.closest(`[${GROUP_ATTRIBUTE}]`) !== group) return;
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

    if (target === group) {
      if (plain && (event.key === 'Enter' || event.key === 'F2')) {
        event.preventDefault();
        entered.current = true;
        unstamp(group);
        const first = getFirstTabbable(group);
        if (!first || !focusElement(first)) leave(group);
      }
      return;
    }

    if (plain && event.key === 'Escape') {
      event.preventDefault();
      leave(group);
      group.focus();
      return;
    }

    if (tabBehavior === 'limited-trap-focus' && entered.current && event.key === 'Tab') {
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

  const onBlur = useEventCallback((event: React.FocusEvent<HTMLElement>) => {
    if (!limited) return;
    const group = event.currentTarget;
    const next = event.relatedTarget;
    // Focus left for the group itself (Shift+Tab before the first element) or for somewhere
    // outside it: the elements are skipped again.
    if (next === group || (next instanceof Node && !group.contains(next))) leave(group);
  });

  const groupProps = React.useMemo<FocusableGroupProps>(
    () => ({
      ref: setContainer,
      tabIndex: 0,
      onKeyDown,
      onBlur,
      [GROUP_ATTRIBUTE]: '',
    }),
    [onKeyDown, onBlur],
  );

  return { groupProps };
}
