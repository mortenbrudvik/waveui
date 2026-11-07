import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogFooter, DialogTitle, type DialogTitleElement } from '../Dialog';
import { Drawer } from '../Drawer';
import { Popover } from '../Popover';
import {
  dialogContentClassNames,
  dialogFooterClassNames,
  dialogTitleClassNames,
} from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { WaveProvider } from '../../provider/WaveProvider';
import { expectNoA11yViolations } from '../../../test-utils';

/*
 * Backlog 1.1, overlays: Dialog's `mountNode`, the title's element (`Dialog.Title` `as`, `titleAs`),
 * the footer's `position`, `startActions`, `fluid` and `stackOnNarrow`, the opt-in `lightDismiss` of
 * a non-modal Dialog and Drawer, and the popups opened inside a surface closing with it.
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  expect(document.documentElement.style.overflow).toBe('');
});

describe('Dialog.Content mountNode (dialog-6)', () => {
  it('renders the surface and the backdrop into the mount node instead of document.body', () => {
    const host = document.createElement('div');
    host.setAttribute('data-testid', 'host');
    document.body.appendChild(host);
    try {
      render(
        <Dialog defaultOpen>
          <Dialog.Content title="Profile" mountNode={host}>
            Body
          </Dialog.Content>
        </Dialog>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Profile' });
      expect(host.contains(dialog)).toBe(true);
      expect(host.querySelector('.' + dialogContentClassNames.backdrop)).not.toBeNull();
      // The portal wrapper still carries the provider's theme and is a child of the node.
      expect(dialog.closest('[data-wave-portal]')?.parentElement).toBe(host);
    } finally {
      cleanup();
      host.remove();
    }
  });

  it('uses the default container for null and undefined', () => {
    const { rerender } = render(
      <Dialog defaultOpen>
        <Dialog.Content title="Profile" mountNode={null}>
          Body
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('dialog').closest('[data-wave-portal]')?.parentElement).toBe(
      document.body,
    );
    rerender(
      <Dialog defaultOpen>
        <Dialog.Content title="Profile" mountNode={undefined}>
          Body
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('dialog').closest('[data-wave-portal]')?.parentElement).toBe(
      document.body,
    );
  });

  it('makes the rest of the page inert, a mount node inside the page included', () => {
    function Page() {
      const [node, setNode] = React.useState<HTMLElement | null>(null);
      return (
        <div>
          <button type="button">Page button</button>
          <section ref={setNode} data-testid="slot" />
          <Dialog defaultOpen>
            <Dialog.Content title="Profile" mountNode={node}>
              <button type="button">Inside</button>
            </Dialog.Content>
          </Dialog>
        </div>
      );
    }
    render(<Page />);
    const dialog = screen.getByRole('dialog', { name: 'Profile' });
    expect(screen.getByTestId('slot').contains(dialog)).toBe(true);
    expect(dialog.closest('[inert]')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Page button', hidden: true }).closest('[inert]'),
    ).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Inside' })).toBeInTheDocument();
  });

  it('is typed as an element, null or undefined', () => {
    expectTypeOf<React.ComponentProps<typeof Dialog.Content>['mountNode']>().toEqualTypeOf<
      HTMLElement | null | undefined
    >();
  });
});

describe('the title element (dialogtitle-1)', () => {
  it('renders Dialog.Title as an h2 by default and as the element of `as`', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content aria-label={undefined}>
          <Dialog.Title as="h3">Rich title</Dialog.Title>
          Body
        </Dialog.Content>
      </Dialog>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: 'Rich title' });
    expect(heading.tagName).toBe('H3');
    expect(heading).toHaveClass(dialogTitleClassNames.root);
    expect(screen.getByRole('dialog', { name: 'Rich title' })).toBeInTheDocument();
  });

  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span'] as const)(
    'renders Dialog.Title as %s and still names the dialog',
    (as) => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title as={as}>Order</Dialog.Title>
            Body
          </Dialog.Content>
        </Dialog>,
      );
      const title = screen.getByText('Order');
      expect(title.tagName).toBe(as.toUpperCase());
      expect(screen.getByRole('dialog', { name: 'Order' })).toBeInTheDocument();
    },
  );

  it('renders the `title` prop heading as the element of `titleAs`', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Profile" titleAs="h4">
          Body
        </Dialog.Content>
      </Dialog>,
    );
    const heading = screen.getByRole('heading', { level: 4, name: 'Profile' });
    expect(heading).toHaveClass(dialogTitleClassNames.root);
    expect(screen.getByRole('dialog', { name: 'Profile' })).toBeInTheDocument();
  });

  it('keeps the h2 without `titleAs`', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Profile">Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });

  it('keeps the action in the title-actions area next to a changed element', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title as="h1" action={<button type="button">Expand</button>}>
            Order
          </Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
  });

  it('types the element as a heading, div or span', () => {
    expectTypeOf<DialogTitleElement>().toEqualTypeOf<
      'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'span'
    >();
    expectTypeOf(DialogTitle).parameter(0).toHaveProperty('as');
    // @ts-expect-error -- not a title element
    void (<Dialog.Title as="p">x</Dialog.Title>);
  });
});

describe('Dialog.Footer layout (dialogactions-1, dialogactions-2)', () => {
  const footer = () => document.querySelector<HTMLElement>('.' + dialogFooterClassNames.root)!;

  function renderFooter(props: React.ComponentProps<typeof DialogFooter>) {
    return render(
      <Dialog defaultOpen>
        <Dialog.Content title="Order">
          Body
          <Dialog.Footer {...props} />
        </Dialog.Content>
      </Dialog>,
    );
  }

  it('renders the default footer as before: end position, no flags, no group', () => {
    renderFooter({ children: <button type="button">Save</button> });
    expect(footer()).toHaveAttribute('data-position', 'end');
    expect(footer()).not.toHaveAttribute('data-fluid');
    expect(footer()).not.toHaveAttribute('data-stack-on-narrow');
    expect(footer()).toHaveClass('wave:justify-end');
    expect(footer()).not.toHaveClass('wave:justify-start');
    expect(footer().querySelector('.' + dialogFooterClassNames.startActions)).toBeNull();
    expect(footer().children).toHaveLength(1);
  });

  it('moves the actions to the start with position="start"', () => {
    renderFooter({ position: 'start', children: <button type="button">Save</button> });
    expect(footer()).toHaveAttribute('data-position', 'start');
    expect(footer()).toHaveClass('wave:justify-start');
    expect(footer()).not.toHaveClass('wave:justify-end');
  });

  it('renders startActions before the children, in a group that keeps the start', () => {
    renderFooter({
      startActions: <button type="button">Reset</button>,
      children: (
        <>
          <button type="button">Cancel</button>
          <button type="button">Save</button>
        </>
      ),
    });
    const group = footer().querySelector<HTMLElement>('.' + dialogFooterClassNames.startActions)!;
    expect(group).not.toBeNull();
    expect(group.tagName).toBe('DIV');
    expect(group).toHaveClass('wave:me-auto');
    expect(within(group).getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    // DOM order, which is also the Tab order: the group first.
    const names = within(footer())
      .getAllByRole('button')
      .map((el) => el.textContent);
    expect(names).toEqual(['Reset', 'Cancel', 'Save']);
  });

  it('takes a slot object for startActions: its props go to the group', () => {
    renderFooter({
      startActions: { className: 'my-group', 'data-extra': 'yes', children: 'Notes' } as never,
      children: <button type="button">Save</button>,
    });
    const group = footer().querySelector<HTMLElement>('.' + dialogFooterClassNames.startActions)!;
    expect(group).toHaveClass('my-group');
    expect(group).toHaveAttribute('data-extra', 'yes');
    expect(group).toHaveTextContent('Notes');
  });

  it.each([null, undefined, false, '', []] as const)(
    'renders no group for startActions %j that renders nothing',
    (value) => {
      renderFooter({
        startActions: value as never,
        children: <button type="button">Save</button>,
      });
      expect(footer().querySelector('.' + dialogFooterClassNames.startActions)).toBeNull();
    },
  );

  it('shares the width with fluid and marks it', () => {
    renderFooter({ fluid: true, children: <button type="button">Save</button> });
    expect(footer()).toHaveAttribute('data-fluid', '');
    expect(footer()).toHaveClass('wave:*:flex-1');
  });

  it('stacks on a narrow viewport with stackOnNarrow and marks it', () => {
    renderFooter({ stackOnNarrow: true, children: <button type="button">Save</button> });
    expect(footer()).toHaveAttribute('data-stack-on-narrow', '');
    expect(footer()).toHaveClass('wave:[@media(width<=480px)]:flex-col');
    expect(footer()).toHaveClass('wave:[@media(width<=480px)]:*:w-full');
  });

  it('keeps a consumer className last and replaces a conflicting justify', () => {
    renderFooter({ className: 'justify-center', children: <button type="button">Save</button> });
    expect(footer()).toHaveClass('justify-center');
    expect(footer()).not.toHaveClass('wave:justify-end');
  });

  it('has no axe violations with every option', async () => {
    renderFooter({
      position: 'start',
      fluid: true,
      stackOnNarrow: true,
      startActions: <button type="button">Reset</button>,
      children: <button type="button">Save</button>,
    });
    await expectNoA11yViolations(document.body);
  });
});

describe('lightDismiss on a non-modal Dialog', () => {
  function Page({
    lightDismiss,
    onOpenChange,
  }: {
    lightDismiss?: boolean;
    onOpenChange?: (open: boolean, details: { reason: string }) => void;
  }) {
    return (
      <>
        <button type="button">Before</button>
        <Dialog modalType="non-modal" lightDismiss={lightDismiss} onOpenChange={onOpenChange}>
          <Dialog.Trigger>
            <button type="button">Details</button>
          </Dialog.Trigger>
          <Dialog.Content title="Order details">
            <button type="button">Edit</button>
          </Dialog.Content>
        </Dialog>
        <input aria-label="Page field" />
        <p>Page text</p>
      </>
    );
  }

  it('closes on a press on the page, reporting outside-press', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Page lightDismiss onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('dialog', { name: 'Order details' })).toBeInTheDocument();
    onOpenChange.mockClear();
    // Text takes no focus: the press alone dismisses.
    await user.click(screen.getByText('Page text'));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, {
      reason: 'outside-press',
      event: expect.any(Event),
    });
  });

  it('closes when focus leaves the dialog, reporting focus-outside', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Page lightDismiss onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'Details' }));
    onOpenChange.mockClear();
    act(() => screen.getByRole('textbox', { name: 'Page field' }).focus());
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, {
      reason: 'focus-outside',
      event: expect.any(Event),
    });
  });

  it('keeps the dialog open for a press inside it, and the trigger toggles it closed', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Page lightDismiss onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'Details' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await act(async () => {});
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    onOpenChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'Details' }));
    await act(async () => {});
    // One request, from the trigger: the press on the opener is no outside press.
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, {
      reason: 'trigger',
      event: expect.any(Event),
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes once in StrictMode', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <Page lightDismiss onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Details' }));
    onOpenChange.mockClear();
    await user.click(screen.getByRole('textbox', { name: 'Page field' }));
    await act(async () => {});
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('does nothing without lightDismiss: presses and focus on the page leave it open', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Details' }));
    await user.click(screen.getByRole('textbox', { name: 'Page field' }));
    await act(async () => {});
    expect(screen.getByRole('dialog', { name: 'Order details' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('is ignored by a modal dialog: a focus move does not close it', async () => {
    const user = userEvent.setup();
    render(
      <Dialog lightDismiss defaultOpen>
        <Dialog.Content title="Order">
          <button type="button">Edit</button>
        </Dialog.Content>
      </Dialog>,
    );
    await act(async () => {});
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('is typed as a boolean on Dialog and Drawer', () => {
    expectTypeOf<React.ComponentProps<typeof Dialog>['lightDismiss']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<React.ComponentProps<typeof Drawer>['lightDismiss']>().toEqualTypeOf<
      boolean | undefined
    >();
  });
});

describe('lightDismiss on a non-modal Drawer', () => {
  function Page({ lightDismiss }: { lightDismiss?: boolean }) {
    const [reasons, setReasons] = React.useState<string[]>([]);
    return (
      <>
        <Drawer
          modalType="non-modal"
          lightDismiss={lightDismiss}
          title="Filters"
          onOpenChange={(_, details) => setReasons((all) => [...all, details.reason])}
        >
          <Drawer.Trigger>
            <button type="button">Filters</button>
          </Drawer.Trigger>
          <button type="button">Apply</button>
        </Drawer>
        <input aria-label="Page field" />
        <p>Page text</p>
        <output aria-label="reasons">{reasons.join(',')}</output>
      </>
    );
  }

  it('closes on a press on the page, reporting outside-press', async () => {
    const user = userEvent.setup();
    render(<Page lightDismiss />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    await user.click(screen.getByText('Page text'));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('reasons')).toHaveTextContent('trigger,outside-press');
  });

  it('stays open for the page without lightDismiss', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('textbox', { name: 'Page field' }));
    await act(async () => {});
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('textbox', { name: 'Page field' }));
  });
});

describe('popups opened inside a closing surface close with it', () => {
  function Inside({ open }: { open: boolean }) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <Dialog.Content title="Profile">
          <Popover>
            <Popover.Trigger>
              <button type="button">Help</button>
            </Popover.Trigger>
            <Popover.Content>Help text</Popover.Content>
          </Popover>
        </Dialog.Content>
      </Dialog>
    );
  }

  it('closes a popover opened inside the dialog when the dialog closes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Inside open />);
    await user.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByText('Help text')).toBeInTheDocument();
    rerender(<Inside open={false} />);
    await act(async () => {});
    expect(screen.queryByText('Help text')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes a nested dialog with its parent, reporting parent-closed', async () => {
    const user = userEvent.setup();
    const onInnerChange = vi.fn();
    function Nested({ open }: { open: boolean }) {
      const [inner, setInner] = React.useState(false);
      return (
        <Dialog open={open} onOpenChange={() => {}}>
          <Dialog.Content title="Outer">
            <Dialog
              open={inner}
              onOpenChange={(next, details) => {
                onInnerChange(next, details);
                setInner(next);
              }}
            >
              <Dialog.Trigger>
                <button type="button">More</button>
              </Dialog.Trigger>
              <Dialog.Content title="Inner">Inner body</Dialog.Content>
            </Dialog>
          </Dialog.Content>
        </Dialog>
      );
    }
    const { rerender } = render(<Nested open />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('dialog', { name: 'Inner' })).toBeInTheDocument();
    onInnerChange.mockClear();
    rerender(<Nested open={false} />);
    await act(async () => {});
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
    expect(onInnerChange).toHaveBeenCalledTimes(1);
    expect(onInnerChange).toHaveBeenCalledWith(false, {
      reason: 'parent-closed',
      event: expect.any(Event),
    });
  });

  it('closes a popover opened inside a drawer when the drawer closes', async () => {
    const user = userEvent.setup();
    function DrawerInside({ open }: { open: boolean }) {
      return (
        <Drawer open={open} onOpenChange={() => {}} title="Filters">
          <Popover>
            <Popover.Trigger>
              <button type="button">Help</button>
            </Popover.Trigger>
            <Popover.Content>Help text</Popover.Content>
          </Popover>
        </Drawer>
      );
    }
    const { rerender } = render(<DrawerInside open />);
    await user.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByText('Help text')).toBeInTheDocument();
    rerender(<DrawerInside open={false} />);
    await act(async () => {});
    expect(screen.queryByText('Help text')).not.toBeInTheDocument();
  });

  it('does not report an unmount as a parent close', async () => {
    const user = userEvent.setup();
    const onPopoverChange = vi.fn();
    function Harness({ show }: { show: boolean }) {
      return show ? (
        <Dialog defaultOpen>
          <Dialog.Content title="Profile">
            <Popover defaultOpen onOpenChange={onPopoverChange}>
              <Popover.Trigger>
                <button type="button">Help</button>
              </Popover.Trigger>
              <Popover.Content>Help text</Popover.Content>
            </Popover>
          </Dialog.Content>
        </Dialog>
      ) : null;
    }
    const { rerender } = render(<Harness show />);
    await user.keyboard('{Tab}');
    rerender(<Harness show={false} />);
    await act(async () => {});
    expect(onPopoverChange).not.toHaveBeenCalled();
  });

  it('is part of a themed tree too', () => {
    render(
      <WaveProvider theme="dark">
        <Inside open />
      </WaveProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Profile' })).toBeInTheDocument();
    cleanup();
  });
});

describe('backdropMotion={null} on a non-modal Dialog', () => {
  it('logs no backdrop-ignored warning for null', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <Dialog modalType="non-modal" defaultOpen>
          <Dialog.Content title="Order" backdropMotion={null}>
            Body
          </Dialog.Content>
        </Dialog>,
      );
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('still warns once for a backdropMotion value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <Dialog modalType="non-modal" defaultOpen>
          <Dialog.Content title="Order" backdropMotion="my-motion">
            Body
          </Dialog.Content>
        </Dialog>,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('Dialog.Content: `backdrop` and `backdropMotion`');
    } finally {
      warn.mockRestore();
    }
  });
});
