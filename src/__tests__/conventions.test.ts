/**
 * Conventions gate (spec §4.4, F6t). Scans every source file of `src/components` (tests
 * excluded) and, for raw colors only, every `stories/*.stories.tsx`, with one `it` per file named
 * after its path — filter with `npx vitest run src/__tests__/conventions.test.ts -t "<path>"`.
 * Each failure lists `file:line [rule] <offending text> — <fix>`.
 *
 * Rules (components; stories: `raw-color` and `lexer` only):
 * - `raw-color` (C-TOKENS): arbitrary hex `[#…]`, color functions (`rgb()/rgba()/hsl()/hsla()/
 *   hwb()/lab()/lch()/oklab()/oklch()` — Tailwind 4's palette is oklch — and `color(<space> …)`),
 *   CSS named colors in arbitrary color values (`text-[red]`, `bg-[color:white]`,
 *   `shadow-[0_0_2px_red]`, `[color:red]`), `white`/`black` and Tailwind palette color utilities
 *   (`green-600`, opacity modifiers `/40`, `/[0.3]`, `/(--op)` included), 0.4 ramp variables
 *   (`var(--grey-*)`, `var(--brand-*)` and the Tailwind 4 shorthand `bg-(--grey-60)`), literal
 *   SVG paint colors (`stroke="white"`, `fill={'black'}`), hex/color-function values in strings
 *   (anchors such as `href="#cafe"` and `url(#id)` references excepted) and CSS named colors
 *   wherever they paint: the value of a paint attribute (`stroke`/`fill`/`stopColor`/`floodColor`/
 *   `lightingColor`/`color`: `<svg color="white" />`) or of a color-like object key
 *   (`{ color: 'white' }`, `border: '1px solid red'`), including every result of that value's
 *   expression — ternary branches, `||`/`??`/`&&` operands (`stroke={on ? 'white' : 'none'}`,
 *   `{ color: active ? 'white' : 'black' }`, `{ background: bg ?? 'navy' }`); a comparand
 *   (`tone === 'red' ? …`), a call argument or a union type member is not a painted value. Stories
 *   may mark fixture data with the literal `wave-allow-color: fixture` (swatches, placeholders);
 *   in components `wave-allow-color: <reason>` allows only a runtime color *value* (the C-TOKENS
 *   exception for user swatches), never a color utility class.
 * - `physical` (C-LOGICAL): `ml-/mr-/pl-/pr-/left-/right-`, `scroll-m|p` l/r, `border-l/r`,
 *   `rounded-l/r/tl/tr/bl/br`, `text-/float-/clear-left|right`, `origin-*left|right`,
 *   `bg-linear-to-l/r` — unless scoped with the `wave-rtl:` variant or the line carries
 *   `wave-allow-physical: <reason>`.
 * - `translate-x` (C-LOGICAL): a `translate-x-*` class (other than `translate-x-0`) on a line
 *   without a `wave-rtl:` `translate-x-*` counterpart (or `wave-allow-physical`).
 * - `direction-variant` (C-LOGICAL): any class with Tailwind's bare `rtl:`/`ltr:` variant
 *   (`not-rtl:`/`not-ltr:` included), whatever the utility.
 * - `focus-outline-none` (C-FOCUS): `focus:`/`focus-visible:`/`focus-within:outline-none`.
 * - `arbitrary-animate` (C-MOTION): `animate-[…]` — use the `animate-wave-*` tokens.
 * - `forward-ref` (C-REF): `forwardRef(` — React 19 ref-as-prop.
 * - `enabled-variant` (C-TOKENS state gating): any `enabled:` variant.
 * - `button-type` (C-BUTTON-TYPE): a JSX `<button` opening tag (multi-line aware) without a
 *   literal `type=` attribute.
 * - `motion` (C-MOTION): a class string with `transition*` (not `transition-none`) or `animate-*`
 *   (not `animate-none`) without a `motion-reduce:` variant **of the same kind** in the same string
 *   or on the same line — `motion-reduce:transition-*`/`motion-reduce:duration-*` for a
 *   transition, `motion-reduce:animate-*` for an animation (a `motion-reduce:animate-none` does not
 *   stop a `transition-colors`) — unless the line carries `wave-allow-motion: <reason>`.
 *   `motion-safe:` utilities need no reduction.
 * - `lexer`: the source could not be tokenised reliably (an unterminated string, template literal
 *   or JSX element, unbalanced braces, or a template literal longer than
 *   {@link MAX_TEMPLATE_LINES} lines). Every other finding of that file is unreliable, so this is
 *   a failure of its own rather than a silently disabled gate.
 *
 * Direction variants (C-LOGICAL): Wave's own `wave-rtl:` (defined in its CSS entries with
 * `:dir(rtl)`) is the only one, because Tailwind's `rtl:` also matches inside an LTR subtree of an
 * RTL ancestor (and `ltr:` inside an RTL subtree of an LTR one). Write the left-to-right value as
 * the base class and override it with `wave-rtl:`; `node scripts/build-css.mjs` also fails when a
 * bare `rtl:`/`ltr:` class ships in `dist/styles.css`.
 *
 * An allow marker counts on the offending line or on the comment-only line directly above it
 * (`// …`, `/* … *\/` or a JSX comment `{/* … *\/}`). Comments are ignored by every rule. The gate
 * is green: a failing file has a convention violation (or a lexer limitation, reported as
 * `lexer`), never an expected failure.
 *
 * The lexer understands comments, string and template literals (with nested `${…}`), regex
 * literals (a `/` where an expression can start) and, in `.tsx` files, JSX: text between tags is
 * neither code nor a string (an apostrophe in `<p>It's</p>` opens nothing), attribute strings
 * may span lines, and `{…}` containers switch back to code. A keyword used as a property name
 * (`obj.default / 2`) is a value, so a `/` after it divides.
 *
 * Generic type parameters in `.tsx`: a generic arrow function needs `<T,>` / `<T extends …>`
 * (TypeScript itself requires that in an expression, where `<T>(…)` is JSX). In type positions
 * TypeScript accepts `<T>`, and so does the gate for a generic function type with a capitalised
 * parameter name (`type Fn = <T>(x: T) => T`, `renderItem: <T>(item: T) => ReactNode`,
 * `cb: <Value>(v: Value) => void` — recognised by the `=>` after the parameter list). Any other
 * type-position `<T>` that the gate reads as JSX (a lowercase name `<t>(x: t) => t`, a call
 * signature `{ <T>(x: T): T }`) is reported as a `lexer` finding (`unclosed JSX element`); write
 * it as `<T,>` (valid TypeScript there too) — a limitation of the gate, not a TypeScript error.
 *
 * Sources are read with `import.meta.glob(..., { query: '?raw' })` (no `node:fs`, so the dev
 * program needs no Node types).
 */

type SourceKind = 'component' | 'story';

type RuleId =
  | 'raw-color'
  | 'physical'
  | 'translate-x'
  | 'focus-outline-none'
  | 'arbitrary-animate'
  | 'forward-ref'
  | 'enabled-variant'
  | 'button-type'
  | 'motion'
  | 'direction-variant'
  | 'lexer';

interface Violation {
  line: number;
  column: number;
  rule: RuleId;
  text: string;
}

const HINTS: Record<RuleId, string> = {
  'raw-color': 'use a theme token (C-TOKENS)',
  physical:
    'use a logical utility (ms/me/ps/pe/start/end/border-s/e/rounded-s/e/text-start/end) or add `// wave-allow-physical: <reason>` (C-LOGICAL)',
  'translate-x':
    'add the `wave-rtl:` counterpart on the same line (e.g. `translate-x-4 wave-rtl:-translate-x-4`) or `// wave-allow-physical: <reason>` (C-LOGICAL)',
  'focus-outline-none': 'use `focus:outline-hidden` (C-FOCUS)',
  'arbitrary-animate': 'use an `animate-wave-*` token (C-MOTION)',
  'forward-ref': 'use React 19 ref-as-prop (C-REF)',
  'enabled-variant':
    'gate with `not-disabled:not-aria-disabled:hover:` / `…:active:` (C-TOKENS state gating)',
  'button-type': 'add `type="button"` before `{...rest}` (C-BUTTON-TYPE)',
  'direction-variant':
    "use Wave's `wave-rtl:` variant: Tailwind's `rtl:`/`ltr:` also match inside a subtree of the opposite direction. Write the left-to-right value as the base class and override it with `wave-rtl:` (C-LOGICAL)",
  motion:
    'add a `motion-reduce:` variant of the same kind (`motion-reduce:transition-none` for a transition, `motion-reduce:animate-*` for an animation) to the same class string, or `// wave-allow-motion: <reason>` (C-MOTION)',
  lexer:
    'the conventions lexer lost track of this file here, so its other findings are unreliable. This is a limitation of the gate, not necessarily an error in the code: simplify the construct (in .tsx, write type parameters the gate reads as JSX — e.g. a call signature `{ <T>(x: T): T }` or a lowercase `<t>(x: t) => t` — as `<T,>`, valid in type positions too) or fix the lexer in src/__tests__/conventions.test.ts',
};

// ---------------------------------------------------------------------------
// Lexer: blanks comments (and, for the "bare" view, string contents, regex bodies and JSX text)
// while keeping offsets and line numbers, and collects string/template literal text.
// ---------------------------------------------------------------------------

interface StringLiteral {
  id: number;
  /** Offset of the opening quote or backtick. */
  start: number;
  /** Text spans (a template literal has one per part between `${…}` substitutions). */
  spans: Array<[start: number, end: number]>;
  /** A JSX attribute string (`color="white"`), not a JavaScript string. */
  jsxAttribute: boolean;
}

interface LexProblem {
  offset: number;
  message: string;
}

interface Lexed {
  /** The source with normalised line endings. */
  src: string;
  lines: string[];
  /** Per line: comments blanked; strings, regex literals and JSX text kept. */
  code: string[];
  /** Whole file: `code` joined (same offsets as `src`). */
  codeText: string;
  /** Whole file: comments, string contents, regex bodies and JSX text blanked (same offsets). */
  bareText: string;
  /** Per line: `bareText` lines. */
  bare: string[];
  strings: StringLiteral[];
  /** Offsets of the `{` of every JSX attribute expression (`stroke={…}`). */
  jsxContainers: Set<number>;
  lineStarts: number[];
  /** Places where the lexer lost track (reported as `lexer` findings). */
  problems: LexProblem[];
}

/** A template literal longer than this is reported as a runaway literal (`lexer`). */
const MAX_TEMPLATE_LINES = 40;

/** Words after which an expression — so a regex literal or a JSX element — can start. */
const EXPRESSION_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
  'default',
]);

type Mode =
  /** Code; `depth` counts open `{` of this region, `exprStart`: an expression can start here. */
  | { kind: 'code'; depth: number; exprStart: boolean; start: number }
  | { kind: 'template'; lit: StringLiteral; from: number; start: number }
  | { kind: 'jsxTag'; closing: boolean; start: number }
  /** Inside a JSX tree; `open` counts elements whose opening tag has closed. */
  | { kind: 'jsxChildren'; open: number; start: number };

const UNCLOSED: Record<Mode['kind'], string> = {
  code: 'unclosed `{…}` expression',
  template: 'unterminated template literal',
  jsxTag: 'unclosed JSX tag',
  jsxChildren: 'unclosed JSX element',
};

function lex(source: string, jsx = true): Lexed {
  const src = source.replace(/\r\n?/g, '\n');
  const n = src.length;
  const code = src.split('');
  const bare = src.split('');
  const strings: StringLiteral[] = [];
  const jsxContainers = new Set<number>();
  const problems: LexProblem[] = [];
  const blank = (arr: string[], from: number, to: number) => {
    for (let k = from; k < to; k++) if (arr[k] !== '\n') arr[k] = ' ';
  };

  const modes: Mode[] = [{ kind: 'code', depth: 0, exprStart: true, start: 0 }];
  const top = () => modes[modes.length - 1];
  let i = 0;

  /** Blanks a comment starting at `i` (if any) and moves past it. */
  const skipComment = (): boolean => {
    if (src[i] !== '/' || (src[i + 1] !== '/' && src[i + 1] !== '*')) return false;
    let stop: number;
    if (src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      stop = end === -1 ? n : end;
    } else {
      const end = src.indexOf('*/', i + 2);
      stop = end === -1 ? n : end + 2;
    }
    blank(code, i, stop);
    blank(bare, i, stop);
    i = stop;
    return true;
  };

  /** A quoted string at `i`. JSX attribute strings have no escapes and may span lines. */
  const readQuoted = (jsxAttribute: boolean) => {
    const quote = src[i];
    let j = i + 1;
    while (j < n && src[j] !== quote && (jsxAttribute || src[j] !== '\n')) {
      j += !jsxAttribute && src[j] === '\\' ? 2 : 1;
    }
    const end = Math.min(j, n);
    strings.push({ id: strings.length, start: i, spans: [[i + 1, end]], jsxAttribute });
    if (src[j] !== quote) problems.push({ offset: i, message: 'unterminated string literal' });
    blank(bare, i, Math.min(j + 1, n));
    i = j + 1;
  };

  /** End offset (after the flags) of a regex literal starting at `i`, or -1. */
  const regexEnd = (): number => {
    let j = i + 1;
    let inClass = false;
    while (j < n && src[j] !== '\n') {
      const c = src[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) {
        j += 1;
        while (j < n && /[a-z]/i.test(src[j])) j += 1;
        return j;
      }
      j += 1;
    }
    return -1;
  };

  /**
   * Whether `>` + a parenthesised parameter list + `=>` follows offset `k` (the end of a type
   * parameter name): `<T>(item: T) => React.ReactNode` is a generic function *type*.
   */
  const functionTypeFollows = (k: number): boolean => {
    const open = /^\s*>\s*\(/.exec(src.slice(k, k + 40));
    if (!open) return false;
    let depth = 0;
    const limit = Math.min(n, k + 2000);
    for (let j = k + open[0].length - 1; j < limit; j++) {
      const c = src[j];
      if (c === '"' || c === "'" || c === '`') {
        // A string literal type inside the parameter list: skip it (it may contain parentheses).
        const close = src.indexOf(c, j + 1);
        if (close === -1) return false;
        j = close;
      } else if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0) return /^\s*=>/.test(src.slice(j + 1, j + 40));
      }
    }
    return false;
  };

  /**
   * Whether the `<` at `i` opens a JSX element. Not when it opens type parameters: `<T,>`,
   * `<T extends …>`, `<T = …>`, `<K, V>`, or the type parameters of a generic function type
   * `<T>(x: T) => T` (a capitalised plain name, then a parameter list followed by `=>`). In an
   * expression TypeScript itself reads `<T>(…) => …` as JSX, so this only ever matches in type
   * positions (`type Fn = <T>…`, `renderItem: <T>…`, `cb: <T>…`); a lowercase name is kept as JSX
   * so text such as `<code>(value) => void</code>` still lexes.
   */
  const opensJsx = (): boolean => {
    if (src[i + 1] === '>') return true; // fragment
    const name = /^[A-Za-z_$][\w$.:-]*/.exec(src.slice(i + 1, i + 81));
    if (!name) return false;
    const end = i + 1 + name[0].length;
    if (/^\s*(?:,|=|extends\b)/.test(src.slice(end, end + 16))) return false;
    return !(/^[A-Z_$][\w$]*$/.test(name[0]) && functionTypeFollows(end));
  };

  /** Whether the token at `at` is a property name (`obj.default`, `a?.in`), not a keyword. */
  const followsDot = (at: number): boolean => {
    let j = at - 1;
    while (j >= 0 && /\s/.test(bare[j])) j -= 1; // comments and strings are already blank
    return j >= 0 && bare[j] === '.' && bare[j - 1] !== '.'; // `...new X()` is a spread
  };

  /** Pops a finished JSX tree and marks the enclosing code as "after a value". */
  const finishJsxTree = () => {
    const children = top();
    if (children.kind !== 'jsxChildren' || children.open > 0) return;
    modes.pop();
    const resumed = top();
    if (resumed.kind === 'code') resumed.exprStart = false;
  };

  while (i < n) {
    const mode = top();
    const ch = src[i];
    const next = src[i + 1];

    if (mode.kind === 'template') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '`') {
        mode.lit.spans.push([mode.from, i]);
        blank(bare, mode.from, i + 1);
        modes.pop();
        const lineCount = src.slice(mode.start, i).split('\n').length;
        if (lineCount > MAX_TEMPLATE_LINES) {
          problems.push({
            offset: mode.start,
            message: `template literal spans ${lineCount} lines`,
          });
        }
        i += 1;
        continue;
      }
      if (ch === '$' && next === '{') {
        mode.lit.spans.push([mode.from, i]);
        blank(bare, mode.from, i + 2);
        modes.push({ kind: 'code', depth: 0, exprStart: true, start: i });
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (mode.kind === 'jsxChildren') {
      if (ch === '{') {
        modes.push({ kind: 'code', depth: 0, exprStart: true, start: i });
        i += 1;
        continue;
      }
      if (ch === '<') {
        const closing = next === '/';
        modes.push({ kind: 'jsxTag', closing, start: i });
        i += closing ? 2 : 1;
        continue;
      }
      // JSX text is neither code nor a string: quotes and `//` in it open nothing.
      if (ch !== '\n') bare[i] = ' ';
      i += 1;
      continue;
    }

    if (mode.kind === 'jsxTag') {
      if (skipComment()) continue;
      if (ch === '"' || ch === "'") {
        readQuoted(true);
        continue;
      }
      if (ch === '{') {
        jsxContainers.add(i);
        modes.push({ kind: 'code', depth: 0, exprStart: true, start: i });
        i += 1;
        continue;
      }
      if (ch === '<') {
        // Type arguments of a generic component: `<Select<string> …>`.
        let depth = 0;
        do {
          if (src[i] === '<') depth += 1;
          else if (src[i] === '>') depth -= 1;
          i += 1;
        } while (i < n && depth > 0);
        continue;
      }
      if (ch === '/' && next === '>') {
        modes.pop();
        finishJsxTree();
        i += 2;
        continue;
      }
      if (ch === '>') {
        modes.pop();
        const parent = top();
        if (parent.kind === 'jsxChildren') {
          parent.open = Math.max(0, parent.open + (mode.closing ? -1 : 1));
          finishJsxTree();
        }
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    // code
    if (skipComment()) continue;
    if (ch === "'" || ch === '"') {
      readQuoted(false);
      mode.exprStart = false;
      continue;
    }
    if (ch === '`') {
      const lit: StringLiteral = { id: strings.length, start: i, spans: [], jsxAttribute: false };
      strings.push(lit);
      blank(bare, i, i + 1);
      mode.exprStart = false;
      modes.push({ kind: 'template', lit, from: i + 1, start: i });
      i += 1;
      continue;
    }
    if (ch === '/' && mode.exprStart) {
      const end = regexEnd();
      if (end !== -1) {
        blank(bare, i, end);
        mode.exprStart = false;
        i = end;
        continue;
      }
    }
    if (ch === '<' && jsx && mode.exprStart && opensJsx()) {
      modes.push({ kind: 'jsxChildren', open: 0, start: i });
      modes.push({ kind: 'jsxTag', closing: false, start: i });
      i += 1;
      continue;
    }
    if (ch === '{') {
      mode.depth += 1;
      mode.exprStart = true;
      i += 1;
      continue;
    }
    if (ch === '}') {
      if (mode.depth === 0 && modes.length > 1) {
        modes.pop();
        const resumed = top();
        if (resumed.kind === 'template') {
          blank(bare, i, i + 1);
          resumed.from = i + 1;
        }
        i += 1;
        continue;
      }
      mode.depth -= 1;
      mode.exprStart = true;
      i += 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let k = i + 1;
      while (k < n && /[\w$]/.test(src[k])) k += 1;
      // A keyword used as a property name (`obj.default / 2`) is a value: a `/` after it divides.
      mode.exprStart = !followsDot(i) && EXPRESSION_KEYWORDS.has(src.slice(i, k));
      i = k;
      continue;
    }
    if (/\d/.test(ch)) {
      let k = i + 1;
      while (k < n && /[\w.]/.test(src[k])) k += 1;
      mode.exprStart = false;
      i = k;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '<' && next === '<') {
      mode.exprStart = true;
      i += 2;
      continue;
    }
    // `)`/`]` end a value (a following `/` divides); `.` is followed by a property name.
    mode.exprStart = !(ch === ')' || ch === ']' || ch === '.');
    i += 1;
  }

  const unclosed = modes[1];
  if (unclosed) problems.push({ offset: unclosed.start, message: UNCLOSED[unclosed.kind] });
  else if (modes[0].kind === 'code' && modes[0].depth !== 0) {
    problems.push({ offset: n, message: 'unbalanced braces' });
  }

  const lineStarts = [0];
  for (let k = 0; k < n; k++) if (src[k] === '\n') lineStarts.push(k + 1);
  const bareText = bare.join('');
  const codeText = code.join('');
  return {
    src,
    lines: src.split('\n'),
    code: codeText.split('\n'),
    codeText,
    bareText,
    bare: bareText.split('\n'),
    strings,
    jsxContainers,
    lineStarts,
    problems,
  };
}

/** 1-based line of a 0-based offset. */
function lineOf(lexed: Lexed, offset: number): number {
  let lo = 0;
  let hi = lexed.lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lexed.lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

// ---------------------------------------------------------------------------
// Class tokens
// ---------------------------------------------------------------------------

interface ClassToken {
  line: number;
  column: number;
  literal: number;
  raw: string;
  variants: string[];
  utility: string;
}

function parseClass(raw: string): { variants: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of raw) {
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ':' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  const utility = current.replace(/^!/, '').replace(/!$/, '');
  return { variants: parts, utility };
}

function classTokens(lexed: Lexed): ClassToken[] {
  const tokens: ClassToken[] = [];
  for (const lit of lexed.strings) {
    for (const [start, end] of lit.spans) {
      const re = /[^\s'"`]+/g;
      const text = lexed.src.slice(start, end);
      for (let m = re.exec(text); m; m = re.exec(text)) {
        const { variants, utility } = parseClass(m[0]);
        const offset = start + m.index;
        const line = lineOf(lexed, offset);
        tokens.push({
          line,
          column: offset - lexed.lineStarts[line - 1],
          literal: lit.id,
          raw: m[0],
          variants,
          utility,
        });
      }
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const COLOR_PREFIX =
  '(?:bg|text|border(?:-[xytrblse])?|outline|ring(?:-offset)?|fill|stroke|divide|placeholder|from|via|to|shadow|inset-shadow|inset-ring|drop-shadow|text-shadow|accent|caret|decoration)';
/** Opacity modifier: `/40`, `/5.5`, `/[0.3]`, `/(--op)`. */
const OPACITY = '(?:\\/(?:\\[[^\\]]*\\]|\\([^)]*\\)|[\\w.%-]+))?';
const PALETTE =
  '(?:slate|gray|zinc|neutral|stone|taupe|mauve|mist|olive|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const WHITE_BLACK_UTILITY = new RegExp(`^${COLOR_PREFIX}-(?:white|black)${OPACITY}$`);
const PALETTE_UTILITY = new RegExp(`^${COLOR_PREFIX}-${PALETTE}-(?:50|[1-9]00|950)${OPACITY}$`);
/** A hex color; not an entity (`&#8203;`), an id reference (`url(#id)`) or part of a word. */
const HEX_VALUE = /(?<![&#A-Za-z0-9(])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/;
/**
 * A CSS color function: `rgb()`/`rgba()`/`hsl()`/`hsla()`/`hwb()`/`lab()`/`lch()`/`oklab()`/
 * `oklch()` (Tailwind 4's palette is oklch) and `color(<space> …)`. `color-mix()` is not one (it
 * mixes tokens); raw colors inside it are caught on their own.
 */
const COLOR_FUNCTION =
  /(?<![a-zA-Z-])(?:(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|color\([\s_]*(?:srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65)(?![a-zA-Z0-9-]))/;
/** 0.4 ramp variables: `var(--grey-60)` and the Tailwind 4 shorthand `bg-(--grey-60)`. */
const RAMP_VAR = /(?:var\(|\((?:color:)?)--(?:wave-)?(?:grey|gray|brand)-\d/;
/** Named-color SVG paint (`stroke="white"`, `fill={'black'}`); hex/rgb values are caught by the value scan. */
const SVG_COLOR_ATTR =
  /\b(?:stroke|fill|stopColor|floodColor|lightingColor)=\{?\s*(["'`])(?!(?:none|currentColor|transparent|inherit)\1|url\(|#|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\()[^"'`]+\1(?:\s*\})?/g;
/** A string that is the value of an anchor attribute/property (`href="#cafe"` is not a color). */
const ANCHOR_VALUE = /\b(?:href|xlinkHref)\s*[=:]\s*\{?\s*$/;

/** CSS named colors (`transparent` and `currentColor` are not raw colors). */
const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
/**
 * A stand-alone word of a CSS value: not part of a hyphenated name (`bg-white`, `border-primary`)
 * and not a function name (`tan(…)`, `var(…)`).
 */
const CSS_WORD = /(?<![A-Za-z0-9-])[A-Za-z]+(?![A-Za-z0-9(-])/g;
/** Custom property names (`--wave-red-tint`), `url(…)` and quoted text are not color values. */
const NOT_A_COLOR_VALUE = /--[\w-]+|url\([^)]*\)|'[^']*'|"[^"]*"/g;

/** The CSS named colors used as values in `value` (see {@link CSS_WORD}). */
function namedColorsIn(value: string): string[] {
  const words = value.replace(NOT_A_COLOR_VALUE, ' ').match(CSS_WORD) ?? [];
  return words.filter((w) => NAMED_COLORS.has(w.toLowerCase()));
}

/**
 * The value of an arbitrary color utility or property: `text-[red]`, `bg-[color:white]`,
 * `shadow-[0_0_2px_red]` (any color-utility prefix) and `[color:red]`/`[--x-color:red]`
 * (a color-like arbitrary property).
 */
const ARBITRARY_COLOR_VALUE = new RegExp(`^${COLOR_PREFIX}-\\[(.+)\\]${OPACITY}$`);
const ARBITRARY_COLOR_PROPERTY =
  /^\[(-*[a-z-]*(?:color|background|border|outline|fill|stroke|shadow)[a-z-]*):(.+)\]$/;

/**
 * An object key whose value is a CSS color value (`{ color: 'white' }`,
 * `border: '1px solid red'`, `style={{ background: 'red' }}`).
 */
const STYLE_COLOR_KEY_NAME =
  /^(?:color|background(?:Color|Image)?|border(?:(?:Top|Right|Bottom|Left|Block|Inline)(?:Start|End)?)?(?:Color)?|outline(?:Color)?|(?:box|text)Shadow|fill|stroke|stopColor|floodColor|lightingColor|caretColor|accentColor|textDecoration(?:Color)?|columnRuleColor)$/;
/**
 * A JSX attribute whose value is a color (SVG paint and `color`, which sets `currentColor`), as
 * the text directly before its value. `data-color=`/`aria-*` do not match.
 */
const PAINT_ATTRIBUTE =
  /(?<![\w$.:-])(?:stroke|fill|stopColor|floodColor|lightingColor|color)\s*=\s*$/;
/** How far {@link colorValueTarget} walks back from a literal to find its key or attribute. */
const MAX_VALUE_WALK = 400;

const PHYSICAL_UTILITIES: RegExp[] = [
  /^-?(?:m[lr]|p[lr]|scroll-m[lr]|scroll-p[lr])-(?:\d|px$|auto$|\[|\()/,
  /^-?(?:left|right)-(?:\d|px$|auto$|full$|\[|\()/,
  /^border-[lr](?:$|-)/,
  /^rounded-(?:[lr]|tl|tr|bl|br)(?:$|-)/,
  /^(?:text|float|clear)-(?:left|right)$/,
  /^origin-(?:(?:top|bottom)-)?(?:left|right)$/,
  /^bg-(?:linear|gradient)-to-(?:[lr]|[tb][lr])$/,
];
const TRANSLATE_X = /^-?translate-x-/;
const TRANSLATE_X_ZERO = /^-?translate-x-0$/;

const MARKERS = {
  physical: /wave-allow-physical\b/,
  motion: /wave-allow-motion\b/,
  /** Components: a runtime color value with a reason. */
  color: /wave-allow-color\b/,
  /** Stories: fixture data only. */
  colorFixture: /wave-allow-color:\s*fixture\b/,
};

type MotionKind = 'transition' | 'animate';

/** Scoped to right-to-left with Wave's own direction variant (C-LOGICAL). */
const isDirectional = (t: ClassToken) => t.variants.includes('wave-rtl');
/** Tailwind's `rtl:`/`ltr:` (and `not-rtl:`/`not-ltr:`), which Wave does not use (C-LOGICAL). */
const hasBareDirectionVariant = (t: ClassToken) =>
  t.variants.some((v) => /^(?:not-)?(?:rtl|ltr)$/.test(v));
const isMotionScoped = (t: ClassToken) =>
  t.variants.some((v) => v === 'motion-reduce' || v === 'motion-safe');
/** The motion a utility adds (`transition-none`/`animate-none` add none). */
const motionOf = (u: string): MotionKind | null => {
  if (/^transition(?:$|-)/.test(u)) return u === 'transition-none' ? null : 'transition';
  if (u.startsWith('animate-')) return u === 'animate-none' ? null : 'animate';
  return null;
};
/** The motion a `motion-reduce:` utility reduces. */
const reducedMotionOf = (u: string): MotionKind | null => {
  if (/^(?:transition(?:$|-)|duration-)/.test(u)) return 'transition';
  if (u.startsWith('animate-')) return 'animate';
  return null;
};

/** The marker on the line itself, or on the comment-only line directly above it. */
function hasMarker(lexed: Lexed, line: number, marker: RegExp): boolean {
  if (marker.test(lexed.lines[line - 1] ?? '')) return true;
  const above = lexed.lines[line - 2];
  const aboveCode = (lexed.code[line - 2] ?? '').trim();
  // A JSX comment `{/* … */}` leaves only its braces in the code view.
  const aboveIsComment = above !== undefined && (aboveCode === '' || /^\{\s*\}$/.test(aboveCode));
  return aboveIsComment && marker.test(above);
}

function isAnchorValue(lexed: Lexed, literal: number): boolean {
  const start = lexed.strings[literal].start;
  return ANCHOR_VALUE.test(lexed.src.slice(Math.max(0, start - 40), start));
}

/** Offset of the last non-whitespace character at or before `k` (-1 when there is none). */
function prevNonBlank(text: string, k: number): number {
  let j = k;
  while (j >= 0 && /\s/.test(text[j])) j -= 1;
  return j;
}

/**
 * The object key whose `:` is at `colon` — `{ color: …`, `, 'color': …` — or `null` when that `:`
 * is not an object key's (a ternary `:`, a type annotation `let c: …`, `tone?: …`).
 */
function objectKeyBefore(lexed: Lexed, colon: number): string | null {
  const text = lexed.codeText; // strings kept: a key may be quoted
  let k = prevNonBlank(text, colon - 1);
  let key: string;
  if (text[k] === '"' || text[k] === "'") {
    const open = text.lastIndexOf(text[k], k - 1);
    if (open === -1) return null;
    key = text.slice(open + 1, k);
    k = open - 1;
  } else {
    const end = k + 1;
    while (k >= 0 && /[\w$]/.test(text[k])) k -= 1;
    key = text.slice(k + 1, end);
    if (key === '') return null;
  }
  k = prevNonBlank(text, k);
  return text[k] === '{' || text[k] === ',' ? key : null;
}

/**
 * Whether a JavaScript string literal is a possible result of the expression it sits in: preceded
 * by `:`, `?`, `||`, `??`, `&&`, `(` or `{`, and not followed by a `?` (a condition), a comparison,
 * `&&`, a single `|`/`&` (a union type, bitwise) or a member access/call. So `'white'` is a result
 * in `on ? 'white' : 'none'` and `c ?? 'white'`, but not in `tone === 'white' ? …` or
 * `color: 'red' | 'blue'`.
 */
function isResultOperand(lexed: Lexed, literal: number): boolean {
  const text = lexed.bareText; // strings and comments blank
  const lit = lexed.strings[literal];
  const p = prevNonBlank(text, lit.start - 1);
  const before = p >= 0 ? text[p] : '';
  const operand = before !== '' && ':?{('.includes(before);
  const logical = (before === '|' || before === '&') && text[p - 1] === before; // `||`, `&&`
  if (!operand && !logical) return false;
  const close = lit.spans[lit.spans.length - 1]?.[1] ?? lit.start; // offset of the closing quote
  const after = /^\s*(\S)(\S?)/.exec(text.slice(close + 1, close + 40));
  if (!after) return true;
  const [, a, b] = after;
  if (a === '?') return b === '?'; // `??` keeps the value; a lone `?` makes it a condition
  if (a === '|' || a === '&') return a === '|' && b === '|'; // `||` keeps it; `&&`, `|`, `&` do not
  if ((a === '=' || a === '!') && b === '=') return false; // `==`, `===`, `!=`, `!==`
  return !'<>.[('.includes(a); // a comparison, a member access or a call
}

/**
 * Where a string literal holding a color would paint (C-TOKENS): `'paint'` for a JSX paint
 * attribute ({@link PAINT_ATTRIBUTE}) — its string value `color="white"` or any result of its
 * expression `stroke={on ? 'white' : 'none'}` — and `'style'` for a result of the value
 * expression of a color-like object key ({@link STYLE_COLOR_KEY_NAME}): `{ color: 'white' }`,
 * `{ color: on ? 'white' : 'black' }`, `{ background: bg ?? 'navy' }`. Otherwise `null`.
 *
 * Walks back from the literal over the enclosing expression (bracketed groups skipped, ternary,
 * `||`/`??`/`&&` and comparison operators passed) up to the `{` of a JSX attribute or the `:` of
 * an object key. A call's argument (`fill={shade('white')}`), an array element, an assignment
 * (`const c = 'white'`) or a union type member (`color: 'red' | 'blue'`) is not a painted value.
 */
function colorValueTarget(lexed: Lexed, literal: number): 'paint' | 'style' | null {
  const lit = lexed.strings[literal];
  const text = lexed.bareText;
  if (lit.jsxAttribute) {
    return PAINT_ATTRIBUTE.test(text.slice(Math.max(0, lit.start - 40), lit.start))
      ? 'paint'
      : null;
  }
  if (!isResultOperand(lexed, literal)) return null;
  let depth = 0;
  const stop = Math.max(0, lit.start - MAX_VALUE_WALK);
  for (let k = lit.start - 1; k >= stop; k--) {
    const ch = text[k];
    if (/\s/.test(ch)) continue;
    if (ch === ')' || ch === ']' || ch === '}') {
      depth += 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      if (depth > 0) {
        depth -= 1;
        continue;
      }
      if (ch === '{') {
        const attribute = PAINT_ATTRIBUTE.test(text.slice(Math.max(0, k - 40), k));
        return lexed.jsxContainers.has(k) && attribute ? 'paint' : null;
      }
      if (ch === '[') return null;
      // `(`: a call's argument list ends the value; grouping parentheses are part of it.
      if (/[\w$)\]]/.test(text[prevNonBlank(text, k - 1)] ?? '')) return null;
      continue;
    }
    if (depth > 0) continue;
    if (ch === ',' || ch === ';') return null;
    if (ch === ':') {
      const key = objectKeyBefore(lexed, k);
      if (key !== null) return STYLE_COLOR_KEY_NAME.test(key) ? 'style' : null;
      continue; // a ternary `:`
    }
    if (ch === '=' || ch === '>') {
      let from = k;
      while (from > 0 && /[=!<>]/.test(text[from - 1])) from -= 1;
      const operator = text.slice(from, k + 1);
      // A comparison belongs to a condition of the value; `=` and `=>` end it.
      if (!['==', '===', '!=', '!==', '<=', '>=', '<', '>'].includes(operator)) return null;
      k = from;
      continue;
    }
    if (ch === '|' || ch === '&') {
      if (text[k - 1] !== ch) return null; // a union/intersection type or a bitwise operator
      k -= 1;
      continue;
    }
    // Identifiers, literals, `?`, `!`, `.` and arithmetic are part of the value.
  }
  return null;
}

/** Whether a class utility is an arbitrary color value/property holding a CSS named color. */
function hasNamedColorValue(utility: string): boolean {
  const value =
    ARBITRARY_COLOR_VALUE.exec(utility)?.[1] ?? ARBITRARY_COLOR_PROPERTY.exec(utility)?.[2];
  return value !== undefined && namedColorsIn(value).length > 0;
}

/** Offsets of every JSX `<button` opening tag without a literal `type=` attribute. */
function buttonsWithoutType(lexed: Lexed): number[] {
  const text = lexed.bareText;
  const found: number[] = [];
  const re = /<button(?=[\s/>])/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let depth = 0;
    let attrs = '';
    for (let k = m.index + '<button'.length; k < text.length; k++) {
      const ch = text[k];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) break;
      else if (depth === 0) attrs += ch;
    }
    if (!/(?:^|\s)type\s*=/.test(attrs)) found.push(m.index);
  }
  return found;
}

/**
 * Runs every rule on one source file (returns violations in source order). `jsx`: whether the
 * file may contain JSX (`.tsx`).
 */
function scanSource(source: string, kind: SourceKind, jsx = true): Violation[] {
  const lexed = lex(source, jsx);
  const tokens = classTokens(lexed);
  const violations: Violation[] = [];
  const add = (line: number, column: number, rule: RuleId, text: string) =>
    violations.push({ line, column, rule, text });
  const addToken = (t: ClassToken, rule: RuleId) => add(t.line, t.column, rule, t.raw);
  const colorAllowed = (line: number) =>
    hasMarker(lexed, line, kind === 'story' ? MARKERS.colorFixture : MARKERS.color);
  const physicalAllowed = (line: number) => hasMarker(lexed, line, MARKERS.physical);
  const motionAllowed = (line: number) => hasMarker(lexed, line, MARKERS.motion);

  for (const problem of lexed.problems) {
    const line = lineOf(lexed, problem.offset);
    add(line, problem.offset - lexed.lineStarts[line - 1], 'lexer', problem.message);
  }

  // raw-color: class utilities (never suppressible in components).
  const reportedColorTokens = new Set<ClassToken>();
  for (const t of tokens) {
    const u = t.utility;
    const isClassColor =
      WHITE_BLACK_UTILITY.test(u) ||
      PALETTE_UTILITY.test(u) ||
      (/[[(]/.test(u) &&
        (HEX_VALUE.test(u) || COLOR_FUNCTION.test(u) || RAMP_VAR.test(u) || hasNamedColorValue(u)));
    if (!isClassColor) continue;
    reportedColorTokens.add(t);
    if (kind === 'story' && colorAllowed(t.line)) continue;
    addToken(t, 'raw-color');
  }
  // raw-color: literal SVG paint attributes (`stroke="white"`, `fill={'black'}`).
  const paintAttributeRanges: Array<[start: number, end: number]> = [];
  lexed.code.forEach((lineText, index) => {
    const line = index + 1;
    for (const m of lineText.matchAll(SVG_COLOR_ATTR)) {
      const start = lexed.lineStarts[index] + (m.index ?? 0);
      paintAttributeRanges.push([start, start + m[0].length]);
      if (kind === 'story' && colorAllowed(line)) continue;
      add(line, m.index ?? 0, 'raw-color', m[0]);
    }
  });
  // raw-color: color values in strings (suppressible with the color marker). A named color counts
  // where it paints (see colorValueTarget): a paint attribute's value or a result of its
  // expression, or a result of a color-like key's value expression. Literals the paint-attribute
  // scan above already reported are skipped.
  const colorValues = new Map<number, boolean>();
  const isColorValue = (literal: number) => {
    let known = colorValues.get(literal);
    if (known === undefined) {
      const start = lexed.strings[literal].start;
      const reported = paintAttributeRanges.some(([from, to]) => start >= from && start < to);
      known = !reported && colorValueTarget(lexed, literal) !== null;
      colorValues.set(literal, known);
    }
    return known;
  };
  for (const t of tokens) {
    if (reportedColorTokens.has(t)) continue;
    const hex = HEX_VALUE.test(t.raw) && !isAnchorValue(lexed, t.literal);
    const named = namedColorsIn(t.raw).length > 0 && isColorValue(t.literal);
    const match = hex || named || COLOR_FUNCTION.test(t.raw) || RAMP_VAR.test(t.raw);
    if (!match || colorAllowed(t.line)) continue;
    addToken(t, 'raw-color');
  }

  if (kind === 'story') return dedupe(violations);

  // bare direction variants, physical and translate-x
  const rtlTranslateLines = new Set(
    tokens.filter((t) => isDirectional(t) && TRANSLATE_X.test(t.utility)).map((t) => t.line),
  );
  for (const t of tokens) {
    if (hasBareDirectionVariant(t)) {
      addToken(t, 'direction-variant');
      continue;
    }
    if (isDirectional(t)) continue;
    if (PHYSICAL_UTILITIES.some((re) => re.test(t.utility))) {
      if (!physicalAllowed(t.line)) addToken(t, 'physical');
      continue;
    }
    if (
      TRANSLATE_X.test(t.utility) &&
      !TRANSLATE_X_ZERO.test(t.utility) &&
      !rtlTranslateLines.has(t.line) &&
      !physicalAllowed(t.line)
    ) {
      addToken(t, 'translate-x');
    }
  }

  // focus outline, arbitrary animate, enabled variant
  for (const t of tokens) {
    if (
      t.utility === 'outline-none' &&
      t.variants.some((v) => v === 'focus' || v === 'focus-visible' || v === 'focus-within')
    ) {
      addToken(t, 'focus-outline-none');
    }
    if (t.utility.startsWith('animate-[')) addToken(t, 'arbitrary-animate');
    if (t.variants.some((v) => /(?:^|-)enabled$/.test(v))) addToken(t, 'enabled-variant');
  }

  // motion: a reduction of the same kind in the same string or on the same line
  const reducedLiterals = new Set<string>();
  const reducedLines = new Set<string>();
  for (const t of tokens) {
    const reduced = t.variants.includes('motion-reduce') ? reducedMotionOf(t.utility) : null;
    if (!reduced) continue;
    reducedLiterals.add(`${reduced}|${t.literal}`);
    reducedLines.add(`${reduced}|${t.line}`);
  }
  for (const t of tokens) {
    const motion = motionOf(t.utility);
    if (!motion || isMotionScoped(t)) continue;
    if (
      reducedLiterals.has(`${motion}|${t.literal}`) ||
      reducedLines.has(`${motion}|${t.line}`) ||
      motionAllowed(t.line)
    ) {
      continue;
    }
    addToken(t, 'motion');
  }

  // forwardRef (code only)
  lexed.bare.forEach((lineText, index) => {
    const m = /\bforwardRef\s*[<(]/.exec(lineText);
    if (m) add(index + 1, m.index, 'forward-ref', 'forwardRef(');
  });

  // <button without a literal type=
  for (const offset of buttonsWithoutType(lexed)) {
    const line = lineOf(lexed, offset);
    add(line, offset - lexed.lineStarts[line - 1], 'button-type', '<button');
  }

  return dedupe(violations);
}

function dedupe(violations: Violation[]): Violation[] {
  const seen = new Set<string>();
  return violations
    .filter((v) => {
      const key = `${v.line}|${v.rule}|${v.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule));
}

function report(path: string, violations: Violation[]): string[] {
  return violations.map((v) => `${path}:${v.line} [${v.rule}] ${v.text} — ${HINTS[v.rule]}`);
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const componentSources = import.meta.glob<string>(
  ['../components/**/*.{ts,tsx}', '!**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
);
const storySources = import.meta.glob<string>('../../stories/*.stories.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Glob keys are relative to `src/__tests__/`: `../components/…` and `../../stories/…`. */
const toRepoPath = (key: string) =>
  key.startsWith('../../') ? key.slice('../../'.length) : `src/${key.slice('../'.length)}`;

const componentFiles = Object.entries(componentSources)
  .map(([key, source]) => [toRepoPath(key), source] as const)
  .sort(([a], [b]) => a.localeCompare(b));
const storyFiles = Object.entries(storySources)
  .map(([key, source]) => [toRepoPath(key), source] as const)
  .sort(([a], [b]) => a.localeCompare(b));

// ---------------------------------------------------------------------------
// Rule tests (fixtures are inline, valid TSX; this file itself is not scanned)
// ---------------------------------------------------------------------------

const rules = (source: string, kind: SourceKind = 'component', jsx = true) =>
  scanSource(source, kind, jsx).map((v) => `${v.line}:${v.rule}:${v.text}`);

describe('conventions gate rules', () => {
  it('finds the component and story sources', () => {
    expect(componentFiles.length).toBeGreaterThan(50);
    expect(componentFiles.every(([p]) => /^src\/components\/.+\.tsx?$/.test(p))).toBe(true);
    expect(componentFiles.some(([p]) => p.includes('__tests__'))).toBe(false);
    expect(componentFiles.map(([p]) => p)).toContain('src/components/button/Button.tsx');
    expect(storyFiles.length).toBeGreaterThan(50);
    expect(storyFiles.map(([p]) => p)).toContain('stories/Button.stories.tsx');
  });

  describe('raw-color', () => {
    it('flags arbitrary hex/rgba values, white/black, palette colors and ramp variables', () => {
      const source = [
        `const a = 'hover:bg-[#f5f5f5] text-foreground';`,
        `const b = 'border-[rgba(255,255,255,0.3)] shadow-[0_0_2px_rgba(0,0,0,0.12)]';`,
        `const c = 'text-white bg-black/40 stroke-white border-s-black';`,
        `const d = 'border-l-green-600 bg-yellow-500 divide-gray-200 from-blue-500/50';`,
        `const e = 'bg-[var(--grey-60)]';`,
      ].join('\n');
      expect(rules(source).filter((r) => r.includes('raw-color'))).toEqual([
        '1:raw-color:hover:bg-[#f5f5f5]',
        '2:raw-color:border-[rgba(255,255,255,0.3)]',
        '2:raw-color:shadow-[0_0_2px_rgba(0,0,0,0.12)]',
        '3:raw-color:text-white',
        '3:raw-color:bg-black/40',
        '3:raw-color:stroke-white',
        '3:raw-color:border-s-black',
        '4:raw-color:border-l-green-600',
        '4:raw-color:bg-yellow-500',
        '4:raw-color:divide-gray-200',
        '4:raw-color:from-blue-500/50',
        '5:raw-color:bg-[var(--grey-60)]',
      ]);
    });

    it('flags the Tailwind 4 variable shorthand, variable/arbitrary opacity and hex after `_`', () => {
      const source = [
        `const a = 'bg-(--grey-60) text-(--wave-brand-80) border-(color:--gray-40)';`,
        `const b = 'text-black/(--op) bg-white/[0.3] shadow-[0_0_2px_#000]';`,
        `const ok = 'bg-(--wave-primary) text-foreground/(--op) w-(--sidebar-width)';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:raw-color:bg-(--grey-60)',
        '1:raw-color:text-(--wave-brand-80)',
        '1:raw-color:border-(color:--gray-40)',
        '2:raw-color:text-black/(--op)',
        '2:raw-color:bg-white/[0.3]',
        '2:raw-color:shadow-[0_0_2px_#000]',
      ]);
    });

    it('flags literal SVG paint (attribute strings and JSX expressions) and color values in strings', () => {
      const source = [
        `const a = <path stroke="white" fill="#fff" />;`,
        `const b = <path stroke="currentColor" fill="none" />;`,
        `const style = { boxShadow: '0 0 2px rgba(0,0,0,.1)', color: '#0f6cbd' };`,
        `const c = <path stroke={'white'} fill={"black"} stopColor={\`red\`} />;`,
        `const d = <path stroke={'currentColor'} fill={color} />;`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:raw-color:stroke="white"',
        '1:raw-color:#fff',
        '3:raw-color:rgba(0,0,0,.1)',
        '3:raw-color:#0f6cbd',
        `4:raw-color:stroke={'white'}`,
        '4:raw-color:fill={"black"}',
        '4:raw-color:stopColor={`red`}',
      ]);
    });

    it('allows theme tokens, entities, anchors, id references and comments', () => {
      const source = [
        `const a = 'bg-primary text-primary-foreground bg-backdrop border-stroke whitespace-nowrap';`,
        `const b = 'text-success-tint-foreground bg-presence-busy fill-current';`,
        `const c = <a href="#top">&#8203;</a>;`,
        `const d = <a href="#cafe">Cafe</a>;`,
        `const e = <a href={'#bead'}>Bead</a>;`,
        `const f = { href: '#fade', label: 'Fade' };`,
        `const g = <path fill="url(#abcdef)" />;`,
        `// was hover:bg-[#f5f5f5] text-white`,
        `/* stroke="white" */`,
      ].join('\n');
      expect(rules(source)).toEqual([]);
    });

    it('wave-allow-color allows runtime color values in components, never color classes', () => {
      const source = [
        `const check = luminance > 0.5 ? '#000000' : '#ffffff'; // wave-allow-color: glyph on a user swatch`,
        `const cls = 'bg-[#ffffff]'; // wave-allow-color: nope`,
      ].join('\n');
      expect(rules(source)).toEqual(['2:raw-color:bg-[#ffffff]']);
    });

    it('stories: flags hex fixtures and color classes unless marked `wave-allow-color: fixture`', () => {
      const source = [
        `const swatches = [{ color: '#d13438' }];`,
        `const fixture = [{ color: '#d13438' }]; // wave-allow-color: fixture`,
        `const a = <div className="bg-[#f0f0f0] text-white" />;`,
        `// wave-allow-color: fixture`,
        `const b = <div style={{ border: '1px solid #e0e0e0' }} />;`,
        `const c = <div className="ml-2 transition-colors focus:outline-none" />;`,
        `const other = [{ color: '#107c10' }]; // wave-allow-color: brand swatch`,
        `const bare = [{ color: '#c50f1f' }]; // wave-allow-color`,
        `const tight = [{ color: '#0f6cbd' }]; // wave-allow-color:fixture`,
      ].join('\n');
      expect(rules(source, 'story')).toEqual([
        '1:raw-color:#d13438',
        '3:raw-color:bg-[#f0f0f0]',
        '3:raw-color:text-white',
        '7:raw-color:#107c10',
        '8:raw-color:#c50f1f',
      ]);
    });

    it('flags oklch/oklab/lab/lch/hwb/color() values and named colors in arbitrary values', () => {
      const source = [
        `const a = 'bg-[oklch(0.5_0.2_240)] text-[lab(50%_40_59)] border-[lch(52%_58_33)]';`,
        `const b = 'ring-[oklab(0.5_0.1_0.1)] fill-[hwb(194_0%_0%)] bg-[color(display-p3_1_0_0)]';`,
        `const c = 'text-[red] bg-[color:white] shadow-[0_0_2px_red] hover:border-[Black]/50';`,
        `const d = '[color:red] [--wave-accent-color:navy] bg-[linear-gradient(to_right,gold,transparent)]';`,
        `const e = <path fill="oklch(0.6 0.1 20)" />;`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:raw-color:bg-[oklch(0.5_0.2_240)]',
        '1:raw-color:text-[lab(50%_40_59)]',
        '1:raw-color:border-[lch(52%_58_33)]',
        '2:raw-color:ring-[oklab(0.5_0.1_0.1)]',
        '2:raw-color:fill-[hwb(194_0%_0%)]',
        '2:raw-color:bg-[color(display-p3_1_0_0)]',
        '3:raw-color:text-[red]',
        '3:raw-color:bg-[color:white]',
        '3:raw-color:shadow-[0_0_2px_red]',
        '3:raw-color:hover:border-[Black]/50',
        '4:raw-color:[color:red]',
        '4:raw-color:[--wave-accent-color:navy]',
        '4:raw-color:bg-[linear-gradient(to_right,gold,transparent)]',
        '5:raw-color:oklch(0.6',
      ]);
    });

    it('flags named colors as the value of a color-like object key (style objects)', () => {
      const source = [
        `const a = { color: 'white', padding: 4 };`,
        `const b = { background: 'Red' };`,
        `const c = { border: '1px solid navy', boxShadow: '0 0 0 1px oklch(0.6 0.1 20)' };`,
        `const d = <div style={{ backgroundColor: "tomato" }} />;`,
        `const e = { background: 'linear-gradient(gold, var(--wave-stroke, silver))' };`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:raw-color:white',
        '2:raw-color:Red',
        '3:raw-color:navy',
        '3:raw-color:oklch(0.6',
        '4:raw-color:tomato',
        '5:raw-color:linear-gradient(gold,',
        '5:raw-color:silver))',
      ]);
    });

    it('flags named colors anywhere a paint attribute or color-like key paints them', () => {
      const source = [
        `const a = <path stroke={checked ? 'white' : 'none'} />;`,
        `const s = { color: active ? 'white' : 'black' };`,
        `const b = <svg color="white" />;`,
        `const c = { background: bg ?? 'navy', outlineColor: o || 'red', fill: on && 'gold' };`,
        `const d = <circle fill={on ? (hover ? 'Silver' : 'none') : 'currentColor'} />;`,
        `const e = <svg color={'white'} stopColor={a ? "tan" : b} />;`,
        `const f = <g style={{ stroke: mode === 'dark' ? 'white' : 'black' }} />;`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:raw-color:white',
        '2:raw-color:white',
        '2:raw-color:black',
        '3:raw-color:white',
        '4:raw-color:navy',
        '4:raw-color:red',
        '4:raw-color:gold',
        '5:raw-color:Silver',
        '6:raw-color:white',
        '6:raw-color:tan',
        '7:raw-color:white',
        '7:raw-color:black',
      ]);
    });

    it('a named color that does not paint is allowed (comparands, arguments, other attributes)', () => {
      const source = [
        `const a = <path fill={variant === 'red' ? 'currentColor' : 'none'} />;`,
        `const b = <path stroke={shade('white')} fill={['black'][0]} />;`,
        `const c = <Badge color={on ? 'brand' : 'danger'} data-color="red" aria-label="white" />;`,
        `const d = <p title={on ? 'red' : 'blue'}>{on ? 'red' : 'blue'}</p>;`,
        `const e = { color: tone !== 'white' && tone };`,
        `const f = { label: on ? 'white' : 'black', tone: 'red' };`,
        `const g = <span className={on ? 'text-foreground' : 'text-muted-foreground'} />;`,
        `type T = { color: 'white' | 'black' } | { stroke?: 'red' };`,
        `const h = (on: boolean) => (on ? 'white' : 'black');`,
        `const i = { color: pick(on ? 'white' : 'black') };`,
      ].join('\n');
      expect(rules(source)).toEqual([]);
    });

    it('wave-allow-color allows a painted runtime color in components', () => {
      const source = [
        `// wave-allow-color: check glyph on a user swatch`,
        `const a = <path stroke={light ? 'black' : 'white'} />;`,
        `const b = <path stroke={light ? 'black' : 'white'} />;`,
      ].join('\n');
      expect(rules(source)).toEqual(['3:raw-color:black', '3:raw-color:white']);
    });

    it('allows color-mix of tokens, named words that are not color values, and unions', () => {
      const source = [
        `const a = 'bg-[color-mix(in_oklch,var(--wave-primary),transparent_50%)]';`,
        `const b = 'text-[length:var(--wave-red-size)] [mask-image:linear-gradient(black,transparent)]';`,
        `const c = 'bg-[url(/img/red.png)] grid-cols-[auto_1fr]';`,
        `const map = { border: 'border-primary', color: 'brand', outline: 'bg-transparent' };`,
        `type P = { color: 'red' | 'blue'; tone?: 'white' };`,
        `const opts = [{ value: 'red', label: 'Red' }];`,
        `const e = { color: 'currentColor', background: 'transparent', fill: 'none' };`,
        `const f = <Option value="red">Red</Option>;`,
        `const g = { label: 'Select color(s)', hint: 'Pick a color (red or blue)' };`,
      ].join('\n');
      expect(rules(source)).toEqual([]);
    });

    it('stories: named-color fixtures are allowed with `wave-allow-color: fixture`', () => {
      const source = [
        `const a = <div style={{ background: 'red' }} />;`,
        `const b = <div style={{ background: 'red' }} />; // wave-allow-color: fixture`,
        `const c = <div className="bg-[oklch(0.7_0.1_20)]" />; // wave-allow-color: fixture`,
      ].join('\n');
      expect(rules(source, 'story')).toEqual(['1:raw-color:red']);
    });
  });

  describe('physical', () => {
    it('flags physical margin/padding/inset/border/radius/text/float/origin/gradient/scroll utilities', () => {
      const physical = [
        'ml-2',
        '-mr-1',
        'pl-3',
        'pr-[10px]',
        'left-0',
        'right-1/2',
        '-left-px',
        'border-l',
        'border-r-2',
        'border-l-primary',
        'rounded-l',
        'rounded-r-md',
        'rounded-tl-lg',
        'text-left',
        'float-right',
        'origin-left',
        'origin-top-right',
        'bg-linear-to-r',
        'scroll-ml-2',
        'scroll-pr-4',
        'hover:ml-2',
        '!pl-2',
        'pr-2!',
      ];
      expect(rules(`const c = '${physical.join(' ')}';`)).toEqual(
        physical.map((cls) => `1:physical:${cls}`),
      );
    });

    it('allows logical, symmetric and direction-scoped utilities and non-class strings', () => {
      const source = [
        `const a = 'ms-2 me-2 ps-3 pe-3 start-0 end-0 border-s border-e rounded-s rounded-e';`,
        `const b = 'text-start float-start origin-center rounded-lg inset-x-0 px-2 mx-auto space-x-2 border-x';`,
        `const c = 'wave-rtl:ml-2 wave-rtl:-scale-x-100';`,
        `const placement = side === 'left' ? 'left-start' : 'right-end';`,
      ].join('\n');
      expect(rules(source)).toEqual([]);
    });

    it("flags Tailwind's bare rtl: and ltr: variants, whatever the utility (C-LOGICAL)", () => {
      const source = [
        `const a = 'rtl:ml-2 ltr:left-0 ltr:rounded-l';`,
        `const b = 'rtl:ms-2 rtl:-scale-x-100 hover:rtl:pe-2 rtl:hover:rotate-180';`,
        `const c = 'not-rtl:ms-2 not-ltr:me-2 wave-rtl:ms-2 wave-rtl:hover:pe-2';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:direction-variant:rtl:ml-2',
        '1:direction-variant:ltr:left-0',
        '1:direction-variant:ltr:rounded-l',
        '2:direction-variant:rtl:ms-2',
        '2:direction-variant:rtl:-scale-x-100',
        '2:direction-variant:hover:rtl:pe-2',
        '2:direction-variant:rtl:hover:rotate-180',
        '3:direction-variant:not-rtl:ms-2',
        '3:direction-variant:not-ltr:me-2',
      ]);
    });

    it('allows physical utilities scoped with the wave-rtl: variant (C-LOGICAL)', () => {
      const source = [
        `const a = 'wave-rtl:ml-2 wave-rtl:rounded-l hover:wave-rtl:pr-2';`,
        `const b = 'wave-rtl:bg-[position:left_8px_center] wave-rtl:left-0';`,
        `const c = 'not-wave-rtl:ml-2';`,
      ].join('\n');
      expect(rules(source)).toEqual(['3:physical:not-wave-rtl:ml-2']);
    });

    it('wave-allow-physical on the line or the comment line above allows it', () => {
      const source = [
        `const a = <span className="absolute left-1/2" />; // wave-allow-physical: centring`,
        `// wave-allow-physical: centring`,
        `const c = 'right-0';`,
        `const d = 'left-0';`,
      ].join('\n');
      expect(rules(source)).toEqual(['4:physical:left-0']);
    });

    it('a JSX comment line directly above counts as a comment-only line', () => {
      const source = [
        `const a = (`,
        `  <div>`,
        `    {/* wave-allow-physical: centring */}`,
        `    <span className="absolute left-1/2" />`,
        `    <span className="absolute right-0" />`,
        `  </div>`,
        `);`,
      ].join('\n');
      expect(rules(source)).toEqual(['5:physical:right-0']);
    });
  });

  describe('translate-x', () => {
    it('requires a wave-rtl: counterpart on the same line; a bare rtl:/ltr: one is an error (C-LOGICAL)', () => {
      const source = [
        `const a = 'translate-x-4';`,
        `const b = 'data-[state=checked]:translate-x-5';`,
        `const c = 'translate-x-4 rtl:-translate-x-4';`,
        `cn(checked && 'translate-x-5', checked && 'rtl:-translate-x-5');`,
        `const e = 'translate-x-0 ltr:translate-x-4';`,
        `const f = '-translate-x-1/2'; // wave-allow-physical: centring`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:translate-x:translate-x-4',
        '2:translate-x:data-[state=checked]:translate-x-5',
        '3:translate-x:translate-x-4',
        '3:direction-variant:rtl:-translate-x-4',
        '4:translate-x:translate-x-5',
        '4:direction-variant:rtl:-translate-x-5',
        '5:direction-variant:ltr:translate-x-4',
      ]);
    });

    it('accepts a wave-rtl: counterpart (C-LOGICAL)', () => {
      const source = [
        `const a = 'translate-x-4 wave-rtl:-translate-x-4';`,
        `cn(checked && 'translate-x-[22px]', checked && 'wave-rtl:-translate-x-[22px]');`,
        `const b = 'data-[state=checked]:translate-x-5 data-[state=checked]:wave-rtl:-translate-x-5';`,
        `const c = 'translate-x-4 wave-rtl:scale-x-100';`,
        `const d = 'translate-x-4 not-wave-rtl:-translate-x-4';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '4:translate-x:translate-x-4',
        '5:translate-x:translate-x-4',
        '5:translate-x:not-wave-rtl:-translate-x-4',
      ]);
    });
  });

  describe('focus, animation, forwardRef and enabled:', () => {
    it('flags focus:outline-none but not outline-hidden', () => {
      const source = `const c = 'focus:outline-none focus-visible:outline-none focus:outline-hidden outline-none';`;
      expect(rules(source)).toEqual([
        '1:focus-outline-none:focus:outline-none',
        '1:focus-outline-none:focus-visible:outline-none',
      ]);
    });

    it('flags arbitrary animate-[…]', () => {
      const source = `const c = 'animate-[wave-spin_0.8s_linear_infinite] motion-reduce:animate-none';`;
      expect(rules(source)).toEqual([
        '1:arbitrary-animate:animate-[wave-spin_0.8s_linear_infinite]',
      ]);
    });

    it('flags forwardRef calls in code only', () => {
      const source = [
        `export const A = React.forwardRef<HTMLDivElement, Props>((props, ref) => null);`,
        `export const B = forwardRef(Inner);`,
        `// forwardRef( is gone`,
        `const s = 'forwardRef(';`,
        `const t = <p>Migrated from forwardRef(…) to ref-as-prop</p>;`,
        `const u = /forwardRef\\(/;`,
      ].join('\n');
      expect(rules(source)).toEqual(['1:forward-ref:forwardRef(', '2:forward-ref:forwardRef(']);
    });

    it('flags any enabled: variant', () => {
      const source = [
        `const a = 'enabled:hover:bg-subtle-hover peer-enabled:text-foreground';`,
        `const b = 'not-disabled:not-aria-disabled:hover:bg-subtle-hover';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:enabled-variant:enabled:hover:bg-subtle-hover',
        '1:enabled-variant:peer-enabled:text-foreground',
      ]);
    });
  });

  describe('button-type', () => {
    it('flags JSX <button> opening tags without a literal type=', () => {
      const source = [
        `const a = <button onClick={toggle}>Go</button>;`,
        `const b = (`,
        `  <button`,
        `    type="button"`,
        `    {...rest}`,
        `  >`,
        `    <button`,
        `      {...rest}`,
        `      onClick={() => (a > b ? x() : y())}`,
        `    >`,
        `      <button type={Component === 'button' ? 'button' : undefined} />`,
        `      <button {...{ type: 'button' }} />`,
        `      <ButtonGroup><Button /></ButtonGroup>`,
        `    </button>`,
        `  </button>`,
        `);`,
        `/** Renders a <button> element. */`,
        `const html = '<button>';`,
        `const t: React.ComponentProps<'button'> = {};`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:button-type:<button',
        '7:button-type:<button',
        '12:button-type:<button',
      ]);
    });
  });

  describe('motion', () => {
    it('requires a motion-reduce: class in the same string or on the same line', () => {
      const source = [
        `const a = 'inline-flex transition-colors';`,
        `const b = 'transition-colors motion-reduce:transition-none';`,
        `const c = 'transition-colors'; // wave-allow-motion: color only`,
        `const d = 'transition-none animate-none motion-safe:animate-spin';`,
        'cn(`transition-transform ${open ? "rotate-180" : ""} motion-reduce:transition-none`);',
        `cn('transition-transform', 'motion-reduce:transition-none');`,
        `cn(`,
        `  'transition-transform duration-200',`,
        `  'motion-reduce:transition-none',`,
        `);`,
        `const e = 'animate-wave-spin motion-reduce:animate-wave-spin-slow';`,
        `el.addEventListener('transitionend', done);`,
        `const f = 'animate-wave-pulse';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:motion:transition-colors',
        '8:motion:transition-transform',
        '13:motion:animate-wave-pulse',
      ]);
    });

    it('requires the reduction to match the kind of motion', () => {
      const source = [
        `cn('transition-colors', open && 'motion-reduce:animate-none');`,
        `const a = 'animate-wave-spin motion-reduce:transition-none';`,
        `const b = 'transition-transform motion-reduce:duration-0';`,
        `const c = 'transition-all animate-wave-pulse motion-reduce:transition-none';`,
        `const d = 'transition-all animate-wave-pulse motion-reduce:transition-none motion-reduce:animate-none';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:motion:transition-colors',
        '2:motion:animate-wave-spin',
        '4:motion:animate-wave-pulse',
      ]);
    });
  });

  describe('lexer', () => {
    it('keeps strings with // and treats apostrophes in JSX text as text', () => {
      const source = [
        `const url = 'https://example.com'; const c = 'ml-2';`,
        `const p = <p>Don't worry</p>;`,
        `const d = 'mr-2';`,
        `/* multi-line`,
        `   comment 'ml-2' */ const e = 'pl-2';`,
      ].join('\n');
      expect(rules(source)).toEqual(['1:physical:ml-2', '3:physical:mr-2', '5:physical:pl-2']);
    });

    it('an apostrophe in JSX text does not hide the rest of its line', () => {
      const source = [
        `const a = <p>It's here <button onClick={x}>Go</button></p>;`,
        `const b = <p>"Quoted" and it's <span className="ml-2">fine</span> // not a comment</p>;`,
      ].join('\n');
      expect(rules(source)).toEqual(['1:button-type:<button', '2:physical:ml-2']);
    });

    it('recognises regex literals, so a backtick or quote in a regex opens nothing', () => {
      const source = [
        'const re = /`/;',
        `const a = 'ml-2';`,
        `const q = /'/.test(s); const b = 'bg-[#fff]';`,
        `const parts = trimmed.split(/\\s+/); const hex = /^#[0-9a-f]{3}$/i.test(v);`,
        `if (x) return /["']/g; const c = 'pr-2';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '2:physical:ml-2',
        '3:raw-color:bg-[#fff]',
        '5:physical:pr-2',
      ]);
    });

    it('treats `/` after a value as division', () => {
      const source = [
        `const half = width / 2; const c = 'ml-2';`,
        `const r = (a + b) / c / d; const e = 'mr-2';`,
        `const s = items[0] / 2; const f = 'pl-2';`,
      ].join('\n');
      expect(rules(source)).toEqual(['1:physical:ml-2', '2:physical:mr-2', '3:physical:pl-2']);
    });

    it('lexes nested JSX, containers, templates and generics', () => {
      const source = [
        'const a = (',
        '  <div className={cn(`ml-2 ${x ? "mr-2" : ""}`)} icon={<Icon className="pl-2" />}>',
        `    It's {count > 1 ? <b className="pr-2">many</b> : 'one'} // text`,
        '    <>',
        `      <Foo.Bar data-x={a < b} />`,
        '    </>',
        '  </div>',
        ');',
        `const id = <T,>(value: T) => value; const g = 'left-0';`,
        `const ref = useRef<HTMLDivElement>(null); const h = 'right-0';`,
        `const n = 1 << 2 < 3 ? 'text-left' : '';`,
        `const s = <Select<string> className="ps-2" value={v}>It's</Select>; const t = 'mr-2';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '2:physical:ml-2',
        '2:physical:mr-2',
        '2:physical:pl-2',
        '3:physical:pr-2',
        '9:physical:left-0',
        '10:physical:right-0',
        '11:physical:text-left',
        '12:physical:mr-2',
      ]);
    });

    it('never reads `<` as JSX in .ts files', () => {
      const source = `const f = <T>(v: T) => v; const c = 'ml-2';`;
      expect(rules(source, 'component', false)).toEqual(['1:physical:ml-2']);
    });

    it('reads generic function types in .tsx as types, not JSX', () => {
      const source = [
        `type Fn = <T>(x: T) => T; const a = 'ml-2';`,
        `interface P { renderItem: <Item>(item: Item, index: number) => React.ReactNode; }`,
        `function f(cb: <Value>(v: Value, s: 'a)b') => void) { return 'mr-2'; }`,
        `type Ctor = new <T>(x: T) => Box<T>; const b = 'pl-2';`,
        `const doc = <code>(value) => void</code>; const c = 'pr-2';`,
        `const id = <T,>(v: T) => v; const d = 'left-0';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:physical:ml-2',
        '3:physical:mr-2',
        '4:physical:pl-2',
        '5:physical:pr-2',
        '6:physical:left-0',
      ]);
    });

    it('reports type-position generics it cannot tell from JSX (write them as `<T,>`)', () => {
      expect(rules(`const call: { <T>(x: T): T } = f;\nconst c = 'ml-2';`)).toEqual([
        '1:lexer:unclosed JSX element',
      ]);
      expect(rules(`const call: { <T,>(x: T): T } = f;\nconst c = 'ml-2';`)).toEqual([
        '2:physical:ml-2',
      ]);
    });

    it('reads a keyword after `.` as a property name, so a following `/` divides', () => {
      const source = [
        `const v = obj.default / 2; const q = "a/b"; const c = 'ml-2';`,
        `const w = a.in / b.of / c?.delete / d.new / e.return; const e = 'mr-2';`,
        `const x = obj.`,
        `  typeof / 2; const f = 'pl-2';`,
        `const all = [...await /'/.exec(s)]; const g = 'pr-2';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        '1:physical:ml-2',
        '2:physical:mr-2',
        '4:physical:pl-2',
        '5:physical:pr-2',
      ]);
    });

    it('reports where it loses track instead of silently skipping the rest of the file', () => {
      expect(rules('const a = `ml-2\nconst b = 1;')).toEqual([
        '1:lexer:unterminated template literal',
      ]);
      expect(rules(`const a = 'ml-2\nconst b = 1;`)).toEqual([
        '1:lexer:unterminated string literal',
        '1:physical:ml-2',
      ]);
      expect(rules(`const a = <div className="ml-2">;\nconst b = 'mr-2';`)).toEqual([
        '1:lexer:unclosed JSX element',
        '1:physical:ml-2',
      ]);
      const runaway = ['const a = `', ...Array.from({ length: 45 }, () => '  flex'), '`;'];
      expect(rules(runaway.join('\n'))).toEqual(['1:lexer:template literal spans 47 lines']);
      expect(rules(`function f() {\n  return 1;\n`)).toEqual(['3:lexer:unbalanced braces']);
    });

    it('reports lexer problems in stories too', () => {
      expect(rules('const a = `bg-[#fff]', 'story')).toEqual([
        '1:lexer:unterminated template literal',
      ]);
    });

    it('reports correct lines for multi-line template literals', () => {
      const source = ['const c = `', '  flex', '  ml-2', '`;'].join('\n');
      expect(rules(source)).toEqual(['3:physical:ml-2']);
    });

    it('handles CRLF sources', () => {
      expect(rules(`const a = 'x';\r\nconst c = 'ml-2';\r\n`)).toEqual(['2:physical:ml-2']);
    });
  });
});

// ---------------------------------------------------------------------------
// The gate: one test per file
// ---------------------------------------------------------------------------

describe('conventions gate: src/components', () => {
  for (const [path, source] of componentFiles) {
    it(path, () => {
      const lines = report(path, scanSource(source, 'component', path.endsWith('.tsx')));
      expect(lines.length, `\n${lines.join('\n')}\n`).toBe(0);
    });
  }
});

describe('conventions gate: stories (raw colors)', () => {
  for (const [path, source] of storyFiles) {
    it(path, () => {
      const lines = report(path, scanSource(source, 'story'));
      expect(lines.length, `\n${lines.join('\n')}\n`).toBe(0);
    });
  }
});
