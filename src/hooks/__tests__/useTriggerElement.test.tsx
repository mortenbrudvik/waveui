import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { getTriggerFocusTarget, getTriggerTarget, useTriggerElement } from '../useTriggerElement';
import { __resetWarnings } from '../../lib/dev';
import { mergeRefs } from '../../lib/mergeRefs';
import { expectNoA11yViolations } from '../../test-utils';

interface TestTriggerProps {
  id: string;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  onClick: (event: React.MouseEvent) => void;
  ref?: React.Ref<HTMLElement>;
}

function Trigger({
  children,
  open = false,
  onToggle = () => {},
  triggerRef,
  asChild,
  onResolvedId,
  extraProps,
}: {
  children: React.ReactElement | ((props: TestTriggerProps) => React.ReactNode) | React.ReactNode;
  open?: boolean;
  onToggle?: (event: React.MouseEvent) => void;
  triggerRef?: React.Ref<HTMLElement>;
  asChild?: boolean;
  onResolvedId?: (id: string) => void;
  /** Props a consumer passes to the trigger (`role`, `tabIndex`, …), merged into the trigger props. */
  extraProps?: Record<string, unknown>;
}) {
  const triggerProps: TestTriggerProps = {
    ...extraProps,
    id: 'generated-trigger',
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? 'panel' : undefined,
    onClick: onToggle,
    ref: triggerRef,
  };
  return (
    <>
      {useTriggerElement(children, triggerProps, {
        componentName: 'Test.Trigger',
        asChild,
        onResolvedId,
      })}
    </>
  );
}

/** Stateful harness: clicking the trigger toggles `open`. */
function Harness({
  children,
  asChild,
  onResolvedId,
  triggerRef,
  extraProps,
}: {
  children: React.ReactElement | ((props: TestTriggerProps) => React.ReactNode) | React.ReactNode;
  asChild?: boolean;
  onResolvedId?: (id: string) => void;
  triggerRef?: React.Ref<HTMLElement>;
  extraProps?: Record<string, unknown>;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Trigger
        open={open}
        onToggle={() => setOpen((o) => !o)}
        asChild={asChild}
        onResolvedId={onResolvedId}
        triggerRef={triggerRef}
        extraProps={extraProps}
      >
        {children}
      </Trigger>
      {open && <div id="panel">Panel</div>}
    </>
  );
}

/** A custom component that neither forwards `ref` nor spreads props (0.4-style children). */
function NonForwarding({ label }: { label: string }) {
  return <button type="button">{label}</button>;
}

/** A React 19 component that forwards `ref` and spreads props. */
function Forwarding({ ref, ...props }: React.ComponentProps<'button'>) {
  return <button type="button" ref={ref} {...props} />;
}

describe('useTriggerElement', () => {
  // Warnings are silenced, and a test that expects some takes them (takeWarnings): the afterEach
  // allows no other.
  let warnSpy: ReturnType<typeof vi.spyOn>;

  /** The warnings logged so far, removed from the spy (the test asserts them). */
  function takeWarnings(): unknown[] {
    const messages = warnSpy.mock.calls.map((call: unknown[]) => call[0]);
    warnSpy.mockClear();
    return messages;
  }

  const FALLBACK_WARNING =
    '[WaveUI] Test.Trigger: its child did not attach the trigger ref (a component that neither forwards `ref` nor spreads its props). It is rendered inside a <span> wrapper instead; forward `ref` and spread props onto the element, or pass asChild={false}.';

  beforeEach(() => {
    __resetWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    try {
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      __resetWarnings();
    }
  });

  describe('single element child (asChild by default)', () => {
    it('merges the trigger props onto the child without a wrapper', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Harness>
          <button type="button">Open</button>
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button.parentElement).toBe(container);
      expect(container.querySelector('span')).toBeNull();
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      expect(button).toHaveAttribute('id', 'generated-trigger');

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'panel');
      expect(screen.getByText('Panel')).toBeInTheDocument();
    });

    it("lets live state ARIA win over the child's static attributes", async () => {
      const user = userEvent.setup();
      render(
        <Harness>
          <button type="button" aria-expanded="true" aria-controls="stale" aria-haspopup="menu">
            Open
          </button>
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      await user.click(button);
      expect(button).toHaveAttribute('aria-controls', 'panel');
    });

    it("composes the child's handler (child first; preventDefault skips the trigger)", async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      const onToggle = vi.fn(() => order.push('trigger'));
      const { rerender } = render(
        <Trigger onToggle={onToggle}>
          <button type="button" onClick={() => order.push('child')}>
            Open
          </button>
        </Trigger>,
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(order).toEqual(['child', 'trigger']);

      rerender(
        <Trigger onToggle={onToggle}>
          <button type="button" onClick={(e) => e.preventDefault()}>
            Open
          </button>
        </Trigger>,
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('merges className and style', () => {
      function Styled() {
        return (
          <>
            {useTriggerElement(
              <button type="button" className="child-class" style={{ color: 'red' }}>
                Open
              </button>,
              { className: 'trigger-class', style: { margin: 1 } },
              { componentName: 'Test.Trigger' },
            )}
          </>
        );
      }
      render(<Styled />);
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveClass('trigger-class', 'child-class');
      expect(button.style.color).toBe('red');
      expect(button.style.margin).toBe('1px');
    });

    it("keeps the child's own id and reports it", () => {
      const onResolvedId = vi.fn();
      render(
        <Harness onResolvedId={onResolvedId}>
          <button type="button" id="my-trigger">
            Open
          </button>
        </Harness>,
      );
      expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('id', 'my-trigger');
      expect(onResolvedId).toHaveBeenLastCalledWith('my-trigger');
    });

    it('reports the generated id when the child has none', () => {
      const onResolvedId = vi.fn();
      render(
        <Harness onResolvedId={onResolvedId}>
          <button type="button">Open</button>
        </Harness>,
      );
      expect(onResolvedId).toHaveBeenLastCalledWith('generated-trigger');
    });

    it("passes the node to the trigger ref and the child's own ref", () => {
      const triggerRef = React.createRef<HTMLElement>();
      const childRef = React.createRef<HTMLButtonElement>();
      render(
        <Harness triggerRef={triggerRef}>
          <button type="button" ref={childRef}>
            Open
          </button>
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(triggerRef.current).toBe(button);
      expect(childRef.current).toBe(button);
    });

    it('attaches the merged ref once across rerenders (no detach/attach per render)', async () => {
      const user = userEvent.setup();
      const triggerRef = vi.fn();
      const childRef = vi.fn();
      function Stable() {
        const [open, setOpen] = React.useState(false);
        return (
          <Trigger open={open} onToggle={() => setOpen((o) => !o)} triggerRef={triggerRef}>
            <button type="button" ref={childRef}>
              Open
            </button>
          </Trigger>
        );
      }
      render(<Stable />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(triggerRef).toHaveBeenCalledTimes(1);
      expect(childRef).toHaveBeenCalledTimes(1);
    });

    it('accepts an inline triggerProps.ref: renders, re-renders and re-attaches once per ref change', async () => {
      const user = userEvent.setup();
      const anchorCalls: Array<Element | null> = [];
      const childRef = vi.fn();
      function InlineRefTrigger() {
        const [open, setOpen] = React.useState(false);
        // A new callback on every render, as a trigger building `triggerProps` inline would pass.
        const triggerProps: TestTriggerProps = {
          id: 'generated-trigger',
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-controls': undefined,
          onClick: () => setOpen((o) => !o),
          ref: (el: HTMLElement | null) => {
            anchorCalls.push(el);
          },
        };
        return (
          <>
            {useTriggerElement(
              <button type="button" ref={childRef}>
                Open
              </button>,
              triggerProps,
              { componentName: 'Test.Trigger' },
            )}
          </>
        );
      }
      render(<InlineRefTrigger />);
      const button = screen.getByRole('button', { name: 'Open' });
      await user.click(button);
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'false');
      // Three commits: attached once, then detached and re-attached once per new ref.
      expect(anchorCalls).toEqual([button, null, button, null, button]);
      // The child's own (stable) ref is attached once.
      expect(childRef).toHaveBeenCalledTimes(1);
      expect(button.parentElement?.localName).not.toBe('span');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('accepts a fresh mergeRefs(contextRef, setState) triggerProps.ref (no render loop)', () => {
      const contextRef = React.createRef<HTMLElement>();
      function StateRefTrigger() {
        const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
        const triggerProps: TestTriggerProps = {
          id: 'generated-trigger',
          'aria-haspopup': 'dialog',
          'aria-expanded': false,
          'aria-controls': undefined,
          onClick: () => {},
          // The shape a Menu/Popover trigger would build: `mergeRefs(ctx.triggerRef, setReference)`.
          ref: mergeRefs<HTMLElement>(contextRef, setAnchor),
        };
        return (
          <>
            {useTriggerElement(<button type="button">Open</button>, triggerProps, {
              componentName: 'Test.Trigger',
            })}
            <output>{anchor ? `anchor ${anchor.id}` : 'no anchor'}</output>
          </>
        );
      }
      expect(() => render(<StateRefTrigger />)).not.toThrow();
      expect(screen.getByRole('status')).toHaveTextContent('anchor generated-trigger');
      expect(contextRef.current).toBe(screen.getByRole('button', { name: 'Open' }));
    });

    it('works with a component that forwards ref and spreads props', async () => {
      const user = userEvent.setup();
      const triggerRef = React.createRef<HTMLElement>();
      const { container } = render(
        <Harness triggerRef={triggerRef}>
          <Forwarding>Open</Forwarding>
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button.parentElement).toBe(container);
      expect(triggerRef.current).toBe(button);
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not fall back under StrictMode for a forwarding child', () => {
      const { container } = render(
        <React.StrictMode>
          <Harness>
            <button type="button">Open</button>
          </Harness>
        </React.StrictMode>,
      );
      expect(container.querySelector('span')).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('automatic wrapper fallback', () => {
    it('wraps a child that never attaches its ref in a span that still opens, and warns once', async () => {
      const user = userEvent.setup();
      const triggerRef = React.createRef<HTMLElement>();
      const { container, rerender } = render(
        <Harness triggerRef={triggerRef}>
          <NonForwarding label="Fancy" />
        </Harness>,
      );
      const wrapper = container.querySelector('span');
      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveAttribute('id', 'generated-trigger');
      expect(triggerRef.current).toBe(wrapper);

      await user.click(screen.getByRole('button', { name: 'Fancy' }));
      expect(screen.getByText('Panel')).toBeInTheDocument();

      rerender(
        <Harness triggerRef={triggerRef}>
          <NonForwarding label="Fancy" />
        </Harness>,
      );
      expect(takeWarnings()).toEqual([FALLBACK_WARNING]);
    });

    it('moves the state ARIA from the generic span onto the button inside it', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Harness>
          <NonForwarding label="Fancy" />
        </Harness>,
      );
      const wrapper = container.querySelector('span')!;
      const button = screen.getByRole('button', { name: 'Fancy' });
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(wrapper).not.toHaveAttribute(name);
      }
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      await expectNoA11yViolations(container);

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'panel');
      expect(wrapper).not.toHaveAttribute('aria-expanded');
      await expectNoA11yViolations(container);

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      // The child does not forward its ref: the automatic fallback warns.
      expect(takeWarnings()).toEqual([FALLBACK_WARNING]);
    });

    it("lets the live state win over the inner element's own attributes", async () => {
      const user = userEvent.setup();
      function StaleAria() {
        return (
          <button type="button" aria-expanded="true" aria-controls="stale" aria-haspopup="menu">
            Fancy
          </button>
        );
      }
      render(
        <Harness>
          <StaleAria />
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Fancy' });
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      await user.click(button);
      expect(button).toHaveAttribute('aria-controls', 'panel');
      // The child does not forward its ref: the automatic fallback warns.
      expect(takeWarnings()).toEqual([FALLBACK_WARNING]);
    });

    it('follows the first tabbable element and restores the one it leaves', () => {
      function Pair({ firstTabbable }: { firstTabbable: boolean }) {
        return (
          <>
            <button type="button" tabIndex={firstTabbable ? 0 : -1} aria-expanded="true">
              One
            </button>
            <button type="button">Two</button>
          </>
        );
      }
      const { rerender } = render(
        <Trigger>
          <Pair firstTabbable />
        </Trigger>,
      );
      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });
      expect(one).toHaveAttribute('aria-expanded', 'false');
      expect(one).toHaveAttribute('aria-haspopup', 'dialog');
      expect(two).not.toHaveAttribute('aria-haspopup');

      rerender(
        <Trigger>
          <Pair firstTabbable={false} />
        </Trigger>,
      );
      expect(two).toHaveAttribute('aria-haspopup', 'dialog');
      expect(two).toHaveAttribute('aria-expanded', 'false');
      // The element left behind gets its own attributes back.
      expect(one).not.toHaveAttribute('aria-haspopup');
      expect(one).toHaveAttribute('aria-expanded', 'true');
      // The child does not forward its ref: the automatic fallback warns.
      expect(takeWarnings()).toEqual([FALLBACK_WARNING]);
    });

    it('keeps the state on the inner button while the page around it is inert (open modal)', () => {
      render(
        <div inert>
          <Trigger open>
            <NonForwarding label="Fancy" />
          </Trigger>
        </div>,
      );
      const button = screen.getByText('Fancy');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'panel');
      // The child does not forward its ref: the automatic fallback warns.
      expect(takeWarnings()).toEqual([FALLBACK_WARNING]);
    });

    it('drops the state ARIA when the child renders nothing tabbable', async () => {
      function Plain() {
        return <b>Fancy</b>;
      }
      const { container } = render(
        <Harness>
          <Plain />
        </Harness>,
      );
      const wrapper = container.querySelector('span')!;
      expect(wrapper).toContainElement(screen.getByText('Fancy'));
      expect(container.querySelector('[aria-expanded], [aria-haspopup]')).toBeNull();
      await expectNoA11yViolations(container);
      // The child does not forward its ref: the automatic fallback warns.
      expect(takeWarnings()).toEqual([FALLBACK_WARNING]);
    });
  });

  describe('asChild={false}', () => {
    it('renders the 0.4 wrapper span carrying the trigger props', async () => {
      const user = userEvent.setup();
      const triggerRef = React.createRef<HTMLElement>();
      const { container } = render(
        <Harness asChild={false} triggerRef={triggerRef}>
          <button type="button">Open</button>
        </Harness>,
      );
      const wrapper = container.querySelector('span')!;
      const button = screen.getByRole('button', { name: 'Open' });
      expect(wrapper).toContainElement(button);
      expect(wrapper).toHaveAttribute('id', 'generated-trigger');
      expect(button).not.toHaveAttribute('id');
      expect(triggerRef.current).toBe(wrapper);
      await user.click(button);
      expect(screen.getByText('Panel')).toBeInTheDocument();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('moves the state ARIA from the generic span onto the element inside it, like the automatic fallback', async () => {
      const user = userEvent.setup();
      const { container, unmount } = render(
        <Harness asChild={false}>
          <button type="button" aria-haspopup="menu">
            Open
          </button>
        </Harness>,
      );
      const wrapper = container.querySelector('span')!;
      const button = screen.getByRole('button', { name: 'Open' });
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(wrapper).not.toHaveAttribute(name);
      }
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      await expectNoA11yViolations(container);

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'panel');
      expect(wrapper).not.toHaveAttribute('aria-expanded');
      await expectNoA11yViolations(container);

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');

      // The cleanup gives the element its own attributes back.
      const detached = button;
      unmount();
      expect(detached).toHaveAttribute('aria-haspopup', 'menu');
      expect(detached).not.toHaveAttribute('aria-expanded');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('drops the state ARIA around text, without a warning', async () => {
      const { container } = render(<Harness asChild={false}>Open</Harness>);
      const wrapper = container.querySelector('span')!;
      expect(wrapper).toHaveTextContent('Open');
      expect(wrapper).toHaveAttribute('id', 'generated-trigger');
      expect(container.querySelector('[aria-expanded], [aria-haspopup]')).toBeNull();
      await expectNoA11yViolations(container);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['text', 'Actions'],
      ['a non-focusable element', <b key="b">Actions</b>],
    ])(
      'keeps the state ARIA on a span the consumer made the trigger (role and tabIndex) around %s',
      async (_label, children) => {
        const user = userEvent.setup();
        const { container } = render(
          <Harness asChild={false} extraProps={{ role: 'button', tabIndex: 0 }}>
            {children}
          </Harness>,
        );
        const span = screen.getByRole('button', { name: 'Actions' });
        expect(span.localName).toBe('span');
        expect(span).toHaveAttribute('aria-haspopup', 'dialog');
        expect(span).toHaveAttribute('aria-expanded', 'false');
        await expectNoA11yViolations(container);
        await user.click(span);
        expect(span).toHaveAttribute('aria-expanded', 'true');
        expect(span).toHaveAttribute('aria-controls', 'panel');
        await expectNoA11yViolations(container);
        expect(warnSpy).not.toHaveBeenCalled();
      },
    );

    it('moves the state ARIA inside a span given only tabIndex={0}: a generic span cannot carry it (axe)', async () => {
      const { container, unmount } = render(
        <Trigger asChild={false} open extraProps={{ tabIndex: 0 }}>
          <button type="button">Open</button>
        </Trigger>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'panel');
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(button.parentElement).not.toHaveAttribute(name);
      }
      await expectNoA11yViolations(container);
      unmount();

      // Around text there is no element to take it: it is dropped.
      const text = render(
        <Trigger asChild={false} open extraProps={{ tabIndex: 0 }}>
          Actions
        </Trigger>,
      );
      expect(screen.getByText('Actions')).toHaveAttribute('tabindex', '0');
      expect(text.container.querySelector('[aria-expanded], [aria-haspopup]')).toBeNull();
      await expectNoA11yViolations(text.container);
    });

    it('gives the state ARIA to a span given only a widget role unless an element inside it is in the tab order', () => {
      const { unmount } = render(
        <Trigger asChild={false} open extraProps={{ role: 'button' }}>
          Actions
        </Trigger>,
      );
      const span = screen.getByRole('button', { name: 'Actions' });
      expect(span).toHaveAttribute('aria-haspopup', 'dialog');
      expect(span).toHaveAttribute('aria-controls', 'panel');
      unmount();

      const { container } = render(
        <Trigger asChild={false} open extraProps={{ role: 'button' }}>
          <button type="button">Open</button>
        </Trigger>,
      );
      const wrapper = container.querySelector('span')!;
      const button = container.querySelector('button')!;
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'panel');
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(wrapper).not.toHaveAttribute(name);
      }
    });

    it('still moves the state ARIA inside a span given a generic role or tabIndex={-1}', () => {
      render(
        <Trigger asChild={false} open extraProps={{ role: 'presentation', tabIndex: -1 }}>
          <button type="button">Open</button>
        </Trigger>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button.parentElement).not.toHaveAttribute('aria-expanded');
    });

    it('gives a render-prop child every prop, the state ARIA included', () => {
      render(
        <Harness asChild={false}>
          {({ ref, ...props }: TestTriggerProps) => (
            <button type="button" ref={ref as React.Ref<HTMLButtonElement>} {...props}>
              Open
            </button>
          )}
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveAttribute('id', 'generated-trigger');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('render-prop children', () => {
    it('calls the function with the trigger props', async () => {
      const user = userEvent.setup();
      const onResolvedId = vi.fn();
      render(
        <Harness onResolvedId={onResolvedId}>
          {({ ref, ...props }: TestTriggerProps) => (
            <button type="button" ref={ref as React.Ref<HTMLButtonElement>} {...props}>
              Open
            </button>
          )}
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(onResolvedId).toHaveBeenLastCalledWith('generated-trigger');
    });
  });

  describe('non-element children', () => {
    const WRAPPED_WARNING =
      '[WaveUI] Test.Trigger: expected a single React element child (not text, a Fragment or several elements); the children are rendered inside a <span> wrapper instead.';

    it('wraps text in a span that carries no state ARIA, and warns', async () => {
      const { container } = render(<Harness>Open</Harness>);
      const wrapper = container.querySelector('span')!;
      expect(wrapper).toHaveTextContent('Open');
      expect(wrapper).toHaveAttribute('id', 'generated-trigger');
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(wrapper).not.toHaveAttribute(name);
      }
      await expectNoA11yViolations(container);
      expect(takeWarnings()).toEqual([WRAPPED_WARNING]);
    });

    it('keeps the state ARIA on the wrapper of text the consumer made the trigger, and warns', async () => {
      const user = userEvent.setup();
      render(<Harness extraProps={{ role: 'button', tabIndex: 0 }}>Filters</Harness>);
      const span = screen.getByRole('button', { name: 'Filters' });
      expect(span).toHaveAttribute('id', 'generated-trigger');
      expect(span).toHaveAttribute('aria-haspopup', 'dialog');
      await user.click(span);
      expect(span).toHaveAttribute('aria-expanded', 'true');
      expect(document.querySelectorAll('[aria-expanded]')).toHaveLength(1);
      expect(takeWarnings()).toEqual([WRAPPED_WARNING]);
    });

    it('clones the element of a single-element Fragment, without a wrapper or a warning', async () => {
      const user = userEvent.setup();
      const triggerRef = React.createRef<HTMLElement>();
      const { container } = render(
        <Harness triggerRef={triggerRef}>
          <>
            <button type="button">Open</button>
          </>
        </Harness>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(container.querySelector('span')).toBeNull();
      expect(button).toHaveAttribute('id', 'generated-trigger');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(triggerRef.current).toBe(button);
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'panel');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('moves the state ARIA of several children onto the first tabbable one, and warns', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Harness>
          <>
            <button type="button">Open</button>
            <button type="button">Other</button>
          </>
        </Harness>,
      );
      const wrapper = container.querySelector('span')!;
      const open = screen.getByRole('button', { name: 'Open' });
      const other = screen.getByRole('button', { name: 'Other' });
      expect(wrapper).toHaveAttribute('id', 'generated-trigger');
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(wrapper).not.toHaveAttribute(name);
        expect(other).not.toHaveAttribute(name);
      }
      expect(open).toHaveAttribute('aria-haspopup', 'dialog');
      expect(open).toHaveAttribute('aria-expanded', 'false');
      await expectNoA11yViolations(container);

      await user.click(open);
      expect(open).toHaveAttribute('aria-expanded', 'true');
      expect(open).toHaveAttribute('aria-controls', 'panel');
      expect(wrapper).not.toHaveAttribute('aria-expanded');
      await expectNoA11yViolations(container);
      expect(takeWarnings()).toEqual([WRAPPED_WARNING]);
    });
  });
});

/** Adds `html` to the document and returns its first element (removed after each test). */
function host(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.append(div);
  return div.firstElementChild as HTMLElement;
}

describe('getTriggerTarget', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is the element itself when it is a widget in the tab order: a native control or a widget role', () => {
    const button = host('<button type="button">Open</button>');
    expect(getTriggerTarget(button)).toBe(button);
    const link = host('<a href="#x">Open</a>');
    expect(getTriggerTarget(link)).toBe(link);
    const widgetSpan = host(
      '<span role="button" tabindex="0"><button type="button">Inner</button></span>',
    );
    expect(getTriggerTarget(widgetSpan)).toBe(widgetSpan);
  });

  it('never is a generic element: tabIndex alone does not make a span the trigger', () => {
    const focusableSpan = host('<span tabindex="0"><button type="button">Inner</button></span>');
    expect(getTriggerTarget(focusableSpan)).toBe(focusableSpan.querySelector('button'));
    expect(getTriggerTarget(host('<span tabindex="0">Text</span>'))).toBeNull();
    expect(getTriggerTarget(host('<div tabindex="0">Text</div>'))).toBeNull();
  });

  it('prefers an element inside in the tab order to a widget role out of the tab order', () => {
    const roleSpan = host('<span role="button"><button type="button">Inner</button></span>');
    expect(getTriggerTarget(roleSpan)).toBe(roleSpan.querySelector('button'));
    const textRoleSpan = host('<span role="button">Open</span>');
    expect(getTriggerTarget(textRoleSpan)).toBe(textRoleSpan);
    const outOfOrder = host('<button type="button" tabindex="-1">Open</button>');
    expect(getTriggerTarget(outOfOrder)).toBe(outOfOrder);
  });

  it('is the first element inside in the tab order for a generic wrapper, else null', () => {
    const wrapper = host(
      '<span role="presentation"><input type="hidden" /><button type="button" tabindex="-1">Skipped</button><a href="#x">Link</a></span>',
    );
    expect(getTriggerTarget(wrapper)).toBe(wrapper.querySelector('a'));
    expect(getTriggerTarget(host('<span><b>Text</b></span>'))).toBeNull();
  });

  it('reads the markup, so an inert page (an open modal) does not change it', () => {
    const wrapper = host('<span inert><button type="button">Open</button></span>');
    expect(getTriggerTarget(wrapper)).toBe(wrapper.querySelector('button'));
  });
});

describe('getTriggerFocusTarget', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is the element getTriggerTarget names: the span out of the tab order gives way to its button', () => {
    const wrapper = host('<span tabindex="-1"><button type="button">Open</button></span>');
    expect(getTriggerFocusTarget(wrapper)).toBe(wrapper.querySelector('button'));
    const trigger = host(
      '<span role="button" tabindex="0"><button type="button">Inner</button></span>',
    );
    expect(getTriggerFocusTarget(trigger)).toBe(trigger);
    const button = host('<button type="button">Open</button>');
    expect(getTriggerFocusTarget(button)).toBe(button);
  });

  it('falls back to the first tabbable element inside, then to the element itself when it can take focus', () => {
    const roleOnly = host(
      '<span role="button"><button type="button" tabindex="-1">Skipped</button><a href="#x">Link</a></span>',
    );
    expect(getTriggerFocusTarget(roleOnly)).toBe(roleOnly.querySelector('a'));
    const textSpan = host('<span tabindex="-1">Text</span>');
    expect(getTriggerFocusTarget(textSpan)).toBe(textSpan);
    const outOfOrder = host('<button type="button" tabindex="-1">Open</button>');
    expect(getTriggerFocusTarget(outOfOrder)).toBe(outOfOrder);
    expect(getTriggerFocusTarget(host('<span>Text</span>'))).toBeNull();
    expect(getTriggerFocusTarget(host('<button type="button" disabled>Off</button>'))).toBeNull();
    expect(getTriggerFocusTarget(null)).toBeNull();
  });
});
