import * as React from 'react';
import { cn } from './cn';

/**
 * Slot definition — accepts either a ReactNode shorthand or an object with
 * `as`, `children`, `className`, `style`, and arbitrary HTML attributes.
 *
 * Backward compatible: plain ReactNode is treated as the slot's children.
 *
 * @typeParam T - The default element type for the slot.
 */
export type Slot<T extends React.ElementType = 'span'> =
  | Exclude<React.ReactNode, object>
  | React.ReactElement
  | SlotObject<T>;

/**
 * Object form of a Slot, allowing full control over the rendered element.
 *
 * @typeParam T - The default element type for the slot.
 */
export interface SlotObject<T extends React.ElementType = 'span'> {
  /** Override the rendered element type for this slot. */
  as?: T;
  /** Content to render inside the slot element. */
  children?: React.ReactNode;
  /** CSS class name(s) to apply to the slot element. */
  className?: string;
  /** Inline styles to apply to the slot element. */
  style?: React.CSSProperties;
  /** Additional HTML attributes forwarded to the slot element. */
  [key: string]: unknown;
}

function isSlotObject(value: unknown): value is SlotObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !React.isValidElement(value) &&
    !Array.isArray(value)
  );
}

/** The normalized output of {@link resolveSlot}, ready for rendering. */
export interface ResolvedSlot {
  /** The element type to render (e.g., 'span', 'div', or a component). */
  Component: React.ElementType;
  /** Merged props including className and any extra HTML attributes. */
  props: Record<string, unknown>;
  /** The content to render inside the element. */
  children: React.ReactNode;
}

/**
 * Resolves a Slot value into a Component + props + children tuple.
 *
 * - If the slot is `null`, `undefined`, or `false`, returns `null`.
 * - If the slot is a ReactNode (element, string, number), wraps it in `defaultAs`.
 * - If the slot is an object, extracts `as`, `children`, `className`, and rest props.
 *
 * @param slot       The slot value from component props.
 * @param defaultAs  The default element type (e.g., 'span', 'div'). Defaults to 'span'.
 * @param baseClassName  Optional base class to merge with the slot's className.
 */
export function resolveSlot<T extends React.ElementType = 'span'>(
  slot: Slot<T> | undefined | null,
  defaultAs?: T,
  baseClassName?: string,
): ResolvedSlot | null {
  if (slot === null || slot === undefined || slot === false) {
    return null;
  }

  const tag = (defaultAs ?? 'span') as React.ElementType;

  // Slot object: { as, children, className, style, ...rest }
  if (isSlotObject(slot)) {
    const obj = slot as Record<string, unknown>;
    const { as: slotAs, children, className, ...rest } = obj;
    return {
      Component: (slotAs as React.ElementType) ?? tag,
      props: {
        ...rest,
        className: cn(baseClassName, className as string | undefined),
      },
      children: children as React.ReactNode,
    };
  }

  // ReactNode shorthand: wrap in the default element
  return {
    Component: tag,
    props: {
      className: baseClassName,
    },
    children: slot as React.ReactNode,
  };
}

/**
 * Renders a resolved slot as a React element. Returns `null` if the slot is not defined.
 *
 * @param slot           The slot value from component props.
 * @param defaultAs      The default element type (e.g., 'span', 'div').
 * @param baseClassName  Optional base class to merge with the slot's className.
 * @returns A React element, or `null` if the slot is empty.
 */
export function renderSlot<T extends React.ElementType = 'span'>(
  slot: Slot<T> | undefined | null,
  defaultAs?: React.ElementType,
  baseClassName?: string,
): React.ReactElement | null {
  const resolved = resolveSlot(slot, defaultAs, baseClassName);
  if (!resolved) return null;

  const { Component, props, children } = resolved;
  return React.createElement(Component, props, children);
}
