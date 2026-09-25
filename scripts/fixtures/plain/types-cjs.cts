/**
 * CommonJS TypeScript consumer (`module`/`moduleResolution` node16): this import compiles to
 * `require`, so the `require` condition resolves `dist/index.d.cts`. With ESM-typed
 * declarations for `require` it fails with TS1479 (repo-level#5). Type-checked by
 * scripts/pack-smoke.mjs.
 */
import { cn, type ButtonProps } from '@mortenbrudvik/waveui';

export const className: string = cn('a', false, 'b');

export const primary: ButtonProps = { appearance: 'primary' };

// @ts-expect-error -- `appearance` only accepts the documented values.
export const invalid: ButtonProps = { appearance: 'not-an-appearance' };
