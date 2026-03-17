import * as React from 'react';

/**
 * Hook that implements the WAI-ARIA roving tabindex pattern for composite
 * widgets like RadioGroup, TabList, and Toolbar.
 *
 * Only one item in the group has `tabIndex={0}` (the active item); all
 * others have `tabIndex={-1}`. Arrow keys move focus between items.
 * Tab enters/leaves the group as a single stop.
 *
 * @param containerRef  Ref to the container element holding the items
 * @param options       Configuration for the roving behavior
 * @returns getTabIndex – call with an item's value to get its tabIndex
 */
/** Configuration options for the {@link useRovingTabIndex} hook. */
export interface UseRovingTabIndexOptions {
  /** Currently active (selected) value. */
  activeValue: string;
  /** All item values in DOM order. */
  items: string[];
  /**
   * Arrow key axis: `'horizontal'` uses Left/Right, `'vertical'` uses Up/Down, `'both'` uses all four.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /**
   * Whether arrow keys should wrap around at the ends.
   * @default true
   */
  loop?: boolean;
  /** Callback fired when focus moves to a new value. */
  onFocusMove?: (value: string) => void;
}

/**
 * Implements the WAI-ARIA roving tabindex pattern for composite widgets.
 *
 * Items must render `data-roving-value` attributes matching their value strings
 * so the hook can locate and focus them in the DOM.
 *
 * @param containerRef - Ref to the container element holding the focusable items.
 * @param options - Configuration for orientation, looping, and active value.
 * @returns An object with `handleKeyDown` (attach to the container) and `getTabIndex` (call per item).
 */
export function useRovingTabIndex(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseRovingTabIndexOptions,
) {
  const { activeValue, items, orientation = 'horizontal', loop = true, onFocusMove } = options;

  // Track the currently focused value (may differ from activeValue for tabs
  // where focus and selection can be separate)
  const focusedValueRef = React.useRef<string>(activeValue);

  // Sync focused value when active value changes externally
  React.useEffect(() => {
    focusedValueRef.current = activeValue;
  }, [activeValue]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const enabledItems = items;
      if (enabledItems.length === 0) return;

      let nextIdx: number | null = null;

      const isHorizontal = orientation === 'horizontal' || orientation === 'both';
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const currentIdx = enabledItems.indexOf(focusedValueRef.current);

      switch (e.key) {
        case 'ArrowRight':
          if (isHorizontal && currentIdx !== -1) nextIdx = currentIdx + 1;
          break;
        case 'ArrowLeft':
          if (isHorizontal && currentIdx !== -1) nextIdx = currentIdx - 1;
          break;
        case 'ArrowDown':
          if (isVertical && currentIdx !== -1) nextIdx = currentIdx + 1;
          break;
        case 'ArrowUp':
          if (isVertical && currentIdx !== -1) nextIdx = currentIdx - 1;
          break;
        case 'Home':
          nextIdx = 0;
          break;
        case 'End':
          nextIdx = enabledItems.length - 1;
          break;
        default:
          return; // Don't prevent default for unrelated keys
      }

      if (nextIdx === null) return;

      e.preventDefault();

      // Apply looping or clamping
      if (loop) {
        nextIdx = ((nextIdx % enabledItems.length) + enabledItems.length) % enabledItems.length;
      } else {
        nextIdx = Math.max(0, Math.min(enabledItems.length - 1, nextIdx));
        if (nextIdx === currentIdx) return;
      }

      const nextValue = enabledItems[nextIdx];
      focusedValueRef.current = nextValue;

      // Focus the target element
      const container = containerRef.current;
      if (container) {
        const target = container.querySelector<HTMLElement>(
          `[data-roving-value="${CSS.escape(nextValue)}"]`,
        );
        target?.focus();
      }

      onFocusMove?.(nextValue);
    },
    [items, orientation, loop, onFocusMove, containerRef],
  );

  /** Returns the tabIndex for a given item value */
  const getTabIndex = React.useCallback(
    (value: string): 0 | -1 => {
      // If the active item is in the list, only it gets tabIndex 0
      if (items.includes(activeValue)) {
        return value === activeValue ? 0 : -1;
      }
      // Fallback: first item gets tabIndex 0
      return value === items[0] ? 0 : -1;
    },
    [activeValue, items],
  );

  return { handleKeyDown, getTabIndex };
}
