/**
 * ES-module TypeScript consumer (`module` node16, which implies `moduleResolution` node16): the
 * package's `exports` resolve `dist/index.d.ts`. The `@ts-expect-error` proves the declarations
 * are real types, not `any`. Type-checked by scripts/pack-smoke.mjs (tsconfig.json).
 */
import { cn, type ButtonProps } from '@mortenbrudvik/waveui';

export const className: string = cn('a', false, 'b');

export const primary: ButtonProps = { appearance: 'primary' };

// @ts-expect-error -- `appearance` only accepts the documented values.
export const invalid: ButtonProps = { appearance: 'not-an-appearance' };
