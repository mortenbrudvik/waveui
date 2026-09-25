import * as React from 'react';

/**
 * The C-SLOTS naming predicate (spec §1, WCAG 2.5.3 Label in Name): whether the content of a wired
 * dismiss/clear button (MessageBar `dismiss`, SearchBox `dismiss`, Tag `dismissIcon`) has a
 * **text label**, so the text names the button instead of the default name.
 *
 * A text label is text with **at least two letters or digits** (`\p{L}`/`\p{N}`) in total, outside
 * `aria-hidden="true"`/`hidden` subtrees and outside SVG `<title>`/`<desc>`, `<script>`, `<style>`
 * and `<template>`. A lone character (`X`, `x`, `×`, `+`) is a symbolic glyph and keeps the
 * default name, as an icon does.
 *
 * Consumers keep the React glue: the literal check for the server render and the first client
 * render (so hydration matches), then the rendered DOM after mount, re-checked on every change:
 *
 * ```ts
 * const literal = hasTextLabel(children);
 * const [target, setTarget] = React.useState<HTMLElement | null>(null); // callback ref (C-HOOKS)
 * const subscribe = React.useCallback(
 *   (onChange: () => void) => (target ? observeTextLabel(target, onChange) : noop),
 *   [target],
 * );
 * const textLabel = React.useSyncExternalStore(
 *   subscribe,
 *   () => (target ? hasRenderedTextLabel(target) : literal),
 *   () => literal,
 * );
 * ```
 *
 * Text hidden only by CSS (a responsive `hidden sm:inline` label) is not detected and counts as a
 * label, because a computed-style check would not follow media queries: document an explicit
 * `aria-label` for such buttons on the consuming prop.
 */

/** A letter or a digit. */
const LABEL_CHARACTER = /[\p{L}\p{N}]/gu;

/** Letters and digits a text label needs: a lone character (`X`, `×`, `+`) is a symbol. */
const MIN_LABEL_CHARACTERS = 2;

/** Elements whose text is never a visible label (SVG `<title>`/`<desc>`, scripts, styles). */
const NON_LABEL_ELEMENTS: ReadonlySet<string> = new Set([
  'title',
  'desc',
  'style',
  'script',
  'template',
]);

type UnknownProps = Record<string, unknown>;

function countLabelCharacters(text: string): number {
  return text.match(LABEL_CHARACTER)?.length ?? 0;
}

/**
 * Letters and digits in the literal strings and numbers of `node`, outside `aria-hidden`/`hidden`
 * elements (counting stops at {@link MIN_LABEL_CHARACTERS}). Text rendered by components, and
 * one-shot iterators (which reading would consume), are found by the DOM check after mount.
 */
function countLiteralLabelCharacters(node: unknown): number {
  if (typeof node === 'string') return countLabelCharacters(node);
  if (typeof node === 'number' || typeof node === 'bigint') {
    return countLabelCharacters(String(node));
  }
  if (typeof node !== 'object' || node === null) return 0;
  if (React.isValidElement<UnknownProps>(node)) {
    const { props } = node;
    const ariaHidden = props['aria-hidden'];
    if (ariaHidden === true || ariaHidden === 'true' || props.hidden) return 0;
    if (typeof node.type === 'string' && NON_LABEL_ELEMENTS.has(node.type)) return 0;
    return countLiteralLabelCharacters(props.children);
  }
  if (!(Symbol.iterator in node)) return 0;
  const iterable = node as Iterable<unknown>;
  // A one-shot iterator (a generator) returns itself: reading it would consume it.
  if (!Array.isArray(iterable) && (iterable[Symbol.iterator]() as unknown) === iterable) return 0;
  let count = 0;
  for (const item of iterable) {
    count += countLiteralLabelCharacters(item);
    if (count >= MIN_LABEL_CHARACTERS) break;
  }
  return count;
}

/**
 * Whether the literal `node` has a text label: strings, numbers, elements (skipping
 * `aria-hidden`/`hidden` elements and SVG `<title>`/`<desc>`, `<script>`, `<style>`,
 * `<template>`), arrays and re-iterable collections such as a `Set`. A one-shot iterator (a
 * generator) is never read, and text rendered by a component is not seen: both are found by
 * {@link hasRenderedTextLabel} after mount.
 *
 * Takes a `React.ReactNode`, typed `unknown` because a slot's `children` prop is `unknown` at the
 * call sites; anything that is not a React node has no text label.
 */
export function hasTextLabel(node: unknown): boolean {
  return countLiteralLabelCharacters(node) >= MIN_LABEL_CHARACTERS;
}

/**
 * Whether the rendered `element` contains a text label: at least two letters or digits in text
 * outside `aria-hidden` and `hidden` subtrees and outside SVG `<title>`/`<desc>`, `<script>`,
 * `<style>` and `<template>` (visually hidden text included, since it names the button too).
 * Walks the descendants of `element` with a `TreeWalker` and stops as soon as two characters are
 * found. Text hidden only by CSS is not detected and counts as a label.
 */
export function hasRenderedTextLabel(element: Element): boolean {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        const child = node as Element;
        return child.getAttribute('aria-hidden') === 'true' ||
          child.hasAttribute('hidden') ||
          NON_LABEL_ELEMENTS.has(child.localName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      },
    },
  );
  let count = 0;
  while (walker.nextNode()) {
    count += countLabelCharacters(walker.currentNode.nodeValue ?? '');
    if (count >= MIN_LABEL_CHARACTERS) return true;
  }
  return false;
}

/** Re-checks the name whenever the content changes (e.g. a translation loads). */
const LABEL_MUTATIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['aria-hidden', 'hidden'],
};

/**
 * Calls `onChange` whenever the text label of `element` may have changed: text edits, added or
 * removed nodes at any depth, and `aria-hidden`/`hidden` changes. Returns the disconnect, so it
 * can be the `subscribe` of `useSyncExternalStore` directly.
 */
export function observeTextLabel(element: Element, onChange: () => void): () => void {
  const observer = new MutationObserver(() => onChange());
  observer.observe(element, LABEL_MUTATIONS);
  return () => observer.disconnect();
}
