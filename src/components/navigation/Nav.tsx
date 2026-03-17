import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

interface NavContextValue {
  selectedValue: string;
  onSelect: (value: string) => void;
  openCategories: string[];
  toggleCategory: (id: string) => void;
}

const NavContext = React.createContext<NavContextValue>({
  selectedValue: '',
  onSelect: () => {},
  openCategories: [],
  toggleCategory: () => {},
});

/** Properties for the Nav component. */
export interface NavProps extends React.HTMLAttributes<HTMLElement> {
  /** Controlled value of the currently selected nav item. */
  selectedValue?: string;
  /** Default selected nav item value for uncontrolled usage.
   * @default ''
   */
  defaultSelectedValue?: string;
  /** Callback invoked when a nav item is selected. */
  onNavItemSelect?: (value: string) => void;
}

/** Properties for the NavCategory sub-component. */
export interface NavCategoryProps extends React.HTMLAttributes<HTMLLIElement> {
  /** Unique value identifying this category. */
  value: string;
  /** Icon displayed before the category label. */
  icon?: React.ReactNode;
}

/** Properties for the NavItem sub-component. */
export interface NavItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Unique value identifying this nav item. */
  value: string;
  /** Icon displayed before the item label. */
  icon?: React.ReactNode;
  /** URL to navigate to; renders as an anchor instead of a button when provided. */
  href?: string;
}

/** Properties for the NavSubItem sub-component. */
export interface NavSubItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Unique value identifying this sub-item. */
  value: string;
  /** URL to navigate to; renders as an anchor instead of a button when provided. */
  href?: string;
}

const NavRoot = React.forwardRef<HTMLElement, NavProps>(
  (
    {
      selectedValue: controlledValue,
      defaultSelectedValue = '',
      onNavItemSelect,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const [selectedValue, setSelectedValue] = useControllable(
      controlledValue,
      defaultSelectedValue,
      onNavItemSelect,
    );
    const [openCategories, setOpenCategories] = React.useState<string[]>([]);

    const toggleCategory = React.useCallback((id: string) => {
      setOpenCategories((prev) =>
        prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
      );
    }, []);

    return (
      <NavContext.Provider
        value={{ selectedValue, onSelect: setSelectedValue, openCategories, toggleCategory }}
      >
        <nav
          ref={ref}
          aria-label="Navigation"
          className={cn('w-60 py-2 bg-background border-r border-border', className)}
          {...rest}
        >
          <ul className="list-none m-0 p-0">{children}</ul>
        </nav>
      </NavContext.Provider>
    );
  },
);
NavRoot.displayName = 'Nav';

const NavCategory = React.forwardRef<HTMLLIElement, NavCategoryProps>(
  ({ value, icon, className, children, ...rest }, ref) => {
    const { openCategories, toggleCategory } = React.useContext(NavContext);
    const isOpen = openCategories.includes(value);

    return (
      <li ref={ref} className={cn(className)} {...rest}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggleCategory(value)}
          className="w-full flex items-center gap-2 px-4 py-2 text-body-1 font-semibold text-foreground hover:bg-[#f5f5f5] transition-colors"
        >
          {icon && (
            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</span>
          )}
          <span className="flex-1 text-left">
            {typeof children === 'string'
              ? children
              : React.Children.toArray(children).find((c) => typeof c === 'string') || ''}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className={cn('transition-transform flex-shrink-0', isOpen && 'rotate-180')}
          >
            <path
              d="M3 4.5l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {isOpen && (
          <ul className="list-none m-0 p-0">
            {React.Children.map(children, (child) => {
              if (typeof child === 'string') return null;
              return child;
            })}
          </ul>
        )}
      </li>
    );
  },
);
NavCategory.displayName = 'NavCategory';

const NavItem = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, NavItemProps>(
  ({ value, icon, href, className, children, onClick, ...rest }, ref) => {
    const { selectedValue, onSelect } = React.useContext(NavContext);
    const isSelected = selectedValue === value;

    const handleClick = (e: React.MouseEvent) => {
      onSelect(value);
      onClick?.(e as React.MouseEvent<HTMLButtonElement>);
    };

    const sharedClassName = cn(
      'w-full flex items-center gap-2 px-4 py-2 text-body-1 transition-colors no-underline',
      isSelected
        ? 'bg-[#f0f0f0] text-primary font-semibold border-l-2 border-l-primary'
        : 'text-foreground hover:bg-[#f5f5f5]',
      className,
    );

    return (
      <li>
        {href ? (
          <a
            ref={ref as React.Ref<HTMLAnchorElement>}
            href={href}
            aria-current={isSelected ? 'page' : undefined}
            onClick={handleClick}
            className={sharedClassName}
            {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          >
            {icon && (
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</span>
            )}
            <span className="flex-1 text-left">{children}</span>
          </a>
        ) : (
          <button
            ref={ref as React.Ref<HTMLButtonElement>}
            type="button"
            aria-current={isSelected ? 'page' : undefined}
            onClick={handleClick}
            className={sharedClassName}
            {...rest}
          >
            {icon && (
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</span>
            )}
            <span className="flex-1 text-left">{children}</span>
          </button>
        )}
      </li>
    );
  },
);
NavItem.displayName = 'NavItem';

const NavSubItem = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, NavSubItemProps>(
  ({ value, href, className, children, onClick, ...rest }, ref) => {
    const { selectedValue, onSelect } = React.useContext(NavContext);
    const isSelected = selectedValue === value;

    const handleClick = (e: React.MouseEvent) => {
      onSelect(value);
      onClick?.(e as React.MouseEvent<HTMLButtonElement>);
    };

    const sharedClassName = cn(
      'w-full flex items-center pl-11 pr-4 py-1.5 text-body-1 transition-colors no-underline',
      isSelected
        ? 'text-primary font-semibold'
        : 'text-muted-foreground hover:text-foreground hover:bg-[#f5f5f5]',
      className,
    );

    return (
      <li>
        {href ? (
          <a
            ref={ref as React.Ref<HTMLAnchorElement>}
            href={href}
            aria-current={isSelected ? 'page' : undefined}
            onClick={handleClick}
            className={sharedClassName}
            {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          >
            {children}
          </a>
        ) : (
          <button
            ref={ref as React.Ref<HTMLButtonElement>}
            type="button"
            aria-current={isSelected ? 'page' : undefined}
            onClick={handleClick}
            className={sharedClassName}
            {...rest}
          >
            {children}
          </button>
        )}
      </li>
    );
  },
);
NavSubItem.displayName = 'NavSubItem';

export const Nav = Object.assign(NavRoot, {
  Category: NavCategory,
  Item: NavItem,
  SubItem: NavSubItem,
});
