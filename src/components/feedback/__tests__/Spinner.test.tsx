import { describe, it, expect, expectTypeOf, vi, afterEach, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { Spinner } from '../Spinner';
import type { SpinnerAppearance, SpinnerProps } from '../Spinner';
import { expectNoA11yViolations, testSystemProps } from '../../../test-utils';

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
    expect(label).toHaveClass('sr-only');
    expect(label).not.toHaveClass('text-body-1');
  });

  it('renders label visibly when labelVisible is true', async () => {
    render(<Spinner label="Loading" labelVisible />);
    await React.act(nextFrame);
    const label = screen.getByText('Loading');
    expect(label).not.toHaveClass('sr-only');
    expect(label).toHaveClass('text-body-1', 'text-muted-foreground');
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
      'border-track',
      'border-t-primary',
      'animate-wave-spin',
      'motion-reduce:animate-wave-spin-slow',
    );
    expect(ring?.className).not.toMatch(/\[#|animate-\[/);
  });

  it('keeps the arc visible in forced colors (forcedColors.ringArc)', () => {
    render(<Spinner data-testid="sp" />);
    const ring = screen.getByTestId('sp').querySelector('[data-wave-spinner-ring]');
    // Forced colors would paint all four borders alike: the track takes Canvas, the arc Highlight.
    expect(ring).toHaveClass(
      'forced-colors:forced-color-adjust-none',
      'forced-colors:border-[Canvas]',
      'forced-colors:border-t-[Highlight]',
    );
  });

  it('applies size classes', () => {
    render(<Spinner size="large" data-testid="sp" />);
    const ring = screen.getByTestId('sp').querySelector('[data-wave-spinner-ring]');
    expect(ring).toHaveClass('w-9', 'h-9');
  });

  it('defaults to medium size', () => {
    render(<Spinner data-testid="sp" />);
    const ring = screen.getByTestId('sp').querySelector('[data-wave-spinner-ring]');
    expect(ring).toHaveClass('w-6', 'h-6');
  });

  describe('appearance', () => {
    it('defaults to primary: a primary arc on the track, data-appearance="primary"', async () => {
      render(<Spinner label="Loading" labelVisible data-testid="sp" />);
      const root = screen.getByTestId('sp');
      expect(root).toHaveAttribute('data-appearance', 'primary');
      expect(ringOf(root)).toHaveClass('border-track', 'border-t-primary');
      await React.act(nextFrame);
      expect(screen.getByText('Loading')).toHaveClass('text-muted-foreground');
    });

    it('inverted draws the arc, a 30% track and the visible label in the current text color', async () => {
      render(<Spinner appearance="inverted" label="Saving" labelVisible data-testid="sp" />);
      const root = screen.getByTestId('sp');
      expect(root).toHaveAttribute('data-appearance', 'inverted');
      const ring = ringOf(root);
      expect(ring).toHaveClass(
        'border-current/30',
        'border-t-current',
        'animate-wave-spin',
        'motion-reduce:animate-wave-spin-slow',
        // Forced colors keep the Highlight arc on a Canvas track.
        'forced-colors:forced-color-adjust-none',
        'forced-colors:border-[Canvas]',
        'forced-colors:border-t-[Highlight]',
      );
      expect(ring).not.toHaveClass('border-track');
      expect(ring).not.toHaveClass('border-t-primary');
      await React.act(nextFrame);
      const label = screen.getByText('Saving');
      expect(label).toHaveClass('text-body-1', 'text-current');
      expect(label).not.toHaveClass('text-muted-foreground');
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
        expect(ringOf(root)).toHaveClass('border-track', 'border-t-primary');
      },
    );

    it('keeps an inverted label that is not visible screen-reader only', async () => {
      render(<Spinner appearance="inverted" label="Saving" />);
      await React.act(nextFrame);
      expect(screen.getByText('Saving')).toHaveClass('sr-only');
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
      expect(ringOf(screen.getByRole('status', { hidden: true }))).toHaveClass('border-t-current');
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
