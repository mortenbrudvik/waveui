import type * as React from 'react';

/**
 * Props of a polymorphic component rendered as `C`: the component's own props, `as`, and every
 * prop of `C` (including `ref`) that the own props do not redefine.
 *
 * **The XOwnProps rule.** `OwnProps` must contain **only component-specific props** (appearance,
 * size, icon, disabled, …) — never `extends React.ButtonHTMLAttributes<…>` or any other element's
 * attributes. Element attributes come from `C` alone; if `OwnProps` inherited the default tag's
 * attributes, `as="a"` would keep button typing (`formAction` accepted, an anchor `onClick`
 * rejected).
 *
 * @typeParam C        The rendered element type (`'button'`, `'a'`, a router `Link`, …).
 * @typeParam OwnProps The component-specific props.
 *
 * @example
 * export interface ButtonOwnProps { appearance?: Appearance; size?: Size; icon?: Slot; disabled?: boolean }
 * export type ButtonProps<C extends React.ElementType = 'button'> = PolymorphicProps<C, ButtonOwnProps>;
 * // `ButtonProps` (default tag) stays valid, including `interface MyProps extends ButtonProps {}`.
 */
export type PolymorphicProps<C extends React.ElementType, OwnProps> = OwnProps & {
  /** Render as a different element or component (its props are type-checked). */
  as?: C;
} & Omit<React.ComponentPropsWithRef<C>, keyof OwnProps | 'as'>;

/**
 * Type of a polymorphic component whose default element is `DefaultC`. Calling it (or rendering it
 * in JSX) infers `C` from the `as` prop and checks the remaining props against `C`.
 *
 * Implement it with an arrow function typed by this interface; widen the element to
 * `React.ElementType` inside so JSX accepts the generic props:
 *
 * @example
 * export const Button: PolymorphicComponent<'button', ButtonOwnProps> = ({ as, appearance, ...rest }) => {
 *   const Component: React.ElementType = as ?? 'button';
 *   return <Component className={…} {...rest} />;
 * };
 * Button.displayName = 'Button';
 */
export interface PolymorphicComponent<DefaultC extends React.ElementType, OwnProps> {
  <C extends React.ElementType = DefaultC>(props: PolymorphicProps<C, OwnProps>): React.ReactNode;
  displayName?: string;
}
