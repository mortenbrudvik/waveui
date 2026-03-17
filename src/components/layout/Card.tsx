import * as React from 'react';
import { cn } from '../../lib/cn';

interface CardContextValue {
  selected?: boolean;
}

const CardContext = React.createContext<CardContextValue>({});

/** Properties for the Card component. */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
  /** Whether the card is in a selected state. */
  selected?: boolean;
  /** Callback invoked when the card is clicked for selection. */
  onSelect?: () => void;
}

const CardRoot = React.forwardRef<HTMLDivElement, CardProps>(
  ({ as: Component = 'div', selected, onSelect, className, children, ...props }, ref) => {
    return (
      <CardContext.Provider value={{ selected }}>
        <Component
          ref={ref}
          className={cn(
            'border border-border rounded-lg bg-card shadow-4 overflow-hidden',
            selected && 'border-primary bg-[#ebf3fc]',
            onSelect && 'cursor-pointer',
            className,
          )}
          onClick={onSelect}
          {...props}
        >
          {children}
        </Component>
      </CardContext.Provider>
    );
  },
);
CardRoot.displayName = 'Card';

/** Properties for the CardHeader sub-component. */
export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
  /** Title content displayed in the card header. */
  title?: React.ReactNode;
  /** Subtitle content displayed below the title. */
  subtitle?: React.ReactNode;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ as: Component = 'div', title, subtitle, className, children, ...props }, ref) => {
    return (
      <Component ref={ref} className={cn('p-4', className)} {...props}>
        {title && <div className="text-subtitle-1">{title}</div>}
        {subtitle && (
          <div className="text-caption-1 text-muted-foreground">{subtitle}</div>
        )}
        {children}
      </Component>
    );
  },
);
CardHeader.displayName = 'CardHeader';

/** Properties for the CardBody sub-component. */
export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
}

const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ as: Component = 'div', className, ...props }, ref) => {
    return <Component ref={ref} className={cn('p-4 pt-0', className)} {...props} />;
  },
);
CardBody.displayName = 'CardBody';

/** Properties for the CardFooter sub-component. */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ as: Component = 'div', className, ...props }, ref) => {
    return (
      <Component ref={ref} className={cn('p-4 pt-0 flex justify-end gap-2', className)} {...props} />
    );
  },
);
CardFooter.displayName = 'CardFooter';

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
