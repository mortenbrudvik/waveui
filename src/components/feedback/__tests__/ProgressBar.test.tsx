import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';
import type { ProgressBarColor, ProgressBarProps } from '../ProgressBar';
import {
  axe,
  expectNoA11yViolations,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';

const fillOf = (bar: HTMLElement) => bar.firstElementChild as HTMLElement;

const warnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.map((call) => String(call[0]));

const NAME_WARNING =
  '[WaveUI] ProgressBar: a progress bar needs an accessible name. Pass `label` (add `showLabel` to show it), `aria-label` or `aria-labelledby`.';
const SHOW_LABEL_WARNING =
  '[WaveUI] ProgressBar: `showLabel` renders the `label` prop, which is empty.';
const maxWarning = (max: number) =>
  `[WaveUI] ProgressBar: \`max\` must be a finite number greater than 0 (got ${max}); the bar renders 0%.`;
const valueWarning = (value: number) =>
  `[WaveUI] ProgressBar: \`value\` must be a finite number (got ${value}); the bar renders 0%.`;

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
    ],
  });

  it('renders with role="progressbar"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ProgressBar data-testid="pb" />);
    expect(screen.getByTestId('pb')).toHaveAttribute('role', 'progressbar');
    expect(warnings(warn)).toEqual([NAME_WARNING]);
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
      expect(warnings(warn)).toEqual([maxWarning(0)]);
    });

    it('has no accessibility violations for max 0, with its one development warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={0} max={0} label="Loading" />);
      expect(warnings(warn)).toEqual([maxWarning(0)]);
      await expectNoA11yViolations();
    });

    it('renders 0% for a negative max', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={5} max={-10} label="Upload" />);
      expect(fillOf(screen.getByRole('progressbar')).style.width).toBe('0%');
      expect(warnings(warn)).toEqual([maxWarning(-10)]);
    });

    it('renders 0% for a NaN value and warns in development', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={NaN} label="Upload" />);
      const el = screen.getByRole('progressbar', { name: 'Upload' });
      expect(fillOf(el).style.width).toBe('0%');
      expect(el).toHaveAttribute('aria-valuenow', '0');
      expect(warnings(warn)).toEqual([valueWarning(NaN)]);
    });

    it('renders 0% for a NaN max', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={5} max={NaN} label="Upload" />);
      const el = screen.getByRole('progressbar', { name: 'Upload' });
      expect(fillOf(el).style.width).toBe('0%');
      expect(el).toHaveAttribute('aria-valuemax', '100');
      expect(warnings(warn)).toEqual([maxWarning(NaN)]);
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
      expect(warnings(warn)).toEqual([NAME_WARNING]);
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
        expect(warnings(warn)).toEqual([NAME_WARNING]);
        const results = await axe(document.body);
        expect(results.violations.map((violation) => violation.id)).toContain(
          'aria-progressbar-name',
        );
      },
    );

    it('warns when showLabel is set without a label', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ProgressBar value={5} showLabel aria-label="Upload" />);
      expect(warnings(warn)).toEqual([SHOW_LABEL_WARNING]);
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
        'wave-rtl:animate-wave-indeterminate-rtl',
        'motion-reduce:w-full',
        'motion-reduce:translate-x-0',
        'motion-reduce:animate-wave-pulse',
        'wave-rtl:motion-reduce:animate-wave-pulse',
      );
      // Tailwind's `rtl:` also matches inside an LTR subtree of an RTL page (C-LOGICAL).
      expect(fill.className).not.toMatch(/(^|\s)rtl:/);
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
      expect(fillOf(bar)).toHaveClass('wave-rtl:animate-wave-indeterminate-rtl');
    });

    it('keys the RTL keyframes on its own direction, so an LTR subtree of an RTL page runs LTR', () => {
      renderWithProviders(
        <div dir="ltr">
          <ProgressBar label="Syncing" />
        </div>,
        { dir: 'rtl' },
      );
      const bar = screen.getByRole('progressbar', { name: 'Syncing' });
      expect(bar.closest('[dir]')).toHaveAttribute('dir', 'ltr');
      expect(bar.parentElement?.closest('[dir="rtl"]')).not.toBeNull();
      // `wave-rtl:` compiles to `:dir(rtl)`, which the nearest `dir` decides (checked by the styles
      // build); Tailwind's `rtl:` would match the RTL ancestor.
      const fill = fillOf(bar);
      expect(fill).toHaveClass('wave-rtl:animate-wave-indeterminate-rtl');
      expect(fill.className).not.toMatch(/(^|\s)rtl:/);
    });
  });

  describe('color', () => {
    it.each([
      ['brand', 'bg-primary'],
      ['success', 'bg-success'],
      // The yellow warning token would be 1.02:1 on the light track: the severe orange passes 3:1.
      ['warning', 'bg-severe'],
      ['error', 'bg-error'],
    ] as const)('color="%s" fills with %s and sets data-color', (color, fillClass) => {
      render(<ProgressBar value={40} label="Upload" color={color} />);
      const bar = screen.getByRole('progressbar', { name: 'Upload' });
      expect(bar).toHaveAttribute('data-color', color);
      const fill = fillOf(bar);
      expect(fill).toHaveClass(fillClass, 'forced-colors:bg-[Highlight]');
      const others = ['bg-primary', 'bg-success', 'bg-severe', 'bg-error', 'bg-warning'].filter(
        (cls) => cls !== fillClass,
      );
      for (const other of others) expect(fill).not.toHaveClass(other);
    });

    it('defaults to brand: data-color="brand" and the primary fill', () => {
      render(<ProgressBar value={40} label="Upload" />);
      const bar = screen.getByRole('progressbar', { name: 'Upload' });
      expect(bar).toHaveAttribute('data-color', 'brand');
      expect(fillOf(bar)).toHaveClass('bg-primary');
    });

    it('colors the indeterminate fill too', () => {
      render(<ProgressBar label="Syncing" color="error" />);
      const fill = fillOf(screen.getByRole('progressbar', { name: 'Syncing' }));
      expect(fill).toHaveClass('bg-error', 'animate-wave-indeterminate');
      expect(fill).not.toHaveClass('bg-primary');
    });

    it.each(['brand', 'success', 'warning', 'error'] as const)(
      'has no accessibility violations (color %s)',
      async (color) => {
        render(<ProgressBar value={40} label="Upload" color={color} />);
        await expectNoA11yViolations();
      },
    );

    it('types color as the four fill colors', () => {
      expectTypeOf<ProgressBarColor>().toEqualTypeOf<'brand' | 'success' | 'warning' | 'error'>();
      expectTypeOf<ProgressBarProps['color']>().toEqualTypeOf<ProgressBarColor | undefined>();
    });
  });

  describe('inside a Field', () => {
    /** A Field in the warning state with a message and a hint, as Field renders it. */
    const WARNING_FIELD = {
      validationState: 'warning',
      validationMessageId: FIELD_TEST_IDS.messageId,
      hintId: FIELD_TEST_IDS.hintId,
    } as const;
    const MESSAGE_AND_HINT = `${FIELD_TEST_TEXT.message} ${FIELD_TEST_TEXT.hint}`;

    describe('naming (the Field label never joins or overrides a name of its own)', () => {
      it('a consumer aria-label keeps its name', () => {
        renderWithFieldContext(<ProgressBar value={40} aria-label="Photo upload" />, WARNING_FIELD);
        const bar = screen.getByRole('progressbar', { name: 'Photo upload' });
        expect(bar).toHaveAttribute('aria-label', 'Photo upload');
        expect(bar).not.toHaveAttribute('aria-labelledby');
      });

      it('a consumer aria-labelledby keeps its name, without the Field label id', () => {
        renderWithFieldContext(
          <>
            <span id="upload-heading">Photos</span>
            <ProgressBar value={40} label="Upload" showLabel aria-labelledby="upload-heading" />
          </>,
          WARNING_FIELD,
        );
        const bar = screen.getByRole('progressbar', { name: 'Photos' });
        expect(bar).toHaveAttribute('aria-labelledby', 'upload-heading');
        expect(bar).not.toHaveAttribute('aria-label');
      });

      it('label without showLabel names the bar with aria-label', () => {
        renderWithFieldContext(<ProgressBar value={40} label="Upload" />, WARNING_FIELD);
        const bar = screen.getByRole('progressbar', { name: 'Upload' });
        expect(bar).toHaveAttribute('aria-label', 'Upload');
        expect(bar).not.toHaveAttribute('aria-labelledby');
      });

      it('label with showLabel names the bar with its own visible label only', () => {
        renderWithFieldContext(<ProgressBar value={40} label="Upload" showLabel />, WARNING_FIELD);
        const bar = screen.getByRole('progressbar', { name: 'Upload' });
        expect(bar).toHaveAttribute('aria-labelledby', screen.getByText('Upload').id);
        expect(bar).not.toHaveAttribute('aria-label');
      });

      it('without a name of its own, the Field label names the bar (no warning)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderWithFieldContext(<ProgressBar value={40} />, WARNING_FIELD);
        const bar = screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label });
        expect(bar).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
        expect(bar).not.toHaveAttribute('aria-label');
        expect(warn).not.toHaveBeenCalled();
      });

      it('a Field without a label names nothing: the name warning fires', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderWithFieldContext(<ProgressBar value={40} data-testid="pb" />, {
          ...WARNING_FIELD,
          labelId: undefined,
        });
        const bar = screen.getByTestId('pb');
        expect(bar).not.toHaveAttribute('aria-label');
        expect(bar).not.toHaveAttribute('aria-labelledby');
        expect(warnings(warn)).toEqual([NAME_WARNING]);
      });
    });

    it('is described by the message and the hint, after its own description', () => {
      renderWithFieldContext(
        <>
          <span id="upload-note">Large files take longer.</span>
          <ProgressBar value={40} aria-describedby="upload-note" />
        </>,
        WARNING_FIELD,
      );
      const bar = screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label });
      expect(bar).toHaveAttribute(
        'aria-describedby',
        `upload-note ${FIELD_TEST_IDS.messageId} ${FIELD_TEST_IDS.hintId}`,
      );
      expect(bar).toHaveAccessibleDescription(`Large files take longer. ${MESSAGE_AND_HINT}`);
    });

    it('takes the Field control id unless it has an id of its own', () => {
      const { rerender } = renderWithFieldContext(<ProgressBar value={40} />, WARNING_FIELD);
      expect(screen.getByRole('progressbar')).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
      rerender(<ProgressBar value={40} id="upload-progress" />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('id', 'upload-progress');
    });

    it('in the warning state: warning fill, described, never invalid or required, no warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderWithFieldContext(<ProgressBar value={40} />, { ...WARNING_FIELD, required: true });
      const bar = screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label });
      expect(bar).toHaveAccessibleDescription(MESSAGE_AND_HINT);
      expect(bar).toHaveAttribute('data-color', 'warning');
      expect(fillOf(bar)).toHaveClass('bg-severe');
      expect(bar).not.toHaveAttribute('aria-invalid');
      expect(bar).not.toHaveAttribute('aria-required');
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      [
        'error',
        {
          validationState: 'error',
          errorId: FIELD_TEST_IDS.errorId,
          validationMessageId: FIELD_TEST_IDS.errorId,
        },
        'bg-error',
        FIELD_TEST_TEXT.error,
      ],
      [
        'success',
        { validationState: 'success', validationMessageId: FIELD_TEST_IDS.messageId },
        'bg-success',
        FIELD_TEST_TEXT.message,
      ],
      [
        'none',
        { validationState: 'none', validationMessageId: FIELD_TEST_IDS.messageId },
        'bg-primary',
        FIELD_TEST_TEXT.message,
      ],
    ] as const)('follows the Field validation state %s', (_, field, fillClass, description) => {
      renderWithFieldContext(<ProgressBar value={40} />, field);
      const bar = screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label });
      expect(fillOf(bar)).toHaveClass(fillClass);
      expect(bar).toHaveAccessibleDescription(description);
      expect(bar).not.toHaveAttribute('aria-invalid');
    });

    it('reads a context without a validation state (built before 0.6) from invalid', () => {
      renderWithFieldContext(<ProgressBar value={40} />, { errorId: FIELD_TEST_IDS.errorId });
      const bar = screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label });
      expect(bar).toHaveAttribute('data-color', 'error');
      expect(bar).toHaveAccessibleDescription(FIELD_TEST_TEXT.error);
    });

    it('drops the aria-invalid and aria-required that Field merges into its first child', () => {
      renderWithFieldContext(<ProgressBar value={40} aria-invalid aria-required />, {
        validationState: 'error',
        errorId: FIELD_TEST_IDS.errorId,
        validationMessageId: FIELD_TEST_IDS.errorId,
        required: true,
      });
      const bar = screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label });
      expect(bar).not.toHaveAttribute('aria-invalid');
      expect(bar).not.toHaveAttribute('aria-required');
    });

    it('lets an explicit color win over the Field validation state', () => {
      renderWithFieldContext(<ProgressBar value={40} color="brand" />, WARNING_FIELD);
      const bar = screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label });
      expect(bar).toHaveAttribute('data-color', 'brand');
      expect(fillOf(bar)).toHaveClass('bg-primary');
      expect(fillOf(bar)).not.toHaveClass('bg-severe');
    });

    it.each([
      ['warning', WARNING_FIELD],
      [
        'error',
        {
          validationState: 'error',
          errorId: FIELD_TEST_IDS.errorId,
          validationMessageId: FIELD_TEST_IDS.errorId,
          hintId: FIELD_TEST_IDS.hintId,
          required: true,
        },
      ],
      ['success', { validationState: 'success', validationMessageId: FIELD_TEST_IDS.messageId }],
      ['none', { validationState: 'none', hintId: FIELD_TEST_IDS.hintId }],
    ] as const)('has no accessibility violations in the %s state', async (_, field) => {
      renderWithFieldContext(<ProgressBar value={40} />, field);
      expect(screen.getByRole('progressbar', { name: FIELD_TEST_TEXT.label })).toBeInTheDocument();
      await expectNoA11yViolations();
    });
  });

  it('drops aria-invalid and aria-required outside a Field (not allowed on a progress bar)', () => {
    render(<ProgressBar value={40} label="Upload" aria-invalid aria-required />);
    const bar = screen.getByRole('progressbar', { name: 'Upload' });
    expect(bar).not.toHaveAttribute('aria-invalid');
    expect(bar).not.toHaveAttribute('aria-required');
  });

  it('ProgressBarProps carries ref (C-REF)', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ProgressBar ref={ref} value={5} label="Upload" showLabel />);
    expect(ref.current).toBe(screen.getByRole('progressbar', { name: 'Upload' }));
    expectTypeOf<ProgressBarProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<ProgressBarProps['showLabel']>().toEqualTypeOf<boolean | undefined>();
  });
});
