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
  isRepeatedActivation,
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
  INTERACTION_TAG_SECONDARY_LABEL_CLASSES,
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
   * Identifies the tag in a TagGroup: the value `onDismiss` receives and the selection holds. Give
   * every tag of a group its own value.
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
   * Outside a selecting TagGroup: draws the selected look and makes the Primary a toggle:
   * `aria-pressed="true"`, or `"false"` for `selected={false}`. Leave it `undefined` for an
   * action that is not a toggle (no `aria-pressed`). Inside a selecting TagGroup (`value`,
   * `defaultValue` or `onValueChange`) the group's `value` decides, and a defined `selected` is
   * ignored (a development warning). Rendered as `data-selected` on the root and both buttons.
   * Disabled wins over the selected look (`aria-pressed` and `data-selected` still render).
   * Fluent's `selected` is a look only.
   */
  selected?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** Props of InteractionTag.Primary: the tag's main action (or its toggle in a selecting TagGroup). */
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
   * Localise it here. Fluent's order is the primary text, then the label ("Cherry remove").
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
  /** Which Primaries render, so the Secondary points at the primary text only while one does. */
  primaries: PrimaryRegistry;
  /** The Secondary, which Delete and Backspace on the Primary click (read at key time). */
  secondaryRef: React.RefObject<HTMLButtonElement | null> | null;
  /**
   * Reports the dismissal to the TagGroup (its `onDismiss(value)`), after the Secondary's
   * `onClick`, and then removes the tag's value from the group's selection (D39).
   */
  dismiss: () => void;
  /** Toggles the tag's value in a selecting TagGroup's selection (the Primary's click). */
  toggle: () => void;
}

const noop = () => {};

/**
 * The Primaries an InteractionTag renders, read by its Secondary, whose name points at the
 * primary text only while a Primary renders it (no id reference to a missing element). Until the
 * root's first commit (the server render, hydration and the first client render) a Primary is
 * assumed, so the server HTML holds the whole name and a tag with a Primary renders once; a
 * Secondary without one drops the id after that commit, and takes it again when one mounts. An
 * external store (C-HOOKS): a Primary registers from a layout effect.
 */
interface PrimaryRegistry {
  subscribe: (onChange: () => void) => () => void;
  /** Whether the Secondary's name may point at the primary text. */
  hasPrimary: () => boolean;
  /** For a Primary's layout effect: returns its cleanup. */
  register: () => () => void;
  /** For the root's layout effect: from now on the registrations decide. */
  settle: () => void;
}

function createPrimaryRegistry(): PrimaryRegistry {
  let count = 0;
  let settled = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    hasPrimary: () => !settled || count > 0,
    register: () => {
      count += 1;
      notify();
      return () => {
        count -= 1;
        notify();
      };
    },
    settle: () => {
      if (settled) return;
      settled = true;
      notify();
    },
  };
}

/** The registry of the inert context: a Primary is always assumed. */
const INERT_PRIMARY_REGISTRY: PrimaryRegistry = {
  subscribe: () => noop,
  hasPrimary: () => true,
  register: () => noop,
  settle: noop,
};

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
  primaries: INERT_PRIMARY_REGISTRY,
  secondaryRef: null,
  dismiss: () => {},
  toggle: () => {},
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

const SELECTED_IN_GROUP_MESSAGE =
  "InteractionTag: `selected` has no effect in a TagGroup that selects (`value`, `defaultValue` or `onValueChange`); the group's `value` decides.";

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
  // After the first commit, the Primaries that registered decide the Secondary's name (D43).
  const [primaries] = React.useState(createPrimaryRegistry);
  React.useLayoutEffect(() => {
    primaries.settle();
  }, [primaries]);

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
  const dimDisabled = group?.dimDisabled ?? true;

  // In a group that reports dismissals or selects, the tag's value (else a generated id).
  const reportedValue = useTagGroupItem(rootRef, value);
  // In a selecting TagGroup the group's selection decides (the Primary is always a toggle there);
  // elsewhere a boolean `selected` does, and `undefined` is an action that is no toggle.
  const selecting = group?.selecting ?? false;
  const pressed = selecting
    ? (group?.isSelected(reportedValue) ?? false)
    : typeof selectedProp === 'boolean'
      ? selectedProp
      : undefined;
  const selected = pressed === true;
  // Disabled wins over the selected look; the attributes still reflect the state.
  const look: TagLook = selected && !disabled ? 'selected' : appearance;

  const selectedIgnored = selecting && selectedProp !== undefined;
  React.useEffect(() => {
    if (selectedIgnored) warnOnce('InteractionTag:selected-in-group', SELECTED_IN_GROUP_MESSAGE);
  }, [selectedIgnored]);

  // The group's `onDismiss(value)`, then the value leaves the selection (D39), in one click.
  const dismiss = useEventCallback(() => {
    group?.dismiss(reportedValue);
    group?.deselect(reportedValue);
  });
  const toggle = useEventCallback(() => {
    group?.toggle(reportedValue);
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
      primaries,
      secondaryRef,
      dismiss,
      toggle,
    }),
    [
      size,
      shape,
      look,
      disabled,
      selected,
      pressed,
      dimDisabled,
      primaryTextId,
      primaries,
      dismiss,
      toggle,
    ],
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
 * `secondaryText` (`media` and `icon` are decorative), with the InteractionTag's look. In a
 * selecting TagGroup it is a toggle (`aria-pressed`): a click, Enter or Space adds the tag's
 * `value` to the group's selection or removes it, after its `onClick` (whose `preventDefault()`
 * cancels the toggle). Elsewhere the InteractionTag's `selected` makes it a toggle. Either state
 * renders its `aria-pressed` over one passed here, which applies only when neither is set. Delete
 * and Backspace on it click the tag's Secondary when there is one. Its props, `ref` and
 * `className` go to the button. Flat name of `InteractionTag.Primary`, for React Server
 * Components.
 */
export const InteractionTagPrimary = ({
  media,
  icon,
  secondaryText,
  disabled: disabledProp = false,
  'aria-pressed': ariaPressed,
  className,
  children,
  onClick,
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
  // Its text names the Secondary while it renders (D43).
  const registerPrimary = tag.primaries.register;
  React.useLayoutEffect(() => registerPrimary(), [registerPrimary]);

  // Slots that render nothing render no element and take no room.
  const hasMedia = slotRendersContent(media);
  const hasIcon = slotRendersContent(icon);
  const secondary = materialiseSlotContent(secondaryText);
  const hasSecondary = slotRendersContent(secondary);
  const avatarBox = React.useMemo(() => ({ size: TAG_AVATAR_SIZE[size] }), [size]);

  // In a selecting TagGroup a click (also Enter and Space) toggles the tag's value, after the
  // consumer's `onClick`; never for a click from a portal opened from the Primary (C-COMPOSE).
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && isOwnEvent(event)) tag.toggle();
  };

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
      // The tag's state (`selected`, or a selecting TagGroup's value) decides; a consumer
      // `aria-pressed` applies only to a Primary that is no toggle of the tag's.
      aria-pressed={tag.pressed ?? ariaPressed}
      data-selected={tag.selected ? '' : undefined}
      {...rest}
      ref={ref}
      onClick={composeEventHandlers(onClick, handleClick)}
      // After `onClick`: a held Primary's click is blocked, the toggle included.
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
  const hasLabel = hasContent && contentHasTextLabel;
  // The primary text joins the name while a Primary renders it.
  const hasPrimary = React.useSyncExternalStore(
    tag.primaries.subscribe,
    tag.primaries.hasPrimary,
    () => true,
  );
  // A consumer `aria-label` replaces the whole name; a consumer `aria-labelledby` replaces ours.
  const namedByConsumer = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  const labelledBy = namedByConsumer
    ? ariaLabelledBy
    : joinIds(hasLabel ? contentId : dismissLabelId, hasPrimary ? tag.primaryTextId : undefined);

  // The consumer's `onClick` first (its `preventDefault()` keeps the group from hearing of it),
  // then the TagGroup's `onDismiss(value)`; never for a click from a portal opened inside.
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isOwnEvent(event)) tag.dismiss();
  };
  // Delete and Backspace dismiss as Enter does: through the button's own click, so whatever
  // cancels a click (its `onClick`'s `preventDefault()`, a held or disabled button) cancels them.
  // A held key dismisses one tag: the browser clicks a button on every repeated Enter, which
  // would reach the next tag's Dismiss control once focus moved there (D35).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.target !== event.currentTarget) return;
    if (isRepeatedActivation(event)) {
      event.preventDefault();
      return;
    }
    if (!isDismissKey(event)) return;
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
            // A text label keeps clear of the divider and the tag's end; a glyph needs no room.
            hasLabel && INTERACTION_TAG_SECONDARY_LABEL_CLASSES,
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
 * - **In a selecting TagGroup** (`value`, `defaultValue` or `onValueChange` on the group) the
 *   Primary toggles the tag's `value` in the group's selection (`aria-pressed`, the selected
 *   look), and dismissing a selected tag also removes its value from the selection.
 * - **`selected`**, outside a selecting TagGroup, draws the selected look and makes the Primary a
 *   toggle (`aria-pressed`); leave it `undefined` for an action that is not a toggle.
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
