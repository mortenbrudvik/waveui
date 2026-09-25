import * as React from 'react';
import { afterEach, beforeEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  type PopoverContentProps,
  type PopoverProps,
  type PopoverTriggerChildProps,
} from '../Popover';
import { Dialog } from '../Dialog';
import { Tooltip } from '../Tooltip';
import { Button } from '../../button/Button';
import { Portal } from '../../portal/Portal';
import { useDismiss } from '../../../hooks/useDismiss';
import type { PopupTarget } from '../../../lib/types';
import {
  createOverlayTestWrapper,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  mockRect,
  renderWithProviders,
  testCompoundExposure,
  testDisplayName,
  testSystemProps,
  expectThrows,
} from '../../../test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const html = document.documentElement;

/**
 * Gives elements a layout box by `data-testid` (jsdom has no layout) and a 1024×768 viewport, so
 * floating-ui computes real placements. Restored by `vi.restoreAllMocks()` in `afterEach`.
 */
function mockLayout(boxes: Record<string, Box>) {
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

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(html, 'clientWidth');
  Reflect.deleteProperty(html, 'clientHeight');
});

function Basic(props: Omit<React.ComponentProps<typeof Popover>, 'children'>) {
  return (
    <Popover {...props}>
      <Popover.Trigger>
        <button type="button">Toggle</button>
      </Popover.Trigger>
      <Popover.Content>Popover body</Popover.Content>
    </Popover>
  );
}

/** A raw F4 child layer (Portal + useDismiss), the §5.9 stand-in for a Dialog opened inside. */
function ChildLayer({ label }: { label: string }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({
    open,
    onDismiss: () => setOpen(false),
    refs: [surfaceRef, triggerRef],
    anchorRef: triggerRef,
  });
  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen((o) => !o)}>
        {`Open ${label}`}
      </button>
      {open && (
        <Portal layerId={layerId}>
          <div ref={surfaceRef} role="dialog" aria-label={label}>
            <button type="button">{`${label} action`}</button>
          </div>
        </Portal>
      )}
    </>
  );
}

const dialog = () => screen.queryByRole('dialog');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Popover', () => {
  testDisplayName(Popover, 'Popover');

  testCompoundExposure(Popover, ['Trigger', 'Content']);

  it('exports flat sub-component names for Server Components (repo-level#2)', () => {
    expect(PopoverTrigger).toBe(Popover.Trigger);
    expect(PopoverContent).toBe(Popover.Content);
  });

  describe('Popover.Content system props', () => {
    testSystemProps(Popover.Content, {
      expectedTag: 'div',
      displayName: 'PopoverContent',
      wrapper: createOverlayTestWrapper(Popover, { open: true }),
      defaultProps: { 'aria-label': 'Details', children: 'Popover body' },
      conflictingClass: { className: 'w-96', overrides: 'w-64' },
    });
  });

  it('does not show content by default', () => {
    render(<Basic />);
    expect(dialog()).not.toBeInTheDocument();
  });

  it('opens when the trigger is clicked and renders the content in a portal', async () => {
    const user = userEvent.setup();
    const { container } = render(<Basic />);
    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    const surface = screen.getByRole('dialog');
    expect(surface).toHaveTextContent('Popover body');
    expect(container.contains(surface)).toBe(false);
    expect(surface.closest('[data-wave-portal]')).toHaveAttribute('data-layer', 'overlay');
  });

  it('is not clipped by an overflow-hidden ancestor (overlays#36)', async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="clip" style={{ overflow: 'hidden', height: 20 }}>
        <Basic />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByTestId('clip').contains(screen.getByRole('dialog'))).toBe(false);
  });

  it('toggles on repeated clicks', async () => {
    const user = userEvent.setup();
    render(<Basic />);
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    await user.click(trigger);
    expect(dialog()).toBeInTheDocument();
    await user.click(trigger);
    expect(dialog()).not.toBeInTheDocument();
  });

  it('renders with defaultOpen', () => {
    render(<Basic defaultOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('is controlled via open prop', () => {
    const { rerender } = render(<Basic open={false} />);
    expect(dialog()).not.toBeInTheDocument();
    rerender(<Basic open />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on click outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Basic defaultOpen />
        <button type="button">Outside</button>
      </div>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('stays open when the press starts inside and ends outside (drag-out)', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Basic defaultOpen />
        <button type="button">Outside</button>
      </div>,
    );
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('dialog') });
    await user.pointer({
      keys: '[/MouseLeft]',
      target: screen.getByRole('button', { name: 'Outside' }),
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Basic defaultOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog()).not.toBeInTheDocument();
  });

  it('calls onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  describe('trigger (overlays#5)', () => {
    it('puts aria-haspopup, aria-expanded and aria-controls on the child button', async () => {
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger data-testid="trigger">
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      expect(screen.getByTestId('trigger')).toBe(trigger);
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', screen.getByRole('dialog').id);
    });

    it('renders no wrapper span by default', () => {
      const { container } = render(<Basic />);
      expect(container.firstElementChild).toBe(screen.getByRole('button', { name: 'Toggle' }));
    });

    it('asChild={false} renders the 0.4 wrapper span; the button inside carries the state ARIA', async () => {
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger asChild={false} data-testid="wrapper">
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      const wrapper = screen.getByTestId('wrapper');
      const toggle = screen.getByRole('button', { name: 'Toggle' });
      expect(wrapper.tagName).toBe('SPAN');
      // A generic span cannot carry state ARIA (axe aria-allowed-attr): the button inside does.
      const stateAria = ['aria-haspopup', 'aria-expanded', 'aria-controls'];
      for (const attr of stateAria) expect(wrapper).not.toHaveAttribute(attr);
      expect(toggle).toHaveAttribute('aria-haspopup', 'dialog');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).not.toHaveAttribute('aria-controls');
      await expectNoA11yViolations();

      await user.click(toggle);
      const popover = screen.getByRole('dialog', { name: 'Toggle' });
      for (const attr of stateAria) expect(wrapper).not.toHaveAttribute(attr);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveAttribute('aria-controls', popover.id);
      await expectNoA11yViolations();

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).not.toHaveAttribute('aria-controls');
    });

    it('a render-prop child keeps the state ARIA with asChild={false}', () => {
      render(
        <Popover>
          <Popover.Trigger asChild={false}>
            {(props) => (
              <button type="button" {...props}>
                Render prop
              </button>
            )}
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByRole('button', { name: 'Render prop' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('a non-forwarding custom child still opens the popover (wrapper fallback + warning)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const Fancy = ({ children }: { children: React.ReactNode }) => (
        <button type="button">{children}</button>
      );
      render(
        <Popover>
          <Popover.Trigger>
            <Fancy>Fancy</Fancy>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      await user.click(screen.getByRole('button', { name: 'Fancy' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(warn.mock.calls).toEqual([[expect.stringMatching(/^\[WaveUI\] Popover\.Trigger: /)]]);
    });

    it('a render-prop child receives onKeyDown, declared like onClick and ref', async () => {
      // Tab from the open trigger into the portaled content goes through it.
      expectTypeOf<PopoverTriggerChildProps['onKeyDown']>().toEqualTypeOf<
        React.KeyboardEventHandler<HTMLElement>
      >();
      const user = userEvent.setup();
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            {({ id, ref, onClick, onKeyDown, ...stateAria }) => (
              <button
                type="button"
                id={id}
                ref={ref}
                onClick={onClick}
                onKeyDown={onKeyDown}
                aria-haspopup={stateAria['aria-haspopup']}
                aria-expanded={stateAria['aria-expanded']}
                aria-controls={stateAria['aria-controls']}
              >
                Render prop
              </button>
            )}
          </Popover.Trigger>
          <Popover.Content aria-label="Options">
            <button type="button">First</button>
          </Popover.Content>
        </Popover>,
      );
      screen.getByRole('button', { name: 'Render prop' }).focus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    });

    it('supports a render-prop child', async () => {
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger>
            {(props) => (
              <button type="button" {...props}>
                Render prop
              </button>
            )}
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByRole('button', { name: 'Render prop' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      await user.click(trigger);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('live state ARIA wins over the child’s own static values', () => {
      render(
        <Popover>
          <Popover.Trigger>
            <button type="button" aria-expanded="true" aria-controls="stale" aria-haspopup="menu">
              Toggle
            </button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('keeps the child’s onClick and className and composes the Trigger’s own (layout#10)', async () => {
      const user = userEvent.setup();
      const childClick = vi.fn();
      const triggerClick = vi.fn();
      render(
        <Popover>
          <Popover.Trigger className="trigger-class" onClick={triggerClick}>
            <button type="button" className="child-class" onClick={childClick}>
              Toggle
            </button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      expect(trigger).toHaveClass('child-class', 'trigger-class');
      await user.click(trigger);
      expect(childClick).toHaveBeenCalledTimes(1);
      expect(triggerClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('a child onClick that calls preventDefault() suppresses the toggle', async () => {
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger>
            <button type="button" onClick={(e) => e.preventDefault()}>
              Toggle
            </button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      expect(dialog()).not.toBeInTheDocument();
    });

    it('forwards the Trigger ref to the child element', () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Popover>
          <Popover.Trigger ref={ref}>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      expect(ref.current).toBe(screen.getByRole('button', { name: 'Toggle' }));
    });

    describe('with a Tooltip between the trigger and the button', () => {
      function WithTooltip({ buttonId }: { buttonId?: string }) {
        return (
          <Popover>
            <Popover.Trigger>
              <Tooltip content="Narrow the list" openDelay={0}>
                <button type="button" id={buttonId}>
                  Filters
                </button>
              </Tooltip>
            </Popover.Trigger>
            <Popover.Content>
              <button type="button">Apply</button>
            </Popover.Content>
          </Popover>
        );
      }

      it('the button carries the trigger ARIA, the id and the description', async () => {
        const user = userEvent.setup();
        render(<WithTooltip />);
        const trigger = screen.getByRole('button', { name: 'Filters' });
        const tooltipWrapper = trigger.parentElement as HTMLElement;
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAccessibleDescription('Narrow the list');
        await user.click(trigger);
        const dialog = screen.getByRole('dialog', { name: 'Filters' });
        expect(dialog).toHaveAttribute('aria-labelledby', trigger.id);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('aria-controls', dialog.id);
        for (const attr of ['id', 'aria-haspopup', 'aria-expanded', 'aria-controls']) {
          expect(tooltipWrapper).not.toHaveAttribute(attr);
        }
        await expectNoA11yViolations();
      });

      it('is labelled by the button’s own id', async () => {
        const user = userEvent.setup();
        render(<WithTooltip buttonId="filters-button" />);
        await user.click(screen.getByRole('button', { name: 'Filters' }));
        expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveAttribute(
          'aria-labelledby',
          'filters-button',
        );
      });

      it('Escape from inside the content returns focus to the button', async () => {
        const user = userEvent.setup();
        render(<WithTooltip />);
        const trigger = screen.getByRole('button', { name: 'Filters' });
        await user.click(trigger);
        await user.tab();
        expect(screen.getByRole('button', { name: 'Apply' })).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(dialog()).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
      });
    });
  });

  describe('accessible name (overlays#12)', () => {
    it('is labelled by the trigger by default', () => {
      render(<Basic defaultOpen />);
      expect(screen.getByRole('dialog', { name: 'Toggle' })).toBeInTheDocument();
    });

    it('uses the trigger child’s own id', () => {
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button" id="my-trigger">
              Filters
            </button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute('id', 'my-trigger');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'my-trigger');
    });

    it('renders a title heading that names the popover', () => {
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content title="Share settings">Body</Popover.Content>
        </Popover>,
      );
      expect(screen.getByRole('dialog', { name: 'Share settings' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Share settings' })).toBeInTheDocument();
    });

    it('keeps a consumer id on the content and points aria-controls at it', async () => {
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content id="filters-panel">Body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);
      expect(screen.getByRole('dialog')).toHaveAttribute('id', 'filters-panel');
      expect(trigger).toHaveAttribute('aria-controls', 'filters-panel');
    });

    it('a consumer aria-label or aria-labelledby wins', () => {
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content aria-label="Custom name">Body</Popover.Content>
        </Popover>,
      );
      const surface = screen.getByRole('dialog', { name: 'Custom name' });
      expect(surface).not.toHaveAttribute('aria-labelledby');
    });

    it('warns in development when the popover has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Popover open>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      expect(warn.mock.calls).toEqual([
        [expect.stringMatching(/^\[WaveUI\] Popover\.Content: the popover has no accessible name/)],
      ]);
    });

    it('does not warn when named by the trigger', () => {
      const warn = vi.spyOn(console, 'warn');
      render(<Basic defaultOpen />);
      expect(warn).not.toHaveBeenCalled();
    });

    it('never points aria-labelledby at a trigger id that is not in the document, and warns', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      render(
        <Popover>
          <Popover.Trigger>
            {/* A render-prop child that does not spread the `id` it receives. */}
            {({ onClick, ref, ...stateAria }) => (
              <button
                type="button"
                ref={ref}
                onClick={onClick}
                aria-haspopup={stateAria['aria-haspopup']}
                aria-expanded={stateAria['aria-expanded']}
              >
                Filters
              </button>
            )}
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>,
      );
      await user.click(screen.getByRole('button', { name: 'Filters' }));
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[WaveUI\] Popover\.Content: .*`id`/),
      );
    });

    describe('a trigger named through aria-labelledby', () => {
      it('an icon-only Button named by Tooltip relationship="label" names the popover', async () => {
        const warn = vi.spyOn(console, 'warn');
        const user = userEvent.setup();
        render(
          <Popover>
            <Popover.Trigger>
              <Tooltip content="Filters" relationship="label">
                <Button icon={<svg viewBox="0 0 16 16" />} />
              </Tooltip>
            </Popover.Trigger>
            <Popover.Content>
              <p>Choose which items to show.</p>
            </Popover.Content>
          </Popover>,
        );
        const trigger = screen.getByRole('button', { name: 'Filters' });
        await user.click(trigger);
        const surface = screen.getByRole('dialog', { name: 'Filters' });
        // A name computation does not follow the trigger's own aria-labelledby a second time: the
        // popover references the trigger's label elements directly.
        expect(surface).toHaveAttribute('aria-labelledby', trigger.getAttribute('aria-labelledby'));
        await expectNoA11yViolations();
        expect(warn).not.toHaveBeenCalled();
      });

      it('a trigger labelled by a visible label names the popover with that label', async () => {
        const user = userEvent.setup();
        render(
          <>
            <span id="filters-label">Filters</span>
            <Popover>
              <Popover.Trigger>
                <button type="button" aria-labelledby="filters-label missing-id">
                  <svg aria-hidden="true" viewBox="0 0 16 16" />
                </button>
              </Popover.Trigger>
              <Popover.Content>Body</Popover.Content>
            </Popover>
          </>,
        );
        await user.click(screen.getByRole('button', { name: 'Filters' }));
        // Only the ids that exist in the document: the popover's reference never dangles.
        expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveAttribute(
          'aria-labelledby',
          'filters-label',
        );
      });

      it('warns in development when the trigger has no text to name the popover', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const user = userEvent.setup();
        render(
          <Popover>
            <Popover.Trigger>
              <button type="button" data-testid="unnamed">
                <svg aria-hidden="true" viewBox="0 0 16 16" />
              </button>
            </Popover.Trigger>
            <Popover.Content>Body</Popover.Content>
          </Popover>,
        );
        await user.click(screen.getByTestId('unnamed'));
        expect(screen.getByRole('dialog')).toHaveAttribute(
          'aria-labelledby',
          screen.getByTestId('unnamed').id,
        );
        expect(warn.mock.calls).toEqual([
          [expect.stringMatching(/^\[WaveUI\] Popover\.Content: .*trigger has no text/)],
        ]);
      });
    });

    it('an empty title (renders nothing) leaves the popover labelled by its trigger', () => {
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content title={[null, false, '']}>Body</Popover.Content>
        </Popover>,
      );
      expect(screen.getByRole('dialog', { name: 'Toggle' })).toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('has no accessibility violations when open (table-core#20)', async () => {
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content title="Details">
            <button type="button">Action</button>
          </Popover.Content>
        </Popover>,
      );
      await expectNoA11yViolations();
    });
  });

  describe('focus (overlays#13, overlays#31)', () => {
    function WithClose() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </Popover.Content>
          </Popover>
          <button type="button">Elsewhere</button>
        </>
      );
    }

    it('returns focus to the trigger when an inner Close button closes it', async () => {
      const user = userEvent.setup();
      render(<WithClose />);
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(dialog()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
    });

    it('returns focus to the trigger on Escape from inside the content', async () => {
      const user = userEvent.setup();
      render(<WithClose />);
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      screen.getByRole('button', { name: 'Close' }).focus();
      await user.keyboard('{Escape}');
      expect(dialog()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
    });

    it('keeps focus where an outside click put it', async () => {
      const user = userEvent.setup();
      render(<WithClose />);
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
      expect(dialog()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    });

    describe('with the wrapper-span trigger (asChild={false} and the automatic fallback)', () => {
      /** A custom button that neither forwards `ref` nor spreads props (automatic span fallback). */
      const Fancy = ({ children }: { children: React.ReactNode }) => (
        <button type="button">{children}</button>
      );

      function SpanTrigger({ mode }: { mode: Mode }) {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <Popover open={open} onOpenChange={setOpen}>
              {mode === 'fallback' ? (
                <Popover.Trigger>
                  <Fancy>Toggle</Fancy>
                </Popover.Trigger>
              ) : (
                <Popover.Trigger asChild={false}>
                  <button type="button">Toggle</button>
                </Popover.Trigger>
              )}
              <Popover.Content aria-label="Options">
                <button type="button">First</button>
                <button type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </Popover.Content>
            </Popover>
            <button type="button">After</button>
          </>
        );
      }

      type Mode = 'asChild={false}' | 'fallback';
      const modes: readonly Mode[] = ['asChild={false}', 'fallback'];

      /**
       * `asChild={false}` asks for the span and must not warn; the automatic fallback warns once
       * that the child did not attach the trigger ref.
       */
      function expectSpanWarnings(warn: { mock: { calls: unknown[][] } }, mode: Mode) {
        expect(warn.mock.calls).toEqual(
          mode === 'fallback' ? [[expect.stringMatching(/^\[WaveUI\] Popover\.Trigger: /)]] : [],
        );
      }

      it.each(modes)(
        'Shift+Tab from the first element returns to the button inside the span (%s)',
        async (mode) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const user = userEvent.setup();
          render(<SpanTrigger mode={mode} />);
          const toggle = screen.getByRole('button', { name: 'Toggle' });
          await user.click(toggle);
          await user.tab();
          expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
          await user.tab({ shift: true });
          expect(toggle).toHaveFocus();
          expectSpanWarnings(warn, mode);
        },
      );

      it.each(modes)(
        'Tab past the last element continues after the span, not back to its button (%s)',
        async (mode) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const user = userEvent.setup();
          render(<SpanTrigger mode={mode} />);
          await user.click(screen.getByRole('button', { name: 'Toggle' }));
          await user.tab();
          expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
          await user.tab();
          expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
          await user.tab();
          expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
          expectSpanWarnings(warn, mode);
        },
      );

      it.each(modes)(
        'an inner Close button returns focus to the button inside the span (%s)',
        async (mode) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const user = userEvent.setup();
          render(<SpanTrigger mode={mode} />);
          const toggle = screen.getByRole('button', { name: 'Toggle' });
          await user.click(toggle);
          await user.click(screen.getByRole('button', { name: 'Close' }));
          expect(dialog()).not.toBeInTheDocument();
          expect(toggle).toHaveFocus();
          expectSpanWarnings(warn, mode);
        },
      );

      it.each(modes)(
        'Escape from inside the content returns focus to the button inside the span (%s)',
        async (mode) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const user = userEvent.setup();
          render(<SpanTrigger mode={mode} />);
          const toggle = screen.getByRole('button', { name: 'Toggle' });
          await user.click(toggle);
          screen.getByRole('button', { name: 'First' }).focus();
          await user.keyboard('{Escape}');
          expect(dialog()).not.toBeInTheDocument();
          expect(toggle).toHaveFocus();
          expectSpanWarnings(warn, mode);
        },
      );
    });

    describe('with a wrapper span the consumer configured (tabIndex, role)', () => {
      /** An `asChild={false}` span given `spanProps`; Close in the content closes the popover. */
      function ConfiguredSpan({
        spanProps,
        children,
      }: {
        spanProps: React.HTMLAttributes<HTMLElement>;
        children: React.ReactNode;
      }) {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <Popover open={open} onOpenChange={setOpen}>
              <Popover.Trigger asChild={false} data-testid="wrap" {...spanProps}>
                {children}
              </Popover.Trigger>
              <Popover.Content aria-label="Options">
                <button type="button">First</button>
                <button type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </Popover.Content>
            </Popover>
            <button type="button">After</button>
          </>
        );
      }

      const renderOutOfTabOrder = () =>
        render(
          <ConfiguredSpan spanProps={{ tabIndex: -1 }}>
            <button type="button">Toggle</button>
          </ConfiguredSpan>,
        );

      it('tabIndex={-1}: Escape, Close and an outside press return focus to the button inside, not the span', async () => {
        const user = userEvent.setup();
        renderOutOfTabOrder();
        const toggle = screen.getByRole('button', { name: 'Toggle' });
        expect(screen.getByTestId('wrap')).not.toHaveAttribute('aria-expanded');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        await user.click(toggle);
        screen.getByRole('button', { name: 'First' }).focus();
        await user.keyboard('{Escape}');
        expect(dialog()).not.toBeInTheDocument();
        expect(toggle).toHaveFocus();

        // A press on the span itself focuses it (Safari does this for a click on the button too).
        await user.click(screen.getByTestId('wrap'));
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(dialog()).not.toBeInTheDocument();
        expect(toggle).toHaveFocus();

        await user.click(toggle);
        screen.getByRole('button', { name: 'First' }).focus();
        await user.click(document.body);
        expect(dialog()).not.toBeInTheDocument();
        expect(toggle).toHaveFocus();
      });

      it('tabIndex={-1}: Shift+Tab from the first element returns to the button inside, not the span', async () => {
        const user = userEvent.setup();
        renderOutOfTabOrder();
        const toggle = screen.getByRole('button', { name: 'Toggle' });
        await user.click(toggle);
        await user.tab();
        expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
        await user.tab({ shift: true });
        expect(toggle).toHaveFocus();
      });

      it('only tabIndex={0}: the button inside carries the state ARIA, not the generic span (axe), and takes focus back', async () => {
        const user = userEvent.setup();
        render(
          <ConfiguredSpan spanProps={{ tabIndex: 0 }}>
            <button type="button">Toggle</button>
          </ConfiguredSpan>,
        );
        const toggle = screen.getByRole('button', { name: 'Toggle' });
        const wrap = screen.getByTestId('wrap');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(wrap).not.toHaveAttribute('aria-haspopup');

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(toggle).toHaveAttribute('aria-controls', dialog()!.id);
        for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
          expect(wrap).not.toHaveAttribute(name);
        }
        await expectNoA11yViolations();
        screen.getByRole('button', { name: 'First' }).focus();
        await user.keyboard('{Escape}');
        expect(dialog()).not.toBeInTheDocument();
        expect(toggle).toHaveFocus();
      });

      it('role="button" and tabIndex={0}: the span stays the trigger and takes focus back', async () => {
        const user = userEvent.setup();
        render(<ConfiguredSpan spanProps={{ role: 'button', tabIndex: 0 }}>Toggle</ConfiguredSpan>);
        const span = screen.getByRole('button', { name: 'Toggle' });
        expect(span).toBe(screen.getByTestId('wrap'));
        expect(span).toHaveAttribute('aria-expanded', 'false');

        await user.click(span);
        screen.getByRole('button', { name: 'First' }).focus();
        await user.keyboard('{Escape}');
        expect(dialog()).not.toBeInTheDocument();
        expect(span).toHaveFocus();

        await user.click(span);
        await user.tab();
        expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
        await user.tab({ shift: true });
        expect(span).toHaveFocus();
      });
    });
  });

  describe('keyboard order of the portaled content (overlays#36)', () => {
    function TabOrder({
      content = true,
      defaultOpen = true,
      clickFocusesTrigger = true,
    }: {
      content?: boolean;
      defaultOpen?: boolean;
      /** `false`: a click leaves the trigger unfocused, as in Safari and Firefox on macOS. */
      clickFocusesTrigger?: boolean;
    }) {
      return (
        <>
          <button type="button">Before</button>
          <Popover defaultOpen={defaultOpen}>
            <Popover.Trigger>
              <button
                type="button"
                onMouseDown={clickFocusesTrigger ? undefined : (event) => event.preventDefault()}
              >
                Toggle
              </button>
            </Popover.Trigger>
            <Popover.Content aria-label="Options">
              {content ? (
                <>
                  <button type="button">First</button>
                  <button type="button">Last</button>
                </>
              ) : (
                'Read-only text'
              )}
            </Popover.Content>
          </Popover>
          <button type="button">After</button>
        </>
      );
    }

    it('Tab from the open trigger enters the content, then continues after the trigger', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      screen.getByRole('button', { name: 'Toggle' }).focus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('Shift+Tab from the first element of the content returns to the trigger', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      screen.getByRole('button', { name: 'First' }).focus();
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
    });

    it('follows the page order when the content has nothing to focus', async () => {
      const user = userEvent.setup();
      render(<TabOrder content={false} />);
      screen.getByRole('button', { name: 'Toggle' }).focus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
    });

    /** The focused element's text, or `body` when focus left the page. */
    const focused = () =>
      document.activeElement === document.body ? 'body' : document.activeElement?.textContent;

    async function tabs(user: ReturnType<typeof userEvent.setup>, count: number, shift = false) {
      const visited: Array<string | null | undefined> = [];
      for (let i = 0; i < count; i++) {
        await user.tab({ shift });
        visited.push(focused());
      }
      return visited;
    }

    it('a Tab lap visits the content once, after the trigger, and leaves the page after its last element', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      screen.getByRole('button', { name: 'Toggle' }).focus();
      // The portaled content sits at the end of the document. Tab from the last element of the page
      // moves past it (it was visited after the trigger) and leaves the page: no Tab cycle, and no
      // second visit.
      expect(await tabs(user, 7)).toEqual([
        'First',
        'Last',
        'After',
        'body',
        'Before',
        'Toggle',
        'First',
      ]);
      expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();
    });

    it('hides the content only while the Tab from the page end moves past it', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      const content = screen.getByRole('dialog', { name: 'Options' });
      const after = screen.getByRole('button', { name: 'After' });
      after.focus();
      // Read after the popover's own `keydown` listener, then as focus leaves After (the browser
      // has picked the next element by then).
      const seen: string[] = [];
      const record = () => seen.push(content.style.visibility);
      document.addEventListener('keydown', record);
      after.addEventListener('focusout', record);
      try {
        await user.tab();
      } finally {
        document.removeEventListener('keydown', record);
      }
      expect(document.body).toHaveFocus();
      expect(seen).toEqual(['hidden', '']);
    });

    it('Shift+Tab from the element after the trigger enters the content at its last element', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      screen.getByRole('button', { name: 'After' }).focus();
      expect(await tabs(user, 6, true)).toEqual([
        'Last',
        'First',
        'Toggle',
        'Before',
        'body',
        'After',
      ]);
    });

    it('a Shift+Tab lap from outside the page visits the content once, after the trigger', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      // Shift+Tab from nothing reaches the last element of the document, the content: focus goes
      // to the last element of the page instead, as if the content followed the trigger.
      expect(await tabs(user, 7, true)).toEqual([
        'After',
        'Last',
        'First',
        'Toggle',
        'Before',
        'body',
        'After',
      ]);
    });

    /**
     * Two popovers open at once; B's content is portaled after A's. `PopoverB` renders B (another
     * copy of the library's Popover, for example).
     */
    function TwoPopovers({ PopoverB = Popover }: { PopoverB?: typeof Popover }) {
      return (
        <>
          <button type="button">Before</button>
          {(
            [
              ['A', Popover],
              ['B', PopoverB],
            ] as const
          ).map(([name, P]) => (
            <P key={name} defaultOpen>
              <P.Trigger>
                <button type="button">{`Toggle ${name}`}</button>
              </P.Trigger>
              <P.Content aria-label={name}>
                <button type="button">{`${name} first`}</button>
                <button type="button">{`${name} last`}</button>
              </P.Content>
            </P>
          ))}
          <button type="button">After</button>
        </>
      );
    }

    it('with two popovers open, a Tab lap visits each content once, after its trigger', async () => {
      const user = userEvent.setup();
      render(<TwoPopovers />);
      // Tab from the page end moves past both portaled contents and leaves the page.
      expect(await tabs(user, 9)).toEqual([
        'Before',
        'Toggle A',
        'A first',
        'A last',
        'Toggle B',
        'B first',
        'B last',
        'After',
        'body',
      ]);
    });

    it('with two popovers open, Shift+Tab from outside the page reaches the page, not the other content', async () => {
      const user = userEvent.setup();
      render(<TwoPopovers />);
      // Shift+Tab from nothing reaches the last element of the document, B's content: focus goes to
      // the last element of the page, never into A's content (portaled before B's).
      expect(await tabs(user, 9, true)).toEqual([
        'After',
        'B last',
        'B first',
        'Toggle B',
        'A last',
        'A first',
        'Toggle A',
        'Before',
        'body',
      ]);
    });

    it('with popovers of two copies of the library open, Shift+Tab from outside the page reaches the page (global registry)', async () => {
      // A second evaluation of the module, as when an app loads both the ESM and the CJS build.
      vi.resetModules();
      const copy = await import('../Popover');
      expect(copy.Popover).not.toBe(Popover);
      const user = userEvent.setup();
      render(<TwoPopovers PopoverB={copy.Popover} />);
      // B's copy redirects the entry to the last element of the page, which lies outside A's
      // content too although another copy manages A.
      expect(await tabs(user, 9, true)).toEqual([
        'After',
        'B last',
        'B first',
        'Toggle B',
        'A last',
        'A first',
        'Toggle A',
        'Before',
        'body',
      ]);
    });

    it('the content ends the order when the trigger is the last element of the page', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Popover defaultOpen>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content aria-label="Options">
              <button type="button">First</button>
              <button type="button">Last</button>
            </Popover.Content>
          </Popover>
        </>,
      );
      expect(await tabs(user, 5, true)).toEqual(['Last', 'First', 'Toggle', 'Before', 'body']);
      expect(await tabs(user, 5)).toEqual(['Before', 'Toggle', 'First', 'Last', 'body']);
    });

    /** Before, a controlled open popover whose `trigger` is not a tab stop, After. */
    function UnfocusableTrigger({
      trigger,
      before = true,
      after = true,
    }: {
      trigger: React.ReactElement;
      before?: boolean;
      after?: boolean;
    }) {
      return (
        <>
          {before && <button type="button">Before</button>}
          <Popover open onOpenChange={() => {}}>
            <Popover.Trigger>{trigger}</Popover.Trigger>
            <Popover.Content aria-label="Details">
              <button type="button">First</button>
              <button type="button">Last</button>
            </Popover.Content>
          </Popover>
          {after && <button type="button">After</button>}
        </>
      );
    }

    const outOfOrderTrigger = (
      <button type="button" tabIndex={-1}>
        Toggle
      </button>
    );

    it('a trigger with nothing to focus: the content follows the tab stop before the trigger', async () => {
      const user = userEvent.setup();
      render(<UnfocusableTrigger trigger={<span>Data point</span>} />);
      expect(await tabs(user, 6)).toEqual(['Before', 'First', 'Last', 'After', 'body', 'Before']);
      expect(await tabs(user, 1, true)).toEqual(['body']);
      expect(await tabs(user, 6, true)).toEqual([
        'After',
        'Last',
        'First',
        'Before',
        'body',
        'After',
      ]);
    });

    it('a trigger outside the tab order (tabIndex={-1}): the content follows the tab stop before it, and Shift+Tab returns to the trigger', async () => {
      const user = userEvent.setup();
      render(<UnfocusableTrigger trigger={outOfOrderTrigger} />);
      expect(await tabs(user, 6)).toEqual(['Before', 'First', 'Last', 'After', 'body', 'Before']);
      expect(await tabs(user, 1, true)).toEqual(['body']);
      expect(await tabs(user, 7, true)).toEqual([
        'After',
        'Last',
        'First',
        'Toggle',
        'Before',
        'body',
        'After',
      ]);
    });

    it('a trigger outside the tab order at the end of the page: the content ends the order', async () => {
      const user = userEvent.setup();
      render(<UnfocusableTrigger trigger={outOfOrderTrigger} after={false} />);
      expect(await tabs(user, 4)).toEqual(['Before', 'First', 'Last', 'body']);
      expect(await tabs(user, 5, true)).toEqual(['Last', 'First', 'Toggle', 'Before', 'body']);
    });

    it('a trigger with no tab stop at or before it: the content keeps the place of its portal, and no Tab cycle forms', async () => {
      const user = userEvent.setup();
      render(<UnfocusableTrigger trigger={<span>Data point</span>} before={false} />);
      // Its place would come before every element of the page: Tab reaches it at the end of the
      // page instead, and a lap in either direction visits every element once.
      expect(await tabs(user, 5)).toEqual(['After', 'First', 'Last', 'body', 'After']);
      expect(await tabs(user, 1, true)).toEqual(['body']);
      expect(await tabs(user, 5, true)).toEqual(['Last', 'First', 'After', 'body', 'Last']);
    });

    it.each([
      ['Tab', false, ['After']],
      ['Shift+Tab', true, ['First', 'Toggle', 'Before']],
    ] as const)(
      'a click on the last element with nothing focused keeps the order after the trigger: %s',
      async (_key, shift, expected) => {
        const user = userEvent.setup();
        render(<TabOrder defaultOpen={false} clickFocusesTrigger={false} />);
        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        // The click opened the popover and left focus where it was: nowhere.
        expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();
        expect(document.body).toHaveFocus();
        // Focus reaches the content's last element from nothing, by a pointer press: not Shift+Tab
        // from the browser's own controls.
        await user.click(screen.getByRole('button', { name: 'Last' }));
        expect(await tabs(user, expected.length, shift)).toEqual(expected);
      },
    );

    it('a click on the content where nothing takes focus, then on its last element, keeps the order after the trigger', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      await user.click(screen.getByRole('button', { name: 'First' }));
      // The surface itself takes no focus: a press on it moves focus to the body.
      await user.click(screen.getByRole('dialog', { name: 'Options' }));
      expect(document.body).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Last' }));
      expect(await tabs(user, 1)).toEqual(['After']);
    });

    it('a press inside the content, then Shift+Tab from the pressed point onto its last element, keeps the order after the trigger', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      // A press below the last button: focus moves to the body, and the browser starts sequential
      // navigation at the pressed point, so Shift+Tab lands on the last button, from nothing.
      await user.click(screen.getByRole('dialog', { name: 'Options' }));
      expect(document.body).toHaveFocus();
      expect(await tabs(user, 3, true)).toEqual(['Last', 'First', 'Toggle']);
    });

    it('focus that returns to the last element as the window gets focus back keeps its order', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      const last = screen.getByRole('button', { name: 'Last' });
      await user.click(last);
      // Another window takes focus and gives it back: the browser focuses Last again, from nothing.
      act(() => {
        window.dispatchEvent(new FocusEvent('blur'));
        window.dispatchEvent(new FocusEvent('focus'));
        last.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });
      expect(await tabs(user, 1)).toEqual(['After']);
    });

    it.each([
      ['a script after a click', 'none', 'Last', 'After'],
      ['a script after the window got focus back and a key was pressed', 'key', 'Last', 'After'],
      ['Shift+Tab from the browser controls', 'browser', 'After', 'body'],
    ] as const)(
      'focus that reaches the last element from nothing by %s',
      async (_how, before, landsOn, next) => {
        const user = userEvent.setup();
        render(<TabOrder />);
        // A press where nothing takes focus: focus stays on the body.
        await user.click(screen.getByRole('dialog', { name: 'Options' }));
        expect(document.body).toHaveFocus();
        // Leaving for the browser's own controls blurs the window, and Shift+Tab there gives the
        // window focus back just before the document's last element takes focus; no key press
        // reaches the page. Such an entry goes to the last element of the page instead.
        if (before !== 'none') {
          act(() => {
            window.dispatchEvent(new FocusEvent('blur'));
            window.dispatchEvent(new FocusEvent('focus'));
          });
        }
        if (before === 'key') await user.keyboard('{Shift}');
        act(() => screen.getByRole('button', { name: 'Last' }).focus());
        expect(focused()).toBe(landsOn);
        expect(await tabs(user, 1)).toEqual([next]);
      },
    );

    it.each([
      ['Shift+Tab from nothing', 'keyboard'],
      ['Shift+Tab from the browser controls', 'browser'],
    ] as const)(
      'an entry at the content’s last element that goes to the page’s last element instead (%s) reaches the element’s handlers in order',
      async (_how, how) => {
        const user = userEvent.setup();
        const events: string[] = [];
        render(
          <>
            <button type="button">Before</button>
            <Popover defaultOpen>
              <Popover.Trigger>
                <button type="button">Toggle</button>
              </Popover.Trigger>
              <Popover.Content aria-label="Options">
                <button type="button">First</button>
                <Tooltip content="Last tip" openDelay={0}>
                  <button
                    type="button"
                    onFocus={() => events.push('focus')}
                    onBlur={() => events.push('blur')}
                  >
                    Last
                  </button>
                </Tooltip>
              </Popover.Content>
            </Popover>
            <button type="button">After</button>
          </>,
        );
        if (how === 'keyboard') {
          await user.tab({ shift: true });
        } else {
          let focusedAfterEntry: Element | null = null;
          act(() => {
            window.dispatchEvent(new FocusEvent('blur'));
            window.dispatchEvent(new FocusEvent('focus'));
            screen.getByRole('button', { name: 'Last' }).focus();
            // Moved on before the entering focus event is over, not in a later microtask: a
            // browser runs microtasks between the listeners of its own events, before React's.
            focusedAfterEntry = document.activeElement;
          });
          expect(focusedAfterEntry).toBe(screen.getByRole('button', { name: 'After' }));
        }
        expect(focused()).toBe('After');
        // The element's focus is handled before its blur, so its Tooltip is not left open.
        expect(events).toEqual(['focus', 'blur']);
        expect(document.querySelector('[data-wave-tooltip-surface]')).toBeNull();
      },
    );

    /** Before, a popover whose last element (Clear) removes or hides itself when pressed, After. */
    function SelfRemovingLast({ hide = false }: { hide?: boolean }) {
      const [shown, setShown] = React.useState(true);
      return (
        <>
          <button type="button">Before</button>
          <Popover>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content aria-label="Filters">
              <button type="button">First</button>
              {(shown || hide) && (
                <button type="button" hidden={!shown} onClick={() => setShown(false)}>
                  Clear
                </button>
              )}
            </Popover.Content>
          </Popover>
          <button type="button">After</button>
        </>
      );
    }

    it('keyboard only: Shift+Tab after the focused last element of the content removed itself continues before it', async () => {
      const user = userEvent.setup();
      render(<SelfRemovingLast />);
      expect(await tabs(user, 2)).toEqual(['Before', 'Toggle']);
      await user.keyboard('{Enter}');
      expect(await tabs(user, 2)).toEqual(['First', 'Clear']);
      await user.keyboard('{Enter}');
      // Clear is gone and focus with it. The browser starts sequential navigation where it was.
      expect(focused()).toBe('body');
      expect(await tabs(user, 2, true)).toEqual(['First', 'Toggle']);
      expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    });

    it('keyboard only: Shift+Tab after the focused last element of the content hid itself continues before it', async () => {
      const user = userEvent.setup();
      render(<SelfRemovingLast hide />);
      expect(await tabs(user, 2)).toEqual(['Before', 'Toggle']);
      await user.keyboard('{Enter}');
      expect(await tabs(user, 2)).toEqual(['First', 'Clear']);
      await user.keyboard('{Enter}');
      // A browser moves focus to nothing when the focused element is hidden; jsdom does not.
      const clear = screen.getByText('Clear');
      expect(clear).not.toBeVisible();
      act(() => clear.blur());
      expect(await tabs(user, 2, true)).toEqual(['First', 'Toggle']);
    });

    /** Before, an open popover, After, and (with `toast`) a Dismiss button in a portal of its own. */
    function LaterToast({ toast }: { toast: boolean }) {
      const [dismissed, setDismissed] = React.useState(false);
      return (
        <>
          <button type="button">Before</button>
          <Popover defaultOpen>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content aria-label="Options">
              <button type="button">First</button>
              <button type="button">Last</button>
            </Popover.Content>
          </Popover>
          <button type="button">After</button>
          {toast && !dismissed && (
            <Portal>
              <button type="button" onClick={() => setDismissed(true)}>
                Dismiss
              </button>
            </Portal>
          )}
        </>
      );
    }

    it('keyboard only: Shift+Tab after a control in a later, unrelated portal removed itself reaches the last element of the page', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<LaterToast toast={false} />);
      // Shown once the content is portaled, so its portal comes after the content's.
      rerender(<LaterToast toast />);
      const dismiss = screen.getByRole('button', { name: 'Dismiss' });
      const content = screen.getByRole('dialog', { name: 'Options' });
      expect(content.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      screen.getByRole('button', { name: 'After' }).focus();
      expect(await tabs(user, 1)).toEqual(['Dismiss']);
      await user.keyboard('{Enter}');
      // The toast is gone and focus with it. The browser starts where it was, after the content, so
      // Shift+Tab reaches the content's last element as from the end of the document: focus goes to
      // the last element of the page instead, and the lap visits the content once.
      expect(focused()).toBe('body');
      expect(await tabs(user, 6, true)).toEqual([
        'After',
        'Last',
        'First',
        'Toggle',
        'Before',
        'body',
      ]);
    });

    /** An open popover whose last element stops its focus event and removes itself when pressed. */
    function StoppedFocus() {
      const [shown, setShown] = React.useState(true);
      return (
        <>
          <button type="button">Before</button>
          <Popover defaultOpen>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content aria-label="Options">
              <button type="button">First</button>
              {shown && (
                <button
                  type="button"
                  onFocus={(event) => event.stopPropagation()}
                  onClick={() => setShown(false)}
                >
                  Last
                </button>
              )}
            </Popover.Content>
          </Popover>
          <button type="button">After</button>
        </>
      );
    }

    it('a consumer onFocus that stops the propagation of the entry at the content’s last element keeps focus there: no trap and no Tab cycle', async () => {
      const user = userEvent.setup();
      render(<StoppedFocus />);
      // Shift+Tab from nothing lands on the content's last element. Its focus event never reaches
      // the window, so focus is not moved on to the last element of the page: it stays there, as an
      // entry at the content's place after the trigger, and both directions leave the page.
      expect(await tabs(user, 5, true)).toEqual(['Last', 'First', 'Toggle', 'Before', 'body']);
      expect(await tabs(user, 1, true)).toEqual(['Last']);
      expect(await tabs(user, 2)).toEqual(['After', 'body']);
      expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();
    });

    it('a consumer onFocus that stops the propagation of the entry still records where focus was: Shift+Tab after that element removed itself continues before it', async () => {
      const user = userEvent.setup();
      render(<StoppedFocus />);
      expect(await tabs(user, 1, true)).toEqual(['Last']);
      await user.keyboard('{Enter}');
      expect(focused()).toBe('body');
      expect(await tabs(user, 2, true)).toEqual(['First', 'Toggle']);
    });

    it.each([
      [
        'a Dialog',
        'Delete',
        <Dialog key="dialog">
          <Dialog.Trigger>
            <button type="button">Delete</button>
          </Dialog.Trigger>
          <Dialog.Content title="Confirm">
            <button type="button">Ok</button>
          </Dialog.Content>
        </Dialog>,
      ],
      [
        'a nested Popover',
        'Details',
        <Popover key="popover">
          <Popover.Trigger>
            <button type="button">Details</button>
          </Popover.Trigger>
          <Popover.Content aria-label="More details">
            <button type="button">Inner action</button>
          </Popover.Content>
        </Popover>,
      ],
    ] as const)(
      'keyboard only: after %s opened from the content’s last element closes, Tab from there continues after the trigger',
      async (_layer, opener, layer) => {
        const user = userEvent.setup();
        render(
          <>
            <button type="button">Before</button>
            <Popover>
              <Popover.Trigger>
                <button type="button">Toggle</button>
              </Popover.Trigger>
              <Popover.Content aria-label="Options">
                <button type="button">First</button>
                {layer}
              </Popover.Content>
            </Popover>
            <button type="button">After</button>
          </>,
        );
        expect(await tabs(user, 2)).toEqual(['Before', 'Toggle']);
        await user.keyboard('{Enter}');
        expect(await tabs(user, 2)).toEqual(['First', opener]);
        await user.keyboard('{Enter}');
        // Into the layer (the Dialog moves focus itself; the nested Popover is entered with Tab).
        if (opener === 'Details') await user.tab();
        expect(screen.getAllByRole('dialog')).toHaveLength(2);
        // Escape closes the layer only. Its elements are removed before focus comes back, so the
        // restored focus arrives from nothing, although it does not come from the browser's controls.
        await user.keyboard('{Escape}');
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(screen.getByRole('button', { name: opener })).toHaveFocus();
        expect(await tabs(user, 1)).toEqual(['After']);
      },
    );

    /**
     * Shows the content again after the popover moved past it, before the browser moves focus (a
     * later `keydown` listener), so the Tab from the last element of the page still reaches it.
     */
    function revealContentOnKeyDown(name: string): () => void {
      const content = screen.getByRole('dialog', { name });
      const reveal = () => content.style.removeProperty('visibility');
      document.addEventListener('keydown', reveal);
      return () => document.removeEventListener('keydown', reveal);
    }

    it('content that the Tab from the page end still reaches follows the document order from there: no Tab cycle', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      const stop = revealContentOnKeyDown('Options');
      try {
        screen.getByRole('button', { name: 'After' }).focus();
        expect(await tabs(user, 4)).toEqual(['First', 'Last', 'body', 'Before']);
      } finally {
        stop();
      }
    });

    it.each([
      ['a click', 'click'],
      ['a script', 'script'],
    ] as const)(
      'focus that enters the content by %s after the Tab from the page end moved past it keeps the order after the trigger',
      async (_how, how) => {
        const user = userEvent.setup();
        render(<TabOrder />);
        screen.getByRole('button', { name: 'After' }).focus();
        expect(await tabs(user, 1)).toEqual(['body']);
        const first = screen.getByRole('button', { name: 'First' });
        if (how === 'click') await user.click(first);
        else act(() => first.focus());
        expect(await tabs(user, 2)).toEqual(['Last', 'After']);
      },
    );

    it('shows the content again when the Tab from the page end moves nothing', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      const content = screen.getByRole('dialog', { name: 'Options' });
      // A later listener takes the Tab (no focus moves).
      const cancel = (event: KeyboardEvent) => event.preventDefault();
      document.addEventListener('keydown', cancel);
      try {
        screen.getByRole('button', { name: 'After' }).focus();
        await user.tab();
      } finally {
        document.removeEventListener('keydown', cancel);
      }
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      await waitFor(() => expect(content.style.visibility).toBe(''));
    });

    it('a reopened popover whose content takes focus as it mounts keeps the order after the trigger', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Popover defaultOpen>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content aria-label="Search">
              <input aria-label="Query" autoFocus />
            </Popover.Content>
          </Popover>
          <button type="button">After</button>
        </>,
      );
      const query = () => screen.getByRole('textbox', { name: 'Query' });
      // Mounted open, the field took focus: Tab continues after the trigger.
      expect(query()).toHaveFocus();
      expect(await tabs(user, 1)).toEqual(['After']);
      // Reached natively from the last element of the page, the content follows the document
      // order ...
      const stop = revealContentOnKeyDown('Search');
      try {
        await user.tab();
      } finally {
        stop();
      }
      expect(query()).toHaveFocus();
      // ... until Escape closes it with focus back on the trigger.
      await user.keyboard('{Escape}');
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
      // Reopened from the trigger, the content's field takes focus as it mounts: after the trigger.
      await user.keyboard('{Enter}');
      expect(query()).toHaveFocus();
      expect(await tabs(user, 1)).toEqual(['After']);
    });
  });

  describe('controlled contract (overlays#32)', () => {
    it('Escape, outside press and the trigger each call onOpenChange(false) once while it stays open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <>
          <Basic open onOpenChange={onOpenChange} />
          <button type="button">Outside</button>
        </>,
      );
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      expect(onOpenChange).toHaveBeenCalledTimes(3);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('a controlled-closed trigger calls onOpenChange(true) without opening', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Basic open={false} onOpenChange={onOpenChange} />);
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('fires onOpenChange exactly once per click under StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <Basic onOpenChange={onOpenChange} />
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('hover opening (openOnHover, openDelay, closeDelay)', () => {
    let user: UserEvent;
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Advances the fake clock inside act() (the hover timers set state). */
    function advance(ms: number) {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }

    /** A hover card: a trigger, content with one button, and a button elsewhere on the page. */
    function HoverCard({
      disabled,
      ...props
    }: Omit<PopoverProps, 'children'> & { disabled?: boolean }) {
      return (
        <>
          <Popover openOnHover {...props}>
            <Popover.Trigger>
              <button type="button" aria-disabled={disabled || undefined}>
                Profile
              </button>
            </Popover.Trigger>
            <Popover.Content>
              <button type="button">Follow</button>
              <ChildLayer label="Nested" />
            </Popover.Content>
          </Popover>
          <button type="button">Elsewhere</button>
        </>
      );
    }

    const trigger = () => screen.getByRole('button', { name: 'Profile' });

    it('opens 250 ms after the pointer rests on the trigger, without moving focus, and closes 500 ms after it has left the trigger and the content', async () => {
      render(<HoverCard />);
      await user.hover(trigger());
      advance(200);
      expect(dialog()).not.toBeInTheDocument();
      advance(100);
      expect(screen.getByRole('dialog', { name: 'Profile' })).toBeInTheDocument();
      expect(document.body).toHaveFocus();
      await user.unhover(trigger());
      advance(400);
      expect(dialog()).toBeInTheDocument();
      advance(150);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('openDelay and closeDelay set the timing', async () => {
      render(<HoverCard openDelay={100} closeDelay={1000} />);
      await user.hover(trigger());
      advance(50);
      expect(dialog()).not.toBeInTheDocument();
      advance(100);
      expect(dialog()).toBeInTheDocument();
      await user.unhover(trigger());
      advance(900);
      expect(dialog()).toBeInTheDocument();
      advance(150);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('leaving the trigger before openDelay opens nothing', async () => {
      render(<HoverCard />);
      await user.hover(trigger());
      advance(150);
      await user.unhover(trigger());
      advance(1000);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('stays open while the pointer is on the content, and closes after it leaves', async () => {
      render(<HoverCard />);
      await user.hover(trigger());
      advance(300);
      await user.hover(screen.getByRole('dialog'));
      advance(1000);
      expect(dialog()).toBeInTheDocument();
      await user.unhover(screen.getByRole('dialog'));
      advance(600);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('keeps it open while the pointer crosses the 8 px gap towards the content, even slowly (safe zone)', async () => {
      render(<HoverCard />);
      mockRect(trigger(), { x: 100, y: 100, width: 80, height: 32 });
      await user.pointer({ target: trigger(), coords: { clientX: 140, clientY: 120 } });
      advance(300);
      const surface = screen.getByRole('dialog');
      mockRect(surface, { x: 100, y: 140, width: 256, height: 120 });
      // Out of the trigger's bottom edge, then diagonally down and right across the gap, each
      // step slower than closeDelay would allow if the moves did not keep it open.
      await user.pointer({ target: document.body, coords: { clientX: 142, clientY: 133 } });
      for (const [clientX, clientY] of [
        [150, 135],
        [160, 136],
        [170, 137],
        [180, 138],
      ]) {
        advance(300);
        await user.pointer({ target: document.body, coords: { clientX, clientY } });
      }
      advance(300);
      expect(dialog()).toBeInTheDocument();
      await user.pointer({ target: surface, coords: { clientX: 190, clientY: 150 } });
      advance(1000);
      expect(dialog()).toBeInTheDocument();
    });

    it('closes closeDelay after the pointer moves out of the safe zone', async () => {
      render(<HoverCard />);
      mockRect(trigger(), { x: 100, y: 100, width: 80, height: 32 });
      await user.pointer({ target: trigger(), coords: { clientX: 140, clientY: 120 } });
      advance(300);
      mockRect(screen.getByRole('dialog'), { x: 100, y: 140, width: 256, height: 120 });
      await user.pointer({ target: document.body, coords: { clientX: 142, clientY: 133 } });
      advance(300);
      // Away from the content, above the trigger's bottom edge: the zone ends, the timer runs on.
      await user.pointer({ target: document.body, coords: { clientX: 60, clientY: 90 } });
      advance(250);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('a click on the trigger pins a hover-opened popover and keeps focus on the trigger; a second click closes it', async () => {
      const onOpenChange = vi.fn();
      render(<HoverCard onOpenChange={onOpenChange} />);
      await user.hover(trigger());
      advance(300);
      expect(dialog()).toBeInTheDocument();
      await user.click(trigger());
      expect(dialog()).toBeInTheDocument();
      expect(trigger()).toHaveFocus();
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      await user.unhover(trigger());
      advance(1000);
      expect(dialog()).toBeInTheDocument();
      await user.click(trigger());
      expect(dialog()).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('focus inside the content keeps it open after the pointer leaves; once focus and pointer are gone it closes', async () => {
      render(<HoverCard />);
      await user.hover(trigger());
      advance(300);
      await user.hover(screen.getByRole('dialog'));
      act(() => screen.getByRole('button', { name: 'Follow' }).focus());
      await user.unhover(screen.getByRole('dialog'));
      advance(1000);
      expect(dialog()).toBeInTheDocument();
      act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
      advance(400);
      expect(dialog()).toBeInTheDocument();
      advance(150);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('focus inside a layer opened from the content keeps it open', async () => {
      render(<HoverCard />);
      await user.hover(trigger());
      advance(300);
      await user.click(screen.getByRole('button', { name: 'Open Nested' }));
      act(() => screen.getByRole('button', { name: 'Nested action' }).focus());
      await user.unhover(screen.getByRole('button', { name: 'Nested action' }));
      await user.hover(screen.getByRole('button', { name: 'Elsewhere' }));
      advance(1000);
      expect(screen.getByRole('dialog', { name: 'Profile' })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Nested' })).toBeInTheDocument();
    });

    it('a popover opened by a click or by its open prop does not close by hover', async () => {
      const { unmount } = render(<HoverCard />);
      await user.click(trigger());
      await user.unhover(trigger());
      advance(1000);
      expect(dialog()).toBeInTheDocument();
      await user.click(trigger());
      expect(dialog()).not.toBeInTheDocument();
      unmount();
      render(<HoverCard open onOpenChange={() => {}} />);
      await user.hover(trigger());
      await user.unhover(trigger());
      advance(1000);
      expect(dialog()).toBeInTheDocument();
    });

    it('focus on the trigger does not keep an unpinned hover card open', async () => {
      render(<HoverCard />);
      await user.click(trigger());
      expect(dialog()).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(dialog()).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
      await user.unhover(trigger());
      await user.hover(trigger());
      advance(300);
      expect(dialog()).toBeInTheDocument();
      await user.unhover(trigger());
      advance(600);
      expect(dialog()).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });

    it('after Escape it does not reopen while the pointer stays on the trigger; leaving and entering again opens it', async () => {
      render(<HoverCard />);
      mockRect(trigger(), { x: 100, y: 100, width: 80, height: 32 });
      await user.pointer({ target: trigger(), coords: { clientX: 140, clientY: 116 } });
      advance(300);
      expect(dialog()).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(dialog()).not.toBeInTheDocument();
      await user.pointer({ target: trigger(), coords: { clientX: 144, clientY: 118 } });
      advance(1000);
      expect(dialog()).not.toBeInTheDocument();
      await user.unhover(trigger());
      await user.hover(trigger());
      advance(300);
      expect(dialog()).toBeInTheDocument();
    });

    it.each(['touch', 'pen'] as const)('a %s pointer does not open it by hover', (pointerType) => {
      render(<HoverCard />);
      act(() => {
        trigger().dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType }));
        trigger().dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType }));
      });
      advance(1000);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('an aria-disabled trigger does not open by hover', async () => {
      render(<HoverCard disabled />);
      await user.hover(trigger());
      advance(1000);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('a hover-opened popover is named by its trigger and entered by Tab from it', async () => {
      render(<HoverCard />);
      act(() => trigger().focus());
      await user.hover(trigger());
      advance(300);
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Profile');
      await user.tab();
      expect(screen.getByRole('button', { name: 'Follow' })).toHaveFocus();
      await user.unhover(trigger());
      advance(1000);
      expect(dialog()).toBeInTheDocument();
    });

    it('calls onOpenChange once per change (StrictMode)', async () => {
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <HoverCard onOpenChange={onOpenChange} />
        </React.StrictMode>,
      );
      await user.hover(trigger());
      advance(300);
      expect(onOpenChange.mock.calls).toEqual([[true]]);
      await user.unhover(trigger());
      advance(600);
      expect(dialog()).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('a controlled popover asks to open and to close on hover', async () => {
      const onOpenChange = vi.fn();
      function Controlled() {
        const [open, setOpen] = React.useState(false);
        return (
          <HoverCard
            open={open}
            onOpenChange={(next) => {
              onOpenChange(next);
              setOpen(next);
            }}
          />
        );
      }
      render(<Controlled />);
      await user.hover(trigger());
      advance(300);
      expect(dialog()).toBeInTheDocument();
      await user.unhover(trigger());
      advance(600);
      expect(dialog()).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('without openOnHover, hover opens nothing and a click toggles as before', async () => {
      render(<Basic />);
      const toggle = screen.getByRole('button', { name: 'Toggle' });
      await user.hover(toggle);
      advance(1000);
      expect(dialog()).not.toBeInTheDocument();
      await user.click(toggle);
      expect(dialog()).toBeInTheDocument();
      await user.click(toggle);
      expect(dialog()).not.toBeInTheDocument();
    });

    it('has no accessibility violations while hover-opened', async () => {
      render(<HoverCard />);
      await user.hover(trigger());
      advance(300);
      expect(dialog()).toBeInTheDocument();
      await expectNoA11yViolations();
    });

    it('types the hover props', () => {
      expectTypeOf<PopoverProps['openOnHover']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<PopoverProps['openDelay']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<PopoverProps['closeDelay']>().toEqualTypeOf<number | undefined>();
    });
  });

  describe('context popovers (openOnContext)', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    let error: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      error = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      // Tests that expect a warning assert it and clear the spy; nothing else may be logged.
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    const CONTEXT_STATE_ARIA_WARNING =
      '[WaveUI] Popover.Trigger: the trigger element is a context-menu region (openOnContext), which is not a menu button: do not spread aria-haspopup, aria-expanded and aria-controls onto it.';
    const CONTEXT_NAME_WARNING =
      '[WaveUI] Popover.Content: the popover has no accessible name. A context popover (openOnContext) is not named by its region: pass `title`, `aria-label` or `aria-labelledby`.';

    const rows = (
      <>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" data-testid={`row-${n}`}>{`Row ${n}`}</button>
        ))}
        <input aria-label="Rename" />
      </>
    );

    /** A file list whose rows open a context popover, between two page buttons. */
    function FileList({
      contentProps,
      content = (
        <>
          <button type="button">Open</button>
          <button type="button">Share</button>
        </>
      ),
      ...props
    }: Omit<PopoverProps, 'children'> & {
      contentProps?: Partial<PopoverContentProps>;
      content?: React.ReactNode;
    }) {
      return (
        <>
          <button type="button">Before</button>
          <Popover openOnContext {...props}>
            <Popover.Trigger>
              <div role="group" aria-label="Files" data-testid="region">
                {rows}
              </div>
            </Popover.Trigger>
            <Popover.Content aria-label="File actions" data-testid="content" {...contentProps}>
              {content}
            </Popover.Content>
          </Popover>
          <button type="button">Outside</button>
        </>
      );
    }

    const row = (n: number) => screen.getByRole('button', { name: `Row ${n}` });
    const region = () => screen.getByTestId('region');
    const layout = () =>
      mockLayout({
        region: { x: 100, y: 100, width: 300, height: 200 },
        'row-2': { x: 100, y: 140, width: 300, height: 30 },
        content: { x: 0, y: 0, width: 256, height: 120 },
      });

    describe('pointer gestures', () => {
      it('a right click opens it at the pointer, prevents the browser menu and leaves focus on the row', async () => {
        layout();
        render(<FileList />);
        act(() => row(3).focus());
        expect(fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 })).toBe(
          false,
        );
        const surface = screen.getByRole('dialog', { name: 'File actions' });
        expect(row(3)).toHaveFocus();
        await waitFor(() => expect(surface.style.transform).toBe('translate(300px, 208px)'));
        expect(surface).toHaveAttribute('data-side', 'bottom');
      });

      it('a macOS Ctrl+click opens it at its point too', async () => {
        layout();
        render(<FileList />);
        expect(
          fireEvent.contextMenu(row(1), { button: 0, ctrlKey: true, clientX: 500, clientY: 150 }),
        ).toBe(false);
        await waitFor(() =>
          expect(screen.getByRole('dialog').style.transform).toBe('translate(500px, 158px)'),
        );
      });

      it('a second right click moves it to the new point', async () => {
        layout();
        const onOpenChange = vi.fn();
        render(<FileList onOpenChange={onOpenChange} />);
        fireEvent.contextMenu(row(1), { button: 2, clientX: 300, clientY: 200 });
        await waitFor(() =>
          expect(screen.getByRole('dialog').style.transform).toBe('translate(300px, 208px)'),
        );
        fireEvent.contextMenu(row(4), { button: 2, clientX: 420, clientY: 260 });
        await waitFor(() =>
          expect(screen.getByRole('dialog').style.transform).toBe('translate(420px, 268px)'),
        );
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(onOpenChange.mock.calls).toEqual([[true]]);
      });

      it('a macOS Ctrl+click on another row moves it instead of closing it', async () => {
        layout();
        const user = userEvent.setup();
        render(<FileList />);
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        // The press of the Ctrl+click (a primary press with Ctrl), then its contextmenu.
        await user.keyboard('{Control>}');
        await user.click(row(1));
        await user.keyboard('{/Control}');
        expect(dialog()).toBeInTheDocument();
        fireEvent.contextMenu(row(1), { button: 0, ctrlKey: true, clientX: 150, clientY: 120 });
        await waitFor(() =>
          expect(screen.getByRole('dialog').style.transform).toBe('translate(150px, 128px)'),
        );
      });

      it('side="end" resolves against the pointer in RTL (to its left)', async () => {
        layout();
        renderWithProviders(<FileList side="end" />, { dir: 'rtl' });
        fireEvent.contextMenu(row(3), { button: 2, clientX: 500, clientY: 200 });
        const surface = screen.getByRole('dialog');
        // x = 500 - 256 - 8, aligned with the point's top.
        await waitFor(() => expect(surface.style.transform).toBe('translate(236px, 200px)'));
        expect(surface).toHaveAttribute('data-side', 'left');
      });

      it('opened from outside (a controlled open, no gesture), it sits next to the region', async () => {
        layout();
        render(<FileList open onOpenChange={() => {}} />);
        await waitFor(() =>
          expect(screen.getByRole('dialog').style.transform).toBe('translate(100px, 308px)'),
        );
      });

      it('Tab from the row enters the content, Shift+Tab from its first element returns to the row, and Tab on another row moves on', async () => {
        const user = userEvent.setup();
        render(<FileList />);
        act(() => row(3).focus());
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        await user.tab();
        expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
        await user.tab({ shift: true });
        expect(row(3)).toHaveFocus();
        act(() => row(1).focus());
        await user.tab();
        expect(row(2)).toHaveFocus();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('a click does not open it, and the region has no click toggle', async () => {
        const user = userEvent.setup();
        render(<FileList />);
        await user.click(row(2));
        expect(dialog()).not.toBeInTheDocument();
        await user.click(region());
        expect(dialog()).not.toBeInTheDocument();
      });

      it('a primary press on another row closes it', async () => {
        const user = userEvent.setup();
        render(<FileList />);
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(dialog()).toBeInTheDocument();
        await user.click(row(1));
        expect(dialog()).not.toBeInTheDocument();
        expect(row(1)).toHaveFocus();
      });

      it('a right click outside closes it and keeps the browser menu there', () => {
        render(<FileList />);
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(
          fireEvent.contextMenu(screen.getByRole('button', { name: 'Outside' }), { button: 2 }),
        ).toBe(true);
        expect(dialog()).not.toBeInTheDocument();
      });

      it('a scroll outside that moves the region closes it; one that does not, and one inside the content, do not', () => {
        render(<FileList />);
        mockRect(region(), { x: 100, y: 100, width: 300, height: 200 });
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        fireEvent.scroll(document);
        expect(dialog()).toBeInTheDocument();
        mockRect(region(), { x: 100, y: 40, width: 300, height: 200 });
        fireEvent.scroll(screen.getByRole('dialog'));
        expect(dialog()).toBeInTheDocument();
        fireEvent.scroll(document);
        expect(dialog()).not.toBeInTheDocument();
      });

      it('suppresses the browser menu inside the content', () => {
        render(<FileList />);
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(
          fireEvent.contextMenu(screen.getByRole('button', { name: 'Open' }), { button: 2 }),
        ).toBe(false);
        expect(dialog()).toBeInTheDocument();
      });

      it('with nothing focused at the gesture, Escape moves focus to the region’s first tabbable element', async () => {
        const user = userEvent.setup();
        render(<FileList />);
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(document.body).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(dialog()).not.toBeInTheDocument();
        expect(row(1)).toHaveFocus();
      });
    });

    describe('keyboard gestures', () => {
      it.each([
        ['Shift+F10', (el: HTMLElement) => fireEvent.keyDown(el, { key: 'F10', shiftKey: true })],
        ['the ContextMenu key', (el: HTMLElement) => fireEvent.keyDown(el, { key: 'ContextMenu' })],
      ])(
        '%s on a row opens it against that row and moves focus into the content; the contextmenu that follows keeps it there',
        async (_key, press) => {
          layout();
          render(<FileList />);
          act(() => row(2).focus());
          expect(press(row(2))).toBe(false);
          const surface = screen.getByRole('dialog', { name: 'File actions' });
          expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
          await waitFor(() => expect(surface.style.transform).toBe('translate(100px, 178px)'));
          expect(fireEvent.contextMenu(row(2), { button: 0, clientX: 600, clientY: 500 })).toBe(
            false,
          );
          await act(async () => {});
          expect(surface.style.transform).toBe('translate(100px, 178px)');
          expect(screen.getAllByRole('dialog')).toHaveLength(1);
        },
      );

      it('Escape returns focus to the row the gesture came from', async () => {
        const user = userEvent.setup();
        render(<FileList />);
        act(() => row(4).focus());
        await user.keyboard('{Shift>}{F10}{/Shift}');
        expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(dialog()).not.toBeInTheDocument();
        expect(row(4)).toHaveFocus();
      });

      it('focuses the content itself when nothing in it can take focus', () => {
        render(<FileList content="No actions for this file" />);
        act(() => row(2).focus());
        fireEvent.keyDown(row(2), { key: 'F10', shiftKey: true });
        const surface = screen.getByRole('dialog');
        expect(surface).toHaveFocus();
        expect(surface).toHaveAttribute('tabindex', '-1');
      });

      it('a key pressed on the region itself anchors to the region', async () => {
        layout();
        render(<FileList />);
        const el = region();
        el.tabIndex = 0;
        act(() => el.focus());
        fireEvent.keyDown(el, { key: 'F10', shiftKey: true });
        // Below the region: x = 100, y = 100 + 200 + 8.
        await waitFor(() =>
          expect(screen.getByRole('dialog').style.transform).toBe('translate(100px, 308px)'),
        );
      });
    });

    describe('text fields in the region keep the browser menu', () => {
      it('a right click or Shift+F10 in a text field opens nothing and is not prevented', () => {
        render(<FileList />);
        const field = screen.getByRole('textbox', { name: 'Rename' });
        act(() => field.focus());
        expect(fireEvent.contextMenu(field, { button: 2, clientX: 10, clientY: 10 })).toBe(true);
        expect(fireEvent.keyDown(field, { key: 'F10', shiftKey: true })).toBe(true);
        expect(dialog()).not.toBeInTheDocument();
      });
    });

    describe('the region is no popover button', () => {
      const STATE_ARIA = ['aria-haspopup', 'aria-expanded', 'aria-controls'];
      const expectNoStateAria = (el: Element) => {
        for (const name of STATE_ARIA) expect(el).not.toHaveAttribute(name);
      };

      it('a cloned child gets no state ARIA and no click toggle, closed and open', () => {
        render(<FileList />);
        expectNoStateAria(region());
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expectNoStateAria(region());
        expect(region()).toHaveAttribute('id');
      });

      it('a wrapper span gets no state ARIA, and none moves to the element inside', () => {
        render(
          <Popover openOnContext>
            <Popover.Trigger asChild={false} data-testid="span">
              {rows}
            </Popover.Trigger>
            <Popover.Content aria-label="File actions">Body</Popover.Content>
          </Popover>,
        );
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expectNoStateAria(screen.getByTestId('span'));
        expectNoStateAria(row(1));
      });

      it('a render-prop child receives aria-expanded false, no aria-controls and a click that does nothing; the state ARIA it spreads is removed, with a warning', async () => {
        const received: PopoverTriggerChildProps[] = [];
        render(
          <Popover openOnContext>
            <Popover.Trigger>
              {(props) => {
                received.push(props);
                return (
                  <div role="group" aria-label="Files" data-testid="region" {...props}>
                    {rows}
                  </div>
                );
              }}
            </Popover.Trigger>
            <Popover.Content aria-label="File actions">
              <button type="button">Open</button>
            </Popover.Content>
          </Popover>,
        );
        expectNoStateAria(region());
        fireEvent.click(region());
        expect(dialog()).not.toBeInTheDocument();
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expectNoStateAria(region());
        const last = received[received.length - 1];
        expect(last['aria-expanded']).toBe(false);
        expect(last['aria-controls']).toBeUndefined();
        await expectNoA11yViolations();
        expect(warn.mock.calls).toEqual([[CONTEXT_STATE_ARIA_WARNING]]);
        warn.mockClear();
      });

      it('renders no state ARIA on the server', () => {
        const serverHtml = renderToString(<FileList />);
        expect(serverHtml).not.toMatch(/aria-haspopup|aria-expanded|aria-controls/);
      });

      it('a Tooltip around the trigger still describes the region', () => {
        render(
          <Popover openOnContext>
            <Tooltip content="Right-click a file for its actions">
              <Popover.Trigger>
                <div role="group" aria-label="Files" tabIndex={0} data-testid="region">
                  {rows}
                </div>
              </Popover.Trigger>
            </Tooltip>
            <Popover.Content aria-label="File actions">Body</Popover.Content>
          </Popover>,
        );
        expect(region()).toHaveAccessibleDescription('Right-click a file for its actions');
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    describe('naming', () => {
      it('the content is not named by the region: without a name it warns', () => {
        render(<FileList contentProps={{ 'aria-label': undefined }} />);
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
        expect(warn.mock.calls).toEqual([[CONTEXT_NAME_WARNING]]);
        warn.mockClear();
      });

      it.each([
        ['aria-label', { 'aria-label': 'File actions' }, 'File actions'],
        ['title', { 'aria-label': undefined, title: 'Actions' }, 'Actions'],
      ])('%s names it, without a warning', (_name, contentProps, expected) => {
        render(<FileList contentProps={contentProps} />);
        fireEvent.contextMenu(row(3), { button: 2, clientX: 300, clientY: 200 });
        expect(screen.getByRole('dialog')).toHaveAccessibleName(expected);
      });
    });

    it('ignores openOnHover, with a warning', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<FileList openOnHover />);
        await user.hover(row(2));
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(dialog()).not.toBeInTheDocument();
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Popover: `openOnHover` is ignored with `openOnContext`: a context popover opens on a right click, Shift+F10 or the ContextMenu key, not on hover.',
          ],
        ]);
        warn.mockClear();
      } finally {
        vi.useRealTimers();
      }
    });

    it('has no accessibility violations while open', async () => {
      render(<FileList />);
      act(() => row(2).focus());
      fireEvent.keyDown(row(2), { key: 'F10', shiftKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await expectNoA11yViolations();
    });

    it('types openOnContext', () => {
      expectTypeOf<PopoverProps['openOnContext']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<PopoverTriggerChildProps['aria-expanded']>().toEqualTypeOf<boolean>();
    });
  });

  describe('target', () => {
    /** A controlled popover anchored to an external toggle that carries its own ARIA. */
    function AnchoredToToggle({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
      const [open, setOpen] = React.useState(false);
      const [target, setTarget] = React.useState<HTMLElement | null>(null);
      return (
        <>
          <button type="button">Before</button>
          <button
            type="button"
            ref={setTarget}
            data-testid="target"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? 'details' : undefined}
            onClick={() => setOpen((current) => !current)}
          >
            Details
          </button>
          <button type="button">After</button>
          <Popover
            open={open}
            onOpenChange={(next) => {
              onOpenChange?.(next);
              setOpen(next);
            }}
            target={target}
          >
            <Popover.Content id="details" aria-label="Details" data-testid="content">
              <button type="button">Edit</button>
            </Popover.Content>
          </Popover>
        </>
      );
    }

    it('opens next to an element target without a trigger', async () => {
      mockLayout({
        target: { x: 400, y: 300, width: 80, height: 32 },
        content: { x: 0, y: 0, width: 256, height: 120 },
      });
      const user = userEvent.setup();
      render(<AnchoredToToggle />);
      await user.click(screen.getByRole('button', { name: 'Details' }));
      const surface = screen.getByRole('dialog', { name: 'Details' });
      await waitFor(() => expect(surface.style.transform).toBe('translate(400px, 340px)'));
    });

    it('a press on the target is no outside press: its own toggle closes the popover', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(<AnchoredToToggle onOpenChange={onOpenChange} />);
      const toggle = screen.getByRole('button', { name: 'Details' });
      await user.click(toggle);
      expect(dialog()).toBeInTheDocument();
      await user.click(toggle);
      expect(dialog()).not.toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('Tab from the target enters the content, and Escape returns focus to the target', async () => {
      const user = userEvent.setup();
      render(<AnchoredToToggle />);
      await user.click(screen.getByRole('button', { name: 'Details' }));
      await user.tab();
      expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(dialog()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus();
    });

    it('places the content at the target instead of the trigger, and moves with a new target', async () => {
      mockLayout({
        trigger: { x: 20, y: 20, width: 80, height: 32 },
        first: { x: 400, y: 300, width: 80, height: 32 },
        second: { x: 600, y: 100, width: 80, height: 32 },
        content: { x: 0, y: 0, width: 256, height: 120 },
      });
      function Switching({ which }: { which: 'first' | 'second' }) {
        const [first, setFirst] = React.useState<HTMLElement | null>(null);
        const [second, setSecond] = React.useState<HTMLElement | null>(null);
        return (
          <>
            <span data-testid="first" ref={setFirst} />
            <span data-testid="second" ref={setSecond} />
            <Popover defaultOpen target={which === 'first' ? first : second}>
              <Popover.Trigger>
                <button type="button" data-testid="trigger">
                  Toggle
                </button>
              </Popover.Trigger>
              <Popover.Content data-testid="content">Body</Popover.Content>
            </Popover>
          </>
        );
      }
      const { rerender } = render(<Switching which="first" />);
      const surface = screen.getByRole('dialog', { name: 'Toggle' });
      await waitFor(() => expect(surface.style.transform).toBe('translate(400px, 340px)'));
      rerender(<Switching which="second" />);
      await waitFor(() => expect(surface.style.transform).toBe('translate(600px, 140px)'));
    });

    it('a VirtualElement written inline positions the content at its rectangle without a render loop', async () => {
      mockLayout({ content: { x: 0, y: 0, width: 256, height: 120 } });
      // Commits of the Popover subtree: a render loop would keep adding to them.
      let commits = 0;
      function Point({ x, y }: { x: number; y: number }) {
        const rect = { x, y, width: 0, height: 0, top: y, right: x, bottom: y, left: x };
        return (
          <React.Profiler id="point" onRender={() => (commits += 1)}>
            <Popover open onOpenChange={() => {}} target={{ getBoundingClientRect: () => rect }}>
              <Popover.Content aria-label="At the point" data-testid="content">
                Body
              </Popover.Content>
            </Popover>
          </React.Profiler>
        );
      }
      const { rerender } = render(<Point x={200} y={150} />);
      const surface = screen.getByRole('dialog', { name: 'At the point' });
      await waitFor(() => expect(surface.style.transform).toBe('translate(200px, 158px)'));
      await act(async () => {});
      const settled = commits;
      rerender(<Point x={320} y={240} />);
      await waitFor(() => expect(surface.style.transform).toBe('translate(320px, 248px)'));
      await act(async () => {});
      expect(commits - settled).toBeLessThanOrEqual(4);
    });

    it('types target as PopupTarget', () => {
      expectTypeOf<PopoverProps['target']>().toEqualTypeOf<PopupTarget | undefined>();
    });
  });

  describe('server rendering', () => {
    it.each([
      ['a defaultOpen', { defaultOpen: true }],
      ['an open', { open: true }],
    ])('renders %s popover closed on the server, so every referenced id exists', (_l, props) => {
      const serverHtml = renderToString(<Basic {...props} />);
      expect(findDanglingIdRefsInHtml(serverHtml)).toEqual([]);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = serverHtml;
      const toggle = parsed.querySelector('button');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).not.toHaveAttribute('aria-controls');
    });

    it.each([
      ['defaultOpen', { defaultOpen: true }],
      ['open', { open: true }],
    ])(
      'opens once hydrated (%s), without a mismatch or an onOpenChange call',
      async (_l, props) => {
        const onOpenChange = vi.fn();
        const element = <Basic {...props} onOpenChange={onOpenChange} />;
        const container = document.createElement('div');
        container.innerHTML = renderToString(element);
        document.body.appendChild(container);
        const error = vi.spyOn(console, 'error');
        let root: ReturnType<typeof hydrateRoot> | undefined;
        try {
          await act(async () => {
            root = hydrateRoot(container, element);
          });
          expect(error).not.toHaveBeenCalled();
          const surface = screen.getByRole('dialog', { name: 'Toggle' });
          const toggle = screen.getByRole('button', { name: 'Toggle' });
          expect(toggle).toHaveAttribute('aria-expanded', 'true');
          expect(toggle).toHaveAttribute('aria-controls', surface.id);
          expect(onOpenChange).not.toHaveBeenCalled();
        } finally {
          act(() => root?.unmount());
          container.remove();
        }
      },
    );
  });

  describe('layers (overlays#1, overlays#41)', () => {
    function WithChildLayer() {
      return (
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content>
            <ChildLayer label="Nested" />
          </Popover.Content>
        </Popover>
      );
    }

    it('clicks inside a nested portaled child layer keep the popover open', async () => {
      const user = userEvent.setup();
      render(<WithChildLayer />);
      await user.click(screen.getByRole('button', { name: 'Open Nested' }));
      const nested = screen.getByRole('dialog', { name: 'Nested' });
      expect(nested.closest('[data-wave-portal]')).not.toBeNull();
      await user.click(screen.getByRole('button', { name: 'Nested action' }));
      expect(screen.getByRole('dialog', { name: 'Nested' })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Toggle' })).toBeInTheDocument();
    });

    it('Escape closes only the nested child layer, then the popover', async () => {
      const user = userEvent.setup();
      render(<WithChildLayer />);
      await user.click(screen.getByRole('button', { name: 'Open Nested' }));
      screen.getByRole('button', { name: 'Nested action' }).focus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Nested' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Toggle' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(dialog()).not.toBeInTheDocument();
    });

    it('an Escape consumed by an inner widget (preventDefault) does not close it', async () => {
      const user = userEvent.setup();
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content>
            <input
              aria-label="Search"
              onKeyDown={(e) => {
                if (e.key === 'Escape') e.preventDefault();
              }}
            />
          </Popover.Content>
        </Popover>,
      );
      screen.getByRole('textbox', { name: 'Search' }).focus();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('ignoreOutsideRefs (repo-level#29)', () => {
    function ExternalToggle({ ignore }: { ignore: boolean }) {
      const [open, setOpen] = React.useState(false);
      const toggleRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <Popover
            open={open}
            onOpenChange={setOpen}
            ignoreOutsideRefs={ignore ? [toggleRef] : undefined}
          >
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content>Body</Popover.Content>
          </Popover>
          <button type="button" ref={toggleRef} onClick={() => setOpen((o) => !o)}>
            External toggle
          </button>
        </>
      );
    }

    it.each([true, false])(
      'an external toggle opens and closes the popover in one click each (ignore=%s)',
      async (ignore) => {
        const user = userEvent.setup();
        render(<ExternalToggle ignore={ignore} />);
        const external = screen.getByRole('button', { name: 'External toggle' });
        await user.click(external);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await user.click(external);
        expect(dialog()).not.toBeInTheDocument();
        await user.click(external);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      },
    );

    it('presses on an ignored element do not dismiss the popover', async () => {
      const user = userEvent.setup();
      function Harness() {
        const toolbarRef = React.useRef<HTMLDivElement>(null);
        return (
          <>
            <Popover defaultOpen ignoreOutsideRefs={[toolbarRef]}>
              <Popover.Trigger>
                <button type="button">Toggle</button>
              </Popover.Trigger>
              <Popover.Content>Body</Popover.Content>
            </Popover>
            <div ref={toolbarRef}>
              <button type="button">Bold</button>
            </div>
            <button type="button">Outside</button>
          </>
        );
      }
      render(<Harness />);
      await user.click(screen.getByRole('button', { name: 'Bold' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(dialog()).not.toBeInTheDocument();
    });
  });

  describe('positioning (overlays#37)', () => {
    it('places the content on the requested side and exposes it as data-side', async () => {
      mockLayout({
        trigger: { x: 400, y: 300, width: 80, height: 32 },
        content: { x: 0, y: 0, width: 256, height: 120 },
      });
      render(
        <Popover defaultOpen side="top" align="center">
          <Popover.Trigger>
            <button type="button" data-testid="trigger">
              Toggle
            </button>
          </Popover.Trigger>
          <Popover.Content data-testid="content">Body</Popover.Content>
        </Popover>,
      );
      const surface = screen.getByRole('dialog');
      // data-side/data-align start as the requested placement: wait for the computed position,
      // centred above the trigger 8px away.
      // x = 400 + 80 / 2 - 256 / 2 = 312, y = 300 - 120 - 8 = 172.
      await waitFor(() => expect(surface.style.transform).toBe('translate(312px, 172px)'));
      expect(surface).toHaveAttribute('data-side', 'top');
      expect(surface).toHaveAttribute('data-align', 'center');
    });

    it('flips to the other side when the requested side collides with the viewport', async () => {
      mockLayout({
        trigger: { x: 400, y: 4, width: 80, height: 32 },
        content: { x: 0, y: 0, width: 256, height: 120 },
      });
      render(
        <Popover defaultOpen side="top">
          <Popover.Trigger>
            <button type="button" data-testid="trigger">
              Toggle
            </button>
          </Popover.Trigger>
          <Popover.Content data-testid="content">Body</Popover.Content>
        </Popover>,
      );
      await waitFor(() =>
        expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'bottom'),
      );
    });

    it('draws the beak on the edge facing the trigger', async () => {
      mockLayout({
        trigger: { x: 400, y: 300, width: 80, height: 32 },
        content: { x: 0, y: 0, width: 256, height: 120 },
      });
      render(<Basic defaultOpen />);
      const arrow = screen.getByRole('dialog').querySelector('[data-wave-popover-arrow]');
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      expect(arrow).toHaveClass('border-t', 'border-l');
    });

    it('the beak inherits the surface colors, so a className override reaches it (button-provider#3)', () => {
      render(
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content className="bg-card border-primary">Body</Popover.Content>
        </Popover>,
      );
      const surface = screen.getByRole('dialog');
      expect(surface).toHaveClass('bg-card', 'border-primary');
      const arrow = surface.querySelector('[data-wave-popover-arrow]');
      expect(arrow).toHaveClass('bg-inherit', 'border-inherit');
      expect(arrow).not.toHaveClass('bg-background');
      expect(arrow).not.toHaveClass('border-border');
    });

    it('resolves side="start" to the right in RTL and mirrors the beak (feedback-navigation#34)', async () => {
      mockLayout({
        trigger: { x: 400, y: 300, width: 80, height: 32 },
        content: { x: 0, y: 0, width: 256, height: 120 },
      });
      renderWithProviders(
        <Popover defaultOpen side="start">
          <Popover.Trigger>
            <button type="button" data-testid="trigger">
              Toggle
            </button>
          </Popover.Trigger>
          <Popover.Content data-testid="content">Body</Popover.Content>
        </Popover>,
        { dir: 'rtl' },
      );
      const surface = screen.getByRole('dialog');
      await waitFor(() => expect(surface).toHaveAttribute('data-side', 'right'));
      expect(surface.closest('[data-wave-portal]')).toHaveAttribute('dir', 'rtl');
      expect(surface.querySelector('[data-wave-popover-arrow]')).toHaveClass(
        'border-b',
        'border-l',
      );
    });
  });

  describe('styles', () => {
    it('resets inherited typography and uses theme tokens (overlays#38, repo-level#7)', () => {
      render(<Basic defaultOpen />);
      const surface = screen.getByRole('dialog');
      expect(surface).toHaveClass(
        'bg-background',
        'text-foreground',
        'border-border',
        'rounded-md',
        'normal-case',
        'tracking-normal',
        'font-normal',
        'text-start',
      );
      expect(surface).not.toHaveClass('rounded-lg');
    });
  });

  describe('context guard (overlays#34)', () => {
    it.each([
      ['Popover.Content', () => <Popover.Content>Body</Popover.Content>],
      [
        'Popover.Trigger',
        () => (
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
        ),
      ],
    ])('%s outside Popover throws in development', (name, Misplaced) => {
      expectThrows(<Misplaced />, `[WaveUI] ${name} must be used within Popover`);
    });

    describe('in production', () => {
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('logs the missing Popover once and renders the parts inert (C-CONTEXT)', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = userEvent.setup();
        const { rerender } = render(
          <>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content>Body</Popover.Content>
          </>,
        );
        rerender(
          <>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content>Body</Popover.Content>
            <Popover.Content>Second</Popover.Content>
          </>,
        );
        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        expect(dialog()).not.toBeInTheDocument();
        expect(error.mock.calls).toEqual([
          ['[WaveUI] Popover.Trigger must be used within Popover'],
          ['[WaveUI] Popover.Content must be used within Popover'],
        ]);
      });
    });
  });

  describe('stable listeners (table-core#23, table-core#25)', () => {
    it('does not re-register document listeners when the parent re-renders', async () => {
      function Parent({ tick }: { tick: number }) {
        return (
          <Popover defaultOpen onOpenChange={() => void tick}>
            <Popover.Trigger>
              <button type="button">Toggle</button>
            </Popover.Trigger>
            <Popover.Content>{`Body ${tick}`}</Popover.Content>
          </Popover>
        );
      }
      const { rerender } = render(<Parent tick={0} />);
      await act(async () => {});
      const add = vi.spyOn(document, 'addEventListener');
      const remove = vi.spyOn(document, 'removeEventListener');
      for (let tick = 1; tick <= 3; tick++) rerender(<Parent tick={tick} />);
      await act(async () => {});
      expect(screen.getByRole('dialog')).toHaveTextContent('Body 3');
      expect(add).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      'a memoized context consumer does not re-render when the root re-renders with unchanged state (open=%s)',
      async (open) => {
        const renderTriggerElement = vi.fn((props: PopoverTriggerChildProps) => (
          <button type="button" {...props}>
            Toggle
          </button>
        ));
        const MemoTrigger = React.memo(function MemoTrigger() {
          return <Popover.Trigger>{renderTriggerElement}</Popover.Trigger>;
        });
        function Parent({ tick }: { tick: number }) {
          return (
            <Popover defaultOpen={open} onOpenChange={() => void tick}>
              <MemoTrigger />
              <Popover.Content>{`Body ${tick}`}</Popover.Content>
            </Popover>
          );
        }
        const { rerender } = render(<Parent tick={0} />);
        await act(async () => {});
        const rendersBefore = renderTriggerElement.mock.calls.length;
        for (let tick = 1; tick <= 3; tick++) rerender(<Parent tick={tick} />);
        await act(async () => {});
        expect(renderTriggerElement).toHaveBeenCalledTimes(rendersBefore);
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
          'aria-expanded',
          String(open),
        );
      },
    );
  });
});
