import { describe, expect, it } from 'vitest';
import { createOptionText, findExactMatch } from '../TagPicker.create';

const known = {
  labels: ['Apple', 'Banana'],
  values: ['apple', 'banana', 'kiwi-1'],
  selected: ['apple', 'Infra'],
};

describe('createOptionText', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['\t\n', null],
  ])('offers nothing for empty or whitespace text %j', (query, expected) => {
    expect(createOptionText(query, known)).toBe(expected);
  });

  it('trims the text', () => {
    expect(createOptionText('  ops  ', known)).toBe('ops');
  });

  it.each(['Apple', 'APPLE', 'banana', '  bAnAnA '])(
    'offers nothing for an option label ignoring case (%j)',
    (query) => {
      expect(createOptionText(query, known)).toBeNull();
    },
  );

  it('offers nothing for a selected value ignoring case (a created tag in another case)', () => {
    expect(createOptionText('infra', known)).toBeNull();
    expect(createOptionText('INFRA', known)).toBeNull();
  });

  it('offers nothing for an option value, compared exactly', () => {
    expect(createOptionText('kiwi-1', known)).toBeNull();
    expect(createOptionText('KIWI-1', known)).toBe('KIWI-1');
  });

  it('offers the text otherwise', () => {
    expect(createOptionText('Cherry', known)).toBe('Cherry');
  });
});

describe('findExactMatch', () => {
  const candidates = [
    { value: 'pineapple', label: 'Pineapple' },
    { value: 'apple', label: 'Apple' },
    { value: 'apple-2', label: 'apple' },
  ];

  it('returns the first option in list order whose label equals the text ignoring case', () => {
    expect(findExactMatch('apple', candidates, new Set())).toBe('apple');
    expect(findExactMatch('  PINEAPPLE ', candidates, new Set())).toBe('pineapple');
  });

  it('skips selected options', () => {
    expect(findExactMatch('apple', candidates, new Set(['apple']))).toBe('apple-2');
  });

  it('returns null without text or without a match', () => {
    expect(findExactMatch('', candidates, new Set())).toBeNull();
    expect(findExactMatch('  ', candidates, new Set())).toBeNull();
    expect(findExactMatch('app', candidates, new Set())).toBeNull();
    expect(findExactMatch('apple', candidates, new Set(['apple', 'apple-2']))).toBeNull();
  });
});
