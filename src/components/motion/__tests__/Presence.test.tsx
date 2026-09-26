import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { Presence, type PresenceProps } from '../Presence';
import * as MotionBarrel from '../index';
import type {
  PresencePhase,
  UsePresenceOptions,
  UsePresenceResult,
} from '../../../hooks/usePresence';
import { __resetWarnings } from '../../../lib/dev';
import { expectNoA11yViolations, mockAnimations, testDisplayName } from '../../../test-utils';

describe('Presence', () => {
  // Warnings are taken by the tests that expect them (takeWarnings); the afterEach allows no other.
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  function takeWarnings(): unknown[] {
    const messages = warn.mock.calls.map((call: unknown[]) => call[0]);
    warn.mockClear();
    return messages;
  }
  beforeEach(() => {
    __resetWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error');
  });
  afterEach(() => {
    try {
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  testDisplayName(Presence, 'Presence');

  it('gives an element child the presence attributes and the ref, keeping its own ref', async () => {
    const motion = mockAnimations();
    const ownRef = React.createRef<HTMLDivElement>();
    const { rerender } = render(
      <Presence visible>
        <div ref={ownRef} data-test-motion="" className="card" role="status">
          Saved
        </div>
      </Presence>,
    );
    const card = screen.getByRole('status');
    expect(card).toHaveAttribute('data-presence', 'entered');
    expect(card).toHaveClass('card');
    expect(ownRef.current).toBe(card);

    rerender(
      <Presence visible={false}>
        <div ref={ownRef} data-test-motion="" className="card" role="status">
          Saved
        </div>
      </Presence>,
    );
    // The presence ref reached the element: the phase waits for its animation.
    expect(card).toHaveAttribute('data-presence', 'exiting');
    expect(card).toHaveAttribute('inert');
    expect(motion.started).toBe(1);
    await act(async () => {
      await motion.finishAll();
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(ownRef.current).toBeNull();
  });

  it('keeps the child’s own inert and hidden while the presence sets none', () => {
    const { rerender } = render(
      <Presence visible unmountOnExit={false}>
        <div data-testid="panel" hidden>
          Panel
        </div>
      </Presence>,
    );
    expect(screen.getByTestId('panel')).toHaveAttribute('hidden');
    expect(screen.getByTestId('panel')).not.toHaveAttribute('inert');
    rerender(
      <Presence visible unmountOnExit={false}>
        <div data-testid="panel" inert>
          Panel
        </div>
      </Presence>,
    );
    expect(screen.getByTestId('panel')).toHaveAttribute('inert');
    expect(screen.getByTestId('panel')).not.toHaveAttribute('hidden');

    rerender(
      <Presence visible={false} unmountOnExit={false}>
        <div data-testid="panel">Panel</div>
      </Presence>,
    );
    expect(screen.getByTestId('panel')).toHaveAttribute('hidden');
    expect(screen.getByTestId('panel')).toHaveAttribute('inert');
  });

  it('passes the options on: appear, unmountOnExit and the callbacks', async () => {
    const motion = mockAnimations();
    const onEntered = vi.fn();
    const onExited = vi.fn();
    const { rerender } = render(
      <Presence visible appear onEntered={onEntered} onExited={onExited} unmountOnExit={false}>
        <p data-test-motion="">Hello</p>
      </Presence>,
    );
    const text = screen.getByText('Hello');
    expect(text).toHaveAttribute('data-presence', 'entering');
    await act(async () => {
      await motion.finishAll();
    });
    expect(onEntered).toHaveBeenCalledTimes(1);

    rerender(
      <Presence
        visible={false}
        appear
        onEntered={onEntered}
        onExited={onExited}
        unmountOnExit={false}
      >
        <p data-test-motion="">Hello</p>
      </Presence>,
    );
    await act(async () => {
      await motion.finishAll();
    });
    expect(onExited).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hello')).toBe(text);
    expect(text).toHaveAttribute('data-presence', 'exited');
  });

  it('calls a render function with the presence result', () => {
    const seen: PresencePhaseLog = [];
    const { rerender } = render(
      <Presence visible>
        {({ isMounted, phase, ref, presenceProps }) => (
          <section aria-label="Details" ref={ref} {...presenceProps}>
            <PhaseLog phase={phase} isMounted={isMounted} log={seen} />
          </section>
        )}
      </Presence>,
    );
    const region = screen.getByRole('region', { name: 'Details' });
    expect(region).toHaveAttribute('data-presence', 'entered');
    expect(seen.at(-1)).toEqual(['entered', true]);

    rerender(
      <Presence visible={false}>
        {({ ref, presenceProps }) => <section aria-label="Details" ref={ref} {...presenceProps} />}
      </Presence>,
    );
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing while not mounted', () => {
    const { container } = render(
      <Presence visible={false}>
        <div>Gone</div>
      </Presence>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('unwraps a Fragment around a single element', () => {
    render(
      <Presence visible>
        <>
          <div data-testid="only">Only</div>
        </>
      </Presence>,
    );
    expect(screen.getByTestId('only')).toHaveAttribute('data-presence', 'entered');
  });

  it('renders other children as given, without attributes, and warns once', () => {
    const WARNING =
      '[WaveUI] Presence: expected a single element or a render function as its child; other children are rendered as given, without the presence attributes, and their enter and exit phases end at once.';
    const { rerender } = render(
      // @ts-expect-error text is not an element child
      <Presence visible>Just text</Presence>,
    );
    expect(screen.getByText('Just text')).toBeInTheDocument();
    rerender(
      <Presence visible>
        <>
          <span>One</span>
          <span>Two</span>
        </>
      </Presence>,
    );
    expect(screen.getByText('One')).not.toHaveAttribute('data-presence');
    expect(takeWarnings()).toEqual([WARNING]);

    // Hiding them ends at once: nothing stays behind.
    rerender(
      <Presence visible={false}>
        <>
          <span>One</span>
          <span>Two</span>
        </>
      </Presence>,
    );
    expect(screen.queryByText('One')).toBeNull();
  });

  it('has no axe violations with a visible child', async () => {
    render(
      <Presence visible>
        <div role="dialog" aria-label="Settings">
          <button type="button">Close</button>
        </div>
      </Presence>,
    );
    await expectNoA11yViolations();
  });

  it('is exported from the motion barrel', () => {
    expect(MotionBarrel.Presence).toBe(Presence);
  });

  it('has the documented types', () => {
    expectTypeOf<PresencePhase>().toEqualTypeOf<'entering' | 'entered' | 'exiting' | 'exited'>();
    expectTypeOf<UsePresenceResult['phase']>().toEqualTypeOf<PresencePhase>();
    expectTypeOf<UsePresenceResult['ref']>().toEqualTypeOf<React.RefCallback<HTMLElement>>();
    expectTypeOf<PresenceProps['visible']>().toEqualTypeOf<boolean>();
    expectTypeOf<PresenceProps>().toExtend<UsePresenceOptions>();
    expectTypeOf<PresenceProps['children']>().toEqualTypeOf<
      React.ReactElement | ((presence: UsePresenceResult) => React.ReactNode)
    >();
    // @ts-expect-error visible is required
    const props: PresenceProps = { children: <div /> };
    expect(props).toBeDefined();
  });
});

type PresencePhaseLog = Array<[string, boolean]>;

/** Records the phase a render function passed on (a child component, so no ref is read). */
function PhaseLog({
  phase,
  isMounted,
  log,
}: {
  phase: string;
  isMounted: boolean;
  log: PresencePhaseLog;
}) {
  React.useLayoutEffect(() => {
    log.push([phase, isMounted]);
  });
  return <span>{phase}</span>;
}
