import * as React from 'react';
import { afterEach, beforeEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Popover,
  type PopoverAppearance,
  type PopoverOpenChangeDetails,
  type PopoverProps,
  type PopoverSize,
} from '../Popover';
import { Dialog } from '../Dialog';
import { popoverContentClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/*
 * Backlog 1.1, Popover: `onOpenChange` details (popover-6), `withArrow` (popoversurface-2),
 * `appearance` and `size` (popoversurface-1), the content's `role` (popoversurface-4), `trapFocus`
 * (popover-4), `inline` and `closeOnScroll` (popover-5).
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
});

function Basic(props: Omit<PopoverProps, 'children'> & { contentProps?: object }) {
  const { contentProps, ...rest } = props;
  return (
    <Popover {...rest}>
      <Popover.Trigger>
        <button type="button">Toggle</button>
      </Popover.Trigger>
      <Popover.Content title="Details" {...contentProps}>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Popover.Content>
    </Popover>
  );
}

const dialog = () => screen.queryByRole('dialog');
const surface = () => document.querySelector<HTMLElement>('.' + popoverContentClassNames.root);
const beak = () => document.querySelector<HTMLElement>('.' + popoverContentClassNames.beak);
const trigger = () => screen.getByRole('button', { name: 'Toggle' });

describe('onOpenChange details (popover-6)', () => {
  it('reports trigger for a click, with the DOM event', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await user.click(trigger());
    await user.click(trigger());
    expect(onOpenChange.mock.calls).toEqual([
      [true, { reason: 'trigger', event: expect.any(Event) }],
      [false, { reason: 'trigger', event: expect.any(Event) }],
    ]);
    const details = onOpenChange.mock.calls[0][1] as PopoverOpenChangeDetails;
    expect(details.event.type).toBe('click');
  });

  it('reports escape with the keyboard event', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Basic defaultOpen onOpenChange={onOpenChange} />);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    const [open, details] = onOpenChange.mock.calls[0] as [boolean, PopoverOpenChangeDetails];
    expect(open).toBe(false);
    expect(details.reason).toBe('escape');
    expect(details.event.type).toBe('keydown');
  });

  it('reports outside-press for a press outside it', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <>
        <Basic defaultOpen onOpenChange={onOpenChange} />
        <button type="button">Outside</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, {
      reason: 'outside-press',
      event: expect.any(Event),
    });
  });

  it('lets a controlled popover refuse one reason and accept another', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <Basic
            open={open}
            onOpenChange={(next, details) => {
              if (details?.reason === 'outside-press') return;
              setOpen(next);
            }}
          />
          <button type="button">Outside</button>
        </>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(dialog()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog()).not.toBeInTheDocument();
  });

  it('calls it once per change under StrictMode', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <Basic onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.click(trigger());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][1]).toMatchObject({ reason: 'escape' });
  });

  it('reports hover for the hover opening and closing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenChange = vi.fn();
    try {
      render(<Basic openOnHover onOpenChange={onOpenChange} />);
      await user.hover(trigger());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onOpenChange).toHaveBeenLastCalledWith(true, {
        reason: 'hover',
        event: expect.any(Event),
      });
      await user.unhover(trigger());
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(onOpenChange).toHaveBeenLastCalledWith(false, {
        reason: 'hover',
        event: expect.any(Event),
      });
      expect(onOpenChange).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports context for a context gesture', async () => {
    const onOpenChange = vi.fn();
    render(
      <Popover openOnContext onOpenChange={onOpenChange}>
        <Popover.Trigger>
          <div data-testid="region">Region</div>
        </Popover.Trigger>
        <Popover.Content aria-label="Row menu">Body</Popover.Content>
      </Popover>,
    );
    fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 40 });
    await act(async () => {});
    expect(onOpenChange).toHaveBeenCalledWith(true, {
      reason: 'context',
      event: expect.any(Event),
    });
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('reports parent-closed when the Dialog it sits in closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Page({ open }: { open: boolean }) {
      return (
        <Dialog open={open} onOpenChange={() => {}}>
          <Dialog.Content title="Profile">
            <Basic defaultOpen onOpenChange={onOpenChange} />
          </Dialog.Content>
        </Dialog>
      );
    }
    const { rerender } = render(<Page open />);
    await act(async () => {});
    onOpenChange.mockClear();
    rerender(<Page open={false} />);
    await act(async () => {});
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, {
      reason: 'parent-closed',
      event: expect.any(Event),
    });
    void user;
  });

  it('types the details as optional, with the documented reasons', () => {
    expectTypeOf<PopoverProps['onOpenChange']>().toEqualTypeOf<
      ((open: boolean, details?: PopoverOpenChangeDetails) => void) | undefined
    >();
    expectTypeOf<PopoverOpenChangeDetails['reason']>().toEqualTypeOf<
      'trigger' | 'hover' | 'context' | 'escape' | 'outside-press' | 'scroll' | 'parent-closed'
    >();
    // A handler written before `details` existed still compiles.
    const handler: PopoverProps['onOpenChange'] = (open: boolean) => void open;
    void handler;
  });
});

describe('withArrow (popoversurface-2)', () => {
  it('draws the beak by default', () => {
    render(<Basic defaultOpen />);
    expect(beak()).not.toBeNull();
    expect(beak()).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws no beak with withArrow={false}, and the beak part renders nothing', () => {
    render(
      <Basic
        defaultOpen
        withArrow={false}
        contentProps={{ slotProps: { beak: { className: 'my-beak' } } }}
      />,
    );
    expect(dialog()).toBeInTheDocument();
    expect(beak()).toBeNull();
    expect(document.querySelector('.my-beak')).toBeNull();
    expect(document.querySelector('[data-wave-popover-arrow]')).toBeNull();
  });

  it('keeps the content positioned without a beak', async () => {
    render(<Basic defaultOpen withArrow={false} />);
    await act(async () => {});
    expect(surface()?.style.position).toBe('fixed');
  });

  it('is typed as a boolean', () => {
    expectTypeOf<PopoverProps['withArrow']>().toEqualTypeOf<boolean | undefined>();
  });
});

describe('appearance and size (popoversurface-1)', () => {
  it('renders the neutral appearance and the medium size by default, as data attributes', () => {
    render(<Basic defaultOpen />);
    expect(surface()).toHaveAttribute('data-appearance', 'neutral');
    expect(surface()).toHaveAttribute('data-size', 'medium');
    expect(surface()).toHaveClass('wave:bg-background', 'wave:border-border', 'wave:p-4');
  });

  it.each([
    ['brand', ['wave:bg-primary', 'wave:text-primary-foreground', 'wave:border-primary']],
    [
      'inverted',
      ['wave:bg-inverted', 'wave:text-inverted-foreground', 'wave:border-inverted-border'],
    ],
  ] as const)('draws the %s appearance', (appearance, classes) => {
    render(<Basic defaultOpen appearance={appearance} />);
    expect(surface()).toHaveAttribute('data-appearance', appearance);
    expect(surface()).toHaveClass(...classes);
    expect(surface()).not.toHaveClass('wave:bg-background');
  });

  it.each([
    ['small', 'wave:p-3'],
    ['medium', 'wave:p-4'],
    ['large', 'wave:p-5'],
  ] as const)('pads the %s size with %s', (size, padding) => {
    render(<Basic defaultOpen size={size} />);
    expect(surface()).toHaveAttribute('data-size', size);
    expect(surface()).toHaveClass(padding);
  });

  it('lets a consumer class replace the appearance and padding classes', () => {
    render(
      <Basic
        defaultOpen
        appearance="brand"
        size="large"
        contentProps={{ className: 'bg-red-500 p-1' }}
      />,
    );
    expect(surface()).toHaveClass('bg-red-500', 'p-1');
    expect(surface()).not.toHaveClass('wave:bg-primary');
    expect(surface()).not.toHaveClass('wave:p-5');
  });

  it('scrolls a viewport-limited content inside its size-specific padding', () => {
    render(<Basic defaultOpen size="large" positioning={{ fitViewport: true }} />);
    const scroller = surface()!.querySelector<HTMLElement>('[class*="wave:max-h-"]');
    expect(scroller).not.toBeNull();
    expect(scroller!.className).toContain('2.5rem');
  });

  it('has no axe violations in every appearance', async () => {
    for (const appearance of ['neutral', 'brand', 'inverted'] as const) {
      const { unmount } = render(<Basic defaultOpen appearance={appearance} />);
      await expectNoA11yViolations(document.body);
      unmount();
    }
  });

  it('is typed with the three appearances and sizes', () => {
    expectTypeOf<PopoverAppearance>().toEqualTypeOf<'neutral' | 'brand' | 'inverted'>();
    expectTypeOf<PopoverSize>().toEqualTypeOf<'small' | 'medium' | 'large'>();
  });
});

describe('the content role (popoversurface-4)', () => {
  it('is a dialog by default and the trigger has aria-haspopup="dialog"', () => {
    render(<Basic defaultOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('takes role="group": no dialog, and the trigger drops aria-haspopup', async () => {
    const user = userEvent.setup();
    render(<Basic contentProps={{ role: 'group' }} />);
    // Known while closed: the content reports its role as it mounts.
    expect(trigger()).not.toHaveAttribute('aria-haspopup');
    await user.click(trigger());
    const group = screen.getByRole('group', { name: 'Details' });
    expect(group).toHaveClass(popoverContentClassNames.root);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', group.id);
    await user.keyboard('{Escape}');
  });

  it('takes role="alertdialog" and keeps aria-haspopup="dialog"', () => {
    render(<Basic defaultOpen contentProps={{ role: 'alertdialog' }} />);
    expect(screen.getByRole('alertdialog', { name: 'Details' })).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('has no axe violations as a group', async () => {
    render(<Basic defaultOpen contentProps={{ role: 'group' }} />);
    await expectNoA11yViolations(document.body);
  });
});

describe('trapFocus (popover-4)', () => {
  it('moves focus into the content when it opens and cycles Tab inside it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Basic trapFocus />
        <button type="button">After</button>
      </>,
    );
    await user.click(trigger());
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    await act(async () => {});
    expect(first).toHaveFocus();
    await user.tab();
    expect(second).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(second).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Before' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'After' })).not.toHaveFocus();
  });

  it('focuses the content itself when nothing in it can take focus', async () => {
    const user = userEvent.setup();
    render(
      <Popover trapFocus>
        <Popover.Trigger>
          <button type="button">Toggle</button>
        </Popover.Trigger>
        <Popover.Content title="Notes">Text only</Popover.Content>
      </Popover>,
    );
    await user.click(trigger());
    await act(async () => {});
    expect(screen.getByRole('dialog', { name: 'Notes' })).toHaveFocus();
    expect(screen.getByRole('dialog')).toHaveAttribute('tabindex', '-1');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Basic trapFocus />);
    await user.click(trigger());
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(dialog()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('does not make the page inert or lock its scroll', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Page button</button>
        <Basic trapFocus />
      </>,
    );
    await user.click(trigger());
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(document.documentElement.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Page button' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('leaves the default behaviour alone without it: focus stays on the trigger', async () => {
    const user = userEvent.setup();
    render(<Basic />);
    await user.click(trigger());
    await act(async () => {});
    expect(trigger()).toHaveFocus();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('tabindex');
    await user.keyboard('{Escape}');
  });

  it('takes no trap while a hover opened it, and traps once a click pins it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    try {
      render(<Basic trapFocus openOnHover />);
      await user.hover(trigger());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(dialog()).toBeInTheDocument();
      expect(trigger()).not.toHaveFocus();
      expect(screen.getByRole('button', { name: 'First' })).not.toHaveFocus();
      await user.click(trigger());
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
      await user.keyboard('{Escape}');
    } finally {
      vi.useRealTimers();
    }
  });

  it('is released when it closes: Tab leaves for the page again', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Basic trapFocus />
        <button type="button">After</button>
      </>,
    );
    await user.click(trigger());
    await user.keyboard('{Escape}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('is typed as a boolean', () => {
    expectTypeOf<PopoverProps['trapFocus']>().toEqualTypeOf<boolean | undefined>();
  });
});

describe('inline (popover-5)', () => {
  it('renders the content in place, without a portal wrapper', async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="host">
        <Basic inline />
      </div>,
    );
    await user.click(trigger());
    const content = screen.getByRole('dialog', { name: 'Details' });
    expect(screen.getByTestId('host').contains(content)).toBe(true);
    expect(content.closest('[data-wave-portal]')).toBeNull();
    // It stacks as an overlay and is positioned against its container.
    expect(content.style.zIndex).toBe('var(--wave-z-overlay, 1000)');
    await act(async () => {});
    expect(content.style.position).toBe('absolute');
    await user.keyboard('{Escape}');
  });

  it('is in the DOM order after the trigger: Tab reaches it with no scripted order', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Basic inline />
        <button type="button">After</button>
      </>,
    );
    await user.click(trigger());
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await user.keyboard('{Escape}');
  });

  it('dismisses on a press outside and on Escape like the portaled one', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Basic inline />
        <button type="button">Outside</button>
      </>,
    );
    await user.click(trigger());
    expect(dialog()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(dialog()).not.toBeInTheDocument();
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(dialog()).not.toBeInTheDocument();
  });

  it('does not render portaled by default', async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="host">
        <Basic />
      </div>,
    );
    await user.click(trigger());
    expect(screen.getByTestId('host').contains(screen.getByRole('dialog'))).toBe(false);
    await user.keyboard('{Escape}');
  });

  it('takes the theme from the tree it sits in', () => {
    renderWithProviders(<Basic defaultOpen inline />, { theme: 'dark' });
    expect(screen.getByRole('dialog').closest('.wave-dark')).not.toBeNull();
  });
});

describe('closeOnScroll (popover-5)', () => {
  it('closes when the page scrolls, reporting scroll', async () => {
    const onOpenChange = vi.fn();
    render(<Basic defaultOpen closeOnScroll onOpenChange={onOpenChange} />);
    await act(async () => {});
    fireEvent.scroll(document);
    expect(dialog()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, {
      reason: 'scroll',
      event: expect.any(Event),
    });
  });

  it('closes when a scroll container scrolls', async () => {
    render(
      <div data-testid="scroller" style={{ overflow: 'auto', height: 40 }}>
        <Basic defaultOpen closeOnScroll />
      </div>,
    );
    await act(async () => {});
    fireEvent.scroll(screen.getByTestId('scroller'));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('stays open for a scroll inside the content', async () => {
    render(
      <Popover defaultOpen closeOnScroll>
        <Popover.Trigger>
          <button type="button">Toggle</button>
        </Popover.Trigger>
        <Popover.Content title="Details">
          <div data-testid="inner-scroll">Long</div>
        </Popover.Content>
      </Popover>,
    );
    await act(async () => {});
    fireEvent.scroll(within(screen.getByRole('dialog')).getByTestId('inner-scroll'));
    expect(dialog()).toBeInTheDocument();
    fireEvent.scroll(screen.getByRole('dialog'));
    expect(dialog()).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('stays open on a scroll without closeOnScroll', async () => {
    render(<Basic defaultOpen />);
    await act(async () => {});
    fireEvent.scroll(document);
    expect(dialog()).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('stops listening when it closes', async () => {
    const add = vi.spyOn(Document.prototype, 'addEventListener');
    const remove = vi.spyOn(Document.prototype, 'removeEventListener');
    try {
      const { unmount } = render(<Basic defaultOpen closeOnScroll />);
      await act(async () => {});
      const added = add.mock.calls.filter(([type]) => type === 'scroll').length;
      expect(added).toBeGreaterThan(0);
      unmount();
      expect(remove.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(added);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it('closes once under StrictMode', async () => {
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <Basic defaultOpen closeOnScroll onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await act(async () => {});
    fireEvent.scroll(document);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });
});

describe('RTL', () => {
  beforeEach(() => {
    document.documentElement.dir = 'rtl';
  });
  afterEach(() => {
    document.documentElement.dir = '';
  });

  it('renders the appearance, size and beak in a right-to-left tree', () => {
    renderWithProviders(<Basic defaultOpen appearance="inverted" size="small" />, { dir: 'rtl' });
    expect(surface()).toHaveAttribute('data-appearance', 'inverted');
    expect(surface()).toHaveAttribute('data-size', 'small');
    expect(beak()).not.toBeNull();
  });
});
