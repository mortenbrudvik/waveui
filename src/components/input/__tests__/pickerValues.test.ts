import { describe, expect, it } from 'vitest';
import { EMPTY_VALUES, resetValues, sameValues, toggleValue, toValues } from '../pickerValues';

describe('toValues', () => {
  it('keeps an array as it is', () => {
    const values = ['a', 'b'];
    expect(toValues(values)).toBe(values);
  });

  it('turns a non-empty string into one value', () => {
    expect(toValues('a')).toEqual(['a']);
  });

  it.each([
    ['an empty string', ''],
    ['null (from JavaScript)', null],
    ['undefined', undefined],
  ])('reads %s as no values, the shared empty array', (_label, value) => {
    expect(toValues(value)).toBe(EMPTY_VALUES);
  });
});

describe('resetValues', () => {
  it('keeps the current array when it holds the default values in the same order', () => {
    const current = ['a', 'b'];
    expect(resetValues(current, ['a', 'b'])).toBe(current);
  });

  it('restores a copy of the default values otherwise', () => {
    const defaults = ['a', 'b'];
    const restored = resetValues(['b', 'a'], defaults);
    expect(restored).toEqual(['a', 'b']);
    expect(restored).not.toBe(defaults);
  });

  it('restores no values for a missing default, keeping an empty current array', () => {
    expect(resetValues(['a'], undefined)).toEqual([]);
    const current: string[] = [];
    expect(resetValues(current, undefined)).toBe(current);
  });

  it('reads a default that is not an array (from JavaScript) as no values', () => {
    expect(resetValues(['a'], 'a')).toEqual([]);
  });
});

describe('sameValues', () => {
  it('is true for the same values in the same order, even from a different array reference', () => {
    expect(sameValues(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('is false for the same values in a different order', () => {
    expect(sameValues(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('is false for a different length', () => {
    expect(sameValues(['a'], ['a', 'b'])).toBe(false);
  });

  it('is true for two empty arrays', () => {
    expect(sameValues([], [])).toBe(true);
  });
});

describe('toggleValue', () => {
  it('appends an absent value, keeping selection order', () => {
    expect(toggleValue(['a'], 'b')).toEqual({ values: ['a', 'b'], added: true });
  });

  it('removes a present value', () => {
    expect(toggleValue(['a', 'b'], 'a')).toEqual({ values: ['b'], added: false });
  });

  it('does not mutate the input array', () => {
    const values = ['a'];
    toggleValue(values, 'b');
    expect(values).toEqual(['a']);
  });
});
