import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import {
  tagPickerButtonClassNames,
  tagPickerClassNames,
  tagPickerControlClassNames,
  tagPickerGroupClassNames,
  tagPickerInputClassNames,
  tagPickerListClassNames,
} from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { FOCUSABLE_SELECTOR, isFocusable } from '../../lib/focus';
import { DismissIcon } from '../../lib/icons';
import { slotRendersContent } from '../../lib/slot';
import type { Slot, SlotObject } from '../../lib/slot';
import {
  focusRing,
  inputAppearanceClasses,
  inputFocusWithin,
  inputInvalidWithin,
} from '../../lib/styles';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';
import { MERGED_DISABLED_FOCUSABLE_PROPS } from '../button/Button.slots';
import { Tag } from '../data-display/Tag';
import { TagGroup } from '../data-display/TagGroup';
import {
  TAG_GROUP_SELECTOR,
  TagGroupHostContext,
  TagHostContext,
} from '../data-display/TagGroup.context';
import type { TagGroupHostOptions, TagHostContextValue } from '../data-display/TagGroup.context';
import { tagRootClasses } from '../data-display/tagStyles';
import { PickerExpandButton, showsExpandButton } from './Combobox.expand';
import { ListboxSurface, Option, OptionGroup } from './Option';
import {
  pickerButtonOffset,
  pickerEndPadding,
  pickerGlyphSize,
  pickerIconButtonClasses,
} from './pickerStyles';
import {
  TagPickerControlContext,
  useTagPickerContext,
  useTagPickerControlContext,
} from './TagPicker.context';
import type { TagPickerContextValue, TagPickerControlContextValue } from './TagPicker.context';
import { TagPickerOption } from './TagPicker.option';
import type { TagPickerSize } from './TagPicker.root';

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

/** Per-size classes of the control and the trigger (medium is the 0.7 look). */
const TAG_PICKER_SIZE: Readonly<Record<TagPickerSize, { control: string; trigger: string }>> = {
  medium: { control: 'gap-1 px-2 py-1.5', trigger: 'py-0.5 text-body-1' },
  large: { control: 'gap-1.5 px-2.5 py-2', trigger: 'py-1 text-body-1' },
  'extra-large': { control: 'gap-1.5 px-3 py-2.5', trigger: 'py-1 text-body-2' },
};

/**
 * The offset that centres an end button's box on the control's first row: the control's top
 * padding plus half the row (the trigger line) minus half the box.
 */
const END_BUTTON_TOP: Readonly<Record<TagPickerSize, string>> = {
  medium: 'top-1.5',
  large: 'top-1.5',
  'extra-large': 'top-2.25',
};

/**
 * The focusable controls of a tag list in DOM order (D57): the group's focusable elements that are
 * not hidden and whose nearest tag group is this one (a nested group's controls are its own).
 */
export function tagListControls(group: HTMLElement): HTMLElement[] {
  return Array.from(group.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      isFocusable(element) &&
      !element.closest('[hidden]') &&
      element.closest(TAG_GROUP_SELECTOR) === group,
  );
}

/** A previous-arrow press with no modifier (Left, Right in RTL). */
function isPreviousArrow(event: React.KeyboardEvent<HTMLElement>): boolean {
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
  return (
    getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    }) === 'prev'
  );
}

/** What the held focus of the clear button needs (see {@link useClearButtonHold}). */
interface ClearButtonHold {
  held: boolean;
  onFocus: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLButtonElement>) => void;
}

/**
 * The clear button disabled while it has focus keeps it, unavailable, until focus leaves it (D61,
 * §4 T-T6's hold under D25's rule): adjusted during render from the previous `disabled`; a blur
 * after which focus went nowhere (the window lost focus) keeps the hold.
 */
function useClearButtonHold(disabled: boolean): ClearButtonHold {
  const [focused, setFocused] = React.useState(false);
  const [held, setHeld] = React.useState(false);
  const [prevDisabled, setPrevDisabled] = React.useState(disabled);
  let isHeld = held;
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    isHeld = disabled && focused;
    if (isHeld !== held) setHeld(isHeld);
  }
  const onFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    if (event.target === event.currentTarget) setFocused(true);
  };
  const onBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
    if (event.target !== event.currentTarget) return;
    const departed = event.relatedTarget !== null || event.currentTarget.ownerDocument.hasFocus();
    if (!departed) return;
    setFocused(false);
    setHeld(false);
  };
  return { held: disabled && isHeld, onFocus, onBlur };
}

const NATIVELY_DISABLED = { disabled: true } as const;

/* ------------------------------------------------------------------ */
/*  The end buttons                                                    */
/* ------------------------------------------------------------------ */

interface TagPickerClearButtonProps {
  ctx: TagPickerContextValue;
  /** 1: at the inline end; 2: before the expand button. */
  position: 1 | 2;
}

/**
 * The clear button (`clearable`, D61): removes every tag, clears the text, closes the list and
 * focuses the trigger. It never drops focus to the page: unmounting while it has focus hands focus
 * to the trigger, and disabled while it has focus it stays focusable until focus leaves it.
 */
function TagPickerClearButton({ ctx, position }: TagPickerClearButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const { triggerRef } = ctx;
  usePreserveFocus(ref, () => triggerRef.current);
  const hold = useClearButtonHold(ctx.disabled);
  const stateProps = ctx.disabled
    ? hold.held
      ? MERGED_DISABLED_FOCUSABLE_PROPS
      : NATIVELY_DISABLED
    : undefined;
  return (
    <button
      type="button"
      ref={ref}
      aria-label={ctx.labels.clear}
      // Keeps focus in the trigger: a press must not blur it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => ctx.clear()}
      {...stateProps}
      onFocus={hold.onFocus}
      onBlur={hold.onBlur}
      className={cn(
        tagPickerClassNames.clearButton,
        END_BUTTON_TOP[ctx.size],
        pickerIconButtonClasses(ctx.coreSize, ctx.appearance),
        pickerButtonOffset(ctx.coreSize, position),
        focusRing,
        // The control dims as a whole (D66): the button keeps only the not-allowed cursor.
        'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
      )}
    >
      <DismissIcon size={pickerGlyphSize(ctx.coreSize, 'icon')} />
    </button>
  );
}
TagPickerClearButton.displayName = 'TagPickerClearButton';

/* ------------------------------------------------------------------ */
/*  TagPicker.Control                                                  */
/* ------------------------------------------------------------------ */

/** Props of TagPicker.Control: the field that holds the tags, the trigger and the end buttons. */
export interface TagPickerControlProps extends React.HTMLAttributes<HTMLDivElement> {
  /** As TagPicker's `expandIcon`; wins over it when it is not `undefined`. */
  expandIcon?: Slot<'span'>;
  /** @default `<TagPicker.Group /><TagPicker.Input />` */
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

interface ControlImplProps extends TagPickerControlProps {
  ctx: TagPickerContextValue;
}

function TagPickerControlImpl({
  ctx,
  expandIcon,
  children,
  className,
  onMouseDown,
  ref,
  ...rest
}: ControlImplProps) {
  const { registerTrigger, setReference, controlRef } = ctx;
  const controlContext = React.useMemo<TagPickerControlContextValue>(
    () => ({ registerTrigger }),
    [registerTrigger],
  );
  // The control is the popup's anchor: the list opens below it, as wide as it (0.10).
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, controlRef, setReference);

  const glyph = expandIcon !== undefined ? expandIcon : ctx.expandIcon;
  const showExpand = showsExpandButton(glyph);
  const showClear = ctx.clearable && ctx.selected.length > 0 && !ctx.readOnly;
  const buttons = (showExpand ? 1 : 0) + (showClear ? 1 : 0);

  // A press on the empty area (D66): not inside a focusable element of the control, the primary
  // button, inside the control in the DOM. It keeps focus in the trigger and toggles the list.
  const handlePress = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const control = event.currentTarget;
    const target = event.target;
    if (!(target instanceof Element) || !control.contains(target)) return;
    const focusable = target.closest(FOCUSABLE_SELECTOR);
    if (focusable && control.contains(focusable)) return;
    if (ctx.disabled) return;
    event.preventDefault();
    if (ctx.interactive) ctx.toggleOpen();
    ctx.focusTrigger();
  };

  return (
    <TagPickerControlContext.Provider value={controlContext}>
      <div
        data-wave-tagpicker-control=""
        role="group"
        aria-disabled={ctx.disabled || undefined}
        {...rest}
        ref={mergedRef}
        className={cn(
          tagPickerControlClassNames.root,
          tagPickerClassNames.control,
          'relative flex flex-wrap items-center',
          TAG_PICKER_SIZE[ctx.size].control,
          inputAppearanceClasses[ctx.appearance],
          inputFocusWithin,
          ctx.invalidLook && inputInvalidWithin,
          pickerEndPadding(buttons, ctx.coreSize),
          // Dimmed once (D66); a focus ring inside (a held remove button) lifts it.
          ctx.disabled && 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100',
          ctx.collapsed && 'flex-nowrap',
          className,
        )}
        onMouseDown={composeEventHandlers(onMouseDown, handlePress)}
      >
        {children ?? (
          <>
            <TagPickerGroup />
            <TagPickerInput />
          </>
        )}
        {showClear && <TagPickerClearButton ctx={ctx} position={showExpand ? 2 : 1} />}
        {showExpand && (
          <PickerExpandButton
            component={expandIcon !== undefined ? 'TagPicker.Control' : 'TagPicker'}
            expandIcon={glyph}
            label={ctx.labels.expand}
            expanded={ctx.expanded}
            listboxId={ctx.listbox.listboxId}
            disabled={ctx.disabled || ctx.readOnly}
            onToggle={() => {
              ctx.toggleOpen();
              ctx.focusTrigger();
            }}
            size={ctx.coreSize}
            appearance={ctx.appearance}
            dimDisabled={!ctx.disabled}
            className={cn(tagPickerClassNames.expandButton, END_BUTTON_TOP[ctx.size])}
            iconClassName={tagPickerClassNames.expandIcon}
          />
        )}
      </div>
    </TagPickerControlContext.Provider>
  );
}
TagPickerControlImpl.displayName = 'TagPickerControlImpl';

/**
 * The field of a TagPicker (`TagPicker.Control`): a `role="group"` box in the picker's look that
 * holds the tag list, the trigger and, at its inline end, the clear button (`clearable`) and the
 * expand button (`expandIcon`, a chevron by default; this part's `expandIcon` wins over
 * TagPicker's). Without children it renders `TagPicker.Group` and `TagPicker.Input`. A press on
 * its empty area (not on a tag's button or link, or a trigger) toggles the list and keeps focus in
 * the trigger; read-only, it only focuses the trigger. Render exactly one trigger in it,
 * `TagPicker.Input` or `TagPicker.Button`. It takes neither `size` nor `appearance`: TagPicker's
 * apply.
 */
export const TagPickerControl = (props: TagPickerControlProps) => {
  const ctx = useTagPickerContext('TagPicker.Control');
  if (!ctx) return null;
  return <TagPickerControlImpl {...props} ctx={ctx} />;
};
TagPickerControl.displayName = 'TagPickerControl';

/* ------------------------------------------------------------------ */
/*  TagPicker.Group                                                    */
/* ------------------------------------------------------------------ */

/** Props of TagPicker.Group: the list of selected tags (a TagGroup with `role="list"`). */
export interface TagPickerGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'role' | 'defaultValue'
> {
  /**
   * The tags of the selected values: `Tag`s with a `value` each (leave `dismissible` unset), in
   * `value` order (the single-line layout matches the tags to the values by position).
   * @default one Tag per selected value, named "Remove <label>" (`labels.remove`)
   */
  children?: React.ReactNode;
  /** @default TagPicker's `labels.selected` ('Selected') */
  'aria-label'?: string;
  ref?: React.Ref<HTMLDivElement>;
}

interface DefaultTagProps {
  ctx: TagPickerContextValue;
  value: string;
}

/**
 * A default tag (D55): a Tag named by the option's label, with TagPicker's part classes, the
 * remove button named by `labels.remove` alone and the option entry's `media`, decorative.
 */
function TagPickerDefaultTag({ ctx, value }: DefaultTagProps) {
  const label = ctx.labelOf(value);
  const dismissName = ctx.labels.remove(label);
  const host = React.useMemo<TagHostContextValue>(
    () => ({ dismissName, dismissButtonClassName: tagPickerClassNames.removeButton }),
    [dismissName],
  );
  const media = ctx.entryOf(value)?.media;
  const hasMedia = slotRendersContent(media);
  const mediaSlot = React.useMemo<SlotObject<'span'> | undefined>(
    () => (hasMedia ? { children: media, 'aria-hidden': true } : undefined),
    [hasMedia, media],
  );
  return (
    <TagHostContext.Provider value={host}>
      <Tag value={value} className={tagPickerClassNames.tag} media={mediaSlot}>
        {label}
      </Tag>
    </TagHostContext.Provider>
  );
}
TagPickerDefaultTag.displayName = 'TagPickerDefaultTag';

interface GroupImplProps extends TagPickerGroupProps {
  ctx: TagPickerContextValue;
}

function TagPickerGroupImpl({
  ctx,
  children,
  'aria-label': ariaLabel,
  className,
  onKeyDown,
  onClickCapture,
  ref,
  ...rest
}: GroupImplProps) {
  const { groupRef, chipRef, hiddenValues, disabled, focusTrigger } = ctx;
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, groupRef);
  // Whether the click behind the latest dismissal was a pointer click (D56).
  const pointerRef = React.useRef(false);
  const host = React.useMemo<TagGroupHostOptions>(
    () => ({ removalFocus: 'next', hiddenValues, dimDisabled: !disabled }),
    [hiddenValues, disabled],
  );

  // The 0.10 warning, only in the 0.10 configuration (D58): data mode, the default tags, no
  // free tagging.
  const usesDefaultTags = children === undefined || children === null;
  const unknownValues =
    usesDefaultTags && ctx.warnsUnknownValues
      ? ctx.selected.filter((value) => ctx.entryOf(value) === undefined).join('\u0000')
      : '';
  React.useEffect(() => {
    if (!unknownValues) return;
    warnOnce(
      'TagPicker:unknown-value',
      `TagPicker: the selected value(s) ${unknownValues
        .split('\u0000')
        .map((v) => `"${v}"`)
        .join(', ')} match no option; the raw value is shown as the tag label.`,
    );
  }, [unknownValues]);

  // An empty `role="list"` is not rendered (0.10, Fluent's renderTagPickerGroup).
  if (ctx.selected.length === 0) return null;

  // The keys of the tag list stay 0.10's (D57), for controls of this group in the DOM.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const controls = tagListControls(event.currentTarget);
    const index = controls.indexOf(target);
    if (index === -1) return;
    if (event.key === 'Escape') {
      // Consumed here, so an enclosing layer ignores it (0.5 §5.4).
      event.preventDefault();
      focusTrigger();
      return;
    }
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(target),
    });
    if (intent === 'prev' && index > 0) {
      event.preventDefault();
      controls[index - 1].focus();
    } else if (intent === 'next') {
      event.preventDefault();
      if (index < controls.length - 1) controls[index + 1].focus();
      else focusTrigger();
    }
  };

  // A pointer removal focuses the trigger first, whether or not the tag goes (D56); focus placed
  // here wins over TagGroup's move to the next tag.
  const handleDismiss = (value: string) => {
    if (pointerRef.current) focusTrigger();
    ctx.removeTag(value);
  };

  // Records the `detail` of every click inside the list in the DOM (the consumer's handler runs
  // first; a click it prevents is still recorded).
  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    onClickCapture?.(event);
    if (event.target instanceof Node && event.currentTarget.contains(event.target)) {
      pointerRef.current = event.detail > 0;
    }
  };

  const hiddenCount = hiddenValues?.size ?? 0;
  return (
    <>
      <TagGroupHostContext.Provider value={host}>
        <TagGroup
          role="list"
          aria-label={ariaLabel ?? ctx.labels.selected}
          dismissible={!ctx.readOnly}
          disabled={disabled}
          size={ctx.tagSize}
          appearance={ctx.tagAppearance}
          shape="rounded"
          onDismiss={handleDismiss}
          fallbackFocusRef={ctx.triggerRef}
          {...rest}
          ref={mergedRef}
          className={cn(
            tagPickerGroupClassNames.root,
            tagPickerClassNames.group,
            'flex flex-wrap items-center gap-1',
            ctx.collapsed && 'min-w-0 flex-nowrap overflow-hidden whitespace-nowrap *:shrink-0',
            className,
          )}
          onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
          onClickCapture={handleClickCapture}
        >
          {usesDefaultTags
            ? ctx.selected.map((value) => (
                <TagPickerDefaultTag key={value} ctx={ctx} value={value} />
              ))
            : children}
        </TagGroup>
      </TagGroupHostContext.Provider>
      {hiddenCount > 0 && (
        // The "+N" chip (D62): hidden from assistive technology, which hears the summary.
        <span
          ref={chipRef}
          aria-hidden="true"
          className={cn(
            tagPickerClassNames.overflowCount,
            tagRootClasses({ size: ctx.tagSize, appearance: ctx.tagAppearance, shape: 'rounded' }),
            'shrink-0 cursor-default',
          )}
          // A press focuses the trigger (every tag shows); the list does not change.
          onMouseDown={(event) => {
            event.preventDefault();
            focusTrigger();
          }}
        >
          {ctx.labels.overflowCount(hiddenCount)}
        </span>
      )}
    </>
  );
}
TagPickerGroupImpl.displayName = 'TagPickerGroupImpl';

/**
 * The selected tags of a TagPicker (`TagPicker.Group`): a `TagGroup` with `role="list"` named
 * "Selected" (`labels.selected`, or its own `aria-label`), rendered only while a value is
 * selected. Without children it renders a Tag per selected value, named by the option's label,
 * with a remove button named "Remove <label>" (`labels.remove`). Your own Tags in it are the
 * selected values' tags: give each a `value`, leave `dismissible` unset (a read-only picker then
 * shows no remove buttons), and pass `dismissLabel="Remove"` for TagPicker's wording (a Tag's own
 * Dismiss button is named "Dismiss <text>"). Each remove button is a Tab stop; Delete, Backspace,
 * Enter and Space remove its tag, and focus moves to the next tag, else to the trigger; a click
 * focuses the trigger. Left and Right (mirrored in RTL) move between the controls of the list and
 * from the last one to the trigger; Escape returns to the trigger. Its tags take the picker's look,
 * one Tag size smaller (a Tag's own `size` and `appearance` win). With `overflow="count"` the
 * tags are measured by position: render your own Tags in `value` order. Fluent's TagPickerGroup is a
 * listbox of tags: an option cannot hold a Dismiss button.
 */
export const TagPickerGroup = (props: TagPickerGroupProps) => {
  const ctx = useTagPickerContext('TagPicker.Group');
  if (!ctx) return null;
  return <TagPickerGroupImpl {...props} ctx={ctx} />;
};
TagPickerGroup.displayName = 'TagPickerGroup';

/* ------------------------------------------------------------------ */
/*  TagPicker.Input                                                    */
/* ------------------------------------------------------------------ */

/**
 * Props of TagPicker.Input: the text field, the combobox. The form fields (`name`, `form`,
 * `required`) are TagPicker's: its hidden inputs submit the tags, never the typed text.
 */
export interface TagPickerInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'value'
  | 'defaultValue'
  | 'type'
  | 'size'
  | 'disabled'
  | 'readOnly'
  | 'name'
  | 'form'
  | 'required'
> {
  /** Shown while no tag is selected. @default TagPicker's `placeholder` */
  placeholder?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * The attributes the trigger takes from the root and its own naming (D65): its own `id`, and its
 * own `aria-label`/`aria-labelledby` pair when it has either, replace the root's.
 */
function triggerNaming(
  ctx: TagPickerContextValue,
  own: { id?: string; 'aria-label'?: string; 'aria-labelledby'?: string },
) {
  const named = own['aria-label'] !== undefined || own['aria-labelledby'] !== undefined;
  return {
    id: own.id ?? ctx.triggerProps.id,
    'aria-label': named ? own['aria-label'] : ctx.triggerProps['aria-label'],
    'aria-labelledby': named ? own['aria-labelledby'] : ctx.triggerProps['aria-labelledby'],
  };
}

interface InputImplProps extends TagPickerInputProps {
  ctx: TagPickerContextValue;
  control: TagPickerControlContextValue;
}

function TagPickerInputImpl({
  ctx,
  control,
  placeholder,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  onChange,
  onClick,
  onKeyDown,
  onKeyUp,
  onFocus,
  onBlur,
  className,
  ref,
  ...rest
}: InputImplProps) {
  const { registerTrigger } = control;
  React.useLayoutEffect(() => registerTrigger('input'), [registerTrigger]);
  const { triggerProps, inputProps, listbox } = ctx;
  const mergedRef = useMergedRefs<HTMLInputElement>(
    ref,
    ctx.triggerRef as React.Ref<HTMLInputElement>,
    inputProps.controlRef,
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Read-only: no listbox keys at all (they would open the list, add or remove tags).
    if (!ctx.interactive) return;
    if (event.key === 'Escape' && ctx.open && !ctx.surfaceOpen && !event.nativeEvent.isComposing) {
      // Open with nothing shown (every option selected, no query): close, but leave Escape to an
      // enclosing layer (overlays#1) instead of consuming it for an invisible list.
      ctx.setOpen(false);
      return;
    }
    if (ctx.selected.length > 0) {
      if (event.key === 'Backspace' && ctx.query === '') {
        // Backspace moves to the last tag; Backspace or Delete there removes it (input-pickers#14).
        event.preventDefault();
        ctx.focusLastTagControl();
        return;
      }
      const input = event.currentTarget;
      if (
        isPreviousArrow(event) &&
        input.selectionStart === 0 &&
        input.selectionEnd === 0 &&
        ctx.focusLastTagControl()
      ) {
        event.preventDefault();
        return;
      }
    }
    listbox.onKeyDown(event);
  };

  const naming = triggerNaming(ctx, {
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  });

  return (
    <input
      type="text"
      autoComplete={inputProps.autoComplete}
      autoCapitalize={inputProps.autoCapitalize}
      autoCorrect={inputProps.autoCorrect}
      maxLength={inputProps.maxLength}
      inputMode={inputProps.inputMode}
      spellCheck={inputProps.spellCheck}
      enterKeyHint={inputProps.enterKeyHint}
      aria-invalid={triggerProps['aria-invalid']}
      aria-required={triggerProps['aria-required']}
      aria-errormessage={triggerProps['aria-errormessage']}
      aria-details={triggerProps['aria-details']}
      tabIndex={triggerProps.tabIndex}
      autoFocus={triggerProps.autoFocus}
      {...rest}
      {...naming}
      {...listbox.getComboboxProps()}
      aria-expanded={ctx.expanded}
      aria-describedby={joinIds(ariaDescribedBy, triggerProps['aria-describedby'], ctx.summaryId)}
      ref={mergedRef}
      disabled={ctx.disabled}
      readOnly={ctx.readOnly}
      placeholder={ctx.selected.length === 0 ? (placeholder ?? ctx.placeholder) : ''}
      value={ctx.query}
      onChange={composeEventHandlers(onChange, (event: React.ChangeEvent<HTMLInputElement>) =>
        ctx.editText(event.target.value),
      )}
      // A click opens a closed list and never closes it (Combobox's input rule, D66).
      onClick={composeEventHandlers(onClick, () => {
        if (ctx.interactive && !ctx.open) ctx.setOpen(true);
      })}
      onKeyDown={composeEventHandlers(
        onKeyDown,
        composeEventHandlers(inputProps.onKeyDown, handleKeyDown),
      )}
      onKeyUp={composeEventHandlers(
        onKeyUp,
        composeEventHandlers(inputProps.onKeyUp, listbox.onKeyUp),
      )}
      onFocus={composeEventHandlers(onFocus, inputProps.onFocus)}
      onBlur={composeEventHandlers(onBlur, inputProps.onBlur)}
      className={cn(
        tagPickerInputClassNames.root,
        tagPickerClassNames.input,
        'min-w-15 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-hidden',
        TAG_PICKER_SIZE[ctx.size].trigger,
        className,
      )}
    />
  );
}
TagPickerInputImpl.displayName = 'TagPickerInputImpl';

/**
 * The text field of a TagPicker (`TagPicker.Input`): the `<input role="combobox">` that filters
 * the options as you type, inside `TagPicker.Control`. TagPicker's `id`, name, description, Field
 * wiring and text input attributes reach it (its own `id`, `aria-label` and `aria-labelledby`
 * replace TagPicker's, and its `aria-describedby` comes first); its handlers run before
 * TagPicker's `onKeyDown` and the built-in keys. Backspace in the empty field, and Left (Right in
 * RTL) with the caret at its start, focus the last tag. The form fields are TagPicker's.
 */
export const TagPickerInput = (props: TagPickerInputProps) => {
  const ctx = useTagPickerContext('TagPicker.Input');
  const control = useTagPickerControlContext('TagPicker.Input', ctx !== null);
  if (!ctx || !control) return null;
  return <TagPickerInputImpl {...props} ctx={ctx} control={control} />;
};
TagPickerInput.displayName = 'TagPickerInput';

/* ------------------------------------------------------------------ */
/*  TagPicker.Button                                                   */
/* ------------------------------------------------------------------ */

/** Props of TagPicker.Button: a trigger without text entry (select-only). */
export interface TagPickerButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'type' | 'disabled' | 'children'
> {
  /** Shown while no tag is selected. @default TagPicker's `placeholder` */
  placeholder?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

interface ButtonImplProps extends TagPickerButtonProps {
  ctx: TagPickerContextValue;
  control: TagPickerControlContextValue;
}

function TagPickerButtonImpl({
  ctx,
  control,
  placeholder,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  onClick,
  onKeyDown,
  onKeyUp,
  className,
  ref,
  ...rest
}: ButtonImplProps) {
  const { registerTrigger } = control;
  React.useLayoutEffect(() => registerTrigger('button'), [registerTrigger]);
  const { triggerProps, listbox } = ctx;
  const mergedRef = useMergedRefs<HTMLButtonElement>(
    ref,
    ctx.triggerRef as React.Ref<HTMLButtonElement>,
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!ctx.interactive) return;
    if (
      ctx.selected.length > 0 &&
      (event.key === 'Backspace' || isPreviousArrow(event)) &&
      ctx.focusLastTagControl()
    ) {
      event.preventDefault();
      return;
    }
    listbox.onKeyDown(event);
  };

  // The editable mode's `aria-autocomplete` of the server HTML and the first render is not a
  // button's (D63), so the part drops it itself.
  const comboboxProps = { ...listbox.getComboboxProps() };
  delete comboboxProps['aria-autocomplete'];
  const naming = triggerNaming(ctx, {
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  });

  return (
    <button
      type="button"
      aria-invalid={triggerProps['aria-invalid']}
      aria-required={triggerProps['aria-required']}
      aria-errormessage={triggerProps['aria-errormessage']}
      aria-details={triggerProps['aria-details']}
      tabIndex={triggerProps.tabIndex}
      autoFocus={triggerProps.autoFocus}
      {...rest}
      {...naming}
      {...comboboxProps}
      aria-expanded={ctx.expanded}
      aria-readonly={ctx.readOnly || undefined}
      aria-describedby={joinIds(ariaDescribedBy, triggerProps['aria-describedby'], ctx.summaryId)}
      ref={mergedRef}
      disabled={ctx.disabled}
      onClick={composeEventHandlers(onClick, () => ctx.toggleOpen())}
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
      className={cn(
        tagPickerButtonClassNames.root,
        // Padding and background set here (C-NATIVE); the control's focus look shows its focus.
        'min-w-15 flex-1 border-0 bg-transparent px-0 text-start text-foreground focus:outline-hidden disabled:cursor-not-allowed',
        TAG_PICKER_SIZE[ctx.size].trigger,
        className,
      )}
    >
      {ctx.selected.length === 0 && (
        <span className="text-muted-foreground">{placeholder ?? ctx.placeholder}</span>
      )}
    </button>
  );
}
TagPickerButtonImpl.displayName = 'TagPickerButtonImpl';

/**
 * A select-only trigger for a TagPicker (`TagPicker.Button`), in place of `TagPicker.Input`: a
 * `<button role="combobox">` for a short fixed list, with no text entry. Down, Up, Home, End and
 * typing a letter open the list and move; Enter and Space open it or add the active option and
 * keep it open; Escape, Alt+Up and Tab close it; a click toggles it. Backspace and Left (Right in
 * RTL) focus the last tag. It shows the placeholder while no tag is selected, else nothing, and
 * stays the click area of the rest of the row. No query, no filter and no create option
 * (`allowCreate` needs `TagPicker.Input`). TagPicker's `id`, name, description and Field wiring
 * reach it; pass handlers and `ref` on it (TagPicker's `onKeyDown` and `controlRef` are the
 * Input's). Read-only, it renders `aria-readonly`. Fluent's TagPickerButton is visually hidden
 * once a tag is selected; this one stays.
 */
export const TagPickerButton = (props: TagPickerButtonProps) => {
  const ctx = useTagPickerContext('TagPicker.Button');
  const control = useTagPickerControlContext('TagPicker.Button', ctx !== null);
  if (!ctx || !control) return null;
  return <TagPickerButtonImpl {...props} ctx={ctx} control={control} />;
};
TagPickerButton.displayName = 'TagPickerButton';

/* ------------------------------------------------------------------ */
/*  TagPicker.List                                                     */
/* ------------------------------------------------------------------ */

/** Props of TagPicker.List: the option list, shown in a popup while open. */
export interface TagPickerListProps extends Omit<
  React.HTMLAttributes<HTMLUListElement>,
  | 'role'
  | 'id'
  | 'hidden'
  | 'tabIndex'
  | 'aria-multiselectable'
  | 'aria-activedescendant'
  | 'dangerouslySetInnerHTML'
> {
  /**
   * `TagPicker.Option`s, `Option`s and `TagPicker.OptionGroup`s. Keep the options of selected
   * values rendered: TagPicker hides them and reads their labels.
   * @default one TagPicker.Option per available entry of TagPicker's `options`
   */
  children?: React.ReactNode;
  /**
   * Names the listbox (with `aria-labelledby`): the List's own pair replaces TagPicker's name.
   * @default TagPicker's `aria-label`, else its `aria-labelledby`, else the Field label
   */
  'aria-label'?: string;
  /** Ids of the elements that name the listbox (see `aria-label`). */
  'aria-labelledby'?: string;
  /** Merged last onto the `role="listbox"` element (a `max-h-*` replaces the default height). */
  className?: string;
  ref?: React.Ref<HTMLUListElement>;
}

interface ListImplProps extends TagPickerListProps {
  ctx: TagPickerContextValue;
}

function TagPickerListImpl({
  ctx,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  className,
  ref,
  ...rest
}: ListImplProps) {
  const { registerList, listbox } = ctx;
  React.useLayoutEffect(() => registerList(), [registerList]);

  const createLabel = ctx.showCreate ? ctx.labels.create(ctx.createText) : '';
  const createOption = ctx.showCreate ? (
    <Option
      key={ctx.createValue}
      value={ctx.createValue}
      label={createLabel}
      data-create=""
      className={cn(tagPickerClassNames.option, tagPickerClassNames.createOption)}
    >
      {createLabel}
    </Option>
  ) : null;

  let content: React.ReactNode;
  if (ctx.dataMode) {
    // Data mode (0.10's rendering): an option per listed entry while expanded, the create option
    // in its place, last.
    content =
      ctx.expanded &&
      listbox.items.map((item) => {
        if (item.value === ctx.createValue) return createOption;
        const entry = ctx.entryOf(item.value);
        return (
          <TagPickerOption
            key={item.value}
            value={item.value}
            label={item.label}
            media={entry?.media}
            secondaryContent={entry?.secondaryContent}
            className={tagPickerClassNames.option}
          >
            {item.label}
          </TagPickerOption>
        );
      });
  } else {
    // Registration mode: the consumer's options, then the create option after every option and
    // group.
    content = (
      <>
        {children}
        {createOption}
      </>
    );
  }

  const ownName = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  return (
    <ListboxSurface
      listbox={listbox}
      layerId={ctx.layerId}
      surfaceRef={ctx.surfaceRef}
      floatingProps={ctx.floatingProps}
      open={ctx.open}
      expanded={ctx.expanded}
      showCheck={false}
      listClassName={cn(tagPickerListClassNames.root, tagPickerClassNames.listbox, className)}
      surfaceClassName={tagPickerClassNames.surface}
      emptyContent={
        ctx.emptyContent ? (
          <div
            aria-hidden="true"
            className={cn(
              tagPickerClassNames.emptyMessage,
              'px-3 py-1.5 text-body-1 text-muted-foreground',
            )}
          >
            {ctx.labels.noMatches}
          </div>
        ) : undefined
      }
      aria-label={ownName ? ariaLabel : ctx.listLabel['aria-label']}
      aria-labelledby={ownName ? ariaLabelledBy : ctx.listLabel['aria-labelledby']}
      listProps={{ ...rest, ref }}
    >
      {content}
    </ListboxSurface>
  );
}
TagPickerListImpl.displayName = 'TagPickerListImpl';

/**
 * The option list of a TagPicker (`TagPicker.List`): a `<ul role="listbox">`, multi-selectable,
 * that opens in a popup below the field. Render it directly inside TagPicker (a Fragment is fine);
 * without one TagPicker adds the default list. Without children it renders a `TagPicker.Option`
 * per available entry of TagPicker's `options`. With children (`TagPicker.Option`s, `Option`s,
 * `TagPicker.OptionGroup`s) they are the options: keep the options of selected values rendered,
 * since TagPicker hides them and reads their labels. Its own `aria-label`/`aria-labelledby`
 * replace the list's name (TagPicker's, else the Field label); its `className` comes last on the
 * list, its other attributes and `ref` reach the list element.
 */
export const TagPickerList = (props: TagPickerListProps) => {
  const ctx = useTagPickerContext('TagPicker.List');
  if (!ctx) return null;
  return <TagPickerListImpl {...props} ctx={ctx} />;
};
TagPickerList.displayName = 'TagPickerList';

/* ------------------------------------------------------------------ */
/*  TagPicker.OptionGroup                                              */
/* ------------------------------------------------------------------ */

/**
 * A group of options in TagPicker's list (`TagPicker.OptionGroup`): `OptionGroup` itself, with a
 * heading that names it. It hides itself while every option in it is hidden, so a group whose
 * options are all selected disappears.
 */
export const TagPickerOptionGroup = OptionGroup;
