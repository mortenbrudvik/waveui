import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { renderSlot } from '../../lib/slot';
import type { Size, Appearance, Slot } from '../../lib/types';
import { Button } from './Button';
import { buttonIconRenders, rendersContent } from './Button.utils';

/** Properties for the MenuButton component. */
export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant.
   * @default 'outline'
   */
  appearance?: Appearance;
  /** Size affecting height, padding and font size.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Icon slot rendered before the label. Decorative: it renders with `aria-hidden="true"` (a slot
   * object can override it). An icon-only menu button needs `aria-label`, `aria-labelledby` or
   * `title`.
   */
  icon?: Slot<'span'>;
  /**
   * Custom menu indicator rendered after the label, in place of the default chevron. Decorative
   * (`aria-hidden="true"` unless a slot object overrides it). `false` hides the indicator, as does
   * any value that renders nothing (`true`, `''`, an empty array or Fragment, e.g. from
   * `menuIcon={cond && <X />}`); `null`/`undefined` keep the default chevron.
   */
  menuIcon?: Slot<'span'>;
  /**
   * Whether the associated menu is open (`aria-expanded`). Leave it unset when the button is
   * wrapped in `Menu.Trigger`, which supplies `aria-expanded` itself.
   */
  expanded?: boolean;
  /** Ref to the rendered `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * A button that opens a menu: {@link Button} with `aria-haspopup="menu"`, `aria-expanded` and a
 * trailing chevron. Same appearances, sizes, `type="button"` default and decorative icon slot as
 * Button.
 *
 * Use it as the child of `Menu.Trigger`, which supplies `id`, `aria-expanded`, `aria-controls`,
 * the open/keyboard handlers and the ref. A defined `aria-haspopup`/`aria-expanded` prop wins over
 * the built-in `"menu"` and `expanded` defaults, so the trigger's live state always wins; an
 * `undefined` or `null` one (a wrapper forwarding its own unset props) keeps the defaults.
 *
 * @example
 * <Menu>
 *   <Menu.Trigger><MenuButton>Actions</MenuButton></Menu.Trigger>
 *   <Menu.Popover>…</Menu.Popover>
 * </Menu>
 */
export const MenuButton = ({
  appearance = 'outline',
  size = 'medium',
  icon,
  menuIcon,
  expanded,
  className,
  children,
  'aria-haspopup': ariaHasPopup,
  'aria-expanded': ariaExpanded,
  ...props
}: MenuButtonProps) => {
  // `menuIcon` follows the `icon` slot rule (`buttonIconRenders`): unset keeps the chevron, a value
  // that renders nothing (`false`, `true`, `''`, an empty array or Fragment) hides the indicator
  // without leaving an empty `aria-hidden` span behind.
  const indicator =
    menuIcon == null ? (
      <ChevronDownIcon className="shrink-0" />
    ) : buttonIconRenders(menuIcon) ? (
      renderSlot(menuIcon, 'span', 'inline-flex shrink-0 items-center', { 'aria-hidden': true })
    ) : null;

  // While the indicator renders, Button counts it as content and skips its icon-only check, so the
  // check lives here. Without an indicator (`menuIcon={false}`, `''`, …) Button warns by itself:
  // checking here too would log the same problem twice.
  const iconOnly = indicator !== null && buttonIconRenders(icon) && !rendersContent(children);
  const ariaLabel = props['aria-label'];
  const ariaLabelledBy = props['aria-labelledby'];
  const title = props.title;
  React.useEffect(() => {
    if (iconOnly && !ariaLabel && !ariaLabelledBy && !title) {
      warnOnce(
        'MenuButton:icon-only-name',
        'MenuButton: an icon-only menu button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon and the menu indicator are decorative and hidden from assistive technology).',
      );
    }
  }, [iconOnly, ariaLabel, ariaLabelledBy, title]);

  // `aria-haspopup`/`aria-expanded` defaults apply wherever the consumer's value is `undefined` or
  // `null` (as Button does for `type`, `role` and `tabIndex`), so a forwarded unset prop keeps them.
  return (
    <Button
      {...props}
      aria-haspopup={ariaHasPopup ?? 'menu'}
      aria-expanded={ariaExpanded ?? expanded}
      appearance={appearance}
      size={size}
      icon={icon}
      className={cn('gap-1.5', className)}
    >
      {children}
      {indicator}
    </Button>
  );
};

MenuButton.displayName = 'MenuButton';
