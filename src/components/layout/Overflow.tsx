import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the Overflow component. */
export interface OverflowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render function for the overflow button, receiving the count of hidden items. */
  overflowButton?: (count: number) => React.ReactNode;
  /** Child elements to monitor for overflow. */
  children: React.ReactNode;
}

/** Properties for the OverflowItem sub-component. */
export interface OverflowItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique identifier for tracking this item's overflow visibility. */
  itemId: string;
  /** Content of the overflow item. */
  children: React.ReactNode;
}

interface OverflowContextValue {
  registerItem: (id: string, el: HTMLElement) => void;
  unregisterItem: (id: string) => void;
  hiddenIds: Set<string>;
}

const OverflowContext = React.createContext<OverflowContextValue>({
  registerItem: () => {},
  unregisterItem: () => {},
  hiddenIds: new Set(),
});

/**
 * Hook that returns whether the overflow container is currently overflowing.
 */
export function useIsOverflowing(ref: React.RefObject<HTMLElement | null>): boolean {
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return isOverflowing;
}

const OverflowRoot = React.forwardRef<HTMLDivElement, OverflowProps>(
  ({ overflowButton, children, className, ...rest }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const itemsMap = React.useRef<Map<string, HTMLElement>>(new Map());
    const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set());

    // Merge refs
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    const calculateOverflow = React.useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      // Reserve space for the more button (approx 60px)
      const moreButtonWidth = 60;
      let usedWidth = 0;
      const newHidden = new Set<string>();

      // Iterate items in DOM order
      const entries = Array.from(itemsMap.current.entries());
      for (let i = 0; i < entries.length; i++) {
        const [id, el] = entries[i];
        // Temporarily make visible to measure
        el.style.visibility = 'visible';
        el.style.position = 'static';
        el.style.width = '';
        el.style.height = '';
        const width = el.offsetWidth;

        if (i !== 0 && usedWidth + width > containerWidth - moreButtonWidth) {
          newHidden.add(id);
        } else {
          usedWidth += width;
        }
      }

      // If nothing is hidden, no need for more button space - recalculate
      if (newHidden.size === 0) {
        let totalWidth = 0;
        const recheck = new Set<string>();
        for (const [id, el] of entries) {
          totalWidth += el.offsetWidth;
          if (totalWidth > containerWidth) {
            recheck.add(id);
          }
        }
        setHiddenIds(recheck);
      } else {
        setHiddenIds(newHidden);
      }
    }, []);

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(() => {
        calculateOverflow();
      });
      observer.observe(container);
      // Also observe when children change
      calculateOverflow();
      return () => observer.disconnect();
    }, [calculateOverflow, children]);

    const pendingRecalcRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const deferredRecalc = React.useCallback(() => {
      if (pendingRecalcRef.current) clearTimeout(pendingRecalcRef.current);
      pendingRecalcRef.current = setTimeout(() => {
        pendingRecalcRef.current = null;
        calculateOverflow();
      }, 0);
    }, [calculateOverflow]);

    // Clean up deferred timer on unmount
    React.useEffect(() => {
      return () => {
        if (pendingRecalcRef.current) clearTimeout(pendingRecalcRef.current);
      };
    }, []);

    const registerItem = React.useCallback(
      (id: string, el: HTMLElement) => {
        itemsMap.current.set(id, el);
        deferredRecalc();
      },
      [deferredRecalc],
    );

    const unregisterItem = React.useCallback(
      (id: string) => {
        itemsMap.current.delete(id);
        deferredRecalc();
      },
      [deferredRecalc],
    );

    const ctx = React.useMemo(
      () => ({ registerItem, unregisterItem, hiddenIds }),
      [registerItem, unregisterItem, hiddenIds],
    );

    const hiddenCount = hiddenIds.size;

    return (
      <OverflowContext.Provider value={ctx}>
        <div
          ref={mergedRef}
          className={cn('flex items-center overflow-hidden', className)}
          {...rest}
        >
          {children}
          {hiddenCount > 0 && overflowButton && (
            <div className="flex-shrink-0 ml-1">{overflowButton(hiddenCount)}</div>
          )}
        </div>
      </OverflowContext.Provider>
    );
  },
);
OverflowRoot.displayName = 'Overflow';

export const OverflowItem = React.forwardRef<HTMLDivElement, OverflowItemProps>(
  ({ itemId, children, className, style, ...rest }, ref) => {
    const { registerItem, unregisterItem, hiddenIds } = React.useContext(OverflowContext);
    const itemRef = React.useRef<HTMLDivElement>(null);
    const isHidden = hiddenIds.has(itemId);

    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    React.useEffect(() => {
      const el = itemRef.current;
      if (el) {
        registerItem(itemId, el);
      }
      return () => unregisterItem(itemId);
    }, [itemId, registerItem, unregisterItem]);

    return (
      <div
        ref={mergedRef}
        className={cn('flex-shrink-0', className)}
        style={{
          ...style,
          ...(isHidden
            ? {
                visibility: 'hidden' as const,
                position: 'absolute' as const,
                width: 0,
                height: 0,
                overflow: 'hidden',
              }
            : {}),
        }}
        aria-hidden={isHidden || undefined}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
OverflowItem.displayName = 'OverflowItem';

export const Overflow = Object.assign(OverflowRoot, {
  Item: OverflowItem,
});
