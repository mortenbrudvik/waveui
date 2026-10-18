import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import {
  interactionTagClassNames,
  interactionTagPrimaryClassNames,
  interactionTagSecondaryClassNames,
} from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { isOwnEvent } from '../../lib/events';
import { DismissIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { focusRing, forcedColors } from '../../lib/styles';
import type { TagAppearance, TagShape, TagSize } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import {
  MERGED_DISABLED_FOCUSABLE_PROPS,
  mergedAriaDisabledClasses,
  unwrapButtonGlyph,
} from '../button/Button.slots';
import { AvatarSizeContext } from './Avatar.context';
import {
  isDismissKey,
  useDismissControlFocus,
  useHeldFocus,
  useTagGroupContext,
  useTagGroupItem,
} from './TagGroup.context';
import {
  INTERACTION_TAG_BUTTON_BASE_CLASSES,
  INTERACTION_TAG_DISABLED_CLASSES,
  INTERACTION_TAG_EXTRA_SMALL_HIT_CLASSES,
  INTERACTION_TAG_PRIMARY_BASE_CLASSES,
  INTERACTION_TAG_PRIMARY_JOINED_CLASSES,
  INTERACTION_TAG_SECONDARY_BASE_CLASSES,
  INTERACTION_TAG_SELECTED_FORCED_COLORS,
  INTERACTION_TAG_UNDIMMED_DISABLED_CLASSES,
  TAG_AVATAR_SIZE,
  TAG_DISMISS_GLYPH_SIZE,
  TAG_PRIMARY_TEXT_TWO_LINE_CLASSES,
  TAG_SECONDARY_TEXT_CLASSES,
  TAG_TEXT_COLUMN_CLASSES,
  interactionTagDividerClasses,
  interactionTagLookClasses,
  interactionTagPrimaryEndInsetClasses,
  interactionTagSecondaryShapeClasses,
  interactionTagSecondarySizeClasses,
  tagAppearanceClasses,
  tagIconClasses,
  tagMediaClasses,
  tagShapeClasses,
  tagSizeClasses,
  tagStartInsetClasses,
} from './tagStyles';
import type { TagLook } from './tagStyles';

/** Props of InteractionTag: the element that holds the Primary and Secondary buttons. */
export interface InteractionTagProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Identifies the tag in a TagGroup: the value `onDismiss` receives. Give every tag of a group its
   * own value.
   * @default a generated id (a development warning in a group that reports values)
   */
  value?: string;
  /**
   * Colour scheme of both buttons: `filled` (a neutral fill), `outline` (a border on the surface
   * behind it) or `brand` (a light brand tint that follows the brand ramp).
   * @default the TagGroup's `appearance`, else 'filled'
   */
  appearance?: TagAppearance;
  /**
   * `medium` (28px tall), `small` (24px) or `extra-small` (20px); an Avatar in the Primary's
   * `media` is 24, 20 or 16px. Fluent's medium tag is 32px.
   * @default the TagGroup's `size`, else 'medium'
   */
  size?: TagSize;
  /**
   * `circular` (a pill) or `rounded` (4px corners). Fluent's default is `rounded`.
   * @default the TagGroup's `shape`, else 'circular'
   */
  shape?: TagShape;
  /**
   * Disables both buttons natively (a disabled TagGroup does too; a part's own `disabled` cannot
   * re-enable it). A button that has focus when it is disabled keeps it, unavailable, until focus
   * leaves it. Rendered as `data-disabled` on the root.
   * @default false
   */
  disabled?: boolean;
  /**
   * Draws the selected look and makes the Primary a toggle: `aria-pressed="true"`, or `"false"`
   * for `selected={false}`. Leave it `undefined` for an action that is not a toggle (no
   * `aria-pressed`). Rendered as `data-selected` on the root and both buttons. Disabled wins over
   * the selected look (`aria-pressed` and `data-selected` still render). Fluent's `selected` is a
   * look only.
   */
  selected?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** Props of InteractionTag.Primary: the tag's main action. */
export interface InteractionTagPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * A visual before the text (an Avatar, sized for the tag: 24, 20 or 16px, unless it sets its
   * own `size`). Decorative (`aria-hidden`): the button is named by its text.
   */
  media?: Slot<'span'>;
  /** A decorative icon before the text (`aria-hidden`), in a 20, 16 or 12px box. */
  icon?: Slot<'span'>;
  /**
   * A second, smaller line under the text. Part of the Primary's name, not of the Secondary's. A
   * small or extra-small tag grows to 28px to fit it.
   */
  secondaryText?: React.ReactNode;
  /**
   * Disables the Primary natively; or-ed with the InteractionTag's `disabled` (it cannot
   * re-enable a disabled tag).
   * @default false
   */
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

/** Props of InteractionTag.Secondary: the tag's separate Dismiss button. */
export interface InteractionTagSecondaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visually hidden text that names the button with the Primary's text ("Dismiss Cherry"). A text
   * label in the children replaces it ("Remove Cherry"); an `aria-label` replaces the whole name.
   * Localise it here.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
  /**
   * Disables the Secondary natively; or-ed with the InteractionTag's `disabled` (it cannot
   * re-enable a disabled tag).
   * @default false
   */
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** What an InteractionTag gives its two buttons (resolved values, never `undefined` but `pressed`). */
interface InteractionTagContextValue {
  size: TagSize;
  shape: TagShape;
  /** The look of both buttons: the appearance, or the selected look over it. */
  look: TagLook;
  /** Whether the tag is disabled (its own `disabled`, or its TagGroup's). */
  disabled: boolean;
  /** Whether the tag is selected (`data-selected`). */
  selected: boolean;
  /** The Primary's `aria-pressed`: `undefined` for an action that is not a toggle. */
  pressed: boolean | undefined;
  /** Whether a disabled button dims itself (`false` under a host that dims the tags as a whole). */
  dimDisabled: boolean;
  /** The id of the Primary's text, the second half of the Secondary's name. */
  primaryTextId: string;
  /** The Secondary, which Delete and Backspace on the Primary click (read at key time). */
  secondaryRef: React.RefObject<HTMLButtonElement | null> | null;
  /** Reports the dismissal to the TagGroup (its `onDismiss(value)`), after the Secondary's `onClick`. */
  dismiss: () => void;
}

/** Internal: `null` outside an InteractionTag. */
const InteractionTagContext = React.createContext<InteractionTagContextValue | null>(null);
InteractionTagContext.displayName = 'InteractionTagContext';

/** What a part reads outside an InteractionTag in production (C-CONTEXT): an enabled, unnamed tag. */
const INERT_CONTEXT: InteractionTagContextValue = {
  size: 'medium',
  shape: 'circular',
  look: 'filled',
  disabled: false,
  selected: false,
  pressed: undefined,
  dimDisabled: true,
  primaryTextId: '',
  secondaryRef: null,
  dismiss: () => {},
};

function useInteractionTagContext(componentName: string): InteractionTagContextValue {
  const context = React.useContext(InteractionTagContext);
  if (context) return context;
  reportMissingContext(componentName, 'InteractionTag');
  return INERT_CONTEXT;
}

/** Whether `value` is a key of `table` (an untyped value outside a union falls back). */
function isKeyOf<K extends string>(
  value: unknown,
  table: Readonly<Record<K, unknown>>,
): value is K {
  return typeof value === 'string' && Object.hasOwn(table, value);
}

/** The classes of a button's disabled states: dimmed, unless the host dims the tags itself. */
function disabledClasses(disabled: boolean, dimDisabled: boolean): string {
  return cn(
    dimDisabled
      ? [INTERACTION_TAG_DISABLED_CLASSES, mergedAriaDisabledClasses]
      : INTERACTION_TAG_UNDIMMED_DISABLED_CLASSES,
    disabled && forcedColors.disabled,
  );
}

/**
 * The state props of a tag button: natively disabled, or, while it keeps the focus it had when it
 * was disabled, the focusable disabled state (its click blocked).
 */
function buttonStateProps(disabled: boolean, held: boolean) {
  if (!disabled) return undefined;
  return held ? MERGED_DISABLED_FOCUSABLE_PROPS : { disabled: true };
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

// The InteractionTag root, documented on the exported `InteractionTag` const.
const InteractionTagRoot = ({
  value,
  appearance: appearanceProp,
  size: sizeProp,
  shape: shapeProp,
  disabled: disabledProp = false,
  selected: selectedProp,
  role,
  hidden,
  className,
  children,
  ref,
  ...rest
}: InteractionTagProps) => {
  const group = useTagGroupContext();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(rootRef, ref);
  const secondaryRef = React.useRef<HTMLButtonElement>(null);
  const primaryTextId = useId('interaction-tag-text');

  // The tag's own look, else its TagGroup's, else the default look.
  const size: TagSize = isKeyOf(sizeProp, tagSizeClasses) ? sizeProp : (group?.size ?? 'medium');
  const appearance: TagAppearance = isKeyOf(appearanceProp, tagAppearanceClasses)
    ? appearanceProp
    : (group?.appearance ?? 'filled');
  const shape: TagShape = isKeyOf(shapeProp, tagShapeClasses)
    ? shapeProp
    : (group?.shape ?? 'circular');
  // A disabled group disables every tag: the tag's own `disabled={false}` cannot re-enable it.
  const disabled = (group?.disabled ?? false) || disabledProp;
  const pressed = typeof selectedProp === 'boolean' ? selectedProp : undefined;
  const selected = pressed === true;
  // Disabled wins over the selected look; the attributes still reflect the state.
  const look: TagLook = selected && !disabled ? 'selected' : appearance;
  const dimDisabled = group?.dimDisabled ?? true;

  const reportedValue = useTagGroupItem(rootRef, value);
  const dismiss = useEventCallback(() => {
    group?.dismiss(reportedValue);
  });

  // In a list TagGroup the root is a list item; the consumer's role wins.
  const listItemRole = group?.mode === 'list' ? 'listitem' : undefined;
  // A host hides the tags it counts instead of showing them (TagPicker's `overflow="count"`).
  const hiddenByHost = value !== undefined && (group?.hiddenValues?.has(value) ?? false);

  const context = React.useMemo<InteractionTagContextValue>(
    () => ({
      size,
      shape,
      look,
      disabled,
      selected,
      pressed,
      dimDisabled,
      primaryTextId,
      secondaryRef,
      dismiss,
    }),
    [size, shape, look, disabled, selected, pressed, dimDisabled, primaryTextId, dismiss],
  );

  return (
    <InteractionTagContext.Provider value={context}>
      <div
        data-appearance={appearance}
        data-size={size}
        data-shape={shape}
        data-selected={selected ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-wave-tag-item=""
        role={role ?? listItemRole}
        hidden={hiddenByHost || hidden}
        {...rest}
        ref={mergedRef}
        className={cn(
          interactionTagClassNames.root,
          'group/interaction-tag inline-flex items-stretch',
          className,
        )}
      >
        {children}
      </div>
    </InteractionTagContext.Provider>
  );
};
InteractionTagRoot.displayName = 'InteractionTag';

// ---------------------------------------------------------------------------
// Primary
// ---------------------------------------------------------------------------

/**
 * The main action of an {@link InteractionTag}: a `<button type="button">` named by its text and
 * `secondaryText` (`media` and `icon` are decorative), with the InteractionTag's look. With the
 * InteractionTag's `selected` it is a toggle (`aria-pressed`). Delete and Backspace on it click
 * the tag's Secondary when there is one. Its props, `ref` and `className` go to the button.
 * Flat name of `InteractionTag.Primary`, for React Server Components.
 */
export const InteractionTagPrimary = ({
  media,
  icon,
  secondaryText,
  disabled: disabledProp = false,
  className,
  children,
  onKeyDown,
  onFocus,
  onBlur,
  ref,
  ...rest
}: InteractionTagPrimaryProps) => {
  const tag = useInteractionTagContext('InteractionTag.Primary');
  const { size, look } = tag;
  const disabled = tag.disabled || disabledProp;
  const hold = useHeldFocus(disabled);

  // Slots that render nothing render no element and take no room.
  const hasMedia = slotRendersContent(media);
  const hasIcon = slotRendersContent(icon);
  const secondary = materialiseSlotContent(secondaryText);
  const hasSecondary = slotRendersContent(secondary);
  const avatarBox = React.useMemo(() => ({ size: TAG_AVATAR_SIZE[size] }), [size]);

  // Delete and Backspace dismiss the tag through the Secondary's own click, so whatever cancels
  // that click (its `onClick`'s `preventDefault()`, a disabled or held Secondary) cancels them
  // too. Not from a portal opened from the Primary, and not while the Primary itself is held.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || event.target !== event.currentTarget || !isDismissKey(event)) return;
    const secondaryButton = tag.secondaryRef?.current;
    if (!secondaryButton || secondaryButton.disabled) return;
    event.preventDefault();
    secondaryButton.click();
  };

  const primaryText = (
    <span
      id={tag.primaryTextId || undefined}
      className={cn(
        interactionTagPrimaryClassNames.primaryText,
        hasSecondary && TAG_PRIMARY_TEXT_TWO_LINE_CLASSES,
      )}
    >
      {children}
    </span>
  );

  return (
    <button
      type="button"
      aria-pressed={tag.pressed}
      data-selected={tag.selected ? '' : undefined}
      {...rest}
      ref={ref}
      {...buttonStateProps(disabled, hold.held)}
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      onFocus={composeEventHandlers(onFocus, hold.onFocus, { checkDefaultPrevented: false })}
      onBlur={composeEventHandlers(onBlur, hold.onBlur, { checkDefaultPrevented: false })}
      className={cn(
        interactionTagPrimaryClassNames.root,
        INTERACTION_TAG_BUTTON_BASE_CLASSES,
        INTERACTION_TAG_PRIMARY_BASE_CLASSES,
        tagSizeClasses[size],
        tagStartInsetClasses[size][hasMedia ? 'media' : hasIcon ? 'icon' : 'text'],
        interactionTagPrimaryEndInsetClasses[size],
        interactionTagLookClasses[look],
        look === 'selected' && [
          forcedColors.selectedContainer,
          INTERACTION_TAG_SELECTED_FORCED_COLORS,
        ],
        tagShapeClasses[tag.shape],
        INTERACTION_TAG_PRIMARY_JOINED_CLASSES,
        disabledClasses(disabled, tag.dimDisabled),
        focusRing,
        size === 'extra-small' && INTERACTION_TAG_EXTRA_SMALL_HIT_CLASSES,
        className,
      )}
    >
      {hasMedia && (
        // An Avatar without its own `size` takes the tag's box.
        <AvatarSizeContext.Provider value={avatarBox}>
          {renderSlot(
            media,
            'span',
            cn(interactionTagPrimaryClassNames.media, tagMediaClasses[size]),
            { 'aria-hidden': true },
          )}
        </AvatarSizeContext.Provider>
      )}
      {hasIcon &&
        renderSlot(icon, 'span', cn(interactionTagPrimaryClassNames.icon, tagIconClasses[size]), {
          'aria-hidden': true,
        })}
      {hasSecondary ? (
        <span className={TAG_TEXT_COLUMN_CLASSES}>
          {primaryText}
          {/* A space between the two texts in the button's name ("Katri Designer"), whatever a
              name computation makes of the column; the column layout never renders it. */}{' '}
          <span
            className={cn(
              interactionTagPrimaryClassNames.secondaryText,
              TAG_SECONDARY_TEXT_CLASSES,
            )}
          >
            {secondary}
          </span>
        </span>
      ) : (
        primaryText
      )}
    </button>
  );
};
InteractionTagPrimary.displayName = 'InteractionTagPrimary';

// ---------------------------------------------------------------------------
// Secondary
// ---------------------------------------------------------------------------

const BUTTON_CHILD_MESSAGE =
  "InteractionTag.Secondary: its content received a button. A button cannot contain a button: its children became the content of the Dismiss button and its props were dropped. Pass icon content, and handle the dismissal in `onClick` or in the TagGroup's `onDismiss`.";

const noop = () => {};

/**
 * The separate Dismiss button of an {@link InteractionTag}: a `<button type="button">` after the
 * Primary, named `dismissLabel` plus the Primary's text ("Dismiss Cherry"). Its children replace
 * the default dismiss glyph; a text label among them replaces `dismissLabel` in the name ("Remove
 * Cherry"), an `aria-label` the whole name. A button passed as its child is unwrapped (its children
 * become the content). Enter, Space, a click, Delete and Backspace call its `onClick`, then, in a
 * TagGroup, the group's `onDismiss(value)`. Its props, `ref` and `className` go to the button.
 * Flat name of `InteractionTag.Secondary`, for React Server Components.
 */
export const InteractionTagSecondary = ({
  dismissLabel = 'Dismiss',
  disabled: disabledProp = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  className,
  children,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  ref,
  ...rest
}: InteractionTagSecondaryProps) => {
  const tag = useInteractionTagContext('InteractionTag.Secondary');
  const { size, look } = tag;
  const disabled = tag.disabled || disabledProp;
  const hold = useHeldFocus(disabled);
  const dismissLabelId = useId('interaction-tag-dismiss');
  const contentId = useId('interaction-tag-dismiss-content');
  const ownRef = React.useRef<HTMLButtonElement>(null);
  const mergedRef = useMergedRefs<HTMLButtonElement>(ownRef, tag.secondaryRef, ref);
  // Unmounting while it has focus (rendered conditionally), the Secondary hands focus to its own
  // tag's Primary; in a TagGroup, when the whole tag goes, the tag's own move applies (D35).
  useDismissControlFocus(ownRef);

  // Its children are the glyph inside the Dismiss button: a button there would nest buttons, so
  // it is unwrapped (C-SLOTS glyph rule).
  const { glyph, button: unwrapped } = unwrapButtonGlyph(children as Slot<'span'>);
  React.useEffect(() => {
    if (unwrapped) warnOnce('InteractionTag.Secondary:button-child', BUTTON_CHILD_MESSAGE);
  }, [unwrapped]);
  const content = materialiseSlotContent(glyph);
  const hasContent = slotRendersContent(content);
  const literalTextLabel = hasContent && hasTextLabel(content);

  // C-SLOTS naming (WCAG 2.5.3 Label in Name): a text label in the children replaces
  // `dismissLabel` ("Remove Cherry"). The literal children decide on the server and on the first
  // render; after mount, the rendered content does (text from components, later changes).
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
  // A consumer `aria-label` replaces the whole name; a consumer `aria-labelledby` replaces ours.
  const namedByConsumer = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  const labelledBy = namedByConsumer
    ? ariaLabelledBy
    : joinIds(hasContent && contentHasTextLabel ? contentId : dismissLabelId, tag.primaryTextId);

  // The consumer's `onClick` first (its `preventDefault()` keeps the group from hearing of it),
  // then the TagGroup's `onDismiss(value)`; never for a click from a portal opened inside.
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isOwnEvent(event)) tag.dismiss();
  };
  // Delete and Backspace dismiss as Enter does: through the button's own click, so whatever
  // cancels a click (its `onClick`'s `preventDefault()`, a held or disabled button) cancels them.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.target !== event.currentTarget || !isDismissKey(event)) return;
    event.preventDefault();
    event.currentTarget.click();
  };

  return (
    <button
      type="button"
      data-wave-tag-dismiss=""
      data-selected={tag.selected ? '' : undefined}
      {...rest}
      ref={mergedRef}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      onClick={composeEventHandlers(onClick, handleClick)}
      {...buttonStateProps(disabled, hold.held)}
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      onFocus={composeEventHandlers(onFocus, hold.onFocus, { checkDefaultPrevented: false })}
      onBlur={composeEventHandlers(onBlur, hold.onBlur, { checkDefaultPrevented: false })}
      className={cn(
        interactionTagSecondaryClassNames.root,
        INTERACTION_TAG_BUTTON_BASE_CLASSES,
        INTERACTION_TAG_SECONDARY_BASE_CLASSES,
        interactionTagSecondarySizeClasses[size],
        interactionTagLookClasses[look],
        look === 'selected' && [
          forcedColors.selectedContainer,
          INTERACTION_TAG_SELECTED_FORCED_COLORS,
        ],
        interactionTagDividerClasses[look],
        interactionTagSecondaryShapeClasses[tag.shape],
        disabledClasses(disabled, tag.dimDisabled),
        focusRing,
        size === 'extra-small' && INTERACTION_TAG_EXTRA_SMALL_HIT_CLASSES,
        className,
      )}
    >
      {!namedByConsumer && (
        <span id={dismissLabelId} className="sr-only">
          {dismissLabel}
        </span>
      )}
      {hasContent ? (
        <span
          id={contentId}
          ref={setLabelTarget}
          className={cn(
            interactionTagSecondaryClassNames.dismissIcon,
            'inline-flex items-center justify-center',
          )}
        >
          {content}
        </span>
      ) : (
        <DismissIcon
          size={TAG_DISMISS_GLYPH_SIZE[size]}
          className={interactionTagSecondaryClassNames.dismissIcon}
        />
      )}
    </button>
  );
};
InteractionTagSecondary.displayName = 'InteractionTagSecondary';

// ---------------------------------------------------------------------------
// Compound
// ---------------------------------------------------------------------------

/**
 * A tag with a main action and a separate Dismiss button: an element that holds two sibling
 * buttons, `InteractionTag.Primary` (the action) and `InteractionTag.Secondary` (Dismiss), never
 * one inside the other. Use it for a chip the user acts on (opens, toggles) and can also remove;
 * a `Tag` is a chip that only displays, or only dismisses.
 *
 * - **Two Tab stops**, the Primary then the Secondary. In a TagGroup toolbar both join its arrow
 *   order (Primary, Secondary, next tag).
 * - **The Secondary is named after the Primary's text**: its `dismissLabel` plus the primary
 *   text, "Dismiss Cherry" (never the secondary text). A text label in its children replaces
 *   `dismissLabel` ("Remove Cherry"); an `aria-label` replaces the whole name.
 * - **Delete and Backspace** on either button dismiss the tag through the Secondary's click (a
 *   held key dismisses once); without a Secondary they do nothing. Enter, Space and a click on the
 *   Secondary dismiss too: remove the tag in its `onClick`, or in a TagGroup's `onDismiss(value)`,
 *   which is called after it.
 * - **`selected`** draws the selected look and makes the Primary a toggle (`aria-pressed`); leave
 *   it `undefined` for an action that is not a toggle.
 * - **Look**: `size`, `appearance` and `shape`, Tag's sizes and colours (a TagGroup gives its
 *   defaults); `disabled` disables both buttons natively. The Primary takes `media` (an Avatar,
 *   sized for the tag), `icon` and `secondaryText`.
 * - Fluent's `hasSecondaryAction` is not needed: the Primary squares its end corners next to a
 *   Secondary by itself, also when the Secondary is rendered conditionally or wrapped.
 * - React Server Components cannot dot into a client module: import the flat names
 *   `InteractionTagPrimary` and `InteractionTagSecondary` there.
 * - Renders `data-appearance`, `data-size` and `data-shape`, and while set `data-selected` and
 *   `data-disabled`, on the root; `data-selected` on both buttons.
 *
 * @example
 * <InteractionTag value="cherry">
 *   <InteractionTag.Primary icon={<FruitIcon />} onClick={openDetails}>
 *     Cherry
 *   </InteractionTag.Primary>
 *   <InteractionTag.Secondary onClick={() => remove('cherry')} />
 * </InteractionTag>
 */
export const InteractionTag = /* @__PURE__ */ Object.assign(InteractionTagRoot, {
  Primary: InteractionTagPrimary,
  Secondary: InteractionTagSecondary,
});
