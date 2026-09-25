import { act } from '@testing-library/react';
import { vi } from 'vitest';

// Test helpers shared by the table tests (not a test file itself).

/**
 * Counts `tabindex` writes (`setAttribute('tabindex', …)` on any element) from now on. Past 500
 * writes it stops writing, so an endless write loop between two MutationObservers ends instead of
 * starving the test of macrotasks. The spy is removed by `vi.restoreAllMocks()`.
 */
export function countTabIndexWrites(): { count: () => number } {
  const original = Element.prototype.setAttribute;
  let writes = 0;
  vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
    this: Element,
    name: string,
    value: string,
  ) {
    if (name === 'tabindex') {
      writes += 1;
      if (writes > 500) return;
    }
    original.call(this, name, value);
  });
  return { count: () => writes };
}

/** Lets MutationObserver callbacks, and the commits and writes they cause, run to the end. */
export async function flushObservers(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await act(async () => {});
}
