import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import { resolveSlot, slotRendersContent } from '../../lib/slot';
import type { SlotObject } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import type { Size, Slot } from '../../lib/types';
import { Button } from './Button';
import type { ButtonOwnProps } from './Button';
import { ToggleButton } from './ToggleButton';
import type { ToggleButtonProps } from './ToggleButton';
import { useToolbarContext } from './Toolbar.context';

/*
 * The parts of a Toolbar: `Toolbar.Button`, `Toolbar.ToggleButton`, `Toolbar.RadioGroup`,
 * `Toolbar.RadioButton`, `Toolbar.Group` and `Toolbar.Divider` (attached in `Toolbar.tsx`, which
 * also exports their flat names).
 */

// ---------------------------------------------------------------------------
// Toolbar.Button
// ---------------------------------------------------------------------------

/** Toolbar.Button's own props: Button's, plus `vertical`. Default appearance `'subtle'`. */
export interface ToolbarButtonOwnProps extends ButtonOwnProps {
  /** The icon above the label (a 24 px icon box and a caption-size label). @default false */
  vertical?: boolean;
}

/** Props of {@link ToolbarButton} rendered as `C` (default `'button'`), including `ref`. */
export type ToolbarButtonProps<C extends React.ElementType = 'button'> = PolymorphicProps<
  C,
  ToolbarButtonOwnProps
>;

/** The props the implementation reads, for any `as`. */
type ToolbarButtonImplProps = ToolbarButtonOwnProps & { className?: string };

/** `Button` widened to any element props, so `as` and the rest props pass through untyped. */
const BaseButton = Button as React.ElementType;

/** The layout of a vertical button: the icon above a caption-size label, no minimum width. */
const verticalButtonClasses = 'h-auto min-w-0 flex-col gap-0.5 px-2 py-1 text-caption-1';

/** The icon box of a vertical button per size: 24 px, 20 px at the two small sizes. */
const verticalIconBoxClasses: Record<Size, string> = {
  'extra-small': 'size-5 justify-center [&>svg]:size-full',
  small: 'size-5 justify-center [&>svg]:size-full',
  medium: 'size-6 justify-center [&>svg]:size-full',
  large: 'size-6 justify-center [&>svg]:size-full',
  'extra-large': 'size-6 justify-center [&>svg]:size-full',
};

/**
 * `icon` as a slot object whose element also carries `box`: shorthand content becomes the
 * children of a span with `box`, a slot object keeps its element and attributes and gets `box`
 * before its own classes. An icon that renders nothing stays as it is (no icon).
 */
function withIconBox(icon: Slot<'span'> | undefined, box: string): Slot<'span'> | undefined {
  if (!slotRendersContent(icon)) return icon;
  const resolved = resolveSlot(icon, 'span', box);
  if (!resolved) return icon;
  return {
    ...resolved.props,
    as: resolved.Component,
    children: resolved.children,
  } as SlotObject<'span'>;
}

/**
 * A Button with the toolbar's size and the `subtle` appearance by default (your `size` and
 * `appearance` win). `vertical` puts the icon above a caption-size label, for ribbon-style
 * toolbars. Polymorphic like Button (`as="a"`, a router link). Must be rendered inside a
 * {@link Toolbar}; flat export for React Server Components (`Toolbar.Button` in client files).
 *
 * @example
 * <Toolbar.Button icon={<ShareIcon />}>Share</Toolbar.Button>
 * <Toolbar.Button vertical icon={<PasteIcon />}>Paste</Toolbar.Button>
 */
export const ToolbarButton: PolymorphicComponent<'button', ToolbarButtonOwnProps> = (props) => {
  const {
    vertical = false,
    appearance = 'subtle',
    size,
    icon,
    className,
    ...rest
  } = props as ToolbarButtonImplProps;
  const toolbar = useToolbarContext('Toolbar.Button');
  const effectiveSize = size ?? toolbar.size;
  return (
    <BaseButton
      {...rest}
      appearance={appearance}
      size={effectiveSize}
      icon={vertical ? withIconBox(icon, verticalIconBoxClasses[effectiveSize]) : icon}
      data-vertical={vertical ? '' : undefined}
      className={cn(vertical && verticalButtonClasses, className)}
    />
  );
};
ToolbarButton.displayName = 'ToolbarButton';

// ---------------------------------------------------------------------------
// Toolbar.ToggleButton and Toolbar.RadioButton
// ---------------------------------------------------------------------------

/** Properties for Toolbar.ToggleButton: ToggleButton's, bound to the Toolbar's `checkedValues`. */
export interface ToolbarToggleButtonProps extends Omit<
  ToggleButtonProps,
  'pressed' | 'defaultPressed' | 'onPressedChange' | 'name' | 'value'
> {
  /** The group: a key of the Toolbar's `checkedValues`. */
  name: string;
  /** The value in `checkedValues[name]` while the toggle is pressed. */
  value: string;
}

/** Properties for Toolbar.RadioButton: one choice of a `Toolbar.RadioGroup`. */
export interface ToolbarRadioButtonProps extends Omit<
  ToggleButtonProps,
  'pressed' | 'defaultPressed' | 'onPressedChange' | 'name' | 'value' | 'role'
> {
  /** The group: a key of the Toolbar's `checkedValues`; radio buttons of one `name` are exclusive. */
  name: string;
  /** The group's value while this radio is checked. */
  value: string;
}

/** Registers a part's `name`/`value` with its toolbar (the duplicate-pair warning). */
function useRegisterCheckable(
  register: (name: string, value: string) => () => void,
  name: string,
  value: string,
): void {
  React.useEffect(() => register(name, value), [register, name, value]);
}

/**
 * A ToggleButton with the toolbar's size and the `subtle` appearance by default, pressed while
 * `value` is in the Toolbar's `checkedValues[name]`. A click adds or removes it (your `onClick`
 * runs first; `event.preventDefault()` cancels the change) and calls the Toolbar's
 * `onCheckedValuesChange`. `name` and `value` are binding keys, not rendered as attributes.
 * `isAccessible` and `disabledFocusable` work as on ToggleButton. Must be rendered inside a
 * {@link Toolbar}; flat export for React Server Components (`Toolbar.ToggleButton` in client
 * files).
 *
 * @example
 * <Toolbar aria-label="Formatting" defaultCheckedValues={{ format: ['bold'] }}>
 *   <Toolbar.ToggleButton name="format" value="bold" icon={<BoldIcon />} aria-label="Bold" />
 * </Toolbar>
 */
export const ToolbarToggleButton = ({
  name,
  value,
  appearance = 'subtle',
  size,
  onClick,
  ...rest
}: ToolbarToggleButtonProps) => {
  const toolbar = useToolbarContext('Toolbar.ToggleButton');
  const { checked } = toolbar;
  useRegisterCheckable(toolbar.registerCheckable, name, value);
  return (
    <ToggleButton
      {...rest}
      appearance={appearance}
      size={size ?? toolbar.size}
      pressed={checked.isChecked(name, value)}
      onClick={composeEventHandlers(onClick, (event) =>
        checked.toggle(name, value, event.nativeEvent),
      )}
    />
  );
};
ToolbarToggleButton.displayName = 'ToolbarToggleButton';

/**
 * A ToggleButton with `role="radio"` (it reports its state with `aria-checked` and
 * `data-checked`, besides `data-pressed`), the toolbar's size and the `subtle` appearance by
 * default: one choice of a `Toolbar.RadioGroup`, checked while `value` is the Toolbar's
 * `checkedValues[name]`. Space, Enter or a click checks it (your `onClick` runs first;
 * `event.preventDefault()` cancels); the arrow keys only move focus. A click on the checked radio
 * changes nothing. Must be rendered inside a {@link Toolbar}; flat export for React Server
 * Components (`Toolbar.RadioButton` in client files).
 *
 * @example
 * <Toolbar.RadioGroup aria-label="Text alignment">
 *   <Toolbar.RadioButton name="align" value="left" icon={<AlignLeftIcon />} aria-label="Left" />
 *   <Toolbar.RadioButton name="align" value="center" icon={<AlignCenterIcon />} aria-label="Center" />
 * </Toolbar.RadioGroup>
 */
export const ToolbarRadioButton = ({
  name,
  value,
  appearance = 'subtle',
  size,
  onClick,
  ...rest
}: ToolbarRadioButtonProps) => {
  const toolbar = useToolbarContext('Toolbar.RadioButton');
  const { checked } = toolbar;
  useRegisterCheckable(toolbar.registerCheckable, name, value);
  return (
    <ToggleButton
      {...rest}
      role="radio"
      appearance={appearance}
      size={size ?? toolbar.size}
      pressed={checked.isChecked(name, value)}
      onClick={composeEventHandlers(onClick, (event) =>
        checked.select(name, value, event.nativeEvent),
      )}
    />
  );
};
ToolbarRadioButton.displayName = 'ToolbarRadioButton';

// ---------------------------------------------------------------------------
// Toolbar.RadioGroup
// ---------------------------------------------------------------------------

/** Properties for Toolbar.RadioGroup. */
export interface ToolbarRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the group element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A set of `Toolbar.RadioButton`s of which one is checked (`role="radiogroup"`; name it with
 * `aria-label`). Its radios are part of the toolbar's arrow-key order; Up and Down (Left and Right
 * in a vertical toolbar) also move among the group's radios, wrapping inside the group. Arrows
 * only move focus; Space, Enter or a click checks.
 *
 * - The cross-axis keys skip natively disabled radios; a `disabledFocusable` one stays reachable,
 *   as in the toolbar's own arrow order. A consumer `onKeyDown` runs first
 *   (`event.preventDefault()` cancels the move).
 * - Without `aria-label` or `aria-labelledby` it warns once in development.
 * - Its `role` is always `radiogroup` (a `role` you pass is ignored): its radios need it.
 * - Must be rendered inside a {@link Toolbar}; flat export for React Server Components
 *   (`Toolbar.RadioGroup` in client files).
 *
 * @example
 * <Toolbar.RadioGroup aria-label="Text alignment">
 *   <Toolbar.RadioButton name="align" value="left">Left</Toolbar.RadioButton>
 *   <Toolbar.RadioButton name="align" value="right">Right</Toolbar.RadioButton>
 * </Toolbar.RadioGroup>
 */
export const ToolbarRadioGroup = ({
  className,
  onKeyDown,
  ref,
  ...rest
}: ToolbarRadioGroupProps) => {
  const { orientation } = useToolbarContext('Toolbar.RadioGroup');
  const ariaLabel = rest['aria-label'];
  const ariaLabelledBy = rest['aria-labelledby'];
  React.useEffect(() => {
    if (ariaLabel || ariaLabelledBy) return;
    warnOnce(
      'Toolbar.RadioGroup:name',
      'Toolbar.RadioGroup: a radio group needs an accessible name that says what it chooses (e.g. "Text alignment"). Pass `aria-label` or `aria-labelledby`.',
    );
  }, [ariaLabel, ariaLabelledBy]);

  // The cross axis (APG Toolbar): Down/Up in a horizontal toolbar, "next"/"previous" of Left/Right
  // in a vertical one, move among the group's radios with wrap and check nothing. The toolbar's
  // roving hook records the newly focused radio as its tab stop through its focus handler.
  const handleCrossAxisKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const group = event.currentTarget;
    const intent =
      orientation === 'vertical'
        ? getArrowIntent(event.key, { orientation: 'horizontal', dir: getDirection(group) })
        : getArrowIntent(event.key, { orientation: 'vertical', dir: 'ltr' });
    if (!intent) return;
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    const current = radios.findIndex((radio) => radio.contains(event.target as Node));
    if (current === -1) return;
    event.preventDefault();
    const step = intent === 'next' ? 1 : -1;
    const count = radios.length;
    for (let offset = 1; offset < count; offset++) {
      const candidate = radios[(((current + step * offset) % count) + count) % count];
      if (candidate.matches(':disabled')) continue;
      candidate.focus();
      // A radio that CSS hides does not take focus: try the next one.
      if (candidate.ownerDocument.activeElement === candidate) return;
    }
  };

  return (
    <div
      {...rest}
      ref={ref}
      // Its radios and the cross-axis keys need the radiogroup: the role is not replaceable.
      role="radiogroup"
      data-roving-transparent=""
      onKeyDown={composeEventHandlers(onKeyDown, handleCrossAxisKeyDown)}
      className={cn('flex gap-1', orientation === 'vertical' && 'flex-col', className)}
    />
  );
};
ToolbarRadioGroup.displayName = 'ToolbarRadioGroup';

// ---------------------------------------------------------------------------
// Toolbar.Group and Toolbar.Divider
// ---------------------------------------------------------------------------

/** Properties for Toolbar.Group. */
export interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the group element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Lays out related controls in the toolbar's direction. It is `role="presentation"`, or
 * `role="group"` when you name it with `aria-label` or `aria-labelledby` (a `role` you pass
 * wins). Its controls stay in the toolbar's arrow-key order. Renders `data-orientation`. Must be
 * rendered inside a {@link Toolbar}; flat export for React Server Components (`Toolbar.Group` in
 * client files).
 *
 * @example
 * <Toolbar.Group aria-label="Sharing">
 *   <Toolbar.Button>Share</Toolbar.Button>
 * </Toolbar.Group>
 */
export const ToolbarGroup = ({ role, className, ref, ...rest }: ToolbarGroupProps) => {
  const { orientation } = useToolbarContext('Toolbar.Group');
  const named = Boolean(rest['aria-label'] || rest['aria-labelledby']);
  return (
    <div
      role={role ?? (named ? 'group' : 'presentation')}
      data-orientation={orientation}
      {...rest}
      ref={ref}
      className={cn('flex gap-1', orientation === 'vertical' && 'flex-col', className)}
    />
  );
};
ToolbarGroup.displayName = 'ToolbarGroup';

/** Properties for Toolbar.Divider. */
export interface ToolbarDividerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Ref to the separator element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A separator between groups, drawn across the toolbar (vertical in a horizontal toolbar):
 * `role="separator"` with `aria-orientation`. It is not focusable, so the arrow keys pass it.
 * Must be rendered inside a {@link Toolbar}; flat export for React Server Components
 * (`Toolbar.Divider` in client files).
 */
export const ToolbarDivider = ({ className, ref, ...rest }: ToolbarDividerProps) => {
  const { orientation } = useToolbarContext('Toolbar.Divider');
  const vertical = orientation === 'vertical';
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      {...rest}
      ref={ref}
      className={cn(
        vertical
          ? 'my-1 h-0 shrink-0 self-stretch border-t border-border'
          : 'mx-1 w-0 shrink-0 self-stretch border-s border-border',
        forcedColors.border,
        className,
      )}
    />
  );
};
ToolbarDivider.displayName = 'ToolbarDivider';
