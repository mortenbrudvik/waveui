import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

/* ---- Context ---- */
interface RadioGroupContext {
  name: string;
  value: string;
  onChange: (value: string) => void;
  getTabIndex: (value: string) => 0 | -1;
}

const RadioCtx = React.createContext<RadioGroupContext | null>(null);

/* ---- RadioGroup ---- */
/** Properties for the RadioGroup component. */
export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Controlled selected value. */
  value?: string;
  /** Initial selected value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Callback fired when the selected value changes. */
  onChange?: (value: string) => void;
  /** Layout direction of radio items.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal';
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      value: controlledValue,
      defaultValue = '',
      onChange,
      orientation = 'vertical',
      children,
      className,
      'aria-label': ariaLabel,
      ...rest
    },
    ref,
  ) => {
    const [value, setValue] = useControllable(controlledValue, defaultValue, onChange);
    const name = useId('radio');
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Collect item values from children for roving tabindex
    const items = React.useMemo(() => {
      const values: string[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement<RadioItemProps>(child) && child.props.value && !child.props.disabled) {
          values.push(child.props.value);
        }
      });
      return values;
    }, [children]);

    const { handleKeyDown, getTabIndex } = useRovingTabIndex(containerRef, {
      activeValue: value,
      items,
      orientation: orientation === 'horizontal' ? 'horizontal' : 'vertical',
      loop: true,
      onFocusMove: (nextValue) => {
        // WAI-ARIA: for radio groups, moving focus also selects the item
        setValue(nextValue);
      },
    });

    // Merge refs
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    return (
      <RadioCtx.Provider value={{ name, value, onChange: setValue, getTabIndex }}>
        <div
          ref={mergedRef}
          role="radiogroup"
          aria-label={ariaLabel}
          className={cn(
            'flex',
            orientation === 'vertical' ? 'flex-col gap-2' : 'flex-row gap-4',
            className,
          )}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {children}
        </div>
      </RadioCtx.Provider>
    );
  },
);

RadioGroup.displayName = 'RadioGroup';

/* ---- RadioItem ---- */
/** Properties for the RadioItem component. */
export interface RadioItemProps {
  /** Value associated with this radio option. */
  value: string;
  /** Text label displayed next to the radio indicator. */
  label?: string;
  /** Whether the radio item is disabled and non-interactive. */
  disabled?: boolean;
  /** Additional CSS class name. */
  className?: string;
}

export function RadioItem({ value, label, disabled, className }: RadioItemProps) {
  const ctx = React.useContext(RadioCtx);
  if (!ctx) throw new Error('RadioItem must be used within a RadioGroup');

  const selected = ctx.value === value;
  const id = useId('radio-item');

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <button
        id={id}
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        tabIndex={disabled ? -1 : ctx.getTabIndex(value)}
        data-roving-value={value}
        onClick={() => ctx.onChange(value)}
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          selected ? 'border-2 border-primary' : 'border-input',
        )}
      >
        {selected && <span className="block h-2 w-2 rounded-full bg-primary" />}
      </button>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}
