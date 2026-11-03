import { describe, it, expect, expectTypeOf, vi, afterEach, beforeEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { Spinner, SpinnerContextProvider } from '../Spinner';
import type { SpinnerAppearance, SpinnerProps, SpinnerSize } from '../Spinner';
import type { LabelPosition } from '../../../lib/types';
import { spinnerClassNames } from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';

/** Resolves after the next animation frame has run (and React has committed its update). */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/** The decorative ring of a Spinner root (`null` while a delayed spinner waits). */
const ringOf = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-wave-spinner-ring]');

describe('Spinner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The axe tests are registered below instead of by testSystemProps: the label arrives one
  // animation frame after mount, and an audit that outlasts that frame would let the update run
  // outside act(). Each audit first lets the frame run inside act().
  testSystemProps(Spinner, {
    expectedTag: 'span',
    displayName: 'Spinner',
    defaultProps: { label: 'Loading' },
    a11y: false,
  });

  describe('accessibility', () => {
    const cases: Array<[name: string, props: SpinnerProps]> = [
      ['label', { label: 'Loading' }],
      ['default label', {}],
      ['visible label', { label: 'Loading data', labelVisible: true }],
      ['role override', { role: 'progressbar', 'aria-label': 'Loading data' }],
      ['progressbar named by the default label', { role: 'progressbar' }],
      ['progressbar named by label', { role: 'progressbar', label: 'Fetching results' }],
    ];

    it.each(cases)('has no accessibility violations once announced (%s)', async (_, props) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<Spinner {...props} />);
      await React.act(nextFrame);
      await expectNoA11yViolations();
      expect(error).not.toHaveBeenCalled();
    });

    it('has no accessibility violations before the label is announced (empty region)', async () => {
      // Hold back only the Spinner's frame (its effect runs inside render's act); axe needs the
      // real requestAnimationFrame, so it is restored before the audit.
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
      render(<Spinner data-testid="sp" />);
      expect(raf).toHaveBeenCalledTimes(1);
      raf.mockRestore();
      expect(screen.getByTestId('sp')).toHaveTextContent('');
      await expectNoA11yViolations();
    });
  });

  it('renders with role="status"', () => {
    render(<Spinner data-testid="sp" />);
    expect(screen.getByTestId('sp')).toHaveAttribute('role', 'status');
  });

  it('lets the consumer override the role (feedback-navigation#19)', () => {
    render(<Spinner role="progressbar" aria-label="Loading data" />);
    expect(screen.getByRole('progressbar', { name: 'Loading data' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('can drop the live region inside a region that already announces (role="none")', () => {
    render(<Spinner role="none" data-testid="sp" />);
    expect(screen.getByTestId('sp')).toHaveAttribute('role', 'none');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps role="status" when a wrapper forwards role as undefined', async () => {
    const Wrapper = (props: SpinnerProps) => (
      <Spinner role={props.role} aria-label={props['aria-label']} data-testid="sp" />
    );
    render(<Wrapper />);
    const root = screen.getByTestId('sp');
    expect(root).toHaveAttribute('role', 'status');
    expect(root).not.toHaveAttribute('aria-label');
    await React.act(nextFrame);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('adds no aria-label to the default status region (its content is announced)', () => {
    render(<Spinner label="Saving" data-testid="sp" />);
    expect(screen.getByTestId('sp')).not.toHaveAttribute('aria-label');
  });

  describe('role="progressbar" naming', () => {
    it('is named by the default label', () => {
      render(<Spinner role="progressbar" />);
      expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
    });

    it('is named by label', () => {
      render(<Spinner role="progressbar" label="Fetching results" labelVisible />);
      expect(screen.getByRole('progressbar', { name: 'Fetching results' })).toBeInTheDocument();
    });

    it('is named by label when a wrapper forwards aria-label as undefined', () => {
      const Wrapper = (props: SpinnerProps) => (
        <Spinner role="progressbar" label="Saving" aria-label={props['aria-label']} />
      );
      render(<Wrapper />);
      expect(screen.getByRole('progressbar', { name: 'Saving' })).toBeInTheDocument();
    });

    it('lets a consumer aria-label or aria-labelledby win over label', () => {
      render(
        <>
          <span id="upload-heading">Uploading photos</span>
          <Spinner role="progressbar" label="Loading" aria-label="Loading data" />
          <Spinner
            role="progressbar"
            label="Loading"
            aria-labelledby="upload-heading"
            data-testid="labelled"
          />
        </>,
      );
      expect(screen.getByRole('progressbar', { name: 'Loading data' })).toBeInTheDocument();
      const labelled = screen.getByRole('progressbar', { name: 'Uploading photos' });
      expect(labelled).toBe(screen.getByTestId('labelled'));
      expect(labelled).not.toHaveAttribute('aria-label');
    });
  });

  describe('announcement (feedback-navigation#20)', () => {
    it('defaults the label to "Loading"', async () => {
      render(<Spinner />);
      const status = screen.getByRole('status');
      await waitFor(() => expect(status).toHaveTextContent('Loading'));
    });

    it('mounts the status region empty and sets its text after an animation frame', async () => {
      render(<Spinner label="Fetching results" />);
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('');
      expect(status).not.toHaveTextContent('Fetching results');
      await React.act(nextFrame);
      expect(status).toHaveTextContent('Fetching results');
    });

    it('updates the text of a mounted region when the label changes', async () => {
      const { rerender } = render(<Spinner label="Loading" />);
      await React.act(nextFrame);
      rerender(<Spinner label="Saving" />);
      expect(screen.getByRole('status')).toHaveTextContent('Saving');
    });

    it('cancels its pending frame when it unmounts before the frame', () => {
      const request = vi.spyOn(window, 'requestAnimationFrame');
      const cancel = vi.spyOn(window, 'cancelAnimationFrame');
      const { unmount } = render(<Spinner />);
      expect(request).toHaveBeenCalledTimes(1);
      const handle = request.mock.results[0]?.value as number;
      expect(cancel).not.toHaveBeenCalled();
      unmount();
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledWith(handle);
    });
  });

  it('renders label as sr-only by default', async () => {
    render(<Spinner label="Loading" />);
    await React.act(nextFrame);
    const label = screen.getByText('Loading');
    expect(label).toHaveClass('wave:sr-only');
    expect(label).not.toHaveClass('wave:text-body-1');
  });

  it('renders label visibly when labelVisible is true', async () => {
    render(<Spinner label="Loading" labelVisible />);
    await React.act(nextFrame);
    const label = screen.getByText('Loading');
    expect(label).not.toHaveClass('wave:sr-only');
    expect(label).toHaveClass('wave:text-body-1', 'wave:text-muted-foreground');
  });

  it('renders one label element whether or not it is visible (single render path)', async () => {
    const { rerender } = render(<Spinner label="Loading" data-testid="sp" />);
    await React.act(nextFrame);
    const root = screen.getByTestId('sp');
    const hidden = root.querySelector('[data-wave-spinner-label]');
    rerender(<Spinner label="Loading" labelVisible data-testid="sp" />);
    const visible = root.querySelector('[data-wave-spinner-label]');
    expect(hidden).not.toBeNull();
    expect(visible).toBe(hidden);
    expect(root.querySelectorAll('[data-wave-spinner-label]')).toHaveLength(1);
  });

  it('renders a decorative, token-colored ring with reduced-motion alternate', () => {
    render(<Spinner data-testid="sp" />);
    const ring = screen.getByTestId('sp').querySelector('[data-wave-spinner-ring]');
    expect(ring).not.toBeNull();
    expect(ring).toHaveAttribute('aria-hidden', 'true');
    expect(ring).toHaveClass(
      'wave:border-track',
      'wave:border-t-primary',
      'wave:animate-wave-spin',
      'wave:motion-reduce:animate-wave-spin-slow',
    );
    expect(ring?.className).not.toMatch(/\[#|animate-\[/);
  });

  it('keeps the arc visible in forced colors (forcedColors.ringArc)', () => {
    render(<Spinner data-testid="sp" />);
    const ring = screen.getByTestId('sp').querySelector('[data-wave-spinner-ring]');
    // Forced colors would paint all four borders alike: the track takes Canvas, the arc Highlight.
    expect(ring).toHaveClass(
      'wave:forced-colors:forced-color-adjust-none',
      'wave:forced-colors:border-[Canvas]',
      'wave:forced-colors:border-t-[Highlight]',
    );
  });

  it('applies size classes', () => {
    render(<Spinner size="large" data-testid="sp" />);
    const ring = screen.getByTestId('sp').querySelector('[data-wave-spinner-ring]');
    expect(ring).toHaveClass('wave:w-9', 'wave:h-9');
  });

  it('defaults to medium size', () => {
    render(<Spinner data-testid="sp" />);
    const ring = screen.getByTestId('sp').querySelector('[data-wave-spinner-ring]');
    expect(ring).toHaveClass('wave:w-6', 'wave:h-6');
  });

  describe('appearance', () => {
    it('defaults to primary: a primary arc on the track, data-appearance="primary"', async () => {
      render(<Spinner label="Loading" labelVisible data-testid="sp" />);
      const root = screen.getByTestId('sp');
      expect(root).toHaveAttribute('data-appearance', 'primary');
      expect(ringOf(root)).toHaveClass('wave:border-track', 'wave:border-t-primary');
      await React.act(nextFrame);
      expect(screen.getByText('Loading')).toHaveClass('wave:text-muted-foreground');
    });

    it('inverted draws the arc, a 30% track and the visible label in the current text color', async () => {
      render(<Spinner appearance="inverted" label="Saving" labelVisible data-testid="sp" />);
      const root = screen.getByTestId('sp');
      expect(root).toHaveAttribute('data-appearance', 'inverted');
      const ring = ringOf(root);
      expect(ring).toHaveClass(
        'wave:border-current/30',
        'wave:border-t-current',
        'wave:animate-wave-spin',
        'wave:motion-reduce:animate-wave-spin-slow',
        // Forced colors keep the Highlight arc on a Canvas track.
        'wave:forced-colors:forced-color-adjust-none',
        'wave:forced-colors:border-[Canvas]',
        'wave:forced-colors:border-t-[Highlight]',
      );
      expect(ring).not.toHaveClass('wave:border-track');
      expect(ring).not.toHaveClass('wave:border-t-primary');
      await React.act(nextFrame);
      const label = screen.getByText('Saving');
      expect(label).toHaveClass('wave:text-body-1', 'wave:text-current');
      expect(label).not.toHaveClass('wave:text-muted-foreground');
    });

    it.each([
      ['an unknown string', 'pink'],
      ['null', null],
    ])(
      'falls back to primary for %s from untyped code instead of failing to render',
      (_label, appearance) => {
        render(
          <Spinner
            appearance={appearance as unknown as SpinnerAppearance}
            label="Loading"
            data-testid="sp"
          />,
        );
        const root = screen.getByTestId('sp');
        expect(root).toHaveAttribute('data-appearance', 'primary');
        expect(ringOf(root)).toHaveClass('wave:border-track', 'wave:border-t-primary');
      },
    );

    it('keeps an inverted label that is not visible screen-reader only', async () => {
      render(<Spinner appearance="inverted" label="Saving" />);
      await React.act(nextFrame);
      expect(screen.getByText('Saving')).toHaveClass('wave:sr-only');
    });

    it('has no accessibility violations inside a primary button (inverted)', async () => {
      // A stand-in with the primary Button's colors and the recommended pattern (the Spinner in a
      // decorative icon box, the text names the button); the real Button is covered by the stories
      // gate and the integration suite.
      render(
        <button type="button" className="bg-primary text-primary-foreground">
          <span aria-hidden="true">
            <Spinner appearance="inverted" size="extra-small" label="Saving changes" />
          </span>
          Saving
        </button>,
      );
      await React.act(nextFrame);
      expect(screen.getByRole('button', { name: 'Saving' })).toBeInTheDocument();
      expect(ringOf(screen.getByRole('status', { hidden: true }))).toHaveClass(
        'wave:border-t-current',
      );
      await expectNoA11yViolations();
    });

    it('types appearance', () => {
      expectTypeOf<SpinnerAppearance>().toEqualTypeOf<'primary' | 'inverted'>();
      expectTypeOf<SpinnerProps['appearance']>().toEqualTypeOf<SpinnerAppearance | undefined>();
      expectTypeOf<SpinnerProps['delay']>().toEqualTypeOf<number | undefined>();
    });
  });

  describe('delay', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const advance = (ms: number) => {
      React.act(() => {
        vi.advanceTimersByTime(ms);
      });
    };

    it('is shown at once without a delay: data-state="shown"', () => {
      render(<Spinner data-testid="sp" />);
      const root = screen.getByTestId('sp');
      expect(root).toHaveAttribute('data-state', 'shown');
      expect(ringOf(root)).not.toBeNull();
    });

    it('renders the empty status region at once, then the ring after the delay, then the label a frame later', () => {
      render(<Spinner delay={800} label="Loading results" data-testid="sp" />);
      const root = screen.getByTestId('sp');
      expect(screen.getByRole('status')).toBe(root);
      expect(root).toHaveAttribute('data-state', 'delayed');
      expect(ringOf(root)).toBeNull();
      expect(root).toHaveTextContent('');

      advance(799);
      expect(root).toHaveAttribute('data-state', 'delayed');
      expect(ringOf(root)).toBeNull();
      expect(root).toHaveTextContent('');

      advance(1);
      expect(root).toHaveAttribute('data-state', 'shown');
      expect(ringOf(root)).not.toBeNull();
      // The announcement is still deferred by one frame from when the spinner is shown.
      expect(root).toHaveTextContent('');
      React.act(() => {
        vi.advanceTimersToNextFrame();
      });
      expect(screen.getByRole('status')).toHaveTextContent('Loading results');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('requests no frame while delayed', () => {
      const request = vi.spyOn(window, 'requestAnimationFrame');
      render(<Spinner delay={300} />);
      expect(request).not.toHaveBeenCalled();
      advance(300);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('leaves no timer when it unmounts during the delay', () => {
      const { unmount } = render(<Spinner delay={500} />);
      expect(vi.getTimerCount()).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('restarts the wait with a delay that changes while delayed, and stays shown once shown', () => {
      const { rerender } = render(<Spinner delay={500} data-testid="sp" />);
      const root = screen.getByTestId('sp');
      advance(300);
      rerender(<Spinner delay={1000} data-testid="sp" />);
      advance(999);
      expect(root).toHaveAttribute('data-state', 'delayed');
      advance(1);
      expect(root).toHaveAttribute('data-state', 'shown');
      rerender(<Spinner delay={2000} data-testid="sp" />);
      expect(root).toHaveAttribute('data-state', 'shown');
      expect(ringOf(root)).not.toBeNull();
    });

    it.each([-100, NaN, Infinity])('treats a delay of %s as 0 (shown at once)', (delay) => {
      render(<Spinner delay={delay} data-testid="sp" />);
      const root = screen.getByTestId('sp');
      expect(root).toHaveAttribute('data-state', 'shown');
      expect(ringOf(root)).not.toBeNull();
    });

    it('shows once under StrictMode (effects re-run)', () => {
      render(
        <React.StrictMode>
          <Spinner delay={400} label="Loading" data-testid="sp" />
        </React.StrictMode>,
      );
      const root = screen.getByTestId('sp');
      expect(ringOf(root)).toBeNull();
      advance(400);
      expect(ringOf(root)).not.toBeNull();
      React.act(() => {
        vi.advanceTimersToNextFrame();
      });
      expect(root).toHaveTextContent(/^Loading$/);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('renders the empty region without a ring on the server, and hydrates without a mismatch', () => {
      const html = renderToString(<Spinner delay={200} label="Loading" />);
      expect(html).toContain('role="status"');
      expect(html).toContain('data-state="delayed"');
      expect(html).not.toContain('data-wave-spinner-ring');
      expect(html).not.toContain('Loading');
      expect(renderToString(<Spinner label="Loading" />)).toContain('data-wave-spinner-ring');

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        React.act(() => {
          root = hydrateRoot(container, <Spinner delay={200} label="Loading" />);
        });
        expect(error).not.toHaveBeenCalled();
        advance(200);
        expect(container.querySelector('[data-wave-spinner-ring]')).not.toBeNull();
      } finally {
        React.act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });
  });

  it('SpinnerProps carries ref (C-REF)', () => {
    expectTypeOf<SpinnerProps['ref']>().toEqualTypeOf<React.Ref<HTMLSpanElement> | undefined>();
  });
});

describe('Spinner — size scale, label position, label content and context', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ringClasses = (root: HTMLElement) => ringOf(root)?.className ?? '';

  it("keeps the pixel sizes of the 0.x names and adds Fluent's extra-tiny, tiny and huge", () => {
    const expected: Array<[SpinnerSize, string]> = [
      ['extra-tiny', 'wave:w-4'],
      ['tiny', 'wave:w-5'],
      ['extra-small', 'wave:w-3'],
      ['small', 'wave:w-4'],
      ['medium', 'wave:w-6'],
      ['large', 'wave:w-9'],
      ['huge', 'wave:w-11'],
      ['extra-large', 'wave:w-12'],
    ];
    for (const [size, width] of expected) {
      const view = render(<Spinner size={size} data-testid="sp" />);
      const ring = ringOf(screen.getByTestId('sp'));
      expect(ring).toHaveClass(width, width.replace('w-', 'h-'));
      view.unmount();
    }
  });

  it('renders a size outside the scale (untyped code) as medium', () => {
    render(<Spinner size={'colossal' as SpinnerSize} data-testid="sp" />);
    expect(ringOf(screen.getByTestId('sp'))).toHaveClass('wave:w-6', 'wave:h-6');
  });

  describe('SpinnerContextProvider', () => {
    it("gives a Spinner without a size the provider's size", () => {
      render(
        <SpinnerContextProvider size="tiny">
          <Spinner data-testid="sp" />
        </SpinnerContextProvider>,
      );
      expect(ringClasses(screen.getByTestId('sp'))).toContain('wave:w-5');
    });

    it("lets the Spinner's own size win and the nearest provider answer", () => {
      render(
        <SpinnerContextProvider size="tiny">
          <Spinner size="large" data-testid="own" />
          <SpinnerContextProvider size="huge">
            <Spinner data-testid="inner" />
          </SpinnerContextProvider>
          <SpinnerContextProvider>
            <Spinner data-testid="empty" />
          </SpinnerContextProvider>
        </SpinnerContextProvider>,
      );
      expect(ringClasses(screen.getByTestId('own'))).toContain('wave:w-9');
      expect(ringClasses(screen.getByTestId('inner'))).toContain('wave:w-11');
      // A provider without a size gives none: the default applies.
      expect(ringClasses(screen.getByTestId('empty'))).toContain('wave:w-6');
    });

    it('renders no element and has a display name', () => {
      const { container } = render(
        <SpinnerContextProvider size="small">
          <i />
        </SpinnerContextProvider>,
      );
      expect(container.innerHTML).toBe('<i></i>');
      expect(SpinnerContextProvider.displayName).toBe('SpinnerContextProvider');
    });
  });

  describe('labelPosition', () => {
    const cases: Array<[LabelPosition, string]> = [
      ['after', 'wave:flex-row'],
      ['before', 'wave:flex-row-reverse'],
      ['below', 'wave:flex-col'],
      ['above', 'wave:flex-col-reverse'],
    ];
    it.each(cases)(
      '%s lays the root out as %s and renders data-label-position',
      (position, cls) => {
        render(<Spinner labelPosition={position} labelVisible data-testid="sp" />);
        const root = screen.getByTestId('sp');
        expect(root).toHaveAttribute('data-label-position', position);
        expect(root).toHaveClass(cls);
      },
    );

    it('defaults to after and keeps the DOM order (ring, then label) in every position', () => {
      render(<Spinner data-testid="sp" />);
      expect(screen.getByTestId('sp')).toHaveAttribute('data-label-position', 'after');
      for (const position of ['before', 'above', 'below'] as const) {
        const view = render(<Spinner labelPosition={position} data-testid={position} />);
        const root = screen.getByTestId(position);
        expect(root.children[0]).toHaveAttribute('data-wave-spinner-ring');
        expect(root.children[1]).toHaveAttribute('data-wave-spinner-label');
        view.unmount();
      }
    });

    it('reads an unknown position (untyped code) as after', () => {
      render(<Spinner labelPosition={'sideways' as LabelPosition} data-testid="sp" />);
      expect(screen.getByTestId('sp')).toHaveAttribute('data-label-position', 'after');
    });

    it('puts a before label at the start in right-to-left too (the reversed row follows direction)', () => {
      renderWithProviders(<Spinner labelPosition="before" labelVisible data-testid="sp" />, {
        dir: 'rtl',
      });
      expect(screen.getByTestId('sp')).toHaveClass('wave:flex-row-reverse');
    });
  });

  describe('label content', () => {
    it('announces and shows a ReactNode label', async () => {
      render(
        <Spinner
          label={
            <>
              Loading <strong>results</strong>
            </>
          }
          labelVisible
          data-testid="sp"
        />,
      );
      await React.act(nextFrame);
      const root = screen.getByTestId('sp');
      expect(root).toHaveTextContent('Loading results');
      expect(root.querySelector('strong')).not.toBeNull();
    });

    it('names a progressbar by a string label, and warns once without a name for other content', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Spinner role="progressbar" label="Fetching" />);
      expect(screen.getByRole('progressbar', { name: 'Fetching' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
      render(<Spinner role="progressbar" label={<b>Fetching</b>} aria-label="Named" />);
      expect(warn).not.toHaveBeenCalled();
      render(<Spinner role="progressbar" label={<b>Fetching</b>} data-testid="unnamed" />);
      await React.act(nextFrame);
      expect(screen.getByTestId('unnamed')).not.toHaveAttribute('aria-label');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('`role="progressbar"` needs an accessible name');
    });
  });

  it('has no accessibility violations with a visible label below a tiny ring', async () => {
    render(<Spinner size="tiny" labelPosition="below" labelVisible label="Saving" />);
    await React.act(nextFrame);
    await expectNoA11yViolations();
  });

  it('types the new props', () => {
    expectTypeOf<SpinnerProps['size']>().toEqualTypeOf<SpinnerSize | undefined>();
    expectTypeOf<SpinnerProps['labelPosition']>().toEqualTypeOf<LabelPosition | undefined>();
    expectTypeOf<SpinnerProps['label']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<'extra-tiny' | 'tiny' | 'huge' | 'medium'>().toExtend<SpinnerSize>();
  });
});

describe('Spinner — slotProps', () => {
  type SpinnerSlotProps = NonNullable<SpinnerProps['slotProps']>;
  const EVERY_PART: SpinnerSlotProps = { spinner: {}, label: {} };
  const all = (root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`));
  const partsOf = (root: ParentNode = document) => [
    ...all(root, spinnerClassNames.spinner),
    ...all(root, spinnerClassNames.label),
  ];
  const RING =
    'wave-spinner__spinner wave:rounded-full wave:border-2 wave:animate-wave-spin wave:motion-reduce:animate-wave-spin-slow';
  const FORCED =
    'wave:forced-colors:forced-color-adjust-none wave:forced-colors:border-[Canvas] wave:forced-colors:border-t-[Highlight]';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A shown spinner, a visible inverted one and one that waits for its delay. */
  function Spinners({ slotProps }: { slotProps?: SpinnerSlotProps }) {
    return (
      <>
        <Spinner label="Loading results" slotProps={slotProps} />
        <Spinner
          label="Saving"
          labelVisible
          appearance="inverted"
          size="large"
          slotProps={slotProps}
        />
        <Spinner label="Later" delay={500} slotProps={slotProps} />
      </>
    );
  }

  // Captured from 54699b8's dist (client and server agree).
  const BASE_PINS = [
    `<span aria-hidden="true" class="${RING} wave:border-track wave:border-t-primary ${FORCED} wave:w-6 wave:h-6" data-wave-spinner-ring="">`,
    `<span aria-hidden="true" class="${RING} wave:border-current/30 wave:border-t-current ${FORCED} wave:w-9 wave:h-9" data-wave-spinner-ring="">`,
    '<span class="wave-spinner__label wave:sr-only" data-wave-spinner-label="">',
    '<span class="wave-spinner__label wave:text-body-1 wave:text-current" data-wave-spinner-label="">',
    '<span class="wave-spinner__label wave:sr-only" data-wave-spinner-label="">',
  ].join('\n');

  it('renders the parts of 54699b8 (attributes sorted), on the client and the server', () => {
    for (const slotProps of [undefined, EVERY_PART]) {
      const view = render(<Spinners slotProps={slotProps} />);
      expect(openingTags(...partsOf())).toBe(BASE_PINS);
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Spinners slotProps={slotProps} />);
      expect(openingTags(...partsOf(template.content))).toBe(BASE_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    expectInertSlotProps(
      (slotProps: SpinnerSlotProps | undefined) => <Spinners slotProps={slotProps} />,
      EVERY_PART,
    );
    expectInertSlotProps(
      (slotProps: SpinnerSlotProps | undefined) => (
        <>
          <Spinner role="progressbar" slotProps={slotProps} />
          <Spinner role="none" size="extra-small" slotProps={slotProps} />
        </>
      ),
      EVERY_PART,
    );
  });

  it('does not pass slotProps to the root', () => {
    const error = vi.spyOn(console, 'error');
    render(<Spinner data-testid="sp" slotProps={EVERY_PART} />);
    expect(screen.getByTestId('sp')).not.toHaveAttribute('slotprops');
    expect(error).not.toHaveBeenCalled();
  });

  it('puts your className, style, data-* and ref on each part', () => {
    const refs: Element[] = [];
    const collect = (node: Element | null) => void (node && refs.push(node));
    render(
      <Spinner
        labelVisible
        slotProps={{
          spinner: {
            className: 'my-ring border-4',
            style: { opacity: 0.5 },
            'data-part': 'spinner',
            ref: collect,
          },
          label: {
            className: 'my-label text-body-2',
            style: { opacity: 0.5 },
            'data-part': 'label',
            ref: collect,
          },
        }}
      />,
    );
    for (const [cls, name, mine, conflict] of [
      [spinnerClassNames.spinner, 'spinner', 'my-ring', 'wave:border-2'],
      [spinnerClassNames.label, 'label', 'my-label', 'wave:text-body-1'],
    ] as const) {
      const [element] = all(document, cls);
      expect(element.classList[0]).toBe(cls);
      expect(element).toHaveClass(mine);
      // Your class replaces a conflicting one of the part.
      expect(element).not.toHaveClass(conflict);
      expect(element).toHaveAttribute('data-part', name);
      expect(element).toHaveStyle({ opacity: '0.5' });
      expect(refs).toContain(element);
    }
    expect(refs).toHaveLength(2);
  });

  it('locks the attributes the spinner sets on its parts, and keeps announcing the label', async () => {
    const ringAttempt = {
      'aria-hidden': false,
      'data-wave-spinner-ring': 'mine',
      role: 'img',
      tabIndex: 0,
      hidden: true,
    } as unknown as SpinnerSlotProps['spinner'];
    const labelAttempt = {
      'data-wave-spinner-label': 'mine',
      role: 'alert',
      'aria-live': 'off',
      'aria-label': 'Mine',
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as SpinnerSlotProps['label'];
    const slotProps = { spinner: ringAttempt, label: labelAttempt };
    const view = render(<Spinners slotProps={slotProps} />);
    expect(openingTags(...partsOf())).toBe(BASE_PINS);
    view.unmount();
    render(<Spinner label="Loading results" slotProps={slotProps} />);
    await React.act(nextFrame);
    // The status region announces the label's text, and the label is no region of its own.
    expect(screen.getByRole('status')).toHaveTextContent('Loading results');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('while delayed', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('applies the spinner part once the ring is shown', () => {
      const ref = vi.fn();
      render(
        <Spinner
          delay={300}
          data-testid="sp"
          slotProps={{ spinner: { ref, className: 'my-ring' }, label: { className: 'my-label' } }}
        />,
      );
      const root = screen.getByTestId('sp');
      expect(ringOf(root)).toBeNull();
      expect(ref).not.toHaveBeenCalled();
      expect(all(root, spinnerClassNames.label)[0]).toHaveClass('my-label');
      React.act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(ringOf(root)).toHaveClass('my-ring');
      expect(ref).toHaveBeenCalledWith(ringOf(root));
    });
  });

  it('gives the parts no handler of the spinner: yours run', () => {
    const order: string[] = [];
    render(
      <Spinner
        labelVisible
        data-testid="sp"
        slotProps={{
          spinner: { onClick: () => void order.push('spinner') },
          label: { onClick: () => void order.push('label') },
        }}
      />,
    );
    const root = screen.getByTestId('sp');
    fireEvent.click(ringOf(root) as HTMLElement);
    fireEvent.click(all(root, spinnerClassNames.label)[0]);
    expect(order).toEqual(['spinner', 'label']);
  });

  it('has no axe violations with parts once announced', async () => {
    render(
      <Spinner
        label="Loading data"
        labelVisible
        slotProps={{ spinner: { className: 'my-ring' }, label: { className: 'my-label', id: 'l' } }}
      />,
    );
    await React.act(nextFrame);
    await expectNoA11yViolations();
  });

  it('types the parts by their elements and takes no children', () => {
    expectTypeOf<NonNullable<SpinnerSlotProps['spinner']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<SpinnerSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<keyof SpinnerSlotProps>().toEqualTypeOf<'spinner' | 'label'>();
    const elements = [
      // @ts-expect-error a part takes no children
      <Spinner key="1" slotProps={{ spinner: { children: 'x' } }} />,
      // @ts-expect-error a part takes no children
      <Spinner key="2" slotProps={{ label: { children: 'x' } }} />,
    ];
    expect(elements).toHaveLength(2);
  });
});
