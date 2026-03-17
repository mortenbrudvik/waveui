import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

interface AccordionContextValue {
  openItems: string[];
  toggle: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue>({
  openItems: [],
  toggle: () => {},
});

/** Properties for the Accordion component. */
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether only one or multiple items can be open at a time.
   * @default 'single'
   */
  type?: 'single' | 'multiple';
  /** Controlled array of currently open item values. */
  openItems?: string[];
  /** Default open items for uncontrolled usage.
   * @default []
   */
  defaultOpenItems?: string[];
  /** Callback invoked when the set of open items changes. */
  onOpenItemsChange?: (openItems: string[]) => void;
}

const AccordionRoot = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      type = 'single',
      openItems: controlledOpenItems,
      defaultOpenItems = [],
      onOpenItemsChange,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const [openItems, setOpenItems] = useControllable(
      controlledOpenItems,
      defaultOpenItems,
      onOpenItemsChange,
    );

    const toggle = React.useCallback(
      (value: string) => {
        const next = openItems.includes(value)
          ? openItems.filter((v) => v !== value)
          : type === 'single'
            ? [value]
            : [...openItems, value];
        setOpenItems(next);
      },
      [type, openItems, setOpenItems],
    );

    return (
      <AccordionContext.Provider value={{ openItems, toggle }}>
        <div
          ref={ref}
          className={cn('divide-y divide-border', className)}
          {...rest}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    );
  },
);
AccordionRoot.displayName = 'Accordion';

/** Properties for the AccordionItem sub-component. */
export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique value identifying this accordion item. */
  value: string;
}

const getChildrenByType = (children: React.ReactNode, type: React.ElementType) => {
  const result: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === type) {
      result.push(child);
    }
  });
  return result;
};

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, className, children, ...rest }, ref) => {
    const { openItems, toggle } = React.useContext(AccordionContext);
    const isOpen = openItems.includes(value);

    const safeValue = value.replace(/[^a-zA-Z0-9-_]/g, '_');
    const panelId = `accordion-panel-${safeValue}`;
    const triggerId = `accordion-trigger-${safeValue}`;

    const triggerChildren = getChildrenByType(children, AccordionTrigger);
    const panelChildren = getChildrenByType(children, AccordionPanel);

    // Collect non-trigger, non-panel children into panel
    const otherChildren: React.ReactNode[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type !== AccordionTrigger && child.type !== AccordionPanel) {
          otherChildren.push(child);
        }
      }
    });

    return (
      <div ref={ref} className={cn(className)} {...rest}>
        <button
          type="button"
          id={triggerId}
          aria-controls={panelId}
          aria-expanded={isOpen}
          onClick={() => toggle(value)}
          className="w-full flex justify-between items-center py-3 px-4 font-semibold text-body-1"
        >
          {triggerChildren.length > 0
            ? triggerChildren.map((c) =>
                React.isValidElement(c) ? c.props.children : c,
              )
            : value}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={cn(
              'transition-transform shrink-0',
              isOpen && 'rotate-180',
            )}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {isOpen && (
          <div
            id={panelId}
            role="region"
            aria-labelledby={triggerId}
            className="px-4 pb-3 text-body-1 text-muted-foreground"
          >
            {panelChildren.length > 0
              ? panelChildren.map((c) =>
                  React.isValidElement(c) ? c.props.children : c,
                )
              : null}
            {otherChildren}
          </div>
        )}
      </div>
    );
  },
);
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ children, ...rest }, ref) => {
    return <span ref={ref} {...rest}>{children}</span>;
  },
);
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...rest }, ref) => {
    return <div ref={ref} {...rest}>{children}</div>;
  },
);
AccordionPanel.displayName = 'AccordionPanel';

export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
});
