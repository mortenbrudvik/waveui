import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useFocusTrap, type UseFocusTrapOptions } from '../useFocusTrap';
import { useDismiss } from '../useDismiss';
import { Portal } from '../../components/portal/Portal';
import { getTopmostLayer } from '../../lib/layers';

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
});

interface TrapProps extends Partial<UseFocusTrapOptions> {
  children?: React.ReactNode;
  label?: string;
}

/** A stand-in modal surface: element held in state via a callback ref (C-POPUPS). */
function Trap({ children, label = 'Dialog', enabled = true, ...options }: TrapProps) {
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  useFocusTrap(surface, { enabled, ...options });
  return (
    <div ref={setSurface} role="dialog" aria-label={label} tabIndex={-1}>
      {children}
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <>
      <button type="button">Before</button>
      {children}
      <button type="button">After</button>
    </>
  );
}

function button(name: string) {
  return screen.getByRole('button', { name });
}

/** Runs the microtask in which the trap returns focus that landed outside. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useFocusTrap — initial focus', () => {
  it('focuses the first tabbable synchronously when the element appears', () => {
    render(
      <Page>
        <Trap>
          <button type="button" disabled>
            Disabled
          </button>
          <button type="button">First</button>
          <button type="button">Second</button>
        </Trap>
      </Page>,
    );
    expect(button('First')).toHaveFocus();
  });

  it('keeps an autoFocus element that already has focus', () => {
    render(
      <Trap>
        <button type="button">First</button>
        <input aria-label="Name" autoFocus />
      </Trap>,
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('supports initialFocus as a ref, a function and "container"', () => {
    function WithRef() {
      const ref = React.useRef<HTMLButtonElement>(null);
      return (
        <Trap initialFocus={ref}>
          <button type="button">One</button>
          <button type="button" ref={ref}>
            Two
          </button>
        </Trap>
      );
    }
    const { unmount } = render(<WithRef />);
    expect(button('Two')).toHaveFocus();
    unmount();

    const second = render(
      <Trap initialFocus={() => document.querySelector<HTMLElement>('#pick')}>
        <button type="button">A</button>
        <button type="button" id="pick">
          B
        </button>
      </Trap>,
    );
    expect(button('B')).toHaveFocus();
    second.unmount();

    render(
      <Trap initialFocus="container">
        <button type="button">X</button>
      </Trap>,
    );
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toHaveFocus();
  });

  it('falls back to the container when nothing inside is tabbable', () => {
    render(
      <Trap>
        <p>Only text</p>
      </Trap>,
    );
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toHaveFocus();
  });

  it('does nothing while disabled', () => {
    render(
      <Trap enabled={false}>
        <button type="button">Inside</button>
      </Trap>,
    );
    expect(button('Inside')).not.toHaveFocus();
  });
});

describe('useFocusTrap — Tab cycle', () => {
  it('wraps from a last button followed by a disabled button', async () => {
    const user = userEvent.setup();
    render(
      <Page>
        <Trap>
          <button type="button">Cancel</button>
          <button type="button">OK</button>
          <button type="button" disabled>
            Save
          </button>
        </Trap>
      </Page>,
    );
    act(() => button('OK').focus());
    // Focus that left the trap would be returned to the element it left (OK, then Cancel), so
    // landing on the other button shows the Tab itself wrapped.
    await user.tab();
    expect(button('Cancel')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('OK')).toHaveFocus();
  });

  it('wraps past a tabindex=-1 button at the end', async () => {
    const user = userEvent.setup();
    render(
      <Page>
        <Trap>
          <button type="button">One</button>
          <button type="button">Two</button>
          <button type="button" tabIndex={-1}>
            Skipped
          </button>
        </Trap>
      </Page>,
    );
    await user.tab();
    expect(button('Two')).toHaveFocus();
    await user.tab();
    expect(button('One')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Two')).toHaveFocus();
  });

  it('moves Shift+Tab from the container itself to the last tabbable, Tab to the first', async () => {
    const user = userEvent.setup();
    render(
      <Page>
        <Trap initialFocus="container">
          <button type="button">First</button>
          <button type="button">Last</button>
        </Trap>
      </Page>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Dialog' });
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Last')).toHaveFocus();
    act(() => dialog.focus());
    await user.tab();
    expect(button('First')).toHaveFocus();
  });

  it('continues from a focused non-tabbable element in document order', async () => {
    const user = userEvent.setup();
    render(
      <Trap>
        <button type="button">First</button>
        <div tabIndex={-1} data-testid="region">
          Region
        </div>
        <button type="button">Second</button>
      </Trap>,
    );
    act(() => screen.getByTestId('region').focus());
    await user.tab();
    expect(button('Second')).toHaveFocus();
    act(() => screen.getByTestId('region').focus());
    await user.tab({ shift: true });
    expect(button('First')).toHaveFocus();
  });

  it('wraps from the focused radio of an unchecked named group that ends the dialog', async () => {
    const user = userEvent.setup();
    render(
      <Page>
        <Trap>
          <button type="button">Start</button>
          <input type="radio" name="size" aria-label="Small" />
          <input type="radio" name="size" aria-label="Large" />
        </Trap>
      </Page>,
    );
    act(() => screen.getByRole('radio', { name: 'Small' }).focus());
    await user.tab();
    expect(button('Start')).toHaveFocus();
    await user.tab({ shift: true });
    // Entering the unchecked group backwards lands on its last radio (browser order).
    expect(screen.getByRole('radio', { name: 'Large' })).toHaveFocus();
  });

  it('computes tabbables at keydown time (content added while trapped is included)', async () => {
    const user = userEvent.setup();
    function Growing() {
      const [extra, setExtra] = React.useState(false);
      return (
        <Page>
          <Trap>
            <button type="button" onClick={() => setExtra(true)}>
              Add
            </button>
            {extra && <button type="button">Added</button>}
          </Trap>
        </Page>
      );
    }
    render(<Growing />);
    await user.click(button('Add'));
    await user.tab();
    expect(button('Added')).toHaveFocus();
    await user.tab();
    expect(button('Add')).toHaveFocus();
  });

  it('lets a React handler that prevents Tab win (bubble phase, defaultPrevented)', async () => {
    const user = userEvent.setup();
    render(
      <Page>
        <Trap>
          <button type="button">First</button>
          <button
            type="button"
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                document.querySelector<HTMLElement>('#target')?.focus();
              }
            }}
          >
            Menu item
          </button>
          <button type="button" id="target">
            Target
          </button>
        </Trap>
      </Page>,
    );
    act(() => button('Menu item').focus());
    await user.tab({ shift: true });
    expect(button('Target')).toHaveFocus();
  });

  it('ignores Tab with Ctrl/Alt/Meta', () => {
    render(
      <Page>
        <Trap>
          <button type="button">Only</button>
        </Trap>
      </Page>,
    );
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    button('Only').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('useFocusTrap — allow-listed regions', () => {
  function Toasts() {
    return (
      <Portal layer="toast">
        <div data-wave-focus-trap-allow="" role="region" aria-label="Notifications">
          <button type="button">Toast action</button>
          <button type="button">Dismiss toast</button>
        </div>
      </Portal>
    );
  }

  it('includes the allow-listed tabbables in the Tab cycle', async () => {
    const user = userEvent.setup();
    render(
      <Page>
        <Toasts />
        <Trap>
          <button type="button">First</button>
          <button type="button">Last</button>
        </Trap>
      </Page>,
    );
    act(() => button('Last').focus());
    await user.tab();
    expect(button('Toast action')).toHaveFocus();
    await user.tab();
    expect(button('Dismiss toast')).toHaveFocus();
    await user.tab();
    expect(button('First')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Dismiss toast')).toHaveFocus();
  });

  it('does not pull focus back out of an allow-listed region', async () => {
    render(
      <Page>
        <Toasts />
        <Trap>
          <button type="button">First</button>
        </Trap>
      </Page>,
    );
    act(() => button('Toast action').focus());
    await flushMicrotasks();
    expect(button('Toast action')).toHaveFocus();
  });
});

describe('useFocusTrap — focus leaving', () => {
  it('returns focus to the last focused element inside when focus moves outside', async () => {
    render(
      <Page>
        <Trap>
          <button type="button">First</button>
          <button type="button">Second</button>
        </Trap>
      </Page>,
    );
    act(() => button('Second').focus());
    act(() => button('After').focus());
    await flushMicrotasks();
    expect(button('Second')).toHaveFocus();
  });

  it('stops trapping when disabled or unmounted', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Page>
        <Trap>
          <button type="button">Inside</button>
        </Trap>
      </Page>,
    );
    rerender(
      <Page>
        <Trap enabled={false}>
          <button type="button">Inside</button>
        </Trap>
      </Page>,
    );
    act(() => button('After').focus());
    await flushMicrotasks();
    expect(button('After')).toHaveFocus();
    act(() => button('Inside').focus());
    await user.tab();
    expect(button('After')).toHaveFocus();
  });

  it('does not fight a script that pulls focus out again while it is being returned', async () => {
    render(
      <Page>
        <Trap>
          <button type="button">Inside</button>
        </Trap>
      </Page>,
    );
    // Another focus trap on the page that keeps focus on "Before", synchronously (capped, so a
    // regression fails instead of looping forever).
    let pulls = 0;
    const rival = (event: FocusEvent) => {
      if (event.target === button('Before') || pulls >= 20) return;
      pulls += 1;
      button('Before').focus();
    };
    document.addEventListener('focusin', rival, true);
    try {
      act(() => button('Before').focus());
      await flushMicrotasks();
      await flushMicrotasks();
      // The trap gave up: the other script keeps focus, and the fight ended before its cap.
      expect(button('Before')).toHaveFocus();
      expect(pulls).toBeLessThan(20);
    } finally {
      document.removeEventListener('focusin', rival, true);
    }
  });
});

describe('useFocusTrap — descendant layers', () => {
  /** A stand-in dialog with a popover layer anchored at a trigger inside it. */
  function DialogWithPopover() {
    const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
    const dialogRef = React.useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = React.useState(false);
    const dialog = useDismiss({
      open: true,
      onDismiss: () => {},
      refs: [dialogRef],
      kind: 'modal',
    });
    useFocusTrap(surface, { enabled: true, layerId: dialog.layerId });
    return (
      <Portal layerId={dialog.layerId}>
        <div
          ref={(el) => {
            dialogRef.current = el;
            setSurface(el);
          }}
          role="dialog"
          aria-label="Dialog"
          tabIndex={-1}
        >
          <button type="button">Before anchor</button>
          <PopoverLayer open={open} onToggle={() => setOpen((o) => !o)} />
          <button type="button">After anchor</button>
        </div>
      </Portal>
    );
  }

  function PopoverLayer({ open, onToggle }: { open: boolean; onToggle: () => void }) {
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const surfaceRef = React.useRef<HTMLDivElement>(null);
    const { layerId } = useDismiss({
      open,
      onDismiss: onToggle,
      refs: [surfaceRef, triggerRef],
      anchorRef: triggerRef,
    });
    return (
      <>
        <button type="button" ref={triggerRef} onClick={onToggle}>
          Anchor
        </button>
        {open && (
          <Portal layerId={layerId}>
            <div ref={surfaceRef} role="group" aria-label="Popover">
              <a href="#one">Link one</a>
              <a href="#two">Link two</a>
            </div>
          </Portal>
        )}
      </>
    );
  }

  it('tabs natively inside a descendant layer, then continues after its anchor', async () => {
    const user = userEvent.setup();
    render(<DialogWithPopover />);
    await user.click(button('Anchor'));
    act(() => screen.getByRole('link', { name: 'Link one' }).focus());
    await user.tab();
    expect(screen.getByRole('link', { name: 'Link two' })).toHaveFocus();
    await user.tab();
    expect(button('After anchor')).toHaveFocus();
  });

  it('moves Shift+Tab from the first tabbable of a descendant layer to its anchor', async () => {
    const user = userEvent.setup();
    render(<DialogWithPopover />);
    await user.click(button('Anchor'));
    act(() => screen.getByRole('link', { name: 'Link one' }).focus());
    await user.tab({ shift: true });
    expect(button('Anchor')).toHaveFocus();
  });

  it('does not pull focus back from a descendant layer', async () => {
    const user = userEvent.setup();
    render(<DialogWithPopover />);
    await user.click(button('Anchor'));
    act(() => screen.getByRole('link', { name: 'Link two' }).focus());
    await flushMicrotasks();
    expect(screen.getByRole('link', { name: 'Link two' })).toHaveFocus();
  });

  it('tabs natively inside a raw Portal rendered in the surface, then wraps at its edges', async () => {
    const user = userEvent.setup();
    function DialogWithPortal() {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const dialogRef = React.useRef<HTMLDivElement | null>(null);
      const dialog = useDismiss({
        open: true,
        onDismiss: () => {},
        refs: [dialogRef],
        kind: 'modal',
      });
      useFocusTrap(surface, { enabled: true, layerId: dialog.layerId });
      return (
        <Portal layerId={dialog.layerId}>
          <div
            ref={(el) => {
              dialogRef.current = el;
              setSurface(el);
            }}
            role="dialog"
            aria-label="Dialog"
            tabIndex={-1}
          >
            <button type="button">In dialog</button>
            <Portal>
              <div role="group" aria-label="Portaled">
                <button type="button">P1</button>
                <button type="button">P2</button>
              </div>
            </Portal>
            <button type="button">Last in dialog</button>
          </div>
        </Portal>
      );
    }
    render(
      <Page>
        <DialogWithPortal />
      </Page>,
    );
    act(() => button('P1').focus());
    await user.tab();
    expect(button('P2')).toHaveFocus();
    await user.tab();
    expect(button('In dialog')).toHaveFocus();
    act(() => button('P2').focus());
    await user.tab({ shift: true });
    expect(button('P1')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Last in dialog')).toHaveFocus();
  });
});

describe('useFocusTrap — layer refs outside the container', () => {
  /**
   * A calendar-like popup: the layer's refs include the trigger (outside the surface), as in the
   * DatePicker, and the trap is given the layer id.
   */
  function CalendarPopup() {
    const [open, setOpen] = React.useState(false);
    const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const surfaceRef = React.useRef<HTMLDivElement | null>(null);
    const { layerId } = useDismiss({
      open,
      onDismiss: () => setOpen(false),
      refs: [surfaceRef, triggerRef],
      anchorRef: triggerRef,
    });
    useFocusTrap(surface, { enabled: open, layerId });
    return (
      <>
        <button type="button" ref={triggerRef} onClick={() => setOpen((o) => !o)}>
          Open calendar
        </button>
        {open && (
          <Portal layerId={layerId}>
            <div
              ref={(el) => {
                surfaceRef.current = el;
                setSurface(el);
              }}
              role="dialog"
              aria-label="Calendar"
              tabIndex={-1}
            >
              <button type="button">Day 1</button>
              <button type="button">Day 2</button>
            </div>
          </Portal>
        )}
      </>
    );
  }

  it('moves initial focus into the surface when opened from its focused trigger', async () => {
    const user = userEvent.setup();
    render(<CalendarPopup />);
    await user.click(button('Open calendar'));
    expect(screen.getByRole('dialog', { name: 'Calendar' })).toBeInTheDocument();
    expect(button('Day 1')).toHaveFocus();
  });

  it('returns focus inside when it moves onto the layer’s own trigger while trapped', async () => {
    const user = userEvent.setup();
    render(<CalendarPopup />);
    await user.click(button('Open calendar'));
    act(() => button('Day 2').focus());
    act(() => button('Open calendar').focus());
    await flushMicrotasks();
    expect(button('Day 2')).toHaveFocus();
  });
});

describe('useFocusTrap — trap stack', () => {
  it('lets only the topmost trap act, and the outer one resumes afterwards', async () => {
    const user = userEvent.setup();
    function Nested({ inner }: { inner: boolean }) {
      return (
        <Page>
          <Trap label="Outer">
            <button type="button">Outer one</button>
            <button type="button">Outer two</button>
          </Trap>
          {inner && (
            <Trap label="Inner">
              <button type="button">Inner one</button>
              <button type="button">Inner two</button>
            </Trap>
          )}
        </Page>
      );
    }
    const { rerender } = render(<Nested inner={false} />);
    expect(button('Outer one')).toHaveFocus();
    rerender(<Nested inner />);
    expect(button('Inner one')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(button('Inner one')).toHaveFocus();
    rerender(<Nested inner={false} />);
    act(() => button('Outer two').focus());
    await user.tab();
    expect(button('Outer one')).toHaveFocus();
  });

  it('puts a child layer’s trap above its parent’s when both open in one commit', async () => {
    const user = userEvent.setup();
    function LayeredTrap({ label, children }: { label: string; children?: React.ReactNode }) {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const ref = React.useRef<HTMLDivElement | null>(null);
      const { layerId } = useDismiss({ open: true, onDismiss: () => {}, refs: [ref] });
      useFocusTrap(surface, { enabled: true, layerId });
      return (
        <Portal layerId={layerId}>
          <div
            ref={(el) => {
              ref.current = el;
              setSurface(el);
            }}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
          >
            <button type="button">{`${label} A`}</button>
            <button type="button">{`${label} B`}</button>
            {children}
          </div>
        </Portal>
      );
    }
    render(
      <LayeredTrap label="Parent">
        <LayeredTrap label="Child" />
      </LayeredTrap>,
    );
    act(() => button('Child B').focus());
    await user.tab();
    expect(button('Child A')).toHaveFocus();
  });
});

describe('useFocusTrap — library copies', () => {
  it('shares one trap stack with another copy of the library (global registry)', async () => {
    vi.resetModules();
    const copy = await import('../useFocusTrap');
    expect(copy.useFocusTrap).not.toBe(useFocusTrap);
    function CopyTrap({ children }: { children: React.ReactNode }) {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      copy.useFocusTrap(surface, { enabled: true });
      return (
        <div ref={setSurface} role="dialog" aria-label="Inner" tabIndex={-1}>
          {children}
        </div>
      );
    }
    function Nested({ inner }: { inner: boolean }) {
      return (
        <Page>
          <Trap label="Outer">
            <button type="button">Outer one</button>
          </Trap>
          {inner && (
            <CopyTrap>
              <button type="button">Inner one</button>
              <button type="button">Inner two</button>
            </CopyTrap>
          )}
        </Page>
      );
    }
    // Two separate stacks would each pull focus into their own trap, forever: stop such a fight
    // (window capture runs before the traps' document listeners) so a regression fails instead.
    let focusEvents = 0;
    const breaker = (event: FocusEvent) => {
      focusEvents += 1;
      if (focusEvents > 50) event.stopImmediatePropagation();
    };
    window.addEventListener('focusin', breaker, true);
    try {
      const user = userEvent.setup();
      const { rerender } = render(<Nested inner={false} />);
      rerender(<Nested inner />);
      await flushMicrotasks();
      expect(button('Inner one')).toHaveFocus();
      await user.tab();
      await user.tab();
      expect(button('Inner one')).toHaveFocus();
      expect(focusEvents).toBeLessThan(10);
    } finally {
      window.removeEventListener('focusin', breaker, true);
    }
  });
});

describe('useFocusTrap — listeners', () => {
  it('installs document listeners only while a trap is active', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    try {
      const { unmount } = render(
        <Trap>
          <button type="button">Inside</button>
        </Trap>,
      );
      const added = add.mock.calls.map(([type]) => type);
      expect(added).toEqual(expect.arrayContaining(['keydown', 'focusin']));
      unmount();
      const removed = remove.mock.calls.map(([type]) => type);
      expect(removed).toEqual(expect.arrayContaining(['keydown', 'focusin']));
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
