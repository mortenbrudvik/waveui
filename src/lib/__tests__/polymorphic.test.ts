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

  it('is re-exported from types.ts', () => {
    expectTypeOf<Types.PolymorphicProps<'a', ButtonOwnProps>>().toEqualTypeOf<
      PolymorphicProps<'a', ButtonOwnProps>
    >();
    expectTypeOf<Types.PolymorphicComponent<'div', ButtonOwnProps>>().toEqualTypeOf<
      PolymorphicComponent<'div', ButtonOwnProps>
    >();
  });
});
