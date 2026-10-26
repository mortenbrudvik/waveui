import type * as React from 'react';
import { FOCUSABLE_SELECTOR } from './focus';

/**
 * Event predicates shared by the menu, popover, hover and context-menu code, and by the
 * selectable containers that toggle on a click (List items, DataGrid rows). Server-safe: this
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

/**
 * Elements whose clicks and keys belong to themselves, not to a selectable container around them
 * (a List item, a DataGrid row): every element that may take focus, labels, and the widget roles a
 * script makes interactive.
 */
export const INTERACTIVE_SELECTOR = [
  FOCUSABLE_SELECTOR,
  'label',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(', ');

/** Options of {@link isForeignEvent}. */
export interface ForeignEventOptions {
  /** The elements whose events are their own. @default INTERACTIVE_SELECTOR */
  interactive?: string;
  /**
   * Elements between the target and the container that never count as interactive, although
   * they match `interactive`: the container's own parts, such as the cells of a grid row, which
   * carry a `tabindex` for the grid's arrow keys.
   */
  isOwnPart?: (element: Element) => boolean;
}

/**
 * Whether a selectable container (the element that handles the event, `currentTarget`: a List
 * item, a DataGrid row) must leave `event` alone, so it toggles no selection: the event started
 * outside the container's DOM ({@link isOwnEvent}), or inside an interactive element nested in it
 * (`options.interactive`, every element from the target up to the container). React bubbles the
 * events of a popup portaled from the container (a Popover, a Menu, a Dialog) through its handlers
 * although their target lives elsewhere in the document; those are foreign too.
 */
export function isForeignEvent(
  event: React.SyntheticEvent<HTMLElement>,
  options: ForeignEventOptions = {},
): boolean {
  if (!isOwnEvent(event)) return true;
  const { interactive = INTERACTIVE_SELECTOR, isOwnPart } = options;
  const container = event.currentTarget;
  const target = event.target as Node;
  let node: Element | null =
    target.nodeType === 1 ? (target as Element) : (target.parentElement ?? null);
  for (; node && node !== container; node = node.parentElement) {
    if (isOwnPart?.(node)) continue;
    if (node.matches(interactive)) return true;
  }
  return false;
}

/**
 * Whether a click ended a text selection in the element that handles it (`currentTarget`): the
 * pointer dragged across its text (or a double click chose a word), so the document holds a
 * selection that is not collapsed and reaches into the element when the click arrives. Such a
 * click selects text; it does not activate the element. A selection elsewhere in the document
 * does not count.
 */
export function endsTextSelection(event: React.MouseEvent<HTMLElement>): boolean {
  const element = event.currentTarget;
  const selection = element.ownerDocument.defaultView?.getSelection() ?? null;
  if (!selection || selection.isCollapsed) return false;
  for (let index = 0; index < selection.rangeCount; index++) {
    if (selection.getRangeAt(index).intersectsNode(element)) return true;
  }
  return false;
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
