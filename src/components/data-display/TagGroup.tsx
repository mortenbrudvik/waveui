import * as React from 'react';
import { cn } from '../../lib/cn';
import { tagGroupClassNames } from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { hasWarned, isDev, warnOnce } from '../../lib/dev';
import { getFirstTabbable, isHiddenInput } from '../../lib/focus';
import type { Orientation, TagAppearance, TagShape, TagSize } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { TOOLBAR_ITEM_SELECTOR, useToolbarNavigation } from '../button/Toolbar.navigation';
import { HiddenInput } from '../internal/HiddenInput';
import { EMPTY_VALUES, sameValues, toggleValue } from '../input/pickerValues';
import {
  TAG_GROUP_SELECTOR,
  TAG_ITEM_SELECTOR,
  TagGroupContext,
  TagGroupHostContext,
} from './TagGroup.context';
import type { TagGroupContextValue, TagGroupMode } from './TagGroup.context';

/** Props of {@link TagGroup}: the element that holds the tags (a `<div>`). */
export interface TagGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /**
   * `'toolbar'`: one Tab stop and arrow keys, for tags that are actions (dismissible tags,
   * InteractionTags, links). `'list'`: a list (every tag gets `role="listitem"`), each control
   * its own Tab stop and no arrow keys, for tags that only display. Another role keeps the
   * toolbar keyboard; `'listbox'` is not supported (an option cannot hold a Dismiss button).
   * Name the group with `aria-label` or `aria-labelledby`.
   * @default 'toolbar'
   */
  role?: React.AriaRole;
  /**
   * Layout and arrow-key axis, as on Toolbar: Left/Right (mirrored in RTL) when horizontal,
   * Up/Down when vertical; a wrapping set moves in DOM order. `aria-orientation` (toolbar role)
   * and `data-orientation`.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /** Default `size` of its tags (a tag's own wins) and the gap between them. @default 'medium' */
  size?: TagSize;
  /** Default `appearance` of its tags (a tag's own wins). @default 'filled' */
  appearance?: TagAppearance;
  /** Default `shape` of its tags (a tag's own wins). @default 'circular' */
  shape?: TagShape;
  /**
   * Disables every tag: a tag cannot re-enable itself. A control that has focus keeps it,
   * unavailable, until focus leaves it. `aria-disabled` (not with `role="list"`), `data-disabled`.
   * @default false
   */
  disabled?: boolean;
  /**
   * Default `dismissible` of its Tags (a Tag's own value wins). An InteractionTag is dismissible
   * when it has an `InteractionTag.Secondary`.
   * @default false
   */
  dismissible?: boolean;
  /**
   * Called with the tag's `value` on every dismissal: a click, Enter or Space on a Dismiss
   * button, or Delete or Backspace on a tag (Fluent's `onDismiss(event, { value })`). Remove the
   * tag from your state; when it goes, focus moves to the next tag, else the previous one, else
   * `fallbackFocusRef`. Dismissing a selected tag also removes its value from the selection.
   */
  onDismiss?: (value: string) => void;
  /**
   * Where focus goes when the tag that had it is removed and no other tag can take it, for
   * example an "Add" or "Reset filters" button outside the group. WaveUI-only.
   */
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * The selected values (controlled), in selection order: the `value`s of the pressed
   * InteractionTags. Passing `value`, `defaultValue` or `onValueChange` makes the group select
   * (Fluent's `selectedValues`). Plain Tags are never selected.
   */
  value?: readonly string[];
  /** Initially selected values (uncontrolled; Fluent's `defaultSelectedValues`). @default [] */
  defaultValue?: readonly string[];
  /** Called with the new selected values when they change (Fluent's `onTagSelect`). */
  onValueChange?: (value: string[]) => void;
  /** Form field name: one hidden input per selected value (a selecting group only). */
  name?: string;
  /** The id of the form the hidden inputs belong to, when the group is outside it. */
  form?: string;
  /**
   * An empty selection blocks the form's submission (native validation only: a toolbar has no
   * `aria-required`).
   * @default false
   */
  required?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** The gap between the tags per size: 8, 6 or 4px. */
const tagGroupGapClasses: Readonly<Record<TagSize, string>> = {
  medium: 'gap-2',
  small: 'gap-1.5',
  'extra-small': 'gap-1',
};

const DEFAULT_SIZE: TagSize = 'medium';
const DEFAULT_APPEARANCE: TagAppearance = 'filled';
const DEFAULT_SHAPE: TagShape = 'circular';
const KNOWN_APPEARANCES: ReadonlySet<string> = new Set(['filled', 'outline', 'brand']);
const KNOWN_SHAPES: ReadonlySet<string> = new Set(['circular', 'rounded']);

function duplicateValueMessage(value: string): string {
  return `TagGroup: several tags share the value "${value}". Give every tag of a group its own \`value\`: \`onDismiss\` and the selection cannot tell them apart.`;
}

const LISTBOX_ROLE_MESSAGE =
  'TagGroup: `role="listbox"` is not supported (an option cannot hold a Dismiss button); the group keeps the toolbar keyboard. Use InteractionTags in the default toolbar for selectable tags, or Listbox for a list of values.';

const STATIC_TOOLBAR_MESSAGE =
  'TagGroup: this toolbar has tags but no control (no Dismiss button, InteractionTag or link). Pass `role="list"` for tags that only display.';

/**
 * The value registry of one TagGroup: a count per explicit tag `value` (registered from the tags'
 * layout effects). A second tag with one value warns once per value while the group reports
 * values (`reportsValues`), also when it starts reporting them after the tags mounted.
 */
function useValueRegistry(reportsValues: boolean): TagGroupContextValue['register'] {
  const [counts] = React.useState(() => new Map<string, number>());
  const reportsRef = React.useRef(reportsValues);

  React.useLayoutEffect(() => {
    reportsRef.current = reportsValues;
    if (!reportsValues) return;
    for (const [value, count] of counts) {
      if (count > 1) warnOnce(`TagGroup:duplicate-value:${value}`, duplicateValueMessage(value));
    }
  }, [counts, reportsValues]);

  return React.useCallback(
    (value: string) => {
      const count = (counts.get(value) ?? 0) + 1;
      counts.set(value, count);
      if (count > 1 && reportsRef.current) {
        warnOnce(`TagGroup:duplicate-value:${value}`, duplicateValueMessage(value));
      }
      return () => {
        const remaining = (counts.get(value) ?? 1) - 1;
        if (remaining > 0) counts.set(value, remaining);
        else counts.delete(value);
      };
    },
    [counts],
  );
}

/** Whether `root` holds tags of its own (not only those of a nested group). */
function hasOwnTags(root: HTMLElement): boolean {
  for (const item of root.querySelectorAll(TAG_ITEM_SELECTOR)) {
    if (item.parentElement?.closest(TAG_GROUP_SELECTOR) === root) return true;
  }
  return false;
}

/**
 * Whether `root` holds a control a toolbar can move to: a form input of the group's own (a
 * `type="hidden"` input, or the invisible input of a required group) is none.
 */
function hasToolbarControl(root: HTMLElement): boolean {
  for (const element of root.querySelectorAll(TOOLBAR_ITEM_SELECTOR)) {
    if (!isHiddenInput(element) && !element.hasAttribute('data-wave-hidden-input')) return true;
  }
  return false;
}

/**
 * A set of tags with one keyboard model: by default an APG toolbar (`role="toolbar"`), or with
 * `role="list"` a list of tags that only display.
 *
 * - **Toolbar** (the default): one Tab stop, the last focused control (at first the first enabled
 *   one). Left/Right move between the controls when horizontal (mirrored in RTL), Up/Down when
 *   `orientation="vertical"`, the other axis does nothing; the arrows wrap, in DOM order across
 *   wrapped rows, and Home/End jump to the first and last control, the same rule as Toolbar.
 *   Natively disabled controls are skipped. Use it for tags that are actions: dismissible tags,
 *   InteractionTags (both of their buttons join the arrow order), link chips. Renders
 *   `aria-orientation`, and `aria-disabled` while disabled.
 * - **List** (`role="list"`): every tag is a list item (`role="listitem"`), every control keeps
 *   its own Tab stop and the group handles no arrow key. A tag rendered as a link or a button
 *   takes no list item role: put the link in the tag's content (`<Tag><a href>…</a></Tag>`), or
 *   wrap the tag in an element with `role="listitem"`.
 * - **Delete and Backspace** on a tag's Dismiss button, on either button of an InteractionTag with
 *   an `InteractionTag.Secondary`, or on a link in a dismissible tag's text, dismiss the tag (a
 *   held key dismisses one tag). Enter, Space and a click on the Dismiss button do too.
 * - **Defaults for its tags**: `size`, `appearance`, `shape` and, for Tags, `dismissible` (a tag's
 *   own value wins; an InteractionTag is dismissible when it has a Secondary), and `disabled`,
 *   which disables every tag (a tag cannot re-enable itself).
 * - **`onDismiss(value)`** is called on every dismissal, after the Tag's own `onDismiss` or the
 *   Secondary's `onClick` (whose `preventDefault()` keeps the group from being called). Remove
 *   the tag from your state: when the tag that had focus goes, focus moves to the next tag, else
 *   the previous one, else `fallbackFocusRef`, so it never falls to the page. Give every tag a
 *   `value`. A dismissal you refuse (the tag stays) moves no focus.
 * - **Selection**: with `value`, `defaultValue` or `onValueChange` (Fluent's `selectedValues`,
 *   `defaultSelectedValues` and `onTagSelect`) the group selects. Each `InteractionTag.Primary`
 *   is then a toggle (`aria-pressed`): a click, Enter or Space adds its tag's `value` to the
 *   selection or removes it, after the Primary's `onClick` (whose `preventDefault()` cancels the
 *   toggle); the arrow keys only move. `onValueChange` receives the values in selection order,
 *   and values without a tag are kept. Dismissing a selected InteractionTag calls `onDismiss`
 *   and then `onValueChange` without its value. Plain Tags are never selected; selection is
 *   multiple only (RadioGroup or `Toolbar.RadioGroup` for a single choice).
 * - **Forms**: a selecting group with `name` submits one entry per selected value, also from
 *   outside its form with `form`; `required` blocks the submission of an empty selection and
 *   moves focus to the group's Tab stop (native validation only, no `aria-required`); a form
 *   reset restores `defaultValue`. A disabled group submits nothing, and a group that does not
 *   select renders no form input.
 * - No accessible name by default: name the group with `aria-label` or `aria-labelledby`.
 * - Renders `data-orientation`, `data-size`, `data-appearance`, `data-shape` and, while
 *   disabled, `data-disabled`.
 *
 * @example
 * const [filters, setFilters] = React.useState(['Red', 'Blue', 'Large']);
 * const reset = React.useRef<HTMLButtonElement>(null);
 * <TagGroup
 *   aria-label="Active filters"
 *   dismissible
 *   fallbackFocusRef={reset}
 *   onDismiss={(value) => setFilters((current) => current.filter((f) => f !== value))}
 * >
 *   {filters.map((filter) => (
 *     <Tag key={filter} value={filter}>
 *       {filter}
 *     </Tag>
 *   ))}
 * </TagGroup>
 * <Button ref={reset} onClick={() => setFilters(['Red', 'Blue', 'Large'])}>Reset filters</Button>
 *
 * @example
 * // Selectable chips, submitted with a form as "fruit".
 * const [fruit, setFruit] = React.useState<string[]>(['plum']);
 * <TagGroup aria-label="Fruit" name="fruit" value={fruit} onValueChange={setFruit}>
 *   <InteractionTag value="cherry">
 *     <InteractionTag.Primary>Cherry</InteractionTag.Primary>
 *   </InteractionTag>
 *   <InteractionTag value="plum">
 *     <InteractionTag.Primary>Plum</InteractionTag.Primary>
 *   </InteractionTag>
 * </TagGroup>
 */
export const TagGroup = ({
  role: roleProp,
  orientation = 'horizontal',
  size: sizeProp = DEFAULT_SIZE,
  appearance: appearanceProp = DEFAULT_APPEARANCE,
  shape: shapeProp = DEFAULT_SHAPE,
  disabled = false,
  dismissible = false,
  onDismiss,
  fallbackFocusRef,
  value: valueProp,
  defaultValue,
  onValueChange,
  name,
  form,
  required = false,
  className,
  onKeyDown,
  onFocus,
  'aria-orientation': ariaOrientation,
  'aria-disabled': ariaDisabled,
  ref,
  children,
  ...rest
}: TagGroupProps) => {
  const role = roleProp ?? 'toolbar';
  const mode: TagGroupMode = role === 'list' ? 'list' : 'toolbar';
  const isToolbar = mode === 'toolbar';
  // An untyped value outside the unions falls back to the default look.
  const size: TagSize = Object.hasOwn(tagGroupGapClasses, sizeProp) ? sizeProp : DEFAULT_SIZE;
  const appearance: TagAppearance = KNOWN_APPEARANCES.has(appearanceProp)
    ? appearanceProp
    : DEFAULT_APPEARANCE;
  const shape: TagShape = KNOWN_SHAPES.has(shapeProp) ? shapeProp : DEFAULT_SHAPE;

  // The host options apply to this group only: a nested group reads `null` (provided below).
  const host = React.useContext(TagGroupHostContext);
  const removalFocus = host?.removalFocus ?? 'next-then-previous';
  const hiddenValues = host?.hiddenValues;
  const dimDisabled = host?.dimDisabled ?? true;

  const rootRef = React.useRef<HTMLDivElement>(null);
  // In list mode the roving container is not attached, so the controls keep their own Tab stops
  // (and the roving hook hands back the tab indices it stamped while the group was a toolbar).
  const { containerProps } = useToolbarNavigation({ orientation });
  const mergedRef = useMergedRefs<HTMLDivElement>(
    rootRef,
    isToolbar ? containerProps.ref : null,
    ref,
  );

  // Selection (D38): the values of the pressed InteractionTags, in selection order. The callback
  // receives a copy of its own, so the app may keep or change it.
  const [values, setValues, isControlled] = useControllable<readonly string[]>(
    valueProp,
    defaultValue ?? EMPTY_VALUES,
    (next) => onValueChange?.([...next]),
  );
  // Any of the three makes the group select; `onValueChange` alone selects from `[]`.
  const selecting = isControlled || defaultValue !== undefined || onValueChange !== undefined;
  const selectedValues = React.useMemo(() => new Set(values), [values]);
  const isSelected = React.useCallback(
    (value: string) => selecting && selectedValues.has(value),
    [selecting, selectedValues],
  );
  const toggle = useEventCallback((value: string) => {
    if (!selecting || disabled) return;
    setValues((current) => toggleValue(current, value).values);
  });
  // A dismissed InteractionTag leaves the selection (D39); a value that is not selected changes
  // nothing (the same array is no change, so `onValueChange` is not called).
  const deselect = useEventCallback((value: string) => {
    if (!selecting) return;
    setValues((current) =>
      current.includes(value) ? current.filter((selected) => selected !== value) : current,
    );
  });

  // A form reset restores `defaultValue`, compared by content (C-FORMS): an unchanged reset
  // reports nothing, also with a new inline default array.
  useFormReset(
    rootRef,
    () => {
      if (!selecting) return;
      setValues((current) => {
        const initial = defaultValue ?? EMPTY_VALUES;
        return sameValues(current, initial) ? current : [...initial];
      });
    },
    form,
  );
  // An empty required selection: the browser reports it at the group's Tab stop (the toolbar's
  // last focused control, or a list's first control).
  const focusTabStop = () => {
    const root = rootRef.current;
    if (root) getFirstTabbable(root)?.focus();
  };

  const reportsDismissals = onDismiss !== undefined;
  const register = useValueRegistry(reportsDismissals || selecting);
  const dismiss = useEventCallback((value: string) => {
    onDismiss?.(value);
  });

  const context = React.useMemo<TagGroupContextValue>(
    () => ({
      mode,
      size,
      appearance,
      shape,
      disabled,
      dismissible,
      dismiss,
      reportsDismissals,
      selecting,
      isSelected,
      toggle,
      deselect,
      register,
      rootRef,
      fallbackFocusRef,
      removalFocus,
      hiddenValues,
      dimDisabled,
    }),
    [
      mode,
      size,
      appearance,
      shape,
      disabled,
      dismissible,
      dismiss,
      reportsDismissals,
      selecting,
      isSelected,
      toggle,
      deselect,
      register,
      fallbackFocusRef,
      removalFocus,
      hiddenValues,
      dimDisabled,
    ],
  );

  const isListbox = role === 'listbox';
  React.useEffect(() => {
    if (isListbox) warnOnce('TagGroup:listbox-role', LISTBOX_ROLE_MESSAGE);
  }, [isListbox]);

  // A toolbar of tags that only display has nothing to move to: it should be a list. Checked
  // after every commit (the tags are found in the DOM, so a tag written in a Server Component
  // counts too), in development only.
  React.useEffect(() => {
    if (!isDev || !isToolbar || disabled || hasWarned('TagGroup:static-toolbar')) return;
    const root = rootRef.current;
    if (root && hasOwnTags(root) && !hasToolbarControl(root)) {
      warnOnce('TagGroup:static-toolbar', STATIC_TOOLBAR_MESSAGE);
    }
  });

  return (
    <TagGroupContext.Provider value={context}>
      <TagGroupHostContext.Provider value={null}>
        <div
          data-orientation={orientation}
          data-size={size}
          data-appearance={appearance}
          data-shape={shape}
          data-disabled={disabled ? '' : undefined}
          data-wave-tag-group=""
          {...rest}
          ref={mergedRef}
          role={role}
          // `aria-orientation` is allowed on a toolbar, not on a list (axe `aria-allowed-attr`);
          // `aria-disabled` is supported on widget and group roles, not on a list (ARIA 1.2).
          aria-orientation={role === 'toolbar' ? (ariaOrientation ?? orientation) : ariaOrientation}
          aria-disabled={isToolbar && disabled ? true : ariaDisabled}
          data-roving-container={isToolbar ? '' : undefined}
          onKeyDown={
            isToolbar ? composeEventHandlers(onKeyDown, containerProps.onKeyDown) : onKeyDown
          }
          onFocus={
            isToolbar
              ? composeEventHandlers(onFocus, containerProps.onFocus, {
                  checkDefaultPrevented: false,
                })
              : onFocus
          }
          className={cn(
            tagGroupClassNames.root,
            'relative inline-flex flex-wrap items-center',
            tagGroupGapClasses[size],
            orientation === 'vertical' && 'flex-col items-start',
            className,
          )}
        >
          {children}
          {/* Inside the root (`relative`): a required input sits at its corner, and a focused one
              hands focus back to the group. Only a selecting group has values to submit. */}
          {selecting && (
            <HiddenInput
              type="text"
              name={name}
              form={form}
              disabled={disabled}
              value={values}
              required={required}
              onInvalid={focusTabStop}
            />
          )}
        </div>
      </TagGroupHostContext.Provider>
    </TagGroupContext.Provider>
  );
};
TagGroup.displayName = 'TagGroup';
