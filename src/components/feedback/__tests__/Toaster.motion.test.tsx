import * as React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster } from '../Toast';
import type { ToastController, ToastPosition, ToasterProps } from '../Toast';
import {
  toastBodyClassNames,
  toastClassNames,
  toasterClassNames,
  toastTitleClassNames,
} from '../../../lib/classNames';
import { toastMotion, toastStructure } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  expectNoA11yViolations,
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  openingTags,
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

describe('Toaster — slotProps', () => {
  type ToasterSlotProps = NonNullable<ToasterProps['slotProps']>;
  const altShiftN = (event: KeyboardEvent) =>
    event.altKey && event.shiftKey && event.code === 'KeyN';
  const saved = (
    <Toast status="success" onDismiss={() => {}}>
      <Toast.Title action={<a href="#undo">Undo</a>}>Saved</Toast.Title>
      <Toast.Body subtitle="2 files">Done.</Toast.Body>
    </Toast>
  );
  const part = (name: string) => document.querySelector('.' + name) as Element;

  it('renders the container and the parts of a dispatched toast of 3fafbe0 (attributes sorted)', () => {
    // Captured from 3fafbe0: the merged props may put the class before the locked attributes.
    const { dispatchContent } = renderToaster();
    dispatchContent(saved, { timeout: 0 });
    const [container] = getToasts();
    expect(
      openingTags(
        container,
        part(toastClassNames.content),
        part(toastClassNames.dismissButton),
        part(toastTitleClassNames.label),
        part(toastBodyClassNames.subtitle),
      ),
    ).toBe(
      [
        '<div aria-describedby="wave-toast-body-_id0_" aria-labelledby="wave-toast-status-_id1_ wave-toast-title-_id2_" class="wave-toaster__toast rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] not-data-[presence=entered]:overflow-hidden transition-[grid-template-rows,margin-bottom,opacity,translate] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-easy-ease data-[presence=exiting]:[transition-delay:var(--wave-duration-normal),var(--wave-duration-normal),0s,0s] motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:translate-y-2 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0" data-presence="entered" data-wave-toast="" role="group" tabindex="-1">',
        '<div class="wave-toast__content min-w-0 flex-1">',
        '<button aria-label="Dismiss" class="wave-toast__dismiss-button inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground not-disabled:not-aria-disabled:active:bg-subtle-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" type="button">',
        '<span class="wave-toast-title__label min-w-0 flex-1 text-body-2 font-semibold text-foreground" id="wave-toast-title-_id2_">',
        '<div class="wave-toast-body__subtitle mt-1 text-caption-1 text-muted-foreground">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with the part empty', () => {
    const cases: Array<Partial<ToasterProps>> = [
      {},
      { position: 'top-start', motion: null, className: 'mine' },
    ];
    for (const props of cases) {
      const { dispatch, dispatchContent, setProps, baseElement, unmount } = renderToaster(props);
      dispatch({ title: 'One', body: 'First', timeout: 0 });
      dispatchContent(saved, { timeout: 0 });
      dispatchContent(<p>Connection lost</p>, { status: 'warning', timeout: 0 });
      const markup = baseElement.innerHTML;
      for (const slotProps of [{}, { toast: {} }, undefined]) {
        setProps({ ...props, slotProps });
        expect(baseElement.innerHTML).toBe(markup);
      }
      unmount();
    }
  });

  it('puts your className, style, data-* and ref on every toast’s container, after its motion', () => {
    const elements: HTMLDivElement[] = [];
    const ref = (element: HTMLDivElement | null) => {
      if (element) elements.push(element);
    };
    const { dispatch } = renderToaster({
      slotProps: {
        toast: { className: 'my-toast', style: { opacity: 0.5 }, 'data-part': 'toast', ref },
      },
    });
    dispatch({ title: 'One', timeout: 0 });
    dispatch({ title: 'Two', timeout: 0 });
    const toasts = getToasts();
    expect(toasts).toHaveLength(2);
    for (const container of toasts) {
      expect(container.classList[0]).toBe(toasterClassNames.toast);
      expect(container).toHaveClass(
        ...motionClasses(toastStructure),
        ...motionClasses(toastMotion.bottom),
        'my-toast',
      );
      expect(container.classList[container.classList.length - 1]).toBe('my-toast');
      expect(container).toHaveAttribute('data-part', 'toast');
      expect(container).toHaveStyle({ opacity: '0.5' });
      expect(elements).toContain(container);
    }
    // The region, its live regions and the content elements take none of it.
    const viewport = getViewport();
    expect(viewport).not.toHaveClass('my-toast');
    expect(viewport.querySelectorAll('[data-part]')).toHaveLength(2);
    for (const region of Array.from(viewport.querySelectorAll('[aria-live]'))) {
      expect(region).not.toHaveClass('my-toast');
    }
    expect(document.querySelector('[slotprops]')).toBeNull();
  });

  it('lets your class replace a conflicting class of the container', () => {
    const { dispatch } = renderToaster({ slotProps: { toast: { className: 'rounded-lg' } } });
    dispatch({ title: 'One', timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveClass('rounded-lg');
    expect(container).not.toHaveClass('rounded');
  });

  it('locks the container’s role, tab stop, marker, phase, name, description and hidden state', () => {
    const { dispatchContent } = renderToaster(
      {
        slotProps: {
          toast: {
            role: 'alert',
            tabIndex: 0,
            'data-wave-toast': 'mine',
            'data-presence': 'exiting',
            'aria-labelledby': 'extra',
            'aria-describedby': 'extra',
            hidden: true,
            inert: true,
            'aria-hidden': true,
            title: 'Notice',
          },
        },
      },
      { app: <span id="extra">More</span> },
    );
    dispatchContent(saved, { timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAttribute('role', 'group');
    expect(container).toHaveAttribute('tabindex', '-1');
    expect(container).toHaveAttribute('data-wave-toast', '');
    expect(container).toHaveAttribute('data-presence', 'entered');
    // Set by no state of a shown toast, so locked unset: the presence core adds `inert` only
    // while the toast exits.
    for (const name of ['hidden', 'inert', 'aria-hidden']) {
      expect(container, name).not.toHaveAttribute(name);
    }
    // Your ids are added after the toast's own.
    expect(container.getAttribute('aria-labelledby')).toMatch(
      /^wave-toast-status-\S+ wave-toast-title-\S+ extra$/,
    );
    expect(container.getAttribute('aria-describedby')).toMatch(/^wave-toast-body-\S+ extra$/);
    expect(container).toHaveAccessibleName('Success: Saved More');
    expect(container).toHaveAccessibleDescription('Done. 2 files More');
    expect(container).toHaveAttribute('title', 'Notice');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('keeps the exiting phase over yours: inert while the toast exits', async () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster({
      slotProps: { toast: { inert: false, 'data-presence': 'entered' } },
    });
    const id = dispatch({ title: 'One', timeout: 0 });
    await finish(motion);
    dismiss(id);
    const [container] = getToasts();
    expect(container).toHaveAttribute('data-presence', 'exiting');
    expect(container).toHaveAttribute('inert');
    await finish(motion);
    expect(getToasts()).toHaveLength(0);
  });

  it('runs your onKeyDown first: preventDefault() keeps the toast on Delete, every toast on Escape', () => {
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
      if (event.key !== 'Backspace') event.preventDefault();
    });
    const onRegionKeyDown = vi.fn();
    const { dispatch } = renderToaster({
      onKeyDown: onRegionKeyDown,
      slotProps: { toast: { onKeyDown } },
    });
    dispatch({ title: 'One', timeout: 0 });
    dispatch({ title: 'Two', timeout: 0 });
    const [first] = getToasts();
    fireEvent.keyDown(first, { key: 'Delete' });
    expect(getToasts()).toHaveLength(2);
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(getToasts()).toHaveLength(2);
    // The region's own handler still receives the keys.
    expect(onRegionKeyDown).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(first, { key: 'Backspace' });
    expect(getToasts()).toHaveLength(1);
    expect(onKeyDown).toHaveBeenCalledTimes(3);
  });

  it('pauses the timers while focus or the pointer is in a toast, even when your handlers call preventDefault()', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const prevent = (event: React.SyntheticEvent) => event.preventDefault();
      const { dispatch } = renderToaster({
        slotProps: {
          toast: {
            onFocus: prevent,
            onBlur: prevent,
            onPointerEnter: prevent,
            onPointerOver: prevent,
            onPointerLeave: prevent,
          },
        },
      });
      dispatch({ title: 'One', timeout: 1000 });
      const [container] = getToasts();
      act(() => container.focus());
      advance(5000);
      expect(getToasts()).toHaveLength(1);
      act(() => container.blur());
      await user.hover(container);
      advance(5000);
      expect(getToasts()).toHaveLength(1);
      await user.unhover(container);
      advance(1100);
      expect(getToasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps every container registered with a new inline ref on every render', () => {
    const elements: Array<HTMLDivElement | null> = [];
    const props = (): Partial<ToasterProps> => ({
      shortcuts: { focus: altShiftN },
      slotProps: { toast: { ref: (element) => void elements.push(element) } },
    });
    const { dispatch, setProps } = renderToaster(props());
    dispatch({ title: 'One', timeout: 0 });
    dispatch({ title: 'Two', timeout: 0 });
    setProps(props());
    setProps(props());
    const toasts = getToasts();
    expect(elements.at(-1)).toBe(toasts[1]);
    // The focus shortcut finds the newest toast's container through the Toaster's own ref.
    fireEvent.keyDown(document.body, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(toasts[1]).toHaveFocus();
  });

  it('calls your part handlers once per event in StrictMode', () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster slotProps={{ toast: { onClick, onKeyDown } }}>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current?.dispatchToast({ title: 'One', timeout: 0 });
    });
    const [container] = getToasts();
    fireEvent.click(container);
    fireEvent.keyDown(container, { key: 'a' });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('draws nothing for the part before a toast is dispatched', () => {
    renderToaster({ slotProps: { toast: { className: 'my-toast' } } });
    expect(getToasts()).toEqual([]);
    expect(document.querySelector('.my-toast')).toBeNull();
    expect(getViewport()).not.toHaveAttribute('slotprops');
  });

  it('puts your class on the containers of a Toaster under RTL', () => {
    const controllerRef = React.createRef<ToastController>();
    renderWithProviders(
      <Toaster position="top-end" slotProps={{ toast: { className: 'my-toast' } }}>
        <ControllerProbe ref={controllerRef} />
      </Toaster>,
      { dir: 'rtl' },
    );
    act(() => {
      controllerRef.current?.dispatchToast({ title: 'One', timeout: 0 });
    });
    expect(getViewport().closest('[dir]')).toHaveAttribute('dir', 'rtl');
    const [container] = getToasts();
    expect(container).toHaveClass(
      toasterClassNames.toast,
      ...motionClasses(toastMotion.top),
      'my-toast',
    );
  });

  it('has no accessibility violations with the part customised', async () => {
    const { dispatchContent } = renderToaster({
      slotProps: { toast: { className: 'my-toast', title: 'Notice' } },
    });
    dispatchContent(saved, { timeout: 0 });
    await expectNoA11yViolations();
  });

  it('types the part for its element, and takes no children', () => {
    expectTypeOf<keyof ToasterSlotProps>().toEqualTypeOf<'toast'>();
    expectTypeOf<NonNullable<ToasterSlotProps['toast']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: each container holds its toast
    void (<Toaster slotProps={{ toast: { children: 'Other' } }} />);
  });
});
