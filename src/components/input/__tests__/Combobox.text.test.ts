import { describe, expect, it } from 'vitest';
import { insertedText, replacedText } from '../Combobox.text';

describe('insertedText', () => {
  it.each([
    ['Apple, Banana', 'Apple, Bananac', 'c'],
    ['Apple, Banana', 'c', 'c'],
    ['Apple, Banana', 'Apple, xBanana', 'x'],
    ['Apple, Banana', 'Apple, Banan', ''],
    ['Apple, Banana', 'Apple, Banana', ''],
    ['ab', 'aab', 'a'],
    // Characters outside the BMP: the shared start or end never splits a surrogate pair.
    ['🍎', '🍌🍎', '🍌'],
    ['🍎', '🍏', '🍏'],
    ['🈀', '😀', '😀'],
  ])('%j → %j inserts %j', (before, after, expected) => {
    expect(insertedText(before, after)).toBe(expected);
  });
});

describe('replacedText', () => {
  it.each([
    // All of the labels selected: the whole new value, however much of it looks like them (R16).
    ['Apple, Banana', 'a', 0, 13, 'a'],
    ['Apple, Banana', 'Banana', 0, 13, 'Banana'],
    // A collapsed caret inside or after the labels: the text typed there.
    ['Apple, Banana', 'Apple, Ch Banana', 7, 7, 'Ch '],
    ['Apple, Banana', 'Apple, Bananad', 13, 13, 'd'],
  ])('%j → %j over %i–%i is %j', (before, after, start, end, expected) => {
    expect(replacedText(before, after, start, end)).toBe(expected);
  });

  it.each([
    // A character erased next to a collapsed caret: the text around the range is not kept.
    ['Apple, Banana', 'Apple, Banan', 13, 13],
    ['Apple, Banana', 'pple, Banana', 0, 0],
    // A range that is not one.
    ['Apple', 'Apple', 3, 2],
    ['Apple', 'Apple', 0, 9],
  ])('%j → %j over %i–%i is undefined', (before, after, start, end) => {
    expect(replacedText(before, after, start, end)).toBeUndefined();
  });
});
