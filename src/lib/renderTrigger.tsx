import * as React from 'react';
import { mergeProps } from './mergeProps';
import { warnOnce } from './dev';

/** A trigger's child: a single element (props are merged onto it) or a render function. */
export type TriggerChildren<P> = React.ReactElement | ((props: P) => React.ReactNode);

/** Trigger state attributes that always win over a cloned child's own values. */
export const STATE_ARIA = ['aria-expanded', 'aria-controls', 'aria-haspopup'] as const;

/** Options of {@link renderTrigger}. */
export interface RenderTriggerOptions {
  /** Public name used in development warnings, e.g. `'Popover.Trigger'`. */
  componentName: string;
  /** Wrapper element for `asChild={false}` and for children that cannot be cloned. @default 'span' */
  fallback?: 'span' | 'button';
  /** `false` renders the wrapper element (the 0.4 behaviour) instead of cloning the child. @default true */
  asChild?: boolean;
}

type UnknownProps = Record<string, unknown>;

function isCloneableElement(node: unknown): node is React.ReactElement<UnknownProps> {
  return React.isValidElement(node) && node.type !== React.Fragment;
}

/**
 * Pure core of every trigger (`Dialog.Trigger`, `Popover.Trigger`, `Menu.Trigger`, `.Close`,
 * Tooltip). `useTriggerElement` builds on it and adds the memoised ref and the automatic
 * wrapper fallback.
 *
 * - Function child → `children(triggerProps)`.
 * - `asChild !== false` and a single valid non-Fragment element → the element cloned with
 *   `mergeProps(triggerProps, child.props, { oursWin: STATE_ARIA })`: handlers composed (the
 *   child's run first), classes/styles merged, refs merged (React 19 keeps `ref` in props), the
 *   child's own `id` wins, and live `aria-expanded`/`aria-controls`/`aria-haspopup` always win.
 * - `asChild === false`, or any other child shape (text, Fragment, several elements) → the children
 *   rendered inside `fallback` (default `<span>`) carrying the trigger props. The non-element case
 *   warns once in development; it never returns `null` and never clones a Fragment.
 *
 * @param children      The trigger's children.
 * @param triggerProps  Props the trigger puts on its element (ids, state ARIA, handlers, ref).
 * @param options       See {@link RenderTriggerOptions}.
 */
export function renderTrigger<P>(
  children: TriggerChildren<P> | React.ReactNode,
  triggerProps: P,
  options: RenderTriggerOptions,
): React.ReactNode {
  if (typeof children === 'function') {
    return (children as (props: P) => React.ReactNode)(triggerProps);
  }

  const asChild = options.asChild !== false;
  if (asChild && isCloneableElement(children)) {
    return React.cloneElement(
      children,
      mergeProps(triggerProps, children.props, { oursWin: STATE_ARIA }) as UnknownProps,
    );
  }

  const isEmpty = children === null || children === undefined || typeof children === 'boolean';
  if (asChild && !isEmpty) {
    warnOnce(
      `trigger-children:${options.componentName}`,
      `${options.componentName}: expected a single React element child (not text, a Fragment or several elements); the children are rendered inside a <${options.fallback ?? 'span'}> wrapper instead.`,
    );
  }

  const fallback = options.fallback ?? 'span';
  const wrapperProps: UnknownProps = { ...(triggerProps as UnknownProps) };
  if (fallback === 'button' && wrapperProps.type === undefined) {
    wrapperProps.type = 'button';
  }
  return React.createElement(fallback, wrapperProps, children as React.ReactNode);
}
