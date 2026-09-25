import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { CheckedValues, CheckedValuesChangeHandler, Orientation, Size } from '../../lib/types';
import { useCheckedValues } from '../../hooks/useCheckedValues';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { ToolbarContext, useToolbarCheckableRegistry } from './Toolbar.context';
import type { ToolbarContextValue } from './Toolbar.context';
import {
  ToolbarButton,
  ToolbarDivider,
  ToolbarGroup,
  ToolbarRadioButton,
  ToolbarRadioGroup,
  ToolbarToggleButton,
} from './Toolbar.parts';

export {
  ToolbarButton,
  ToolbarDivider,
  ToolbarGroup,
  ToolbarRadioButton,
  ToolbarRadioGroup,
  ToolbarToggleButton,
};
export type {
  ToolbarButtonOwnProps,
  ToolbarButtonProps,
  ToolbarDividerProps,
  ToolbarGroupProps,
  ToolbarRadioButtonProps,
  ToolbarRadioGroupProps,
  ToolbarToggleButtonProps,
} from './Toolbar.parts';

/**
 * The Toolbar's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props
 * only). Every other prop comes from the rendered element (`as`, default `'div'`). Give the
 * toolbar an `aria-label` (or `aria-labelledby`) that describes its purpose, e.g. "Formatting".
 */
export interface ToolbarOwnProps {
  /**
   * Layout and arrow-key axis: Left/Right move between items when horizontal (mirrored in RTL),
   * Up/Down when vertical. Exposed as `aria-orientation` and `data-orientation`.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /**
   * Default size of `Toolbar.Button`, `Toolbar.ToggleButton` and `Toolbar.RadioButton` (their
   * own `size` wins), and the toolbar's padding. Plain Buttons inside keep their own default.
   * Exposed as `data-size`.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Pressed `Toolbar.ToggleButton`s and checked `Toolbar.RadioButton`s, per group `name`
   * (controlled): `{ format: ['bold'], align: ['center'] }`.
   */
  checkedValues?: CheckedValues;
  /** Initial checked values for uncontrolled usage. @default {} */
  defaultCheckedValues?: CheckedValues;
  /**
   * Called when a toggle or radio changes them (only on change): the new checked values first,
   * then `details` with the group's `name`, its `checkedItems` and the `event` (Fluent's
   * `onCheckedValueChange(event, { name, checkedItems })`; always passed, typed optional until 1.0).
   */
  onCheckedValuesChange?: CheckedValuesChangeHandler;
}

/**
 * Props of {@link Toolbar} rendered as `C` (default `'div'`). `ToolbarProps` without a type
 * argument is the 0.4 name: the props of a Toolbar rendered as a `<div>`, including `ref`.
 */
export type ToolbarProps<C extends React.ElementType = 'div'> = PolymorphicProps<
  C,
  ToolbarOwnProps
>;

/** The props the implementation reads, for any `as`. */
type ToolbarImplProps = ToolbarOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * Every focusable control a toolbar can contain, whatever component renders it. Matches that
 * cannot take focus (a `type="hidden"` input, a control CSS hides) are dropped by the roving hook.
 */
const TOOLBAR_ITEM_SELECTOR =
  'button, [href], input, select, textarea, [role="button"], [tabindex]';

/** The toolbar's padding per size. */
const toolbarPaddingClasses: Record<Size, string> = {
  'extra-small': 'p-0.5',
  small: 'p-0.5',
  medium: 'p-1',
  large: 'p-1.5',
  'extra-large': 'p-2',
};

// The root of the Toolbar compound; its component JSDoc is on the `Toolbar` export below (C-DOCS).
const ToolbarRoot: PolymorphicComponent<'div', ToolbarOwnProps> = (props) => {
  const {
    as,
    orientation = 'horizontal',
    size = 'medium',
    checkedValues,
    defaultCheckedValues,
    onCheckedValuesChange,
    className,
    ref,
    onKeyDown,
    onFocus,
    role,
    'aria-orientation': ariaOrientation,
    ...rest
  } = props as ToolbarImplProps;

  const { containerProps } = useRovingTabIndex({
    itemSelector: TOOLBAR_ITEM_SELECTOR,
    manageTabIndex: true,
    tabStop: 'last-focused',
    orientation,
  });
  const mergedRef = useMergedRefs<HTMLElement>(containerProps.ref, ref);

  const checked = useCheckedValues(checkedValues, defaultCheckedValues, onCheckedValuesChange);
  const registerCheckable = useToolbarCheckableRegistry();
  const context = React.useMemo<ToolbarContextValue>(
    () => ({ orientation, size, checked, registerCheckable }),
    [orientation, size, checked, registerCheckable],
  );

  const Component: React.ElementType = as ?? 'div';
  // The role and `aria-orientation` defaults apply wherever the consumer's value is `undefined` or
  // `null` (as in Button), so a wrapper forwarding its own unset props keeps them.
  return (
    <ToolbarContext.Provider value={context}>
      <Component
        data-size={size}
        data-orientation={orientation}
        {...rest}
        role={role ?? 'toolbar'}
        aria-orientation={ariaOrientation ?? orientation}
        ref={mergedRef}
        data-roving-container=""
        onKeyDown={composeEventHandlers(onKeyDown, containerProps.onKeyDown)}
        onFocus={composeEventHandlers(onFocus, containerProps.onFocus, {
          checkDefaultPrevented: false,
        })}
        className={cn(
          'inline-flex items-center gap-1 rounded border border-border',
          toolbarPaddingClasses[size],
          orientation === 'vertical' && 'flex-col items-stretch',
          className,
        )}
      />
    </ToolbarContext.Provider>
  );
};
ToolbarRoot.displayName = 'Toolbar';

/**
 * A container for a set of controls (APG Toolbar pattern): `role="toolbar"`, one Tab stop, and
 * arrow-key navigation between its controls.
 *
 * - Works with any children (Buttons, ToggleButtons, links, inputs, value controls such as
 *   Checkbox or Dropdown): the focusable controls are found in the DOM, and the Toolbar sets their
 *   `tabIndex` itself (one `0`, the rest `-1`). The `type="hidden"` input that a named value
 *   control renders never counts as a control, and controls that CSS hides are skipped.
 * - Parts: `Toolbar.Button`, `Toolbar.ToggleButton` and `Toolbar.RadioButton` take the toolbar's
 *   `size` (default `'medium'`) and the `subtle` appearance by default; `Toolbar.RadioGroup`,
 *   `Toolbar.Group` and `Toolbar.Divider` lay them out. Plain Buttons keep their own defaults.
 * - State: the pressed `Toolbar.ToggleButton`s and the checked `Toolbar.RadioButton` of each
 *   group live in `checkedValues`/`defaultCheckedValues`, per group `name`, and every change calls
 *   `onCheckedValuesChange(checkedValues, details)`. The state is in the server HTML.
 * - Left/Right (Up/Down when `orientation="vertical"`) move focus and wrap; Home/End jump to the
 *   first/last control; Left/Right are mirrored in RTL. Natively disabled controls are skipped,
 *   also when a child disables them on its own; `disabledFocusable` ones stay in the arrow-key
 *   order (APG), so a Tooltip can explain why they are unavailable. The arrows never press a
 *   toggle or check a radio: Space, Enter or a click does.
 * - The radios of a `Toolbar.RadioGroup` are part of that arrow-key order, and Up/Down (Left/Right
 *   in a vertical toolbar) also move among them, wrapping inside the group.
 * - Tab returns to the last focused control. Focusing a nested composite (radio group, tab list)
 *   or a text field, select, slider or spin button keeps the Tab stop where it was.
 * - Text fields, selects, sliders, spin buttons and editable comboboxes keep their own arrow keys
 *   (the caret moves). A Dropdown (select-only combobox) does not: Left/Right move past it. It
 *   keeps Up/Down, Home and End for its list, so in a vertical toolbar the arrows cannot leave it.
 * - Elements with their own `tabIndex={-1}` are left alone, and a nested composite widget (a
 *   RadioGroup, a tab list, …; not `Toolbar.RadioGroup`) counts as one control that keeps its own
 *   Tab stop and arrow keys.
 * - A Menu or Popover opened from a control keeps its own keys: arrows, Home and End pressed in
 *   the popup never move focus back to the toolbar's controls.
 * - A consumer `onKeyDown` runs first; `event.preventDefault()` in it cancels the navigation.
 * - Renders `data-size` and `data-orientation`.
 *
 * React Server Components cannot dot into a client module: import the flat names
 * `ToolbarButton`, `ToolbarToggleButton`, `ToolbarRadioGroup`, `ToolbarRadioButton`,
 * `ToolbarGroup` and `ToolbarDivider` there; `Toolbar.Button` etc. work in client files.
 *
 * @example
 * <Toolbar aria-label="Formatting" defaultCheckedValues={{ format: ['bold'], align: ['left'] }}>
 *   <Toolbar.ToggleButton name="format" value="bold" icon={<BoldIcon />} aria-label="Bold" />
 *   <Toolbar.ToggleButton name="format" value="code" icon={<CodeIcon />} aria-label="Code" />
 *   <Toolbar.Divider />
 *   <Toolbar.RadioGroup aria-label="Text alignment">
 *     <Toolbar.RadioButton name="align" value="left" icon={<AlignLeftIcon />} aria-label="Left" />
 *     <Toolbar.RadioButton name="align" value="center" icon={<AlignCenterIcon />} aria-label="Center" />
 *   </Toolbar.RadioGroup>
 * </Toolbar>
 */
export const Toolbar = /* @__PURE__ */ Object.assign(ToolbarRoot, {
  Button: ToolbarButton,
  ToggleButton: ToolbarToggleButton,
  RadioGroup: ToolbarRadioGroup,
  RadioButton: ToolbarRadioButton,
  Group: ToolbarGroup,
  Divider: ToolbarDivider,
});
