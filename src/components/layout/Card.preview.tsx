import * as React from 'react';
import { cardPreviewClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Slot } from '../../lib/types';
import { CardOrientationContext } from './Card.context';

/** The Card.Preview's own props (component-specific props only). */
export interface CardPreviewOwnProps {
  /**
   * A logo placed over the bottom start corner of the preview: a string, an element or an object
   * of `<span>` attributes. A value that renders nothing renders no element.
   */
  logo?: Slot<'span'>;
}

/** Props of {@link CardPreview} rendered as `C` (default `'div'`), including `ref`. */
export type CardPreviewProps<C extends React.ElementType = 'div'> = PolymorphicProps<
  C,
  CardPreviewOwnProps
>;

type CardPreviewImplProps = CardPreviewOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * Edge-to-edge media of a {@link Card} (an image, a video, a map), with an optional `logo` over its
 * bottom start corner. It has no padding: in a vertical card it fills the width, in a horizontal
 * one it is the full-height block at the start. Flat export for React Server Components
 * (`Card.Preview` in client files).
 *
 * @example
 * <Card>
 *   <Card.Preview logo={<img alt="Contoso" src="/logo.svg" />}><img alt="" src="/cover.jpg" /></Card.Preview>
 *   <Card.Header title="Contoso" />
 * </Card>
 */
export const CardPreview: PolymorphicComponent<'div', CardPreviewOwnProps> = (props) => {
  const { as, logo, className, children, ref, ...rest } = props as CardPreviewImplProps;
  const Component: React.ElementType = as ?? 'div';
  const orientation = React.useContext(CardOrientationContext);
  const hasLogo = logo !== undefined && slotRendersContent(logo);
  return (
    <Component
      ref={ref}
      className={cn(
        cardPreviewClassNames.root,
        'relative block overflow-hidden',
        orientation === 'horizontal' ? 'shrink-0 self-stretch' : 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
      {hasLogo &&
        renderSlot(
          logo,
          'span',
          cn(
            cardPreviewClassNames.logo,
            'absolute start-3 bottom-3 inline-flex rounded-md bg-background p-1 shadow-4',
          ),
        )}
    </Component>
  );
};
CardPreview.displayName = 'CardPreview';
