import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

/** Properties for the Stepper component. */
export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled index of the currently active step. */
  activeStep?: number;
  /** Default active step index for uncontrolled usage.
   * @default 0
   */
  defaultActiveStep?: number;
  /** Callback invoked when the active step changes. */
  onStepChange?: (step: number) => void;
  /** Layout orientation of the stepper.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /** Whether navigation is restricted to sequential steps only.
   * @default false
   */
  linear?: boolean;
}

/** Properties for the Step sub-component. */
export interface StepProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label text for the step. */
  label: string;
  /** Optional description text displayed below the label. */
  description?: string;
  /** Custom icon to display in the step indicator. */
  icon?: React.ReactNode;
  /** Whether the step is disabled and non-interactive. */
  disabled?: boolean;
  /** Whether the step is marked as completed. */
  completed?: boolean;
  /** Whether the step is in an error state. */
  error?: boolean;
}

interface StepperContextValue {
  activeStep: number;
  onStepChange: (step: number) => void;
  orientation: 'horizontal' | 'vertical';
  linear: boolean;
  totalSteps: number;
}

const StepperContext = React.createContext<StepperContextValue>({
  activeStep: 0,
  onStepChange: () => {},
  orientation: 'horizontal',
  linear: false,
  totalSteps: 0,
});

interface StepInternalProps {
  index: number;
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ label, description, icon, disabled, completed, error, className, onClick, ...rest }, ref) => {
    // Read internal index from a data attribute set by the parent
    // We use context for stepper-level state
    const { activeStep, onStepChange, orientation, linear, totalSteps } =
      React.useContext(StepperContext);

    // The index is injected by StepperRoot via cloneElement
    const index = (rest as unknown as StepInternalProps).index ?? 0;
    // Remove internal prop from DOM spread
    const { index: _index, ...domRest } = rest as unknown as StepInternalProps &
      React.HTMLAttributes<HTMLDivElement>;

    const isActive = index === activeStep;
    const isCompleted = completed ?? index < activeStep;
    const isClickable = !disabled && (!linear || index <= activeStep + 1);
    const isLast = index === totalSteps - 1;

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isClickable) {
        onStepChange(index);
      }
      onClick?.(e);
    };

    // Step indicator content
    const renderIndicator = () => {
      if (error) {
        return <ErrorIcon />;
      }
      if (isCompleted && !icon) {
        return <CheckIcon />;
      }
      if (icon) {
        return icon;
      }
      return <span className="text-caption-1 font-semibold">{index + 1}</span>;
    };

    // Indicator circle styles
    const indicatorClasses = cn(
      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors border-2',
      error
        ? 'border-error bg-error/10 text-error'
        : isActive
          ? 'border-primary bg-primary text-white'
          : isCompleted
            ? 'border-success bg-success/10 text-success'
            : 'border-border bg-background text-muted-foreground',
    );

    // Connector line
    const connectorClasses = cn(
      'transition-colors',
      orientation === 'horizontal'
        ? 'flex-1 h-0.5 mx-2'
        : 'w-0.5 min-h-[24px] ml-4 my-1',
      isCompleted ? 'bg-success' : 'bg-border',
    );

    if (orientation === 'vertical') {
      return (
        <div ref={ref} className={cn('flex flex-col', className)} {...domRest}>
          <div
            role="button"
            tabIndex={isClickable ? 0 : -1}
            aria-disabled={disabled || !isClickable || undefined}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onStepChange(index);
              }
            }}
            className={cn(
              'flex items-center gap-3',
              isClickable ? 'cursor-pointer' : 'cursor-default',
              disabled && 'opacity-50',
            )}
          >
            <div className={indicatorClasses}>{renderIndicator()}</div>
            <div className="flex flex-col">
              <span
                className={cn(
                  'text-body-1 font-semibold',
                  error ? 'text-error' : isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-foreground',
                )}
              >
                {label}
              </span>
              {description && (
                <span className="text-caption-1 text-muted-foreground">{description}</span>
              )}
            </div>
          </div>
          {!isLast && <div className={connectorClasses} />}
        </div>
      );
    }

    // Horizontal layout
    return (
      <div ref={ref} className={cn('flex items-center', !isLast && 'flex-1', className)} {...domRest}>
        <div
          role="button"
          tabIndex={isClickable ? 0 : -1}
          aria-disabled={disabled || !isClickable || undefined}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onStepChange(index);
            }
          }}
          className={cn(
            'flex flex-col items-center gap-1',
            isClickable ? 'cursor-pointer' : 'cursor-default',
            disabled && 'opacity-50',
          )}
        >
          <div className={indicatorClasses}>{renderIndicator()}</div>
          <span
            className={cn(
              'text-caption-1 font-semibold whitespace-nowrap',
              error ? 'text-error' : isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-foreground',
            )}
          >
            {label}
          </span>
          {description && (
            <span className="text-caption-2 text-muted-foreground whitespace-nowrap">
              {description}
            </span>
          )}
        </div>
        {!isLast && <div className={connectorClasses} />}
      </div>
    );
  },
);
Step.displayName = 'Step';

const StepperRoot = React.forwardRef<HTMLDivElement, StepperProps>(
  (
    {
      activeStep: controlledStep,
      defaultActiveStep = 0,
      onStepChange,
      orientation = 'horizontal',
      linear = false,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const [activeStep, setActiveStep] = useControllable(
      controlledStep,
      defaultActiveStep,
      onStepChange,
    );

    const childArray = React.Children.toArray(children);
    const totalSteps = childArray.length;

    return (
      <StepperContext.Provider
        value={{ activeStep, onStepChange: setActiveStep, orientation, linear, totalSteps }}
      >
        <div
          ref={ref}
          role="group"
          aria-label="Progress"
          {...rest}
          className={cn(
            'flex',
            orientation === 'horizontal' ? 'flex-row items-start' : 'flex-col',
            className,
          )}
        >
          {childArray.map((child, index) => {
            if (React.isValidElement<StepProps>(child)) {
              return React.cloneElement(
                child as React.ReactElement<StepProps & StepInternalProps>,
                { index },
              );
            }
            return child;
          })}
        </div>
      </StepperContext.Provider>
    );
  },
);
StepperRoot.displayName = 'Stepper';

export const Stepper = Object.assign(StepperRoot, { Step });
