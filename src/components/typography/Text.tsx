import * as React from 'react';
import { wcn } from '../../lib/cn';
import { textClassNames } from '../../lib/classNames';
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
   * Font weight: `'regular'`, `'medium'`, `'semibold'` or `'bold'`. Unset, the variant's own
   * weight applies: semibold for `'subtitle-2'` and every larger variant (`'subtitle-1'`, the
   * titles, `'large-title'`, `'display'`), inherited for the caption and body variants. Pass
   * `'regular'` for a title at regular weight.
   */
  weight?: TextWeight;
  /**
   * Font family: `'base'` keeps the inherited family (the Wave sans-serif), `'monospace'` sets the
   * Wave monospace stack for code and identifiers, `'numeric'` the stack for figures that should
   * align in columns. Fluent's `font` prop. A `className` that sets a font family replaces it.
   * @default 'base'
   */
  font?: 'base' | 'monospace' | 'numeric';
  /**
   * Whether the text wraps. `false` keeps it on one line (`white-space: nowrap`), and a line
   * longer than its box then overflows it; add `truncate` to cut it with an ellipsis. Fluent's
   * `wrap`.
   * @default true
   */
  wrap?: boolean;
  /**
   * Cuts a line that does not fit its box with an ellipsis. It keeps the text on one line (as
   * `wrap={false}` does) and clips the overflow, so the element needs a width to cut at: it is
   * drawn as an inline block unless `block` is set, because a plain inline box never clips.
   * Fluent's `truncate`.
   */
  truncate?: boolean;
  /** Draws the text in italics. Fluent's `italic`. */
  italic?: boolean;
  /** Draws a line under the text. With `strikethrough` both lines show. Fluent's `underline`. */
  underline?: boolean;
  /** Draws a line through the text. With `underline` both lines show. Fluent's `strikethrough`. */
  strikethrough?: boolean;
  /**
   * Aligns the text inside its box: `'start'` and `'end'` follow the writing direction, `'center'`
   * and `'justify'` do not. It has an effect on a block box, so pair it with `block` for a span.
   * Fluent's `align`.
   */
  align?: 'start' | 'center' | 'end' | 'justify';
  /**
   * Draws the element as a block box that takes the full width, instead of the inline box of a
   * `<span>`. Fluent's `block`.
   * @default false
   */
  block?: boolean;
}

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
  'caption-2': 'wave:text-caption-2',
  'caption-1': 'wave:text-caption-1',
  'body-1': 'wave:text-body-1',
  'body-2': 'wave:text-body-2',
  'subtitle-2': 'wave:text-subtitle-2',
  'subtitle-1': 'wave:text-subtitle-1',
  'title-3': 'wave:text-title-3',
  'title-2': 'wave:text-title-2',
  'title-1': 'wave:text-title-1',
  'large-title': 'wave:text-large-title',
  display: 'wave:text-display',
};

const weightClasses: Record<TextWeight, string> = {
  regular: 'wave:font-normal',
  medium: 'wave:font-medium',
  semibold: 'wave:font-semibold',
  bold: 'wave:font-bold',
};

const alignClasses: Record<NonNullable<TextOwnProps['align']>, string> = {
  start: 'wave:text-start',
  center: 'wave:text-center',
  end: 'wave:text-end',
  justify: 'wave:text-justify',
};

const fontClasses: Record<Exclude<NonNullable<TextOwnProps['font']>, 'base'>, string> = {
  monospace: 'wave:font-wave-mono',
  numeric: 'wave:font-wave-numeric',
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
  const {
    as,
    variant = 'body-1',
    weight,
    font,
    wrap,
    truncate,
    italic,
    underline,
    strikethrough,
    align,
    block,
    className,
    ...rest
  } = props as TextImplProps;

  const Component: React.ElementType = as ?? 'span';
  return (
    <Component
      {...rest}
      className={wcn(
        textClassNames.root,
        variantClasses[variant],
        weight !== undefined && Object.hasOwn(weightClasses, weight) && weightClasses[weight],
        font && font !== 'base' && Object.hasOwn(fontClasses, font) && fontClasses[font],
        block && 'wave:block',
        wrap === false && 'wave:whitespace-nowrap',
        // The ellipsis needs a box that clips: an inline box never does, so it is an inline block.
        truncate && 'wave:max-w-full wave:truncate',
        truncate && !block && 'wave:inline-block wave:align-bottom',
        italic && 'wave:italic',
        // Both decoration lines in one declaration: the two utilities set one property.
        underline && strikethrough && 'wave:[text-decoration-line:underline_line-through]',
        underline && !strikethrough && 'wave:underline',
        strikethrough && !underline && 'wave:line-through',
        align !== undefined && Object.hasOwn(alignClasses, align) && alignClasses[align],
        className,
      )}
    />
  );
};

Text.displayName = 'Text';
