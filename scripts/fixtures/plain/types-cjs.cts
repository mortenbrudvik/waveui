/**
 * CommonJS TypeScript consumer (`module` node20, `moduleResolution` node16): this import compiles
 * to `require`, which loads the package's ES entry (Node.js 22.12 and later), typed by
 * `dist/index.d.ts`. Under `module` node16 it fails with TS1479 (repo-level#5, spec R4).
 * Type-checked by scripts/pack-smoke.mjs.
 */
import { cn, type ButtonProps } from '@mortenbrudvik/waveui';

export const className: string = cn('a', false, 'b');

export const primary: ButtonProps = { appearance: 'primary' };

// @ts-expect-error -- `appearance` only accepts the documented values.
export const invalid: ButtonProps = { appearance: 'not-an-appearance' };
