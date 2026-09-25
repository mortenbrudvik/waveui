import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { CheckIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import type { Slot } from '../../lib/types';
import { useMenuContext, useMenuListContext } from './Menu.context';
import { menuItemClasses } from './Menu.shared';
import { MenuItemRow, useMenuItemActivation, useMenuItemPlacementWarning } from './Menu.items';
import type { MenuItemProps } from './Menu.items';

/** The `checkedValues` group a checkable menu item belongs to (Fluent's `MenuItemSelectableProps`). */
export interface MenuItemSelectableProps {
  /** The group: a key of the menu's `checkedValues`. Radio items with the same `name` are exclusive. */
  name: string;
  /** The value that is in `checkedValues[name]` while the item is checked; unique within its group. */
  value: string;
}

/** Properties for the MenuItemCheckbox sub-component. */
export interface MenuItemCheckboxProps extends MenuItemProps, MenuItemSelectableProps {
  /**
   * Replaces the check glyph shown while the item is checked (decorative, `aria-hidden`). A
   * checked item always shows an indicator: `null`, `undefined` and a value that renders nothing
   * keep the default glyph (a value that renders nothing also warns in development).
   */
  checkmark?: Slot<'span'>;
}

/** Properties for the MenuItemRadio sub-component. */
export interface MenuItemRadioProps extends MenuItemProps, MenuItemSelectableProps {
  /** As `MenuItemCheckbox.checkmark`. */
  checkmark?: Slot<'span'>;
}

/** Properties for the MenuItemSwitch sub-component. */
export interface MenuItemSwitchProps extends MenuItemProps, MenuItemSelectableProps {}

type SelectableKind = 'checkbox' | 'radio' | 'switch';

interface SelectableMenuItemProps extends MenuItemCheckboxProps {
  /** Which item: the role, the state change (toggle or select) and the indicator. */
  kind: SelectableKind;
  /** The part's name in diagnostics (`Menu.ItemCheckbox`). */
  componentName: string;
}

/*
 * The switch indicator: Switch's tokens and forced-colors recipe (Switch exports no class maps), at
 * 32x16px with a 10px thumb. Sized in px like Switch, so the thumb offsets fit at any root font
 * size: the 1px border leaves a 30px inner track, so the thumb sits 2px from either end. Only the
 * thumb (the leaf indicator) opts out of forced colors; a disabled switch draws GrayText on Canvas.
 */
const switchOnTrack = 'forced-colors:border-[Highlight] forced-colors:bg-[Highlight]';
const switchDisabledOnTrack = 'forced-colors:border-[GrayText] forced-colors:bg-[Canvas]';

function renderSwitchIndicator(checked: boolean, disabled: boolean): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-menu-switch=""
      className={cn(
        'relative inline-flex h-[16px] w-[32px] shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none',
        checked
          ? cn('border-primary bg-primary', disabled ? switchDisabledOnTrack : switchOnTrack)
          : cn(
              'border-stroke-accessible bg-transparent',
              disabled ? forcedColors.disabled : forcedColors.control,
            ),
      )}
    >
      <span
        className={cn(
          'block h-[10px] w-[10px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
          checked
            ? 'translate-x-[18px] wave-rtl:-translate-x-[18px] bg-primary-foreground'
            : 'translate-x-[2px] wave-rtl:-translate-x-[2px] bg-stroke-accessible',
          disabled
            ? 'forced-colors:bg-[GrayText]'
            : checked
              ? 'forced-colors:bg-[HighlightText]'
              : 'forced-colors:bg-[ButtonText]',
        )}
      />
    </span>
  );
}

/**
 * The three checkable item kinds: a `menuitemcheckbox` or `menuitemradio` row bound to the menu's
 * `checkedValues[name]` by `value`. Activation (a click, Enter or Space) toggles the value
 * (checkbox, switch) or makes it the group's only value (radio); Space keeps the menu open.
 */
function SelectableMenuItem({
  kind,
  componentName,
  name,
  value,
  checkmark,
  icon,
  shortcut,
  disabled = false,
  persistOnClick,
  onClick,
  onKeyDown,
  children,
  className,
  ref,
  ...rest
}: SelectableMenuItemProps) {
  const menu = useMenuContext(componentName);
  const list = useMenuListContext();
  useMenuItemPlacementWarning(componentName);
  // The state of the menu that renders the list the item is in (a submenu's own or shared state).
  const state = (list?.menu ?? menu).checked;
  const checked = state.isChecked(name, value);

  // Development only: a second item with the same name and value in one list warns.
  const register = list?.registerCheckable;
  React.useEffect(() => register?.(name, value), [register, name, value]);

  // A checked item always shows an indicator: a `checkmark` that renders nothing keeps the glyph.
  const customCheckmark = checkmark != null && slotRendersContent(checkmark);
  const checkmarkEmpty = checkmark != null && !customCheckmark;
  React.useEffect(() => {
    if (!checkmarkEmpty) return;
    warnOnce(
      `${componentName}:checkmark-empty`,
      `${componentName}: \`checkmark\` renders nothing, so the item shows the default check glyph. A checked item always shows an indicator: pass an icon, or leave \`checkmark\` unset.`,
    );
  }, [checkmarkEmpty, componentName]);

  const activation = useMenuItemActivation({
    disabled,
    persistOnClick,
    onClick,
    onKeyDown,
    keepOpenOnSpace: true,
    onActivate: (event) => {
      if (kind === 'radio') state.select(name, value, event.nativeEvent);
      else state.toggle(name, value, event.nativeEvent);
    },
  });

  // Typeahead text: a string label directly; any other label through its marked element.
  const stringLabel = typeof children === 'string' ? children : undefined;
  const ownRovingText = (rest as Record<string, unknown>)['data-roving-text'] !== undefined;

  // The check column (checkbox and radio): the glyph while checked, empty while not. A switch item
  // has no check column of its own (it keeps the placeholder) and draws the switch at the end.
  let checkColumn: React.ReactNode = undefined;
  if (kind !== 'switch') {
    checkColumn = !checked ? null : customCheckmark ? (
      renderSlot(checkmark, 'span', 'inline-flex shrink-0 items-center justify-center', {
        'aria-hidden': true,
      })
    ) : (
      <CheckIcon size={16} />
    );
  }

  return (
    <div
      role={kind === 'radio' ? 'menuitemradio' : 'menuitemcheckbox'}
      data-roving-text={stringLabel}
      {...rest}
      ref={ref}
      aria-checked={checked}
      data-checked={checked ? '' : undefined}
      aria-disabled={disabled ? true : rest['aria-disabled']}
      data-disabled={disabled ? '' : undefined}
      onClick={activation.onClick}
      onKeyDown={activation.onKeyDown}
      className={cn(menuItemClasses, className)}
    >
      <MenuItemRow
        checkmark={checkColumn}
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        end={kind === 'switch' ? renderSwitchIndicator(checked, disabled) : undefined}
      />
    </div>
  );
}
SelectableMenuItem.displayName = 'SelectableMenuItem';

/**
 * A menu item that is checked or not (`role="menuitemcheckbox"`, `aria-checked`), bound to the
 * menu's `checkedValues[name]` by `value`. A click and Enter toggle it and close a popup menu
 * (unless `persistOnClick`, or the Menu's `persistOnItemClick`); Space toggles it and keeps the
 * menu open. A check shows while it is checked, and the menu reserves the check column for all its
 * items. Works in static and popup menus. `data-checked` is set while it is checked; a consumer
 * `aria-checked` never overrides the state. Disabled items show their state and never change it.
 * Must be used within Menu.
 *
 * Also exported as `MenuItemCheckbox` (import the flat name from React Server Components).
 */
export const MenuItemCheckbox = (props: MenuItemCheckboxProps) => (
  <SelectableMenuItem {...props} kind="checkbox" componentName="Menu.ItemCheckbox" />
);
MenuItemCheckbox.displayName = 'MenuItemCheckbox';

/**
 * A menu item that is one choice of a group (`role="menuitemradio"`, `aria-checked`), bound to the
 * menu's `checkedValues[name]` by `value`: checking it unchecks the other radio items of its
 * `name`; activating a checked radio item changes nothing (no `onCheckedValuesChange`). A click and
 * Enter check it and close a popup menu (unless `persistOnClick`, or the Menu's
 * `persistOnItemClick`); Space checks it and keeps the menu open. A check shows while it is
 * checked. Works in static and popup menus. Must be used within Menu.
 *
 * Put the radio items of one `name` in a `Menu.Group` (at least separate two sets with a
 * `Menu.Divider`): assistive technology counts a radio set by its group or separators, not by
 * `name`, so two sets side by side are announced as one.
 *
 * Also exported as `MenuItemRadio` (import the flat name from React Server Components).
 */
export const MenuItemRadio = (props: MenuItemRadioProps) => (
  <SelectableMenuItem {...props} kind="radio" componentName="Menu.ItemRadio" />
);
MenuItemRadio.displayName = 'MenuItemRadio';

/**
 * A checkbox item drawn as a switch at the end of the row (`role="menuitemcheckbox"`,
 * `aria-checked`), bound to the menu's `checkedValues[name]` by `value`. A click and Enter toggle
 * it and close a popup menu (unless `persistOnClick`, or the Menu's `persistOnItemClick`); Space
 * toggles it and keeps the menu open. The switch is decorative (`aria-hidden`). Works in static and
 * popup menus. Must be used within Menu.
 *
 * Also exported as `MenuItemSwitch` (import the flat name from React Server Components).
 */
export const MenuItemSwitch = (props: MenuItemSwitchProps) => (
  <SelectableMenuItem {...props} kind="switch" componentName="Menu.ItemSwitch" />
);
MenuItemSwitch.displayName = 'MenuItemSwitch';
