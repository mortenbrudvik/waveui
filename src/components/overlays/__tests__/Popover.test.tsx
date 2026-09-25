import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverContent, PopoverTrigger, type PopoverTriggerChildProps } from '../Popover';
import { Dialog } from '../Dialog';
import { Tooltip } from '../Tooltip';
import { Button } from '../../button/Button';
import { Portal } from '../../portal/Portal';
import { useDismiss } from '../../../hooks/useDismiss';
import {
  createOverlayTestWrapper,
  expectNoA11yViolations,
  renderWithProviders,
  testCompoundExposure,
  testDisplayName,
  testSystemProps,
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

    it('a render-prop child receives onKeyDown, declared like onClick and ref (overlays-anchored-docs-3)', async () => {
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
              <Tooltip content="Narrow the list" delay={0}>
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

    describe('a trigger named through aria-labelledby (overlays-anchored-code-1)', () => {
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
       * that the child did not attach the trigger ref (overlays-anchored-tests-5).
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
        'Tab past the last element continues after the span, not back to its button (%s, overlays-anchored-tests-2)',
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

    it.each([
      ['Tab', false, ['After']],
      ['Shift+Tab', true, ['First', 'Toggle', 'Before']],
    ] as const)(
      'a click on the last element with nothing focused keeps the order after the trigger: %s (R1-1)',
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

    it('a click on the content where nothing takes focus, then on its last element, keeps the order after the trigger (R1-1)', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      await user.click(screen.getByRole('button', { name: 'First' }));
      // The surface itself takes no focus: a press on it moves focus to the body.
      await user.click(screen.getByRole('dialog', { name: 'Options' }));
      expect(document.body).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Last' }));
      expect(await tabs(user, 1)).toEqual(['After']);
    });

    it('a press inside the content, then Shift+Tab from the pressed point onto its last element, keeps the order after the trigger (R1-1)', async () => {
      const user = userEvent.setup();
      render(<TabOrder />);
      // A press below the last button: focus moves to the body, and the browser starts sequential
      // navigation at the pressed point, so Shift+Tab lands on the last button, from nothing.
      await user.click(screen.getByRole('dialog', { name: 'Options' }));
      expect(document.body).toHaveFocus();
      expect(await tabs(user, 3, true)).toEqual(['Last', 'First', 'Toggle']);
    });

    it('focus that returns to the last element as the window gets focus back keeps its order (R1-1)', async () => {
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
      // centred above the trigger 8px away (overlays-anchored-tests-4).
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
      const error = vi.spyOn(console, 'error');
      expect(() => render(<Misplaced />)).toThrow(
        new Error(`[WaveUI] ${name} must be used within Popover`),
      );
      // Thrown, not logged: the guard reports through the error only.
      expect(error).not.toHaveBeenCalled();
    });

    describe('in production', () => {
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('logs the missing Popover once and renders the parts inert (R3)', async () => {
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
