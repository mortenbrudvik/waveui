import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusBeforeClose, type UseFocusBeforeCloseOptions } from '../useFocusBeforeClose';
import { useMergedRefs } from '../useMergedRefs';
import { usePresence } from '../usePresence';
import { Dialog } from '../../components/overlays/Dialog';
import { Portal } from '../../components/portal/Portal';
import { mockAnimations } from '../../test-utils';

/*
 * useFocusBeforeClose (spec D20, Phase 2 note 20): focus inside a surface that closes moves out
 * in the closing commit (a layout-effect cleanup), so a surface opened in the same update records
 * the right opener; never on unmount, so React StrictMode's simulated unmount moves nothing.
 *
 * A closing surface stays in the document, `inert`, while it exits. After a commit, React DOM
 * focuses again the element that had focus before it when that element is still in the document;
 * a browser does not focus an element inside an `inert` subtree, so focus stays where the hook put
 * it. jsdom has no `inert` behaviour: `emulateInert` gives `focus()` the browser's rule.
 */

const button = (name: string) => screen.getByRole('button', { name });

/** Makes `focus()` do nothing on an element inside an `inert` subtree, as a browser does. */
function emulateInert() {
  const focus = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    if (this.closest('[inert]')) return;
    focus.call(this, options);
  });
}

/** The `focus()` calls since the last `clearFocusCalls()`, as `[element, options]`. */
function focusCalls(): [unknown, FocusOptions | undefined][] {
  const focus = vi.mocked(HTMLElement.prototype.focus);
  return focus.mock.contexts.map((element, index) => [element, focus.mock.calls[index][0]]);
}

function clearFocusCalls() {
  vi.mocked(HTMLElement.prototype.focus).mockClear();
}

beforeEach(() => {
  emulateInert();
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Options = Omit<UseFocusBeforeCloseOptions, 'open' | 'surfaceRef'>;

interface SurfaceProps extends Partial<Options> {
  open: boolean;
  autoFocus?: boolean;
  /** `inert` while closed, as an exiting surface is. @default true */
  inertWhileClosed?: boolean;
}

/** A surface that stays in the document while closed, as an exiting one does. */
function Surface({
  open,
  captureOpener = () => null,
  candidates = (opener) => [opener],
  autoFocus = false,
  inertWhileClosed = true,
}: SurfaceProps) {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  useFocusBeforeClose({ open, surfaceRef, captureOpener, candidates });
  return (
    <div ref={surfaceRef} data-testid="surface" inert={!open && inertWhileClosed}>
      <button type="button" autoFocus={autoFocus}>
        Inside
      </button>
    </div>
  );
}

/** Two buttons around the surface, which `mounted={false}` removes. */
function Page({ mounted = true, ...surface }: SurfaceProps & { mounted?: boolean }) {
  return (
    <>
      <button type="button">Trigger</button>
      {mounted && <Surface {...surface} />}
      <button type="button">Outside</button>
    </>
  );
}

/** Records every element that receives focus until the test ends. */
function recordFocus(): Element[] {
  const focused: Element[] = [];
  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Element) focused.push(event.target);
  };
  document.addEventListener('focusin', onFocusIn);
  onTestFinished(() => document.removeEventListener('focusin', onFocusIn));
  return focused;
}

describe('useFocusBeforeClose', () => {
  it('moves focus inside the surface to the first valid candidate in the closing commit', () => {
    const candidates = () => [button('Outside')];
    const { rerender } = render(<Page open candidates={candidates} />);
    act(() => button('Inside').focus());
    clearFocusCalls();

    act(() => rerender(<Page open={false} candidates={candidates} />));
    // Synchronously after the closing act: no microtask has run since the commit.
    expect(button('Outside')).toHaveFocus();
    expect(focusCalls().filter(([element]) => element === button('Outside'))).toEqual([
      [button('Outside'), { preventScroll: true }],
    ]);
  });

  it('skips a candidate that is gone, cannot take focus or lies inside the surface', () => {
    const detached = document.createElement('button');
    const disabled = document.body.appendChild(document.createElement('button'));
    disabled.disabled = true;
    const candidates = () => [
      null,
      undefined,
      detached,
      disabled,
      button('Inside'),
      button('Trigger'),
      button('Outside'),
    ];
    try {
      const { rerender } = render(<Page open candidates={candidates} />);
      act(() => button('Inside').focus());
      act(() => rerender(<Page open={false} candidates={candidates} />));
      expect(button('Trigger')).toHaveFocus();
    } finally {
      disabled.remove();
    }
  });

  it('moves nothing when focus is outside the surface at close', () => {
    const candidates = () => [button('Trigger')];
    const { rerender } = render(<Page open candidates={candidates} />);
    act(() => button('Outside').focus());
    clearFocusCalls();
    act(() => rerender(<Page open={false} candidates={candidates} />));
    expect(button('Outside')).toHaveFocus();
    expect(focusCalls()).toEqual([]);
  });

  it('moves nothing when the surface unmounts while open', () => {
    const candidates = () => [button('Trigger')];
    const { rerender } = render(<Page open candidates={candidates} />);
    act(() => button('Inside').focus());
    clearFocusCalls();
    act(() => rerender(<Page open mounted={false} candidates={candidates} />));
    expect(focusCalls()).toEqual([]);
    expect(document.activeElement).toBe(document.body);
  });

  describe('the opener', () => {
    it('is the element captureOpener returns when the surface opens', () => {
      const captureOpener = () => button('Trigger');
      const { rerender } = render(<Page open={false} captureOpener={captureOpener} />);
      act(() => button('Outside').focus());
      act(() => rerender(<Page open captureOpener={captureOpener} />));
      act(() => button('Inside').focus());
      act(() => rerender(<Page open={false} captureOpener={captureOpener} />));
      expect(button('Trigger')).toHaveFocus();
    });

    it('is the focused element when captureOpener returns null', () => {
      const { rerender } = render(<Page open={false} />);
      act(() => button('Outside').focus());
      act(() => rerender(<Page open />));
      act(() => button('Inside').focus());
      act(() => rerender(<Page open={false} />));
      expect(button('Outside')).toHaveFocus();
    });

    it('is never <body>', () => {
      const candidates = vi.fn((opener: HTMLElement | null) => [opener, button('Trigger')]);
      const { rerender } = render(<Page open={false} candidates={candidates} />);
      expect(document.activeElement).toBe(document.body);
      act(() => rerender(<Page open candidates={candidates} />));
      act(() => button('Inside').focus());
      act(() => rerender(<Page open={false} candidates={candidates} />));
      expect(candidates.mock.calls).toEqual([[null]]);
      expect(button('Trigger')).toHaveFocus();
    });

    it('is never an element inside the surface, the one captureOpener returns included', () => {
      const candidates = vi.fn((opener: HTMLElement | null) => [opener, button('Trigger')]);
      // A surface that can hold focus while closed, so focus is inside it when it opens.
      const page = (open: boolean, captureOpener?: () => HTMLElement | null) => (
        <Page
          open={open}
          inertWhileClosed={false}
          captureOpener={captureOpener}
          candidates={candidates}
        />
      );
      const { rerender } = render(page(false));
      act(() => button('Inside').focus());
      act(() => rerender(page(true)));
      act(() => rerender(page(false)));
      expect(candidates.mock.calls).toEqual([[null]]);

      act(() => button('Outside').focus());
      act(() => rerender(page(true, () => button('Inside'))));
      act(() => button('Inside').focus());
      act(() => rerender(page(false, () => button('Inside'))));
      expect(candidates.mock.calls).toEqual([[null], [button('Outside')]]);
    });

    it('is captured again when the surface opens again', () => {
      const candidates = vi.fn((opener: HTMLElement | null) => [opener]);
      const { rerender } = render(<Page open={false} candidates={candidates} />);
      act(() => button('Outside').focus());
      act(() => rerender(<Page open candidates={candidates} />));
      act(() => button('Inside').focus());
      act(() => rerender(<Page open={false} candidates={candidates} />));
      act(() => button('Trigger').focus());
      act(() => rerender(<Page open candidates={candidates} />));
      act(() => button('Inside').focus());
      act(() => rerender(<Page open={false} candidates={candidates} />));
      expect(candidates.mock.calls).toEqual([[button('Outside')], [button('Trigger')]]);
      expect(button('Trigger')).toHaveFocus();
    });
  });

  it('a Dialog opened by an element of the surface as it closes records the trigger (Phase 2 note 20)', async () => {
    const motion = mockAnimations({ animated: (el) => el.getAttribute('data-testid') === 'popup' });
    const user = userEvent.setup();

    /** A portaled popup that stays mounted, inert, while it exits. */
    function Popup({
      open,
      triggerRef,
      children,
    }: {
      open: boolean;
      triggerRef: React.RefObject<HTMLButtonElement | null>;
      children: React.ReactNode;
    }) {
      const surfaceRef = React.useRef<HTMLDivElement | null>(null);
      const { isMounted, ref: presenceRef, presenceProps } = usePresence(open);
      const ref = useMergedRefs<HTMLDivElement>(surfaceRef, presenceRef);
      useFocusBeforeClose({
        open,
        surfaceRef,
        captureOpener: () => triggerRef.current,
        candidates: (opener) => [opener],
      });
      if (!isMounted) return null;
      return (
        <Portal>
          <div ref={ref} data-testid="popup" {...presenceProps}>
            {children}
          </div>
        </Portal>
      );
    }

    function RenameFlow() {
      const [open, setOpen] = React.useState(false);
      const [renaming, setRenaming] = React.useState(false);
      const triggerRef = React.useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Actions
          </button>
          <Popup open={open} triggerRef={triggerRef}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setRenaming(true);
              }}
            >
              Rename
            </button>
          </Popup>
          {/* Rendered after the popup: it records its opener after the popup's closing cleanup. */}
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

    render(<RenameFlow />);
    await user.click(button('Actions'));
    await act(async () => {
      await motion.finishAll();
    });
    await user.click(button('Rename'));
    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('data-presence', 'exiting');
    expect(popup.closest('[inert]')).toBe(popup);
    await act(async () => {
      await motion.finishAll();
    });
    expect(screen.queryByTestId('popup')).toBeNull();

    await user.click(button('Cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
  });

  it('under StrictMode, a surface open at mount with focus inside: nothing moves at mount, one close moves focus once (Review Focus 2)', () => {
    const focused = recordFocus();
    const candidates = () => [button('Outside')];
    const { rerender } = render(
      <React.StrictMode>
        <Page open autoFocus candidates={candidates} />
      </React.StrictMode>,
    );
    // StrictMode ran the layout effects' cleanups and the effects again (a simulated unmount and
    // remount, no close): focus stays inside.
    expect(button('Inside')).toHaveFocus();
    expect(focused.filter((el) => el === button('Outside'))).toHaveLength(0);

    act(() =>
      rerender(
        <React.StrictMode>
          <Page open={false} autoFocus candidates={candidates} />
        </React.StrictMode>,
      ),
    );
    expect(button('Outside')).toHaveFocus();
    expect(focused.filter((el) => el === button('Outside'))).toHaveLength(1);
  });
});
