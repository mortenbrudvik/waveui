import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

interface TabListContextValue {
  selectedValue: string;
  onSelect: (value: string) => void;
  vertical?: boolean;
  getTabIndex: (value: string) => 0 | -1;
}

const TabListContext = React.createContext<TabListContextValue | null>(null);

function useTabListContext() {
  const ctx = React.useContext(TabListContext);
  if (!ctx) throw new Error('Tab/TabPanel must be used within a TabList');
  return ctx;
}

/** Properties for the TabList component. */
export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled value of the currently selected tab. */
  selectedValue?: string;
  /** Default selected tab value for uncontrolled usage.
   * @default ''
   */
  defaultSelectedValue?: string;
  /** Callback invoked when the selected tab changes. */
  onTabSelect?: (value: string) => void;
  /** Whether to arrange tabs vertically instead of horizontally. */
  vertical?: boolean;
}

const TabListRoot = (
    {
      selectedValue: controlledValue,
      defaultSelectedValue = '',
      onTabSelect,
      vertical,
      className,
      children, ref, ...rest }: TabListProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [selectedValue, setSelectedValue] = useControllable(
      controlledValue,
      defaultSelectedValue,
      onTabSelect,
    );

    const tablistRef = React.useRef<HTMLDivElement>(null);

    // Merge forwarded ref with internal tablistRef so consumers get the tablist element
    const mergedTablistRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        (tablistRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    // Collect tab values from children for roving tabindex
    // Only collect direct Tab children (not Panel children)
    const items = React.useMemo(() => {
      const values: string[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement<TabProps>(child) && child.props.value && child.type === Tab) {
          values.push(child.props.value);
        }
      });
      return values;
    }, [children]);

    const { handleKeyDown, getTabIndex } = useRovingTabIndex(tablistRef, {
      activeValue: selectedValue,
      items,
      orientation: vertical ? 'vertical' : 'horizontal',
      loop: true,
      onFocusMove: (nextValue) => {
        // WAI-ARIA: for manual-activation tabs, focus moves independently
        // of selection. For automatic-activation, moving focus selects.
        // We use automatic activation (consistent with standard tab behavior).
        setSelectedValue(nextValue);
      },
    });

    return (
      <TabListContext.Provider
        value={{ selectedValue, onSelect: setSelectedValue, vertical, getTabIndex }}
      >
        <div className={cn(vertical && 'flex')}>
          <div
            ref={mergedTablistRef}
            role="tablist"
            aria-orientation={vertical ? 'vertical' : 'horizontal'}
            onKeyDown={handleKeyDown}
            className={cn(
              vertical
                ? 'flex flex-col w-40 border-r border-border'
                : 'flex border-b border-border',
              className,
            )}
            {...rest}
          >
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child) && child.type === Tab) {
                return child;
              }
              return null;
            })}
          </div>
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type !== Tab) {
              return child;
            }
            return null;
          })}
        </div>
      </TabListContext.Provider>
    );
  };
TabListRoot.displayName = 'TabList';

/** Properties for the Tab sub-component. */
export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Unique value identifying this tab. */
  value: string;
}

const Tab = ({ value, className, children, ref, ...rest }: TabProps & { ref?: React.Ref<HTMLButtonElement> }) => {
    const { selectedValue, onSelect, vertical, getTabIndex } = useTabListContext();
    const isActive = selectedValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`tab-${value.replace(/[^a-zA-Z0-9-_]/g, '_')}`}
        aria-controls={isActive ? `tabpanel-${value.replace(/[^a-zA-Z0-9-_]/g, '_')}` : undefined}
        aria-selected={isActive}
        tabIndex={getTabIndex(value)}
        data-roving-value={value}
        onClick={() => onSelect(value)}
        className={cn(
          'px-4 py-2 text-body-1 font-semibold transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
          vertical
            ? cn(
                'text-left',
                isActive
                  ? 'border-l-2 border-l-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )
            : cn(
                isActive
                  ? 'text-primary border-b-2 border-b-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ),
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  };
Tab.displayName = 'Tab';

/** Properties for the TabPanel sub-component. */
export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value matching the corresponding Tab to display this panel's content. */
  value: string;
}

const TabPanel = ({ value, children, className, ref, ...rest }: TabPanelProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const { selectedValue } = useTabListContext();
    if (selectedValue !== value) return null;
    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`tabpanel-${value.replace(/[^a-zA-Z0-9-_]/g, '_')}`}
        aria-labelledby={`tab-${value.replace(/[^a-zA-Z0-9-_]/g, '_')}`}
        tabIndex={0}
        className={cn('p-4', className)}
        {...rest}
      >
        {children}
      </div>
    );
  };
TabPanel.displayName = 'TabPanel';

export const TabList = Object.assign(TabListRoot, {
  Tab,
  Panel: TabPanel,
});
