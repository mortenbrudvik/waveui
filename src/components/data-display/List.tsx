import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

interface ListContextValue {
  selectable: boolean;
  selectionMode: 'single' | 'multi';
  selectedItems: string[];
  toggleItem: (value: string) => void;
}

const ListContext = React.createContext<ListContextValue>({
  selectable: false,
  selectionMode: 'single',
  selectedItems: [],
  toggleItem: () => {},
});

/** Properties for the List component. */
export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  /** Whether list items can be selected.
   * @default false
   */
  selectable?: boolean;
  /** Selection behavior when selectable is true.
   * @default 'single'
   */
  selectionMode?: 'single' | 'multi';
  /** Controlled array of selected item values. */
  selectedItems?: string[];
  /** Default selected items for uncontrolled usage.
   * @default []
   */
  defaultSelectedItems?: string[];
  /** Callback invoked when the selection changes. */
  onSelectionChange?: (selected: string[]) => void;
}

/** Properties for the ListItem component. */
export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  /** Unique value identifying this item for selection tracking. */
  value?: string;
  /** Action element rendered at the end of the list item. */
  action?: React.ReactNode;
}

const ListRoot = (
    {
      selectable = false,
      selectionMode = 'single',
      selectedItems: controlledSelected,
      defaultSelectedItems = [],
      onSelectionChange,
      className,
      children, ref, ...rest }: ListProps & { ref?: React.Ref<HTMLUListElement> }) => {
    const [selectedItems, setSelectedItems] = useControllable(
      controlledSelected,
      defaultSelectedItems,
      onSelectionChange,
    );

    const toggleItem = React.useCallback(
      (value: string) => {
        if (selectionMode === 'single') {
          setSelectedItems(selectedItems.includes(value) ? [] : [value]);
        } else {
          setSelectedItems(
            selectedItems.includes(value)
              ? selectedItems.filter((v) => v !== value)
              : [...selectedItems, value],
          );
        }
      },
      [selectionMode, selectedItems, setSelectedItems],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
      const items = e.currentTarget.querySelectorAll<HTMLElement>(
        '[role="option"], [role="listitem"]',
      );
      const currentIndex = Array.from(items).indexOf(document.activeElement as HTMLElement);
      let nextIndex = currentIndex;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = items.length - 1;
      }

      items[nextIndex]?.focus();
    };

    return (
      <ListContext.Provider value={{ selectable, selectionMode, selectedItems, toggleItem }}>
        <ul
          ref={ref}
          role={selectable ? 'listbox' : 'list'}
          aria-multiselectable={selectable && selectionMode === 'multi' ? true : undefined}
          onKeyDown={selectable ? handleKeyDown : undefined}
          className={cn('list-none m-0 p-0', className)}
          {...rest}
        >
          {children}
        </ul>
      </ListContext.Provider>
    );
  };
ListRoot.displayName = 'List';

const ListItem = ({ value, action, className, children, onClick, ref, ...rest }: ListItemProps & { ref?: React.Ref<HTMLLIElement> }) => {
  const { selectable, selectedItems, toggleItem } = React.useContext(ListContext);
  const isSelected = value ? selectedItems.includes(value) : false;

  const handleClick = (e: React.MouseEvent<HTMLLIElement>) => {
    if (selectable && value) {
      toggleItem(value);
    }
    onClick?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLLIElement>) => {
    if (selectable && value && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleItem(value);
    }
  };

  return (
    <li
      ref={ref}
      role={selectable ? 'option' : 'listitem'}
      tabIndex={selectable ? 0 : undefined}
      aria-selected={selectable ? isSelected : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center px-4 py-2 text-body-1 border-b border-border',
        selectable && 'cursor-pointer hover:bg-[#f5f5f5]',
        isSelected && 'bg-[#f0f0f0]',
        className,
      )}
      {...rest}
    >
      <span className="flex-1">{children}</span>
      {action && <span className="flex-shrink-0 ml-2">{action}</span>}
    </li>
  );
};
ListItem.displayName = 'ListItem';

export const List = Object.assign(ListRoot, {
  Item: ListItem,
});
