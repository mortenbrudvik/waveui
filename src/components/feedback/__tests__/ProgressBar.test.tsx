import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';
import type { ProgressBarProps } from '../ProgressBar';
import { axe, renderWithProviders, testSystemProps } from '../../../test-utils';

const fillOf = (bar: HTMLElement) => bar.firstElementChild as HTMLElement;

const warnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.map((call) => String(call[0]));

describe('ProgressBar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(ProgressBar, {
    expectedTag: 'div',
    displayName: 'ProgressBar',
    defaultProps: { label: 'Loading' },
    conflictingClass: { className: 'h-1', overrides: 'h-2' },
    a11yVariants: [
      { name: 'determinate', props: { value: 40 } },
      { name: 'visible label', props: { value: 40, showLabel: true } },
      { name: 'aria-label', props: { label: undefined, 'aria-label': 'Syncing' } },
      { name: 'out of range', props: { value: 150 } },
      { name: 'max 0', props: { value: 0, max: 0 } },
    ],
  });

  it('renders with role="progressbar"', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ProgressBar data-testid="pb" />);
    expect(screen.getByTestId('pb')).toHaveAttribute('role', 'progressbar');
  });

  it('sets aria-valuenow and aria-valuemax for determinate bar', () => {
    render(<ProgressBar value={50} max={200} label="Upload" />);
    const el = screen.getByRole('progressbar', { name: 'Upload' });
    expect(el).toHaveAttribute('aria-valuenow', '50');
    expect(el).toHaveAttribute('aria-valuemax', '200');
    expect(el).toHaveAttribute('aria-valuemin', '0');
    expect(fillOf(el).style.width).toBe('25%');
  });

  it('defaults max to 100', () => {
    render(<ProgressBar value={30} label="Upload" />);
    expect(screen.getByRole('progressbar', { name: 'Upload' })).toHaveAttribute(
      'aria-valuemax',
      '100',
    );
  });

  it('does not set aria-valuenow when indeterminate', () => {
    render(<ProgressBar label="Syncing" />);
    expect(screen.getByRole('progressbar', { name: 'Syncing' })).not.toHaveAttribute(
      'aria-valuenow',
    );
  });

  it('sets aria-label from label prop', () => {
    render(<ProgressBar label="Loading" data-testid="pb" />);
    const el = screen.getByTestId('pb');
    expect(el).toHaveAttribute('aria-label', 'Loading');
    expect(el).not.toHaveAttribute('aria-labelledby');
  });

  it('calculates width percentage correctly', () => {
    render(<ProgressBar value={75} max={100} label="Upload" />);
    expect(fillOf(screen.getByRole('progressbar')).style.width).toBe('75%');
  });

  describe('clamping (feedback-navigation#16)', () => {
    it('clamps value 150 of 100 to 100 for both the width and aria-valuenow', () => {
      render(<ProgressBar value={150} max={100} label="Upload" />);
      const el = screen.getByRole('progressbar', { name: 'Upload' });
      expect(el).toHaveAttribute('aria-valuenow', '100');
      expect(fillOf(el).style.width).toBe('100%');
    });

    it('clamps value -5 to 0', () => {
      render(<ProgressBar value={-5} label="Upload" />);
      const el = screen.getByRole('progressbar', { name: 'Upload' });
      expect(el).toHaveAttribute('aria-valuenow', '0');
      expect(fillOf(el).style.width).toBe('0%');
    });

    it('renders 0% (not a full bar) for max 0 and warns in development', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={0} max={0} label="Upload" />);
      const el = screen.getByRole('progressbar', { name: 'Upload' });
      expect(fillOf(el).style.width).toBe('0%');
      expect(el).toHaveAttribute('aria-valuenow', '0');
      expect(el).toHaveAttribute('aria-valuemax', '100');
      const messages = warnings(warn).filter((m) => m.includes('`max`'));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/^\[WaveUI\] ProgressBar:/);
    });

    it('renders 0% for a negative max', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={5} max={-10} label="Upload" />);
      expect(fillOf(screen.getByRole('progressbar')).style.width).toBe('0%');
    });

    it('renders 0% for a NaN value and warns in development', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={NaN} label="Upload" />);
      const el = screen.getByRole('progressbar', { name: 'Upload' });
      expect(fillOf(el).style.width).toBe('0%');
      expect(el).toHaveAttribute('aria-valuenow', '0');
      expect(warnings(warn).some((m) => m.includes('`value`'))).toBe(true);
    });

    it('renders 0% for a NaN max', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={5} max={NaN} label="Upload" />);
      const el = screen.getByRole('progressbar', { name: 'Upload' });
      expect(fillOf(el).style.width).toBe('0%');
      expect(el).toHaveAttribute('aria-valuemax', '100');
    });

    it('does not warn for valid values', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={100} max={100} label="Upload" />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('naming (feedback-navigation#17)', () => {
    it('showLabel renders the label visibly above the bar and names the bar with it', () => {
      render(<ProgressBar value={40} label="Uploading files" showLabel data-testid="pb" />);
      const bar = screen.getByRole('progressbar', { name: 'Uploading files' });
      expect(bar).toBe(screen.getByTestId('pb'));
      expect(bar).not.toHaveAttribute('aria-label');
      const label = screen.getByText('Uploading files');
      expect(label).not.toHaveClass('sr-only');
      expect(bar.getAttribute('aria-labelledby')).toBe(label.id);
      expect(label.id).not.toBe('');
      // The label comes first in the DOM (above the bar).
      expect(label.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('gives two visible labels distinct ids', () => {
      render(
        <>
          <ProgressBar value={10} label="Upload" showLabel />
          <ProgressBar value={20} label="Sync" showLabel />
        </>,
      );
      const upload = screen.getByRole('progressbar', { name: 'Upload' });
      const sync = screen.getByRole('progressbar', { name: 'Sync' });
      expect(upload.getAttribute('aria-labelledby')).not.toBe(sync.getAttribute('aria-labelledby'));
    });

    it('lets a consumer aria-labelledby win', () => {
      render(
        <>
          <h2 id="upload-heading">Photos</h2>
          <ProgressBar value={10} label="Upload" showLabel aria-labelledby="upload-heading" />
        </>,
      );
      expect(screen.getByRole('progressbar', { name: 'Photos' })).toBeInTheDocument();
    });

    it('lets a consumer aria-label win over label', () => {
      render(<ProgressBar value={10} label="Upload" aria-label="Photo upload" />);
      expect(screen.getByRole('progressbar', { name: 'Photo upload' })).toBeInTheDocument();
    });

    it('lets a consumer aria-label win over the visible label of showLabel', () => {
      render(<ProgressBar value={10} label="Upload" showLabel aria-label="Photo upload" />);
      const bar = screen.getByRole('progressbar', { name: 'Photo upload' });
      expect(bar).toHaveAttribute('aria-label', 'Photo upload');
      expect(bar).not.toHaveAttribute('aria-labelledby');
      // The label stays visible text.
      expect(screen.getByText('Upload')).not.toHaveClass('sr-only');
    });

    it('keeps the label-derived name when a wrapper forwards undefined name props', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <ProgressBar value={10} label="Upload" aria-label={undefined} />
          <ProgressBar
            value={20}
            label="Sync"
            showLabel
            aria-label={undefined}
            aria-labelledby={undefined}
          />
        </>,
      );
      expect(screen.getByRole('progressbar', { name: 'Upload' })).toHaveAttribute(
        'aria-label',
        'Upload',
      );
      expect(screen.getByRole('progressbar', { name: 'Sync' })).toHaveAttribute('aria-labelledby');
      expect(warn).not.toHaveBeenCalled();
    });

    it('treats an empty aria-label or aria-labelledby like undefined: the label names the bar', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <ProgressBar value={1} label="Upload" aria-label="" />
          <ProgressBar value={2} label="Sync" showLabel aria-labelledby="" />
          <ProgressBar value={3} label="Backup" aria-label="  " aria-labelledby="" />
        </>,
      );
      const upload = screen.getByRole('progressbar', { name: 'Upload' });
      expect(upload).toHaveAttribute('aria-label', 'Upload');
      expect(upload).not.toHaveAttribute('aria-labelledby');
      const sync = screen.getByRole('progressbar', { name: 'Sync' });
      expect(sync.getAttribute('aria-labelledby')).toBe(screen.getByText('Sync').id);
      expect(sync).not.toHaveAttribute('aria-label');
      const backup = screen.getByRole('progressbar', { name: 'Backup' });
      expect(backup).toHaveAttribute('aria-label', 'Backup');
      expect(backup).not.toHaveAttribute('aria-labelledby');
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns when every name prop is empty, and renders no empty name attributes', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={1} label="" aria-label="" aria-labelledby=" " data-testid="pb" />);
      const bar = screen.getByTestId('pb');
      expect(bar).not.toHaveAttribute('aria-label');
      expect(bar).not.toHaveAttribute('aria-labelledby');
      const messages = warnings(warn).filter((m) => m.includes('accessible name'));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/^\[WaveUI\] ProgressBar:/);
    });

    it('keeps its role and values when a wrapper forwards them as undefined', () => {
      render(
        <ProgressBar
          value={30}
          label="Upload"
          role={undefined}
          aria-valuemin={undefined}
          aria-valuemax={undefined}
          aria-valuenow={undefined}
        />,
      );
      const bar = screen.getByRole('progressbar', { name: 'Upload' });
      expect(bar).toHaveAttribute('aria-valuenow', '30');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });

    it('still lets a consumer override the role', () => {
      render(<ProgressBar value={30} label="Upload" role="meter" />);
      expect(screen.getByRole('meter', { name: 'Upload' })).toBeInTheDocument();
    });

    it('does not warn when named with label, aria-label or aria-labelledby', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <span id="ext">External</span>
          <ProgressBar value={1} label="A" />
          <ProgressBar value={1} aria-label="B" />
          <ProgressBar aria-labelledby="ext" />
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['determinate', { value: 60 }],
      ['indeterminate', {}],
    ] as const)(
      'unlabeled %s bar: warns in development, and axe reports the missing name',
      async (_, props) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<ProgressBar {...props} />);
        const messages = warnings(warn).filter((m) => m.includes('accessible name'));
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatch(/^\[WaveUI\] ProgressBar:/);
        const results = await axe(document.body);
        expect(results.violations.map((violation) => violation.id)).toContain(
          'aria-progressbar-name',
        );
      },
    );

    it('warns when showLabel is set without a label', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={5} showLabel aria-label="Upload" />);
      expect(warnings(warn).some((m) => m.includes('showLabel'))).toBe(true);
    });
  });

  describe('styles', () => {
    it('uses the track token and a forced-colors border on the track (input-basic#9)', () => {
      render(<ProgressBar value={40} label="Upload" />);
      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveClass(
        'bg-track',
        'rounded-full',
        'forced-colors:border',
        'forced-colors:border-[CanvasText]',
      );
      expect(bar.className).not.toMatch(/\[#/);
    });

    it('fills with the primary token and Highlight in forced colors (leaf recipe)', () => {
      render(<ProgressBar value={40} label="Upload" />);
      expect(fillOf(screen.getByRole('progressbar'))).toHaveClass(
        'bg-primary',
        'forced-colors:bg-[Highlight]',
        'forced-colors:forced-color-adjust-none',
      );
    });

    it('animates the indeterminate fill with tokens, RTL keyframes and a full-width pulse for reduced motion (repo-level#6, #12, #13)', () => {
      render(<ProgressBar label="Syncing" />);
      const fill = fillOf(screen.getByRole('progressbar'));
      expect(fill).toHaveClass(
        'w-2/5',
        'animate-wave-indeterminate',
        'rtl:animate-wave-indeterminate-rtl',
        'motion-reduce:w-full',
        'motion-reduce:translate-x-0',
        'motion-reduce:animate-wave-pulse',
        'rtl:motion-reduce:animate-wave-pulse',
      );
      expect(fill.className).not.toMatch(/animate-\[/);
      expect(fill.style.width).toBe('');
    });

    it('does not animate a determinate fill', () => {
      render(<ProgressBar value={40} label="Upload" />);
      expect(fillOf(screen.getByRole('progressbar')).className).not.toMatch(/animate-/);
    });

    it('uses the RTL keyframes inside a right-to-left provider', () => {
      renderWithProviders(<ProgressBar label="Syncing" />, { dir: 'rtl' });
      const bar = screen.getByRole('progressbar', { name: 'Syncing' });
      expect(bar.closest('[dir="rtl"]')).not.toBeNull();
      expect(fillOf(bar)).toHaveClass('rtl:animate-wave-indeterminate-rtl');
    });
  });

  it('ProgressBarProps carries ref (C-REF)', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ProgressBar ref={ref} value={5} label="Upload" showLabel />);
    expect(ref.current).toBe(screen.getByRole('progressbar', { name: 'Upload' }));
    expectTypeOf<ProgressBarProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<ProgressBarProps['showLabel']>().toEqualTypeOf<boolean | undefined>();
  });
});
