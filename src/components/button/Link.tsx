import * as React from 'react';
import { cn } from '../../lib/cn';
import { resolveDeprecatedProp } from '../../lib/dev';
import { focusRing } from '../../lib/styles';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import { useButtonSemantics } from './Button.semantics';

/**
 * Color treatment of a {@link Link}.
 *
 * - `inline` (default): for links in running text. Always underlined (the underline thickens on
 *   hover and focus), because the link color alone does not stand out enough from body text.
 * - `standalone`: semibold, underlined on hover/focus only. Use it only where the position or
 *   container already marks the text as a link (a list of links, a card footer, navigation).
 * - `subtle`: foreground color, underlined on hover/focus only. It cannot be told apart from body
 *   text, so never use it inside a paragraph; only where the context makes the link obvious.
 */
export type LinkAppearance = 'inline' | 'standalone' | 'subtle';

/** @deprecated Use {@link LinkAppearance}. */
export type LinkVariant = LinkAppearance;

/**
 * The Link's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`, default `'a'`).
 */
export interface LinkOwnProps {
  /** Color treatment (see {@link LinkAppearance} for where each one may be used).
   * @default 'inline'
   */
  appearance?: LinkAppearance;
  /** @deprecated Use `appearance` (same values). */
  variant?: LinkVariant;
  /**
   * Makes the link unavailable. An `<a>` drops its `href` (no navigation by middle-click, the
   * context menu or drag), keeps `role="link"` (`role="button"` when it had no `href`), and gets
   * `aria-disabled="true"`, `data-disabled` and `tabIndex={-1}` (none can be overridden); a custom
   * `as` (router link) gets the same attributes. Clicks, Enter and Space are prevented: your
   * `onClick` is not called and the click does not reach ancestor click handlers. `as="button"`
   * uses the native `disabled` attribute.
   * @default false
   */
  disabled?: boolean;
  /**
   * Marks the link unavailable but keeps it focusable and in the tab order: for a toolbar item or
   * a disabled link that needs a Tooltip. Renders `aria-disabled="true"`, `data-disabled` and
   * `data-disabled-focusable`; an `<a>` drops its `href` (it keeps `role="link"` and gets
   * `tabIndex={0}`), and `as="button"` gets these attributes instead of the native `disabled`.
   * Clicks, Enter and Space are prevented; your `onClick` is not called and the click does not
   * reach ancestor click handlers. Wins over `disabled` when both are set. In a `Toolbar` it stays
   * in the arrow-key order.
   * @default false
   */
  disabledFocusable?: boolean;
}

/**
 * Props of {@link Link} rendered as `C` (default `'a'`). `LinkProps` without a type argument is
 * the 0.4 name: the props of a Link rendered as an `<a>`, including `ref`.
 */
export type LinkProps<C extends React.ElementType = 'a'> = PolymorphicProps<C, LinkOwnProps>;

/** The props the implementation reads, for any `as`. */
type LinkImplProps = LinkOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'onKeyDown' | 'onKeyUp'> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
    /** The destination: without one, the anchor gets button semantics. */
    href?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
  };

const appearanceClasses: Record<LinkAppearance, string> = {
  inline:
    'text-primary underline not-disabled:not-aria-disabled:hover:decoration-2 focus-visible:decoration-2',
  standalone:
    'font-semibold text-primary no-underline not-disabled:not-aria-disabled:hover:underline focus-visible:underline',
  subtle:
    'text-foreground no-underline not-disabled:not-aria-disabled:hover:underline focus-visible:underline',
};

/**
 * A hyperlink with Fluent link styling. Renders an `<a>` by default; `as` renders a router link
 * (`<Link as={RouterLink} to="/">`) or a `<button>` styled as a link (`type="button"` by default).
 *
 * - Without `href`, the `<a>` runs an action instead of navigating ("Show more"): it keeps its
 *   element and gets `role="button"`, a tab stop and Enter/Space activation (the consumer's
 *   `role` and `tabIndex` win). A non-interactive `as` (`span`, `div`) is treated the same way;
 *   any `href` string, `''` included, keeps the link semantics.
 *
 * @example
 * <p>Read the <Link href="/docs">documentation</Link> first.</p>
 * <Link appearance="standalone" href="/pricing">See pricing</Link>
 * <Link onClick={showMore}>Show more</Link>
 */
export const Link: PolymorphicComponent<'a', LinkOwnProps> = (props) => {
  const {
    as,
    appearance: appearanceProp,
    variant,
    disabled = false,
    disabledFocusable = false,
    className,
    onClick,
    onKeyDown,
    onKeyUp,
    onBlur,
    ref,
    ...rest
  } = props as LinkImplProps;

  const appearance =
    resolveDeprecatedProp('Link', appearanceProp, variant, 'variant', 'appearance') ?? 'inline';

  const Component: React.ElementType = as ?? 'a';
  const tag = typeof Component === 'string' ? Component : null;
  // The activation semantics of Button: an `<a>` without `href` or a `span` is a button, and a
  // disabled link blocks its click (ancestors included), Enter and Space.
  const { defaults, enforced, handlers } = useButtonSemantics({
    tag,
    href: rest.href,
    disabled,
    disabledFocusable,
    onClick,
    onKeyDown,
    onKeyUp,
    onBlur,
  });

  // Defaults apply wherever the consumer's value is `undefined` or `null` (C-COMPOSE).
  const elementProps: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(defaults)) elementProps[key] ??= value;

  return (
    <Component
      {...elementProps}
      {...handlers}
      ref={ref}
      className={cn(
        'cursor-pointer transition-colors motion-reduce:transition-none',
        focusRing,
        appearanceClasses[appearance],
        (disabled || disabledFocusable) && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...enforced}
    />
  );
};

Link.displayName = 'Link';
