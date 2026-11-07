import * as React from 'react';
import { wcn } from '../../lib/cn';
import {
  menuItemCheckboxClassNames,
  menuItemClassNames,
  menuItemRadioClassNames,
  menuItemSwitchClassNames,
} from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { CheckIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { forcedColors } from '../../lib/styles';
import type { Slot } from '../../lib/types';
import { useMenuContext, useMenuListContext } from './Menu.context';
import { BLOCK_CLICK, MENU_PART_LOCKS, menuItemClasses } from './Menu.shared';
import {
  MenuItemRow,
  getMenuItemDisabledProps,
  useMenuItemActivation,
  useMenuItemPlacementWarning,
} from './Menu.items';
import type { MenuItemProps, MenuItemRowPartClassNames } from './Menu.items';
import { useAppClassName } from '../../hooks/useAppClassName';

/** The `checkedValues` group a checkable menu item belongs to (Fluent's `MenuItemSelectableProps`). */
export interface MenuItemSelectableProps {
  /** The group: a key of the menu's `checkedValues`. Radio items with the same `name` are exclusive. */
  name: string;
  /** The value that is in `checkedValues[name]` while the item is checked; unique within its group. */
  value: string;
}

/** Properties for the MenuItemCheckbox sub-component. */
export interface MenuItemCheckboxProps
  extends Omit<MenuItemProps, 'slotProps'>, MenuItemSelectableProps {
  /**
   * Replaces the check glyph shown while the item is checked (decorative, `aria-hidden`). A
   * checked item always shows an indicator: `null`, `undefined` and a value that renders nothing
   * keep the default glyph (a value that renders nothing also warns in development).
   */
  checkmark?: Slot<'span'>;
  /**
   * Props for the elements the item draws in its row, by part, merged into each part's own: your
   * classes after the part's (yours win a conflict), your styles over its styles, your attributes
   * and handlers added, your ref attached. Every attribute the item sets on a part is locked and
   * keeps the item's value, and no part takes a role, a tab index or the markers by which the menu
   * reads an item's row (the text typeahead matches, the check and icon columns its labels line up
   * by), so a part changes neither the menu's items, its one tab stop, its typeahead nor its
   * columns. A part takes no `children` (the item draws their content); the item element itself
   * takes the item's own props, the check glyph is `checkmark` and the icon `icon`. No part
   * carries a handler of the item: an event on a part reaches the item and its menu as one on the
   * label does, after your handler, and `preventDefault()` in yours skips their handling of it
   * there too. A click you prevent leaves the item checked or unchecked as it was (and its menu
   * open), while the item's `onClick` is still called, as for a prevented click on the label.
   * While the item is `disabled`, your `onClick` on a part is not called, as the item's own is not
   * (an `aria-disabled` alone leaves both called). Fluent UI's MenuItemCheckbox gives these parts
   * slots of their own (`content`, `secondaryContent` for the shortcut).
   */
  slotProps?: {
    /**
     * The `<span>` of the label (`children`), which fills the row (stable classes
     * `wave-menu-item__content` and `wave-menu-item-checkbox__content`). Locked: no role, tab
     * index or roving container marker, the menu's markers (typeahead reads a label that is no
     * string through this element), and unset `aria-label` (it would replace the text in the
     * item's name), `hidden`, `inert` and `aria-hidden`.
     */
    content?: SlotPart<'span'>;
    /**
     * The `<span>` of `shortcut`, rendered while `shortcut` is set (stable classes
     * `wave-menu-item__shortcut` and `wave-menu-item-checkbox__shortcut`). Locked: `dir` (`auto`,
     * so the text keeps its own direction and "Ctrl+," its order in a right-to-left menu), no role
     * or tab index, and the menu's markers.
     */
    shortcut?: SlotPart<'span'>;
    /**
     * The `<span>` of `subText`, under the label, rendered while `subText` renders content (stable
     * classes `wave-menu-item__sub-text` and `wave-menu-item-checkbox__sub-text`). Locked: no role, tab index or roving container
     * marker, and the menu's markers.
     */
    subText?: SlotPart<'span'>;
  };
}

/** Properties for the MenuItemRadio sub-component. */
export interface MenuItemRadioProps
  extends Omit<MenuItemProps, 'slotProps'>, MenuItemSelectableProps {
  /** As `MenuItemCheckbox.checkmark`. */
  checkmark?: Slot<'span'>;
  /**
   * Props for the elements the item draws in its row, by part, merged into each part's own: your
   * classes after the part's (yours win a conflict), your styles over its styles, your attributes
   * and handlers added, your ref attached. Every attribute the item sets on a part is locked and
   * keeps the item's value, and no part takes a role, a tab index or the markers by which the menu
   * reads an item's row (the text typeahead matches, the check and icon columns its labels line up
   * by), so a part changes neither the menu's items, its one tab stop, its typeahead nor its
   * columns. A part takes no `children` (the item draws their content); the item element itself
   * takes the item's own props, the check glyph is `checkmark` and the icon `icon`. No part
   * carries a handler of the item: an event on a part reaches the item and its menu as one on the
   * label does, after your handler, and `preventDefault()` in yours skips their handling of it
   * there too. A click you prevent checks nothing (and leaves its menu open), while the item's
   * `onClick` is still called, as for a prevented click on the label. While the item is
   * `disabled`, your `onClick` on a part is not called, as the item's own is not (an
   * `aria-disabled` alone leaves both called). Fluent UI's MenuItemRadio gives these parts slots of
   * their own (`content`, `secondaryContent` for the shortcut).
   */
  slotProps?: {
    /**
     * The `<span>` of the label (`children`), which fills the row (stable classes
     * `wave-menu-item__content` and `wave-menu-item-radio__content`). Locked: no role, tab
     * index or roving container marker, the menu's markers (typeahead reads a label that is no
     * string through this element), and unset `aria-label` (it would replace the text in the
     * item's name), `hidden`, `inert` and `aria-hidden`.
     */
    content?: SlotPart<'span'>;
    /**
     * The `<span>` of `shortcut`, rendered while `shortcut` is set (stable classes
     * `wave-menu-item__shortcut` and `wave-menu-item-radio__shortcut`). Locked: `dir` (`auto`, so
     * the text keeps its own direction and "Ctrl+," its order in a right-to-left menu), no role or
     * tab index, and the menu's markers.
     */
    shortcut?: SlotPart<'span'>;
    /**
     * The `<span>` of `subText`, under the label, rendered while `subText` renders content (stable
     * classes `wave-menu-item__sub-text` and `wave-menu-item-radio__sub-text`). Locked: no role, tab index or roving container
     * marker, and the menu's markers.
     */
    subText?: SlotPart<'span'>;
  };
}

/** Properties for the MenuItemSwitch sub-component. */
export interface MenuItemSwitchProps
  extends Omit<MenuItemProps, 'slotProps'>, MenuItemSelectableProps {
  /**
   * Props for the elements the item draws in its row, by part, merged into each part's own: your
   * classes after the part's (yours win a conflict), your styles over its styles, your attributes
   * and handlers added, your ref attached. Every attribute the item sets on a part is locked and
   * keeps the item's value, and no part takes a role, a tab index or the markers by which the menu
   * reads an item's row (the text typeahead matches, the check and icon columns its labels line up
   * by), so a part changes neither the menu's items, its one tab stop, its typeahead nor its
   * columns. A part takes no `children` (the item draws their content); the item element itself
   * takes the item's own props, and the icon is `icon`. No part carries a handler of the item: an
   * event on a part reaches the item and its menu as one on the label does, after your handler,
   * and `preventDefault()` in yours skips their handling of it there too. A click you prevent
   * leaves the switch on or off as it was (and its menu open), while the item's `onClick` is still
   * called, as for a prevented click on the label. While the item is `disabled`, your `onClick` on
   * a part is not called, as the item's own is not (an `aria-disabled` alone leaves both called).
   * Fluent UI's MenuItemSwitch gives these parts slots of their own (`content`, `secondaryContent`
   * for the shortcut, `switchIndicator` for the switch).
   */
  slotProps?: {
    /**
     * The `<span>` of the label (`children`), which fills the row (stable classes
     * `wave-menu-item__content` and `wave-menu-item-switch__content`). Locked: no role, tab
     * index or roving container marker, the menu's markers (typeahead reads a label that is no
     * string through this element), and unset `aria-label` (it would replace the text in the
     * item's name), `hidden`, `inert` and `aria-hidden`.
     */
    content?: SlotPart<'span'>;
    /**
     * The `<span>` of `shortcut`, rendered while `shortcut` is set (stable classes
     * `wave-menu-item__shortcut` and `wave-menu-item-switch__shortcut`). Locked: `dir` (`auto`, so
     * the text keeps its own direction and "Ctrl+," its order in a right-to-left menu), no role or
     * tab index, and the menu's markers.
     */
    shortcut?: SlotPart<'span'>;
    /**
     * The `<span>` of `subText`, under the label, rendered while `subText` renders content (stable
     * classes `wave-menu-item__sub-text` and `wave-menu-item-switch__sub-text`). Locked: no role, tab index or roving container
     * marker, and the menu's markers.
     */
    subText?: SlotPart<'span'>;
    /**
     * The `<span>` of the switch at the row's end, its track, which follows the item's checked and
     * disabled state through its classes (stable class `wave-menu-item-switch__track`). Locked:
     * `aria-hidden` (the switch is a drawing: the item carries the state) and the switch's
     * internal marker, no role, tab index or roving container marker, and the menu's markers.
     */
    track?: SlotPart<'span'>;
    /**
     * The `<span>` of the switch's thumb, inside the track, at the track's far end while the item
     * is checked (stable class `wave-menu-item-switch__thumb`). Locked: no role, tab index or
     * roving container marker, and the menu's markers.
     */
    thumb?: SlotPart<'span'>;
  };
}

type SelectableKind = 'checkbox' | 'radio' | 'switch';

interface SelectableMenuItemProps extends Omit<MenuItemCheckboxProps, 'slotProps'> {
  /** The parts of every kind (the switch's two only drawn by a switch item). */
  slotProps?: MenuItemSwitchProps['slotProps'];
  /** Which item: the role, the state change (toggle or select) and the indicator. */
  kind: SelectableKind;
  /** The part's name in diagnostics (`Menu.ItemCheckbox`). */
  componentName: string;
  /** The item element's stable classes: the base item's and the kind's own. */
  rootClassName: string;
  /** The app-wide classes of `WaveProvider classNames` for the item's roots, after its own. */
  appClassName?: string;
  /** The row parts' stable classes (the base item's and the kind's own). */
  partClassNames: MenuItemRowPartClassNames;
}

/*
 * The switch indicator: Switch's tokens and forced-colors recipe (Switch exports no class maps), at
 * 32x16px with a 10px thumb. Sized in px like Switch, so the thumb offsets fit at any root font
 * size: the 1px border leaves a 30px inner track, so the thumb sits 2px from either end. Only the
 * thumb (the leaf indicator) opts out of forced colors; a disabled switch draws GrayText on Canvas.
 */
const switchOnTrack = 'wave:forced-colors:border-[Highlight] wave:forced-colors:bg-[Highlight]';
const switchDisabledOnTrack = 'wave:forced-colors:border-[GrayText] wave:forced-colors:bg-[Canvas]';

function renderSwitchIndicator(
  checked: boolean,
  disabled: boolean,
  parts: MenuItemSwitchProps['slotProps'],
): React.ReactElement {
  const trackClasses = wcn(
    menuItemSwitchClassNames.track,
    'wave:relative wave:inline-flex wave:h-[16px] wave:w-[32px] wave:shrink-0 wave:items-center wave:rounded-full wave:border wave:transition-colors wave:duration-200 wave:motion-reduce:transition-none',
    checked
      ? wcn('wave:border-primary wave:bg-primary', disabled ? switchDisabledOnTrack : switchOnTrack)
      : wcn(
          'wave:border-stroke-accessible wave:bg-transparent',
          disabled ? forcedColors.disabled : forcedColors.control,
        ),
  );
  const thumbClasses = wcn(
    menuItemSwitchClassNames.thumb,
    'wave:block wave:h-[10px] wave:w-[10px] wave:rounded-full wave:transition-transform wave:duration-200 wave:motion-reduce:transition-none wave:forced-colors:forced-color-adjust-none',
    checked
      ? 'wave:translate-x-[18px] wave:wave-rtl:-translate-x-[18px] wave:bg-primary-foreground'
      : 'wave:translate-x-[2px] wave:wave-rtl:-translate-x-[2px] wave:bg-stroke-accessible',
    disabled
      ? 'wave:forced-colors:bg-[GrayText]'
      : checked
        ? 'wave:forced-colors:bg-[HighlightText]'
        : 'wave:forced-colors:bg-[ButtonText]',
  );
  // The parts are merged only when given: a menu renders many items. A disabled item calls no
  // click handler of a part.
  const blockHandlers = disabled ? BLOCK_CLICK : undefined;
  return (
    <span
      aria-hidden="true"
      data-menu-switch=""
      className={trackClasses}
      {...(parts?.track &&
        mergeSlotProps(parts.track, {
          className: trackClasses,
          locked: { ...MENU_PART_LOCKS, 'aria-hidden': 'true', 'data-menu-switch': '' },
          blockHandlers,
        }))}
    >
      <span
        className={thumbClasses}
        {...(parts?.thumb &&
          mergeSlotProps(parts.thumb, {
            className: thumbClasses,
            locked: MENU_PART_LOCKS,
            blockHandlers,
          }))}
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
  rootClassName,
  appClassName,
  partClassNames,
  name,
  value,
  checkmark,
  icon,
  shortcut,
  secondaryContent,
  subText,
  disabled = false,
  disabledFocusable = false,
  persistOnClick,
  onClick,
  onKeyDown,
  children,
  className,
  ref,
  slotProps,
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

  const { unavailable, ...disabledProps } = getMenuItemDisabledProps(
    disabled,
    disabledFocusable,
    rest['aria-disabled'],
  );

  const activation = useMenuItemActivation({
    disabled: unavailable,
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
      renderSlot(
        checkmark,
        'span',
        'wave:inline-flex wave:shrink-0 wave:items-center wave:justify-center',
        {
          'aria-hidden': true,
        },
      )
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
      {...disabledProps}
      onClick={activation.onClick}
      onKeyDown={activation.onKeyDown}
      className={wcn(rootClassName, menuItemClasses, appClassName, className)}
    >
      <MenuItemRow
        checkmark={checkColumn}
        icon={icon}
        label={children}
        shortcut={shortcut}
        secondaryContent={secondaryContent}
        subText={subText}
        markLabel={!ownRovingText}
        partClassNames={partClassNames}
        parts={slotProps}
        disabled={unavailable}
        end={kind === 'switch' ? renderSwitchIndicator(checked, unavailable, slotProps) : undefined}
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
export const MenuItemCheckbox = (props: MenuItemCheckboxProps) => {
  const appClassName = useAppClassName(menuItemClassNames.root, menuItemCheckboxClassNames.root);
  return (
    <SelectableMenuItem
      {...props}
      kind="checkbox"
      componentName="Menu.ItemCheckbox"
      rootClassName={wcn(menuItemClassNames.root, menuItemCheckboxClassNames.root)}
      appClassName={appClassName}
      partClassNames={{
        checkmark: wcn(menuItemClassNames.checkmark, menuItemCheckboxClassNames.checkmark),
        icon: wcn(menuItemClassNames.icon, menuItemCheckboxClassNames.icon),
        content: wcn(menuItemClassNames.content, menuItemCheckboxClassNames.content),
        shortcut: wcn(menuItemClassNames.shortcut, menuItemCheckboxClassNames.shortcut),
        subText: wcn(menuItemClassNames.subText, menuItemCheckboxClassNames.subText),
      }}
    />
  );
};
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
export const MenuItemRadio = (props: MenuItemRadioProps) => {
  const appClassName = useAppClassName(menuItemClassNames.root, menuItemRadioClassNames.root);
  return (
    <SelectableMenuItem
      {...props}
      kind="radio"
      componentName="Menu.ItemRadio"
      rootClassName={wcn(menuItemClassNames.root, menuItemRadioClassNames.root)}
      appClassName={appClassName}
      partClassNames={{
        checkmark: wcn(menuItemClassNames.checkmark, menuItemRadioClassNames.checkmark),
        icon: wcn(menuItemClassNames.icon, menuItemRadioClassNames.icon),
        content: wcn(menuItemClassNames.content, menuItemRadioClassNames.content),
        shortcut: wcn(menuItemClassNames.shortcut, menuItemRadioClassNames.shortcut),
        subText: wcn(menuItemClassNames.subText, menuItemRadioClassNames.subText),
      }}
    />
  );
};
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
export const MenuItemSwitch = (props: MenuItemSwitchProps) => {
  const appClassName = useAppClassName(menuItemClassNames.root, menuItemSwitchClassNames.root);
  return (
    <SelectableMenuItem
      {...props}
      kind="switch"
      componentName="Menu.ItemSwitch"
      rootClassName={wcn(menuItemClassNames.root, menuItemSwitchClassNames.root)}
      appClassName={appClassName}
      partClassNames={{
        icon: wcn(menuItemClassNames.icon, menuItemSwitchClassNames.icon),
        content: wcn(menuItemClassNames.content, menuItemSwitchClassNames.content),
        shortcut: wcn(menuItemClassNames.shortcut, menuItemSwitchClassNames.shortcut),
        subText: wcn(menuItemClassNames.subText, menuItemSwitchClassNames.subText),
      }}
    />
  );
};
MenuItemSwitch.displayName = 'MenuItemSwitch';
