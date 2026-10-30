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
 * The characters no token value may hold. React writes a custom property's value into the
 * server-rendered `style` attribute as text, where a semicolon would end the declaration and let
 * the rest of the value declare a property of its own (and a brace could close the rule around
 * it); in the client the CSSOM refuses a value with a semicolon, so the two renders would also
 * differ.
 */
const DECLARATION_BREAK = /[;{}]/;

/**
 * Whether `text` closes everything it opens, read as the CSS tokenizer reads it: every string
 * closes on its own line (a backslash in it escapes the next character, a line break included),
 * every comment closes, the parentheses and square brackets outside strings and comments pair up
 * and nest, and no backslash outside a comment is left at the end without a character to escape.
 * In the server-rendered `style` attribute an open string, comment, parenthesis or bracket would
 * run on to the end of the attribute and a trailing backslash would escape the semicolon after the
 * value, so the declarations after it would be lost there, while the client sets each property on
 * its own. A stray closer is refused too, as the client refuses it in a custom property. One pass
 * over the text, without backtracking, so a long crafted value cannot stall a server render.
 */
function isBalancedCssText(text: string): boolean {
  // The closers of the open parentheses and brackets, the innermost last. A closer that is not the
  // innermost one adds a mark no closer matches, so the stack never empties again.
  let closers = '';
  // The quote of the open string, '' outside one.
  let quote = '';
  let index = 0;
  for (; index < text.length; index++) {
    const char = text[index];
    if (char === '\\') {
      // An escape takes the next character, in a string or outside one. A backslash at the end
      // takes none and leaves the index past the end, which fails below.
      index++;
    } else if (quote) {
      if (char === quote) quote = '';
      else if ('\n\r\f'.includes(char)) return false;
    } else if ('"\''.includes(char)) {
      quote = char;
    } else if (char === '/' && text[index + 1] === '*') {
      // A comment runs to its first `*/` and escapes nothing; one that never ends moves the index
      // past the end.
      index = text.indexOf('*/', index + 2) + 1 || Infinity;
    } else if ('(['.includes(char)) {
      closers += char === '(' ? ')' : ']';
    } else if (')]'.includes(char)) {
      closers = closers.endsWith(char) ? closers.slice(0, -1) : `${closers}!`;
    }
  }
  return index === text.length && !quote && !closers;
}

/**
 * The custom properties of `overrides`, and the entries it skipped. Pure: it never warns, so the
 * provider can call it during render; {@link getTokenStyle} reports the skipped entries.
 *
 * `undefined` values are skipped first (they set nothing); a key that is not a camelCase
 * identifier is skipped with the reason `'name'`, and a value with the reason `'value'` unless it
 * is a finite number or a string without `;`, `{` or `}` that closes every string, comment,
 * parenthesis and square bracket it opens, has no stray closer and ends in no unpaired backslash.
 * Numbers are written as strings, and the style keeps the order of the input. `style` is
 * `undefined` when nothing is left.
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
      (typeof value === 'string' && !DECLARATION_BREAK.test(value) && isBalancedCssText(value)) ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      style[tokenVariable(key)] = String(value);
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
 * skipped, a number is written as its string, and the properties keep the order of the input. A
 * key that is not a camelCase identifier is skipped with a development warning (once per key), and
 * so is a value unless it is a finite number or CSS text without `;`, `{` or `}` whose quotes,
 * parentheses, square brackets and comments are balanced and that ends in no unpaired backslash.
 * In a server-rendered `style` attribute such a character could add a declaration of its own, and
 * an open string, comment or bracket (or a trailing backslash) would swallow the declarations
 * after it. Names are not checked against the list of tokens: TypeScript refuses a misspelled one,
 * and in JavaScript it sets a property nothing reads.
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
          'text without `;`, `{`, `}` and with balanced quotes, brackets and comments.',
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
