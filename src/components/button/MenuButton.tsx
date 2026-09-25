import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Size, Appearance, Slot } from '../../lib/types';
import { Button } from './Button';

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
   * object can override it). A menu button without a label (only the icon and/or the indicator)
   * needs `aria-label`, `aria-labelledby` or `title`.
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
 * Minimum width and horizontal padding per size of a menu button without a label (an icon, the
 * menu indicator or both): no minimum width and the padding of SplitButton's menu half. Button
 * counts the indicator as content, so it would give such a button the labelled 96px minimum width.
 */
const unlabelledSizeClasses: Record<Size, string> = {
  'extra-small': 'min-w-0 px-1.5',
  small: 'min-w-0 px-1.5',
  medium: 'min-w-0 px-2',
  large: 'min-w-0 px-2',
  'extra-large': 'min-w-0 px-3',
};

/**
 * A button that opens a menu: {@link Button} with `aria-haspopup="menu"`, `aria-expanded` and a
 * trailing chevron. Same appearances, sizes, `type="button"` default and decorative icon slot as
 * Button. Without a label (only an icon and/or the chevron) it has no minimum width, and it warns
 * in development when it also has no `aria-label`, `aria-labelledby` or `title`.
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
  // `menuIcon` follows the `icon` slot rule: unset keeps the chevron, a value that renders nothing
  // (`false`, `true`, `''`, an empty array, Set or Fragment) hides the indicator without leaving an
  // empty `aria-hidden` span behind.
  const indicator =
    menuIcon == null ? (
      <ChevronDownIcon className="shrink-0" />
    ) : slotRendersContent(menuIcon) ? (
      renderSlot(menuIcon, 'span', 'inline-flex shrink-0 items-center', { 'aria-hidden': true })
    ) : null;

  // While the indicator renders, Button counts it as content: it sizes the button as labelled and
  // skips its icon-only name check. A menu button whose only content is decorative (an icon, the
  // indicator or both) is therefore sized and checked here. Without an indicator
  // (`menuIcon={false}`, `''`, …) Button handles both by itself: checking here too would log the
  // same problem twice.
  // A generator label is read once by the check; its items are what renders.
  const label = materialiseSlotContent(children);
  const unlabelled = indicator !== null && !slotRendersContent(label);
  const ariaLabel = props['aria-label'];
  const ariaLabelledBy = props['aria-labelledby'];
  const title = props.title;
  React.useEffect(() => {
    if (unlabelled && !ariaLabel && !ariaLabelledBy && !title) {
      warnOnce(
        'MenuButton:icon-only-name',
        'MenuButton: an icon-only menu button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon and the menu indicator are decorative and hidden from assistive technology).',
      );
    }
  }, [unlabelled, ariaLabel, ariaLabelledBy, title]);

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
      className={cn('gap-1.5', unlabelled && unlabelledSizeClasses[size], className)}
    >
      {label}
      {indicator}
    </Button>
  );
};

MenuButton.displayName = 'MenuButton';
