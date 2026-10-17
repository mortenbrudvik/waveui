import * as React from 'react';
import { swatchPickerClassNames, swatchPickerRowClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { joinIds } from '../../lib/aria';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import type { Shape } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingGrid } from '../../hooks/useRovingGrid';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { HiddenInput } from '../internal/HiddenInput';
import {
  SwatchPickerContext,
  useSwatchPickerContext,
  useSwatchRegistry,
  type SwatchPickerContextValue,
  type SwatchPickerSize,
} from './SwatchPicker.context';
import { ColorSwatch } from './SwatchPicker.swatches';

export type { SwatchPickerSize } from './SwatchPicker.context';

/** Represents a single color swatch option. */
export interface SwatchItem {
  /** Unique identifier for the swatch (the value `onValueChange` reports and a form submits). */
  value: string;
  /** CSS color value (e.g., hex, rgb) used as the swatch background. */
  color: string;
  /**
   * Accessible name of the swatch, e.g. `'Cranberry'`. **Required for accessibility**: without it
   * the swatch is announced by its raw color value (`'#d13438'`) and a development warning is
   * logged.
   */
  label?: string;
}

/** Built-in strings of the SwatchPicker component (C-NAMING). */
export interface SwatchPickerLabels {
  /**
   * Said where the picker's role cannot carry `aria-required` (the grid layout): a hidden text
   * joined into the picker's description while it is required.
   * @default 'Required'
   */
  required?: string;
}

/** Properties for the SwatchPicker component. */
export interface SwatchPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /**
   * The swatches to display, in order (a readonly array is accepted; it is never modified):
   * rendered as `ColorSwatch` elements, before `children`.
   */
  items?: readonly SwatchItem[];
  /** Controlled selected swatch value (`''` = nothing selected). */
  value?: string;
  /** Initial selected value for uncontrolled usage (also what a form reset restores).
   * @default ''
   */
  defaultValue?: string;
  /** Called with the new value when the selection changes (not when the selected swatch is chosen again). */
  onValueChange?: (value: string) => void;
  /**
   * Called with the new value when the selection changes.
   * @deprecated Use `onValueChange`.
   */
  onChange?: (value: string) => void;
  // D18: an explicit C-ROUTING exception — a swatch's own ref/className/style/rest land on its
  // button, so a wrapping element's props reach the element that has focus.
  /**
   * Swatches rendered directly, in order, after `items` (e.g. `ColorSwatch`): read the picker's
   * context, so they may be wrapped in a `Tooltip` or another element that forwards its own props.
   * `SwatchPicker.Row` elements start rows; in the grid layout every run of other children (and
   * `items`, with the children that follow them) renders in a row of its own. A `SwatchPicker.Row`
   * must be a direct child or inside a Fragment: a wrapper component around a Row lands in an
   * implicit row, and nested rows are reported in development.
   */
  children?: React.ReactNode;
  /**
   * `'row'`: a radio group whose arrow keys select (and wrap). `'grid'`: rows of cells
   * (`SwatchPicker.Row`) whose arrow keys move focus in two dimensions without selecting; Space,
   * Enter and a click select. Changing it while mounted remounts the swatches, so focus falls
   * back to the page.
   * @default 'row'
   */
  layout?: 'row' | 'grid';
  /**
   * `'arrow'`: one tab stop and arrow keys, with the radio group (row layout) or grid (grid
   * layout) semantics. `'tab'`: every enabled swatch is its own tab stop and the arrow keys do
   * nothing, so the picker is a `role="group"` of toggle buttons (`aria-pressed`, the selected
   * one pressed) in both layouts; rows have no role, and Space, Enter and a click select
   * (pressing the selected swatch again keeps it selected). The required hint (`labels.required`)
   * applies, as the group cannot carry `aria-required`.
   * @default 'arrow'
   */
  focusMode?: 'arrow' | 'tab';
  /** Built-in strings, for localization. */
  labels?: SwatchPickerLabels;
  /** Size of each swatch button (20, 24, 32 or 40px). A 20px swatch passes the target-size bar
   * through its spacing; a swatch's own `size` overrides this.
   * @default 'medium'
   */
  size?: SwatchPickerSize;
  /** Gap between swatches (and between rows): 4px or 8px. At `'small'` the focus outline's offset shrinks from 4px to
   * 2px, so it does not cover the neighbour.
   * @default 'medium'
   */
  spacing?: 'small' | 'medium';
  /** Shape of each swatch button (a swatch's own `shape` overrides this).
   * @default 'circular'
   */
  shape?: Shape;
  /**
   * Form field name. With a name, the selected swatch's `value` is submitted with the form
   * (nothing while no swatch is selected).
   */
  name?: string;
  /**
   * A swatch must be selected before the form can be submitted (native validation). The row
   * layout says so with `aria-required`; the grid layout and tab mode, whose roles do not allow
   * it, with the hidden `labels.required` text in the description (which a consumer
   * `aria-required` alone also shows).
   */
  required?: boolean;
  /** Id of the form the picker belongs to, when it is rendered outside that form. */
  form?: string;
  /** Ref to the root element (`role="radiogroup"`, or `role="grid"` in the grid layout). */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the SwatchPicker.Row component. */
export interface SwatchPickerRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the row element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The gap class the root and the rows share. */
function swatchGap(spacing: 'small' | 'medium'): string {
  return spacing === 'small' ? 'gap-1' : 'gap-2';
}

/** Tab mode: every swatch is a tab stop. */
const tabStop = (): 0 => 0;

/** True inside a `SwatchPicker.Row`: a second Row there is reported. */
const SwatchRowContext = React.createContext(false);

/**
 * One row of swatches in a `SwatchPicker` (also exported as the flat `SwatchPickerRow`, for React
 * Server Components). In the grid layout it is a `role="row"` element whose swatches are its
 * cells; Up and Down move between rows, and the row does not wrap (a wrapped swatch would sit
 * where Up and Down do not reach it): size it yourself. In the row layout and in tab mode
 * (`focusMode="tab"`) it is a full-width line without a role, and its swatches stay radios of the
 * one group (row layout) or toggle buttons. Place it as a direct child of the `SwatchPicker` or
 * inside a Fragment: a wrapper component around a Row lands in an implicit row, and a Row inside
 * a Row is reported in development. Outside a `SwatchPicker` it throws in development.
 *
 * @example
 * <SwatchPicker layout="grid" aria-label="Accent color">
 *   <SwatchPicker.Row>
 *     <ColorSwatch value="red" color="#d13438" aria-label="Red" />
 *     <ColorSwatch value="blue" color="#0f6cbd" aria-label="Blue" />
 *   </SwatchPicker.Row>
 * </SwatchPicker>
 */
export const SwatchPickerRow = ({ className, ref, ...rest }: SwatchPickerRowProps) => {
  const { layout, focusMode, spacing } = useSwatchPickerContext('SwatchPicker.Row');
  const nested = React.useContext(SwatchRowContext);
  React.useEffect(() => {
    if (nested) {
      warnOnce(
        'SwatchPicker.Row:nested',
        'SwatchPicker.Row: a Row inside a Row nests rows. Rows must be direct children of the ' +
          'SwatchPicker (or inside a Fragment); a wrapper component around a Row lands in an ' +
          'implicit row.',
      );
    }
  }, [nested]);
  const isGridRow = layout === 'grid' && focusMode === 'arrow';
  return (
    <SwatchRowContext.Provider value>
      <div
        role={isGridRow ? 'row' : undefined}
        {...rest}
        ref={ref}
        className={cn(
          swatchPickerRowClassNames.root,
          // The grid's rows never wrap: Up and Down would not reach a wrapped swatch. Tab mode
          // has no arrow keys, so its rows wrap like the row layout's.
          isGridRow ? 'flex' : 'flex basis-full flex-wrap',
          swatchGap(spacing),
          className,
        )}
      />
    </SwatchRowContext.Provider>
  );
};
SwatchPickerRow.displayName = 'SwatchPickerRow';

/**
 * The grid layout's rows: `SwatchPicker.Row` elements as they are, and `items` with every run of
 * other children (Fragments flattened) wrapped in an implicit row, so no cell sits outside a row.
 */
function gridRows(
  itemSwatches: readonly React.ReactNode[] | undefined,
  children: React.ReactNode,
): React.ReactNode[] {
  const rows: React.ReactNode[] = [];
  // Keys: an implicit row is keyed by its first node, so adding a row elsewhere keeps its
  // swatches mounted (and focused). Flattened keys start with a dot: no clash with `items`.
  let pending: React.ReactNode[] = [];
  let pendingKey = 'items';
  if (itemSwatches && itemSwatches.length > 0) {
    pending.push(<React.Fragment key="items">{itemSwatches}</React.Fragment>);
  }
  const flush = () => {
    if (pending.length > 0) {
      rows.push(<SwatchPickerRow key={`implicit:${pendingKey}`}>{pending}</SwatchPickerRow>);
    }
    pending = [];
  };
  for (const { key, node } of flattenChildren(children)) {
    if (isElementOfType(node, SwatchPickerRow)) {
      flush();
      rows.push(<React.Fragment key={key}>{node}</React.Fragment>);
    } else {
      if (pending.length === 0) pendingKey = key;
      pending.push(<React.Fragment key={key}>{node}</React.Fragment>);
    }
  }
  flush();
  return rows;
}

// The root, documented on the exported `SwatchPicker` const.
const SwatchPickerRoot = ({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  children,
  layout = 'row',
  focusMode = 'arrow',
  labels,
  size = 'medium',
  shape = 'circular',
  spacing = 'medium',
  name,
  required,
  form,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  onKeyDown,
  onFocus,
  ref,
  ...rest
}: SwatchPickerProps) => {
  if (onChange !== undefined) warnDeprecated('SwatchPicker', 'onChange', 'onValueChange');
  const initialValue = defaultValue ?? '';
  const [value, setValue] = useControllable(valueProp, initialValue, (next: string) => {
    onValueChange?.(next);
    onChange?.(next);
  });
  const isTab = focusMode === 'tab';
  // The grid layout's rows are visual in tab mode: the grid keys and roles belong to arrow mode.
  const isGrid = layout === 'grid';
  const isArrowGrid = isGrid && !isTab;

  // Both hooks run on every render (hook order); only the layout's own one gets the container,
  // and tab mode none (every swatch is a tab stop, the arrow keys do nothing).
  const radio = useRovingTabIndex({
    activeValue: value || null,
    orientation: 'both',
    // APG radio group: moving focus also selects.
    onFocusMove: (next) => setValue(next),
  });
  // APG grid: the arrow keys move focus only; a swatch's own click (Space, Enter) selects.
  const grid = useRovingGrid({ activeValue: value || null });
  const { containerProps, getTabIndex: rovingTabIndex } = isArrowGrid ? grid : radio;
  const getTabIndex = isTab ? tabStop : rovingTabIndex;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, isTab ? null : containerProps.ref, rootRef);

  const field = useFieldContext();
  const {
    'aria-required': fieldAriaRequired,
    'aria-describedby': fieldDescribedBy,
    ...fieldProps
  } = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      // An explicit `required={false}` wins over a required Field, so aria-required matches
      // `isRequired`.
      'aria-required': ariaRequired ?? required,
    },
    { labelable: false },
  );
  const isRequired = required ?? field?.required ?? false;
  const role = isTab ? 'group' : isGrid ? 'grid' : 'radiogroup';
  // Only `radiogroup` allows aria-required (a consumer's included): the description of a `grid`
  // or `group` says it instead.
  const requiredHintId = useId('wave-swatch-picker-required');
  const showRequiredHint =
    role !== 'radiogroup' &&
    fieldAriaRequired !== undefined &&
    String(fieldAriaRequired) !== 'false';

  const unnamed =
    fieldProps['aria-label'] === undefined && fieldProps['aria-labelledby'] === undefined;
  const unlabelledItem = items?.find((item) => !item.label)?.value;
  React.useEffect(() => {
    if (unnamed) {
      warnOnce(
        'SwatchPicker:unnamed',
        `SwatchPicker: the ${role} has no accessible name. Pass \`aria-label\` or \`aria-labelledby\`, or render it inside a Field.`,
      );
    }
  }, [unnamed, role]);
  React.useEffect(() => {
    if (unlabelledItem !== undefined) {
      warnOnce(
        'SwatchPicker:item-label',
        `SwatchPicker: swatch "${unlabelledItem}" has no \`label\`, so it is announced by its color value. Give every item a \`label\`.`,
      );
    }
  }, [unlabelledItem]);

  useFormReset(rootRef, () => setValue(initialValue), form);

  const focusTabStop = () => {
    rootRef.current?.querySelector<HTMLElement>('[data-roving-value][tabindex="0"]')?.focus();
  };

  const register = useSwatchRegistry();
  const contextValue = React.useMemo<SwatchPickerContextValue>(
    () => ({
      value,
      select: setValue,
      size,
      shape,
      layout,
      focusMode,
      spacing,
      getTabIndex,
      register,
    }),
    [value, setValue, size, shape, layout, focusMode, spacing, getTabIndex, register],
  );

  const itemSwatches = items?.map((item) => (
    <ColorSwatch
      key={item.value}
      value={item.value}
      color={item.color}
      aria-label={item.label || item.color}
    />
  ));

  return (
    <div
      role={role}
      {...fieldProps}
      aria-required={role === 'radiogroup' ? fieldAriaRequired : undefined}
      aria-describedby={joinIds(fieldDescribedBy, showRequiredHint && requiredHintId)}
      data-layout={layout}
      data-focus-mode={focusMode}
      data-size={size}
      data-shape={shape}
      data-spacing={spacing}
      className={cn(
        swatchPickerClassNames.root,
        isGrid ? 'relative flex flex-col' : 'relative flex flex-wrap',
        swatchGap(spacing),
        className,
      )}
      {...rest}
      ref={mergedRef}
      data-roving-container={isTab ? undefined : ''}
      onKeyDown={composeEventHandlers(onKeyDown, (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Tab mode has no arrow handling. An EmptySwatch is no radio: arrow keys pressed on it
        // would otherwise move to and select one. In the grid layout it is a cell like the others.
        if (isTab) return;
        if (!isGrid && (event.target as HTMLElement).hasAttribute?.('data-wave-empty-swatch')) {
          return;
        }
        containerProps.onKeyDown(event);
      })}
      onFocus={composeEventHandlers(onFocus, isTab ? undefined : containerProps.onFocus, {
        checkDefaultPrevented: false,
      })}
    >
      <SwatchPickerContext.Provider value={contextValue}>
        {isGrid ? (
          gridRows(itemSwatches, children)
        ) : (
          <>
            {itemSwatches}
            {children}
          </>
        )}
      </SwatchPickerContext.Provider>
      {showRequiredHint && (
        <span id={requiredHintId} hidden>
          {labels?.required ?? 'Required'}
        </span>
      )}
      <HiddenInput
        type="radio"
        name={name}
        form={form}
        value={value}
        required={isRequired}
        onInvalid={focusTabStop}
      />
    </div>
  );
};
SwatchPickerRoot.displayName = 'SwatchPicker';

/**
 * A single-select set of color swatches: a radio group (the default row layout) or a grid of rows
 * (`layout="grid"`).
 *
 * - **Row layout** (APG radio group, `role="radiogroup"` of `role="radio"` buttons): one tab stop,
 *   the selected swatch, else the first. All four arrow keys move focus and select (Left/Right
 *   mirrored under `dir="rtl"`), wrapping at the ends; Home/End jump to the first/last swatch.
 * - **Grid layout** (APG grid, `role="grid"` of `SwatchPicker.Row` rows whose cells hold the
 *   swatch buttons, the selected one `aria-selected` and pressed): the arrow keys move focus only.
 *   Left/Right go through the cells in reading order across rows (mirrored under `dir="rtl"`) and
 *   stop at the grid's first and last cell; Up/Down go to the nearest enabled cell of the
 *   previous/next row; Home/End to the first/last cell of the row, Ctrl+Home/End of the grid.
 *   Space, Enter and a click select. One tab stop: the last focused cell, starting at the
 *   selected swatch, else the first. `items`, and every run of children that are not rows, render
 *   in a row of their own; rows do not wrap.
 * - **Selected indicator**: an offset ring in the foreground color (drawn on the page background,
 *   not on the swatch) plus a check glyph whose color is picked by the swatch's luminance, so the
 *   selection never relies on color alone.
 * - **Naming**: give the picker a name with `aria-label`/`aria-labelledby` or render it inside a
 *   `Field`, and give every item a `label`; both are reported in development when missing.
 * - **Forms**: with `name` (or `required`) it takes part in native forms; a form reset restores
 *   `defaultValue`. A required grid says so in its description (`labels.required`), since its
 *   role does not allow `aria-required`.
 * - **Composition**: `items` render as `ColorSwatch` elements before `children`. A `ColorSwatch`,
 *   `ImageSwatch` or `EmptySwatch` rendered directly as a child lets you wrap it, for example in
 *   a `Tooltip` with `relationship="label"` to name and describe it. A swatch rendered outside any
 *   `SwatchPicker` throws in development. React Server Components use the flat `SwatchPickerRow`
 *   name for `SwatchPicker.Row`.
 *
 * @example
 * <SwatchPicker aria-label="Accent color" items={[{ value: 'red', color: '#d13438', label: 'Red' }]} />
 *
 * @example
 * <SwatchPicker layout="grid" aria-label="Accent color">
 *   <SwatchPicker.Row>
 *     <ColorSwatch value="red" color="#d13438" aria-label="Red" />
 *     <ColorSwatch value="blue" color="#0f6cbd" aria-label="Blue" />
 *   </SwatchPicker.Row>
 *   <SwatchPicker.Row>
 *     <ColorSwatch value="green" color="#107c10" aria-label="Green" />
 *     <EmptySwatch onClick={openColorDialog} />
 *   </SwatchPicker.Row>
 * </SwatchPicker>
 */
export const SwatchPicker = /* @__PURE__ */ Object.assign(SwatchPickerRoot, {
  Row: SwatchPickerRow,
});
