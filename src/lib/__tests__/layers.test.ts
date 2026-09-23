import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOW_OUTSIDE_SELECTOR,
  Z_INDEX,
  compareLayers,
  getTopmostLayer,
  isInsideLayerTree,
  isInsideOtherOpenModal,
  registerLayer,
  registerLayerElement,
  registerLayerIsolation,
  subscribeLayers,
  type LayerRecord,
} from '../layers';

const cleanups: Array<() => void> = [];

function makeLayer(id: string, overrides: Partial<LayerRecord> = {}): LayerRecord {
  return {
    id,
    parentId: null,
    kind: 'popover',
    order: 0,
    getElements: () => [],
    getAnchor: () => null,
    escape: true,
    outsidePress: true,
    focusOutside: false,
    onDismiss: vi.fn(),
    ...overrides,
  };
}

function register(record: LayerRecord): LayerRecord {
  cleanups.push(registerLayer(record));
  return record;
}

/** Marks a layer as isolating the page, as `useModalIsolation` does for Dialog and Drawer. */
function isolate(layerId: string): void {
  cleanups.push(registerLayerIsolation(layerId));
}

function element(tag = 'div', attributes: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
  // Every test leaves the shared stack empty again.
  expect(getTopmostLayer()).toBeNull();
});

describe('layers — constants', () => {
  it('exposes the z-index scale as CSS variables with fallbacks', () => {
    expect(Z_INDEX).toEqual({
      overlay: 'var(--wave-z-overlay, 1000)',
      toast: 'var(--wave-z-toast, 1100)',
      tooltip: 'var(--wave-z-tooltip, 1200)',
    });
  });

  it('allow-lists the toast region selector', () => {
    expect(ALLOW_OUTSIDE_SELECTOR).toBe('[data-wave-focus-trap-allow]');
  });
});

describe('layers — registry and stacking', () => {
  it('assigns an increasing open order at registration', () => {
    const a = register(makeLayer('a'));
    const b = register(makeLayer('b'));
    expect(a.order).toBeGreaterThan(0);
    expect(b.order).toBeGreaterThan(a.order);
  });

  it('returns the most recently opened unrelated layer as topmost, and null when empty', () => {
    expect(getTopmostLayer()).toBeNull();
    register(makeLayer('a'));
    const b = register(makeLayer('b'));
    expect(getTopmostLayer()).toBe(b);
  });

  it('filters the topmost layer with a predicate', () => {
    const a = register(makeLayer('a', { escape: true }));
    register(makeLayer('b', { escape: false }));
    expect(getTopmostLayer((layer) => layer.escape)).toBe(a);
  });

  it('removes a layer on unregister', () => {
    const a = register(makeLayer('a'));
    const unregisterB = registerLayer(makeLayer('b'));
    unregisterB();
    expect(getTopmostLayer()).toBe(a);
  });

  it('puts a descendant above its ancestor even when the child registers first (same commit)', () => {
    // Effects run child-first, so a parent and child opened in one commit register child-first.
    const child = register(makeLayer('child', { parentId: 'parent' }));
    const parent = register(makeLayer('parent'));
    expect(getTopmostLayer()).toBe(child);
    expect(compareLayers(child, parent)).toBeGreaterThan(0);
    expect(compareLayers(parent, child)).toBeLessThan(0);
  });

  it('keeps a consistent order when an unrelated layer registers between a child and its parent', () => {
    const child = register(makeLayer('child', { parentId: 'parent' }));
    const unrelated = register(makeLayer('unrelated'));
    const parent = register(makeLayer('parent'));
    // The parent takes the place of its earliest descendant: parent < child < unrelated.
    expect(compareLayers(child, parent)).toBeGreaterThan(0);
    expect(compareLayers(unrelated, child)).toBeGreaterThan(0);
    expect(compareLayers(unrelated, parent)).toBeGreaterThan(0);
    expect(getTopmostLayer()).toBe(unrelated);
  });

  it('orders a grandchild above its grandparent', () => {
    const grandchild = register(makeLayer('gc', { parentId: 'c' }));
    const child = register(makeLayer('c', { parentId: 'p' }));
    const parent = register(makeLayer('p'));
    expect(compareLayers(grandchild, parent)).toBeGreaterThan(0);
    expect(compareLayers(grandchild, child)).toBeGreaterThan(0);
    expect(getTopmostLayer()).toBe(grandchild);
  });

  it('orders unrelated layers by open order', () => {
    const a = register(makeLayer('a'));
    const b = register(makeLayer('b'));
    expect(compareLayers(b, a)).toBeGreaterThan(0);
    expect(compareLayers(a, a)).toBe(0);
  });

  it('shares one stack through the global registry (ESM and CJS copies)', async () => {
    vi.resetModules();
    const copy = await import('../layers');
    expect(copy.registerLayer).not.toBe(registerLayer);
    const record = makeLayer('from-copy');
    const unregister = copy.registerLayer(record);
    try {
      expect(getTopmostLayer()).toBe(record);
    } finally {
      unregister();
    }
  });

  it('upgrades a registry created by an older copy of the module (hot reload) that lacks newer fields', () => {
    const key = Symbol.for('@mortenbrudvik/waveui/layers');
    const store = globalThis as unknown as Record<symbol, unknown>;
    const original = Object.getOwnPropertyDescriptor(store, key);
    Object.defineProperty(store, key, {
      value: { stack: [], elements: new Map(), counter: 0, press: null, listeners: null },
      configurable: true,
      enumerable: false,
      writable: true,
    });
    try {
      const listener = vi.fn();
      const unsubscribe = subscribeLayers(listener);
      const unregister = registerLayer(makeLayer('legacy'));
      const unisolate = registerLayerIsolation('legacy');
      expect(listener).toHaveBeenCalledTimes(1);
      unisolate();
      unregister();
      unsubscribe();
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      if (original) Object.defineProperty(store, key, original);
      else delete store[key];
    }
  });
});

describe('layers — isInsideLayerTree', () => {
  it('contains the layer’s own elements (null refs are ignored)', () => {
    const surface = element();
    const inner = document.createElement('button');
    surface.appendChild(inner);
    const outside = element();
    register(makeLayer('a', { getElements: () => [null, surface] }));
    expect(isInsideLayerTree('a', inner)).toBe(true);
    expect(isInsideLayerTree('a', surface)).toBe(true);
    expect(isInsideLayerTree('a', outside)).toBe(false);
  });

  it('accepts text nodes', () => {
    const surface = element();
    const text = document.createTextNode('hello');
    surface.appendChild(text);
    register(makeLayer('a', { getElements: () => [surface] }));
    expect(isInsideLayerTree('a', text)).toBe(true);
  });

  it('contains portal wrappers registered with registerLayerElement, until they unregister', () => {
    const wrapper = element('div', { 'data-wave-portal': '' });
    const inner = document.createElement('button');
    wrapper.appendChild(inner);
    register(makeLayer('a'));
    const unregister = registerLayerElement('a', wrapper);
    expect(isInsideLayerTree('a', inner)).toBe(true);
    unregister();
    expect(isInsideLayerTree('a', inner)).toBe(false);
  });

  it('counts registered elements even before the layer itself registers', () => {
    const wrapper = element();
    const unregister = registerLayerElement('pending', wrapper);
    try {
      expect(isInsideLayerTree('pending', wrapper)).toBe(true);
    } finally {
      unregister();
    }
  });

  it('contains every descendant layer (children and grandchildren)', () => {
    const parentSurface = element();
    const childSurface = element();
    const grandchildSurface = element();
    register(makeLayer('p', { getElements: () => [parentSurface] }));
    register(makeLayer('c', { parentId: 'p', getElements: () => [childSurface] }));
    register(makeLayer('gc', { parentId: 'c', getElements: () => [grandchildSurface] }));
    expect(isInsideLayerTree('p', childSurface)).toBe(true);
    expect(isInsideLayerTree('p', grandchildSurface)).toBe(true);
    expect(isInsideLayerTree('c', parentSurface)).toBe(false);
  });

  it('treats targets inside [data-wave-focus-trap-allow] as inside every layer', () => {
    const toasts = element('div', { 'data-wave-focus-trap-allow': '' });
    const toastButton = document.createElement('button');
    toasts.appendChild(toastButton);
    register(makeLayer('a', { getElements: () => [element()] }));
    expect(isInsideLayerTree('a', toastButton)).toBe(true);
    expect(isInsideLayerTree('unknown-layer', toastButton)).toBe(true);
  });

  it('returns false for an unknown layer and an unrelated target', () => {
    expect(isInsideLayerTree('nope', element())).toBe(false);
  });
});

describe('layers — isInsideOtherOpenModal', () => {
  it('is false while no modal layer is open', () => {
    register(makeLayer('popover'));
    expect(isInsideOtherOpenModal(element())).toBe(false);
  });

  it('is true for an element cut off behind the topmost open modal, false inside its tree', () => {
    const modalSurface = element();
    const inside = document.createElement('button');
    modalSurface.appendChild(inside);
    const behind = element('button');
    register(makeLayer('modal', { kind: 'modal', getElements: () => [modalSurface] }));
    expect(isInsideOtherOpenModal(behind)).toBe(true);
    expect(isInsideOtherOpenModal(inside)).toBe(false);
  });

  it('ignores the excepted layer and its descendants', () => {
    const behind = element('button');
    register(makeLayer('closing', { kind: 'modal', getElements: () => [element()] }));
    register(makeLayer('nested', { kind: 'modal', parentId: 'closing' }));
    expect(isInsideOtherOpenModal(behind, 'closing')).toBe(false);
  });

  it('checks the next open modal when the excepted one is on top', () => {
    const drawerSurface = element();
    const behind = element('button');
    const inDrawer = document.createElement('button');
    drawerSurface.appendChild(inDrawer);
    register(makeLayer('drawer', { kind: 'modal', getElements: () => [drawerSurface] }));
    register(makeLayer('dialog', { kind: 'modal', getElements: () => [element()] }));
    // Closing the dialog: an opener on the page sits behind the still-open drawer.
    expect(isInsideOtherOpenModal(behind, 'dialog')).toBe(true);
    expect(isInsideOtherOpenModal(inDrawer, 'dialog')).toBe(false);
  });
});

describe('layers — document listeners', () => {
  it('installs one set of document listeners while at least one layer exists', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    try {
      const unregisterA = registerLayer(makeLayer('a'));
      const addedTypes = add.mock.calls.map(([type]) => type);
      expect(addedTypes).toEqual(
        expect.arrayContaining(['keydown', 'pointerdown', 'click', 'focusin', 'contextmenu']),
      );
      const addCount = add.mock.calls.length;
      const unregisterB = registerLayer(makeLayer('b'));
      expect(add.mock.calls.length).toBe(addCount);
      unregisterA();
      expect(remove).not.toHaveBeenCalled();
      unregisterB();
      const removedTypes = remove.mock.calls.map(([type]) => type);
      expect(removedTypes).toEqual(expect.arrayContaining(addedTypes));
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });
});

describe('layers — Escape dispatch', () => {
  function pressEscape(target: EventTarget = document.body, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('dismisses the global topmost escape-enabled layer and prevents the default', () => {
    const a = register(makeLayer('a'));
    const b = register(makeLayer('b'));
    const event = pressEscape();
    expect(b.onDismiss).toHaveBeenCalledWith('escape', event);
    expect(a.onDismiss).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('dismisses the topmost layer whose tree contains the focused element', () => {
    const aSurface = element();
    const aButton = document.createElement('button');
    aSurface.appendChild(aButton);
    const a = register(makeLayer('a', { getElements: () => [aSurface] }));
    const b = register(makeLayer('b', { getElements: () => [element()] }));
    aButton.focus();
    pressEscape(aButton);
    expect(a.onDismiss).toHaveBeenCalledTimes(1);
    expect(b.onDismiss).not.toHaveBeenCalled();
  });

  it('lets an open descendant of the focused layer take Escape first (visible tooltip/popover)', () => {
    const dialogSurface = element();
    const dialogButton = document.createElement('button');
    dialogSurface.appendChild(dialogButton);
    const dialog = register(
      makeLayer('dialog', { kind: 'modal', getElements: () => [dialogSurface] }),
    );
    const tooltip = register(
      makeLayer('tooltip', { parentId: 'dialog', kind: 'tooltip', getElements: () => [element()] }),
    );
    dialogButton.focus();
    pressEscape(dialogButton);
    expect(tooltip.onDismiss).toHaveBeenCalledTimes(1);
    expect(dialog.onDismiss).not.toHaveBeenCalled();
  });

  it('keeps Escape on the focused sibling when two children of one parent are open', () => {
    const firstSurface = element();
    const firstButton = document.createElement('button');
    firstSurface.appendChild(firstButton);
    register(makeLayer('parent', { getElements: () => [element()] }));
    const first = register(
      makeLayer('first', { parentId: 'parent', getElements: () => [firstSurface] }),
    );
    const second = register(
      makeLayer('second', { parentId: 'parent', getElements: () => [element()] }),
    );
    firstButton.focus();
    pressEscape(firstButton);
    expect(first.onDismiss).toHaveBeenCalledTimes(1);
    expect(second.onDismiss).not.toHaveBeenCalled();
  });

  it('passes Escape to an escape-enabled ancestor when the focused layer ignores Escape', () => {
    const childSurface = element();
    const childButton = document.createElement('button');
    childSurface.appendChild(childButton);
    const parent = register(makeLayer('parent', { getElements: () => [element()] }));
    const child = register(
      makeLayer('child', { parentId: 'parent', escape: false, getElements: () => [childSurface] }),
    );
    childButton.focus();
    pressEscape(childButton);
    expect(parent.onDismiss).toHaveBeenCalledTimes(1);
    expect(child.onDismiss).not.toHaveBeenCalled();
  });

  it('falls back to the global topmost escape-enabled layer when the focused layer tree has none', () => {
    const stickySurface = element();
    const stickyButton = document.createElement('button');
    stickySurface.appendChild(stickyButton);
    const other = register(makeLayer('other', { getElements: () => [element()] }));
    const sticky = register(
      makeLayer('sticky', { escape: false, getElements: () => [stickySurface] }),
    );
    stickyButton.focus();
    const event = pressEscape(stickyButton);
    expect(other.onDismiss).toHaveBeenCalledWith('escape', event);
    expect(sticky.onDismiss).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('never falls back to a layer behind an open isolating modal', () => {
    const modalSurface = element();
    const modalButton = document.createElement('button');
    modalSurface.appendChild(modalButton);
    // A popover left open behind a sibling modal that ignores Escape (a required-choice alert).
    const behind = register(makeLayer('behind', { getElements: () => [element()] }));
    register(
      makeLayer('alert', { kind: 'modal', escape: false, getElements: () => [modalSurface] }),
    );
    isolate('alert');
    modalButton.focus();
    const fromModal = pressEscape(modalButton);
    modalButton.blur();
    const fromBody = pressEscape(document.body);
    expect(behind.onDismiss).not.toHaveBeenCalled();
    expect(fromModal.defaultPrevented).toBe(false);
    expect(fromBody.defaultPrevented).toBe(false);
  });

  it('never escalates Escape to the ancestor of an isolating modal that ignores it (as for a sibling)', () => {
    const alertSurface = element();
    const alertButton = document.createElement('button');
    alertSurface.appendChild(alertButton);
    const dialog = register(makeLayer('dialog', { kind: 'modal', getElements: () => [element()] }));
    isolate('dialog');
    // A required-choice alert opened from inside the dialog (a React descendant).
    const alert = register(
      makeLayer('alert', {
        kind: 'modal',
        parentId: 'dialog',
        escape: false,
        getElements: () => [alertSurface],
      }),
    );
    isolate('alert');
    alertButton.focus();
    const fromAlert = pressEscape(alertButton);
    alertButton.blur();
    const fromBody = pressEscape(document.body);
    expect(dialog.onDismiss).not.toHaveBeenCalled();
    expect(alert.onDismiss).not.toHaveBeenCalled();
    expect(fromAlert.defaultPrevented).toBe(false);
    expect(fromBody.defaultPrevented).toBe(false);
  });

  it('still lets a layer opened above an isolating modal that ignores Escape take it', () => {
    const alertSurface = element();
    const alertButton = document.createElement('button');
    alertSurface.appendChild(alertButton);
    register(makeLayer('dialog', { kind: 'modal', getElements: () => [element()] }));
    isolate('dialog');
    register(
      makeLayer('alert', {
        kind: 'modal',
        parentId: 'dialog',
        escape: false,
        getElements: () => [alertSurface],
      }),
    );
    isolate('alert');
    const tooltip = register(
      makeLayer('tooltip', { kind: 'tooltip', parentId: 'alert', getElements: () => [element()] }),
    );
    alertButton.focus();
    const event = pressEscape(alertButton);
    expect(tooltip.onDismiss).toHaveBeenCalledWith('escape', event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('never lets Escape from inside an ancestor’s surface reach it behind its isolating child modal', () => {
    // Focus stays on a control of the parent dialog (for example the opener) while a
    // required-choice alert opened from it isolates the page: the dialog is the focus scope, but it
    // is inert behind the alert, so neither the scope's subtree nor the fallbacks may pick it.
    const dialogSurface = element();
    const dialogButton = document.createElement('button');
    dialogSurface.appendChild(dialogButton);
    const dialog = register(
      makeLayer('dialog', { kind: 'modal', getElements: () => [dialogSurface] }),
    );
    isolate('dialog');
    const alert = register(
      makeLayer('alert', {
        kind: 'modal',
        parentId: 'dialog',
        escape: false,
        getElements: () => [element()],
      }),
    );
    isolate('alert');
    dialogButton.focus();
    const event = pressEscape(dialogButton);
    expect(dialog.onDismiss).not.toHaveBeenCalled();
    expect(alert.onDismiss).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('treats a modal-kind layer that does not isolate the page (calendar-like) as no barrier', () => {
    const calendarSurface = element();
    const dayButton = document.createElement('button');
    calendarSurface.appendChild(dayButton);
    const behind = register(makeLayer('behind', { getElements: () => [element()] }));
    register(
      makeLayer('calendar', { kind: 'modal', escape: false, getElements: () => [calendarSurface] }),
    );
    dayButton.focus();
    pressEscape(dayButton);
    // Same as for any sibling layer that ignores Escape: the global topmost one takes it.
    expect(behind.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('skips layers with escape disabled', () => {
    const a = register(makeLayer('a'));
    const b = register(makeLayer('b', { escape: false }));
    pressEscape();
    expect(a.onDismiss).toHaveBeenCalledTimes(1);
    expect(b.onDismiss).not.toHaveBeenCalled();
  });

  it('ignores Escape events that were already handled or are part of an IME composition', () => {
    const a = register(makeLayer('a'));
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    pressEscape(document.body, { isComposing: true });
    expect(a.onDismiss).not.toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const a = register(makeLayer('a'));
    pressEscape(document.body, { key: 'Enter' });
    expect(a.onDismiss).not.toHaveBeenCalled();
  });
});

describe('layers — outside press', () => {
  function pointer(type: string, target: EventTarget, init: PointerEventInit = {}) {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerType: 'mouse',
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  }

  function key(target: EventTarget, init: KeyboardEventInit) {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
    );
  }

  function nextMacrotask() {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  /** How long `layers.ts` keeps a touch/pen press waiting for its click after the pointerup. */
  const GESTURE_CLICK_TIMEOUT_MS = 1000;

  it('keeps the pending press across modifier keydowns, so Shift/Ctrl+click outside dismisses', () => {
    const outside = element('button');
    const layer = register(makeLayer('a', { getElements: () => [element()] }));
    pointer('pointerdown', outside, { shiftKey: true });
    // Held modifiers auto-repeat (Windows) while the pointer is down.
    key(outside, { key: 'Shift', shiftKey: true, repeat: true });
    key(outside, { key: 'Control', ctrlKey: true, shiftKey: true, repeat: true });
    pointer('pointerup', outside, { shiftKey: true });
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, shiftKey: true }));
    expect(layer.onDismiss).toHaveBeenCalledWith('outside-press', expect.any(MouseEvent));
  });

  it('forgets the pending press on Enter/Space (a keyboard-activated click follows)', () => {
    const outside = element('button');
    const layer = register(makeLayer('a', { getElements: () => [element()] }));
    pointer('pointerdown', outside);
    key(outside, { key: 'Enter' });
    outside.click();
    pointer('pointerdown', outside);
    key(outside, { key: ' ' });
    outside.click();
    expect(layer.onDismiss).not.toHaveBeenCalled();
  });

  it('forgets a mouse press that no click followed in the same task (released elsewhere)', async () => {
    const outside = element('button');
    const layer = register(makeLayer('a', { getElements: () => [element()] }));
    pointer('pointerdown', outside);
    pointer('pointerup', outside);
    await nextMacrotask();
    // A later programmatic click is not the end of that press.
    outside.click();
    expect(layer.onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses when the click follows the pointerup in the same task', async () => {
    const outside = element('button');
    const layer = register(makeLayer('a', { getElements: () => [element()] }));
    pointer('pointerdown', outside);
    pointer('pointerup', outside);
    outside.click();
    await nextMacrotask();
    expect(layer.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps a touch press for its click (which the browser dispatches in a later task)', async () => {
    const outside = element('button');
    const layer = register(makeLayer('a', { getElements: () => [element()] }));
    pointer('pointerdown', outside, { pointerType: 'touch' });
    pointer('pointerup', outside, { pointerType: 'touch' });
    await nextMacrotask();
    outside.click();
    expect(layer.onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each([['pen'], ['' /* unknown device */]])(
    'keeps a %j press for its click (stylus taps click from a later gesture task)',
    async (pointerType) => {
      const outside = element('button');
      const layer = register(makeLayer('a', { getElements: () => [element()] }));
      pointer('pointerdown', outside, { pointerType });
      pointer('pointerup', outside, { pointerType });
      await nextMacrotask();
      outside.click();
      expect(layer.onDismiss).toHaveBeenCalledTimes(1);
    },
  );

  it.each([['touch'], ['pen'], ['' /* unknown device */]])(
    'forgets a %j press that got no click within the gesture limit after its pointerup',
    (pointerType) => {
      vi.useFakeTimers();
      try {
        const outside = element('button');
        const layer = register(makeLayer('a', { getElements: () => [element()] }));
        // A long press or a tap on a non-clickable area: no click follows the pointerup.
        pointer('pointerdown', outside, { pointerType });
        pointer('pointerup', outside, { pointerType });
        vi.advanceTimersByTime(GESTURE_CLICK_TIMEOUT_MS + 1);
        // A later programmatic click is not the end of that press.
        outside.click();
        expect(layer.onDismiss).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('still dismisses when a touch click arrives after the double-tap delay (within the limit)', () => {
    vi.useFakeTimers();
    try {
      const outside = element('button');
      const layer = register(makeLayer('a', { getElements: () => [element()] }));
      pointer('pointerdown', outside, { pointerType: 'touch' });
      pointer('pointerup', outside, { pointerType: 'touch' });
      vi.advanceTimersByTime(350);
      outside.click();
      expect(layer.onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets the pending press on contextmenu (a long press opened the context menu)', () => {
    const outside = element('button');
    const layer = register(makeLayer('a', { getElements: () => [element()] }));
    pointer('pointerdown', outside, { pointerType: 'touch' });
    outside.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    pointer('pointerup', outside, { pointerType: 'touch' });
    outside.click();
    expect(layer.onDismiss).not.toHaveBeenCalled();
  });

  it('never dismisses layers behind an open isolating modal that is not their descendant', () => {
    const popoverSurface = element();
    const modalSurface = element();
    const modalButton = document.createElement('button');
    modalSurface.appendChild(modalButton);
    const backdrop = element();
    const behind = register(makeLayer('behind', { getElements: () => [popoverSurface] }));
    const modal = register(
      makeLayer('modal', { kind: 'modal', getElements: () => [modalSurface] }),
    );
    isolate('modal');
    // A press inside the modal is outside the popover behind it, but the modal blocks it.
    pointer('pointerdown', modalButton);
    modalButton.click();
    expect(behind.onDismiss).not.toHaveBeenCalled();
    expect(modal.onDismiss).not.toHaveBeenCalled();
    // A press on the modal's backdrop dismisses only the modal.
    pointer('pointerdown', backdrop);
    backdrop.click();
    expect(modal.onDismiss).toHaveBeenCalledTimes(1);
    expect(behind.onDismiss).not.toHaveBeenCalled();
  });

  it('still dismisses layers stacked above the topmost modal (its descendants)', () => {
    const modalSurface = element();
    const modalButton = document.createElement('button');
    modalSurface.appendChild(modalButton);
    const modal = register(
      makeLayer('modal', { kind: 'modal', getElements: () => [modalSurface] }),
    );
    isolate('modal');
    const child = register(
      makeLayer('child', { parentId: 'modal', getElements: () => [element()] }),
    );
    pointer('pointerdown', modalButton);
    modalButton.click();
    expect(child.onDismiss).toHaveBeenCalledTimes(1);
    expect(modal.onDismiss).not.toHaveBeenCalled();
  });

  it('lets a page click close a non-isolating modal-kind layer and the popover enclosing it', () => {
    const page = element('button');
    const popover = register(makeLayer('popover', { getElements: () => [element()] }));
    // A DatePicker calendar opened from inside the popover: kind 'modal', no page isolation.
    const calendar = register(
      makeLayer('calendar', { kind: 'modal', parentId: 'popover', getElements: () => [element()] }),
    );
    pointer('pointerdown', page);
    page.click();
    expect(calendar.onDismiss).toHaveBeenCalledTimes(1);
    expect(popover.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('lets presses on and outside a non-isolating modal-kind layer reach the sibling layers below it', () => {
    const page = element('button');
    const calendarSurface = element();
    const dayButton = document.createElement('button');
    calendarSurface.appendChild(dayButton);
    const sibling = register(makeLayer('sibling', { getElements: () => [element()] }));
    const calendar = register(
      makeLayer('calendar', { kind: 'modal', getElements: () => [calendarSurface] }),
    );
    // A press inside the calendar is outside the sibling popup (they are unrelated).
    pointer('pointerdown', dayButton);
    dayButton.click();
    expect(sibling.onDismiss).toHaveBeenCalledTimes(1);
    expect(calendar.onDismiss).not.toHaveBeenCalled();
    pointer('pointerdown', page);
    page.click();
    expect(calendar.onDismiss).toHaveBeenCalledTimes(1);
  });
});
