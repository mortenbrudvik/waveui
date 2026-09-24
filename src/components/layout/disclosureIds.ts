/*
 * Internal id helpers shared by Accordion and TabList (P09, C-IDS). Not exported from the package.
 */

/**
 * Encodes a value for use inside a DOM id without collisions: every character outside
 * `[A-Za-z0-9-]` (including `_`) becomes `_<hex code>_`, so `'a b'`, `'a.b'` and `'a_b'` stay
 * distinct.
 */
export function encodeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16)}_`);
}

/**
 * The one id helper (C-IDS): `${baseId}-${part}-${encoded value}`. `baseId` comes from `useId`
 * (one per Accordion or TabList), `part` names the element (`'trigger'`, `'panel'`, `'tab'`) and
 * `value` is the item or tab value.
 */
export function getPartId(baseId: string, part: string, value: string): string {
  return `${baseId}-${part}-${encodeIdPart(value)}`;
}
