/**
 * The marker by which other components recognise a Wave `Button` element without importing
 * `Button` (the `markFieldLabel` pattern): the glyph slots that unwrap a `<button>` or `Button`
 * (`unwrapButtonGlyph` in `Button.slots`), which Nav, Tree, Rating and the pickers use, so an
 * import of only one of them holds none of Button's modules. Internal; imports nothing.
 */

/**
 * The marker property of Button, a registry symbol (`Symbol.for`) as Field's label marker and
 * Nav's part marker: two copies of the package (duplicate installs, bundler duplicates) share it,
 * so a Button of one copy is recognised by the other.
 */
const BUTTON: symbol = Symbol.for('wave.button');

/** Marks `component` as Wave's `Button`; called once, next to `Button`'s `displayName`. */
export function markButton<T extends object>(component: T): T {
  (component as Record<symbol, unknown>)[BUTTON] = true;
  return component;
}

/**
 * Whether an element type is a button: the intrinsic `'button'` or the marked `Button` (a lazy
 * client reference resolved by the caller, with `getElementType`).
 */
export function isButtonType(type: unknown): boolean {
  if (type === 'button') return true;
  return (
    (typeof type === 'function' || (typeof type === 'object' && type !== null)) &&
    (type as Record<symbol, unknown>)[BUTTON] === true
  );
}
