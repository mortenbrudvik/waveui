import * as React from 'react';
import { getElementType, isElementOfType } from '../../lib/children';
import { searchBoxClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { DismissIcon, SearchIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import { mergeProps } from '../../lib/mergeProps';
import {
  materialiseSlotContent,
  renderSlot,
  resolveSlot,
  resolveWiredSlot,
  slotRendersContent,
  slotWrapsDefaultContent,
} from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import {
  focusRing,
  hitAreaLayer,
  inputAppearanceClasses,
  inputFocusWithin,
  inputHeightClasses,
  inputInvalidWithin,
  inputTextClasses,
} from '../../lib/styles';
import type { CoreSize, InputAppearance, Slot } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { fieldLocks, useFieldControl } from '../../hooks/useFieldControl';
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
import { useInputLook } from './inputLook';

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
   * Size of the field: `small` (24px tall), `medium` (32px) or `large` (40px). Default: the
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`.
   */
  size?: CoreSize;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
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
   * as on the Button (nothing is cleared), and `appearance` and `size` are ignored.
   *
   * A slot object is the content element, not the button: its attributes, event handlers
   * included, go to that element (only the naming attributes below reach the button), so handle
   * the press in `onClear`. A slot object whose `as` is a `<button>` or a Wave `Button` cannot
   * render inside the button: its children render as the content (the default icon when it has
   * none) and its props are dropped, with a development warning.
   *
   * Name (WCAG 2.5.3 Label in Name): content is decorative (`aria-hidden`), so the button keeps
   * the name "Clear search". An `aria-label`, `aria-labelledby` or `title` on the merged button or
   * on a slot object names the button instead (`{ children: 'Reset', 'aria-label': 'Reset' }`).
   * The children of a merged `<button>`/`Button` are rendered as is:
   * when they render a text label (at least two letters or digits outside `aria-hidden`/`hidden`
   * content, text from components such as translations included), that text names the button;
   * an icon or a lone character (`X`, `×`) keeps "Clear search". Text hidden only with CSS still
   * counts as the label, so give a button with a responsive label an explicit `aria-label`.
   */
  dismiss?: Slot<'span'>;
  /**
   * Ref to the `<input type="search">`, the focusable control (Fluent UI's `ref`, on its primary
   * element). The root `<div>` is `slotProps.root.ref`.
   */
  ref?: React.Ref<HTMLInputElement>;
  /**
   * Props for the elements the SearchBox draws, by part, merged into each part's own (Fluent UI's
   * `root`, `input` and `dismiss` slot props): your classes after the part's (yours win a
   * conflict), your styles over its styles, your handlers before its handlers (`preventDefault()`
   * in yours skips the SearchBox's handling of the event, its own `on…` prop included), your ref
   * beside its ref, and your ids added to its `aria-labelledby` and `aria-describedby`. Every
   * attribute the SearchBox sets on a part is locked and keeps the SearchBox's value (set it
   * through its own props); you add the attributes it does not set. A part takes no `children`
   * (`dismiss` fills the clear button).
   */
  slotProps?: {
    /**
     * The root `<div>` that draws the field around the icon (or `contentBefore`), the input,
     * `contentAfter` and the clear button (stable class `wave-search-box`), which the SearchBox's
     * `className`, `style`, `data-*` and other root props reach as well; its `ref` is the way to
     * the root, since the SearchBox's `ref` reaches the input. Your classes come after the
     * SearchBox's `className`, your style over its `style`. Locked: every prop you give the
     * SearchBox itself that reaches the root, `data-size`, `data-appearance`, and `hidden`,
     * `inert` and `aria-hidden` (the SearchBox's own: the root holds the input). Your handlers
     * run before the SearchBox's own root handlers: `preventDefault()` in your `onMouseDown`
     * skips the SearchBox's `onMouseDown` and the press that moves focus to the input. The root
     * passes no click to the input, so your `onClick` is called in every state, as the
     * SearchBox's own `onClick` is.
     */
    root?: SlotPart<'div'>;
    /**
     * The `<input type="search">`, the focusable control (stable class `wave-search-box__input`;
     * the SearchBox's `ref` reaches it as well). Locked: `type`, `value` (and, unset,
     * `defaultValue`: the SearchBox controls the text), `id`, the naming and Field attributes
     * (`aria-label`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`),
     * `required`, `disabled`, `placeholder`, every input prop routed to it (`name`, `form`,
     * `readOnly`, `tabIndex`, `maxLength`, …), `hidden`, `inert` and `aria-hidden` (a focusable
     * control is never hidden). Your handlers run before the SearchBox's: `preventDefault()` in
     * your `onChange` ignores the typed text, in your `onKeyDown` keeps the text on Escape.
     */
    input?: SlotPart<'input'>;
    /**
     * The clear `<button>`, rendered while there is text and the SearchBox is not read-only
     * (stable class `wave-search-box__dismiss-button`; `dismiss` fills its content). Locked:
     * `type`, `disabled`, `tabIndex`, `hidden`, `inert`, `aria-hidden`, its name (`aria-label`,
     * "Clear search" unless `dismiss` names it) and the attributes of a merged Button's
     * `disabledFocusable`. A `<button>` or `Button` passed as `dismiss` reaches this button too:
     * its other attributes are the defaults these props replace (yours win), its classes come
     * before yours, and its handlers run after yours. Your `onClick` runs before the clear
     * (`preventDefault()` skips it) and is not called while the button is unavailable but
     * focusable.
     */
    dismissButton?: SlotPart<'button'>;
  };
}

/** Per-size metrics of SearchBox (medium is the 0.7 look). */
const SEARCH_SIZE: Readonly<
  Record<CoreSize, { before: string; after: string; input: string; clear: string; glyph: number }>
> = {
  small: { before: 'ps-1.5', after: 'pe-1.5', input: 'px-1.5', clear: 'size-5', glyph: 12 },
  medium: { before: 'ps-2', after: 'pe-2', input: 'px-2', clear: 'h-6 w-6', glyph: 16 },
  large: { before: 'ps-3', after: 'pe-3', input: 'px-3', clear: 'size-8', glyph: 20 },
};

type UnknownProps = Record<string, unknown>;

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
   * element (merged); `unwrapped`: a slot object whose `as` is a button (its children are the
   * content, its props dropped).
   */
  kind: 'default' | 'content' | 'element' | 'unwrapped';
  /** Props merged onto the built-in clear button. */
  buttonProps: UnknownProps;
  /** Content of the clear button (`null` = the default icon, except for `content`). */
  content: React.ReactNode;
  /**
   * `true` when the content is rendered as is (a merged `<button>`/`Button`), so a text label in
   * it names the button (C-SLOTS naming, WCAG 2.5.3); `false` when the content is decorative
   * (`aria-hidden`).
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
 * Splits the props of a `<button>` or Wave `Button` element into button props and content. The
 * content is rendered as is, so a text label in it names the button (C-SLOTS naming). Content
 * that renders nothing is `null` (the default icon); a generator is read once and rendered as its
 * items.
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
    const iconNode = renderSlot(
      props.icon as Slot<'span'>,
      'span',
      cn(searchBoxClassNames.dismissIcon, 'inline-flex'),
      { 'aria-hidden': true },
    );
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
  const { children: _children, ...buttonProps } = props;
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
function resolveDismiss(dismiss: SearchBoxProps['dismiss'], size: CoreSize): DismissParts {
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
  // A render function is resolved with a button `as` (it renders the content), or dropped when it
  // renders nothing.
  const resolved = resolveWiredSlot(resolveSlot(dismiss as Slot<'span'>, 'span'), isButtonType);
  if (!resolved) return DEFAULT_DISMISS;
  const { children } = resolved;
  // A slot object whose `as` is a button cannot render inside the clear button: it is unwrapped,
  // so its children are the content of a span and its props are dropped.
  const unwrapped = isButtonType(resolved.Component);
  const kind = unwrapped ? 'unwrapped' : 'content';
  const Component: React.ElementType = unwrapped ? 'span' : resolved.Component;
  const buttonProps: UnknownProps = {};
  const contentProps: UnknownProps = {};
  for (const [key, value] of Object.entries(unwrapped ? {} : resolved.props)) {
    // resolveSlot sets `className: undefined` when there are no classes.
    if (value === undefined) continue;
    // The content is aria-hidden, so a naming attribute names the clear button instead.
    (NAMING_KEYS.has(key) ? buttonProps : contentProps)[key] = value;
  }
  // A void (`img`), component (`{ as: MyIcon }`) or markup (`dangerouslySetInnerHTML`) slot
  // renders content of its own.
  const hasChildren = slotRendersContent(children);
  const empty = slotWrapsDefaultContent(Component, { ...contentProps, children });
  if (empty && Object.keys(buttonProps).length === 0 && Object.keys(contentProps).length === 0) {
    return unwrapped ? { ...DEFAULT_DISMISS, kind } : DEFAULT_DISMISS;
  }
  // A content object without children (`{ className }`, `{ 'aria-label': 'Reset' }`) keeps the
  // default icon inside the object's own element (its className/style/attributes still apply).
  // Markup of its own takes no children at all.
  const contentChildren = empty ? (
    <DismissIcon size={SEARCH_SIZE[size].glyph} />
  ) : hasChildren ? (
    children
  ) : undefined;
  // The element the slot renders carries the dismissIcon part class, before the slot's own.
  const iconProps = {
    'aria-hidden': true,
    ...contentProps,
    className: cn(searchBoxClassNames.dismissIcon, contentProps.className as string | undefined),
  };
  const content =
    contentChildren === undefined
      ? React.createElement(Component, iconProps)
      : React.createElement(Component, iconProps, contentChildren);
  return {
    kind,
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
 * - **Routing**: `ref`, `id`, ARIA and native input attributes and the focus/keyboard handlers
 *   go to the `<input type="search">` (role `searchbox`); `className`, `style`, `data-*` and other
 *   handlers stay on the root `<div>` (`slotProps.root.ref` reaches it). Inside a `Field` it picks
 *   up the label, hint, error and required state automatically.
 * - **Forms**: with `name` the text is submitted with the form; a form reset restores
 *   `defaultValue`.
 * - **Size and appearance**: `size` resolves from its own prop, then the surrounding `Field`'s
 *   `size`, then `WaveProvider inputDefaults.size`, else `'medium'`; `appearance` from its own
 *   prop, then `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as
 *   `data-size` and `data-appearance` on the root `<div>`.
 *
 * @example
 * <SearchBox aria-label="Search files" value={query} onValueChange={setQuery} />
 */
export const SearchBox = ({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  onClear,
  placeholder = 'Search',
  disabled,
  size: sizeProp,
  appearance: appearanceProp,
  contentBefore,
  contentAfter,
  dismiss,
  className,
  style,
  ref,
  slotProps,
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
  const [value, setValue] = useControllable(controlledValue, defaultValue, onValueChange);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(inputRef, ref, slotProps?.input?.ref);
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
  const { size, appearance } = useInputLook(sizeProp, appearanceProp);

  const dismissParts = resolveDismiss(dismiss, size);
  const dismissKind = dismissParts.kind;
  React.useEffect(() => {
    if (dismissKind === 'element') {
      warnOnce(
        'SearchBox:dismiss-button-element',
        'SearchBox: `dismiss` received a button element; its props were merged into the built-in clear button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<MyIcon />}`.',
      );
    } else if (dismissKind === 'unwrapped') {
      warnOnce(
        'SearchBox:dismiss-button-slot-object',
        'SearchBox: `dismiss` received a slot object that renders a button; its children render inside the built-in clear button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<MyIcon />}`.',
      );
    }
  }, [dismissKind]);

  // An event callback, so the part props merged during render hold no function that reads a ref.
  const handleClear = useEventCallback(() => {
    setValue('');
    onClear?.();
    inputRef.current?.focus();
  });

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
  // the input, as it does in a native search field. A control inside a slot keeps its press. An
  // event callback, so the root part's props merged during render hold no function that reads a
  // ref.
  const handleRootMouseDown = useEventCallback((event: React.MouseEvent<HTMLDivElement>) => {
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
  });

  // The slot's onClick runs before the clear (preventDefault() cancels it). The slot's ref joins
  // ours through a stable merged ref (never a new callback per render).
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
    slotProps?.dismissButton?.ref,
  );

  const clearButtonProps = mergeProps(
    {
      type: 'button',
      disabled,
      'aria-label': hasOwnName || namedByContent ? undefined : DEFAULT_CLEAR_LABEL,
      className: cn(
        searchBoxClassNames.dismissButton,
        // Padding and background set here (C-NATIVE): an app-wide `button` rule cannot fill it.
        'me-1 flex shrink-0 items-center justify-center rounded bg-transparent p-0 text-muted-foreground',
        SEARCH_SIZE[size].clear,
        // hitAreaLayer needs a positioned element: unlike the picker buttons, the small clear
        // button sits in the row without its own position, so it sets one here.
        size === 'small' && cn('relative', hitAreaLayer),
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
        : (dismissParts.content ?? (
            <DismissIcon
              size={SEARCH_SIZE[size].glyph}
              className={searchBoxClassNames.dismissIcon}
            />
          ));
  // The props a `dismiss` button (a `<button>` or `Button` element) merged into the clear button
  // are the defaults of its part: `slotProps.dismissButton` replaces them, its handlers run first
  // and its classes come last. The type, the disabled state, the tab stop, the visibility, the
  // name and the clear stay locked, at the values the two give together.
  const {
    className: clearClassName,
    style: clearStyle,
    type: clearType,
    disabled: clearDisabled,
    ...clearDefaults
  } = clearButtonProps as UnknownProps;
  const clearPartProps = mergeSlotProps(slotProps?.dismissButton, {
    className: clearClassName as string | undefined,
    style: clearStyle as React.CSSProperties | undefined,
    defaults: clearDefaults,
    locked: {
      // mergeProps keeps a slot's `type: null`, which would drop the attribute and make the
      // button submit its form; only nullish falls back (an explicit type is kept).
      type: clearType ?? 'button',
      disabled: disabled || (clearDisabled as boolean | undefined),
      'aria-label': clearDefaults['aria-label'],
      tabIndex: clearDefaults.tabIndex,
      'aria-disabled': clearDefaults['aria-disabled'],
      'data-disabled': clearDefaults['data-disabled'],
      'data-disabled-focusable': clearDefaults['data-disabled-focusable'],
      hidden: clearDefaults.hidden,
      inert: clearDefaults.inert,
      'aria-hidden': clearDefaults['aria-hidden'],
      onClick: composeEventHandlers(slotOnClick, handleClear),
      // A merged `disabledFocusable` Button makes the clear button unavailable but focusable
      // (last: it wins over `disabled` and the clear handler).
      ...(dismissParts.disabledFocusable ? MERGED_DISABLED_FOCUSABLE_PROPS : undefined),
    },
    // Unavailable but focusable, the button calls no click handler, yours included.
    blockHandlers: dismissParts.disabledFocusable ? ['onClick'] : undefined,
  });
  // A slot value that renders nothing is no slot (the default icon before the text, no box after).
  const hasBefore = slotRendersContent(contentBefore);
  const hasAfter = slotRendersContent(contentAfter);

  const rootProps = mergeSlotProps(slotProps?.root, {
    className: cn(
      searchBoxClassNames.root,
      // The root draws the field; the slots, the text and the clear button are laid out side by
      // side inside it, so a slot never covers the text.
      'relative inline-flex w-full items-center',
      inputHeightClasses[size],
      inputTextClasses[size],
      inputAppearanceClasses[appearance],
      'text-foreground',
      inputFocusWithin,
      invalidLook && inputInvalidWithin,
      // The dimmed look lifts while a focus ring shows inside the root (a clear button kept
      // focusable by a merged `disabledFocusable` Button, focusable slot content; the disabled
      // input never takes focus): opacity would dim the ring below 3:1.
      disabled && 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100',
      className,
    ),
    style,
    locked: {
      'data-size': size,
      'data-appearance': appearance,
      // The SearchBox's own root props, after the data attributes as in 0.18, and over the
      // part's; the root holds the input, so only they hide it or take it out of reach.
      ...rest,
      hidden,
      inert: rest.inert,
      'aria-hidden': rest['aria-hidden'],
      // After a part's onMouseDown, whose preventDefault() skips both.
      onMouseDown: composeEventHandlers(onMouseDown, handleRootMouseDown),
    },
  });

  return (
    <div {...rootProps}>
      <span
        className={cn(
          searchBoxClassNames.contentBefore,
          'flex shrink-0 items-center',
          SEARCH_SIZE[size].before,
        )}
      >
        {hasBefore ? (
          renderSlot(contentBefore, 'span', 'shrink-0')
        ) : (
          <SearchIcon size={SEARCH_SIZE[size].glyph} className="text-muted-foreground" />
        )}
      </span>

      <input
        {...mergeSlotProps(slotProps?.input, {
          className: cn(
            searchBoxClassNames.input,
            'h-full min-w-0 flex-1 appearance-none border-none bg-transparent text-foreground',
            SEARCH_SIZE[size].input,
            inputTextClasses[size],
            'placeholder:text-muted-foreground',
            'focus:outline-hidden',
            'disabled:cursor-not-allowed',
            '[&::-webkit-search-cancel-button]:hidden',
          ),
          locked: {
            type: 'search',
            value,
            // Controlled: a part's default value would only make React warn.
            defaultValue: undefined,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
            placeholder,
            disabled,
            'aria-errormessage': ariaErrorMessage,
            'aria-details': ariaDetails,
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
            onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown),
            onKeyUp,
            ...fieldProps,
            // The routed naming and Field attributes, set only through the SearchBox's own props.
            ...fieldLocks(fieldProps),
            // A focusable control is never hidden (the root takes the SearchBox's `hidden`).
            hidden: undefined,
            inert: undefined,
            'aria-hidden': undefined,
          },
        })}
        ref={mergedInputRef}
      />

      {hasAfter && (
        <span
          className={cn(
            searchBoxClassNames.contentAfter,
            'flex shrink-0 items-center',
            SEARCH_SIZE[size].after,
          )}
        >
          {renderSlot(contentAfter, 'span', 'shrink-0')}
        </span>
      )}

      {/* No clear button while read-only: clearing would change a value the user cannot edit. */}
      {value && !readOnly ? (
        <button
          // The literal marks C-BUTTON-TYPE; the merged props lock the type (a part cannot change
          // it).
          type="button"
          {...clearPartProps}
          ref={clearRef}
        >
          {clearContent}
        </button>
      ) : null}
    </div>
  );
};

SearchBox.displayName = 'SearchBox';
