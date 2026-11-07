/**
 * Which args of a story the prop controls can change, and how: the part of Storybook's control
 * inference the site supports, read from the story's merged `argTypes` and `args`.
 *
 * - An argType whose `control` is `false`, or whose `table.disable` is set, is never shown.
 * - `control: 'select' | 'radio' | 'inline-radio'` (as a string or `{ type }`) with `options`, or
 *   `options` without a control type, is a select of exactly those options (strings, numbers or
 *   booleans; an option of another kind drops the control).
 * - `control: 'boolean' | 'text' | 'number' | 'range'` is that kind; `number` and `range` keep
 *   the control's `min`, `max` and `step`.
 * - Without a control type the arg's value decides: a boolean, a string or a finite number.
 * - A function (a `fn()` action), a React element or any other object is never shown, whatever
 *   its argType says, nor is a control kind the site does not support (color, object, date, …).
 *
 * The keys come in the order of `argTypes`, then the args' own order. Tiny on purpose: the example
 * island imports it to decide whether it has controls at all; `Controls.tsx`, the lazy chunk,
 * renders them.
 */
type Args = Record<string, unknown>;

export type ControlOption = string | number | boolean;

export type ControlSpec =
  | { name: string; kind: 'boolean' }
  | { name: string; kind: 'text' }
  | { name: string; kind: 'number'; min?: number; max?: number; step?: number }
  | { name: string; kind: 'select'; options: readonly ControlOption[] };

const SELECT_TYPES = new Set(['select', 'radio', 'inline-radio']);

const isRecord = (value: unknown): value is Args =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOption = (value: unknown): value is ControlOption =>
  typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value);

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** A value a control may show: no function, no element, no object. */
function isPlainValue(value: unknown): boolean {
  return value === undefined || value === null || isOption(value);
}

function specFor(name: string, argType: unknown, value: unknown): ControlSpec | undefined {
  if (!isPlainValue(value)) return undefined;
  const type = isRecord(argType) ? argType : {};
  if (type.control === false) return undefined;
  if (isRecord(type.table) && type.table.disable === true) return undefined;
  const control = isRecord(type.control) ? type.control : {};
  const controlType = typeof type.control === 'string' ? type.control : control.type;
  const options = Array.isArray(type.options) ? (type.options as unknown[]) : undefined;

  if (options && (controlType === undefined || SELECT_TYPES.has(String(controlType)))) {
    return options.length > 0 && options.every(isOption)
      ? { name, kind: 'select', options: options as ControlOption[] }
      : undefined;
  }
  switch (controlType) {
    case 'boolean':
      return value === undefined || typeof value === 'boolean'
        ? { name, kind: 'boolean' }
        : undefined;
    case 'text':
      return value === undefined || typeof value === 'string' ? { name, kind: 'text' } : undefined;
    case 'number':
    case 'range': {
      if (value !== undefined && typeof value !== 'number') return undefined;
      const spec: ControlSpec = { name, kind: 'number' };
      const min = finite(control.min);
      const max = finite(control.max);
      const step = finite(control.step);
      if (min !== undefined) spec.min = min;
      if (max !== undefined) spec.max = max;
      if (step !== undefined) spec.step = step;
      return spec;
    }
    case undefined:
      if (typeof value === 'boolean') return { name, kind: 'boolean' };
      if (typeof value === 'string') return { name, kind: 'text' };
      if (typeof value === 'number') return { name, kind: 'number' };
      return undefined;
    default:
      return undefined;
  }
}

/** The controls of a story, from its merged argTypes and its current args. */
export function getControlSpecs(argTypes: Args, args: Args): ControlSpec[] {
  const names = [...new Set([...Object.keys(argTypes), ...Object.keys(args)])];
  return names.flatMap((name) => {
    const spec = specFor(name, argTypes[name], args[name]);
    return spec ? [spec] : [];
  });
}
