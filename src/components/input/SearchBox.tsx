import * as React from 'react';
import { getElementType, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { DismissIcon, SearchIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import { mergeProps } from '../../lib/mergeProps';
import {
  materialiseSlotContent,
  renderSlot,
  resolveSlot,
  slotRendersContent,
  slotWrapsDefaultContent,
} from '../../lib/slot';
import { focusRing, inputFocusWithin, inputInvalidWithin } from '../../lib/styles';
import type { Slot, SlotObject } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { Button } from '../button/Button';
import {
  BUTTON_OWN_PROP_KEYS,
  MERGED_DISABLED_FOCUSABLE_PROPS,
  mergedAriaDisabledClasses,
  placeButtonIcon,
} from '../button/Button.slots';
import { isInvalidLook } from './Input';

/**
 * Props that SearchBox routes to its `<input>` (C-ROUTING): the id, the ARIA naming/validation
 * attributes, native text-input attributes and the focus/keyboard handlers.
 */
export type SearchBoxInputProps = Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'id'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-describedby'
  | 'aria-invalid'
  | 'aria-required'
  | 'aria-errormessage'
  | 'aria-details'
  | 'name'
  | 'form'
  | 'required'
  | 'readOnly'
  | 'autoComplete'
  | 'autoFocus'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'inputMode'
  | 'enterKeyHint'
  | 'spellCheck'
  | 'maxLength'
  | 'minLength'
  | 'pattern'
  | 'tabIndex'
  | 'onFocus'
  | 'onBlur'
  | 'onKeyDown'
  | 'onKeyUp'
>;

/** Properties for the SearchBox component. */
export interface SearchBoxProps
  extends
    Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'onChange' | 'defaultValue' | keyof SearchBoxInputProps
    >,
    SearchBoxInputProps {
  /** Controlled search text value. */
  value?: string;
  /** Initial search text for uncontrolled usage (also what a form reset restores).
   * @default ''
   */
  defaultValue?: string;
  /** Called with the new search text when it changes (typing or clearing). */
  onValueChange?: (value: string) => void;
  /**
   * Called with the new search text when it changes.
   * @deprecated Use `onValueChange`. (`onChange` is reserved for native change events.)
   */
  onChange?: (value: string) => void;
  /**
   * Called when the user clears the search: with the clear button, or with Escape while there is
   * text (after `onValueChange('')`).
   */
  onClear?: () => void;
  /** Placeholder text shown when the input is empty.
   * @default 'Search'
   */
  placeholder?: string;
  /** Whether the search box is disabled and non-interactive. */
  disabled?: boolean;
  /**
   * Slot rendered before the text (replaces the default search icon). It takes the room it needs;
   * the text starts after it. A value that renders nothing (`null`, `false`, `''`, an empty array
   * or Fragment) keeps the default icon.
   */
  contentBefore?: Slot<'span'>;
  /**
   * Slot rendered after the text, before the clear button. It takes the room it needs; the text
   * ends before it. A value that renders nothing (`false`, `''`, an empty array or Fragment) is no
   * slot: nothing takes room.
   */
  contentAfter?: Slot<'span'>;
  /**
   * Content of the clear button (replaces the default dismiss icon). It always renders **inside**
   * the built-in `<button type="button" aria-label="Clear search">`, which clears the value, calls
   * `onClear` and moves focus back to the input. The slot cannot hide the clear button or leave
   * it empty: content that renders nothing (`null`, `false`, `true`, `''`, or an array, `Set`,
   * generator or Fragment of only those) keeps the default icon, and a slot object without
   * children (`{ className: 'text-error' }`) wraps the default icon in its element (not when it
   * brings markup of its own through `dangerouslySetInnerHTML`, or is a void or component element).
   *
   * A `<button>` element or a Wave `Button` passed here is not nested: its props are merged into
   * the built-in button (its `onClick` runs first; `preventDefault()` cancels the clear) and its
   * children become the content, with a development warning. A Wave `Button`'s own props are not
   * attributes: its `icon` becomes decorative content before its children (after them with
   * `iconPosition="after"`), `disabledFocusable` makes the clear button unavailable but focusable
   * as on the Button (nothing is cleared), and `appearance` and `size` are ignored. The 0.4
   * button-object form (`{ as: 'button', onClick, … }` or an object with button props) is
   * **deprecated**: its button props are merged the same way. Pass icon content instead.
   *
   * Name (WCAG 2.5.3 Label in Name): content is decorative (`aria-hidden`), so the button keeps
   * the name "Clear search". An `aria-label`, `aria-labelledby` or `title` on the merged button or
   * on a slot object names the button instead (`{ children: 'Reset', 'aria-label': 'Reset' }`).
   * The children of a merged `<button>`/`Button` (or of `{ as: 'button' }`) are rendered as is:
   * when they render a text label (at least two letters or digits outside `aria-hidden`/`hidden`
   * content, text from components such as translations included), that text names the button;
   * an icon or a lone character (`X`, `×`) keeps "Clear search". Text hidden only with CSS still
   * counts as the label, so give a button with a responsive label an explicit `aria-label`.
   */
  dismiss?: Slot<'span'> | SlotObject<'button'>;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
  /** Ref to the `<input type="search">` (the focusable control). */
  controlRef?: React.Ref<HTMLInputElement>;
}

type UnknownProps = Record<string, unknown>;

/** Attributes that only make sense on the clear `<button>` itself (merged onto it). */
const BUTTON_ONLY_KEYS: ReadonlySet<string> = new Set([
  'type',
  'disabled',
  'form',
  'formAction',
  'formEncType',
  'formMethod',
  'formNoValidate',
  'formTarget',
  'name',
  'value',
  'popoverTarget',
  'popoverTargetAction',
]);
const HANDLER_KEY = /^on[A-Z]/;

/**
 * Attributes that name the clear button (C-SLOTS naming). On a merged button or a slot object they
 * go to the clear button (slot content is `aria-hidden`), and any of them replaces the default
 * `aria-label`.
 */
const NAMING_KEYS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title']);

/** Default name of the clear button. */
const DEFAULT_CLEAR_LABEL = 'Clear search';

interface DismissParts {
  /**
   * `default`: no slot (default icon); `content`: icon content; `element`: a `<button>`/`Button`
   * element; `button-object`: the deprecated button-object form.
   */
  kind: 'default' | 'content' | 'element' | 'button-object';
  /** Props merged onto the built-in clear button. */
  buttonProps: UnknownProps;
  /** Content of the clear button (`null` = the default icon, except for `content`). */
  content: React.ReactNode;
  /**
   * `true` when the content is rendered as is (a merged `<button>`/`Button` or `{ as: 'button' }`),
   * so a text label in it names the button (C-SLOTS naming, WCAG 2.5.3); `false` when the content
   * is decorative (`aria-hidden`).
   */
  contentMayName: boolean;
  /**
   * Whether the literal children contain a text label: the name for the server render and the
   * first client render. After mount the rendered button's text decides.
   */
  literalTextLabel: boolean;
  /**
   * Whether a merged Wave `Button` set `disabledFocusable`: the clear button is then unavailable
   * but focusable, as the Button would be.
   */
  disabledFocusable: boolean;
}

const noop = () => {};

/**
 * Elements inside the field that keep a press to themselves: a control in a slot, the clear
 * button.
 */
const INTERACTIVE_CONTENT =
  'a[href], button, input, select, textarea, [tabindex], [contenteditable]:not([contenteditable="false"])';

const DEFAULT_DISMISS: DismissParts = {
  kind: 'default',
  buttonProps: {},
  content: null,
  contentMayName: false,
  literalTextLabel: false,
  disabledFocusable: false,
};

function isButtonType(type: unknown): boolean {
  return type === 'button' || type === Button;
}

/**
 * Splits the props of a button-like element or object into button props and content. The content
 * is rendered as is, so a text label in it names the button (C-SLOTS naming). Content that renders
 * nothing is `null` (the default icon); a generator is read once and rendered as its items.
 */
function splitButtonLike(type: unknown, props: UnknownProps, children: React.ReactNode) {
  const hasChildren = slotRendersContent(children);
  const content = materialiseSlotContent(children);
  const literalTextLabel = hasTextLabel(content);
  if (type === Button) {
    // Wave Button's own props do not belong on a native <button>: its icon becomes content (after
    // the children with `iconPosition="after"`) and `disabledFocusable` is applied by the caller.
    const buttonProps: UnknownProps = {};
    for (const [key, value] of Object.entries(props)) {
      if (key !== 'children' && !BUTTON_OWN_PROP_KEYS.has(key)) buttonProps[key] = value;
    }
    const iconNode = renderSlot(props.icon as Slot<'span'>, 'span', 'inline-flex', {
      'aria-hidden': true,
    });
    const buttonContent =
      iconNode || hasChildren ? placeButtonIcon(iconNode, content, props.iconPosition) : null;
    return {
      buttonProps,
      content: buttonContent,
      contentMayName: true,
      literalTextLabel,
      disabledFocusable: Boolean(props.disabledFocusable),
    };
  }
  const { as, children: _children, ...buttonProps } = props;
  // `null` content falls back to the default icon.
  return {
    buttonProps,
    content: hasChildren ? content : null,
    contentMayName: true,
    literalTextLabel,
    disabledFocusable: false,
  };
}

/**
 * Splits `dismiss` into the props merged onto the built-in clear button and its content. Content
 * that renders nothing (`slotRendersContent`) never leaves the button empty: without other props
 * it is the default icon; a slot object with its own content props (`className`, `style`, …)
 * wraps the default icon in its element.
 */
function resolveDismiss(dismiss: SearchBoxProps['dismiss']): DismissParts {
  // The type is unwrapped (C-COMPOUND): a Button written in a Server Component arrives as a lazy
  // client reference, and must be merged like a plain one rather than nested inside the clear
  // button. A slot object is never an element, so the check can take any slot value as a node.
  const node = dismiss as React.ReactNode;
  if (isElementOfType<UnknownProps>(node, 'button', Button)) {
    const children = node.props.children as React.ReactNode;
    return {
      kind: 'element',
      ...splitButtonLike(getElementType(node), node.props, children),
    };
  }
  // Resolved once: a generator is materialised (and cached) by resolveSlot, so it can be checked
  // for emptiness and rendered without being consumed twice.
  const resolved = resolveSlot(dismiss as Slot<'span'>, 'span');
  if (!resolved) return DEFAULT_DISMISS;
  const { Component, props, children } = resolved;
  if (isButtonType(Component)) {
    return { kind: 'button-object', ...splitButtonLike(Component, props, children) };
  }
  const buttonProps: UnknownProps = {};
  const contentProps: UnknownProps = {};
  let hasButtonProps = false;
  for (const [key, value] of Object.entries(props)) {
    // resolveSlot sets `className: undefined` when there are no classes.
    if (value === undefined) continue;
    if (BUTTON_ONLY_KEYS.has(key) || HANDLER_KEY.test(key)) {
      buttonProps[key] = value;
      hasButtonProps = true;
    } else if (NAMING_KEYS.has(key)) {
      // The content is aria-hidden, so a naming attribute names the clear button instead (not the
      // deprecated button-object form).
      buttonProps[key] = value;
    } else {
      contentProps[key] = value;
    }
  }
  // A void (`img`), component (`{ as: MyIcon }`) or markup (`dangerouslySetInnerHTML`) slot
  // renders content of its own.
  const hasChildren = slotRendersContent(children);
  const empty = slotWrapsDefaultContent(Component, { ...contentProps, children });
  if (empty && Object.keys(buttonProps).length === 0 && Object.keys(contentProps).length === 0) {
    return DEFAULT_DISMISS;
  }
  // A button object without content (`{ onClick }`, `{ type: 'button' }`) or a content object
  // without children (`{ className }`) keeps the default icon inside the object's own element (its
  // className/style/attributes still apply). Markup of its own takes no children at all.
  const contentChildren = empty ? <DismissIcon /> : hasChildren ? children : undefined;
  const content =
    contentChildren === undefined
      ? React.createElement(Component, { 'aria-hidden': true, ...contentProps })
      : React.createElement(Component, { 'aria-hidden': true, ...contentProps }, contentChildren);
  return {
    kind: hasButtonProps ? 'button-object' : 'content',
    buttonProps,
    content,
    contentMayName: false,
    literalTextLabel: false,
    disabledFocusable: false,
  };
}

/**
 * A search input with a leading search icon and a clear button that appears while there is text
 * (not while `readOnly`).
 *
 * - **Layout**: the root `<div>` draws the field (its outline, focus and invalid look). The icon
 *   (or `contentBefore`), the text, `contentAfter` and the clear button sit side by side in it, so
 *   no slot covers the text. Pressing the field outside a control of its own focuses the input.
 * - **Clearing**: the clear button clears the text and moves focus back to the input. Escape
 *   clears the text too while there is any, and is then consumed, so an enclosing Dialog, Drawer
 *   or Popover stays open; in an empty field Escape reaches them. Both call `onClear`.
 * - **Routing**: `id`, ARIA and native input attributes and the focus/keyboard handlers go to the
 *   `<input type="search">` (role `searchbox`); `className`, `style`, `data-*`, other handlers and
 *   `ref` stay on the root `<div>` (`controlRef` reaches the input). Inside a `Field` it picks up
 *   the label, hint, error and required state automatically.
 * - **Forms**: with `name` the text is submitted with the form; a form reset restores
 *   `defaultValue`.
 *
 * @example
 * <SearchBox aria-label="Search files" value={query} onValueChange={setQuery} />
 */
export const SearchBox = ({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  onChange,
  onClear,
  placeholder = 'Search',
  disabled,
  contentBefore,
  contentAfter,
  dismiss,
  className,
  ref,
  controlRef,
  // Routed to the input (C-ROUTING)
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  required,
  name,
  form,
  readOnly,
  autoComplete,
  autoFocus,
  autoCapitalize,
  autoCorrect,
  inputMode,
  enterKeyHint,
  spellCheck,
  maxLength,
  minLength,
  pattern,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  onMouseDown,
  hidden,
  ...rest
}: SearchBoxProps) => {
  if (onChange !== undefined) warnDeprecated('SearchBox', 'onChange', 'onValueChange');

  const [value, setValue] = useControllable(controlledValue, defaultValue, (next: string) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(inputRef, controlRef);
  // The input is always React-controlled, so the browser's own reset would put the current text
  // back: restore the default here instead (C-FORMS).
  useFormReset(inputRef, () => setValue(defaultValue), form);

  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-required': ariaRequired,
      required,
    },
    { nativeRequired: true },
  );
  const invalidLook = isInvalidLook(false, fieldProps['aria-invalid']);

  const dismissParts = resolveDismiss(dismiss);
  const dismissKind = dismissParts.kind;
  React.useEffect(() => {
    if (dismissKind === 'element') {
      warnOnce(
        'SearchBox:dismiss-button-element',
        'SearchBox: `dismiss` received a button element; its props were merged into the built-in clear button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<MyIcon />}`.',
      );
    } else if (dismissKind === 'button-object') {
      warnOnce(
        'SearchBox:dismiss-button-object',
        'SearchBox: `dismiss` with button props (`as: "button"`, `onClick`, `type`, …) is deprecated and will be removed in 1.0; the props were merged into the built-in clear button. Pass icon content instead, e.g. `dismiss={<MyIcon />}`.',
      );
    }
  }, [dismissKind]);

  const handleClear = () => {
    setValue('');
    onClear?.();
    inputRef.current?.focus();
  };

  // Escape clears the text first, as native search fields do, and is consumed so an enclosing
  // Dialog, Drawer or Popover stays open; with an empty field it reaches them (C-POPUPS).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
    if (!value || readOnly || disabled) return;
    event.preventDefault();
    setValue('');
    onClear?.();
  };

  // The whole box is the field: pressing the icon, a slot or the padding around the text focuses
  // the input, as it does in a native search field. A control inside a slot keeps its press.
  const handleRootMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    const root = event.currentTarget;
    const target = event.target;
    if (!input || disabled || event.button !== 0 || target === input) return;
    // Events that bubble through React portals from outside this box are not ours (C-COMPOSE).
    if (!(target instanceof Element) || !root.contains(target)) return;
    const control = target.closest(INTERACTIVE_CONTENT);
    if (control && root.contains(control)) return;
    event.preventDefault(); // keeps the press from moving focus to the page
    input.focus();
  };

  // The slot's onClick is composed at click time (it runs first; preventDefault() cancels the
  // clear), so handleClear, which reads the input ref, is never passed to a render-time helper.
  // The slot's ref joins ours through a stable merged ref (never a new callback per render).
  const {
    onClick: slotOnClick,
    ref: slotRef,
    ...slotButtonProps
  } = dismissParts.buttonProps as UnknownProps & {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    ref?: React.Ref<HTMLButtonElement>;
  };

  // C-SLOTS naming (WCAG 2.5.3 Label in Name): a consumer naming attribute names the clear button;
  // otherwise content rendered as is names it when it has a text label, and the default
  // `aria-label` would hide that label. The literal children decide on the server and on the first
  // render; after mount, the rendered button's text does (text from components, later changes).
  const hasOwnName = Object.keys(slotButtonProps).some(
    (key) => NAMING_KEYS.has(key) && slotButtonProps[key] != null,
  );
  const checksContent = dismissParts.contentMayName && !hasOwnName;
  const literalTextLabel = dismissParts.literalTextLabel;
  const [labelTarget, setLabelTarget] = React.useState<HTMLButtonElement | null>(null);
  const subscribeToContent = React.useCallback(
    (onChange: () => void) => (labelTarget ? observeTextLabel(labelTarget, onChange) : noop),
    [labelTarget],
  );
  const contentHasTextLabel = React.useSyncExternalStore(
    subscribeToContent,
    () => (labelTarget ? hasRenderedTextLabel(labelTarget) : literalTextLabel),
    () => literalTextLabel,
  );
  const namedByContent = checksContent && contentHasTextLabel;
  const clearRef = useMergedRefs<HTMLButtonElement>(
    slotRef,
    checksContent ? setLabelTarget : undefined,
  );

  const clearButtonProps = mergeProps(
    {
      type: 'button',
      disabled,
      'aria-label': hasOwnName || namedByContent ? undefined : DEFAULT_CLEAR_LABEL,
      className: cn(
        // Padding and background set here (C-NATIVE): an app-wide `button` rule cannot fill it.
        'me-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-transparent p-0 text-muted-foreground',
        'not-disabled:not-aria-disabled:hover:text-foreground',
        focusRing,
        'disabled:cursor-not-allowed',
        mergedAriaDisabledClasses,
      ),
    },
    slotButtonProps,
  ) as React.ComponentPropsWithoutRef<'button'>;

  // A merged button with markup of its own (`dangerouslySetInnerHTML`) takes no children.
  const clearContent =
    clearButtonProps.dangerouslySetInnerHTML != null
      ? undefined
      : dismissKind === 'content'
        ? dismissParts.content
        : (dismissParts.content ?? <DismissIcon />);
  // A slot value that renders nothing is no slot (the default icon before the text, no box after).
  const hasBefore = slotRendersContent(contentBefore);
  const hasAfter = slotRendersContent(contentAfter);

  return (
    <div
      ref={ref}
      className={cn(
        // The root draws the field; the slots, the text and the clear button are laid out side by
        // side inside it, so a slot never covers the text.
        'relative inline-flex h-8 w-full items-center rounded border border-input border-b-stroke-accessible bg-background text-body-1 text-foreground',
        inputFocusWithin,
        invalidLook && inputInvalidWithin,
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      hidden={hidden}
      {...rest}
      // Composed at press time, like the clear button's click: the handler reads the input ref.
      onMouseDown={(event) => composeEventHandlers(onMouseDown, handleRootMouseDown)(event)}
    >
      <span className="flex shrink-0 items-center ps-2">
        {hasBefore ? (
          renderSlot(contentBefore, 'span', 'shrink-0')
        ) : (
          <SearchIcon className="text-muted-foreground" />
        )}
      </span>

      <input
        ref={mergedInputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'h-full min-w-0 flex-1 appearance-none border-none bg-transparent px-2 text-body-1 text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-hidden',
          'disabled:cursor-not-allowed',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        name={name}
        form={form}
        readOnly={readOnly}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        spellCheck={spellCheck}
        maxLength={maxLength}
        minLength={minLength}
        pattern={pattern}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onKeyUp={onKeyUp}
        {...fieldProps}
      />

      {hasAfter && (
        <span className="flex shrink-0 items-center pe-2">
          {renderSlot(contentAfter, 'span', 'shrink-0')}
        </span>
      )}

      {/* No clear button while read-only: clearing would change a value the user cannot edit. */}
      {value && !readOnly ? (
        <button
          {...clearButtonProps}
          ref={clearRef}
          // mergeProps keeps a slot's `type: null`, which would drop the attribute and make the
          // button submit its form; only nullish falls back (an explicit type is kept).
          type={clearButtonProps.type ?? 'button'}
          disabled={disabled || clearButtonProps.disabled}
          onClick={(event) => composeEventHandlers(slotOnClick, handleClear)(event)}
          // A merged `disabledFocusable` Button makes the clear button unavailable but focusable
          // (spread last: it wins over `disabled` and the clear handler).
          {...(dismissParts.disabledFocusable ? MERGED_DISABLED_FOCUSABLE_PROPS : undefined)}
        >
          {clearContent}
        </button>
      ) : null}
    </div>
  );
};

SearchBox.displayName = 'SearchBox';
