import * as React from 'react';
import type { Slot } from '../../lib/types';

/**
 * Internal helpers of the button family: the one rule for what a button's label and `icon` slot
 * render. Not exported from the package barrels.
 *
 * `Button` and `MenuButton` both import these helpers, so the family shares one rule;
 * `__tests__/Button.utils.test.tsx` pins it against rendered `Button` output.
 */

/**
 * Whether React renders anything for `node`: `null`, `undefined`, booleans and `''` render
 * nothing, and a Fragment or array counts only through its own children (`<></>` is empty).
 * Used for button labels (`children`). It reads arrays and Fragments only; pass an `icon` slot to
 * {@link buttonIconRenders} instead, which never iterates a Set or generator.
 */
export function rendersContent(node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) => {
    if (child === '') return false;
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return rendersContent((child.props as { children?: React.ReactNode }).children);
    }
    return true;
  });
}

/**
 * Whether a button renders an icon element for its `icon` slot. `null`, `undefined`, booleans,
 * `''`, an empty array and an empty Fragment (at any depth) render no icon: no empty
 * `aria-hidden` span, no gap and no icon-only sizing. A slot object and any other iterable (Set,
 * generator) always render the icon wrapper and are **never iterated here**, so a one-shot
 * generator is left intact for `renderSlot` to materialise (C-SLOTS).
 */
export function buttonIconRenders(icon: Slot<'span'> | undefined): boolean {
  if (icon === null || icon === undefined || typeof icon === 'boolean' || icon === '') return false;
  if (Array.isArray(icon)) return rendersContent(icon as React.ReactNode);
  if (React.isValidElement(icon) && icon.type === React.Fragment) return rendersContent(icon);
  return true;
}
