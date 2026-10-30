/**
 * The design tokens in JavaScript: their names, the overrides `WaveProvider` takes and the inline
 * style that applies them. Server-safe and light enough for the provider: it imports only types
 * and the development warnings, never the list of token names (`waveTokens.ts`).
 */
import type * as React from 'react';
import { warnOnce } from './dev';
import type { WAVE_TOKEN_NAMES } from './waveTokens';

/**
 * The name of a design token: its CSS custom property without the `--wave-` prefix, in camelCase.
 * `--wave-primary-foreground` is `primaryForeground`, `--wave-brand-80` is `brand80` and
 * `--wave-palette-red-tint` is `paletteRedTint`.
 */
export type WaveTokenName = (typeof WAVE_TOKEN_NAMES)[number];

/** The shape of `waveTokens`: every token name mapped to the CSS value that reads the token. */
export type WaveTokens = { readonly [K in WaveTokenName]: string };

/**
 * Token overrides: CSS values by token name, as `WaveProvider tokens` and `getTokenStyle` take
 * them. A number is written as its string (`zOverlay: 2000`); a key whose value is `undefined`
 * sets nothing.
 */
export type WaveTokenOverrides = { [K in WaveTokenName]?: string | number };

/**
 * The inline style that applies token overrides: a React style object whose `--wave-*` custom
 * properties set the tokens, so it can be merged with other style properties.
 */
export type TokenStyle = React.CSSProperties & { [K in `--wave-${string}`]?: string };

/**
 * The CSS custom property of a token name at the type level: `TokenVariable<'brand80'>` is
 * `'--wave-brand-80'`, by the rule of {@link tokenVariable}. It spells out the literal values of
 * `waveTokens`. It walks the name one character at a time (tail-recursive, so long names stay
 * within the compiler's depth limit): `AfterLetter` says whether the previous character was a
 * letter, `Done` holds the converted text so far.
 */
export type TokenVariable<
  Name extends string,
  AfterLetter extends boolean = false,
  Done extends string = '',
> = Name extends `${infer Char}${infer Rest}`
  ? Char extends '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
    ? TokenVariable<Rest, false, `${Done}${AfterLetter extends true ? '-' : ''}${Char}`>
    : Char extends Lowercase<Char>
      ? TokenVariable<Rest, true, `${Done}${Char}`>
      : TokenVariable<Rest, true, `${Done}-${Lowercase<Char>}`>
  : `--wave-${Done}`;

/**
 * The CSS custom property of a token name: a hyphen before each capital letter and before a digit
 * run that follows a letter, lowercased, with the `--wave-` prefix. `'paletteRedTint'` gives
 * `'--wave-palette-red-tint'` and `'brand80'` gives `'--wave-brand-80'`. The name is not checked
 * against the list of tokens.
 */
export function tokenVariable(name: string): string {
  return `--wave-${name
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .replace(/[A-Z]/g, (capital) => `-${capital}`)
    .toLowerCase()}`;
}

/** A camelCase identifier: the only key shape a token name can have. */
const TOKEN_NAME = /^[a-z][A-Za-z0-9]*$/;

/**
 * The text no token value may hold, anywhere in it. React writes a custom property's value into
 * the server-rendered `style` attribute as text, where a semicolon would end the declaration and
 * let the rest of the value declare a property of its own (and a brace could close the rule around
 * it); in the client the CSSOM refuses a value with a semicolon, so the two renders would also
 * differ. `url(`, in any case: no token takes a URL, and an unquoted one ends at its first `)`
 * whatever it holds, which the balance check below does not follow (`url(a"b)c")` would open a
 * string after that `)`); the check refuses the escapes that could spell it otherwise (`u\72l(`).
 */
const REFUSED_TEXT = /[;{}]|url\(/i;

/**
 * Whether `text` closes everything it opens, read as the CSS tokenizer reads it: every string
 * closes on its own line (a backslash in it escapes the next character, a line break included),
 * every comment closes, and the parentheses and square brackets outside strings and comments pair
 * up and nest. In the server-rendered `style` attribute an open string, comment, parenthesis or
 * bracket would run on to the end of the attribute, so the declarations after it would be lost
 * there, while the client sets each property on its own. Refused as well, outside strings and
 * comments: a stray closer, which the client refuses in a custom property; a `!`, since the server
 * would read `!important` as the declaration's priority while the client refuses a `!` at the top
 * level (one nested in a function, as in `color-mix(in srgb, red !important, blue)`, is valid there, and refusing
 * it is deliberate: no token needs it); and a backslash, which no token needs there and which
 * could spell `url(` with an escape or, at the end, escape the semicolon after the value. One pass
 * over the text, each character read once and the stack an array, so the time grows with the
 * length alone and a long crafted value cannot stall a server render.
 */
function isBalancedCssText(text: string): boolean {
  // The closers of the open parentheses and brackets, the innermost last.
  const closers: string[] = [];
  // The quote of the open string, '' outside one.
  let quote = '';
  let index = 0;
  for (; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      // An escape takes the next character; a backslash at the end leaves the string open.
      if (char === '\\') index++;
      else if (char === quote) quote = '';
      else if ('\n\r\f'.includes(char)) return false;
    } else if ('"\''.includes(char)) {
      quote = char;
    } else if (char === '/' && text[index + 1] === '*') {
      // A comment runs to its first `*/` and escapes nothing; one that never ends moves the index
      // past the end.
      index = text.indexOf('*/', index + 2) + 1 || Infinity;
    } else if ('(['.includes(char)) {
      closers.push(char === '(' ? ')' : ']');
    } else if (')]!\\'.includes(char) && closers.pop() !== char) {
      // A closer that is not the innermost one's, or a `!` or a backslash, which no opener
      // expects: the index moves past the end, which fails below.
      index = Infinity;
    }
  }
  return index === text.length && !quote && !closers.length;
}

/**
 * The custom properties of `overrides`, and the entries it skipped. Pure: it never warns, so the
 * provider can call it during render; {@link getTokenStyle} reports the skipped entries.
 *
 * `undefined` values are skipped first (they set nothing); a key that is not a camelCase
 * identifier is skipped with the reason `'name'`, and a value with the reason `'value'` unless it
 * is a finite number or a string without `;`, `{`, `}` or `url(` that closes every string,
 * comment, parenthesis and square bracket it opens and has no stray closer, `!` or backslash
 * outside strings and comments. Numbers are written as strings, and every value is trimmed with
 * JavaScript's `trim`, as React's server renderer trims a custom property's value (the client sets
 * the value as given), so both write the same text; a value that is empty after it is written as
 * `''`, for which React renders no declaration on either side. The style keeps the order of the
 * input. `style` is `undefined` when nothing is left.
 */
export function collectTokenStyle(overrides: WaveTokenOverrides | null | undefined): {
  style: TokenStyle | undefined;
  invalid: readonly { key: string; reason: 'name' | 'value' }[];
} {
  const invalid: { key: string; reason: 'name' | 'value' }[] = [];
  if (overrides == null) return { style: undefined, invalid };
  const style: Record<string, string> = {};
  let empty = true;
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (!TOKEN_NAME.test(key)) {
      invalid.push({ key, reason: 'name' });
    } else if (
      (typeof value === 'string' && !REFUSED_TEXT.test(value) && isBalancedCssText(value)) ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      style[tokenVariable(key)] = String(value).trim();
      empty = false;
    } else {
      invalid.push({ key, reason: 'value' });
    }
  }
  return { style: empty ? undefined : (style as TokenStyle), invalid };
}

/**
 * The inline style that applies token overrides: one `--wave-*` custom property per entry, the
 * object `WaveProvider` puts on its root and its portals. Use it where no provider renders, such
 * as a Server Component's document element. Server-safe.
 *
 * Returns `undefined` for `null`, `undefined` or a map with nothing to set. An `undefined` value is
 * skipped, a number is written as its string, a string is trimmed as React's server renderer trims
 * it, and the properties keep the order of the input. A key that is not a camelCase identifier is
 * skipped with a development warning (once per key), and so is a value unless it is a finite
 * number or CSS text without `;`, `{`, `}` or `url(` whose quotes, parentheses, square brackets and
 * comments are balanced, with no `!` or backslash outside strings and comments. In a
 * server-rendered `style` attribute such a character could add a declaration of its own, an open
 * string, comment or bracket (or an escape that spells `url(` or takes the semicolon after the
 * value) would swallow the declarations after it, and `!important` would set a priority the client
 * refuses; the trimmed values that pass are read alike by the attribute and by the client. Names
 * are not checked against the list of tokens: TypeScript refuses a misspelled one, and in
 * JavaScript it sets a property nothing reads.
 *
 * @example
 * // app/layout.tsx (a Server Component)
 * <html style={getTokenStyle({ brand80: '#c43e00' })}>
 *
 * @example
 * <div style={{ ...getTokenStyle(overrides), padding: 16 }} />
 */
export function getTokenStyle(
  overrides: WaveTokenOverrides | null | undefined,
): TokenStyle | undefined {
  const { style, invalid } = collectTokenStyle(overrides);
  for (const { key, reason } of invalid) {
    if (reason === 'name') {
      warnOnce(
        `tokens:name:${key}`,
        `getTokenStyle: \`${key}\` is not a token name, so it is skipped. Token names are the CSS ` +
          'variable in camelCase without its `--wave-` prefix (`primaryForeground` for ' +
          '`--wave-primary-foreground`).',
      );
    } else {
      warnOnce(
        `tokens:value:${key}`,
        `getTokenStyle: the value of \`${key}\` is skipped: it must be a finite number, or CSS ` +
          'text with balanced quotes, brackets and comments, without `;`, `{`, `}` or `url(`, and ' +
          'without `!` or a backslash outside strings and comments.',
      );
    }
  }
  return style;
}

/**
 * The overrides of a nested provider: `own` merged key by key over `parent`. `undefined` inherits
 * `parent` as it is, `null` clears everything inherited, and a key whose own value is `undefined`
 * keeps the parent's value.
 */
export function mergeTokenOverrides(
  parent: WaveTokenOverrides,
  own: WaveTokenOverrides | null | undefined,
): WaveTokenOverrides {
  if (own === null) return {};
  if (own === undefined) return parent;
  // Spread, never assignment, so a `__proto__` key is an own entry like any other.
  const defined = Object.fromEntries(
    Object.entries(own).filter(([, value]) => value !== undefined),
  );
  return { ...parent, ...defined };
}
