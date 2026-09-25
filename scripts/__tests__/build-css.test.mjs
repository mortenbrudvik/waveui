// @vitest-environment node
/**
 * Unit tests of `scripts/build-css.mjs` helpers that have no fixture compile of their own. The
 * gate assertions and the compiles of the real style entries are tested in
 * `src/styles/__tests__/tokens.test.ts` ("scripts/build-css.mjs — gate assertions").
 */
import { describe, expect, it } from 'vitest';
import { bareDirectionClasses } from '../build-css.mjs';

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
