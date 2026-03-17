import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { renderSlot } from '../../lib/slot';
import type { Slot } from '../../lib/types';

/** Properties for the SearchBox component. */
export interface SearchBoxProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Controlled search text value. */
  value?: string;
  /** Initial search text for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Callback fired when the search text changes. */
  onChange?: (value: string) => void;
  /** Callback fired when the search is cleared. */
  onClear?: () => void;
  /** Placeholder text shown when the input is empty.
   * @default 'Search'
   */
  placeholder?: string;
  /** Whether the search box is disabled and non-interactive. */
  disabled?: boolean;
  /** Slot rendered before the input (replaces the default search icon). */
  contentBefore?: Slot<'span'>;
  /** Slot rendered after the input text. */
  contentAfter?: Slot<'span'>;
  /** Slot for the dismiss/clear button (replaces the default clear icon). */
  dismiss?: Slot<'button'>;
}

const DefaultSearchIcon = () => (
  <svg
    aria-hidden="true"
    className="pointer-events-none h-4 w-4 text-[#707070]"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.38l3.09 3.08a.75.75 0 11-1.06 1.06l-3.09-3.08A7 7 0 012 9z"
      clipRule="evenodd"
    />
  </svg>
);

const DefaultDismissIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-4 w-4"
  >
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

export const SearchBox = ({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onClear,
  placeholder = 'Search',
  disabled,
  contentBefore,
  contentAfter,
  dismiss,
  className,
  ref,
  ...rest
}: SearchBoxProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [value, setValue] = useControllable(controlledValue, defaultValue, onChange);

    const handleClear = () => {
      setValue('');
      onClear?.();
    };

    return (
      <div
        ref={ref}
        className={cn('relative inline-flex items-center w-full', className)}
        {...rest}
      >
        {/* Search icon / contentBefore */}
        <span className="pointer-events-none absolute left-2">
          {contentBefore != null ? (
            renderSlot(contentBefore, 'span', 'shrink-0')
          ) : (
            <DefaultSearchIcon />
          )}
        </span>

        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'h-8 w-full rounded border border-input bg-background pl-8 pr-8 text-sm text-foreground',
            'placeholder:text-[#707070]',
            'focus:outline-none focus:border-b-2 focus:border-b-primary',
            '[&::-webkit-search-cancel-button]:hidden',
          )}
        />

        {/* contentAfter */}
        {contentAfter != null && (
          <span className="absolute right-8">{renderSlot(contentAfter, 'span', 'shrink-0')}</span>
        )}

        {/* Clear button / dismiss */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-2 flex h-4 w-4 items-center justify-center text-[#707070] hover:text-foreground"
            aria-label="Clear search"
          >
            {dismiss != null ? renderSlot(dismiss, 'span') : <DefaultDismissIcon />}
          </button>
        )}
      </div>
    );
};

SearchBox.displayName = 'SearchBox';
