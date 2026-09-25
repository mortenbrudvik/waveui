/**
 * Internal status building blocks shared by MessageBar and Toast (spec §5.7): the status icons and
 * the visually hidden status text that tells screen-reader users the severity
 * (feedback-navigation#4). Not exported from the package.
 */
import * as React from 'react';
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from '../../lib/icons';
import type { IconComponent } from '../../lib/icons';
import type { Status } from '../../lib/types';

/** Default visually hidden status text, read before the message ("Warning: Disk almost full"). */
export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  info: 'Info:',
  success: 'Success:',
  warning: 'Warning:',
  error: 'Error:',
};

const STATUS_ICONS: Readonly<Record<Status, IconComponent>> = {
  info: InfoIcon,
  success: SuccessIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

/**
 * Icon color per status. The `*-tint-foreground` tokens keep ≥ 4.5:1 on both the status tints
 * (MessageBar) and the page background (Toast) in every theme, unlike the `warning` fill.
 */
export const STATUS_ICON_COLOR: Readonly<Record<Status, string>> = {
  info: 'text-info-tint-foreground',
  success: 'text-success-tint-foreground',
  warning: 'text-warning-tint-foreground',
  error: 'text-error-tint-foreground',
};

/** Logical start border color per status. */
export const STATUS_BORDER: Readonly<Record<Status, string>> = {
  info: 'border-s-info',
  success: 'border-s-success',
  warning: 'border-s-warning',
  error: 'border-s-error',
};

/** The resolved status text: `statusLabel` when given (`''` hides it), else the default. */
export function getStatusLabel(status: Status, statusLabel: string | undefined): string {
  return statusLabel ?? STATUS_LABELS[status];
}

/** The default status glyph (decorative: `aria-hidden`, `currentColor`). */
export function StatusIcon({ status, size }: { status: Status; size?: number }) {
  const Icon = STATUS_ICONS[status];
  return <Icon size={size} />;
}
StatusIcon.displayName = 'StatusIcon';

/** Visually hidden status text, followed by a space so it reads apart from the message. */
export function StatusText({ label }: { label: string }) {
  if (!label) return null;
  return <span className="sr-only">{`${label} `}</span>;
}
StatusText.displayName = 'StatusText';
