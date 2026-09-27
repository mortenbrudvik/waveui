/**
 * The toaster module (P3-01, P3-08). Server-safe: it imports only types and touches no DOM, so a
 * Server Component may import it.
 */
import type { ToastOptions } from '../components/feedback/Toaster';

/**
 * Whether a `dispatchToast` argument is the options form (0.5): a plain object (prototype
 * `Object.prototype` or `null`, from any realm) that is no React node — no `$$typeof`, not
 * iterable, not a thenable (the slot-object rule of `src/lib/slot.ts`). Anything else is content:
 * an element, a portal, a string, a number, an array or another iterable, a thenable, `null`.
 */
export function isToastOptions(value: unknown): value is ToastOptions {
  if (typeof value !== 'object' || value === null) return false;
  if ('$$typeof' in value || Symbol.iterator in value) return false;
  if (typeof (value as { then?: unknown }).then === 'function') return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
}
