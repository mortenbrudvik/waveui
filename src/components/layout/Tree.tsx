import * as React from 'react';
import { cn } from '../../lib/cn';

/* ------------------------------------------------------------------ */
/*  Tree context                                                      */
/* ------------------------------------------------------------------ */

interface TreeContextValue {
  expandedItems: Set<string>;
  toggleItem: (value: string) => void;
}

const TreeContext = React.createContext<TreeContextValue>({
  expandedItems: new Set(),
  toggleItem: () => {},
});

/* ------------------------------------------------------------------ */
/*  Tree                                                              */
/* ------------------------------------------------------------------ */

/** Properties for the Tree component. */
export interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Array of item values that are expanded by default.
   * @default []
   */
  defaultExpandedItems?: string[];
}

const TreeRoot = React.forwardRef<HTMLDivElement, TreeProps>(
  ({ defaultExpandedItems = [], className, children, ...rest }, ref) => {
    const [expandedItems, setExpandedItems] = React.useState(
      () => new Set(defaultExpandedItems),
    );

    const toggleItem = React.useCallback((value: string) => {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    }, []);

    return (
      <TreeContext.Provider value={{ expandedItems, toggleItem }}>
        <div
          ref={ref}
          role="tree"
          className={cn('text-body-1', className)}
          {...rest}
        >
          {children}
        </div>
      </TreeContext.Provider>
    );
  },
);
TreeRoot.displayName = 'Tree';

/* ------------------------------------------------------------------ */
/*  TreeItem                                                          */
/* ------------------------------------------------------------------ */

/** Properties for the TreeItem sub-component. */
export interface TreeItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique value identifying this tree item. */
  value: string;
  /** Icon displayed before the item label. */
  icon?: React.ReactNode;
  /** Whether this item is a leaf node with no expandable children.
   * @default false
   */
  leaf?: boolean;
}

const TreeItem = React.forwardRef<HTMLDivElement, TreeItemProps>(
  ({ value, icon, leaf = false, className, children, ...rest }, ref) => {
    const { expandedItems, toggleItem } = React.useContext(TreeContext);
    const isExpanded = expandedItems.has(value);

    // Separate label content (string children) from nested TreeItems
    const nestedItems: React.ReactNode[] = [];
    const labelContent: React.ReactNode[] = [];

    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement(child) &&
        (child.type === TreeItem || child.type === TreeRoot)
      ) {
        nestedItems.push(child);
      } else {
        labelContent.push(child);
      }
    });

    const hasChildren = nestedItems.length > 0 && !leaf;

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hasChildren) toggleItem(value);
      } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
        e.preventDefault();
        toggleItem(value);
      } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
        e.preventDefault();
        toggleItem(value);
      }
    };

    return (
      <div
        ref={ref}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
        onClick={() => hasChildren && toggleItem(value)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded',
          'hover:bg-[#f5f5f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
          className,
        )}
        {...rest}
      >
          {hasChildren && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={cn(
                'shrink-0 transition-transform',
                isExpanded && 'rotate-90',
              )}
              aria-hidden="true"
            >
              <path
                d="M4.5 2.5l4 3.5-4 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {!hasChildren && <span className="w-3 shrink-0" />}
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate">{labelContent}</span>
        {hasChildren && isExpanded && (
          <div role="group" className="pl-4">
            {nestedItems}
          </div>
        )}
      </div>
    );
  },
);
TreeItem.displayName = 'TreeItem';

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

export const Tree = Object.assign(TreeRoot, {
  Item: TreeItem,
});
