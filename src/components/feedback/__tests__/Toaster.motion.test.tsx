import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster } from '../Toast';
import type { ToastController, ToastPosition } from '../Toast';
import { toastClassNames, toasterClassNames } from '../../../lib/classNames';
import { toastMotion, toastStructure } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';
import { ControllerProbe, advance, getToasts, getViewport, renderToaster } from './toasterHarness';

/*
 * P10-TOAST (spec §7, D14, D8): every toast container (the presence element, `data-wave-toast`)
 * is a one-cell grid (`toastStructure`) around a new content element, the one grid item, which
 * holds the status text and the toast's content. Its default motion (`toastMotion[edge]`, the
 * edge from `position`) slides and fades it in from the stack's edge, and fades it out before it
 * collapses; the Toaster's `motion` replaces it for every container. jsdom loads no CSS, so the
 * phases wait only where `mockAnimations` gives the container a running animation.
 */

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

const POSITIONS: readonly ToastPosition[] = [
  'top-start',
  'top-end',
  'bottom-start',
  'bottom-end',
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
];

/** The edge of the stack a position anchors the toasts to. */
const edgeOf = (position: ToastPosition): 'top' | 'bottom' =>
  position.startsWith('top') ? 'top' : 'bottom';

/** The words of one edge's motion that the other edge's lacks (its slide). */
function onlyIn(edge: 'top' | 'bottom'): string[] {
  const other = motionClasses(toastMotion[edge === 'top' ? 'bottom' : 'top']);
  return motionClasses(toastMotion[edge]).filter((word) => !other.includes(word));
}

/** The presence element of every toast: its container. */
const isToast = (el: Element) => el.hasAttribute('data-wave-toast');

/** The content element of a toast container: its only child. */
function contentOf(container: HTMLElement): HTMLElement {
  expect(container.children).toHaveLength(1);
  const content = container.firstElementChild;
  expect(content).toBeInstanceOf(HTMLElement);
  return content as HTMLElement;
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element, recipe: string) {
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

/** Renders a Toaster with `motion` under a provider with the given motion preference. */
function renderWithMotion(
  toasterMotion: MotionSlot | null | undefined,
  preference: 'default' | 'none',
) {
  const controllerRef = React.createRef<ToastController>();
  renderWithProviders(
    <Toaster motion={toasterMotion}>
      <ControllerProbe ref={controllerRef} />
    </Toaster>,
    { motion: preference },
  );
  act(() => {
    controllerRef.current?.dispatchToast({ title: 'Saved', timeout: 0 });
  });
}

describe('the toast container (§7 markup)', () => {
  it.each(POSITIONS)(
    '%s: the container has the structure and its edge’s motion, the content element its only child',
    (position) => {
      const edge = edgeOf(position);
      const other = edge === 'top' ? 'bottom' : 'top';
      const { dispatch } = renderToaster({ position });
      dispatch({ status: 'success', title: 'Saved', body: 'All changes saved.', timeout: 0 });
      const [container] = getToasts();
      expect(container).toHaveClass(
        toasterClassNames.toast,
        ...motionClasses(toastStructure),
        ...motionClasses(toastMotion[edge]),
      );
      expect(container.classList[0]).toBe(toasterClassNames.toast);
      // The other edge's slide is not there (the words both edges share are).
      const othersOnly = onlyIn(other);
      expect(othersOnly.length).toBeGreaterThan(0);
      for (const word of othersOnly) expect(container, word).not.toHaveClass(word);
      const content = contentOf(container);
      expect(content).toHaveClass(toasterClassNames.toastContent);
      expect(content.getAttributeNames()).toEqual(['class']);
      expect(content.classList).toHaveLength(1);
      // The Toast is the content element's only child, its own status text inside it.
      expect(Array.from(content.children)).toHaveLength(1);
      expect(content.firstElementChild).toHaveClass(toastClassNames.root);
      expect(container).toHaveAccessibleName('Success: Saved');
      expect(container).toHaveAccessibleDescription('All changes saved.');
      expect(findDanglingIdRefs()).toEqual([]);
    },
  );

  it('keeps every container attribute of 0.14 on the container, none on the content element', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Saved', body: 'All changes saved.', timeout: 0 });
    const [container] = getToasts();
    expect(container.getAttributeNames().sort()).toEqual(
      [
        'aria-describedby',
        'aria-labelledby',
        'class',
        'data-presence',
        'data-wave-toast',
        'role',
        'tabindex',
      ].sort(),
    );
    expect(container).toHaveAttribute('role', 'group');
    expect(container).toHaveAttribute('tabindex', '-1');
    expect(container).toHaveAttribute('data-presence', 'entered');
    // The marker stays on the container: the content element and the Toast carry none.
    expect(container.querySelector('[data-wave-toast]')).toBeNull();
    expect(container.querySelector('[data-presence]')).toBeNull();
  });

  it('holds the visually hidden status text first, then the content, for content without a Toast', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<p>Connection lost</p>, { status: 'warning', timeout: 0 });
    const [container] = getToasts();
    const content = contentOf(container);
    expect(content).toHaveClass(toasterClassNames.toastContent);
    const [statusText, paragraph, ...others] = Array.from(content.children);
    expect(others).toEqual([]);
    expect(statusText).toHaveClass('sr-only');
    expect(statusText).toHaveTextContent('Warning:');
    expect(paragraph).toHaveTextContent('Connection lost');
    expect(container).toHaveAccessibleName('Warning:');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('holds a Toast of the app’s own content, with its parts', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    const [container] = getToasts();
    const content = contentOf(container);
    expect(Array.from(content.children)).toHaveLength(1);
    expect(content.firstElementChild).toHaveClass(toastClassNames.root);
    expect(container).toHaveAccessibleName('Error: Upload failed');
    expect(container).toHaveAccessibleDescription('The file is too large.');
  });

  it('switches every container to the other edge’s motion when the position changes edge', () => {
    const { dispatch, setProps } = renderToaster({ position: 'bottom-start' });
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    const toasts = getToasts();
    for (const container of toasts) expect(container).toHaveClass(...onlyIn('bottom'));
    setProps({ position: 'top-end' });
    expect(getToasts()).toEqual(toasts);
    for (const container of toasts) {
      expect(container).toHaveClass(...motionClasses(toastMotion.top));
      for (const word of onlyIn('bottom')) expect(container, word).not.toHaveClass(word);
      expect(container).toHaveClass(...motionClasses(toastStructure));
    }
  });
});

describe('presence (D7, D14: the presence pair on the container)', () => {
  it('a dismissed toast keeps its container and content, exiting and inert, until the exit ends', async () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Saved', timeout: 0 });
    const [container] = getToasts();
    const content = contentOf(container);
    expect(container).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(container).toHaveAttribute('data-presence', 'entered');

    dismiss(id);
    expect(getToasts()).toEqual([container]);
    expect(container).toHaveAttribute('data-presence', 'exiting');
    expect(contentOf(container)).toBe(content);
    expect(content.closest('[inert]')).toBe(container);
    expect(within(content).getByText('Saved')).toBeInTheDocument();
    expect(container).toHaveClass(...motionClasses(toastMotion.bottom));
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(getToasts()).toHaveLength(0);
    expect(content).not.toBeInTheDocument();
  });

  it('under reduced motion a dismissal removes the toast within the same act', () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Saved', timeout: 0 });
    expect(getToasts()[0]).toHaveAttribute('data-presence', 'entered');
    dismiss(id);
    expect(getToasts()).toHaveLength(0);
  });

  it('without reduced motion the same dismissal waits for the container’s motion', async () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Saved', timeout: 0 });
    await finish(motion);
    dismiss(id);
    expect(getToasts()[0]).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(getToasts()).toHaveLength(0);
  });

  it('starts the timer at mount: a toast still entering times out (D14)', async () => {
    vi.useFakeTimers();
    try {
      const motion = mockAnimations({ animated: isToast });
      const { dispatch } = renderToaster();
      dispatch({ title: 'Saved', timeout: 1000 });
      const [container] = getToasts();
      expect(container).toHaveAttribute('data-presence', 'entering');
      advance(999);
      expect(container).toHaveAttribute('data-presence', 'entering');
      advance(1);
      expect(container).toHaveAttribute('data-presence', 'exiting');
      await finish(motion);
      expect(getToasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a toast revived during its exit keeps its container and content element', async () => {
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    dispatch({ toastId: 'sync', title: 'Syncing…', timeout: 0 });
    await finish(motion);
    const [container] = getToasts();
    const content = contentOf(container);
    dismiss('sync');
    expect(container).toHaveAttribute('data-presence', 'exiting');
    dispatch({ toastId: 'sync', status: 'success', title: 'Synced', timeout: 0 });
    expect(getToasts()).toEqual([container]);
    expect(contentOf(container)).toBe(content);
    expect(container).toHaveAttribute('data-presence', 'entering');
    expect(content.closest('[inert]')).toBeNull();
    expect(content).toHaveTextContent('Synced');
    await finish(motion);
    expect(container).toHaveAttribute('data-presence', 'entered');
  });
});

describe('focus across the content element (D7)', () => {
  it('focus on a dismissed toast’s button lands on the next toast’s button in the dismissing act', async () => {
    const motion = mockAnimations({ animated: isToast });
    honourInert();
    const user = userEvent.setup();
    const { dispatch } = renderToaster();
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await finish(motion);
    const [first, second] = getToasts();
    const firstButton = within(first).getByRole('button', { name: 'Dismiss' });
    const secondButton = within(second).getByRole('button', { name: 'Dismiss' });

    await user.click(firstButton);
    expect(first).toHaveAttribute('data-presence', 'exiting');
    expect(firstButton.closest('[inert]')).toBe(first);
    expect(secondButton).toHaveFocus();
    await finish(motion);
    expect(getToasts()).toEqual([second]);
    expect(secondButton).toHaveFocus();
  });

  it('focus on the last toast’s button returns to the element focused before, while it exits', async () => {
    const motion = mockAnimations({ animated: isToast });
    honourInert();
    const user = userEvent.setup();
    const { dispatch } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'Saved', timeout: 0 });
    await finish(motion);
    await user.click(input);
    await user.tab();
    const [container] = getToasts();
    const dismissButton = within(container).getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(container).toHaveAttribute('data-presence', 'exiting');
    expect(input).toHaveFocus();
    await finish(motion);
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });
});

describe('motion slot (D5, the slot table on the container)', () => {
  it('undefined: the default motion of the edge', () => {
    renderWithMotion(undefined, 'default');
    expect(getToasts()[0]).toHaveClass(...motionClasses(toastMotion.bottom));
  });

  it('null: no motion; the structure and data-presence stay', () => {
    renderWithMotion(null, 'default');
    const [container] = getToasts();
    expectNoWordOf(container, toastMotion.bottom);
    expect(container).toHaveClass(...motionClasses(toastStructure));
    expect(container).toHaveAttribute('data-presence', 'entered');
    expect(contentOf(container)).toHaveClass(toasterClassNames.toastContent);
  });

  it.each<[string, MotionSlot]>([
    ['a string', 'my-motion'],
    ['{ className }', { className: 'my-motion' }],
  ])('%s replaces the default motion of every container', (_, slot) => {
    const controllerRef = React.createRef<ToastController>();
    render(
      <Toaster motion={slot} position="top-start">
        <ControllerProbe ref={controllerRef} />
      </Toaster>,
    );
    act(() => {
      controllerRef.current?.dispatchToast({ title: 'First', timeout: 0 });
      controllerRef.current?.dispatchToast({ title: 'Second', timeout: 0 });
    });
    const toasts = getToasts();
    expect(toasts).toHaveLength(2);
    for (const container of toasts) {
      expect(container).toHaveClass('my-motion', ...motionClasses(toastStructure));
      expectNoWordOf(container, toastMotion.top);
      expect(contentOf(container)).not.toHaveClass('my-motion');
    }
    // The prop never reaches the region.
    expect(getViewport()).not.toHaveAttribute('motion');
    expect(getViewport()).not.toHaveClass('my-motion');
  });

  it('the provider’s none drops the default motion', () => {
    renderWithMotion(undefined, 'none');
    const [container] = getToasts();
    expectNoWordOf(container, toastMotion.bottom);
    expect(container).toHaveClass(...motionClasses(toastStructure));
  });

  it('the Toaster’s own motion still applies under the provider’s none', () => {
    renderWithMotion('my-motion', 'none');
    expect(getToasts()[0]).toHaveClass('my-motion');
  });

  it('a new motion value reaches the containers already shown', () => {
    const { dispatch, setProps } = renderToaster();
    dispatch({ title: 'Saved', timeout: 0 });
    const [container] = getToasts();
    setProps({ motion: null });
    expectNoWordOf(container, toastMotion.bottom);
    setProps({ motion: 'my-motion' });
    expect(container).toHaveClass('my-motion');
    setProps({});
    expect(container).toHaveClass(...motionClasses(toastMotion.bottom));
    expect(container).not.toHaveClass('my-motion');
  });
});
