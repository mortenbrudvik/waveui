import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { useControllable } from '../../hooks/useControllable';
import type { Size, Appearance, Slot } from '../../lib/types';
import { Button } from './Button';
import { buttonClassName } from './buttonStyles';

/** Properties for the ToggleButton component. */
export interface ToggleButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> {
  /** Controlled pressed state. */
  pressed?: boolean;
  /** Initial pressed state for uncontrolled usage.
   * @default false
   */
  defaultPressed?: boolean;
  /**
   * Called with the new pressed state when the user toggles the button. Fires only when the state
   * changes (once per click, also in StrictMode). In controlled mode the button keeps showing
   * `pressed` until the parent passes the new value.
   */
  onPressedChange?: (pressed: boolean) => void;
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
   * object can override it). An icon-only toggle needs `aria-label`, `aria-labelledby` or `title`.
   */
  icon?: Slot<'span'>;
  /** Ref to the rendered `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * The classes `buttonClassName({ pressed: true })` adds on top of the unpressed button, per
 * appearance and disabled state. Derived from the shared maps (never re-typed), so ToggleButton's
 * pressed look is exactly the button family's: `Button` merges them after its own classes with
 * `cn()`, which replaces the conflicting unpressed colors. Size classes are not involved.
 */
const pressedLayerCache = new Map<string, string>();
function getPressedLayer(appearance: Appearance, disabled: boolean): string {
  const key = `${appearance}:${String(disabled)}`;
  let layer = pressedLayerCache.get(key);
  if (layer === undefined) {
    const unpressed = new Set(buttonClassName({ appearance, disabled }).split(/\s+/));
    layer = buttonClassName({ appearance, disabled, pressed: true })
      .split(/\s+/)
      .filter((cls) => cls !== '' && !unpressed.has(cls))
      .join(' ');
    pressedLayerCache.set(key, layer);
  }
  return layer;
}

/**
 * A button that switches between pressed and unpressed (`aria-pressed`), e.g. Bold in a text
 * toolbar. Built on {@link Button}: same appearances, sizes, `type="button"` default, decorative
 * icon slot and icon-only warning. The pressed look uses the shared pressed colors (selected
 * tokens; a Highlight outline in forced colors).
 *
 * - Uncontrolled: `defaultPressed`; controlled: `pressed` + `onPressedChange`.
 * - A consumer `onClick` runs first; calling `event.preventDefault()` in it cancels the toggle.
 *
 * @example
 * <ToggleButton icon={<BoldIcon />} aria-label="Bold" />
 * <ToggleButton pressed={bold} onPressedChange={setBold}>Bold</ToggleButton>
 */
export const ToggleButton = ({
  pressed,
  defaultPressed = false,
  onPressedChange,
  appearance = 'outline',
  size = 'medium',
  disabled = false,
  className,
  onClick,
  ...props
}: ToggleButtonProps) => {
  const [isPressed, setPressed] = useControllable(pressed, defaultPressed, onPressedChange);

  const handleClick = composeEventHandlers(onClick, () => setPressed((current) => !current));

  // Button shows the disabled look for `disabled` and for a consumer `aria-disabled` alike.
  const ariaDisabled = props['aria-disabled'];
  const disabledLook = disabled || ariaDisabled === true || ariaDisabled === 'true';

  return (
    <Button
      {...props}
      appearance={appearance}
      size={size}
      disabled={disabled}
      aria-pressed={isPressed}
      onClick={handleClick}
      className={cn(isPressed && getPressedLayer(appearance, disabledLook), className)}
    />
  );
};

ToggleButton.displayName = 'ToggleButton';
