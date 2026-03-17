import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Slot } from '../../lib/types';
import { renderSlot } from '../../lib/slot';

/** Properties for the Menu component. */
export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Menu items and dividers to render. */
  children: React.ReactNode;
}

/** Properties for the MenuItem sub-component. */
export interface MenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Slot for an icon displayed before the item text. */
  icon?: Slot<'span'>;
  /** Keyboard shortcut text displayed on the right side. */
  shortcut?: string;
  /** Whether the menu item is disabled. */
  disabled?: boolean;
  /** Label content of the menu item. */
  children: React.ReactNode;
}

/** Properties for the MenuDivider sub-component. */
export interface MenuDividerProps extends React.HTMLAttributes<HTMLDivElement> {}

const MenuRoot = React.forwardRef<HTMLDivElement, MenuProps>(
  ({ children, className, ...rest }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const items = e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
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
      <div
        ref={ref}
        role="menu"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        {...rest}
        className={cn(
          'border border-border rounded-lg shadow-4 bg-background py-1 min-w-[180px]',
          className,
        )}
      >
        {children}
      </div>
    );
  }
);
MenuRoot.displayName = 'Menu';

const MenuItem = React.forwardRef<HTMLDivElement, MenuItemProps>(
  ({ icon, shortcut, disabled, onClick, children, className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={-1}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).click();
          }
        }}
        {...rest}
        className={cn(
          'px-3 py-1.5 text-body-1 hover:bg-[#f0f0f0] cursor-pointer flex items-center gap-2',
          disabled && 'opacity-50 pointer-events-none',
          className,
        )}
      >
        {icon !== undefined && renderSlot(icon, 'span', 'flex-shrink-0 w-5 h-5 flex items-center justify-center')}
        <span className="flex-1">{children}</span>
        {shortcut && (
          <span className="text-caption-1 text-muted-foreground ml-4">
            {shortcut}
          </span>
        )}
      </div>
    );
  }
);
MenuItem.displayName = 'MenuItem';

const MenuDivider = React.forwardRef<HTMLDivElement, MenuDividerProps>(
  ({ className, ...rest }, ref) => {
    return <div ref={ref} role="separator" {...rest} className={cn('border-t border-border my-1', className)} />;
  }
);
MenuDivider.displayName = 'MenuDivider';

export const Menu = Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
});
