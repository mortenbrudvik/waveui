import type * as React from 'react';
import { cn } from './cn';
import { composeEventHandlers } from './composeEventHandlers';
import { mergeRefs } from './mergeRefs';

/**
 * The consumer props of one structural part of a component: an entry of the component's
 * `slotProps` object (`<Switch slotProps={{ track: { className, onPointerDown } }} />`), where
 * Fluent UI gives each part a prop of its own (`indicator={{ … }}`).
 *
 * A part takes the props of its element `E` (its attributes, event handlers and `ref`, so an
 * `'input'` part accepts `placeholder` and a `'span'` part does not) and any `data-*` attribute.
 * It takes no `children` (the component owns the part's content), no `as` (a part is never
 * replaced by another element), no `key` and no `dangerouslySetInnerHTML`: each is a type error
 * in an object literal, and dropped at run time if it arrives anyway. How the props combine with
 * the component's own is the rule of {@link mergeSlotProps}; each part's JSDoc names its element,
 * its locked attributes and its stable class.
 *
 * Unlike a named slot (`icon`, `media`, a dismiss button: a `Slot` prop of its own), a part
 * always renders and is never replaced; its props are merged into the element the component
 * draws.
 *
 * @typeParam E - The part's element, as an intrinsic tag (`'span'`, `'input'`, `'div'`).
 */
export type SlotPart<E extends keyof React.JSX.IntrinsicElements> = Omit<
  React.ComponentPropsWithRef<E>,
  'children' | 'className' | 'style' | 'key' | 'dangerouslySetInnerHTML'
> & {
  /** Class name(s) merged after the component's classes, so yours win a conflict. */
  className?: string;
  /** Inline styles merged over the component's own, your keys winning. */
  style?: React.CSSProperties;
} & { [K in `data-${string}`]?: string | number | boolean | undefined };

/** What the component itself puts on a part, the second argument of {@link mergeSlotProps}. */
export interface SlotPartOwn {
  /** The part's classes: its stable class first, then the component's own. */
  className?: string;
  /** The part's inline styles. */
  style?: React.CSSProperties;
  /**
   * The component's ref to the part's element, merged with the consumer's: a stable callback
   * ref (a `useMergedRefs` result, a state setter). The React Compiler's lint rejects a ref
   * object, or the component's `ref` prop itself, passed to a function during render.
   */
  ref?: React.Ref<unknown>;
  /**
   * Attributes and handlers the consumer may change: a consumer attribute replaces the default,
   * a consumer handler runs before it. Never `className`, `style` or `ref` (pass those above).
   */
  defaults?: Record<string, unknown>;
  /**
   * Attributes and handlers the component's wiring needs (role, id, the ARIA references, the
   * tab index, the disabled and hidden state, the Field wiring): an attribute here always wins,
   * also when its value is `undefined`; a handler here runs after the consumer's (which may
   * cancel it with `preventDefault()`) and is never replaced. Never `className`, `style` or `ref`.
   */
  locked?: Record<string, unknown>;
}

type Props = Record<string, unknown>;
type Handler = (event: { defaultPrevented: boolean }) => void;

const HANDLER_KEY = /^on[A-Z]/;
/** Keys never taken from a part: merged on their own, or owned by the component. */
const NOT_FORWARDED = new Set([
  'className',
  'style',
  'ref',
  'children',
  'as',
  'key',
  'dangerouslySetInnerHTML',
]);
/** The merged ref of each pair of refs, so the result is stable while both refs are. */
const mergedRefs = new WeakMap<object, WeakMap<object, React.RefCallback<unknown>>>();

/** Copies the values of `source` that are not `null` or `undefined` into `target`. */
function assignPresent(target: Props, source: Props, skip?: ReadonlySet<string>): Props {
  for (const key of Object.keys(source)) {
    if (source[key] != null && !skip?.has(key)) target[key] = source[key];
  }
  return target;
}

function mergeRefPair(ours: object, theirs: object): React.RefCallback<unknown> {
  let byTheirs = mergedRefs.get(ours);
  if (!byTheirs) mergedRefs.set(ours, (byTheirs = new WeakMap()));
  let merged = byTheirs.get(theirs);
  if (!merged) {
    byTheirs.set(
      theirs,
      (merged = mergeRefs(ours as React.Ref<unknown>, theirs as React.Ref<unknown>)),
    );
  }
  return merged;
}

/**
 * Merges the consumer props of a structural part (`slotProps.<part>`) with the props the
 * component puts on it, and returns the props to spread on the part's element (C-COMPOSE for
 * parts). Pure and server-safe: no hook, no DOM; a new object on every call.
 *
 * - **Order:** the component's `defaults`, then the consumer's attributes, then its `locked`
 *   attributes: a consumer attribute replaces a default, a locked one always wins (also when
 *   its value is `undefined`: an `aria-controls` that only exists while open stays absent).
 * - **`null` and `undefined`** from the consumer are skipped: they never erase a default, a
 *   style value or a handler (`{ id: undefined }` keeps the component's id).
 * - **`className`** is the component's classes, then the consumer's, through `cn` (the
 *   consumer wins a conflict). Without a consumer class the component's string is passed
 *   through untouched, so the markup cannot change.
 * - **`style`** is the component's object with the consumer's keys over it; omitted when
 *   neither side has a value.
 * - **Handlers** (a key of `on` and a capital letter whose consumer value is a function) run
 *   the consumer's first, then the component's through `composeEventHandlers`, unless the
 *   consumer called `preventDefault()`. A locked handler is composed the same way, never
 *   replaced, and never removes the consumer's; it takes the place of a default handler of the
 *   same key. A handler only one side has is passed through as it is. A function-valued prop
 *   that is no handler (`formAction`) is replaced like any attribute. Internal work that must
 *   run even when the consumer prevents the default is composed after the spread, with
 *   `checkDefaultPrevented: false`.
 * - **`ref`**: both refs merged with `mergeRefs` (the same merged callback for the same pair of
 *   refs, so React keeps it attached across renders while both refs stay the same); one ref
 *   is passed through as it is. Pass the component's own as a stable callback ref
 *   (`useMergedRefs(localRef)`): the `react-hooks/refs` lint rejects a ref object here.
 * - **Never forwarded:** `children`, `as`, `key` and `dangerouslySetInnerHTML` (type errors on
 *   {@link SlotPart}; the component owns the part's content and element).
 * - **No part, or `{}`:** exactly `{ ...defaults, className, style, ref, ...locked }`, each of
 *   the three only when given: the same props and the same markup as before the part existed.
 *
 * `className`, `style` and `ref` belong in `own` itself, never in `defaults` or `locked`.
 *
 * Fluent UI's nearest counterpart is `slot.always(props.<part>, { defaultProps })`, which
 * merges by a shallow spread: there a consumer handler or ref replaces the component's.
 *
 * @example
 * const trackRef = useMergedRefs(localTrackRef);
 * <span
 *   {...mergeSlotProps(slotProps?.track, {
 *     className: cn(switchClassNames.track, trackClasses),
 *     ref: trackRef,
 *     locked: { 'aria-hidden': true },
 *   })}
 * />
 *
 * @typeParam E - The part's element, inferred from `part` (`'span'` when nothing can be
 *   inferred, as for a part written inline).
 * @param part The consumer's props for the part (`slotProps?.track`), or `undefined`.
 * @param own  What the component puts on the part.
 * @returns The props to spread on the part's element.
 */
export function mergeSlotProps<E extends keyof React.JSX.IntrinsicElements = 'span'>(
  part: SlotPart<E> | undefined,
  own: SlotPartOwn,
): Record<string, unknown> {
  const theirs = (part ?? {}) as Props;
  const defaults = own.defaults ?? {};
  const locked = own.locked ?? {};
  const result = assignPresent({ ...defaults }, theirs, NOT_FORWARDED);

  const className = theirs.className
    ? cn(own.className, theirs.className as string)
    : own.className;
  if (className !== undefined) result.className = className;

  const style = theirs.style ? assignPresent({ ...own.style }, theirs.style as Props) : own.style;
  if (own.style || (style && Object.keys(style).length)) result.style = style;

  const theirRef = theirs.ref as React.Ref<unknown> | undefined;
  const ref = own.ref && theirRef ? mergeRefPair(own.ref, theirRef) : (own.ref ?? theirRef);
  if (ref) result.ref = ref;

  Object.assign(result, locked);
  for (const key of Object.keys(theirs)) {
    const handler = theirs[key];
    if (typeof handler === 'function' && HANDLER_KEY.test(key)) {
      const ours = typeof locked[key] === 'function' ? locked[key] : defaults[key];
      result[key] =
        typeof ours === 'function'
          ? composeEventHandlers(handler as Handler, ours as Handler)
          : handler;
    }
  }
  return result;
}
