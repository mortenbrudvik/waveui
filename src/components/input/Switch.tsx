import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/** Properties for the Switch component. */
export interface SwitchProps extends Omit<
  React.HTMLAttributes<HTMLLabelElement>,
  'onChange' | 'defaultChecked'
> {
  /** Controlled checked (on/off) state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled usage.
   * @default false
   */
  defaultChecked?: boolean;
  /** Callback fired when the switch is toggled. */
  onChange?: (checked: boolean) => void;
  /** Whether the switch is disabled and non-interactive. */
  disabled?: boolean;
  /** Text label displayed next to the switch. */
  label?: string;
}

export const Switch = React.forwardRef<HTMLLabelElement, SwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onChange,
      disabled,
      label,
      className,
      ...rest
    },
    ref,
  ) => {
    const [checked, setChecked] = useControllable(controlledChecked, defaultChecked, onChange);
    const id = useId('switch');

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
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => setChecked(!checked)}
          className={cn(
            'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            checked ? 'bg-primary' : 'bg-[#d1d1d1]',
          )}
        >
          <span
            className={cn(
              'block h-[14px] w-[14px] rounded-full bg-white shadow transition-transform duration-200',
              checked ? 'translate-x-[23px]' : 'translate-x-[3px]',
            )}
          />
        </button>
        {label && <span className="text-sm text-foreground">{label}</span>}
      </label>
    );
  },
);

Switch.displayName = 'Switch';
