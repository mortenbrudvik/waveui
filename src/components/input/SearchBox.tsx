import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { DismissIcon, SearchIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import { mergeProps } from '../../lib/mergeProps';
import { renderSlot, resolveSlot, VOID_ELEMENTS } from '../../lib/slot';
import { focusRing, inputFocus } from '../../lib/styles';
import type { Slot, SlotObject } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useFieldControl } from '../../hooks/useFieldControl';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { Button } from '../button/Button';
import { isInvalidLook } from './Input';

/**
 * Props that SearchBox routes to its `<input>` (C-ROUTING): the id, the ARIA naming/validation
 * attributes, native text-input attributes and the focus/keyboard handlers.
 */
type SearchBoxInputProps = Pick<
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
  /** Initial search text for uncontrolled usage.
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
  /** Callback fired when the search is cleared with the clear button. */
  onClear?: () => void;
  /** Placeholder text shown when the input is empty.
   * @default 'Search'
   */
  placeholder?: string;
  /** Whether the search box is disabled and non-interactive. */
  disabled?: boolean;
  /** Slot rendered before the input (replaces the default search icon). */
  contentBefore?: Slot<'span'>;
  /** Slot rendered after the input text. */
  contentAfter?: Slot<'span'>;
  /**
   * Content of the clear button (replaces the default dismiss icon). It always renders **inside**
   * the built-in `<button type="button" aria-label="Clear search">`, which clears the value, calls
   * `onClear` and moves focus back to the input. The slot cannot hide the clear button or leave
   * it empty: content that renders nothing (`null`, `false`, `true`, `''`, or an array, `Set`,
   * generator or Fragment of only those) keeps the default icon, and a slot object without
   * children (`{ className: 'text-error' }`) wraps the default icon in its element.
   *
   * A `<button>` element or a Wave `Button` passed here is not nested: its props are merged into
   * the built-in button (its `onClick` runs first; `preventDefault()` cancels the clear) and its
   * children become the content, with a development warning. The 0.4 button-object form
   * (`{ as: 'button', onClick, … }` or an object with button props) is **deprecated**: its button
   * props are merged the same way. Pass icon content instead.
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
}

const noop = () => {};

/** Whether React renders nothing for `node` (`null`, `undefined`, booleans, `''`). */
function rendersNothing(node: React.ReactNode): boolean {
  return node === undefined || node === null || typeof node === 'boolean' || node === '';
}

/**
 * Whether `content` renders nothing: `null`, `undefined`, booleans, `''`, or a Fragment, array,
 * `Set` or other re-iterable collection made only of those (at any depth). The clear button then
 * keeps the default icon, so it is never an empty, invisible button. A one-shot iterator (a
 * generator) is not read here, because reading would consume it; `resolveSlot` materialises a
 * top-level generator into an array before this check.
 */
function isEmptyContent(content: unknown, visiting: Set<object> = new Set()): boolean {
  if (rendersNothing(content as React.ReactNode)) return true;
  if (typeof content !== 'object' || content === null) return false;
  if (React.isValidElement<{ children?: React.ReactNode }>(content)) {
    return content.type === React.Fragment && isEmptyContent(content.props.children, visiting);
  }
  if (!(Symbol.iterator in content)) return false;
  const iterable = content as Iterable<unknown>;
  if (!Array.isArray(iterable) && (iterable[Symbol.iterator]() as unknown) === iterable) {
    return false;
  }
  // A collection that contains itself adds nothing beyond what is already being checked.
  if (visiting.has(iterable)) return true;
  visiting.add(iterable);
  try {
    for (const item of iterable) {
      if (!isEmptyContent(item, visiting)) return false;
    }
    return true;
  } finally {
    visiting.delete(iterable);
  }
}

/** Whether `type` is an intrinsic element that can hold the default icon (not a void element). */
function canHoldIcon(type: React.ElementType): boolean {
  return typeof type === 'string' && !VOID_ELEMENTS.has(type);
}

const DEFAULT_DISMISS: DismissParts = {
  kind: 'default',
  buttonProps: {},
  content: null,
  contentMayName: false,
  literalTextLabel: false,
};

function isButtonType(type: unknown): boolean {
  return type === 'button' || type === Button;
}

/**
 * Splits the props of a button-like element or object into button props and content. The content
 * is rendered as is, so a text label in it names the button (C-SLOTS naming).
 */
function splitButtonLike(type: unknown, props: UnknownProps, children: React.ReactNode) {
  const literalTextLabel = hasTextLabel(children);
  if (type === Button) {
    // Wave Button's own props do not belong on a native <button>; its icon becomes content.
    const { appearance, size, icon, as, children: _children, ...buttonProps } = props;
    const iconNode = renderSlot(icon as Slot<'span'>, 'span', 'inline-flex', {
      'aria-hidden': true,
    });
    const content =
      iconNode || !isEmptyContent(children) ? (
        <>
          {iconNode}
          {children}
        </>
      ) : null;
    return { buttonProps, content, contentMayName: true, literalTextLabel };
  }
  const { as, children: _children, ...buttonProps } = props;
  // `null` content falls back to the default icon.
  return {
    buttonProps,
    content: isEmptyContent(children) ? null : children,
    contentMayName: true,
    literalTextLabel,
  };
}

/**
 * Splits `dismiss` into the props merged onto the built-in clear button and its content. Content
 * that renders nothing (see {@link isEmptyContent}) never leaves the button empty: without other
 * props it is the default icon; a slot object with its own content props (`className`, `style`, …)
 * wraps the default icon in its element.
 */
function resolveDismiss(dismiss: SearchBoxProps['dismiss']): DismissParts {
  if (React.isValidElement<UnknownProps>(dismiss) && isButtonType(dismiss.type)) {
    const children = dismiss.props.children as React.ReactNode;
    return { kind: 'element', ...splitButtonLike(dismiss.type, dismiss.props, children) };
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
  // A void (`img`) or component (`{ as: MyIcon }`) slot renders content of its own.
  const empty = canHoldIcon(Component) && isEmptyContent(children);
  if (empty && Object.keys(buttonProps).length === 0 && Object.keys(contentProps).length === 0) {
    return DEFAULT_DISMISS;
  }
  // A button object without content (`{ onClick }`, `{ type: 'button' }`) or a content object
  // without children (`{ className }`) keeps the default icon inside the object's own element (its
  // className/style/attributes still apply).
  const contentChildren = empty ? <DismissIcon /> : children;
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
  };
}

/**
 * A search input with a leading search icon and a clear button that appears while there is text
 * (not while `readOnly`). Clearing moves focus back to the input. `id`, ARIA and native input attributes and the
 * focus/keyboard handlers go to the `<input type="search">` (role `searchbox`); `className`,
 * `style`, `data-*`, other handlers and `ref` stay on the root `<div>` (`controlRef` reaches the
 * input). Inside a `Field` it picks up the label, hint, error and required state automatically.
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
  ...rest
}: SearchBoxProps) => {
  if (onChange !== undefined) warnDeprecated('SearchBox', 'onChange', 'onValueChange');

  const [value, setValue] = useControllable(controlledValue, defaultValue, (next: string) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(inputRef, controlRef);

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
        'absolute end-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground',
        'not-disabled:not-aria-disabled:hover:text-foreground',
        focusRing,
        'disabled:cursor-not-allowed',
      ),
    },
    slotButtonProps,
  ) as React.ComponentPropsWithoutRef<'button'>;

  const clearContent =
    dismissKind === 'content' ? dismissParts.content : (dismissParts.content ?? <DismissIcon />);

  return (
    <div ref={ref} className={cn('relative inline-flex w-full items-center', className)} {...rest}>
      <span className="pointer-events-none absolute start-2 flex items-center">
        {contentBefore != null ? (
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
          'h-8 w-full rounded border border-input border-b-stroke-accessible bg-background ps-8 pe-9 text-body-1 text-foreground',
          'placeholder:text-muted-foreground',
          inputFocus,
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&::-webkit-search-cancel-button]:hidden',
          invalidLook && 'border-destructive focus:border-b-destructive',
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
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        {...fieldProps}
      />

      {contentAfter != null && (
        <span className="absolute end-8 flex items-center">
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
        >
          {clearContent}
        </button>
      ) : null}
    </div>
  );
};

SearchBox.displayName = 'SearchBox';
