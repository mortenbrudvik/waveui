import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MessageBar,
  useMessageBarContext,
  type MessageBarContextValue,
  type MessageBarProps,
} from '../MessageBar';
import * as ContextModule from '../MessageBar.context';
import { MessageBarGroup } from '../MessageBarGroup';
import { Button } from '../../button/Button';
import { messageBarClassNames } from '../../../lib/classNames';
import type { Status } from '../../../lib/types';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  installResizeObserverMock,
  mockRect,
} from '../../../test-utils';
import type { ResizeObserverMock } from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const CONTEXT_ERROR = '[WaveUI] useMessageBarContext must be used within <MessageBar>';

const statuses = ['info', 'success', 'warning', 'error'] as const satisfies readonly Status[];

/** Records what `useMessageBarContext` returns where it renders. */
function Probe({
  id,
  record,
}: {
  id: string;
  record: (id: string, value: MessageBarContextValue) => void;
}) {
  record(id, useMessageBarContext());
  return null;
}

/** Every value each probe recorded, by probe id. */
function recorder() {
  const seen = new Map<string, MessageBarContextValue[]>();
  return {
    record: (id: string, value: MessageBarContextValue) => {
      const list = seen.get(id) ?? [];
      list.push(value);
      seen.set(id, list);
    },
    last: (id: string): MessageBarContextValue | undefined => seen.get(id)?.at(-1),
    count: (id: string): number => seen.get(id)?.length ?? 0,
  };
}

/** What the action of your own says for each intent. */
const ACTION_LABELS: Record<Status, string> = {
  info: 'Learn more',
  success: 'View details',
  warning: 'Review',
  error: 'Try again',
};

/**
 * An action of your own that follows its bar (as the story's): its label and appearance by the
 * intent, its size by the layout (small on the text's row, medium on a row of its own). The two
 * values are also rendered as attributes for the assertions.
 */
function IntentAction({ onAction }: { onAction?: () => void }) {
  const { intent, layout } = useMessageBarContext();
  return (
    <Button
      size={layout === 'multiline' ? 'medium' : 'small'}
      appearance={intent === 'error' || intent === 'warning' ? 'primary' : 'outline'}
      data-bar-intent={intent}
      data-bar-layout={layout}
      onClick={onAction}
    >
      {ACTION_LABELS[intent]}
    </Button>
  );
}
IntentAction.displayName = 'IntentAction';

/** A bar with the action of your own in its actions. */
function ActionBar({
  Action = IntentAction,
  onAction,
  ...props
}: Omit<MessageBarProps, 'children'> & {
  Action?: React.ComponentType<{ onAction?: () => void }>;
  onAction?: () => void;
}) {
  return (
    <MessageBar {...props}>
      <MessageBar.Title>Upload failed</MessageBar.Title>
      The file is larger than 10 MB.
      <MessageBar.Actions>
        <Action onAction={onAction} />
      </MessageBar.Actions>
    </MessageBar>
  );
}

// ---------------------------------------------------------------------------
// The value
// ---------------------------------------------------------------------------

describe('useMessageBarContext (P13-02, R15)', () => {
  it('returns exactly intent and layout, nothing else', () => {
    const probes = recorder();
    render(
      <MessageBar status="warning" layout="singleline">
        <Probe id="body" record={probes.record} />
      </MessageBar>,
    );
    const value = probes.last('body');
    expect(value).toStrictEqual({ intent: 'warning', layout: 'singleline' });
    // No placement or other member is frozen into the public contract (R11).
    expect(Object.keys(value!).sort()).toEqual(['intent', 'layout']);
  });

  it.each(statuses)('intent is the bar’s status: %s', (status) => {
    const probes = recorder();
    render(
      <MessageBar status={status}>
        <Probe id="body" record={probes.record} />
      </MessageBar>,
    );
    expect(probes.last('body')?.intent).toBe(status);
  });

  it('intent is info when the bar has no status (its default)', () => {
    const probes = recorder();
    render(
      <MessageBar>
        <Probe id="body" record={probes.record} />
      </MessageBar>,
    );
    expect(probes.last('body')?.intent).toBe('info');
  });

  it.each(['singleline', 'multiline'] as const)(
    'layout is %s when the bar’s layout says so, with or without actions',
    (layout) => {
      const probes = recorder();
      render(
        <>
          <MessageBar layout={layout} aria-label="Without actions">
            <Probe id="plain" record={probes.record} />
          </MessageBar>
          <MessageBar layout={layout} aria-label="With actions">
            <Probe id="with-actions" record={probes.record} />
            <MessageBar.Actions>
              <Button>Retry</Button>
            </MessageBar.Actions>
          </MessageBar>
        </>,
      );
      expect(probes.last('plain')?.layout).toBe(layout);
      expect(probes.last('with-actions')?.layout).toBe(layout);
    },
  );

  it('layout is the one the bar renders: an auto bar without actions is multiline, with actions it starts on one row', () => {
    const probes = recorder();
    render(
      <>
        <MessageBar aria-label="Without actions">
          <Probe id="plain" record={probes.record} />
        </MessageBar>
        <MessageBar aria-label="With actions">
          <Probe id="with-actions" record={probes.record} />
          <MessageBar.Actions>
            <Button>Retry</Button>
          </MessageBar.Actions>
        </MessageBar>
      </>,
    );
    expect(probes.last('plain')?.layout).toBe('multiline');
    expect(screen.getByRole('status', { name: 'Without actions' })).toHaveAttribute(
      'data-layout',
      'multiline',
    );
    expect(probes.last('with-actions')?.layout).toBe('singleline');
    expect(screen.getByRole('status', { name: 'With actions' })).toHaveAttribute(
      'data-layout',
      'singleline',
    );
  });

  it('every place in the bar reads the same value: icon, title, body, actions and dismiss content', () => {
    const probes = recorder();
    const probe = (id: string) => <Probe id={id} record={probes.record} />;
    render(
      <MessageBar status="error" layout="multiline" icon={probe('icon')} dismiss={probe('dismiss')}>
        <MessageBar.Title>{probe('title')}Upload failed</MessageBar.Title>
        {probe('body')}
        <MessageBar.Actions>{probe('actions')}</MessageBar.Actions>
      </MessageBar>,
    );
    const body = probes.last('body');
    expect(body).toStrictEqual({ intent: 'error', layout: 'multiline' });
    for (const id of ['icon', 'title', 'actions', 'dismiss'])
      expect(probes.last(id), id).toBe(body);
  });

  it('a bar inside another bar reads its own values', () => {
    const probes = recorder();
    render(
      <MessageBar status="warning" aria-label="Outer">
        <MessageBar status="success" layout="singleline" aria-label="Inner">
          <Probe id="inner" record={probes.record} />
        </MessageBar>
        <Probe id="outer" record={probes.record} />
      </MessageBar>,
    );
    expect(probes.last('inner')).toStrictEqual({ intent: 'success', layout: 'singleline' });
    expect(probes.last('outer')).toStrictEqual({ intent: 'warning', layout: 'multiline' });
  });

  it('each bar of a MessageBarGroup gives its own values', () => {
    const probes = recorder();
    render(
      <MessageBarGroup>
        <MessageBar key="a" status="error" layout="singleline">
          <Probe id="a" record={probes.record} />
        </MessageBar>
        <MessageBar key="b" status="success">
          <Probe id="b" record={probes.record} />
        </MessageBar>
      </MessageBarGroup>,
    );
    expect(probes.last('a')).toStrictEqual({ intent: 'error', layout: 'singleline' });
    expect(probes.last('b')).toStrictEqual({ intent: 'success', layout: 'multiline' });
  });

  it('the same object while intent and layout stay the same; a new one when either changes', () => {
    const probes = recorder();
    function Parent({ tick, status, layout }: { tick: number } & Partial<MessageBarProps>) {
      return (
        <MessageBar status={status} layout={layout} data-tick={tick}>
          <Probe id="body" record={probes.record} />
        </MessageBar>
      );
    }
    const { rerender } = render(<Parent tick={0} />);
    const first = probes.last('body')!;
    rerender(<Parent tick={1} />);
    expect(probes.count('body')).toBe(2);
    expect(probes.last('body')).toBe(first);

    rerender(<Parent tick={2} status="error" />);
    const error = probes.last('body')!;
    expect(error).not.toBe(first);
    expect(error).toStrictEqual({ intent: 'error', layout: 'multiline' });
    rerender(<Parent tick={3} status="error" />);
    expect(probes.last('body')).toBe(error);

    rerender(<Parent tick={4} status="error" layout="singleline" />);
    expect(probes.last('body')).not.toBe(error);
    expect(probes.last('body')).toStrictEqual({ intent: 'error', layout: 'singleline' });
  });

  it('a memoised consumer re-renders only when intent or layout changes', () => {
    const probes = recorder();
    const MemoProbe = React.memo(Probe);
    function Parent({ tick, status }: { tick: number; status?: Status }) {
      return (
        <MessageBar status={status} data-tick={tick}>
          {/* The same element on every render: only the context can re-render the probe. */}
          {memoProbe}
        </MessageBar>
      );
    }
    const memoProbe = <MemoProbe id="memo" record={probes.record} />;
    const { rerender } = render(<Parent tick={0} />);
    expect(probes.count('memo')).toBe(1);
    rerender(<Parent tick={1} />);
    rerender(<Parent tick={2} />);
    expect(probes.count('memo')).toBe(1);
    rerender(<Parent tick={3} status="success" />);
    expect(probes.count('memo')).toBe(2);
    expect(probes.last('memo')?.intent).toBe('success');
  });

  it('throws outside a MessageBar in development (C-CONTEXT)', () => {
    expectThrows(<Probe id="orphan" record={() => {}} />, CONTEXT_ERROR);
  });

  it('throws in a MessageBarGroup outside its bars (C-CONTEXT)', () => {
    expectThrows(
      <MessageBarGroup>
        <MessageBar key="a">Saved.</MessageBar>
        <Probe key="probe" id="orphan" record={() => {}} />
      </MessageBarGroup>,
      CONTEXT_ERROR,
    );
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a MessageBar and returns the inert value', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const probes = recorder();
        const { rerender } = render(<Probe id="orphan" record={probes.record} />);
        rerender(<Probe id="orphan" record={probes.record} />);
        expect(error.mock.calls).toEqual([[CONTEXT_ERROR]]);
        expect(probes.last('orphan')).toStrictEqual({ intent: 'info', layout: 'singleline' });
      } finally {
        error.mockRestore();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// The resolved layout of an auto bar
// ---------------------------------------------------------------------------

/** Resolves after the next animation frame (the reflow measures a resize one frame later). */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function textColumn(bar: HTMLElement): HTMLElement {
  const column = bar.querySelector<HTMLElement>(`.${messageBarClassNames.body}`);
  if (!column) throw new Error('the bar has no text column');
  return column;
}

/**
 * Gives the bar and its text column the widths of a real layout (jsdom lays nothing out): `root`
 * is the bar's client width, `text` the column's client width and `content` its scroll width.
 */
function setWidths(
  bar: HTMLElement,
  { root, text, content }: { root: number; text: number; content: number },
): void {
  mockRect(bar, { width: root });
  const column = textColumn(bar);
  mockRect(column, { width: text });
  Object.defineProperty(column, 'scrollWidth', { configurable: true, value: content });
}

describe('useMessageBarContext: the layout after a reflow (D17)', () => {
  let ro: ResizeObserverMock;

  beforeEach(() => {
    ro = installResizeObserverMock();
  });

  afterEach(() => {
    ro.restore();
  });

  /** Reports a resize of the bar and lets the measurement of the next frame land. */
  async function resize(bar: HTMLElement): Promise<void> {
    ro.trigger(bar);
    await act(async () => {
      await nextFrame();
    });
  }

  it('follows the layout an auto bar measures: multiline while its text overflows, one row again once it fits', async () => {
    const probes = recorder();
    render(
      <MessageBar status="warning">
        Your session expires in five minutes.
        <Probe id="body" record={probes.record} />
        <MessageBar.Actions>
          <IntentAction />
        </MessageBar.Actions>
      </MessageBar>,
    );
    const bar = screen.getByRole('alert');
    const action = screen.getByRole('button', { name: 'Review' });
    expect(probes.last('body')).toStrictEqual({ intent: 'warning', layout: 'singleline' });
    expect(action).toHaveAttribute('data-bar-layout', 'singleline');

    // The text needs 150 px more than its column, so the bar needs 400 + 150 = 550 px.
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(probes.last('body')).toStrictEqual({ intent: 'warning', layout: 'multiline' });
    expect(screen.getByRole('button', { name: 'Review' })).toBe(action);
    expect(action).toHaveAttribute('data-bar-layout', 'multiline');

    setWidths(bar, { root: 550, text: 550, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(probes.last('body')).toStrictEqual({ intent: 'warning', layout: 'singleline' });
    expect(action).toHaveAttribute('data-bar-layout', 'singleline');
  });

  it('text that renders by the layout does not make an auto bar measure again and again', async () => {
    let renders = 0;
    const countRender = () => (renders += 1);
    /**
     * Text of the message that says more on a row of its own (it stops changing after 100 renders,
     * so a measurement that starts over at each change ends).
     */
    function LayoutText({ onRender }: { onRender: () => number }) {
      const { layout } = useMessageBarContext();
      const count = onRender();
      return (
        <span>
          {layout === 'multiline' && count < 100
            ? 'Your session expires in five minutes. Save your work.'
            : 'Your session expires in five minutes.'}
        </span>
      );
    }
    render(
      <MessageBar>
        <MessageBar.Title>
          <LayoutText onRender={countRender} />
        </MessageBar.Title>
        <LayoutText onRender={countRender} />
        <MessageBar.Actions>
          <Button>Extend</Button>
        </MessageBar.Actions>
      </MessageBar>,
    );
    const bar = screen.getByRole('status');
    setWidths(bar, { root: 400, text: 200, content: 350 });
    renders = 0;
    await resize(bar);
    await act(async () => {
      await nextFrame();
    });
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(bar).toHaveTextContent('Save your work.');
    // One render of each text for the new layout (none of them restarts the measurement).
    expect(renders).toBe(2);
  });

  it('still measures again when the message changes on its own after such a layout', async () => {
    const live = React.createRef<{ set(message: string): void }>();
    /** Text that changes without a render of the bar (a live progress message). */
    function LiveMessage({ ref }: { ref: React.Ref<{ set(message: string): void }> }) {
      const [message, setMessage] = React.useState('Uploading…');
      React.useImperativeHandle(ref, () => ({ set: setMessage }), []);
      return <>{message}</>;
    }
    let renders = 0;
    const countRender = () => (renders += 1);
    /** A hint on a row of its own (it stops changing after 100 renders, as above). */
    function LayoutHint({ onRender }: { onRender: () => number }) {
      const { layout } = useMessageBarContext();
      const count = onRender();
      return <span>{layout === 'multiline' && count < 100 ? ' (stacked)' : ''}</span>;
    }
    render(
      <MessageBar>
        <LiveMessage ref={live} />
        <LayoutHint onRender={countRender} />
        <MessageBar.Actions>
          <Button>Cancel</Button>
        </MessageBar.Actions>
      </MessageBar>,
    );
    const bar = screen.getByRole('status');
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(bar).toHaveTextContent('(stacked)');

    // The message got shorter: the measurement starts over from one row, where it now fits.
    setWidths(bar, { root: 400, text: 200, content: 150 });
    await act(async () => {
      live.current?.set('Done');
    });
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(bar).not.toHaveTextContent('(stacked)');
    expect(renders).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// An action of your own
// ---------------------------------------------------------------------------

describe('an action of your own (useMessageBarContext)', () => {
  it.each(statuses)('renders by the intent of a %s bar', (status) => {
    render(<ActionBar status={status} layout="singleline" />);
    const action = screen.getByRole('button', { name: ACTION_LABELS[status] });
    expect(action).toHaveAttribute('data-bar-intent', status);
    expect(action).toHaveAttribute('data-bar-layout', 'singleline');
  });

  it('renders by the layout, and follows the bar when its intent changes', () => {
    const { rerender } = render(<ActionBar status="error" layout="multiline" />);
    const action = screen.getByRole('button', { name: 'Try again' });
    expect(action).toHaveAttribute('data-bar-layout', 'multiline');
    rerender(<ActionBar status="success" layout="multiline" />);
    expect(screen.getByRole('button', { name: 'View details' })).toBe(action);
    expect(action).toHaveAttribute('data-bar-intent', 'success');
  });

  it('is an action of the bar, with no axe violation', async () => {
    render(<ActionBar status="error" onDismiss={() => {}} />);
    const bar = screen.getByRole('alert');
    expect(bar.querySelector('button')).toBe(screen.getByRole('button', { name: 'Try again' }));
    await expectNoA11yViolations();
  });

  it('the example of the hook’s documentation works as written', async () => {
    /** The `@example` of `useMessageBarContext`, verbatim. */
    function RetryAction({ onRetry }: { onRetry: () => void }) {
      const { intent, layout } = useMessageBarContext();
      return (
        <Button
          appearance={intent === 'error' ? 'primary' : 'outline'}
          size={layout === 'multiline' ? 'medium' : 'small'}
          onClick={onRetry}
        >
          {intent === 'error' ? 'Try again' : 'Refresh'}
        </Button>
      );
    }
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const ui = (status: Status) => (
      <MessageBar status={status} layout="multiline">
        The data could not be loaded.
        <MessageBar.Actions>
          <RetryAction onRetry={onRetry} />
        </MessageBar.Actions>
      </MessageBar>
    );
    const { rerender } = render(ui('error'));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    rerender(ui('info'));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('calls its handler once per activation in StrictMode', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <React.StrictMode>
        <ActionBar status="warning" onAction={onAction} />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Review' })).toHaveAttribute(
      'data-bar-intent',
      'warning',
    );
  });

  describe('server rendering', () => {
    it('renders the layout of the server HTML (one row for an auto bar with actions) and hydrates without a warning', async () => {
      const html = renderToString(<ActionBar status="error" />);
      expect(html).toContain('data-bar-intent="error"');
      expect(html).toContain('data-bar-layout="singleline"');
      expect(html).toContain('Try again');

      const container = document.createElement('div');
      const error = vi.spyOn(console, 'error');
      const warn = vi.spyOn(console, 'warn');
      let root: Root | undefined;
      try {
        container.innerHTML = html;
        document.body.appendChild(container);
        const serverAction = screen.getByRole('button', { name: 'Try again' });
        await act(async () => {
          root = hydrateRoot(container, <ActionBar status="error" />);
        });
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Try again' })).toBe(serverAction);
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('an action imported by a Server Component (a client reference) renders the same and works the same', async () => {
      const ReferenceAction = asClientReference(IntentAction);
      expect(renderToString(<ActionBar status="warning" Action={ReferenceAction} />)).toBe(
        renderToString(<ActionBar status="warning" />),
      );

      const user = userEvent.setup();
      const onAction = vi.fn();
      render(
        <ActionBar
          status="warning"
          layout="multiline"
          Action={ReferenceAction}
          onAction={onAction}
        />,
      );
      const action = await screen.findByRole('button', { name: 'Review' });
      expect(action).toHaveAttribute('data-bar-layout', 'multiline');
      await user.click(action);
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Exports and types
// ---------------------------------------------------------------------------

describe('useMessageBarContext — exports and types', () => {
  it('MessageBar re-exports the hook of its own module (flat name)', () => {
    expect(useMessageBarContext).toBe(ContextModule.useMessageBarContext);
  });

  it('returns the narrow value', () => {
    expectTypeOf(useMessageBarContext).toEqualTypeOf<() => MessageBarContextValue>();
    expectTypeOf<MessageBarContextValue>().toEqualTypeOf<{
      intent: Status;
      layout: 'singleline' | 'multiline';
    }>();
    expectTypeOf<MessageBarContextValue['intent']>().toEqualTypeOf<
      'info' | 'success' | 'warning' | 'error'
    >();
  });
});
