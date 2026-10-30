import type * as React from 'react';

/**
 * The props of the element `E` that {@link getNativeElementProps} can return: its attributes,
 * event handlers and `ref`, and any `data-*` attribute.
 */
export type NativeElementProps<E extends keyof React.JSX.IntrinsicElements> = Partial<
  React.JSX.IntrinsicElements[E]
> & { [K in `data-${string}`]?: unknown };

// The lists are space-separated literals (smaller than arrays of strings once minified);
// `src/lib/__tests__/nativeProps.test.tsx` proves at type level that every name is a prop of the
// tag in React's own types, and at run time that React logs nothing for any of them.

/** The global attributes every element keeps, with `ref` and `key`. */
export const NATIVE_GLOBAL_PROPS =
  'id className style title lang dir hidden role tabIndex draggable contentEditable spellCheck translate accessKey slot inert popover ref key';

/** The names of the DOM events (`Click` for `onClick`): each also has a capture-phase `…Capture` handler. */
export const NATIVE_EVENT_NAMES =
  'Copy Cut Paste CompositionEnd CompositionStart CompositionUpdate Focus Blur Change BeforeInput Input Reset Submit Invalid Load Error KeyDown KeyPress KeyUp Abort CanPlay CanPlayThrough DurationChange Emptied Encrypted Ended LoadedData LoadedMetadata LoadStart Pause Play Playing Progress RateChange Seeked Seeking Stalled Suspend TimeUpdate VolumeChange Waiting AuxClick Click ContextMenu DoubleClick Drag DragEnd DragEnter DragExit DragLeave DragOver DragStart Drop MouseDown MouseEnter MouseLeave MouseMove MouseOut MouseOver MouseUp Select TouchCancel TouchEnd TouchMove TouchStart PointerDown PointerMove PointerUp PointerCancel PointerEnter PointerLeave PointerOver PointerOut GotPointerCapture LostPointerCapture Scroll ScrollEnd Wheel AnimationStart AnimationEnd AnimationIteration Toggle BeforeToggle TransitionCancel TransitionEnd TransitionRun TransitionStart';

/**
 * What a tag keeps besides the global set. A tag that is not listed keeps the global set only,
 * as does a listed table part without attributes of its own (`table`, `tbody`, `thead`, `tfoot`,
 * `tr`: their remaining attributes are obsolete in HTML).
 */
export const NATIVE_TAG_PROPS = {
  a: 'href target rel download hrefLang type referrerPolicy ping',
  button:
    'autoFocus disabled form formAction formEncType formMethod formNoValidate formTarget name popoverTarget popoverTargetAction type value',
  img: 'src srcSet sizes alt width height loading decoding crossOrigin referrerPolicy fetchPriority',
  input:
    'accept alt autoComplete autoFocus capture checked defaultChecked defaultValue disabled enterKeyHint form formAction formEncType formMethod formNoValidate formTarget height inputMode list max maxLength min minLength multiple name pattern placeholder readOnly required size src step type value width',
  label: 'htmlFor',
  li: 'value',
  ol: 'reversed start type',
  option: 'disabled label value',
  select: 'autoComplete autoFocus defaultValue disabled form multiple name required size value',
  td: 'abbr colSpan headers rowSpan scope',
  textarea:
    'autoComplete autoFocus cols defaultValue disabled enterKeyHint form inputMode maxLength minLength name placeholder readOnly required rows value wrap',
  th: 'abbr colSpan headers rowSpan scope',
} as const;

const allowedByTag = new Map<string, ReadonlySet<string>>();
let baseNames: string[] | undefined;

/** The global names and the event handlers (React has no capture handler for these). */
function getBaseNames(): string[] {
  if (!baseNames) {
    baseNames = NATIVE_GLOBAL_PROPS.split(' ');
    for (const event of NATIVE_EVENT_NAMES.split(' ')) {
      baseNames.push(`on${event}`);
      if (!/Enter|Leave|Toggle/.test(event)) baseNames.push(`on${event}Capture`);
    }
  }
  return baseNames;
}

function getAllowedNames(tag: string): ReadonlySet<string> {
  let allowed = allowedByTag.get(tag);
  if (!allowed) {
    const own = (NATIVE_TAG_PROPS as Record<string, string | undefined>)[tag];
    allowed = new Set([...getBaseNames(), ...(own ? own.split(' ') : [])]);
    allowedByTag.set(tag, allowed);
  }
  return allowed;
}

/**
 * The props of `props` that the intrinsic element `tag` accepts: the same whitelist idea as Fluent
 * UI's `getIntrinsicElementProps` (and its deprecated alias `getNativeElementProps`), much
 * smaller. Use it to forward the native props of a custom slot component to its element without
 * leaking component-only props (`appearance`, `slotProps`, `onValueChange`) into the DOM, where
 * React would warn about them.
 *
 * It keeps the global attributes (`id`, `className`, `style`, `title`, `lang`, `dir`, `hidden`,
 * `role`, `tabIndex`, `draggable`, `contentEditable`, `spellCheck`, `translate`, `accessKey`,
 * `slot`, `inert`, `popover`), every DOM event handler (`onClick`, and the capture-phase
 * `onClickCapture`), every `data-*` and `aria-*` attribute, `ref` and `key`, plus the attributes
 * of the tag for `a`, `button`, `img`, `input`, `label`, `li`, `ol`, `option`, `select`, `td`,
 * `textarea` and `th` (`div`, `span`, `ul` and the table containers have none of their own). A tag
 * outside the table keeps the global set only. Everything else is dropped, `children` included.
 * Server-safe: the module holds no React runtime and touches no DOM, and it costs nothing in a
 * bundle that does not import it.
 *
 * @param tag - The intrinsic element the props are for.
 * @param props - The props to filter; they are read, never changed.
 * @param excludedNames - Names to leave out even when the tag accepts them (an `id` or
 * `onClick` the component sets itself).
 * @returns A new props object, typed as the element's props, that spreads onto `tag`.
 * @example
 * ```tsx
 * const Track = (props: TrackProps) => <span {...getNativeElementProps('span', props, ['id'])} />;
 * ```
 */
export function getNativeElementProps<
  P extends object,
  E extends keyof React.JSX.IntrinsicElements,
>(tag: E, props: P, excludedNames?: readonly (keyof P & string)[]): NativeElementProps<E> {
  const allowed = getAllowedNames(tag);
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(props)) {
    if (
      (allowed.has(name) || name.startsWith('data-') || name.startsWith('aria-')) &&
      !(excludedNames as readonly string[] | undefined)?.includes(name)
    ) {
      result[name] = (props as Record<string, unknown>)[name];
    }
  }
  return result as NativeElementProps<E>;
}
