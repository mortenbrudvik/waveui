import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnDeprecated } from '../../lib/dev';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { TextWeight, TypographyVariant } from '../../lib/types';

/**
 * The Text's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`, default `'span'`).
 */
export interface TextOwnProps {
  /** Typography variant controlling font size and line height (the Wave type ramp).
   * @default 'body-1'
   */
  variant?: TypographyVariant;
  /**
   * Font weight: `'regular'`, `'semibold'` or `'bold'`. Unset, the variant's own weight applies:
   * semibold for `'subtitle-2'` and every larger variant (`'subtitle-1'`, the titles,
   * `'large-title'`, `'display'`), inherited for the caption and body variants. Pass `'regular'`
   * for a title at regular weight. The numeric 0.4 values `400`, `600` and `700` still work but
   * are deprecated.
   */
  weight?: TextWeight | 400 | 600 | 700;
}

/**
 * The 0.4 numeric weights, kept as deprecated aliases of {@link TextWeight} (written out in
 * {@link TextOwnProps}, not a public name).
 */
type DeprecatedNumericWeight = Exclude<NonNullable<TextOwnProps['weight']>, TextWeight>;

/**
 * Props of {@link Text} rendered as `C` (default `'span'`). `TextProps` without a type argument
 * is the 0.4 name: the props of a Text rendered as a `<span>`, including `ref`.
 */
export type TextProps<C extends React.ElementType = 'span'> = PolymorphicProps<C, TextOwnProps>;

/** The props the implementation reads, for any `as`. */
type TextImplProps = TextOwnProps & {
  as?: React.ElementType;
  className?: string;
};

const variantClasses: Record<TypographyVariant, string> = {
  'caption-2': 'text-caption-2',
  'caption-1': 'text-caption-1',
  'body-1': 'text-body-1',
  'body-2': 'text-body-2',
  'subtitle-2': 'text-subtitle-2',
  'subtitle-1': 'text-subtitle-1',
  'title-3': 'text-title-3',
  'title-2': 'text-title-2',
  'title-1': 'text-title-1',
  'large-title': 'text-large-title',
  display: 'text-display',
};

const weightClasses: Record<TextWeight, string> = {
  regular: 'font-normal',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const numericWeights: Record<DeprecatedNumericWeight, TextWeight> = {
  400: 'regular',
  600: 'semibold',
  700: 'bold',
};

/**
 * Text in the Wave type ramp. Renders a `<span>` by default; `as` renders any element with
 * correctly typed props (`<Text as="h1" variant="title-1">`, `<Text as="label" htmlFor="…">`).
 *
 * Text sets no color: it inherits the surrounding color (the provider's foreground by default),
 * so it follows the theme. Add a color with `className` (`text-muted-foreground`); the variant
 * stays applied.
 *
 * @example
 * <Text as="h2" variant="title-2">Settings</Text>
 * <Text variant="body-1" weight="semibold">Unsaved changes</Text>
 * <Text variant="caption-1" className="text-muted-foreground">Last saved 2 minutes ago</Text>
 */
export const Text: PolymorphicComponent<'span', TextOwnProps> = (props) => {
  const { as, variant = 'body-1', weight, className, ...rest } = props as TextImplProps;

  let resolvedWeight: TextWeight | undefined;
  if (typeof weight === 'number') {
    resolvedWeight = Object.hasOwn(numericWeights, weight) ? numericWeights[weight] : undefined;
    // Warn-once during render is the sanctioned alias pattern (C-DEV).
    if (resolvedWeight) warnDeprecated('Text', `weight={${weight}}`, `weight="${resolvedWeight}"`);
  } else if (weight !== undefined && Object.hasOwn(weightClasses, weight)) {
    resolvedWeight = weight;
  }

  const Component: React.ElementType = as ?? 'span';
  return (
    <Component
      {...rest}
      className={cn(
        variantClasses[variant],
        resolvedWeight && weightClasses[resolvedWeight],
        className,
      )}
    />
  );
};

Text.displayName = 'Text';
