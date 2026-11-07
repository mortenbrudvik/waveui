import * as React from 'react';

/**
 * Renders `rendered`, the element made from what `unwrapFragment` (`lib/renderTrigger`) found in `original`,
 * inside the Fragments of `original` that carry a `ref`, so a consumer's `<Fragment ref={ref}>`
 * around a trigger, a tooltip target or an `asChild` item still receives its `FragmentInstance`
 * (React 19.3). It walks the Fragments as `unwrapFragment` does: a Fragment around one element
 * that has no `ref` is dropped as before, and `rendered` is returned as it is when `original` is
 * not one (or holds no single element: `unwrapFragment` then kept the Fragment, and `rendered`
 * already holds it). Internal.
 */
export function withFragmentRefs(
  original: React.ReactNode,
  rendered: React.ReactNode,
): React.ReactNode {
  if (!React.isValidElement(original) || original.type !== React.Fragment) return rendered;
  const { children, ref } = original.props as {
    children?: React.ReactNode;
    ref?: unknown;
  };
  if (!React.isValidElement(children)) return rendered;
  const inner = withFragmentRefs(children, rendered);
  return ref === undefined || ref === null ? inner : React.cloneElement(original, undefined, inner);
}
