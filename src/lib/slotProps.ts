import type * as React from 'react';
import { joinIds } from './aria';
import { cn } from './cn';
import { composeEventHandlers } from './composeEventHandlers';
import { ID_LIST_KEYS } from './mergeProps';
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
   * ref, preferably a `useMergedRefs` result (a state setter also works, but is set again on
   * each render in which the consumer passes an inline ref). The React Compiler's lint rejects
   * a ref object, or the component's `ref` prop itself, passed to a function during render.
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
   * also when its value is `undefined` (an id list is joined instead: see
   * {@link mergeSlotProps}); a handler here runs after the consumer's (which may cancel it with
   * `preventDefault()`) and is never replaced. Never `className`, `style` or `ref`.
   */
  locked?: Record<string, unknown>;
  /**
   * Handler keys whose consumer handlers are dropped, neither called nor forwarded (`true`:
   * every handler); the component's own handler of the key stays. For a part that must not
   * activate, as a `disabledFocusable` control: the consumer's click never runs, as on a
   * natively disabled element.
   */
  blockHandlers?: readonly string[] | true;
}

type Props = Record<string, unknown>;
type Handler = (event: { defaultPrevented: boolean }) => void;

const HANDLER_KEY = /^on[A-Z]/;
/**
 * Keys never taken from a part: owned by the component, or (`__proto__`, an own key of parsed
 * JSON) one whose assignment would replace the result's prototype.
 */
const NOT_FORWARDED = new Set(['children', 'as', 'key', 'dangerouslySetInnerHTML', '__proto__']);
/** The merged ref of each pair of refs, so the result is stable while both refs are. */
const mergedRefs = new WeakMap<object, WeakMap<object, React.RefCallback<unknown>>>();

/** Copies the values of `source` that are not `null` or `undefined` into `target`. */
function assignPresent(target: Props, source: Props): Props {
  for (const key of Object.keys(source)) {
    if (source[key] != null && key !== '__proto__') target[key] = source[key];
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
 * - **Id lists** (`aria-describedby`, `aria-labelledby`, the lists `mergeProps` joins) are
 *   joined, the component's ids first (locked, else default), then the consumer's, without
 *   duplicates: a consumer id adds to the component's wiring and never removes it.
 * - **Handlers** (a key of `on` and a capital letter; only a function counts, so
 *   `onClick: cond && fn` never removes anything) run the consumer's first, then the
 *   component's through `composeEventHandlers`, unless the consumer called `preventDefault()`.
 *   A locked handler is composed the same way, never replaced, and never removes the
 *   consumer's; it takes the place of a default handler of the same key. A handler only one
 *   side has is passed through as it is. `own.blockHandlers` drops the consumer's handlers of
 *   the keys it names (all with `true`). A function-valued prop that is no handler
 *   (`formAction`) is replaced like any attribute. Internal work that must run even when the
 *   consumer prevents the default is composed after the spread, with
 *   `checkDefaultPrevented: false`.
 * - **`ref`**: both refs merged with `mergeRefs` (the same merged callback for the same pair of
 *   refs, so React keeps it attached across renders while both refs stay the same); one ref
 *   is passed through as it is. Pass the component's own as a stable callback ref
 *   (`useMergedRefs(localRef)`): the `react-hooks/refs` lint rejects a ref object here. A part
 *   whose own ref must never be detached, even while the consumer passes an inline ref, gets
 *   no `own.ref` and sets `ref={useMergedRefs(localRef, slotProps?.track?.ref)}` after the
 *   spread instead.
 * - **Several parts** (`[slotProps?.root, slotProps?.input]`, Input's two parts on one
 *   element) apply left to right as layers of the consumer: classes in order after the
 *   component's, style and attributes the later winning, id lists joined in order, refs merged
 *   in order after the component's, and every consumer handler in order (each runs; the
 *   component's runs after them unless one prevented the default); `locked` still wins last.
 *   `undefined` entries are skipped; an empty array is no part. A single part behaves exactly
 *   as an array of one.
 * - **Never forwarded:** `children`, `as`, `key` and `dangerouslySetInnerHTML` (type errors on
 *   {@link SlotPart}; the component owns the part's content and element), and an own
 *   `__proto__` key (parsed JSON), which never reaches the result or its prototype.
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
 * @param part The consumer's props for the part (`slotProps?.track`), several parts applied in
 *   order, or `undefined`.
 * @param own  What the component puts on the part.
 * @returns The props to spread on the part's element.
 */
export function mergeSlotProps<E extends keyof React.JSX.IntrinsicElements = 'span'>(
  part: SlotPart<E> | readonly (SlotPart<E> | undefined)[] | undefined,
  own: SlotPartOwn,
): Record<string, unknown> {
  const defaults = own.defaults ?? {};
  const locked = own.locked ?? {};
  const blocked = own.blockHandlers;
  const result: Props = { ...defaults };
  const classes: unknown[] = [];
  /** The consumer's handlers and id lists, in layer order, for each key. */
  const lists: Record<string, unknown[]> = {};
  let style = own.style as Props | undefined;
  let ref = own.ref;

  for (const layer of [part].flat() as (Props | undefined)[]) {
    for (const [key, value] of Object.entries(layer ?? {})) {
      if (value == null || NOT_FORWARDED.has(key)) continue;
      const handler = HANDLER_KEY.test(key);
      if (handler || ID_LIST_KEYS.has(key)) {
        // Only a function counts as a handler: `onClick: cond && fn` never removes ours.
        if (
          !handler ||
          (typeof value === 'function' && blocked !== true && !blocked?.includes(key))
        ) {
          (lists[key] ??= []).push(value);
        }
      } else if (key === 'className') {
        if (value) classes.push(value);
      } else if (key === 'style') {
        style = assignPresent({ ...style }, value as Props);
      } else if (key === 'ref') {
        ref = ref ? mergeRefPair(ref, value as object) : (value as React.Ref<unknown>);
      } else {
        result[key] = value;
      }
    }
  }

  const className = classes.length ? cn(own.className, classes) : own.className;
  if (className !== undefined) result.className = className;
  if (own.style || (style && Object.keys(style).length)) result.style = style;
  if (ref) result.ref = ref;

  Object.assign(result, locked);
  for (const [key, list] of Object.entries(lists)) {
    if (!HANDLER_KEY.test(key)) {
      result[key] = joinIds(
        (key in locked ? locked : defaults)[key] as string,
        ...(list as string[]),
      );
      continue;
    }
    const handlers = list as Handler[];
    const theirs: Handler =
      handlers.length > 1
        ? (event) => {
            for (const handler of handlers) handler(event);
          }
        : handlers[0];
    const ours = typeof locked[key] === 'function' ? locked[key] : defaults[key];
    result[key] =
      typeof ours === 'function' ? composeEventHandlers(theirs, ours as Handler) : theirs;
  }
  return result;
}
