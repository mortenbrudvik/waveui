import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, type PopoverContentProps, type PopoverProps } from '../Popover';
import { Dialog } from '../Dialog';
import { popoverContentClassNames } from '../../../lib/classNames';
import { getOpenLayers } from '../../../lib/layers';
import { popupMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  findDanglingIdRefs,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-POP (spec §6.2, D7, D9, D20, D22): Popover.Content mounts through the presence core with
 * the positioned popups' default motion (`popupMotion`, keyed on the resolved `data-side`), its
 * `motion` slot, `data-state`, and an exit that releases the layer, the trigger's state ARIA and
 * focus at once: focus inside a closing popover moves out in the closing commit (survey risk 2),
 * and an exiting popover keeps its last position (risk 12). jsdom loads no CSS, so the phases wait
 * only where `mockAnimations` gives the surface a running animation.
 */

const html = document.documentElement;

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Reflect.deleteProperty(html, 'clientWidth');
    Reflect.deleteProperty(html, 'clientHeight');
  }
});

const button = (name: string) => screen.getByRole('button', { name });
const trigger = () => button('Show details');
/** The Popover.Content surface, exiting ones included (an exiting surface is `inert`, not hidden). */
const surface = () => document.querySelector<HTMLElement>('.' + popoverContentClassNames.root);
/** The presence element of every popover: its surface. */
const isPopover = (el: Element) => el.classList.contains(popoverContentClassNames.root);

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/**
 * Gives elements a layout box by `data-testid` and a 1024×768 viewport, so floating-ui computes
 * real placements (as Popover.test.tsx does). Undone in `afterEach`.
 */
function mockLayout(
  boxes: Record<string, { x: number; y: number; width: number; height: number }>,
) {
  Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
  Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
  const boxOf = (el: Element) => {
    const id = el.getAttribute('data-testid');
    return id ? boxes[id] : undefined;
  };
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const { x, y, width, height } = boxOf(this) ?? { x: 0, y: 0, width: 0, height: 0 };
    const full = { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
    return { ...full, toJSON: () => full } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.width ?? 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.height ?? 0;
  });
}

/** A Details popover with one button, and a button after it on the page. */
function DetailsPopover({
  root,
  content,
}: {
  root?: Partial<PopoverProps>;
  content?: Partial<PopoverContentProps>;
}) {
  return (
    <>
      <Popover {...root}>
        <Popover.Trigger>
          <button type="button">Show details</button>
        </Popover.Trigger>
        <Popover.Content title="Details" {...content}>
          <button type="button">Edit</button>
        </Popover.Content>
      </Popover>
      <button type="button">Elsewhere</button>
    </>
  );
}

describe('Popover.Content motion slot (D5, D6)', () => {
  const open = (slot?: MotionSlot | null): React.ReactElement => (
    <DetailsPopover
      root={{ defaultOpen: true }}
      content={slot === undefined ? {} : { motion: slot }}
    />
  );
  const details = () => screen.getByRole('dialog', { name: 'Details' });

  it('undefined: the default motion, by the side it opened on', () => {
    render(open());
    expect(details()).toHaveClass(...motionClasses(popupMotion));
    expect(details()).toHaveAttribute('data-side', 'bottom');
  });

  it('null: no motion, and the surface still renders its phase', () => {
    render(open(null));
    expectNoWordOf(details(), popupMotion);
    expect(details()).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['a slot object', { className: 'my-motion' }],
  ] as const)('%s replaces the default motion', (_, slot) => {
    render(open(slot));
    expect(details()).toHaveClass('my-motion');
    expectNoWordOf(details(), popupMotion);
  });

  it('WaveProvider motion="none" turns the default off; the part’s own value still applies', () => {
    const { unmount } = renderWithProviders(open(), { motion: 'none' });
    expectNoWordOf(details(), popupMotion);
    expect(details()).toHaveAttribute('data-presence', 'entered');
    unmount();
    renderWithProviders(open('my-motion'), { motion: 'none' });
    expect(details()).toHaveClass('my-motion');
  });

  it('keeps the motion prop off the DOM, and a className next to the motion classes', () => {
    render(
      <DetailsPopover
        root={{ defaultOpen: true }}
        content={{ motion: 'my-motion', className: 'p-8' }}
      />,
    );
    expect(details()).not.toHaveAttribute('motion');
    expect(details()).toHaveClass('my-motion', 'p-8');
  });
});

describe('Popover.Content presence (D7, D9, D22)', () => {
  it('exits after Escape: kept mounted, closed and inert, with the layer and focus released at once', async () => {
    const motion = mockAnimations({ animated: isPopover });
    const user = userEvent.setup();
    render(<DetailsPopover />);
    await user.click(trigger());
    const popover = surface()!;
    expect(popover).toHaveAttribute('data-presence', 'entering');
    expect(popover).toHaveAttribute('data-state', 'open');
    await finish(motion);
    expect(popover).toHaveAttribute('data-presence', 'entered');
    expect(popover).toHaveAttribute('data-state', 'open');

    await user.click(button('Edit'));
    await user.keyboard('{Escape}');
    expect(surface()).toBe(popover);
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover).toHaveAttribute('data-state', 'closed');
    expect(popover.closest('[inert]')).toBe(popover);
    expect(getOpenLayers()).toHaveLength(0);
    expect(trigger()).toHaveFocus();

    await finish(motion);
    expect(surface()).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it.each([
    ['titled', { title: 'Details' }],
    ['named by its trigger', { title: undefined }],
  ] as const)(
    '%s: the trigger’s aria-controls goes in the closing commit, and no id reference dangles while it exits',
    async (_, content) => {
      const motion = mockAnimations({ animated: isPopover });
      const user = userEvent.setup();
      render(<DetailsPopover content={content} />);
      await user.click(trigger());
      const popover = surface()!;
      expect(trigger()).toHaveAttribute('aria-controls', popover.id);
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      expect(findDanglingIdRefs()).toEqual([]);

      await user.keyboard('{Escape}');
      expect(popover).toHaveAttribute('data-presence', 'exiting');
      expect(trigger()).not.toHaveAttribute('aria-controls');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(findDanglingIdRefs()).toEqual([]);
      expect(document.querySelectorAll(`[id="${popover.id}"]`)).toHaveLength(1);

      await finish(motion);
      expect(surface()).toBeNull();
      expect(findDanglingIdRefs()).toEqual([]);
    },
  );

  it('reopened during its exit: the same surface enters again, open and not inert, with its layer and tab order (Review Focus 1)', async () => {
    const motion = mockAnimations({ animated: isPopover });
    const user = userEvent.setup();
    render(<DetailsPopover />);
    await user.click(trigger());
    await finish(motion);
    const popover = surface()!;

    await user.click(trigger());
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover).toHaveAttribute('data-state', 'closed');
    expect(popover.closest('[inert]')).toBe(popover);

    await user.click(trigger());
    expect(surface()).toBe(popover);
    expect(document.querySelectorAll('.' + popoverContentClassNames.root)).toHaveLength(1);
    expect(popover).toHaveAttribute('data-presence', 'entering');
    expect(popover).toHaveAttribute('data-state', 'open');
    expect(popover.closest('[inert]')).toBeNull();
    expect(getOpenLayers()).toHaveLength(1);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', popover.id);
    // Tab from the open trigger enters the content again.
    await user.tab();
    expect(button('Edit')).toHaveFocus();

    await finish(motion);
    expect(popover).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    expect(trigger()).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('animates in a popover open by default on a client render (appear)', async () => {
    const motion = mockAnimations({ animated: isPopover });
    render(<DetailsPopover root={{ defaultOpen: true }} />);
    const popover = surface()!;
    expect(popover).toHaveAttribute('data-presence', 'entering');
    expect(popover).not.toHaveAttribute('inert');
    await finish(motion);
    expect(popover).toHaveAttribute('data-presence', 'entered');
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isPopover });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<DetailsPopover />);
    await user.click(trigger());
    expect(surface()).toHaveAttribute('data-presence', 'entered');
    await user.click(button('Edit'));
    await user.keyboard('{Escape}');
    expect(surface()).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('under StrictMode calls onOpenChange once per change', async () => {
    const motion = mockAnimations({ animated: isPopover });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <DetailsPopover root={{ onOpenChange }} />
      </React.StrictMode>,
    );
    await user.click(trigger());
    await finish(motion);
    await user.keyboard('{Escape}');
    expect(surface()).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});

describe('focus before close (D20, survey risk 2)', () => {
  it('a button in the content that closes it and opens a Dialog in one update: closing the Dialog focuses the trigger', async () => {
    /** Rename closes the popover and opens the Dialog (rendered after it) in one update. */
    function RenameFlow() {
      const [open, setOpen] = React.useState(false);
      const [renaming, setRenaming] = React.useState(false);
      return (
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <Popover.Trigger>
              <button type="button">Actions</button>
            </Popover.Trigger>
            <Popover.Content aria-label="More actions">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
            </Popover.Content>
          </Popover>
          <button type="button">Elsewhere</button>
          <Dialog open={renaming} onOpenChange={setRenaming}>
            <Dialog.Content title="Rename">
              <Dialog.Close>
                <button type="button">Cancel</button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </>
      );
    }

    const motion = mockAnimations({ animated: isPopover });
    const user = userEvent.setup();
    render(<RenameFlow />);
    await user.click(button('Actions'));
    await finish(motion);
    await user.click(button('Rename'));
    const popover = surface()!;
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover.closest('[inert]')).toBe(popover);
    const dialog = screen.getByRole('dialog', { name: 'Rename' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await finish(motion);
    expect(surface()).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Rename' })).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
  });

  it('a hover close leaves focus on an outside button, through the exit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const advance = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    const motion = mockAnimations({ animated: isPopover });
    render(<DetailsPopover root={{ openOnHover: true }} />);
    await user.hover(trigger());
    advance(300);
    const popover = surface()!;
    expect(popover).toHaveAttribute('data-state', 'open');
    await finish(motion);
    act(() => button('Elsewhere').focus());

    await user.unhover(trigger());
    advance(600);
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover.closest('[inert]')).toBe(popover);
    expect(button('Elsewhere')).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
    expect(button('Elsewhere')).toHaveFocus();
  });

  it('a popover placed at a target returns focus to the element that opened it while it exits', async () => {
    function FilterPopover() {
      const [open, setOpen] = React.useState(false);
      const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            ref={setTarget}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            Filters
          </button>
          <Popover open={open} onOpenChange={setOpen} target={target}>
            <Popover.Content aria-label="Filter options">
              <button type="button">Apply</button>
            </Popover.Content>
          </Popover>
        </>
      );
    }

    const motion = mockAnimations({ animated: isPopover });
    const user = userEvent.setup();
    render(<FilterPopover />);
    await user.click(button('Filters'));
    await finish(motion);
    await user.click(button('Apply'));
    await user.keyboard('{Escape}');
    expect(surface()).toHaveAttribute('data-presence', 'exiting');
    expect(button('Filters')).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
    expect(button('Filters')).toHaveFocus();
  });
});

describe('context popovers (openOnContext)', () => {
  /** A file list whose rows open a context popover. */
  function FileList() {
    return (
      <>
        <Popover openOnContext>
          <Popover.Trigger>
            <div role="group" aria-label="Files" data-testid="region">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" data-testid={`row-${n}`}>{`Row ${n}`}</button>
              ))}
            </div>
          </Popover.Trigger>
          <Popover.Content aria-label="File actions" data-testid="content">
            <button type="button">Open</button>
          </Popover.Content>
        </Popover>
        <button type="button">Elsewhere</button>
      </>
    );
  }
  const row = (n: number) => button(`Row ${n}`);

  it('exits where it opened: its position is unchanged between open and exiting (risk 12)', async () => {
    mockLayout({
      region: { x: 100, y: 100, width: 300, height: 200 },
      'row-2': { x: 100, y: 140, width: 300, height: 30 },
      content: { x: 0, y: 0, width: 256, height: 120 },
    });
    const motion = mockAnimations({ animated: isPopover });
    const user = userEvent.setup();
    render(<FileList />);
    act(() => row(2).focus());
    fireEvent.contextMenu(row(2), { button: 2, clientX: 300, clientY: 200 });
    const popover = surface()!;
    await waitFor(() => expect(popover.style.transform).toBe('translate(300px, 208px)'));
    await finish(motion);
    const style = popover.getAttribute('style');
    expect(popover).toHaveAttribute('data-side', 'bottom');

    await user.keyboard('{Escape}');
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(row(2)).toHaveFocus();
    // floating-ui updates once more as the popover closes: let it settle.
    await act(async () => {});
    expect(popover.getAttribute('style')).toBe(style);
    expect(popover).toHaveAttribute('data-side', 'bottom');
    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('a keyboard gesture moves focus into it; Escape returns focus to the row in the closing commit', async () => {
    const motion = mockAnimations({ animated: isPopover });
    const user = userEvent.setup();
    render(<FileList />);
    act(() => row(3).focus());
    await user.keyboard('{Shift>}{F10}{/Shift}');
    const popover = surface()!;
    expect(button('Open')).toHaveFocus();
    await finish(motion);

    await user.keyboard('{Escape}');
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover.closest('[inert]')).toBe(popover);
    expect(row(3)).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
    expect(row(3)).toHaveFocus();
  });
});
