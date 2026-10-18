import * as React from 'react';
import { warnOnce } from '../../lib/dev';
import { FOCUSABLE_SELECTOR, isConnectedAndFocusable, isFocusable } from '../../lib/focus';
import type { TagAppearance, TagShape, TagSize } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';

/*
 * The internal state of the tag family: the TagGroup context its tags read, the host seams
 * TagPicker gives the TagGroup and the Tags it renders, the tag item hooks (value registration and
 * focus after a removal), the held focus of a control disabled while it has focus, and the
 * Delete/Backspace key test. Module-only (never exported from a barrel), and it imports no
 * component, so a module that reads it (Tag) holds no TagGroup or InteractionTag code.
 */

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

/** Every TagGroup root (`data-wave-tag-group`, always rendered). */
export const TAG_GROUP_SELECTOR = '[data-wave-tag-group]';
/** Every Tag and InteractionTag root (`data-wave-tag-item`, always rendered). */
export const TAG_ITEM_SELECTOR = '[data-wave-tag-item]';
/** Every Tag Dismiss button and InteractionTag Secondary (`data-wave-tag-dismiss`, always rendered). */
export const TAG_DISMISS_SELECTOR = '[data-wave-tag-dismiss]';

// ---------------------------------------------------------------------------
// Host seams (frozen, spec §4.1 T-T7)
// ---------------------------------------------------------------------------

/** Options a host component (TagPicker.Group) gives the TagGroup it renders; not public props. */
export interface TagGroupHostOptions {
  /**
   * Where focus goes after the tag that had it is removed: `'next-then-previous'` (TagGroup's own
   * order: next tag, else previous, else `fallbackFocusRef`) or `'next'` (next tag, else
   * `fallbackFocusRef`; never a previous tag).
   * @default 'next-then-previous'
   */
  removalFocus?: 'next-then-previous' | 'next';
  /** Values of the tags (Tag or InteractionTag) that render `hidden` (TagPicker's `overflow="count"`). */
  hiddenValues?: ReadonlySet<string>;
  /**
   * Whether a disabled tag dims itself. `false`: the host dims the area that holds the tags as a
   * whole (TagPicker's control while the picker is disabled), so a disabled Tag drops its own
   * dimming and its focus-ring lift, and an InteractionTag's buttons theirs; the native
   * `disabled`, the not-allowed cursor, the held focus of T-T6 and the forced-colours GrayText
   * stay.
   * @default true
   */
  dimDisabled?: boolean;
}

/** Read by the nearest TagGroup, which passes the options to its tags and provides `null` to its own subtree. */
export const TagGroupHostContext = React.createContext<TagGroupHostOptions | null>(null);
TagGroupHostContext.displayName = 'TagGroupHostContext';

/** What a host component (TagPicker) gives a Tag it renders itself. */
export interface TagHostContextValue {
  /**
   * The whole accessible name of the Tag's Dismiss button: rendered as `aria-label`, with no
   * `aria-labelledby` and no visually hidden `dismissLabel` text (the tag's `textContent` is its
   * own text). The 0.10 `Tag:dismissIcon-name` rule for slot names is unchanged.
   */
  dismissName?: string;
  /** Classes merged after the Dismiss button's own (TagPicker's `removeButton` part class). */
  dismissButtonClassName?: string;
}

/** Read by every Tag below it (TagPicker wraps each default tag in its own provider). */
export const TagHostContext = React.createContext<TagHostContextValue | null>(null);
TagHostContext.displayName = 'TagHostContext';

// ---------------------------------------------------------------------------
// TagGroup context (internal to the tag family)
// ---------------------------------------------------------------------------

/** The keyboard model of a TagGroup: an APG toolbar (the default) or a list of static tags. */
export type TagGroupMode = 'toolbar' | 'list';

/** What a TagGroup gives the tags inside it (resolved values, never `undefined`). */
export interface TagGroupContextValue {
  /** `'toolbar'`: one Tab stop and arrow keys; `'list'`: every tag root is a list item. */
  mode: TagGroupMode;
  /** The default `size` of its tags (a tag's own wins). */
  size: TagSize;
  /** The default `appearance` of its tags (a tag's own wins). */
  appearance: TagAppearance;
  /** The default `shape` of its tags (a tag's own wins). */
  shape: TagShape;
  /** Whether the group is disabled: it disables every tag, whatever the tag's own `disabled`. */
  disabled: boolean;
  /** The default `dismissible` of its Tags (a Tag's own value wins). */
  dismissible: boolean;
  /**
   * Reports a dismissal to the group (its `onDismiss(value)`). Called synchronously inside the
   * Dismiss control's click handler, after the tag's own handler.
   */
  dismiss: (value: string) => void;
  /** Whether the group reports dismissals (`onDismiss` is set): a dismissible tag then needs a `value`. */
  reportsDismissals: boolean;
  /**
   * Whether the group selects (`value`, `defaultValue` or `onValueChange` is set): its
   * InteractionTags are toggles, and each needs a `value`.
   */
  selecting: boolean;
  /** Whether `value` is in the group's selection (always `false` in a group that does not select). */
  isSelected: (value: string) => boolean;
  /**
   * Adds `value` to the selection, or removes it, keeping selection order (an InteractionTag
   * Primary's click). Does nothing in a group that does not select or while it is disabled.
   */
  toggle: (value: string) => void;
  /**
   * Removes `value` from the selection when it is in it: a dismissed InteractionTag leaves the
   * selection, after the group's `onDismiss(value)` (D39). Does nothing otherwise.
   */
  deselect: (value: string) => void;
  /**
   * Counts a mounted tag's explicit `value`; a second registration of one value warns once while
   * the group reports values (C-DEV). Call it from a layout effect and the returned remover in its
   * cleanup.
   */
  register: (value: string) => () => void;
  /** The group's root element. */
  rootRef: React.RefObject<HTMLElement | null>;
  /** Where focus goes when the removed tag that had it leaves no other tag to take it. */
  fallbackFocusRef: React.RefObject<HTMLElement | null> | undefined;
  /** The order of D35's focus move, from the host (`'next-then-previous'` without one). */
  removalFocus: 'next-then-previous' | 'next';
  /** The values whose tags render `hidden`, from the host. */
  hiddenValues: ReadonlySet<string> | undefined;
  /** Whether a disabled tag dims itself, from the host (`true` without one). */
  dimDisabled: boolean;
}

/** Internal: read with {@link useTagGroupContext}. `null` outside a TagGroup. */
export const TagGroupContext = React.createContext<TagGroupContextValue | null>(null);
TagGroupContext.displayName = 'TagGroupContext';

/**
 * The nearest TagGroup's context, or `null` outside one. Membership is optional (a Tag works on
 * its own), so a missing group is not reported (as `useFieldContext`).
 */
export function useTagGroupContext(): TagGroupContextValue | null {
  return React.useContext(TagGroupContext);
}

// ---------------------------------------------------------------------------
// Delete and Backspace (D33)
// ---------------------------------------------------------------------------

/**
 * Whether a key press dismisses the tag it belongs to (D33): Delete or Backspace, not prevented
 * already (a merged slot's or the consumer's handler that ran first), not repeated (a held key
 * dismisses one tag), without Ctrl, Alt or Meta (Shift is allowed) and not while an input method
 * composes text. Each handler adds its own target rule (the control itself; on a Tag root, a target
 * in the primary text that is not an editable field).
 */
export function isDismissKey(event: React.KeyboardEvent): boolean {
  return (
    (event.key === 'Delete' || event.key === 'Backspace') &&
    !event.defaultPrevented &&
    !event.repeat &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.nativeEvent.isComposing
  );
}

/**
 * Whether a key press on a Dismiss control (Tag's Dismiss button, `InteractionTag.Secondary`) is a
 * repeated Enter: a held Enter, which the browser turns into a click on every repeat. The control
 * cancels it (`preventDefault()`), so a held Enter dismisses one tag, as a held Delete, Backspace
 * or Space does; otherwise, once focus moved to the next tag's Dismiss control, the repeats would
 * dismiss that one too.
 */
export function isRepeatedActivation(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' && event.repeat;
}

// ---------------------------------------------------------------------------
// Focus after a removal (D35)
// ---------------------------------------------------------------------------

/** What a tag, or a tag's Dismiss control, records when it unmounts while it holds focus. */
interface RemovalRecord {
  /** The tag roots focus may move to, in the order they are tried. */
  candidates: HTMLElement[];
  /** Whether the control that had focus was a Dismiss control (the corresponding-control rule). */
  fromDismiss: boolean;
  /** The group's fallback, read when the move runs. */
  fallbackFocusRef: React.RefObject<HTMLElement | null> | undefined;
  /**
   * The root of the group the removed element was in. A lost focus warns only while it is still
   * in the document: a tag removed from a group that stays, not a whole group that unmounts.
   */
  groupRoot: HTMLElement | null;
}

/**
 * Whether `element` is an enabled control focus may move to: it can take focus, and it is not
 * `aria-disabled` unless it is a focusable disabled control (`data-disabled-focusable`), which a
 * toolbar keeps in its arrow order too. A disabled link chip has no `href` but may keep the
 * `tabindex` a toolbar gave it while it was enabled: focusable, yet no candidate.
 */
function isEnabledControl(element: HTMLElement): boolean {
  if (!isFocusable(element)) return false;
  return (
    element.getAttribute('aria-disabled') !== 'true' ||
    element.hasAttribute('data-disabled-focusable')
  );
}

/** The first enabled control of `root` (itself first), or `null`. */
function firstEnabledControl(root: HTMLElement): HTMLElement | null {
  if (root.matches(FOCUSABLE_SELECTOR) && isEnabledControl(root)) return root;
  for (const element of root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (isEnabledControl(element)) return element;
  }
  return null;
}

/**
 * The control of `candidate` that takes focus: its enabled Dismiss control when the removed
 * control was one, else its first enabled control (`null`: the candidate does not count).
 */
function correspondingControl(candidate: HTMLElement, fromDismiss: boolean): HTMLElement | null {
  if (fromDismiss) {
    const dismiss = candidate.querySelector<HTMLElement>(TAG_DISMISS_SELECTOR);
    if (dismiss && isEnabledControl(dismiss)) return dismiss;
  }
  return firstEnabledControl(candidate);
}

/**
 * The record of `node` (a tag root, or a Dismiss control) taken while it still holds focus, in
 * its layout cleanup, before React removes its nodes: the tags of its group after it in DOM order,
 * then (order `'next-then-previous'`) those before it, nearest first; a Dismiss control's own tag
 * comes first. A tag outside a group has only its own tag (for a Dismiss control) or nothing.
 */
function recordRemoval(
  node: HTMLElement,
  item: HTMLElement | null,
  group: TagGroupContextValue | null,
): RemovalRecord {
  const active = node.ownerDocument.activeElement;
  const dismissControl = active?.closest(TAG_DISMISS_SELECTOR);
  const fromDismiss = !!dismissControl && node.contains(dismissControl);
  const ownItemFirst = item !== null && item !== node;
  const candidates: HTMLElement[] = ownItemFirst ? [item] : [];

  const groupRoot = item?.parentElement?.closest<HTMLElement>(TAG_GROUP_SELECTOR) ?? null;
  if (item && groupRoot) {
    const items = Array.from(groupRoot.querySelectorAll<HTMLElement>(TAG_ITEM_SELECTOR)).filter(
      (element) => element.parentElement?.closest(TAG_GROUP_SELECTOR) === groupRoot,
    );
    const index = items.indexOf(item);
    if (index !== -1) {
      candidates.push(...items.slice(index + 1));
      if ((group?.removalFocus ?? 'next-then-previous') === 'next-then-previous') {
        candidates.push(...items.slice(0, index).reverse());
      }
    }
  }

  return {
    candidates,
    fromDismiss,
    fallbackFocusRef: group?.fallbackFocusRef,
    groupRoot: group ? groupRoot : null,
  };
}

const FOCUS_LOST_MESSAGE =
  'TagGroup: the tag that had focus was removed and no other tag could take focus, so focus fell to the page. Pass `fallbackFocusRef` (for example an "Add" or "Reset filters" button outside the group).';

/**
 * Where focus goes after the removal `record` describes (run in the microtask after the commit):
 * the corresponding control of the first candidate still connected that has one, else the group's
 * `fallbackFocusRef` when it is connected and focusable, else nothing (a development warning while
 * the group stays in the document).
 */
function resolveRemovalTarget(record: RemovalRecord | null): HTMLElement | null {
  if (!record) return null;
  for (const candidate of record.candidates) {
    if (!candidate.isConnected) continue;
    const control = correspondingControl(candidate, record.fromDismiss);
    if (control) return control;
  }
  const fallback = record.fallbackFocusRef?.current;
  if (fallback && isConnectedAndFocusable(fallback)) return fallback;
  if (record.groupRoot?.isConnected) warnOnce('TagGroup:focus-lost', FOCUS_LOST_MESSAGE);
  return null;
}

/** The latest render's view of a removable element, read by its unmount cleanup. */
interface RemovalState {
  node: HTMLElement | null;
  group: TagGroupContextValue | null;
  /** Whether the element is a Dismiss control (its own tag is then tried first). */
  isControl: boolean;
}

/**
 * Moves focus when the element `ref` holds unmounts while focus is inside it: the record is taken
 * in the layout cleanup (the nodes are still in the document) and the move runs in a microtask,
 * through `usePreserveFocus` (a remount cancels it, and focus placed elsewhere first wins).
 */
function useRemovalFocus(
  ref: React.RefObject<HTMLElement | null>,
  group: TagGroupContextValue | null,
  isControl: boolean,
  enabled: boolean,
): void {
  const stateRef = React.useRef<RemovalState>({ node: null, group, isControl });
  const recordRef = React.useRef<RemovalRecord | null>(null);

  React.useLayoutEffect(() => {
    stateRef.current = { node: ref.current, group, isControl };
  });

  React.useLayoutEffect(() => {
    const state = stateRef;
    const record = recordRef;
    record.current = null;
    return () => {
      const { node, group: currentGroup, isControl: control } = state.current;
      const active = node?.ownerDocument.activeElement;
      if (!node || !active || !node.contains(active)) return;
      const item = control ? node.parentElement?.closest<HTMLElement>(TAG_ITEM_SELECTOR) : node;
      record.current = recordRemoval(node, item ?? null, currentGroup);
    };
  }, []);

  usePreserveFocus(ref, () => resolveRemovalTarget(recordRef.current), { enabled });
}

const MISSING_VALUE_MESSAGE =
  'TagGroup: a tag without `value` is in a group with `onDismiss` or a selection, so it is reported by a generated id. Give every tag a `value`.';

/** Options of {@link useTagGroupItem}. */
export interface UseTagGroupItemOptions {
  /**
   * Whether the group reports this tag's value: a tag without `value` then warns once
   * (`TagGroup:missing-value`). A Tag passes whether it is dismissible in a group with
   * `onDismiss` (a Tag is never selected).
   * @default whether the group reports dismissals (it has `onDismiss`) or selects
   */
  reported?: boolean;
}

/**
 * The tag-family item hook (D35, D37), for a Tag or InteractionTag root:
 *
 * - registers the tag's explicit `value` with the nearest TagGroup from a layout effect (the
 *   duplicate-value warning);
 * - warns once when the group reports the value (`options.reported`: it has `onDismiss` or
 *   selects) and the tag has none;
 * - in a group, keeps focus in the group when the tag unmounts while focus is inside it: in a
 *   microtask after the commit, to the corresponding control of the next tag that has an enabled
 *   one, else (order `'next-then-previous'`) of the previous one, else to the group's
 *   `fallbackFocusRef`, else nowhere (`TagGroup:focus-lost`). A tag outside a group moves no focus
 *   when it goes.
 *
 * @param rootRef The tag's root element.
 * @param value   The tag's `value`.
 * @param options See {@link UseTagGroupItemOptions}.
 * @returns The value the group reports for the tag: `value`, else a generated id.
 */
export function useTagGroupItem(
  rootRef: React.RefObject<HTMLElement | null>,
  value: string | undefined,
  options?: UseTagGroupItemOptions,
): string {
  const group = React.useContext(TagGroupContext);
  const generatedId = useId('tag');
  const register = group?.register;

  React.useLayoutEffect(() => {
    if (!register || value === undefined) return undefined;
    return register(value);
  }, [register, value]);

  const reported =
    options?.reported ?? ((group?.reportsDismissals ?? false) || (group?.selecting ?? false));
  const missingValue = group !== null && reported && value === undefined;
  React.useEffect(() => {
    if (missingValue) warnOnce('TagGroup:missing-value', MISSING_VALUE_MESSAGE);
  }, [missingValue]);

  useRemovalFocus(rootRef, group, false, group !== null);
  return value ?? generatedId;
}

/**
 * For a tag's Dismiss control (Tag's Dismiss button, `InteractionTag.Secondary`): when it unmounts
 * while it has focus and its tag stays (`dismissible` turning `false`, a Secondary rendered
 * conditionally), focus moves to its own tag's first enabled control (a link in a Tag's text, the
 * Primary), else, in a group, as {@link useTagGroupItem} moves it. When its tag goes with it, the
 * tag's own move applies.
 *
 * @param controlRef The Dismiss control.
 */
export function useDismissControlFocus(controlRef: React.RefObject<HTMLElement | null>): void {
  const group = React.useContext(TagGroupContext);
  useRemovalFocus(controlRef, group, true, true);
}

// ---------------------------------------------------------------------------
// Held focus (D25)
// ---------------------------------------------------------------------------

/** What {@link useHeldFocus} returns for one tag control. */
export interface HeldFocus {
  /**
   * Whether the control is held: it became disabled while it had focus, so it renders the
   * focusable disabled state (`aria-disabled`, `data-disabled`, `data-disabled-focusable`, its
   * click blocked) instead of the native `disabled` until focus leaves it. Always `false` while
   * the control is enabled.
   */
  held: boolean;
  /**
   * Records that the control has focus (an event whose target is the control itself). Compose it
   * after the consumer's handler with `{ checkDefaultPrevented: false }`.
   */
  onFocus: (event: React.FocusEvent<HTMLElement>) => void;
  /**
   * Records that focus left the control, which ends the hold. A blur after which focus went
   * nowhere (`relatedTarget` is `null` and the document has no focus: the window lost focus to
   * another app or tab) leaves the control the active element, so it keeps the hold. Compose it
   * after the consumer's handler with `{ checkDefaultPrevented: false }`.
   */
  onBlur: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Keeps a tag control that is disabled while it has focus focusable until focus leaves it (Tag's
 * Dismiss button, its link or button root, InteractionTag's buttons): the browser drops focus to
 * the page from a control that becomes natively disabled, and a standalone tag has no neighbour to
 * move it to. Render the native `disabled` while `disabled && !held`, the focusable disabled
 * state while `held`. The hold is adjusted during render from the previous `disabled`, never in
 * an effect.
 *
 * @param disabled The control's effective `disabled` (its own, its tag's, its group's).
 *
 * @example
 * const hold = useHeldFocus(disabled);
 * <button
 *   type="button"
 *   {...(disabled ? (hold.held ? MERGED_DISABLED_FOCUSABLE_PROPS : { disabled: true }) : null)}
 *   onFocus={composeEventHandlers(onFocus, hold.onFocus, { checkDefaultPrevented: false })}
 *   onBlur={composeEventHandlers(onBlur, hold.onBlur, { checkDefaultPrevented: false })}
 * />
 */
export function useHeldFocus(disabled: boolean): HeldFocus {
  const [focused, setFocused] = React.useState(false);
  const [held, setHeld] = React.useState(false);
  // A control that turns disabled while it has focus is held; one that turns enabled is not.
  const [prevDisabled, setPrevDisabled] = React.useState(disabled);
  let isHeld = held;
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    isHeld = disabled && focused;
    if (isHeld !== held) setHeld(isHeld);
  }

  const onFocus = (event: React.FocusEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) setFocused(true);
  };
  const onBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    // As in `useRestoreFocus`'s focus tracker, a blur after which the control is still the
    // active element (the window lost focus) is no departure.
    const departed = event.relatedTarget !== null || event.currentTarget.ownerDocument.hasFocus();
    if (!departed) return;
    setFocused(false);
    setHeld(false);
  };

  return { held: disabled && isHeld, onFocus, onBlur };
}
