/** Options of {@link getInitials}. */
export interface GetInitialsOptions {
  /**
   * Text direction of the place the initials are shown. In `'rtl'` the first and last initial swap,
   * so they read in the order of the name on screen.
   * @default 'ltr'
   */
  dir?: 'ltr' | 'rtl';
  /**
   * Keep only the first initial, also for a name of several words.
   * @default false
   */
  firstInitialOnly?: boolean;
}

/** Bracketed text: removed together with its brackets. Nested groups go in a few passes. */
const BRACKETED = /\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}|<[^<>]*>/g;

/** Everything but letters, marks, numbers and white space: punctuation, symbols and emoji. */
const NOT_NAME_TEXT = /[^\p{L}\p{M}\p{N}\s]/gu;

/**
 * Scripts whose names have no letter initials (ideographs, syllabaries and scripts written without
 * word spaces): a name that contains one gives no initials.
 */
const NO_LETTER_INITIALS =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u;

/** Apostrophes and hyphens join the parts of one word (`O'Brien`, `Jean-Luc`). */
const WORD_JOINERS = /['\u2018\u2019\u00B4`\-\u2010-\u2015]/g;

/** A letter with the marks that belong to it. */
const LEADING_LETTER = /\p{L}\p{M}*/u;

/**
 * The initials of a person's name, for an avatar: the first letter of the first and, with two or
 * more words, of the last word, upper-cased.
 *
 * Text in `()`, `[]`, `{}` and `<>` and all punctuation are ignored (`'Jane Doe (Contoso)'` gives
 * `'JD'`). A name with no letters (a phone number, an emoji) or with letters of a script without
 * letter initials (Han, Hiragana, Katakana, Hangul, Thai, Lao, Khmer, Myanmar, Tibetan) gives
 * `''`, so an avatar falls back to its person glyph. Server-safe.
 *
 * @example
 * getInitials('Jane Doe (Contoso)'); // 'JD'
 * getInitials('Jane Doe', { dir: 'rtl' }); // 'DJ'
 * getInitials('+1 (555) 010-0000'); // ''
 */
export function getInitials(name: string, options: GetInitialsOptions = {}): string {
  const { dir = 'ltr', firstInitialOnly = false } = options;
  let text = name;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = text.replace(BRACKETED, ' ');
    if (next === text) break;
    text = next;
  }
  text = text.replace(WORD_JOINERS, '').replace(NOT_NAME_TEXT, ' ');
  if (NO_LETTER_INITIALS.test(text)) return '';
  const letters = text
    .split(/\s+/)
    .map((word) => LEADING_LETTER.exec(word)?.[0])
    .filter((letter): letter is string => letter !== undefined);
  if (letters.length === 0) return '';
  const first = letters[0]!.toUpperCase();
  if (firstInitialOnly || letters.length === 1) return first;
  const last = letters[letters.length - 1]!.toUpperCase();
  return dir === 'rtl' ? last + first : first + last;
}
