import * as React from 'react';
import { cn } from '../../lib/cn';
import { tagClassNames } from '../../lib/classNames';
import { hasWarned, isDev, warnDeprecated, warnOnce } from '../../lib/dev';
import { mergeProps } from '../../lib/mergeProps';
import { getElementType } from '../../lib/children';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import {
  materialiseSlotContent,
  renderSlot,
  slotRendersContent,
  slotWrapsDefaultContent,
} from '../../lib/slot';
import { focusRing, forcedColors } from '../../lib/styles';
import { DismissIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import type { Slot, SlotObject } from '../../lib/slot';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { TagAppearance, TagShape, TagSize } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { Button } from '../button/Button';
import {
  BUTTON_OWN_PROP_KEYS,
  MERGED_DISABLED_FOCUSABLE_PROPS,
  mergedAriaDisabledClasses,
  placeButtonIcon,
} from '../button/Button.slots';
import { AvatarSizeContext } from './Avatar.context';
import {
  TAG_GROUP_SELECTOR,
  TagHostContext,
  isDismissKey,
  useDismissControlFocus,
  useHeldFocus,
  useTagGroupContext,
  useTagGroupItem,
} from './TagGroup.context';
import {
  TAG_AVATAR_SIZE,
  TAG_DISABLED_DIM_CLASSES,
  TAG_DISMISS_BASE_CLASSES,
  TAG_DISMISS_GLYPH_SIZE,
  TAG_DISMISS_SELECTED_RING_CLASSES,
  TAG_PRIMARY_TEXT_TWO_LINE_CLASSES,
  TAG_ROOT_BASE_CLASSES,
  TAG_SECONDARY_TEXT_CLASSES,
  TAG_SELECTED_CLASSES,
  TAG_TEXT_COLUMN_CLASSES,
  tagAppearanceClasses,
  tagDismissRingClasses,
  tagDismissSizeClasses,
  tagDismissStateClasses,
  tagEndInsetClasses,
  tagIconClasses,
  tagMediaClasses,
  tagShapeClasses,
  tagSizeClasses,
  tagStartInsetClasses,
} from './tagStyles';
import type { TagLook } from './tagStyles';

/**
 * The Tag's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`, default `span`). The own props shadow
 * the element's attributes of the same names: `TagProps<'button'>['value']` is a `string`.
 */
export interface TagOwnProps {
  /**
   * Colour scheme: `filled` (a neutral fill), `outline` (a border on the surface behind it) or
   * `brand` (a light brand tint that follows the brand ramp).
   * @default the TagGroup's `appearance`, else 'filled'
   */
  appearance?: TagAppearance;
  /**
   * `medium` (28px tall, the 0.10 look), `small` (24px) or `extra-small` (20px); an Avatar in
   * `media` is 24, 20 or 16px. Fluent's medium tag is 32px.
   * @default the TagGroup's `size`, else 'medium'
   */
  size?: TagSize;
  /**
   * `circular` (a pill, the 0.10 look) or `rounded` (4px corners). Fluent's default is `rounded`.
   * @default the TagGroup's `shape`, else 'circular'
   */
  shape?: TagShape;
  /**
   * Dims the tag and disables its Dismiss button natively (no `onDismiss`, out of the Tab
   * order), whatever `dismissIcon` passes. A disabled TagGroup disables every tag. A Dismiss
   * button that has focus when the tag is disabled keeps it, unavailable, until focus leaves it.
   * Rendered as `data-disabled`. With `as="a"` the link is disabled too: `aria-disabled="true"`,
   * `role="link"`, no `href` (out of the Tab order) and no click; a link that has focus keeps it,
   * and its `href`, until focus leaves it. With another `as`, an element that takes a native
   * `disabled` (a `<button>`) or a component receives `disabled`.
   * @default false
   */
  disabled?: boolean;
  /**
   * Draws the selected look (the brand fill) and sets `data-selected`. A Tag is not interactive,
   * so the state is not announced: for a tag the user selects, use `InteractionTag` (its
   * `InteractionTag.Primary` is a toggle button). Disabled wins over the selected look.
   * @default false
   */
  selected?: boolean;
  /**
   * Identifies the tag in a TagGroup: the value its `onDismiss` receives (without one, a generated
   * id). Give every tag of a group its own value. Renders nothing on the default `<span>`; with
   * `as`, an element that takes a native `value` (a `<button>`, an `<li>`) still receives it.
   */
  value?: string;
  /**
   * A visual before the text, usually an `Avatar`, which takes the tag's size (24, 20 or 16px)
   * unless it sets its own `size`. Not interactive. It is not hidden from assistive technology:
   * pass `decorative` to an Avatar whose name repeats the tag's text. Use `media` or `icon`, not
   * both.
   */
  media?: Slot<'span'>;
  /** A decorative icon before the text (`aria-hidden`), in a 20, 16 or 12px box. */
  icon?: Slot<'span'>;
  /**
   * A second, smaller line under the text (`secondaryText="Designer"`). It is not part of the
   * Dismiss button's name. A small or extra-small tag grows to 28px to fit it.
   */
  secondaryText?: React.ReactNode;
  /**
   * Whether the tag renders a Dismiss button. `onDismiss` and `dismissIcon` take effect only with
   * it (a development warning says so when they are passed without it). `dismissible={false}`
   * opts a tag out of a dismissible TagGroup. A Dismiss button cannot sit inside a link or a
   * button: for a dismissible link chip, put the link in the content,
   * `<Tag dismissible><a href="/topics/react">React</a></Tag>`.
   * @default the TagGroup's `dismissible`, else `false`
   */
  dismissible?: boolean;
  /**
   * Called when the Dismiss button is activated: a click, Enter, Space, Delete or Backspace (a
   * held key dismisses once). Passing it does not render the button: set `dismissible` too. In a
   * TagGroup the group's `onDismiss(value)` is called after it, and focus moves to the next tag
   * when the tag is removed. A standalone Tag cannot keep focus once you remove it: move focus
   * yourself (see "Focus after dismissal" on {@link Tag}).
   */
  onDismiss?: () => void;
  /**
   * Content of the dismiss button (an icon). The Tag always renders its own dismiss
   * `<button type="button">`, wired to `onDismiss` and named by `dismissLabel` plus the tag's text
   * (its children; not `media`, `icon` or `secondaryText`); this slot only replaces the icon
   * inside it.
   *
   * A `<button>` element or a Wave `Button` passed here is not nested (a button cannot contain a
   * button): its props are merged into the dismiss button (its `onClick` runs first and can call
   * `preventDefault()` to skip `onDismiss`) and a development warning recommends icon content.
   * A Wave `Button`'s own props are not attributes: its `icon` becomes decorative content before
   * its children (after them with `iconPosition="after"`), `disabledFocusable` makes the dismiss
   * button unavailable but focusable as on the Button (`onDismiss` is not called), and
   * `appearance` and `size` are ignored.
   * A slot object with button props (`type`, `disabled`, event handlers, `as: 'button'` or
   * `as: Button`) is the deprecated 0.4 button-object form: its props (`className`, `id`,
   * `aria-*`, handlers, …) are merged onto the dismiss button, except its content (`children`,
   * `dangerouslySetInnerHTML`, rendered inside the button) and the naming attributes (see below);
   * for `as: Button`, the Button's own props apply as for a `Button` element — pass icon content
   * and use `onDismiss` instead.
   * The `aria-*` attributes of an icon slot object also go to the dismiss button, because the icon
   * is `aria-hidden`.
   *
   * The dismiss button's name is `dismissLabel` plus the tag's text ("Dismiss Cherry"):
   * `aria-label` and `aria-labelledby` on the slot are ignored (development warning). Icon
   * content is decorative (`aria-hidden`). The children of a merged `<button>`/`Button` (or its
   * `dangerouslySetInnerHTML` markup) are rendered as is inside the dismiss button, next to the
   * decorative `icon` of a Wave `Button`: when they render a text label (at least two letters or
   * digits outside `aria-hidden`/`hidden` content, text from components such as translations
   * included), that text replaces `dismissLabel` in the name, so the name contains the visible
   * label (WCAG 2.5.3): `<button>Remove</button>` or
   * `<Button icon={<CloseIcon />}>Remove</Button>` on "Cherry" is named "Remove Cherry". An icon or
   * a lone character (`x`, `×`) keeps "Dismiss Cherry". Text hidden only with CSS still counts as
   * the label.
   *
   * When the slot renders no content (`[]`, `<></>`, a childless merged button, a slot object
   * without `children`), the default dismiss icon is shown; a slot object then styles it, e.g.
   * `{ className: 'text-error' }`. A slot object that renders a component or a void element
   * (`{ as: CloseIcon }`, `{ as: 'img', src, alt: '' }`) or sets `dangerouslySetInnerHTML` is the
   * icon itself: no default icon is added. Only takes effect with `dismissible`.
   */
  dismissIcon?: Slot<'span'> | SlotObject<'button'>;
  /**
   * Visually hidden text that names the dismiss button together with the tag's text (its
   * children; not `media`, `icon` or `secondaryText`; `aria-labelledby`), e.g. "Dismiss Cherry".
   * Localise it here. A text label rendered by a merged `<button>` slot replaces it (see
   * `dismissIcon`). TagPicker names the Dismiss buttons of the tags it renders itself with its
   * `labels.remove`.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
}

/**
 * Props of {@link Tag} rendered as `C` (default `'span'`). `TagProps` without a type argument is
 * the 0.4 name.
 */
export type TagProps<C extends React.ElementType = 'span'> = PolymorphicProps<C, TagOwnProps>;

/** The props the implementation reads, for any `as` (the public typing is `PolymorphicComponent`). */
type TagImplProps = TagOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

type UnknownProps = Record<string, unknown>;

/** Attributes that only make sense on the dismiss `<button>` itself. */
const BUTTON_ONLY_KEYS: ReadonlySet<string> = new Set([
  'type',
  'disabled',
  'autoFocus',
  'form',
  'formAction',
  'formEncType',
  'formMethod',
  'formNoValidate',
  'formTarget',
  'name',
  'value',
]);

const HANDLER_KEY = /^on[A-Z]/;

/**
 * Naming attributes a slot cannot set: the Tag names its dismiss button itself
 * (`aria-labelledby` = `dismissLabel` + tag content, data-display#10), so these are dropped.
 */
const NAME_KEYS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby']);

/** The props of a merged `<button>` or Wave `Button` that the Tag reads itself. */
interface WaveButtonSlotProps extends UnknownProps {
  icon?: Slot<'span'>;
  iconPosition?: unknown;
  disabledFocusable?: unknown;
  children?: React.ReactNode;
  dangerouslySetInnerHTML?: React.HTMLAttributes<HTMLElement>['dangerouslySetInnerHTML'];
}

interface ResolvedDismissSlot {
  /** Props merged onto the wired dismiss button (`null`: none). */
  buttonProps: UnknownProps | null;
  /** What renders inside the dismiss button. */
  content: React.ReactNode;
  /** Which development warning the slot needs. */
  warning: 'button-element' | 'button-object' | null;
  /** Whether the slot passed `aria-label`/`aria-labelledby`, which the Tag ignores. */
  ignoredName: boolean;
  /**
   * `true` when the content is rendered as is (a merged `<button>`/`Button`), so a text label in it
   * replaces `dismissLabel` in the name (C-SLOTS naming, WCAG 2.5.3); `false` when the content is
   * decorative (`aria-hidden`).
   */
  contentMayName: boolean;
  /**
   * Whether the literal content contains a text label: the name for the server render and the
   * first client render. After mount the rendered content decides.
   */
  literalTextLabel: boolean;
  /**
   * Whether a merged Wave `Button` set `disabledFocusable`: the dismiss button is then unavailable
   * but focusable, as the Button would be.
   */
  disabledFocusable: boolean;
}

const noop = () => {};

/** `props` without the naming attributes, and whether any was set. */
function withoutName(props: UnknownProps): { props: UnknownProps; ignoredName: boolean } {
  const result: UnknownProps = {};
  let ignoredName = false;
  for (const [key, value] of Object.entries(props)) {
    if (NAME_KEYS.has(key)) {
      if (value !== undefined) ignoredName = true;
    } else {
      result[key] = value;
    }
  }
  return { props: result, ignoredName };
}

const iconClassName = 'inline-flex items-center justify-center';

function isPlainObject(value: unknown): value is UnknownProps {
  if (typeof value !== 'object' || value === null) return false;
  if (React.isValidElement(value) || Symbol.iterator in value) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * The decorative default dismiss glyph (12px, 10px at `extra-small`). It carries the dismiss icon
 * part class when it is the dismiss button's own content, not when the element of a slot object
 * wraps it.
 */
function defaultDismissContent(glyphSize: number, className?: string): React.ReactNode {
  return <DismissIcon size={glyphSize} className={className} />;
}

/**
 * Splits the dismissIcon slot into dismiss-button props and icon content (C-SLOTS). The icon
 * content is `aria-hidden`, so no attribute that means something to assistive technology stays on
 * it: button-form props go to the dismiss button, and so do the `aria-*` attributes of an icon slot
 * object; the naming attributes are dropped (see {@link NAME_KEYS}).
 *
 * Content that renders nothing (`[]`, `<></>`, a childless merged button, a slot object without
 * `children`) shows the default icon, so the dismiss button is never an empty, invisible Tab stop.
 *
 * @param glyphSize The size (px) of the default glyph, by the tag's size.
 */
function resolveDismissSlot(
  slot: TagOwnProps['dismissIcon'],
  glyphSize: number,
): ResolvedDismissSlot {
  if (!slotRendersContent(slot)) {
    return {
      buttonProps: null,
      content: defaultDismissContent(glyphSize, tagClassNames.dismissIcon),
      warning: null,
      ignoredName: false,
      contentMayName: false,
      literalTextLabel: false,
      disabledFocusable: false,
    };
  }

  // A `<button>` or a Wave `Button` (also one written in a Server Component, whose type arrives as
  // a lazy reference) is merged into the dismiss button. Its content is rendered as is, after the
  // Button's icon, which is decorative (as in MessageBar and SearchBox); its text label names it.
  const elementType = getElementType(slot as React.ReactNode);
  if (
    React.isValidElement<WaveButtonSlotProps>(slot) &&
    (elementType === 'button' || elementType === Button)
  ) {
    const { children, dangerouslySetInnerHTML: markup, ...elementProps } = slot.props;
    const isWaveButton = elementType === Button;
    let slotProps: UnknownProps = elementProps;
    if (isWaveButton) {
      // Wave Button's own props are not attributes: `icon`, `iconPosition` and
      // `disabledFocusable` are applied here, the others (`appearance`, `size`) are dropped.
      slotProps = {};
      for (const [key, value] of Object.entries(elementProps)) {
        if (!BUTTON_OWN_PROP_KEYS.has(key)) slotProps[key] = value;
      }
    }
    const icon = isWaveButton ? elementProps.icon : undefined;
    const { props: buttonProps, ignoredName } = withoutName(slotProps);
    const iconNode = slotRendersContent(icon)
      ? renderSlot(icon, 'span', cn(tagClassNames.dismissIcon, iconClassName), {
          'aria-hidden': true,
        })
      : null;
    // A generator is read once by the check; its items are what renders (and names the button).
    // Markup of the merged button (`dangerouslySetInnerHTML`) is its content as well: the dismiss
    // button holds its own name text, so the markup renders in a span inside it.
    const ownContent =
      markup != null ? (
        <span className={iconClassName} dangerouslySetInnerHTML={markup} />
      ) : (
        materialiseSlotContent(children)
      );
    return {
      buttonProps,
      content:
        iconNode || slotRendersContent(ownContent)
          ? placeButtonIcon(iconNode, ownContent, isWaveButton && elementProps.iconPosition)
          : defaultDismissContent(glyphSize, tagClassNames.dismissIcon),
      warning: 'button-element',
      ignoredName,
      contentMayName: true,
      literalTextLabel: hasTextLabel(ownContent),
      disabledFocusable: isWaveButton && Boolean(elementProps.disabledFocusable),
    };
  }

  if (isPlainObject(slot)) {
    // 0.4 rendered the whole object as the dismiss element, so an object with button props
    // describes the button: everything but its content goes to the dismiss button. `as: Button`
    // is that form too (a button cannot contain a button); its icon becomes decorative content.
    const asWaveButton = slot.as === Button;
    const isButtonObject =
      slot.as === 'button' ||
      asWaveButton ||
      Object.keys(slot).some((key) => BUTTON_ONLY_KEYS.has(key) || HANDLER_KEY.test(key));
    const buttonProps: UnknownProps = {};
    const contentProps: UnknownProps = {};
    // Wave Button's own props are not attributes: `icon`, `iconPosition` and `disabledFocusable`
    // are applied below, the others (`appearance`, `size`) are dropped.
    const ownProps: UnknownProps = {};
    let ignoredName = false;
    for (const [key, value] of Object.entries(slot)) {
      if (key === 'as') {
        if (value !== 'button' && !asWaveButton) contentProps.as = value;
      } else if (asWaveButton && BUTTON_OWN_PROP_KEYS.has(key)) {
        ownProps[key] = value;
      } else if (NAME_KEYS.has(key)) {
        if (value !== undefined) ignoredName = true;
      } else if (key === 'children' || key === 'dangerouslySetInnerHTML') {
        // Content, also in the button-object form: the dismiss button holds its own name text.
        contentProps[key] = value;
      } else if (isButtonObject || (key.startsWith('aria-') && key !== 'aria-hidden')) {
        buttonProps[key] = value;
      } else {
        contentProps[key] = value;
      }
    }
    // An object without content styles the default icon, e.g. `{ className: 'text-error' }` (as in
    // MessageBar and SearchBox); a Wave Button's icon comes before the content (after it with
    // `iconPosition="after"`).
    // The dismiss icon part is the merged Button's icon element when there is one, else the
    // element this slot object renders (a default glyph inside it stays without the part class).
    const hasButtonIcon = slotRendersContent(ownProps.icon);
    if (hasButtonIcon) {
      contentProps.children = placeButtonIcon(
        renderSlot(
          ownProps.icon as Slot<'span'>,
          'span',
          cn(tagClassNames.dismissIcon, iconClassName),
        ),
        materialiseSlotContent(contentProps.children),
        ownProps.iconPosition,
      );
    } else if (slotWrapsDefaultContent(contentProps.as ?? 'span', contentProps)) {
      contentProps.children = defaultDismissContent(glyphSize);
    }
    return {
      buttonProps: isButtonObject || Object.keys(buttonProps).length > 0 ? buttonProps : null,
      content: renderSlot(
        contentProps as SlotObject<'span'>,
        'span',
        cn(!hasButtonIcon && tagClassNames.dismissIcon, iconClassName),
        { 'aria-hidden': true },
      ),
      warning: isButtonObject ? 'button-object' : null,
      ignoredName,
      contentMayName: false,
      literalTextLabel: false,
      disabledFocusable: Boolean(ownProps.disabledFocusable),
    };
  }

  return {
    buttonProps: null,
    content: renderSlot(
      slot as Slot<'span'>,
      'span',
      cn(tagClassNames.dismissIcon, iconClassName),
      {
        'aria-hidden': true,
      },
    ),
    warning: null,
    ignoredName: false,
    contentMayName: false,
    literalTextLabel: false,
    disabledFocusable: false,
  };
}

/** Elements that take a native `disabled`: a Tag rendered as one of them receives `disabled`. */
const NATIVE_DISABLED_ELEMENTS: ReadonlySet<string> = new Set([
  'button',
  'fieldset',
  'input',
  'optgroup',
  'option',
  'select',
  'textarea',
]);

/** Elements that take a native `value`: a Tag rendered as one of them receives `value`. */
const NATIVE_VALUE_ELEMENTS: ReadonlySet<string> = new Set([
  'button',
  'data',
  'input',
  'li',
  'meter',
  'option',
  'progress',
  'select',
  'textarea',
]);

/**
 * Spread last on the Dismiss button of a disabled tag: the native `disabled`, whatever a merged
 * slot passed (a merged `disabledFocusable`, `disabled={false}`), without the attributes of the
 * focusable disabled state.
 */
const NATIVELY_DISABLED_PROPS = {
  disabled: true,
  'aria-disabled': undefined,
  'data-disabled': undefined,
  'data-disabled-focusable': undefined,
};

type FocusHandler = (event: React.FocusEvent<HTMLElement>) => void;

/** Whether `value` is a key of `table` (an untyped value outside a union falls back). */
function isKeyOf<K extends string>(
  value: unknown,
  table: Readonly<Record<K, unknown>>,
): value is K {
  return typeof value === 'string' && Object.hasOwn(table, value);
}

/** Prevents and stops the click of a disabled link root, as a natively disabled control's. */
function blockLinkClick(event: React.MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

/** Props of {@link TagDismissButton}. */
interface TagDismissButtonProps {
  /** The button's own props merged with the props of a merged slot. */
  buttonProps: UnknownProps;
  /** What renders inside the button: the default glyph, the slot's icon or a merged button's content. */
  content: React.ReactNode;
  /** Whether a text label in `content` names the button (the content of a merged button). */
  contentMayName: boolean;
  /** Whether the literal `content` holds a text label: the server render and the first render. */
  literalTextLabel: boolean;
  /** Whether a merged Wave `Button` set `disabledFocusable`. */
  disabledFocusable: boolean;
  /** The tag's effective `disabled`. */
  disabled: boolean;
  /** The visually hidden first half of the name. */
  dismissLabel: string;
  /** The id of the tag's primary text, the second half of the name. */
  contentId: string;
  /** A host's whole name for the button (`TagHostContext`): `aria-label` alone. */
  dismissName: string | undefined;
  /** Receives the button, so the tag's root can click it (Delete on a link in the tag's text). */
  buttonRef: React.Ref<HTMLButtonElement>;
}

/**
 * The tag's Dismiss button (internal): named by `dismissLabel`, or a merged button's text label,
 * plus the tag's text; natively disabled with its tag, and kept focusable while it has focus.
 */
function TagDismissButton({
  buttonProps,
  content,
  contentMayName,
  literalTextLabel,
  disabledFocusable,
  disabled,
  dismissLabel,
  contentId,
  dismissName,
  buttonRef,
}: TagDismissButtonProps) {
  const dismissLabelId = useId('tag-dismiss');
  const dismissTextId = useId('tag-dismiss-text');
  const { ref: slotRef, ...ownProps } = buttonProps;
  const ownRef = React.useRef<HTMLButtonElement>(null);
  const mergedRef = useMergedRefs(ownRef, buttonRef, slotRef as React.Ref<HTMLButtonElement>);
  // Unmounting while it has focus (`dismissible` turning `false`), the button hands focus to its
  // tag's own control (a link in the text), else, in a TagGroup, to the next tag (D35).
  useDismissControlFocus(ownRef);

  // C-SLOTS naming (WCAG 2.5.3 Label in Name): the rendered text label of a merged button replaces
  // `dismissLabel` in the name ("Remove Cherry"). The literal content decides on the server and on
  // the first render; after mount, the rendered content does (text from components, later changes).
  const [labelTarget, setLabelTarget] = React.useState<HTMLSpanElement | null>(null);
  const subscribeToContent = React.useCallback(
    (onChange: () => void) => (labelTarget ? observeTextLabel(labelTarget, onChange) : noop),
    [labelTarget],
  );
  const contentHasTextLabel = React.useSyncExternalStore(
    subscribeToContent,
    () => (labelTarget ? hasRenderedTextLabel(labelTarget) : literalTextLabel),
    () => literalTextLabel,
  );
  const namedByContent = contentMayName && contentHasTextLabel;

  // A disabled tag disables its button natively (spread last, so no merged slot re-enables it);
  // a button that has focus when its tag is disabled keeps it, unavailable, until focus leaves
  // it (the browser would drop focus to the page). Otherwise a merged `disabledFocusable` Button
  // makes it unavailable but focusable (it wins over `disabled` and `onDismiss`).
  const hold = useHeldFocus(disabled);
  const stateProps = disabled
    ? hold.held
      ? MERGED_DISABLED_FOCUSABLE_PROPS
      : NATIVELY_DISABLED_PROPS
    : disabledFocusable
      ? MERGED_DISABLED_FOCUSABLE_PROPS
      : undefined;

  // A host's name (TagPicker's `labels.remove`) is the whole name: no hidden label text joins the
  // tag's own text content.
  const named = dismissName !== undefined;
  return (
    <button
      {...ownProps}
      ref={mergedRef}
      type={(ownProps.type as 'button' | 'submit' | 'reset' | undefined) ?? 'button'}
      {...stateProps}
      aria-label={named ? dismissName : undefined}
      aria-labelledby={
        named ? undefined : `${namedByContent ? dismissTextId : dismissLabelId} ${contentId}`
      }
      onFocus={composeEventHandlers(ownProps.onFocus as FocusHandler | undefined, hold.onFocus, {
        checkDefaultPrevented: false,
      })}
      onBlur={composeEventHandlers(ownProps.onBlur as FocusHandler | undefined, hold.onBlur, {
        checkDefaultPrevented: false,
      })}
    >
      {!named && (
        <span id={dismissLabelId} className="sr-only">
          {dismissLabel}
        </span>
      )}
      {contentMayName ? (
        // The merged button's own content, rendered as is: its text label can name the button.
        // `gap-[inherit]` keeps a gap set on the button between the content items.
        <span
          id={dismissTextId}
          ref={setLabelTarget}
          className="inline-flex items-center justify-center gap-[inherit]"
        >
          {content}
        </span>
      ) : (
        content
      )}
    </button>
  );
}
TagDismissButton.displayName = 'TagDismissButton';

/** Elements that never take the `listitem` role in a list TagGroup: interactive, or a list item already. */
const NO_LIST_ITEM_ROLE_ELEMENTS: ReadonlySet<string> = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'li',
]);

const LIST_ITEM_MESSAGE =
  'TagGroup: a tag in a `role="list"` group is not a list item (its element is a link, a button or a component). Put a link in the tag\'s content (`<Tag><a href>…</a></Tag>`), or wrap the tag in an element with `role="listitem"`.';

/**
 * Whether a tag root in a list TagGroup is a list item: it has the role, or an element between it
 * and the group root has it (a wrapping `<li>` or `role="listitem"` element), as the list requires
 * of its children.
 */
function isInListItem(root: HTMLElement): boolean {
  for (
    let element: HTMLElement | null = root;
    element && !element.matches(TAG_GROUP_SELECTOR);
    element = element.parentElement
  ) {
    if (element.getAttribute('role') === 'listitem' || element.localName === 'li') return true;
  }
  return false;
}

/**
 * A compact label (a "chip") for a keyword, category or filter, optionally dismissible.
 *
 * - The dismiss button is a real `<button type="button">` wired to `onDismiss`. Its accessible
 *   name is `dismissLabel` plus the tag's text (its children; not `media`, `icon` or
 *   `secondaryText`): "Dismiss Cherry", so a row of tags has distinguishable dismiss buttons.
 *   Enter, Space, Delete and Backspace on it dismiss the tag (a held key dismisses once), and so do
 *   Delete and Backspace on a link in the tag's text.
 * - `dismissIcon` replaces only the icon inside that button (see {@link TagOwnProps.dismissIcon}).
 * - The look: `appearance` (`filled`, `outline` or `brand`), `size` (28, 24 or 20px tall),
 *   `shape` (`circular` or `rounded`) and the look-only `selected`, rendered as `data-appearance`,
 *   `data-size`, `data-shape` and `data-selected`. `disabled` dims the tag and disables its
 *   dismiss button natively (`data-disabled`).
 * - Slots before and under the text: `media` (an Avatar, sized for the tag), a decorative `icon`
 *   and a second line, `secondaryText`.
 * - In a TagGroup, a tag takes the group's `size`, `appearance`, `shape` and `dismissible` unless
 *   it sets its own, is disabled with the group, reports its dismissal to the group's
 *   `onDismiss(value)`, and is a list item in a `role="list"` group.
 * - Polymorphic: `as="a"` renders a link chip with anchor props type-checked. A dismissible link
 *   chip puts the link in the content, `<Tag dismissible><a href>…</a></Tag>`: a dismiss button
 *   cannot sit inside a link.
 *
 * **Focus after dismissal.** A tag cannot keep focus once you remove it. In a TagGroup, focus
 * moves to the next tag for you (else the previous one, else the group's `fallbackFocusRef`). For
 * a standalone tag, move focus to the next tag's dismiss button, else the previous one, else a
 * nearby control, then remove the tag: the neighbour stays mounted, so you can focus it in
 * `onDismiss` before removing the tag.
 *
 * @example
 * <Tag>React</Tag>
 * <Tag appearance="brand" size="small">Beta</Tag>
 * <Tag dismissible onDismiss={() => remove('cherry')}>Cherry</Tag>
 * <Tag media={<Avatar name="Katri Athokas" />} secondaryText="Designer">Katri</Tag>
 * <Tag dismissible dismissLabel="Remove" dismissIcon={<CloseIcon />}>Cherry</Tag>
 */
export const Tag: PolymorphicComponent<'span', TagOwnProps> = (props) => {
  const {
    as,
    appearance: appearanceProp,
    size: sizeProp,
    shape: shapeProp,
    disabled: disabledProp,
    selected = false,
    value,
    media,
    icon,
    secondaryText,
    dismissible: dismissibleProp,
    onDismiss,
    dismissIcon,
    dismissLabel = 'Dismiss',
    className,
    children,
    role,
    hidden,
    onClick,
    onFocus,
    onBlur,
    onKeyDown,
    ref,
    ...rest
  } = props as TagImplProps;
  const Component: React.ElementType = as ?? 'span';
  const contentId = useId('tag-content');
  const group = useTagGroupContext();
  const host = React.useContext(TagHostContext);
  const rootRef = React.useRef<HTMLElement>(null);
  const mergedRef = useMergedRefs<HTMLElement>(rootRef, ref);
  const primaryTextRef = React.useRef<HTMLSpanElement>(null);
  const dismissButtonRef = React.useRef<HTMLButtonElement>(null);

  // The tag's own look, else its TagGroup's, else the 0.10 look.
  const size: TagSize = isKeyOf(sizeProp, tagSizeClasses) ? sizeProp : (group?.size ?? 'medium');
  const appearance: TagAppearance = isKeyOf(appearanceProp, tagAppearanceClasses)
    ? appearanceProp
    : (group?.appearance ?? 'filled');
  const shape: TagShape = isKeyOf(shapeProp, tagShapeClasses)
    ? shapeProp
    : (group?.shape ?? 'circular');
  // A disabled group disables every tag: a tag's own `disabled={false}` cannot re-enable it.
  const disabled = (group?.disabled ?? false) || disabledProp === true;
  const dismissible = dismissibleProp ?? group?.dismissible ?? false;
  // Disabled wins over the selected look; both attributes still reflect the props.
  const look: TagLook = selected && !disabled ? 'selected' : appearance;
  // A host that dims the area holding its tags (TagPicker's disabled control) dims them once.
  const dimDisabled = group?.dimDisabled ?? true;

  const reportedValue = useTagGroupItem(rootRef, value, {
    reported: dismissible && (group?.reportsDismissals ?? false),
  });

  // A link root is disabled as Nav.Item's link is: `aria-disabled`, `role="link"` and no `href`,
  // so it leaves the Tab order. One that has focus when it is disabled keeps its `href`, and
  // focus, until focus leaves it.
  const isLinkRoot = Component === 'a';
  const linkDisabled = isLinkRoot && disabled;
  const rootHold = useHeldFocus(linkDisabled);

  const {
    buttonProps: slotButtonProps,
    content,
    warning,
    ignoredName,
    contentMayName,
    literalTextLabel,
    disabledFocusable,
  } = resolveDismissSlot(dismissible ? dismissIcon : undefined, TAG_DISMISS_GLYPH_SIZE[size]);

  React.useEffect(() => {
    if (warning === 'button-element') {
      warnOnce(
        'Tag:dismissIcon-button',
        'Tag: `dismissIcon` received a button. Its props were merged into the built-in dismiss button (a button cannot contain another button), which is named by its text label (or `dismissLabel`) and the tag content. Pass icon content instead, e.g. `dismissIcon={<CloseIcon />}`, and handle the dismissal in `onDismiss`.',
      );
    } else if (warning === 'button-object') {
      warnDeprecated(
        'Tag',
        'dismissIcon={{ onClick, type, disabled, … }} (button props on the slot object)',
        'onDismiss and icon content in dismissIcon',
        'Its props are merged onto the built-in dismiss button, which is named by `dismissLabel` and the tag content.',
      );
    }
  }, [warning]);

  // `onDismiss`/`dismissIcon` alone render no dismiss button (unlike MessageBar's `onDismiss`).
  // An explicit `dismissible={false}` is a deliberate state, and a dismissible TagGroup makes the
  // tag dismissible, so only a missing flag warns.
  const dismissPropsIgnored =
    dismissibleProp === undefined &&
    !(group?.dismissible ?? false) &&
    (onDismiss !== undefined || dismissIcon !== undefined);
  React.useEffect(() => {
    if (dismissPropsIgnored) {
      warnOnce(
        'Tag:dismiss-without-dismissible',
        'Tag: `onDismiss` and `dismissIcon` take effect only with `dismissible`; no dismiss button was rendered. Add `dismissible` to render it.',
      );
    }
  }, [dismissPropsIgnored]);

  React.useEffect(() => {
    if (ignoredName) {
      warnOnce(
        'Tag:dismissIcon-name',
        'Tag: `aria-label`/`aria-labelledby` on `dismissIcon` are ignored. The dismiss button is named by `dismissLabel` (default "Dismiss") and the tag content, e.g. "Dismiss Cherry"; set `dismissLabel` to change or localise it.',
      );
    }
  }, [ignoredName]);

  // A list's children must be list items (axe `aria-required-children`): a tag whose element
  // takes no `listitem` role (a link, a button, a component) needs a wrapping list item.
  const inList = group?.mode === 'list';
  React.useEffect(() => {
    if (!inList || !isDev || hasWarned('TagGroup:list-item')) return;
    const root = rootRef.current;
    if (root && !isInListItem(root)) warnOnce('TagGroup:list-item', LIST_ITEM_MESSAGE);
  });

  // Slots that render nothing (`''`, `[]`, `<></>`, an empty generator) render no element and
  // take no room.
  const hasMedia = slotRendersContent(media);
  const hasIcon = slotRendersContent(icon);
  const secondary = materialiseSlotContent(secondaryText);
  const hasSecondary = slotRendersContent(secondary);
  const avatarBox = React.useMemo(() => ({ size: TAG_AVATAR_SIZE[size] }), [size]);

  // `disabled` and `value` are Tag props: they reach only an element that takes them natively,
  // or a component, never the default span or an anchor.
  const takesNative = (elements: ReadonlySet<string>) =>
    typeof Component !== 'string' || elements.has(Component);
  const elementProps: UnknownProps = {};
  if (takesNative(NATIVE_DISABLED_ELEMENTS) && (disabled || disabledProp !== undefined)) {
    elementProps.disabled = disabled;
  }
  if (value !== undefined && takesNative(NATIVE_VALUE_ELEMENTS)) elementProps.value = value;
  if (linkDisabled) {
    elementProps['aria-disabled'] = true;
    if (rootHold.held) {
      elementProps['data-disabled-focusable'] = '';
    } else {
      elementProps.href = undefined;
      elementProps.role = 'link';
    }
  }

  // In a list TagGroup the root is a list item, unless its element is interactive or a list item
  // already, or a component; the consumer's role wins.
  const listItemRole =
    inList && typeof Component === 'string' && !NO_LIST_ITEM_ROLE_ELEMENTS.has(Component)
      ? 'listitem'
      : undefined;
  // A host hides the tags it counts instead of showing them (TagPicker's `overflow="count"`).
  const hiddenByHost = value !== undefined && (group?.hiddenValues?.has(value) ?? false);

  const handleClick = linkDisabled
    ? (event: React.MouseEvent<HTMLElement>) => {
        // A click from a portal opened inside the tag is not the link's (C-COMPOSE).
        if (isOwnEvent(event)) blockLinkClick(event);
        else onClick?.(event);
      }
    : onClick;

  // Delete and Backspace on a focused element in the tag's text (a link chip's link) dismiss the
  // tag through its Dismiss button's click, which a disabled or held button blocks; never from an
  // editable field (its Backspace edits), the Dismiss button's own keys or a portal opened inside.
  const handleRootKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const text = primaryTextRef.current;
    const button = dismissButtonRef.current;
    if (!text || !button || !isDismissKey(event)) return;
    if (!text.contains(event.target as Node) || isEditableTarget(event.target)) return;
    event.preventDefault();
    button.click();
  });

  const ownButtonProps: UnknownProps = {
    type: 'button',
    'data-wave-tag-dismiss': '',
    className: cn(
      tagClassNames.dismissButton,
      TAG_DISMISS_BASE_CLASSES,
      tagDismissSizeClasses[size],
      // A disabled tag dims itself, so its button dims nothing more and has no hover.
      !disabled && ['disabled:opacity-50', mergedAriaDisabledClasses, tagDismissStateClasses[look]],
      focusRing,
      tagDismissRingClasses[size],
      look === 'selected' && TAG_DISMISS_SELECTED_RING_CLASSES,
      host?.dismissButtonClassName,
    ),
    // Delete and Backspace dismiss as Enter does: through the button's own click, so whatever
    // cancels a click (a merged slot's `preventDefault()`, a held or disabled button) cancels
    // them too.
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.target !== event.currentTarget || !isDismissKey(event)) return;
      event.preventDefault();
      event.currentTarget.click();
    },
  };
  if (onDismiss || group) {
    // The tag's own `onDismiss` first, then the group's `onDismiss(value)`, in the same click.
    ownButtonProps.onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isOwnEvent(event)) return;
      onDismiss?.();
      group?.dismiss(reportedValue);
    };
  }
  const dismissButtonProps = slotButtonProps
    ? mergeProps(ownButtonProps, slotButtonProps)
    : ownButtonProps;

  const primaryText = (
    <span
      id={contentId}
      ref={primaryTextRef}
      className={cn(
        tagClassNames.primaryText,
        'inline-flex items-center gap-1',
        hasSecondary && TAG_PRIMARY_TEXT_TWO_LINE_CLASSES,
      )}
    >
      {children}
    </span>
  );

  return (
    <Component
      data-size={size}
      data-appearance={appearance}
      data-shape={shape}
      data-selected={selected ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-wave-tag-item=""
      role={role ?? listItemRole}
      hidden={hiddenByHost || hidden}
      {...rest}
      {...elementProps}
      ref={mergedRef}
      className={cn(
        tagClassNames.root,
        TAG_ROOT_BASE_CLASSES,
        tagSizeClasses[size],
        tagStartInsetClasses[size][hasMedia ? 'media' : hasIcon ? 'icon' : 'text'],
        tagEndInsetClasses[size][dismissible ? 'dismiss' : 'text'],
        look === 'selected'
          ? [TAG_SELECTED_CLASSES, forcedColors.selectedContainer]
          : tagAppearanceClasses[appearance],
        disabled && [dimDisabled && TAG_DISABLED_DIM_CLASSES, forcedColors.disabled],
        tagShapeClasses[shape],
        className,
      )}
      onClick={handleClick}
      onKeyDown={composeEventHandlers(onKeyDown, handleRootKeyDown)}
      onFocus={composeEventHandlers(onFocus, rootHold.onFocus, { checkDefaultPrevented: false })}
      onBlur={composeEventHandlers(onBlur, rootHold.onBlur, { checkDefaultPrevented: false })}
    >
      {hasMedia && (
        // An Avatar without its own `size` takes the tag's box; one in `children` keeps its size.
        <AvatarSizeContext.Provider value={avatarBox}>
          {renderSlot(media, 'span', cn(tagClassNames.media, tagMediaClasses[size]))}
        </AvatarSizeContext.Provider>
      )}
      {hasIcon &&
        renderSlot(icon, 'span', cn(tagClassNames.icon, tagIconClasses[size]), {
          'aria-hidden': true,
        })}
      {hasSecondary ? (
        <span className={TAG_TEXT_COLUMN_CLASSES}>
          {primaryText}
          <span className={cn(tagClassNames.secondaryText, TAG_SECONDARY_TEXT_CLASSES)}>
            {secondary}
          </span>
        </span>
      ) : (
        primaryText
      )}
      {dismissible && (
        <TagDismissButton
          buttonProps={dismissButtonProps}
          content={content}
          contentMayName={contentMayName}
          literalTextLabel={literalTextLabel}
          disabledFocusable={disabledFocusable}
          disabled={disabled}
          dismissLabel={dismissLabel}
          contentId={contentId}
          dismissName={host?.dismissName}
          buttonRef={dismissButtonRef}
        />
      )}
    </Component>
  );
};

Tag.displayName = 'Tag';
