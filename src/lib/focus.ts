/**
 * Focus utilities that work in browsers and in jsdom (no layout APIs such as `offsetParent` or
 * `getClientRects`; visibility comes from attributes and computed style).
 */

const NATIVELY_FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ');

/**
 * Selector for every element that may be able to receive focus. Candidates are filtered further by
 * {@link isFocusable} (disabled, hidden, inert, …) and {@link isTabbable}.
 */
export const FOCUSABLE_SELECTOR = `${NATIVELY_FOCUSABLE_SELECTOR}, [tabindex]`;

type HiddenCache = Map<Element, boolean>;

function parseTabIndexAttribute(el: Element): number | null {
  const value = el.getAttribute('tabindex');
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isNativelyFocusable(el: Element): boolean {
  return el.matches(NATIVELY_FOCUSABLE_SELECTOR);
}

/** The tab index browsers use (jsdom reports -1 for contenteditable and 0 for `<a>` without href). */
function getTabIndex(el: Element): number {
  const attribute = parseTabIndexAttribute(el);
  if (attribute !== null) return attribute;
  return isNativelyFocusable(el) ? 0 : -1;
}

function isDisabled(el: Element): boolean {
  try {
    return el.matches(':disabled');
  } catch {
    return (el as { disabled?: unknown }).disabled === true;
  }
}

function isHiddenInput(el: Element): boolean {
  return el.localName === 'input' && (el as HTMLInputElement).type === 'hidden';
}

/** `<summary>` is focusable only as the first summary child of a `<details>`. */
function isDetailsSummary(summary: Element): boolean {
  const parent = summary.parentElement;
  if (!parent || parent.localName !== 'details') return false;
  return Array.from(parent.children).find((child) => child.localName === 'summary') === summary;
}

function getComputed(el: Element): CSSStyleDeclaration | null {
  const view = el.ownerDocument.defaultView;
  return view ? view.getComputedStyle(el) : null;
}

/** Hidden by `hidden`, `display: none` on itself or an ancestor, or a closed `<details>`. */
function isRemovedFromLayout(el: Element, cache?: HiddenCache): boolean {
  const cached = cache?.get(el);
  if (cached !== undefined) return cached;

  let hidden = false;
  if (el.hasAttribute('hidden') || getComputed(el)?.display === 'none') {
    hidden = true;
  } else {
    const parent = el.parentElement;
    if (parent) {
      if (parent.localName === 'details' && !parent.hasAttribute('open')) {
        // Only the first <summary> of a closed <details> is rendered.
        const summary = Array.from(parent.children).find((child) => child.localName === 'summary');
        hidden = el !== summary || isRemovedFromLayout(parent, cache);
      } else {
        hidden = isRemovedFromLayout(parent, cache);
      }
    }
  }

  cache?.set(el, hidden);
  return hidden;
}

function isHidden(el: Element, cache?: HiddenCache): boolean {
  if (el.closest('[inert]')) return true;
  if (isRemovedFromLayout(el, cache)) return true;
  const visibility = getComputed(el)?.visibility;
  return visibility === 'hidden' || visibility === 'collapse';
}

function isFocusableInternal(el: Element, cache?: HiddenCache): boolean {
  if (!isNativelyFocusable(el) && parseTabIndexAttribute(el) === null) return false;
  if (isDisabled(el) || isHiddenInput(el)) return false;
  if (el.localName === 'summary' && !isDetailsSummary(el) && parseTabIndexAttribute(el) === null) {
    return false;
  }
  return !isHidden(el, cache);
}

function getRadioGroup(radio: HTMLInputElement): HTMLInputElement[] {
  const form = radio.form;
  const candidates: Element[] = form
    ? Array.from(form.elements)
    : Array.from(
        (radio.getRootNode() as Document | ShadowRoot).querySelectorAll('input[type="radio"]'),
      );
  return candidates.filter(
    (el): el is HTMLInputElement =>
      el.localName === 'input' &&
      (el as HTMLInputElement).type === 'radio' &&
      (el as HTMLInputElement).name === radio.name &&
      (el as HTMLInputElement).form === form,
  );
}

/**
 * The focused element of `el`'s document or shadow root (`null` when `el` is disconnected). Duck
 * typed rather than `instanceof`, so elements of another realm (iframes) work too.
 */
function getActiveElementFor(el: Element): Element | null {
  const root = el.getRootNode() as Node & { activeElement?: Element | null };
  return root.activeElement ?? null;
}

/**
 * A named radio group is one tab stop, following browsers (Chromium's
 * `RadioInputType::IsKeyboardFocusable`, the `tabbable` library):
 * - while focus is on a member of the group, only that member (Tab and Shift+Tab leave the group);
 * - otherwise the checked radio (the whole group is skipped when it cannot take focus);
 * - otherwise, with no checked radio, every member: Tab enters at the first one, Shift+Tab at the
 *   last one, so both `getFirstTabbable` and `getLastTabbable` return the browser's entry radio.
 * Members that are not focusable (disabled, hidden) are filtered out before this check.
 */
function isRadioTabStop(el: Element): boolean {
  if (el.localName !== 'input') return true;
  const radio = el as HTMLInputElement;
  if (radio.type !== 'radio' || !radio.name) return true;
  const group = getRadioGroup(radio);
  const active = getActiveElementFor(radio);
  if (active && (group as Element[]).includes(active)) return active === radio;
  const checked = group.find((member) => member.checked);
  return checked ? checked === radio : true;
}

function isTabbableInternal(el: Element, cache?: HiddenCache): boolean {
  return isFocusableInternal(el, cache) && getTabIndex(el) >= 0 && isRadioTabStop(el);
}

/**
 * Whether `el` can receive focus (programmatically or by pointer): a natively focusable element or
 * one with a valid `tabindex`, that is not disabled (including via a disabled `<fieldset>`), not
 * `input[type=hidden]`, and not inside `[inert]`, `[hidden]`, `display: none`, `visibility:
 * hidden` or a closed `<details>` (except its summary).
 */
export function isFocusable(el: Element): boolean {
  return isFocusableInternal(el);
}

/**
 * Whether `el` is reached by Tab: focusable, `tabIndex >= 0`, and — for a radio in a named group —
 * the group's tab stop: the focused member while focus is in the group, else the checked radio,
 * else (nothing checked) every focusable member, as browsers enter such a group at its first radio
 * going forward and at its last radio going backward.
 */
export function isTabbable(el: Element): boolean {
  return isTabbableInternal(el);
}

/**
 * The tabbable elements inside `container` in sequential focus order: positive `tabindex` first
 * (ascending), then `tabindex=0` / natively tabbable elements in document order. Named radio
 * groups follow {@link isTabbable}, so the result depends on where focus currently is: when focus
 * is on a radio, the rest of its group is left out, which makes the focused radio the last entry
 * when its group ends the container (the element a focus trap wraps from).
 *
 * @param options.includeContainer Also consider `container` itself.
 */
export function getTabbableElements(
  container: Element,
  options?: { includeContainer?: boolean },
): HTMLElement[] {
  const cache: HiddenCache = new Map();
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (options?.includeContainer && container.matches(FOCUSABLE_SELECTOR)) {
    candidates.unshift(container as HTMLElement);
  }
  const tabbable = candidates.filter((el) => isTabbableInternal(el, cache));
  const positive = tabbable
    .map((el, index) => ({ el, index, tabIndex: getTabIndex(el) }))
    .filter((entry) => entry.tabIndex > 0)
    .sort((a, b) => a.tabIndex - b.tabIndex || a.index - b.index)
    .map((entry) => entry.el);
  const natural = tabbable.filter((el) => getTabIndex(el) === 0);
  return [...positive, ...natural];
}

/** The first tabbable element inside `container`, or `null`. */
export function getFirstTabbable(
  container: Element,
  options?: { includeContainer?: boolean },
): HTMLElement | null {
  return getTabbableElements(container, options)[0] ?? null;
}

/** The last tabbable element inside `container`, or `null`. */
export function getLastTabbable(
  container: Element,
  options?: { includeContainer?: boolean },
): HTMLElement | null {
  const tabbable = getTabbableElements(container, options);
  return tabbable[tabbable.length - 1] ?? null;
}

/** Whether `el` exists, is attached to a document and {@link isFocusable}. */
export function isConnectedAndFocusable(el: Element | null | undefined): boolean {
  return !!el && el.isConnected && isFocusable(el);
}

/**
 * Focuses `el` when it is connected and focusable. Returns `true` when focus actually moved to it.
 */
export function focusElement(
  el: HTMLElement | SVGElement | null | undefined,
  options?: FocusOptions,
): boolean {
  if (!el || !isConnectedAndFocusable(el)) return false;
  try {
    el.focus(options);
  } catch {
    return false;
  }
  return el.ownerDocument.activeElement === el;
}

/** Whether the focused element of `container`'s document is `container` or inside it. */
export function containsFocus(container: Element | null | undefined): boolean {
  if (!container) return false;
  const active = container.ownerDocument.activeElement;
  return !!active && container.contains(active);
}
