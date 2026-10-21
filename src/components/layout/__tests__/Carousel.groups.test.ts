import { describe, expect, it } from 'vitest';
import { clampToPage, lastPageStart, pageCount, pageStartOf } from '../Carousel.groups';

describe('Carousel page maths', () => {
  describe('pageCount', () => {
    it.each([
      [0, 3, 0],
      [1, 3, 1],
      [3, 3, 1],
      [4, 3, 2],
      [9, 3, 3],
      [7, 3, 3],
      [3, 5, 1],
      [5, 1, 5],
    ])('%d slides in groups of %d make %d pages', (total, size, pages) => {
      expect(pageCount(total, size)).toBe(pages);
    });
  });

  describe('lastPageStart', () => {
    it.each([
      [9, 3, 6],
      [7, 3, 6],
      [3, 5, 0],
      [1, 1, 0],
      [5, 1, 4],
      [0, 3, 0],
    ])('%d slides in groups of %d: the last page starts at %d', (total, size, start) => {
      expect(lastPageStart(total, size)).toBe(start);
    });
  });

  describe('pageStartOf', () => {
    it.each([
      [0, 3, 0],
      [2, 3, 0],
      [3, 3, 3],
      [4, 3, 3],
      [5, 3, 3],
      [8, 3, 6],
      [4, 1, 4],
    ])('slide %d in groups of %d is on the page starting at %d', (index, size, start) => {
      expect(pageStartOf(index, size)).toBe(start);
    });
  });

  describe('clampToPage', () => {
    it.each([
      [4, 3, 9, 3],
      [99, 3, 9, 6],
      [-5, 3, 9, 0],
      [Number.NaN, 3, 9, 0],
      [8, 3, 7, 6],
      [6, 3, 5, 3],
      [4, 1, 9, 4],
      [2, 5, 3, 0],
      [3, 3, 0, 0],
    ])('value %d in groups of %d over %d slides gives %d', (index, size, total, expected) => {
      expect(clampToPage(index, size, total)).toBe(expected);
    });

    it('treats a group size below 1 or not a number as 1', () => {
      expect(clampToPage(4, 0, 9)).toBe(4);
      expect(clampToPage(4, Number.NaN, 9)).toBe(4);
      expect(pageCount(9, 0)).toBe(9);
    });

    it('rounds a fractional group size down', () => {
      expect(clampToPage(5, 2.9, 9)).toBe(4);
    });
  });
});
