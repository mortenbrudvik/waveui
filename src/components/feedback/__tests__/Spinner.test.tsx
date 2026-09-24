import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Spinner } from '../Spinner';
import type { SpinnerProps } from '../Spinner';
import { expectNoA11yViolations, testSystemProps } from '../../../test-utils';

/** Resolves after the next animation frame has run (and React has committed its update). */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

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

    it('does not update after unmounting before the frame', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { unmount } = render(<Spinner />);
      unmount();
      await nextFrame();
      expect(error).not.toHaveBeenCalled();
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

  it('SpinnerProps carries ref (C-REF)', () => {
    expectTypeOf<SpinnerProps['ref']>().toEqualTypeOf<React.Ref<HTMLSpanElement> | undefined>();
  });
});
