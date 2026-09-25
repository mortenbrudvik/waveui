import * as React from 'react';
import { cn } from '../../lib/cn';
import { ChevronDownIcon } from '../../lib/icons';
import { mergeProps } from '../../lib/mergeProps';
import type { Size, Appearance } from '../../lib/types';
import { Button } from './Button';

/**
 * Props for one half of a SplitButton (`menuButtonProps`, `primaryActionButtonProps`): native
 * `<button>` attributes, `data-*` attributes and `ref`. They are merged onto the built-in props
 * of that half: handlers are composed (yours run first), `className` is merged, id lists are
 * joined and any other value you pass wins.
 */
export interface SplitButtonMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ref to the `<button>` element of this half. */
  ref?: React.Ref<HTMLButtonElement>;
  /** Any `data-*` attribute. */
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}

/** Props for the primary action half of a SplitButton (same shape as the menu half). */
export type SplitButtonPrimaryActionButtonProps = SplitButtonMenuButtonProps;

/** Properties for the SplitButton component. */
export interface SplitButtonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /**
   * Disables both buttons. A half's own `disabled` (`primaryActionButtonProps`,
   * `menuButtonProps`) disables only that half.
   * @default false
   */
  disabled?: boolean;
  /** Visual style variant.
   * @default 'outline'
   */
  appearance?: Appearance;
  /** Size affecting height, padding and font size.
   * @default 'medium'
   */
  size?: Size;
  /** Click handler for the primary action button. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Click handler for the menu (chevron) button. */
  onMenuClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * Accessible name of the menu button (it shows only a chevron). Localize it.
   * @default 'More options'
   */
  menuButtonLabel?: string;
  /**
   * Props for the menu button: `aria-expanded`, `aria-controls`, `id`, handlers (`onKeyDown` for
   * ArrowDown/ArrowUp), `ref` for focus restoration, … Pass the render-prop props of
   * `Menu.Trigger` here to open a Menu from the chevron.
   */
  menuButtonProps?: SplitButtonMenuButtonProps;
  /** Props for the primary action button (`ref`, `title`, handlers, …). */
  primaryActionButtonProps?: SplitButtonPrimaryActionButtonProps;
  /** Ref to the wrapping `role="group"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Menu button size per SplitButton size: at least 24×24 CSS px at every size (WCAG 2.5.8 target
 * size; the chevron shares an edge with the primary button, so the spacing exception does not
 * apply). Overrides the square icon-only sizing of `Button` (`w-*`, `px-0`).
 */
const menuButtonSizeClasses: Record<Size, string> = {
  'extra-small': 'w-auto min-w-6 min-h-6 px-1.5',
  small: 'w-auto min-w-6 min-h-6 px-1.5',
  medium: 'w-auto min-w-6 min-h-6 px-2',
  large: 'w-auto min-w-6 min-h-6 px-2',
  'extra-large': 'w-auto min-w-6 min-h-6 px-3',
};

/** The separator is the menu button's start border (logical, so it mirrors in RTL). */
const separatorClasses: Record<Appearance, string> = {
  primary: 'border-s-primary-foreground/30',
  outline: 'border-s-stroke',
  subtle: 'border-s-stroke',
  transparent: 'border-s-stroke',
};

/**
 * Keeps each half's focus ring above its neighbour. `min-h-6` keeps both halves as tall as the
 * 24px menu button target at the extra-small size.
 */
const halfClasses = 'relative min-h-6 focus-visible:z-10';

/**
 * A primary action button joined to a menu button (chevron), e.g. Save + "Save as…" options.
 * Both halves are {@link Button}s with the shared appearances and sizes, inside a
 * `role="group"` wrapper.
 *
 * - `ref`, `className`, `style`, `aria-label` and other props go to the group; `aria-describedby`
 *   is routed to the primary button (so a Tooltip around the SplitButton describes the action).
 * - `primaryActionButtonProps` / `menuButtonProps` reach the two buttons; the menu button is
 *   named by `menuButtonLabel` (default `'More options'`).
 * - The menu button is at least 24×24 px at every size, so an extra-small SplitButton is 24px tall.
 *
 * @example
 * <Menu>
 *   <Menu.Trigger>
 *     {(triggerProps) => (
 *       <SplitButton menuButtonProps={triggerProps} onClick={save}>Save</SplitButton>
 *     )}
 *   </Menu.Trigger>
 *   <Menu.Popover>…</Menu.Popover>
 * </Menu>
 */
export const SplitButton = ({
  appearance = 'outline',
  size = 'medium',
  disabled = false,
  className,
  children,
  onClick,
  onMenuClick,
  menuButtonLabel = 'More options',
  menuButtonProps,
  primaryActionButtonProps,
  'aria-describedby': ariaDescribedBy,
  role,
  ref,
  ...props
}: SplitButtonProps) => {
  const primary = mergeProps(
    { 'aria-describedby': ariaDescribedBy, onClick } as SplitButtonMenuButtonProps,
    primaryActionButtonProps,
  );
  const menu = mergeProps(
    {
      'aria-label': menuButtonLabel,
      'aria-haspopup': 'menu',
      onClick: onMenuClick,
    } as SplitButtonMenuButtonProps,
    menuButtonProps,
  );

  // `role="group"` applies wherever the consumer's role is `undefined` or `null` (as in Button).
  return (
    <div
      ref={ref}
      {...props}
      role={role ?? 'group'}
      className={cn('inline-flex items-stretch', className)}
    >
      <Button
        {...primary}
        appearance={appearance}
        size={size}
        disabled={disabled || primary.disabled}
        className={cn(halfClasses, 'rounded-e-none border-e-0', primary.className)}
      >
        {children}
      </Button>
      <Button
        {...menu}
        appearance={appearance}
        size={size}
        disabled={disabled || menu.disabled}
        icon={<ChevronDownIcon />}
        className={cn(
          halfClasses,
          menuButtonSizeClasses[size],
          'rounded-s-none',
          separatorClasses[appearance],
          menu.className,
        )}
      />
    </div>
  );
};

SplitButton.displayName = 'SplitButton';
