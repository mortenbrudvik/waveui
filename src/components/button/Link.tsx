import * as React from 'react';
import { cn } from '../../lib/cn';
import { resolveDeprecatedProp } from '../../lib/dev';
import { focusRing } from '../../lib/styles';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';

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
   * context menu or drag), keeps `role="link"`, and gets `aria-disabled="true"` and
   * `tabIndex={-1}` (neither can be overridden); a custom `as` (router link) gets the same ARIA
   * and tab index and its click is prevented. `as="button"` uses the native `disabled` attribute.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Props of {@link Link} rendered as `C` (default `'a'`). `LinkProps` without a type argument is
 * the 0.4 name: the props of a Link rendered as an `<a>`, including `ref`.
 */
export type LinkProps<C extends React.ElementType = 'a'> = PolymorphicProps<C, LinkOwnProps>;

/** The props the implementation reads, for any `as`. */
type LinkImplProps = LinkOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
    onClick?: React.MouseEventHandler<HTMLElement>;
  };

/** Intrinsic elements whose native `disabled` attribute makes them unavailable. */
const NATIVE_DISABLED_ELEMENTS: ReadonlySet<string> = new Set([
  'button',
  'input',
  'select',
  'textarea',
]);

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
 * @example
 * <p>Read the <Link href="/docs">documentation</Link> first.</p>
 * <Link appearance="standalone" href="/pricing">See pricing</Link>
 */
export const Link: PolymorphicComponent<'a', LinkOwnProps> = (props) => {
  const {
    as,
    appearance: appearanceProp,
    variant,
    disabled = false,
    className,
    onClick,
    ref,
    ...rest
  } = props as LinkImplProps;

  const appearance =
    resolveDeprecatedProp('Link', appearanceProp, variant, 'variant', 'appearance') ?? 'inline';

  const Component: React.ElementType = as ?? 'a';
  const tag = typeof Component === 'string' ? Component : null;

  /** Defaults the consumer may override (C-COMPOSE: before the rest props). */
  const defaults: Record<string, unknown> = {};
  /** Attributes the consumer must not override (C-COMPOSE: after the rest props). */
  const enforced: Record<string, unknown> = {};
  let handleClick: React.MouseEventHandler<HTMLElement> | undefined = onClick;

  if (tag === 'button') defaults.type = 'button';

  if (tag !== null && NATIVE_DISABLED_ELEMENTS.has(tag)) {
    enforced.disabled = disabled || undefined;
  } else if (disabled) {
    if (tag === 'a') {
      // No destination at all, but still announced as a (disabled) link.
      defaults.role = 'link';
      enforced.href = undefined;
    }
    enforced['aria-disabled'] = true;
    enforced.tabIndex = -1;
    handleClick = (event) => {
      event.preventDefault();
    };
  }

  const elementProps: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(defaults)) elementProps[key] ??= value;

  return (
    <Component
      {...elementProps}
      onClick={handleClick}
      ref={ref}
      className={cn(
        'cursor-pointer transition-colors motion-reduce:transition-none',
        focusRing,
        appearanceClasses[appearance],
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...enforced}
    />
  );
};

Link.displayName = 'Link';
