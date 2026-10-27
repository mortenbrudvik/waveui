// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveMotion, usesLegacyMotion } from '../motion';

const LEGACY = 'p-4 data-[presence=exiting]:opacity-0';

describe('resolveMotion', () => {
  it('null is no motion', () => {
    expect(resolveMotion(null, 'r', 'default')).toBe('');
  });

  it('a string replaces the recipe, also under the provider "none"', () => {
    expect(resolveMotion('a b', 'r', 'none')).toBe('a b');
    expect(resolveMotion('a b', 'r', 'default')).toBe('a b');
  });

  it('the object form replaces the recipe', () => {
    expect(resolveMotion({ className: 'a' }, 'r', 'default')).toBe('a');
    expect(resolveMotion({ className: 'a' }, 'r', 'none')).toBe('a');
  });

  it('an empty string is an explicit empty replacement: no motion', () => {
    expect(resolveMotion('', 'r', 'default')).toBe('');
    expect(resolveMotion({ className: '' }, 'r', 'default')).toBe('');
  });

  it('undefined is no motion under the provider "none"', () => {
    expect(resolveMotion(undefined, 'r', 'none')).toBe('');
  });

  it('undefined keeps the recipe by default', () => {
    expect(resolveMotion(undefined, 'r', 'default')).toBe('r');
    expect(resolveMotion(undefined, 'r', 'default', 'p-4')).toBe('r');
  });

  it('a legacy className with a presence variant turns the default off', () => {
    expect(resolveMotion(undefined, 'r', 'default', LEGACY)).toBe('');
  });

  it('a value wins over a legacy className', () => {
    expect(resolveMotion('x', 'r', 'default', 'data-[presence=exiting]:opacity-0')).toBe('x');
  });
});

describe('usesLegacyMotion', () => {
  it('is true only without a slot and with a presence variant in the className', () => {
    expect(usesLegacyMotion(undefined, LEGACY)).toBe(true);
    expect(usesLegacyMotion(undefined, 'p-4')).toBe(false);
    expect(usesLegacyMotion(undefined)).toBe(false);
    expect(usesLegacyMotion(null, LEGACY)).toBe(false);
    expect(usesLegacyMotion('x', LEGACY)).toBe(false);
    expect(usesLegacyMotion({ className: 'x' }, LEGACY)).toBe(false);
    expect(usesLegacyMotion('', LEGACY)).toBe(false);
  });
});
