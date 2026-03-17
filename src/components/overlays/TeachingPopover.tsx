import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/** Defines a single step in a teaching popover sequence. */
export interface TeachingPopoverStep {
  /** Title text for the step. */
  title: string;
  /** Body content for the step. */
  body: React.ReactNode;
}

/** Properties for the TeachingPopover component. */
export interface TeachingPopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Array of steps to display in the teaching popover. */
  steps: TeachingPopoverStep[];
  /** Controlled index of the currently displayed step. */
  currentStep?: number;
  /** Default step index for uncontrolled usage.
   * @default 0
   */
  defaultCurrentStep?: number;
  /** Callback invoked when the current step changes. */
  onStepChange?: (step: number) => void;
  /** Callback invoked when the popover is dismissed. */
  onDismiss?: () => void;
  /** Whether the teaching popover is visible.
   * @default true
   */
  open?: boolean;
}

export const TeachingPopover = React.forwardRef<HTMLDivElement, TeachingPopoverProps>(
  (
    {
      steps,
      currentStep: currentStepProp,
      defaultCurrentStep,
      onStepChange,
      onDismiss,
      open = true,
      className,
      ...rest
    },
    ref,
  ) => {
    const [currentStep, setCurrentStep] = useControllable(
      currentStepProp,
      defaultCurrentStep ?? 0,
      onStepChange,
    );
    const titleId = useId('teaching-popover-title');
    const dialogRef = React.useRef<HTMLDivElement>(null);

    // Focus the dialog when it opens
    React.useEffect(() => {
      if (open) {
        dialogRef.current?.focus();
      }
    }, [open]);

    if (!open || steps.length === 0) return null;

    const step = steps[currentStep] ?? steps[0];
    const isFirst = currentStep === 0;
    const isLast = currentStep === steps.length - 1;

    const handleBack = () => {
      if (!isFirst) setCurrentStep(currentStep - 1);
    };

    const handleNext = () => {
      if (isLast) {
        onDismiss?.();
      } else {
        setCurrentStep(currentStep + 1);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss?.();
      }
    };

    return (
      <div
        ref={(node) => {
          (dialogRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="dialog"
        aria-labelledby={titleId}
        className={cn(
          'relative bg-background border border-border rounded-lg p-5 shadow-8 w-80',
          className,
        )}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        {...rest}
      >
        {/* Close button */}
        <button
          type="button"
          className="absolute top-3 right-3 text-[#616161] hover:text-[#242424] bg-transparent border-0 p-1 rounded cursor-pointer"
          onClick={onDismiss}
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M12.35 4.35L11.65 3.65 8 7.29 4.35 3.65 3.65 4.35 7.29 8 3.65 11.65 4.35 12.35 8 8.71 11.65 12.35 12.35 11.65 8.71 8z" />
          </svg>
        </button>

        {/* Title */}
        <h3 id={titleId} className="text-subtitle-1 font-semibold text-[#242424] mb-2 pr-6">
          {step.title}
        </h3>

        {/* Body */}
        <div className="text-body-1 text-[#616161] mb-4">{step.body}</div>

        {/* Footer: dots + nav buttons */}
        <div className="flex items-center justify-between">
          {/* Step dots */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Steps">
            {steps.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  i === currentStep ? 'bg-[#0f6cbd]' : 'bg-[#d1d1d1]',
                )}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                className="px-3 py-1 text-body-1 rounded border border-border bg-background hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                onClick={handleBack}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="px-3 py-1 text-body-1 rounded bg-[#0f6cbd] text-white hover:bg-[#0e5faa] transition-colors border-0 cursor-pointer"
              onClick={handleNext}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    );
  },
);
TeachingPopover.displayName = 'TeachingPopover';
