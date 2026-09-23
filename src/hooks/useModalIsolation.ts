import { useEffect, useLayoutEffect } from 'react';
import { getGlobalRegistry } from '../lib/globalRegistry';
import {
  ALLOW_OUTSIDE_SELECTOR,
  compareLayers,
  getLayer,
  getLayerTreeElements,
  getOpenLayers,
  isDescendantLayer,
  registerLayerIsolation,
  subscribeLayers,
} from '../lib/layers';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/** Live regions of `useAnnounce`; never made inert. */
const ANNOUNCER_SELECTOR = '[data-wave-announcer]';
/** The wrapper `Portal` renders around portaled content. */
const PORTAL_SELECTOR = '[data-wave-portal]';
/** Children of `<body>` that render nothing; left alone. */
const NON_RENDERED = new Set(['script', 'style', 'link', 'template', 'noscript']);

interface InertEntry {
  count: number;
  /** Whether the element was inert before any modal touched it. */
  original: boolean;
}

interface InertState {
  entries: Map<Element, InertEntry>;
}

function getState(): InertState {
  return getGlobalRegistry<InertState>('inert', () => ({ entries: new Map() }));
}

function acquireInert(el: Element): void {
  const { entries } = getState();
  let entry = entries.get(el);
  if (!entry) {
    entry = { count: 0, original: el.hasAttribute('inert') };
    entries.set(el, entry);
    if (!entry.original) el.setAttribute('inert', '');
  }
  entry.count += 1;
}

function releaseInert(el: Element): void {
  const { entries } = getState();
  const entry = entries.get(el);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  entries.delete(el);
  if (!entry.original) el.removeAttribute('inert');
}

interface Plan {
  targets: Set<Element>;
  /** Elements whose children were inspected (a kept element lies below them). */
  path: Set<Element>;
}

/**
 * The elements of every open modal stacked above the modal `layerId` that is not one of its
 * descendants (those are kept through its own tree): a confirm dialog driven by app state, opened
 * from inside this one but rendered as its React sibling. Each element is replaced by its portal
 * wrapper, so the other modal's backdrop stays interactive too. That modal isolates the page
 * (including this modal) itself and its focus trap is the active one; this modal re-plans when it
 * closes.
 */
function getModalsAboveElements(layerId: string): Element[] {
  const self = getLayer(layerId);
  if (!self) return [];
  const result: Element[] = [];
  for (const layer of getOpenLayers()) {
    if (layer.kind !== 'modal' || layer.id === layerId) continue;
    if (isDescendantLayer(layer.id, layerId) || compareLayers(layer, self) <= 0) continue;
    for (const el of getLayerTreeElements(layer.id)) {
      result.push(el.closest(PORTAL_SELECTOR) ?? el);
    }
  }
  return result;
}

/**
 * Everything to make inert: walking down from `<body>`, every element that is neither a kept
 * element nor an ancestor of one. Kept: the modal's portal wrapper (its surface and backdrop), the
 * portal wrappers and surfaces of its descendant layers, modals stacked above it, allow-listed
 * regions and the announcer.
 */
function plan(container: HTMLElement, layerId: string): Plan {
  const doc = container.ownerDocument;
  const body = doc.body;
  const root = container.closest<HTMLElement>(PORTAL_SELECTOR) ?? container;
  const kept = new Set<Element>([
    root,
    ...getLayerTreeElements(layerId, { includeOwnElements: false }),
    ...getModalsAboveElements(layerId),
    ...Array.from(doc.querySelectorAll(ALLOW_OUTSIDE_SELECTOR)),
    ...Array.from(doc.querySelectorAll(ANNOUNCER_SELECTOR)),
  ]);

  const path = new Set<Element>([body]);
  for (const el of kept) {
    if (!el.isConnected || !body.contains(el)) continue;
    for (let parent = el.parentElement; parent && parent !== body; parent = parent.parentElement) {
      path.add(parent);
    }
  }

  const targets = new Set<Element>();
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (kept.has(child)) continue;
      if (path.has(child)) walk(child);
      else if (!NON_RENDERED.has(child.localName)) targets.add(child);
    }
  };
  walk(body);
  return { targets, path };
}

/**
 * Isolates a modal (Dialog, Drawer) from the rest of the page while `enabled` — the replacement
 * for `aria-modal`, which would also hide the Toaster and live regions from screen readers.
 *
 * Every element outside the modal's tree is made `inert` (not focusable, not clickable, absent
 * from the accessibility tree), walking from `<body>` down to the modal's portal wrapper. Kept
 * interactive: the modal's own portal wrapper, its descendant layers (popovers or listboxes opened
 * from inside it, which register their portal wrappers with the modal's layer), other modals
 * stacked above it that are not its descendants (a confirm dialog rendered elsewhere in the React
 * tree and opened from inside this one — it isolates the page, this modal included, itself),
 * `[data-wave-focus-trap-allow]` regions (toasts) and `[data-wave-announcer]` live regions.
 *
 * While enabled, the layer is also registered as isolating (`registerLayerIsolation`): outside
 * presses and Escape never reach the layers stacked below it, not even its own ancestor layers
 * (a modal-kind layer without this hook, such as the DatePicker calendar, blocks nothing).
 *
 * A MutationObserver inerts siblings added later (unless they belong to a kept tree), and the plan
 * is recomputed whenever a layer opens or closes. The previous
 * `inert` state of each element is saved and counted in a global registry, so nested modals
 * release their isolation in stack order and elements that were already inert stay inert.
 *
 * Runs in the layout phase: `useModalLayer` removes the isolation before it restores focus (an
 * inert opener cannot take focus).
 */
export function useModalIsolation(
  enabled: boolean,
  options: { layerId: string; container: HTMLElement | null },
): void {
  const { layerId, container } = options;

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !container) return;
    const doc = container.ownerDocument;
    const body = doc.body;
    if (!body) return;

    const applied = new Set<Element>();
    let path = new Set<Element>([body]);
    let active = true;
    // While isolated, the layer is a barrier: outside presses and Escape never reach the (inert)
    // layers stacked below it.
    const unregisterIsolation = registerLayerIsolation(layerId);

    const reconcile = () => {
      if (!active || !container.isConnected) return;
      const next = plan(container, layerId);
      path = next.path;
      for (const el of Array.from(applied)) {
        if (!next.targets.has(el)) {
          applied.delete(el);
          releaseInert(el);
        }
      }
      for (const el of next.targets) {
        if (!applied.has(el)) {
          applied.add(el);
          acquireInert(el);
        }
      }
    };

    reconcile();

    // A layer opening or closing can change what is kept (a modal stacked above this one, also an
    // inline one whose insertion the observer below would not see as relevant). Registration runs
    // in the layout phase, so a newly opened modal is kept before its focus trap moves focus in.
    const unsubscribe = subscribeLayers(reconcile);

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver((records) => {
        // Only changes along the kept paths (or to the kept markers) can change the plan.
        const relevant = records.some(
          (record) =>
            record.type === 'attributes' ||
            (record.target.nodeType === 1 && path.has(record.target as Element)),
        );
        if (relevant) reconcile();
      });
      observer.observe(body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-wave-focus-trap-allow', 'data-wave-announcer'],
      });
    }

    return () => {
      active = false;
      unregisterIsolation();
      unsubscribe();
      observer?.disconnect();
      for (const el of applied) releaseInert(el);
      applied.clear();
    };
  }, [enabled, container, layerId]);
}
