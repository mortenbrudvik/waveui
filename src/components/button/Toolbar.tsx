import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Orientation } from '../../lib/types';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

/**
 * The Toolbar's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props
 * only). Every other prop comes from the rendered element (`as`, default `'div'`). Give the
 * toolbar an `aria-label` (or `aria-labelledby`) that describes its purpose, e.g. "Formatting".
 */
export interface ToolbarOwnProps {
  /**
   * Layout and arrow-key axis: Left/Right move between items when horizontal (mirrored in RTL),
   * Up/Down when vertical. Exposed as `aria-orientation`.
   * @default 'horizontal'
   */
  orientation?: Orientation;
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

/** Every focusable control a toolbar can contain, whatever component renders it. */
const TOOLBAR_ITEM_SELECTOR =
  'button, [href], input, select, textarea, [role="button"], [tabindex]';

/**
 * A container for a set of controls (APG Toolbar pattern): `role="toolbar"`, one Tab stop, and
 * arrow-key navigation between its controls.
 *
 * - Works with any children (Buttons, ToggleButtons, links, inputs): the focusable controls are
 *   found in the DOM, and the Toolbar sets their `tabIndex` itself (one `0`, the rest `-1`).
 * - Left/Right (Up/Down when `orientation="vertical"`) move focus and wrap; Home/End jump to the
 *   first/last control; Left/Right are mirrored in RTL. Disabled controls are skipped, also when
 *   a child disables them on its own.
 * - Tab returns to the control that was focused last.
 * - Text fields, selects, sliders and spin buttons keep their own arrow keys (the caret moves).
 * - Elements with their own `tabIndex={-1}` are left alone, and a nested composite widget
 *   (radio group, tab list, …) counts as one control that keeps its own Tab stop.
 * - A consumer `onKeyDown` runs first; `event.preventDefault()` in it cancels the navigation.
 *
 * @example
 * <Toolbar aria-label="Formatting">
 *   <ToggleButton icon={<BoldIcon />} aria-label="Bold" />
 *   <ToggleButton icon={<ItalicIcon />} aria-label="Italic" />
 * </Toolbar>
 */
export const Toolbar: PolymorphicComponent<'div', ToolbarOwnProps> = (props) => {
  const {
    as,
    orientation = 'horizontal',
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

  const Component: React.ElementType = as ?? 'div';
  // The role and `aria-orientation` defaults apply wherever the consumer's value is `undefined` or
  // `null` (as in Button), so a wrapper forwarding its own unset props keeps them.
  return (
    <Component
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
        'inline-flex items-center gap-1 rounded border border-border p-1',
        orientation === 'vertical' && 'flex-col items-stretch',
        className,
      )}
    />
  );
};

Toolbar.displayName = 'Toolbar';
