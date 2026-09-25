import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { useControllable } from '../../hooks/useControllable';
import type { Size, Appearance, IconPosition, Slot } from '../../lib/types';
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
   * Icon slot rendered before the label (after it with `iconPosition="after"`). Decorative: it
   * renders with `aria-hidden="true"` (a slot object can override it). An icon-only toggle needs
   * `aria-label`, `aria-labelledby` or `title`.
   */
  icon?: Slot<'span'>;
  /**
   * Where the icon renders: before the label (the inline start) or after it (the inline end).
   * Follows the writing direction through DOM order. Has no effect on an icon-only toggle.
   * @default 'before'
   */
  iconPosition?: IconPosition;
  /**
   * Marks the toggle unavailable but keeps it focusable and in the tab order (see
   * `Button.disabledFocusable`): `aria-disabled="true"`, `data-disabled` and
   * `data-disabled-focusable` instead of the native `disabled` attribute. Clicks, Enter and Space
   * neither toggle it nor call `onClick` or `onPressedChange`; a pressed toggle shows the pressed
   * and disabled look. Wins over `disabled` when both are set. In a `Toolbar` it stays in the
   * arrow-key order.
   * @default false
   */
  disabledFocusable?: boolean;
  /**
   * Draws the pressed state as a brand fill with on-brand text (on `primary`, the pressed fill with
   * an inset on-brand stroke), so the state never depends on a light tint (Fluent's
   * `isAccessible`). Recommended for icon-only toggles in toolbars. Forced colors are unchanged.
   * @default false
   */
  isAccessible?: boolean;
  /** Ref to the rendered `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * The classes `buttonClassName({ pressed: true, accessible })` adds on top of the unpressed button,
 * per appearance, disabled state and `isAccessible`. Derived from the shared maps (never re-typed),
 * so ToggleButton's pressed look is exactly the button family's: `Button` merges them after its own
 * classes with `cn()`, which replaces the conflicting unpressed colors. Size classes are not
 * involved.
 */
const pressedLayerCache = new Map<string, string>();
function getPressedLayer(appearance: Appearance, disabled: boolean, accessible: boolean): string {
  const key = `${appearance}:${String(disabled)}:${String(accessible)}`;
  let layer = pressedLayerCache.get(key);
  if (layer === undefined) {
    const unpressed = new Set(buttonClassName({ appearance, disabled }).split(/\s+/));
    layer = buttonClassName({ appearance, disabled, pressed: true, accessible })
      .split(/\s+/)
      .filter((cls) => cls !== '' && !unpressed.has(cls))
      .join(' ');
    pressedLayerCache.set(key, layer);
  }
  return layer;
}

/**
 * The roles that report a toggle's state with `aria-checked` (`aria-pressed` is allowed only on
 * `button`).
 */
const CHECKED_ROLES: ReadonlySet<string> = new Set([
  'checkbox',
  'radio',
  'switch',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'treeitem',
]);

/**
 * Which attribute reports the pressed state for `role` (its first token, ASCII case-insensitive):
 * `'pressed'` (no role or `button`), `'checked'` (a checked role) or `'none'` (any other role).
 */
function stateAttributeFor(role: string | undefined): 'pressed' | 'checked' | 'none' {
  const token = role?.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (token === '' || token === 'button') return 'pressed';
  return CHECKED_ROLES.has(token) ? 'checked' : 'none';
}

/**
 * A button that switches between pressed and unpressed, e.g. Bold in a text toolbar. Built on
 * {@link Button}: same appearances, sizes, `type="button"` default, decorative icon slot and
 * icon-only warning. The pressed look uses the shared pressed colors (selected tokens; a Highlight
 * outline in forced colors), or a brand fill with `isAccessible`.
 *
 * - Uncontrolled: `defaultPressed`; controlled: `pressed` + `onPressedChange`.
 * - A consumer `onClick` runs first; calling `event.preventDefault()` in it cancels the toggle.
 * - It reports its state with `aria-pressed` without a `role` or with `role="button"`. With `role`
 *   `checkbox`, `radio`, `switch`, `menuitemcheckbox`, `menuitemradio`, `option` or `treeitem` it
 *   reports it with `aria-checked` (and `data-checked` while pressed) instead; with any other role
 *   it renders neither (development warning), because `aria-pressed` is allowed only on buttons.
 *   `data-pressed` is present while pressed in every case.
 *
 * @example
 * <ToggleButton icon={<BoldIcon />} aria-label="Bold" />
 * <ToggleButton pressed={bold} onPressedChange={setBold}>Bold</ToggleButton>
 * <ToggleButton role="checkbox" isAccessible icon={<GridIcon />} aria-label="Grid" />
 */
export const ToggleButton = ({
  pressed,
  defaultPressed = false,
  onPressedChange,
  appearance = 'outline',
  size = 'medium',
  disabled = false,
  disabledFocusable = false,
  isAccessible = false,
  className,
  onClick,
  ...props
}: ToggleButtonProps) => {
  const [isPressed, setPressed] = useControllable(pressed, defaultPressed, onPressedChange);

  // With `disabledFocusable`, Button replaces this handler, so the toggle never runs.
  const handleClick = composeEventHandlers(onClick, () => setPressed((current) => !current));

  // Button shows the disabled look for `disabled`, `disabledFocusable` and a consumer
  // `aria-disabled` alike.
  const ariaDisabled = props['aria-disabled'];
  const disabledLook =
    disabled || disabledFocusable || ariaDisabled === true || ariaDisabled === 'true';

  const role = props.role;
  const stateAttribute = stateAttributeFor(role);
  React.useEffect(() => {
    if (stateAttribute !== 'none') return;
    warnOnce(
      'ToggleButton:role-state',
      `ToggleButton: \`role="${String(role).trim()}"\` allows neither \`aria-pressed\` nor \`aria-checked\`, so the pressed state is not exposed to assistive technology. Leave the role out (or use \`button\`), or use a role that has a checked state: \`checkbox\`, \`radio\`, \`switch\`, \`menuitemcheckbox\`, \`menuitemradio\`, \`option\` or \`treeitem\`.`,
    );
  }, [stateAttribute, role]);

  return (
    <Button
      {...props}
      appearance={appearance}
      size={size}
      disabled={disabled}
      disabledFocusable={disabledFocusable}
      // After the consumer's props: the attribute the role allows reports the state, and a
      // consumer `aria-pressed` never survives where it is not allowed.
      aria-pressed={stateAttribute === 'pressed' ? isPressed : undefined}
      {...(stateAttribute === 'checked' && {
        'aria-checked': isPressed,
        'data-checked': isPressed ? '' : undefined,
      })}
      data-pressed={isPressed ? '' : undefined}
      onClick={handleClick}
      className={cn(
        isPressed && getPressedLayer(appearance, disabledLook, isAccessible),
        className,
      )}
    />
  );
};

ToggleButton.displayName = 'ToggleButton';
