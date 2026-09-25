import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { mergeProps } from '../../lib/mergeProps';
import { slotRendersContent } from '../../lib/slot';
import type { Size, Appearance, IconPosition, Slot } from '../../lib/types';
import { Button } from './Button';

/**
 * Props for one half of a SplitButton (`menuButtonProps`, `primaryActionButtonProps`): native
 * `<button>` attributes, `data-*` attributes and `ref`. They are merged onto the built-in props
 * of that half: handlers are composed (yours run first), `className` is merged, id lists are
 * joined and any other value you pass wins.
 */
export interface SplitButtonMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Makes only this half unavailable but focusable (see `SplitButton.disabledFocusable`, which
   * affects both halves). For each half, focusable-disabled wins over natively disabled.
   * @default false
   */
  disabledFocusable?: boolean;
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
  /**
   * Makes both halves unavailable but focusable (see `Button.disabledFocusable`): each half
   * renders `aria-disabled="true"`, `data-disabled` and `data-disabled-focusable`, stays in the tab
   * order, and neither `onClick` nor the menu opens. A half's own `disabledFocusable` (in
   * `primaryActionButtonProps`/`menuButtonProps`) affects only that half. For each half,
   * focusable-disabled wins over natively disabled: the half is focusable-disabled when the root's
   * or its own `disabledFocusable` is set; otherwise it is natively disabled when the root's or its
   * own `disabled` is set.
   * @default false
   */
  disabledFocusable?: boolean;
  /**
   * Icon of the primary action, decorative (`aria-hidden`). For an icon-only primary action pass
   * `primaryActionButtonProps={{ 'aria-label': '…' }}`.
   */
  icon?: Slot<'span'>;
  /**
   * Where the primary action's icon renders: before its label (the inline start) or after it.
   * Has no effect on an icon-only primary action. The menu half is not affected.
   * @default 'before'
   */
  iconPosition?: IconPosition;
  /**
   * Replaces the chevron of the menu half (decorative, `aria-hidden`). The menu half always shows
   * an indicator: `null` and `undefined` keep the default chevron, and so does a value that renders
   * nothing (`false`, `''`, an empty array), which also logs a development warning. Unlike
   * `MenuButton.menuIcon`, a value that renders nothing does not hide the indicator.
   */
  menuIcon?: Slot<'span'>;
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
 * - `icon`/`iconPosition` belong to the primary action; `menuIcon` replaces the chevron, which the
 *   menu half always shows (a `menuIcon` that renders nothing keeps it).
 * - `disabledFocusable` keeps both halves focusable while unavailable; `Menu.Trigger` does not open
 *   its menu from an `aria-disabled` menu half.
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
  disabledFocusable = false,
  icon,
  iconPosition,
  menuIcon,
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

  // Per half: focusable-disabled (the root's or its own) wins over natively disabled.
  const primaryFocusable = disabledFocusable || Boolean(primary.disabledFocusable);
  const menuFocusable = disabledFocusable || Boolean(menu.disabledFocusable);

  // The menu half always shows an indicator: a `menuIcon` that renders nothing keeps the chevron.
  const menuIconRenders = slotRendersContent(menuIcon);
  const menuIconEmpty = menuIcon != null && !menuIconRenders;
  React.useEffect(() => {
    if (menuIconEmpty) {
      warnOnce(
        'SplitButton:menuIcon-empty',
        'SplitButton: `menuIcon` renders nothing, so the menu button shows the default chevron. Unlike `MenuButton`, a SplitButton always shows a menu indicator: pass an icon, or leave `menuIcon` unset.',
      );
    }
  }, [menuIconEmpty]);

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
        disabled={!primaryFocusable && (disabled || Boolean(primary.disabled))}
        disabledFocusable={primaryFocusable}
        icon={icon}
        iconPosition={iconPosition}
        className={cn(halfClasses, 'rounded-e-none border-e-0', primary.className)}
      >
        {children}
      </Button>
      <Button
        {...menu}
        appearance={appearance}
        size={size}
        disabled={!menuFocusable && (disabled || Boolean(menu.disabled))}
        disabledFocusable={menuFocusable}
        icon={menuIconRenders ? menuIcon : <ChevronDownIcon />}
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
