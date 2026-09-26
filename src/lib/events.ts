import type * as React from 'react';

/**
 * Event predicates shared by the menu, popover, hover and context-menu code. Server-safe: this
 * module imports nothing from React at run time.
 */

/**
 * Whether an event started in the element that handles it (`currentTarget`) or inside its DOM.
 * React bubbles the events of a portal (a Popover or Dialog opened from an item) through the item
 * and the menu surface although their target lives elsewhere in the document: those are not the
 * menu's to handle. The target is duck typed, so a menu rendered into another realm's document
 * (an iframe) still handles its own events.
 */
export function isOwnEvent(event: React.SyntheticEvent<HTMLElement>): boolean {
  const target = event.target as Partial<Node> | null;
  return (
    !!target && typeof target.nodeType === 'number' && event.currentTarget.contains(target as Node)
  );
}

/**
 * Whether an event comes from an `aria-disabled="true"` element at or inside the element that
 * handles it (`currentTarget`): the trigger element itself, or the focusable element inside a
 * wrapper span, where `currentTarget` is the span. An `aria-disabled` ancestor outside the trigger
 * does not count.
 */
export function isDisabledTrigger(event: React.SyntheticEvent<HTMLElement>): boolean {
  const target = event.target as Partial<Element> | null;
  const disabled =
    typeof target?.closest === 'function' ? target.closest('[aria-disabled="true"]') : null;
  return disabled !== null && event.currentTarget.contains(disabled);
}

/** `<input>` types whose value is text the user edits (a missing or unknown type is `text`). */
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

/**
 * Whether `target` is a field where the browser's own context menu matters (paste, spelling
 * suggestions): a text-type `<input>` (`text`, `search`, `url`, `tel`, `email`, `password`,
 * `number`, or no `type`), a `<textarea>`, or an element whose `isContentEditable` is `true`
 * (read from the nearest `contenteditable` attribute where the engine lacks the property). Duck
 * typed, so an element of another realm (an iframe) counts too.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || (target as Partial<Node>).nodeType !== 1) return false;
  const el = target as HTMLElement;
  if (el.localName === 'textarea') return true;
  if (el.localName === 'input') return TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  if (typeof el.isContentEditable === 'boolean') return el.isContentEditable;
  const editable = el.closest('[contenteditable]');
  return editable !== null && editable.getAttribute('contenteditable') !== 'false';
}
