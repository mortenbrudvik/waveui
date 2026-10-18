/**
 * The pure rules of TagPicker's free tagging (`allowCreate`) and of its exact-match ranking:
 * which typed text offers a create option, and which option a typed text makes active.
 * Module-only (never exported from a barrel); it imports no component.
 */

/** What the create option is checked against (case folding as the default filter's). */
export interface CreateOptionKnown {
  /** The labels of every known option: listed, filtered out or selected alike. */
  labels: Iterable<string>;
  /** The values of every known option, compared exactly. */
  values: Iterable<string>;
  /** The selected values (a created tag has no option), compared ignoring case. */
  selected: Iterable<string>;
}

function foldedIncludes(texts: Iterable<string>, folded: string): boolean {
  for (const text of texts) if (text.toLowerCase() === folded) return true;
  return false;
}

/**
 * The text a create option would add for the typed `query`, or `null` when none is offered: the
 * trimmed text, unless it is empty, equals a known option label or a selected value ignoring case
 * (`toLowerCase()`, the default filter's folding), or equals a known option value exactly
 * (creating must not select another option by its value).
 *
 * @param query The typed text.
 * @param known The labels, values and selected values to check against.
 */
export function createOptionText(query: string, known: CreateOptionKnown): string | null {
  const text = query.trim();
  if (text === '') return null;
  const folded = text.toLowerCase();
  if (foldedIncludes(known.labels, folded)) return null;
  if (foldedIncludes(known.selected, folded)) return null;
  for (const value of known.values) if (value === text) return null;
  return text;
}

/** An option the exact match may pick: its value and its label. */
export interface ExactMatchCandidate {
  value: string;
  label: string;
}

/**
 * The value of the first option in list order whose label equals the trimmed `text` ignoring case
 * and that is not selected, or `null` (no text, or no such option).
 *
 * @param text       The typed text.
 * @param candidates The known options, in list order.
 * @param selected   The selected values (skipped).
 */
export function findExactMatch(
  text: string,
  candidates: Iterable<ExactMatchCandidate>,
  selected: ReadonlySet<string>,
): string | null {
  const folded = text.trim().toLowerCase();
  if (folded === '') return null;
  for (const { value, label } of candidates) {
    if (!selected.has(value) && label.toLowerCase() === folded) return value;
  }
  return null;
}
