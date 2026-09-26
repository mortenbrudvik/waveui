import { describe, expect, it } from 'vitest';
import { sameValues, toggleValue } from '../pickerValues';

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
