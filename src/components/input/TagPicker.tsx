import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/** Represents a single selectable tag option. */
export interface TagPickerOption {
  /** Unique identifier for the option. */
  value: string;
  /** Display label for the option. */
  label: string;
}

/** Properties for the TagPicker component. */
export interface TagPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Available options to choose from. */
  options: TagPickerOption[];
  /** Controlled array of selected option values. */
  value?: string[];
  /** Initial selected values for uncontrolled usage.
   * @default []
   */
  defaultValue?: string[];
  /** Callback fired when the selection changes. */
  onChange?: (value: string[]) => void;
  /** Placeholder text shown when no tags are selected.
   * @default 'Select...'
   */
  placeholder?: string;
  /** Whether the tag picker is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
}

export const TagPicker = React.forwardRef<HTMLDivElement, TagPickerProps>(
  (
    {
      options,
      value: valueProp,
      defaultValue,
      onChange,
      placeholder = 'Select...',
      disabled = false,
      className,
      ...rest
    },
    ref,
  ) => {
    const [selected, setSelected] = useControllable(valueProp, defaultValue ?? [], onChange);
    const [query, setQuery] = React.useState('');
    const [isOpen, setIsOpen] = React.useState(false);
    const [focusIndex, setFocusIndex] = React.useState(-1);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listboxId = useId('tagpicker-listbox');

    const filteredOptions = options.filter(
      (opt) =>
        !selected.includes(opt.value) &&
        opt.label.toLowerCase().includes(query.toLowerCase()),
    );

    const addTag = (val: string) => {
      if (!selected.includes(val)) {
        setSelected([...selected, val]);
      }
      setQuery('');
      setFocusIndex(-1);
      inputRef.current?.focus();
    };

    const removeTag = (val: string) => {
      setSelected(selected.filter((v) => v !== val));
      inputRef.current?.focus();
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && query === '' && selected.length > 0) {
        removeTag(selected[selected.length - 1]);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => (i <= 0 ? -1 : i - 1));
      }
      if (e.key === 'Enter' && focusIndex >= 0 && filteredOptions[focusIndex]) {
        e.preventDefault();
        addTag(filteredOptions[focusIndex].value);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setFocusIndex(-1);
      }
    };

    const selectedLabels = selected
      .map((v) => options.find((o) => o.value === v))
      .filter(Boolean) as TagPickerOption[];

    return (
      <div
        ref={ref}
        className={cn(
          'relative',
          disabled && 'opacity-50 pointer-events-none',
          className,
        )}
        {...rest}
      >
        <div
          className={cn(
            'flex flex-wrap items-center gap-1 rounded border border-border bg-background px-2 py-1.5',
            'focus-within:border-[#0f6cbd] focus-within:ring-1 focus-within:ring-[#0f6cbd]',
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {selectedLabels.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 rounded bg-[#f0f0f0] px-2 py-0.5 text-body-1"
            >
              {opt.label}
              <button
                type="button"
                className="ml-0.5 text-[#616161] hover:text-[#242424]"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(opt.value);
                }}
                aria-label={`Remove ${opt.label}`}
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <path d="M9.35 3.35L8.65 2.65 6 5.29 3.35 2.65 2.65 3.35 5.29 6 2.65 8.65 3.35 9.35 6 6.71 8.65 9.35 9.35 8.65 6.71 6z" />
                </svg>
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="min-w-[60px] flex-1 bg-transparent outline-none text-body-1 py-0.5"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setFocusIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              // Delay to allow click on option
              setTimeout(() => setIsOpen(false), 150);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={selected.length === 0 ? placeholder : ''}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={
              focusIndex >= 0 ? `${listboxId}-option-${focusIndex}` : undefined
            }
            disabled={disabled}
          />
        </div>
        {isOpen && filteredOptions.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded border border-border bg-background py-1 shadow-4"
          >
            {filteredOptions.map((opt, idx) => (
              <li
                key={opt.value}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={idx === focusIndex}
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-body-1',
                  idx === focusIndex ? 'bg-[#f0f0f0]' : 'hover:bg-[#f5f5f5]',
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(opt.value);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
TagPicker.displayName = 'TagPicker';
