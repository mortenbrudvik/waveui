import { describe, it, expect, afterEach, vi } from 'vitest';
import { getGlobalRegistry } from '../globalRegistry';

const KEY = 'test-registry';
const symbolFor = (key: string) => Symbol.for(`@mortenbrudvik/waveui/${key}`);
const globalStore = globalThis as unknown as Record<symbol, unknown>;

afterEach(() => {
  delete globalStore[symbolFor(KEY)];
  delete globalStore[symbolFor(`${KEY}-other`)];
});

describe('getGlobalRegistry', () => {
  it('creates the value once and returns the same instance on every call', () => {
    const create = vi.fn(() => new Set<string>());
    const first = getGlobalRegistry(KEY, create);
    const second = getGlobalRegistry(KEY, create);
    expect(second).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('stores the value on globalThis under Symbol.for("@mortenbrudvik/waveui/<key>")', () => {
    const value = getGlobalRegistry(KEY, () => ({ count: 0 }));
    expect(globalStore[symbolFor(KEY)]).toBe(value);
  });

  it('keeps different keys apart', () => {
    const a = getGlobalRegistry(KEY, () => ({ name: 'a' }));
    const b = getGlobalRegistry(`${KEY}-other`, () => ({ name: 'b' }));
    expect(a).not.toBe(b);
    expect(a.name).toBe('a');
    expect(b.name).toBe('b');
  });

  it('returns a value created by another copy of the library (ESM + CJS in one app)', () => {
    // Simulates the other build having registered the singleton first.
    const shared = { stack: ['layer-from-cjs-build'] };
    globalStore[symbolFor(KEY)] = shared;
    const create = vi.fn(() => ({ stack: [] as string[] }));
    expect(getGlobalRegistry(KEY, create)).toBe(shared);
    expect(create).not.toHaveBeenCalled();
  });

  it('shares the singleton across separately evaluated module instances', async () => {
    const value = getGlobalRegistry(KEY, () => ({ id: 1 }));
    vi.resetModules();
    const fresh = await import('../globalRegistry');
    expect(fresh.getGlobalRegistry).not.toBe(getGlobalRegistry);
    expect(fresh.getGlobalRegistry(KEY, () => ({ id: 2 }))).toBe(value);
  });

  it('does not add an enumerable property to globalThis', () => {
    getGlobalRegistry(KEY, () => 1);
    expect(Object.getOwnPropertySymbols(globalThis)).toContain(symbolFor(KEY));
    expect(Object.prototype.propertyIsEnumerable.call(globalThis, symbolFor(KEY))).toBe(false);
  });
});
