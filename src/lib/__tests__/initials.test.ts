import { describe, expect, it } from 'vitest';
import { getInitials } from '../initials';

describe('getInitials', () => {
  it.each([
    ['Jane Doe', 'JD'],
    ['Jane Doe (Contoso)', 'JD'],
    ['Jane [Contoso] Doe', 'JD'],
    ['Jane {Contoso} <jane@contoso.com> Doe', 'JD'],
    ['Jane (Contoso (EMEA)) Doe', 'JD'],
    ['Ada', 'A'],
    ['  ada   lovelace ', 'AL'],
    ['Ada King Lovelace', 'AL'],
    ["Jean-Luc O'Brien", 'JO'],
    ['Åsa Öberg', 'ÅÖ'],
    ['Иван Петров', 'ИП'],
    ['Γιώργος Παπαδόπουλος', 'ΓΠ'],
    ['Émile Zola', 'ÉZ'],
    ['𝒜da Lovelace', '𝒜L'],
    ['Agent 007', 'A'],
    ['J', 'J'],
    ['a-very-long-single-word-name-without-spaces', 'A'],
  ])('%s gives %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['(only brackets)'],
    ['[a] (b)'],
    ['+1 (555) 010-0000'],
    ['555-0100'],
    ['😀'],
    ['😀 😀'],
    ['田中太郎'],
    ['山田 花子'],
    ['김민수'],
    ['ภาษาไทย'],
    ['Jane 田中'],
  ])('%j gives no initials', (name) => {
    expect(getInitials(name)).toBe('');
  });

  it('keeps the first initial only with firstInitialOnly', () => {
    expect(getInitials('Jane Doe', { firstInitialOnly: true })).toBe('J');
    expect(getInitials('Ada', { firstInitialOnly: true })).toBe('A');
  });

  it('swaps two initials in right-to-left text and leaves one alone', () => {
    expect(getInitials('Jane Doe', { dir: 'rtl' })).toBe('DJ');
    expect(getInitials('דוד כהן', { dir: 'rtl' })).toBe('כד');
    expect(getInitials('דוד כהן')).toBe('דכ');
    expect(getInitials('Ada', { dir: 'rtl' })).toBe('A');
    expect(getInitials('Jane Doe', { dir: 'rtl', firstInitialOnly: true })).toBe('J');
  });

  it('is deterministic and does not depend on a locale', () => {
    expect(getInitials('istanbul ışık')).toBe('II');
  });
});
