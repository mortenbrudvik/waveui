import { describe, it, expect, vi, afterEach, beforeEach, type MockInstance } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderTrigger, STATE_ARIA, type TriggerChildren } from '../renderTrigger';
import { __resetWarnings } from '../dev';

interface TriggerProps {
  id: string;
  'aria-haspopup': 'dialog' | 'menu';
  'aria-expanded': boolean;
  'aria-controls'?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ref?: React.Ref<HTMLButtonElement>;
  className?: string;
}

function makeTriggerProps(overrides: Partial<TriggerProps> = {}): TriggerProps {
  return {
    id: 'trigger-1',
    'aria-haspopup': 'dialog',
    'aria-expanded': false,
    onClick: vi.fn(),
    ...overrides,
  };
}

/** Minimal stand-in for a trigger component built on renderTrigger. */
function Trigger({
  children,
  triggerProps,
  asChild,
  fallback,
}: {
  children: TriggerChildren<TriggerProps> | React.ReactNode;
  triggerProps: TriggerProps;
  asChild?: boolean;
  fallback?: 'span' | 'button';
}) {
  return (
    <>
      {renderTrigger(children, triggerProps, {
        componentName: 'Popover.Trigger',
        asChild,
        fallback,
      })}
    </>
  );
}

const WRAPPED_WARNING =
  '[WaveUI] Popover.Trigger: expected a single React element child (not text, a Fragment or several elements); the children are rendered inside a <span> wrapper instead.';

// Warnings are silenced, and each test takes the ones it expects (takeWarnings): the afterEach
// allows no other. console.error is only watched: nothing may be logged there.
let warnSpy: MockInstance<typeof console.warn>;
let errorSpy: MockInstance<typeof console.error>;

/** The warnings logged so far, removed from the spy (the test asserts them). */
function takeWarnings(): unknown[] {
  const messages = warnSpy.mock.calls.map(([message]) => message);
  warnSpy.mockClear();
  return messages;
}

beforeEach(() => {
  __resetWarnings();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error');
});

afterEach(() => {
  try {
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  } finally {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }
});

describe('renderTrigger (overlays#5, overlays#21, feedback-navigation#51)', () => {
  it('exports the state ARIA keys that always win', () => {
    expect(STATE_ARIA).toEqual(['aria-expanded', 'aria-controls', 'aria-haspopup']);
  });

  it('calls a render-prop child with the trigger props', () => {
    const triggerProps = makeTriggerProps({ 'aria-expanded': true, 'aria-controls': 'popup-1' });
    render(
      <Trigger triggerProps={triggerProps}>
        {(props: TriggerProps) => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      </Trigger>,
    );
    const button = screen.getByRole('button', { name: 'Open' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'popup-1');
    expect(button).toHaveAttribute('id', 'trigger-1');
  });

  it('merges the trigger props onto a single element child (no wrapper)', () => {
    const triggerProps = makeTriggerProps({ 'aria-expanded': true, 'aria-controls': 'popup-1' });
    const { container } = render(
      <Trigger triggerProps={triggerProps}>
        <button type="button">Open</button>
      </Trigger>,
    );
    const button = screen.getByRole('button', { name: 'Open' });
    expect(container.firstElementChild).toBe(button);
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'popup-1');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('composes handlers: the child’s onClick runs first, then the trigger’s', () => {
    const calls: string[] = [];
    const triggerProps = makeTriggerProps({ onClick: () => calls.push('trigger') });
    render(
      <Trigger triggerProps={triggerProps}>
        <button type="button" onClick={() => calls.push('child')}>
          Open
        </button>
      </Trigger>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(calls).toEqual(['child', 'trigger']);
  });

  it('lets the child cancel the trigger behaviour with preventDefault', () => {
    const triggerProps = makeTriggerProps();
    render(
      <Trigger triggerProps={triggerProps}>
        <button type="button" onClick={(e) => e.preventDefault()}>
          Open
        </button>
      </Trigger>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(triggerProps.onClick).not.toHaveBeenCalled();
  });

  it('keeps live state ARIA over the child’s static attributes, but the child’s id and className win', () => {
    const triggerProps = makeTriggerProps({
      'aria-expanded': true,
      'aria-controls': 'popup-1',
      className: 'px-4',
    });
    render(
      <Trigger triggerProps={triggerProps}>
        <button
          type="button"
          id="my-id"
          aria-expanded={false}
          aria-haspopup="menu"
          aria-controls="other"
          className="px-2"
        >
          Open
        </button>
      </Trigger>,
    );
    const button = screen.getByRole('button', { name: 'Open' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-controls', 'popup-1');
    expect(button).toHaveAttribute('id', 'my-id');
    expect(button.className).toBe('px-2');
  });

  it('drops the child’s aria-controls while the trigger says there is none (closed)', () => {
    const triggerProps = makeTriggerProps({ 'aria-controls': undefined });
    render(
      <Trigger triggerProps={triggerProps}>
        <button type="button" aria-controls="stale">
          Open
        </button>
      </Trigger>,
    );
    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveAttribute('aria-controls');
  });

  it('merges refs: the trigger ref and the child’s own ref both receive the element', () => {
    const triggerRef = React.createRef<HTMLButtonElement>();
    const childRef = React.createRef<HTMLButtonElement>();
    render(
      <Trigger triggerProps={makeTriggerProps({ ref: triggerRef })}>
        <button type="button" ref={childRef}>
          Open
        </button>
      </Trigger>,
    );
    const button = screen.getByRole('button', { name: 'Open' });
    expect(triggerRef.current).toBe(button);
    expect(childRef.current).toBe(button);
  });

  it('asChild={false} renders the 0.4 wrapper span with the trigger props (no warning)', () => {
    const triggerProps = makeTriggerProps({ 'aria-expanded': true });
    const { container } = render(
      <Trigger triggerProps={triggerProps} asChild={false}>
        <button type="button">Open</button>
      </Trigger>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).toHaveAttribute('aria-expanded', 'true');
    expect(wrapper).toContainElement(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveAttribute('aria-expanded');
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(triggerProps.onClick).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses the requested fallback element', () => {
    const { container } = render(
      <Trigger triggerProps={makeTriggerProps()} asChild={false} fallback="button">
        Open
      </Trigger>,
    );
    expect(container.firstElementChild!.tagName).toBe('BUTTON');
  });

  it('wraps a text child in the fallback and warns once (never returns null)', () => {
    const triggerProps = makeTriggerProps();
    const { container, rerender } = render(<Trigger triggerProps={triggerProps}>Hover me</Trigger>);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).toHaveTextContent('Hover me');
    expect(wrapper).toHaveAttribute('aria-haspopup', 'dialog');
    rerender(<Trigger triggerProps={triggerProps}>Hover me</Trigger>);
    expect(takeWarnings()).toEqual([WRAPPED_WARNING]);
  });

  it('never clones a Fragment: wraps it and puts the props on the wrapper', () => {
    const { container } = render(
      <Trigger triggerProps={makeTriggerProps({ 'aria-expanded': true })}>
        <>
          <button type="button">Help</button>
        </>
      </Trigger>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).toHaveAttribute('aria-expanded', 'true');
    expect(takeWarnings()).toEqual([WRAPPED_WARNING]);
  });

  it('wraps multiple children and warns', () => {
    const { container } = render(
      <Trigger triggerProps={makeTriggerProps()}>
        {[
          <button key="a" type="button">
            A
          </button>,
          <button key="b" type="button">
            B
          </button>,
        ]}
      </Trigger>,
    );
    expect(container.firstElementChild!.tagName).toBe('SPAN');
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(takeWarnings()).toEqual([WRAPPED_WARNING]);
  });

  it('renders an empty wrapper without warning for conditional (null/false) children', () => {
    const { container } = render(<Trigger triggerProps={makeTriggerProps()}>{false}</Trigger>);
    expect(container.firstElementChild!.tagName).toBe('SPAN');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
