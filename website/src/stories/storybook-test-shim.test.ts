import { describe, expect, it } from 'vitest';
import { fn } from './storybook-test-shim';

describe('storybook/test stub', () => {
  it('fn() gives an action that can be called and does nothing', () => {
    const action = fn();
    expect(typeof action).toBe('function');
    expect(action('ignored', 1)).toBeUndefined();
  });
});
