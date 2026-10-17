// The text comparisons of the multi-select Combobox input (D11 rule 2): which part of a new value
// an edit of the selected labels inserted. Internal: imported by `Combobox.tsx` and its tests only.

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * The text an edit inserted into `before`, given the new value `after`: `after` without the part
 * it shares with `before` at its start and at its end. The shared parts end and begin between
 * characters, never inside a surrogate pair (a character outside the BMP, such as an emoji).
 */
export function insertedText(before: string, after: string): string {
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before[start] === after[start]) start += 1;
  if (start > 0 && isHighSurrogate(after.charCodeAt(start - 1))) start -= 1;
  let end = 0;
  while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) {
    end += 1;
  }
  if (end > 0 && isLowSurrogate(after.charCodeAt(after.length - end))) end -= 1;
  return after.slice(start, after.length - end);
}

/**
 * The text an edit put in place of the range `start`–`end` of `before` (the selection when the
 * edit began), given the new value `after`; `undefined` when `after` does not keep the text around
 * that range, so the edit replaced something else (a character erased next to a collapsed caret).
 */
export function replacedText(
  before: string,
  after: string,
  start: number,
  end: number,
): string | undefined {
  const kept = before.length - end;
  if (
    start > end ||
    end > before.length ||
    after.length < start + kept ||
    !after.startsWith(before.slice(0, start)) ||
    !after.endsWith(before.slice(end))
  ) {
    return undefined;
  }
  return after.slice(start, after.length - kept);
}
