import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';
import { MenuButton } from '../MenuButton';
import { isButtonType, markButton } from '../Button.mark';

describe('Button.mark', () => {
  it('marks Button, and only Button, as a button type', () => {
    expect(isButtonType(Button)).toBe(true);
    expect(isButtonType('button')).toBe(true);
    expect(isButtonType(MenuButton)).toBe(false);
    for (const other of ['span', 'a', undefined, null, 0, () => null, {}, Symbol('button')]) {
      expect(isButtonType(other)).toBe(false);
    }
  });

  it('marks through a registry symbol, so a second copy of the package recognises it', () => {
    const copy = markButton(() => null);
    expect((copy as unknown as Record<symbol, unknown>)[Symbol.for('wave.button')]).toBe(true);
    expect(isButtonType(copy)).toBe(true);
  });

  it('keeps the slot helpers free of a run-time import of Button (an import of only Nav holds no Button)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/button/Button.slots.tsx'),
      'utf8',
    );
    const imports = source.match(/^import\s+(?!type\b)[^;]*?from\s+'[^']+';/gm) ?? [];
    expect(imports.filter((line) => /from '\.\/Button'/.test(line))).toEqual([]);
  });
});
