import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from '../Menu';
import { useModalLayer } from '../../../hooks/useModalLayer';
import { getOpenLayers } from '../../../lib/layers';
import { Portal } from '../../portal/Portal';
import { mockAnimations, mockMatchMedia } from '../../../test-utils';

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
  }
});

const item = (name: string) => screen.getByRole('menuitem', { name });
const actions = () => screen.getByRole('button', { name: 'Actions' });
/** The menu surfaces, exiting ones included (an exiting surface is `inert`, not hidden). */
const surface = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/**
 * A stand-in modal (useModalLayer + Portal) around the menu: it closes on Escape, so a second
 * Escape shows whether the menu's layer is gone.
 */
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const attach = React.useCallback((el: HTMLDivElement | null) => {
    surfaceRef.current = el;
    setNode(el);
  }, []);
  // Like Dialog: records its opener when it opens and returns focus there when it closes.
  const { layerId } = useModalLayer({
    open: true,
    onDismiss: onClose,
    refs: [surfaceRef],
    container: node,
  });
  return (
    <Portal layerId={layerId}>
      <div ref={attach} role="dialog" aria-label="Settings" tabIndex={-1}>
        {children}
      </div>
    </Portal>
  );
}

function ActionsMenu({ motion = true, submenu = false }: { motion?: boolean; submenu?: boolean }) {
  return (
    <Menu>
      <Menu.Trigger>
        <button type="button">Actions</button>
      </Menu.Trigger>
      <Menu.Popover data-testid="root" data-test-motion={motion ? '' : undefined}>
        <Menu.Item>Edit</Menu.Item>
        {submenu && (
          <Menu>
            <Menu.Trigger>
              <Menu.Item>Share</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover data-testid="sub">
              <Menu.Item>Email</Menu.Item>
            </Menu.Popover>
          </Menu>
        )}
        <Menu.Item>Delete</Menu.Item>
      </Menu.Popover>
    </Menu>
  );
}

describe('Menu.Popover on the presence core', () => {
  it('an open surface is entered and open', async () => {
    const user = userEvent.setup();
    render(<ActionsMenu motion={false} />);
    await user.click(actions());
    const root = surface('root')!;
    expect(root).toHaveAttribute('data-presence', 'entered');
    expect(root).toHaveAttribute('data-state', 'open');
    expect(root).not.toHaveAttribute('inert');
  });

  it('without motion it unmounts in the same act() as the close', async () => {
    const user = userEvent.setup();
    render(<ActionsMenu motion={false} />);
    await user.click(actions());
    act(() => {
      item('Edit').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(surface('root')).toBeNull();
    expect(actions()).toHaveFocus();
  });

  it('an item that closes a controlled menu and opens a modal in one update: the modal returns focus to the trigger', async () => {
    const user = userEvent.setup();
    function RenameFlow() {
      const [open, setOpen] = React.useState(false);
      const [renaming, setRenaming] = React.useState(false);
      return (
        <>
          <Menu open={open} onOpenChange={setOpen}>
            <Menu.Trigger>
              <button type="button">Actions</button>
            </Menu.Trigger>
            <Menu.Popover data-testid="root">
              {/* persistOnClick: the item does not move focus to the trigger itself. */}
              <Menu.Item
                persistOnClick
                onClick={() => {
                  setOpen(false);
                  setRenaming(true);
                }}
              >
                Rename
              </Menu.Item>
            </Menu.Popover>
          </Menu>
          {renaming && (
            <Modal onClose={() => setRenaming(false)}>
              <button type="button">Cancel</button>
            </Modal>
          )}
        </>
      );
    }
    render(<RenameFlow />);
    await user.click(actions());
    await user.click(item('Rename'));
    expect(surface('root')).toBeNull();
    act(() => screen.getByRole('button', { name: 'Cancel' }).focus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(actions()).toHaveFocus();
  });

  describe('with an exit motion', () => {
    it('stays mounted, inert and closed while it exits; the layer and focus are already released', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      const onModalClose = vi.fn();
      render(
        <Modal onClose={onModalClose}>
          <ActionsMenu />
        </Modal>,
      );
      await user.click(actions());
      const root = surface('root')!;
      await act(async () => {
        await motion.finishAll();
      });
      expect(root).toHaveAttribute('data-presence', 'entered');

      await user.keyboard('{Escape}');
      expect(surface('root')).toBe(root);
      expect(root).toHaveAttribute('data-state', 'closed');
      expect(root).toHaveAttribute('data-presence', 'exiting');
      expect(root).toHaveAttribute('inert');
      expect(actions()).toHaveFocus();
      expect(actions()).toHaveAttribute('aria-expanded', 'false');
      expect(actions()).not.toHaveAttribute('aria-controls');
      // Only the modal's layer is left: the next Escape closes it.
      expect(getOpenLayers()).toHaveLength(1);
      await user.keyboard('{Escape}');
      expect(onModalClose).toHaveBeenCalledTimes(1);

      await act(async () => {
        await motion.finishAll();
      });
      expect(surface('root')).toBeNull();
    });

    it('a click on the trigger during the exit reopens the same surface and focuses its first item', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      render(<ActionsMenu />);
      await user.click(actions());
      await act(async () => {
        await motion.finishAll();
      });
      const root = surface('root')!;
      await user.keyboard('{Escape}');
      expect(root).toHaveAttribute('data-presence', 'exiting');

      await user.click(actions());
      expect(surface('root')).toBe(root);
      expect(root).toHaveAttribute('data-presence', 'entering');
      expect(root).toHaveAttribute('data-state', 'open');
      expect(root).not.toHaveAttribute('inert');
      expect(item('Edit')).toHaveFocus();
      await act(async () => {
        await motion.finishAll();
      });
      expect(root).toHaveAttribute('data-presence', 'entered');
    });

    it('Escape closes the submenu, then the root; while the root exits only the modal’s layer is left', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      const onModalClose = vi.fn();
      render(
        <Modal onClose={onModalClose}>
          <ActionsMenu submenu />
        </Modal>,
      );
      await user.click(actions());
      await user.click(item('Share'));
      expect(surface('sub')).not.toBeNull();
      expect(getOpenLayers()).toHaveLength(3);

      // Escape in the submenu closes it; Escape again, in the root list, closes the root.
      await user.keyboard('{Escape}');
      expect(surface('sub')).toBeNull();
      await user.keyboard('{Escape}');
      expect(surface('root')).toHaveAttribute('data-presence', 'exiting');
      expect(getOpenLayers()).toHaveLength(1);
      await user.keyboard('{Escape}');
      expect(onModalClose).toHaveBeenCalledTimes(1);
      await act(async () => {
        await motion.finishAll();
      });
    });

    it('the root’s exit takes an open submenu’s surface and layer away at once (Tab in the submenu)', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      const onModalClose = vi.fn();
      render(
        <Modal onClose={onModalClose}>
          <ActionsMenu submenu />
        </Modal>,
      );
      await user.click(actions());
      await user.click(item('Share'));
      expect(item('Email')).toHaveFocus();
      await user.keyboard('{Tab}');
      expect(surface('root')).toHaveAttribute('data-presence', 'exiting');
      expect(surface('sub')).toBeNull();
      expect(getOpenLayers()).toHaveLength(1);
      await user.keyboard('{Escape}');
      expect(onModalClose).toHaveBeenCalledTimes(1);
      await act(async () => {
        await motion.finishAll();
      });
    });

    it('a controlled root closed by its prop while it exits takes an open controlled submenu’s surface and layer away in the same commit', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      const onShareOpenChange = vi.fn();
      function Controlled({ open }: { open: boolean }) {
        // The submenu's open state is the app's: closing the root by its prop reports nothing to it.
        const [shareOpen, setShareOpen] = React.useState(false);
        return (
          <Menu open={open} onOpenChange={() => {}}>
            <Menu.Trigger>
              <button type="button">Actions</button>
            </Menu.Trigger>
            <Menu.Popover data-testid="root" data-test-motion="">
              <Menu.Item>Edit</Menu.Item>
              <Menu
                open={shareOpen}
                onOpenChange={(next) => {
                  onShareOpenChange(next);
                  setShareOpen(next);
                }}
              >
                <Menu.Trigger>
                  <Menu.Item>Share</Menu.Item>
                </Menu.Trigger>
                <Menu.Popover data-testid="sub">
                  <Menu.Item>Email</Menu.Item>
                </Menu.Popover>
              </Menu>
            </Menu.Popover>
          </Menu>
        );
      }
      const { rerender } = render(<Controlled open />);
      await act(async () => {
        await motion.finishAll();
      });
      await user.click(item('Share'));
      expect(item('Email')).toHaveFocus();
      expect(getOpenLayers()).toHaveLength(2);

      rerender(<Controlled open={false} />);
      const root = surface('root')!;
      expect(root).toHaveAttribute('data-presence', 'exiting');
      expect(root).toHaveAttribute('inert');
      // The submenu is closed on screen although its own (the app's) state is still open: the
      // parent's inert exiting surface does not reach it, since it is a portal of its own.
      expect(surface('sub')).toBeNull();
      expect(getOpenLayers()).toHaveLength(0);
      expect(item('Share')).toHaveAttribute('aria-expanded', 'false');
      expect(item('Share')).not.toHaveAttribute('aria-controls');
      expect(actions()).toHaveFocus();
      expect(onShareOpenChange.mock.calls).toEqual([[true]]);

      await act(async () => {
        await motion.finishAll();
      });
      expect(surface('root')).toBeNull();
    });

    it('unmounts at once under reduced motion', async () => {
      mockAnimations();
      mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      const user = userEvent.setup();
      render(<ActionsMenu />);
      await user.click(actions());
      await user.keyboard('{Escape}');
      expect(surface('root')).toBeNull();
    });
  });
});
