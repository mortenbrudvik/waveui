import * as React from 'react';

/**
 * The utilities that mirror an element in a right-to-left layout: the flip is Wave's `wave-rtl:`
 * variant, which follows the element's own direction. Module-only (the icons and the helper below
 * share it); an app uses `flipIconInRtl` or the `flipInRtl` prop of the built-in icons.
 */
export const FLIP_IN_RTL_CLASS = 'wave:wave-rtl:-scale-x-100';

/** Joins the flip class to a consumer's class names, once. */
export function withFlipClass(className: string | undefined): string {
  if (!className) return FLIP_IN_RTL_CLASS;
  return className.split(/\s+/).includes(FLIP_IN_RTL_CLASS)
    ? className
    : `${className} ${FLIP_IN_RTL_CLASS}`;
}

/**
 * Makes an icon of your own follow the layout direction: the element is cloned with Wave's
 * right-to-left mirroring (`wave:wave-rtl:-scale-x-100`, the flip the built-in directional glyphs
 * use) added to its `className`, so an arrow, a chevron or any other glyph that points along the
 * reading direction faces the other way when its own direction is `rtl`, and is unchanged in
 * `ltr`. Works for any element that takes `className` (an icon of another library, an `<svg>`, an
 * `<img>`); a node that is not an element (text, `null`, a Fragment) is returned as it is, and
 * so is an element that already carries the class.
 *
 * This is the counterpart of Fluent's `flipInRtl` icon option, which Fluent applies when the icon
 * is created: WaveUI cannot know that an icon from another library is directional, so the app
 * says it. Pass the result where an icon is taken (`<Button icon={flipIconInRtl(<ArrowRight />)}>`,
 * `Breadcrumb` `divider`, `Pagination`'s glyph slots). The class is part of the library's
 * stylesheets (`./styles`, `./tailwind`); with the `./utilities` sheet alone, mirror with your own
 * rule instead. Server-safe.
 *
 * @example
 * <Button icon={flipIconInRtl(<ArrowRightIcon />)}>Next</Button>
 *
 * @param icon The icon element.
 * @returns The element with the mirroring class added, or `icon` unchanged.
 */
export function flipIconInRtl<T extends React.ReactNode>(icon: T): T {
  if (!React.isValidElement<{ className?: unknown }>(icon) || icon.type === React.Fragment) {
    return icon;
  }
  const { className } = icon.props;
  if (className !== undefined && typeof className !== 'string') return icon;
  const flipped = withFlipClass(className);
  return flipped === className ? icon : (React.cloneElement(icon, { className: flipped }) as T);
}
