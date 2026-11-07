/**
 * A component module for props.test.ts. The library has no deprecated prop since 1.0 removed them
 * all (CLAUDE.md, C-DEV), so the `@deprecated` rule of the extractor is tested on this module.
 */
import type * as React from 'react';

export interface LegacyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * The badge's look.
   * @deprecated Use `tone`.
   */
  kind?: 'brand' | 'danger';
  /**
   * The badge's tone.
   * @default 'brand'
   */
  tone?: 'brand' | 'danger';
  /** An old switch with a bare tag. @deprecated */
  legacy?: boolean;
}

/** A badge with a renamed prop. */
export const LegacyBadge = (props: LegacyBadgeProps): React.ReactNode => props.children;
