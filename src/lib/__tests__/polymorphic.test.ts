/**
 * Type-level contract of the polymorphic helpers (button-provider#8), checked by
 * `tsc -p tsconfig.dev.json`. Calling a component's call signature is exactly how TypeScript
 * checks JSX for a generic function component, so `Button({ as: 'a', href })` below is the same
 * check as `<Button as="a" href="…" />` in a .tsx file.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import * as React from 'react';
import type { PolymorphicComponent, PolymorphicProps } from '../polymorphic';
import type * as Types from '../types';
import type * as Wave from '../../index';

/** The XOwnProps rule: ONLY component-specific props, no HTML-attribute inheritance. */
interface ButtonOwnProps {
  appearance?: 'primary' | 'outline' | 'subtle' | 'transparent';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  disabled?: boolean;
}

type ButtonProps<C extends React.ElementType = 'button'> = PolymorphicProps<C, ButtonOwnProps>;

/** A stand-in built the way components implement it (see the JSDoc of PolymorphicComponent). */
const Button: PolymorphicComponent<'button', ButtonOwnProps> = ({
  as,
  appearance,
  size,
  icon,
  disabled,
  ...rest
}) => {
  const Component: React.ElementType = as ?? 'button';
  return React.createElement(
    Component,
    { 'data-appearance': appearance, 'data-size': size, disabled, ...rest },
    icon,
  );
};
Button.displayName = 'Button';

interface RouterLinkProps {
  to: string;
  replace?: boolean;
  children?: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLAnchorElement>;
}
const RouterLink = (props: RouterLinkProps) =>
  React.createElement('a', { href: props.to }, props.children);

describe('PolymorphicProps / PolymorphicComponent', () => {
  it('as="a" accepts anchor attributes', () => {
    expect(Button({ as: 'a', href: '/docs', target: '_blank', rel: 'noreferrer' })).toBeTruthy();
    expect(Button({ as: 'a', href: '/file.pdf', download: 'file.pdf' })).toBeTruthy();
  });

  it('as="a" types handlers and attributes for the anchor', () => {
    const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault();
    expect(Button({ as: 'a', href: '/', onClick })).toBeTruthy();
    // `type` on an anchor is a MIME type string.
    expect(Button({ as: 'a', href: '/feed', type: 'text/html' })).toBeTruthy();
    const ref = React.createRef<HTMLAnchorElement>();
    expect(Button({ as: 'a', href: '/', ref })).toBeTruthy();
  });

  it('as="a" rejects button-only attributes', () => {
    // @ts-expect-error — formAction is a <button> attribute, not an <a> attribute
    expect(Button({ as: 'a', href: '/', formAction: '/submit' })).toBeTruthy();
    const buttonHandler = (event: React.MouseEvent<HTMLButtonElement>) => event.currentTarget.form;
    // @ts-expect-error — a <button> handler does not fit an anchor
    expect(Button({ as: 'a', href: '/', onClick: buttonHandler })).toBeTruthy();
  });

  it('the default tag keeps button typing and rejects anchor attributes', () => {
    expect(Button({ type: 'submit', formAction: '/submit', children: 'Save' })).toBeTruthy();
    const ref = React.createRef<HTMLButtonElement>();
    expect(Button({ ref, onClick: (e: React.MouseEvent<HTMLButtonElement>) => e })).toBeTruthy();
    // @ts-expect-error — href does not exist on <button>
    expect(Button({ href: '/nope' })).toBeTruthy();
    // @ts-expect-error — `type` on a button is 'submit' | 'reset' | 'button'
    expect(Button({ type: 'text/html' })).toBeTruthy();
  });

  it('works with custom components (router links)', () => {
    expect(Button({ as: RouterLink, to: '/home', replace: true })).toBeTruthy();
    // @ts-expect-error — `to` is required by RouterLink
    expect(Button({ as: RouterLink })).toBeTruthy();
  });

  it('own props win over the element props of the same name', () => {
    // <input size> is a number; Button's own `size` is the size scale.
    expect(Button({ as: 'input', size: 'small' })).toBeTruthy();
    // @ts-expect-error — the element's numeric `size` is replaced by the own prop
    expect(Button({ as: 'input', size: 3 })).toBeTruthy();
    expectTypeOf<ButtonProps<'input'>['size']>().toEqualTypeOf<
      'small' | 'medium' | 'large' | undefined
    >();
  });

  it('the default-tag props type stays extendable by interfaces (0.4 `ButtonProps` name)', () => {
    interface MyButtonProps extends ButtonProps {
      tracking?: string;
    }
    const props: MyButtonProps = { appearance: 'primary', type: 'button', tracking: 'cta' };
    expect(props.tracking).toBe('cta');
    expectTypeOf<ButtonProps>().toEqualTypeOf<ButtonProps<'button'>>();
    expectTypeOf<ButtonProps>().toHaveProperty('formAction');
    expectTypeOf<ButtonProps<'a'>>().toHaveProperty('href');
  });

  it('documents why OwnProps must not inherit HTML attributes', () => {
    // Anti-pattern: OwnProps that extend the default tag's attributes keep button typing under as="a".
    interface LeakyOwnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
      appearance?: 'primary';
    }
    expectTypeOf<PolymorphicProps<'a', LeakyOwnProps>>().toHaveProperty('formAction');
    expectTypeOf<PolymorphicProps<'a', LeakyOwnProps>['onClick']>().toEqualTypeOf<
      React.MouseEventHandler<HTMLButtonElement> | undefined
    >();
    // The rule: component-specific OwnProps only.
    expectTypeOf<PolymorphicProps<'a', ButtonOwnProps>['onClick']>().toEqualTypeOf<
      React.MouseEventHandler<HTMLAnchorElement> | undefined
    >();
  });

  it('carries displayName and renders', () => {
    expect(Button.displayName).toBe('Button');
    const element = Button({ as: 'a', href: '/x', children: 'Go' }) as React.ReactElement<{
      href: string;
    }>;
    expect(element.type).toBe('a');
    expect(element.props.href).toBe('/x');
  });

  it('React.ComponentProps<typeof X> is the checked default-tag props type', () => {
    // Conditional-type inference (`ComponentProps`, `Parameters`, `memo`, Storybook `Meta<typeof X>`)
    // reads the last call signature; a generic one would be read with C = React.ElementType, whose
    // props collapse to a string index signature that accepts any key.
    expectTypeOf<React.ComponentProps<typeof Button>>().toEqualTypeOf<ButtonProps>();
    expectTypeOf<Parameters<typeof Button>[0]>().toEqualTypeOf<ButtonProps>();
    expectTypeOf<React.ComponentPropsWithoutRef<typeof Button>>().not.toHaveProperty('apperance');
    expectTypeOf<React.ComponentPropsWithoutRef<typeof Button>>().toHaveProperty('formAction');
  });

  it('a wrapper typed with React.ComponentProps<typeof X> rejects typos and mistyped handlers', () => {
    const Save = (props: React.ComponentProps<typeof Button>) =>
      Button({ appearance: 'primary', ...props });
    expect(Save({ children: 'Save', type: 'submit' })).toBeTruthy();
    // @ts-expect-error — misspelled prop
    expect(Save({ apperance: 'subtle' })).toBeTruthy();
    // @ts-expect-error — the handler does not take a mouse event
    expect(Save({ onClick: (id: string) => id.length })).toBeTruthy();
    const Memo = React.memo(Button);
    expect(Memo.type).toBe(Button);
    // @ts-expect-error — memo(X) keeps the checked props
    const bad: React.ComponentProps<typeof Memo> = { apperance: 'subtle' };
    expect(bad).toEqual({ apperance: 'subtle' });
  });

  it('JSX still picks the generic signature first (as="a" is inferred)', () => {
    expect(Button({ as: 'a', href: '/docs' })).toBeTruthy();
    expect(Button({ as: RouterLink, to: '/home' })).toBeTruthy();
    // @ts-expect-error — neither signature accepts an anchor attribute on the default tag
    expect(Button({ href: '/nope' })).toBeTruthy();
  });

  it('holds for every polymorphic component of the library', () => {
    expectTypeOf<React.ComponentProps<typeof Wave.Button>>().toEqualTypeOf<Wave.ButtonProps>();
    expectTypeOf<
      React.ComponentProps<typeof Wave.CompoundButton>
    >().toEqualTypeOf<Wave.CompoundButtonProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Link>>().toEqualTypeOf<Wave.LinkProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Toolbar>>().toEqualTypeOf<Wave.ToolbarProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Divider>>().toEqualTypeOf<Wave.DividerProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Tag>>().toEqualTypeOf<Wave.TagProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Text>>().toEqualTypeOf<Wave.TextProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Stack>>().toEqualTypeOf<Wave.StackProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Flex>>().toEqualTypeOf<Wave.FlexProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Grid>>().toEqualTypeOf<Wave.GridProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.Card>>().toEqualTypeOf<Wave.CardProps>();
    expectTypeOf<
      React.ComponentProps<typeof Wave.Card.Header>
    >().toEqualTypeOf<Wave.CardHeaderProps>();
    expectTypeOf<React.ComponentProps<typeof Wave.CardBody>>().toEqualTypeOf<Wave.CardBodyProps>();
    expectTypeOf<
      React.ComponentProps<typeof Wave.CardFooter>
    >().toEqualTypeOf<Wave.CardFooterProps>();
  });

  it('is re-exported from types.ts', () => {
    expectTypeOf<Types.PolymorphicProps<'a', ButtonOwnProps>>().toEqualTypeOf<
      PolymorphicProps<'a', ButtonOwnProps>
    >();
    expectTypeOf<Types.PolymorphicComponent<'div', ButtonOwnProps>>().toEqualTypeOf<
      PolymorphicComponent<'div', ButtonOwnProps>
    >();
  });
});
