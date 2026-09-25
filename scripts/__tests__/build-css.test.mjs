// @vitest-environment node
/**
 * Unit tests of `scripts/build-css.mjs` helpers that have no fixture compile of their own, and
 * what `dist/styles.css` ships of the theme-independent tokens. The gate assertions and the other
 * compiles of the real style entries are tested in `src/styles/__tests__/tokens.test.ts`
 * ("scripts/build-css.mjs — gate assertions").
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { bareDirectionClasses, main } from '../build-css.mjs';

describe('bareDirectionClasses (C-LOGICAL)', () => {
  it("lists the classes with Tailwind's rtl:/ltr: variant, compound and negated forms included", () => {
    const css = [
      String.raw`.rtl\:ms-2:where(:dir(rtl),[dir=rtl],[dir=rtl] *){margin-inline-start:.5rem}`,
      String.raw`.ltr\:me-2:where(:dir(ltr),[dir=ltr],[dir=ltr] *){margin-inline-end:.5rem}`,
      String.raw`.hover\:rtl\:pe-2:hover:where([dir=rtl] *){padding-inline-end:.5rem}`,
      String.raw`.rtl\:hover\:rotate-180:where([dir=rtl] *):hover{rotate:180deg}`,
      String.raw`.not-rtl\:ps-2:not(:where([dir=rtl] *)){padding-inline-start:.5rem}`,
      String.raw`.group-hover\:not-ltr\:ms-1:is(:where(.group):hover *):not(:where([dir=ltr] *)){margin-inline-start:.25rem}`,
    ].join('');
    expect(bareDirectionClasses(css)).toEqual([
      'group-hover:not-ltr:ms-1',
      'hover:rtl:pe-2',
      'ltr:me-2',
      'not-rtl:ps-2',
      'rtl:hover:rotate-180',
      'rtl:ms-2',
    ]);
  });

  it("accepts Wave's wave-rtl: variant and classes that only mention a direction", () => {
    const css = [
      String.raw`@supports selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where(:dir(rtl)){scale:-1 1}}`,
      String.raw`.hover\:wave-rtl\:pe-2:hover:where(:dir(rtl)){padding-inline-end:.5rem}`,
      String.raw`.data-\[dir\=rtl\]\:ms-2[data-dir=rtl]{margin-inline-start:.5rem}`,
      String.raw`.icon-rtl{scale:-1 1}`,
      String.raw`.ltr-start{text-align:start}`,
    ].join('');
    expect(bareDirectionClasses(css)).toEqual([]);
  });
});

describe('dist/styles.css — motion tokens', () => {
  /** Fluent's motion tokens: name → milliseconds (durations) or the bezier numbers (curves). */
  const DURATIONS = {
    'ultra-fast': 50,
    faster: 100,
    fast: 150,
    normal: 200,
    gentle: 250,
    slow: 300,
    slower: 400,
    'ultra-slow': 500,
  };
  const CURVES = {
    'accelerate-max': [0.9, 0.1, 1, 0.2],
    'accelerate-mid': [1, 0, 1, 1],
    'accelerate-min': [0.8, 0, 0.78, 1],
    'decelerate-max': [0.1, 0.9, 0.2, 1],
    'decelerate-mid': [0, 0, 0, 1],
    'decelerate-min': [0.33, 0, 0.1, 1],
    'easy-ease-max': [0.8, 0, 0.2, 1],
    'easy-ease': [0.33, 0, 0.67, 1],
    linear: [0, 0, 1, 1],
  };

  /** The values of the declarations of `name` in `css` (minified: `name:value` to `;` or `}`). */
  function declared(css, name) {
    return [...css.matchAll(new RegExp(`(?<=[{;\\s])${name}:([^;}]*)`, 'g'))].map((m) => m[1]);
  }

  function toMs(value) {
    const match = /^([\d.]+)(ms|s)$/.exec(value.trim());
    if (!match) return Number.NaN;
    return Math.round(Number(match[1]) * (match[2] === 's' ? 1000 : 1));
  }

  it('declares the 17 variables once each, with their values', () => {
    const out = mkdtempSync(join(tmpdir(), 'wave-build-css-motion-'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(main(['--out-dir', out])).toBe(0);
      expect(error).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      const css = readFileSync(join(out, 'styles.css'), 'utf8');
      const durations = Object.fromEntries(
        Object.keys(DURATIONS).map((name) => [
          name,
          declared(css, `--wave-duration-${name}`).map(toMs),
        ]),
      );
      expect(durations).toEqual(
        Object.fromEntries(Object.entries(DURATIONS).map(([name, ms]) => [name, [ms]])),
      );
      const curves = Object.fromEntries(
        Object.keys(CURVES).map((name) => [
          name,
          declared(css, `--wave-curve-${name}`).map((value) =>
            /^cubic-bezier\(([^)]*)\)$/.exec(value.trim())?.[1].split(',').map(Number),
          ),
        ]),
      );
      expect(curves).toEqual(
        Object.fromEntries(Object.entries(CURVES).map(([name, numbers]) => [name, [numbers]])),
      );
    } finally {
      log.mockRestore();
      error.mockRestore();
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});
