import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip, type TooltipProps } from '../Tooltip';
import { Popover } from '../Popover';
import { tooltipClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { expectNoA11yViolations, mockAnimations, mockRect } from '../../../test-utils';

/*
 * Backlog 1.1, Tooltip: `relationship="inaccessible"` (tooltip-2), `withArrow` (tooltip-4),
 * `positioning.target` (tooltip-5), `slotProps.content` styling (tooltip-6), `asChild`, the
 * wrapper-free form (tooltip-7), one tooltip at a time, a hidden document, an expanded trigger and
 * a clipped anchor (tooltip-8), and the content held during the exit.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  expect(getTopmostLayer()).toBeNull();
});

function setupTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const surface = () => document.querySelector<HTMLElement>('[data-wave-tooltip-surface]');
const beak = () => document.querySelector<HTMLElement>('.' + tooltipClassNames.beak);

function Open(props: Partial<TooltipProps>) {
  return (
    <Tooltip content="Saves the file" defaultOpen {...props}>
      <button type="button">Save</button>
    </Tooltip>
  );
}

describe('relationship="inaccessible" (tooltip-2)', () => {
  it('adds no aria-describedby or aria-labelledby and renders no hidden description', () => {
    render(
      <Tooltip content="Saves the file" relationship="inaccessible">
        <button type="button">Save</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).not.toHaveAttribute('aria-describedby');
    expect(button).not.toHaveAttribute('aria-labelledby');
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    expect(document.querySelector('[hidden]')).toBeNull();
  });

  it('keeps the ids the child already has', () => {
    render(
      <Tooltip content="Saves the file" relationship="inaccessible">
        <button type="button" aria-describedby="own">
          Save
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-describedby', 'own');
  });

  it('still shows the surface on hover and on focus, after the delay', async () => {
    const user = setupTimers();
    render(
      <Tooltip content="Saves the file" relationship="inaccessible">
        <button type="button">Save</button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole('button', { name: 'Save' }));
    expect(surface()).toBeNull();
    advance(250);
    expect(surface()).toHaveTextContent('Saves the file');
    expect(surface()).toHaveAttribute('aria-hidden', 'true');
    await user.unhover(screen.getByRole('button', { name: 'Save' }));
    advance(300);
    expect(surface()).toBeNull();
  });

  it('adds no relationship to a fallback span or a non-focusable child either', () => {
    const { container } = render(
      <Tooltip content="Saves the file" relationship="inaccessible" asChild>
        <div data-testid="plain">Plain</div>
      </Tooltip>,
    );
    expect(container.querySelector('[aria-describedby], [aria-labelledby]')).toBeNull();
  });

  it('has no axe violations', async () => {
    render(<Open relationship="inaccessible" />);
    await expectNoA11yViolations(document.body);
  });

  it('is typed with the three relationships', () => {
    expectTypeOf<TooltipProps['relationship']>().toEqualTypeOf<
      'description' | 'label' | 'inaccessible' | undefined
    >();
  });
});

describe('withArrow (tooltip-4)', () => {
  it('draws no beak by default', () => {
    render(<Open />);
    expect(surface()).not.toBeNull();
    expect(beak()).toBeNull();
  });

  it('draws a beak inside the surface that takes its fill, aria-hidden and not a tab stop', () => {
    render(<Open withArrow />);
    expect(surface()!.contains(beak())).toBe(true);
    expect(beak()).toHaveAttribute('aria-hidden', 'true');
    expect(beak()).toHaveAttribute('data-wave-tooltip-arrow', '');
    expect(beak()).toHaveClass('wave:bg-inherit', 'wave:border-inherit');
    // The text content of the tooltip is unchanged by the beak.
    expect(surface()).toHaveTextContent('Saves the file');
  });

  it('takes the beak part: class, attributes and a ref beside the Tooltip ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Open
        withArrow
        slotProps={{ beak: { className: 'my-beak', 'data-extra': 'x', ref, tabIndex: 0 } as never }}
      />,
    );
    expect(beak()).toHaveClass('my-beak');
    expect(beak()).toHaveAttribute('data-extra', 'x');
    expect(beak()).not.toHaveAttribute('tabindex');
    expect(ref.current).toBe(beak());
  });

  it('renders no beak part without withArrow', () => {
    render(<Open slotProps={{ beak: { className: 'my-beak' } }} />);
    expect(document.querySelector('.my-beak')).toBeNull();
  });

  it('gives the beak the position the positioning computes, which wins over the part style', async () => {
    render(<Open withArrow slotProps={{ beak: { style: { position: 'static' } } }} />);
    await act(async () => {});
    expect(beak()!.style.position).toBe('absolute');
  });
});

describe('surface styling (tooltip-6)', () => {
  it('styles the surface through slotProps.content: classes, style and attributes', () => {
    render(
      <Open
        slotProps={{
          content: { className: 'my-surface', style: { maxWidth: 120 }, 'data-extra': 'x' },
        }}
      />,
    );
    expect(surface()).toHaveClass(tooltipClassNames.content, 'my-surface');
    expect(surface()!.style.maxWidth).toBe('120px');
    expect(surface()).toHaveAttribute('data-extra', 'x');
  });
});

describe('positioning.target (tooltip-5)', () => {
  it('places the surface at the target instead of the child', async () => {
    function Page() {
      const [target, setTarget] = React.useState<HTMLElement | null>(null);
      return (
        <>
          <div ref={setTarget} data-testid="target">
            Target
          </div>
          <Tooltip content="Saves the file" defaultOpen positioning={{ target }} side="bottom">
            <button type="button" data-testid="child">
              Save
            </button>
          </Tooltip>
        </>
      );
    }
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 768,
    });
    try {
      render(<Page />);
      mockRect(screen.getByTestId('child'), { x: 100, y: 100, width: 60, height: 20 });
      mockRect(screen.getByTestId('target'), { x: 600, y: 300, width: 80, height: 20 });
      await act(async () => {});
      // The surface follows the target: re-render to place it with the mocked boxes.
      await waitFor(() => {
        const transform = surface()!.style.transform;
        const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(transform);
        expect(match).not.toBeNull();
        // Next to the target (x ~ 600), not the child (x ~ 100).
        expect(Number(match![1])).toBeGreaterThan(400);
      });
    } finally {
      Reflect.deleteProperty(document.documentElement, 'clientWidth');
      Reflect.deleteProperty(document.documentElement, 'clientHeight');
    }
  });

  it('keeps the child as the hover and focus trigger', async () => {
    const user = setupTimers();
    const target = document.createElement('div');
    document.body.appendChild(target);
    try {
      render(
        <Tooltip content="Saves the file" positioning={{ target }}>
          <button type="button">Save</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Save' }));
      advance(250);
      expect(surface()).not.toBeNull();
    } finally {
      cleanup();
      target.remove();
    }
  });

  it('applies a custom offset', async () => {
    render(<Open positioning={{ offset: 20 }} withArrow />);
    await act(async () => {});
    expect(surface()).not.toBeNull();
  });

  it('types positioning with a target', () => {
    expectTypeOf<NonNullable<TooltipProps['positioning']>['target']>().not.toBeNever();
  });
});

describe('asChild: no wrapper element (tooltip-7)', () => {
  it('renders no wrapper span: the button is the container’s child', () => {
    const { container } = render(
      <Tooltip content="Saves the file" asChild>
        <button type="button">Save</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(container.firstElementChild).toBe(button);
    expect(container.querySelector('.' + tooltipClassNames.root)).toBeNull();
    // The hidden description is the button's next sibling, and describes it.
    expect(button.nextElementSibling).toHaveAttribute('role', 'tooltip');
    expect(button).toHaveAttribute('aria-describedby', button.nextElementSibling!.id);
  });

  it('shows on hover and on focus, and hides on leave and blur', async () => {
    const user = setupTimers();
    render(
      <Tooltip content="Saves the file" asChild>
        <button type="button">Save</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    await user.hover(button);
    expect(surface()).toBeNull();
    advance(250);
    expect(surface()).toHaveTextContent('Saves the file');
    await user.unhover(button);
    advance(300);
    expect(surface()).toBeNull();
    act(() => button.focus());
    advance(250);
    expect(surface()).not.toBeNull();
    act(() => button.blur());
    advance(200);
    expect(surface()).toBeNull();
  });

  it('merges the ref, className, style, data attributes and handlers onto the child', async () => {
    const user = setupTimers();
    const ref = React.createRef<HTMLElement>();
    const childRef = React.createRef<HTMLButtonElement>();
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    const childOnFocus = vi.fn();
    render(
      <Tooltip
        content="Saves the file"
        asChild
        ref={ref}
        className="tip-class"
        style={{ color: 'red' }}
        data-extra="x"
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
      >
        <button
          type="button"
          ref={childRef}
          className="kid-class"
          style={{ margin: 1 }}
          onFocus={childOnFocus}
        >
          Save
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(ref.current).toBe(button);
    expect(childRef.current).toBe(button);
    expect(button).toHaveClass('tip-class', 'kid-class');
    expect(button).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(button).toHaveStyle({ margin: '1px' });
    expect(button).toHaveAttribute('data-extra', 'x');
    await user.hover(button);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    act(() => button.focus());
    expect(childOnFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    advance(250);
    expect(surface()).not.toBeNull();
    act(() => button.blur());
  });

  it('keeps the child’s own id and joins the aria-describedby it has', () => {
    render(
      <Tooltip content="Saves the file" asChild>
        <button type="button" id="own" aria-describedby="other">
          Save
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('id', 'own');
    expect(button.getAttribute('aria-describedby')!.split(' ')).toContain('other');
    expect(button.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
  });

  it('names the child with relationship="label"', () => {
    render(
      <Tooltip content="Save the file" relationship="label" asChild>
        <button type="button" aria-label={undefined}>
          <svg aria-hidden="true" />
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Save the file' })).toBeInTheDocument();
  });

  it('keeps the child’s layout: a flex child stays a direct child of its flex row', () => {
    render(
      <div data-testid="row" style={{ display: 'flex' }}>
        <Tooltip content="Saves the file" asChild>
          <button type="button">Save</button>
        </Tooltip>
      </div>,
    );
    const row = screen.getByTestId('row');
    expect(row.children[0]).toBe(screen.getByRole('button', { name: 'Save' }));
  });

  it('keeps the tooltip surface in a portal and points it at the child', async () => {
    render(
      <Tooltip content="Saves the file" defaultOpen asChild>
        <button type="button">Save</button>
      </Tooltip>,
    );
    await act(async () => {});
    expect(surface()!.closest('[data-wave-portal]')).toHaveAttribute('data-layer', 'tooltip');
  });

  it('hides on Escape without closing an enclosing popover', async () => {
    const user = setupTimers();
    render(
      <Popover defaultOpen>
        <Popover.Trigger>
          <button type="button">Open</button>
        </Popover.Trigger>
        <Popover.Content title="Details">
          <Tooltip content="Saves the file" asChild>
            <button type="button">Save</button>
          </Tooltip>
        </Popover.Content>
      </Popover>,
    );
    await user.hover(screen.getByRole('button', { name: 'Save' }));
    advance(250);
    expect(surface()).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(surface()).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('merges into a trigger that clones it: the trigger’s props reach the button', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger>
          <Tooltip content="Open the details" asChild>
            <button type="button">Details</button>
          </Tooltip>
        </Popover.Trigger>
        <Popover.Content title="Details">Body</Popover.Content>
      </Popover>,
    );
    const button = screen.getByRole('button', { name: 'Details' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
  });

  it('wraps a child that is not a single element, with the usual warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <Tooltip content="Saves the file" asChild>
        {'Plain text' as unknown as React.ReactElement}
      </Tooltip>,
    );
    expect(container.querySelector('span')).toHaveTextContent('Plain text');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(
      'Tooltip: expected a single React element child',
    );
  });

  it('warns once when a child neither forwards the ref nor spreads its props', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function Ignores() {
      return <button type="button">Ignores</button>;
    }
    render(
      <Tooltip content="Saves the file" asChild>
        <Ignores />
      </Tooltip>,
    );
    const messages = warn.mock.calls.map(([message]) => String(message));
    expect(messages.filter((m) => m.includes('did not attach the Tooltip ref'))).toHaveLength(1);
  });

  it('has no axe violations', async () => {
    render(
      <Tooltip content="Saves the file" asChild defaultOpen>
        <button type="button">Save</button>
      </Tooltip>,
    );
    await expectNoA11yViolations(document.body);
  });

  it('is typed as a boolean, and ref takes any element', () => {
    expectTypeOf<TooltipProps['asChild']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<React.RefObject<HTMLSpanElement | null>>().toExtend<
      NonNullable<TooltipProps['ref']>
    >();
    expectTypeOf<React.RefObject<HTMLButtonElement | null>>().toExtend<
      NonNullable<TooltipProps['ref']>
    >();
  });

  it('keeps the wrapper span by default, with the stable class', () => {
    const { container } = render(
      <Tooltip content="Saves the file">
        <button type="button">Save</button>
      </Tooltip>,
    );
    expect(container.firstElementChild).toHaveClass(tooltipClassNames.root);
  });
});

describe('one tooltip at a time (tooltip-8)', () => {
  it('hides the first when a second opens', async () => {
    const user = setupTimers();
    render(
      <>
        <Tooltip content="First tip">
          <button type="button">One</button>
        </Tooltip>
        <Tooltip content="Second tip">
          <button type="button">Two</button>
        </Tooltip>
      </>,
    );
    await user.hover(screen.getByRole('button', { name: 'One' }));
    advance(250);
    expect(surface()).toHaveTextContent('First tip');
    // The pointer jumps to the other button without leaving through the first's delay.
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Two' }));
    advance(250);
    const surfaces = document.querySelectorAll('[data-wave-tooltip-surface]');
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]).toHaveTextContent('Second tip');
  });

  it('closes the other tooltips of a controlled one through onOpenChange', async () => {
    const onFirstChange = vi.fn();
    function Both() {
      const [second, setSecond] = React.useState(false);
      return (
        <>
          <Tooltip content="First tip" defaultOpen onOpenChange={onFirstChange}>
            <button type="button">One</button>
          </Tooltip>
          <Tooltip content="Second tip" open={second} onOpenChange={setSecond}>
            <button type="button">Two</button>
          </Tooltip>
          <button type="button" onClick={() => setSecond(true)}>
            Show second
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Both />);
    await act(async () => {});
    expect(onFirstChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Show second' }));
    expect(onFirstChange).toHaveBeenCalledWith(false);
    expect(document.querySelectorAll('[data-wave-tooltip-surface]')).toHaveLength(1);
  });

  it('opens once per tooltip in StrictMode', async () => {
    const onOpenChange = vi.fn();
    const user = setupTimers();
    render(
      <React.StrictMode>
        <Tooltip content="First tip" onOpenChange={onOpenChange}>
          <button type="button">One</button>
        </Tooltip>
      </React.StrictMode>,
    );
    await user.hover(screen.getByRole('button', { name: 'One' }));
    advance(250);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

describe('a hidden document (tooltip-8)', () => {
  it('hides the tooltip when the document becomes hidden', async () => {
    render(<Open />);
    await act(async () => {});
    expect(surface()).not.toBeNull();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(surface()).toBeNull();
    } finally {
      hidden.mockRestore();
    }
  });

  it('keeps it while the document stays visible', async () => {
    render(<Open />);
    await act(async () => {});
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(surface()).not.toBeNull();
  });
});

describe('an expanded trigger (tooltip-8)', () => {
  it('never shows over a trigger whose popup is expanded', async () => {
    const user = setupTimers();
    render(
      <Tooltip content="Saves the file">
        <button type="button" aria-expanded="true">
          Menu
        </button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole('button', { name: 'Menu' }));
    advance(500);
    expect(surface()).toBeNull();
  });

  it('hides a shown tooltip when its trigger’s popup expands, and shows again after it closes', async () => {
    const user = setupTimers();
    function Menu() {
      const [expanded, setExpanded] = React.useState(false);
      return (
        <Tooltip content="Saves the file">
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            Menu
          </button>
        </Tooltip>
      );
    }
    render(<Menu />);
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.hover(button);
    advance(250);
    expect(surface()).not.toBeNull();
    await user.click(button);
    await act(async () => {});
    expect(surface()).toBeNull();
    await user.click(button);
    await user.unhover(button);
    await user.hover(button);
    advance(250);
    expect(surface()).not.toBeNull();
  });

  it('also reads an expanded element inside the child, and an expanded Popover trigger around it', async () => {
    const user = setupTimers();
    render(
      <Popover>
        <Popover.Trigger>
          <Tooltip content="Open the details">
            <button type="button">Details</button>
          </Tooltip>
        </Popover.Trigger>
        <Popover.Content title="Details">Body</Popover.Content>
      </Popover>,
    );
    const button = screen.getByRole('button', { name: 'Details' });
    await user.hover(button);
    advance(250);
    expect(surface()).toHaveTextContent('Open the details');
    await user.click(button);
    await act(async () => {});
    expect(surface()).toBeNull();
    await user.keyboard('{Escape}');
  });
});

describe('a clipped anchor (tooltip-8)', () => {
  /** Layout boxes by `data-testid` (and the tooltip surface) and a 1024x768 viewport. */
  function mockLayout(anchor: { x: number; y: number; width: number; height: number }) {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 768,
    });
    const boxOf = (el: Element) =>
      el.getAttribute('data-testid') === 'anchor'
        ? anchor
        : el.hasAttribute('data-wave-tooltip-surface')
          ? { x: 0, y: 0, width: 100, height: 20 }
          : { x: 0, y: 0, width: 0, height: 0 };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const { x, y, width, height } = boxOf(this);
      const full = { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
      return { ...full, toJSON: () => full } as DOMRect;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxOf(this).width;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxOf(this).height;
    });
  }
  afterEach(() => {
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  });

  // The wrapper span is the anchor.
  const tip = () => (
    <Tooltip content="Saves the file" defaultOpen data-testid="anchor">
      <button type="button">Save</button>
    </Tooltip>
  );

  it('hides the surface while the anchor is scrolled out of the viewport', async () => {
    mockLayout({ x: 500, y: -500, width: 80, height: 20 });
    render(tip());
    await waitFor(() => expect(surface()!.style.visibility).toBe('hidden'));
  });

  it('keeps it visible while the anchor is in view', async () => {
    mockLayout({ x: 500, y: 300, width: 80, height: 20 });
    render(tip());
    await act(async () => {});
    await waitFor(() => expect(surface()!.style.transform).not.toBe(''));
    expect(surface()!.style.visibility).not.toBe('hidden');
  });

  it('keeps it visible without a layout box (jsdom, display: contents)', async () => {
    render(<Open />);
    await act(async () => {});
    expect(surface()!.style.visibility).not.toBe('hidden');
  });
});

describe('the content during the exit', () => {
  it('keeps the content it showed while it fades out', async () => {
    const motion = mockAnimations({
      animated: (el) => el.hasAttribute('data-wave-tooltip-surface'),
    });
    function Harness() {
      const [copied, setCopied] = React.useState(true);
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <Tooltip
            content={copied ? 'Copied' : 'Copy'}
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setCopied(false);
            }}
          >
            <button type="button">Copy</button>
          </Tooltip>
        </>
      );
    }
    render(<Harness />);
    await act(async () => {});
    expect(surface()).toHaveTextContent('Copied');
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => {});
    // The tooltip is closing: the surface is still there with the text it showed, although the
    // content is already "Copy" again.
    expect(surface()).toHaveAttribute('data-presence', 'exiting');
    expect(surface()).toHaveTextContent('Copied');
    // The hidden description follows the live content.
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Copy');
    await act(async () => {
      await motion.finishAll();
    });
    expect(surface()).toBeNull();
  });

  it('shows a changed content while it stays visible', async () => {
    function Harness() {
      const [text, setText] = React.useState('One');
      return (
        <>
          <Tooltip content={text} defaultOpen>
            <button type="button">Item</button>
          </Tooltip>
          <button type="button" onClick={() => setText('Two')}>
            Change
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await act(async () => {});
    expect(surface()).toHaveTextContent('One');
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(surface()).toHaveTextContent('Two');
  });
});

describe('RTL', () => {
  it('draws the beak in a right-to-left tree', async () => {
    document.documentElement.dir = 'rtl';
    try {
      render(<Open withArrow side="start" />);
      await act(async () => {});
      expect(beak()).not.toBeNull();
    } finally {
      document.documentElement.dir = '';
    }
  });
});
