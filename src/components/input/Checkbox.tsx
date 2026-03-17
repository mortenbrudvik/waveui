import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/** Properties for the Checkbox component. */
export interface CheckboxProps extends Omit<
  React.HTMLAttributes<HTMLLabelElement>,
  'onChange' | 'defaultChecked'
> {
  /** Controlled checked state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled usage.
   * @default false
   */
  defaultChecked?: boolean;
  /** Whether the checkbox shows an indeterminate (mixed) state. */
  indeterminate?: boolean;
  /** Callback fired when the checked state changes. */
  onChange?: (checked: boolean) => void;
  /** Whether the checkbox is disabled and non-interactive. */
  disabled?: boolean;
  /** Text label displayed next to the checkbox. */
  label?: string;
}

export const Checkbox = ({
  checked: controlledChecked,
  defaultChecked = false,
  indeterminate = false,
  onChange,
  disabled,
  label,
  className,
  ref,
  ...rest
}: CheckboxProps & { ref?: React.Ref<HTMLLabelElement> }) => {
    const [checked, setChecked] = useControllable(controlledChecked, defaultChecked, onChange);
    const id = useId('checkbox');

    return (
      <label
        ref={ref}
        className={cn(
          'inline-flex items-center gap-2 select-none',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className,
        )}
        {...rest}
      >
        <button
          id={id}
          role="checkbox"
          type="button"
          aria-checked={indeterminate ? 'mixed' : checked}
          disabled={disabled}
          onClick={() => setChecked(!checked)}
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-input transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            (checked || indeterminate) && 'border-primary bg-primary',
          )}
        >
          {indeterminate ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2.5 6h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : checked ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2.5 6l2.5 2.5L9.5 3"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>
        {label && <span className="text-sm text-foreground">{label}</span>}
      </label>
    );
};

Checkbox.displayName = 'Checkbox';
