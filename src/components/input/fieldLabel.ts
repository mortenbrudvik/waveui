import * as React from 'react';
import { getElementType } from '../../lib/children';
import type { CoreSize, TextWeight } from '../../lib/types';

/**
 * Marks the components whose element Field renders as its label instead of wrapping it in its own
 * `<label>` (Label, InfoLabel). A marker, not an import, so that Field never pulls InfoLabel's
 * overlay code into a bundle. Internal.
 */
export const FIELD_LABEL: symbol = Symbol.for('wave.fieldLabel');

/** The props Field gives a label element (each only when the element does not set it). */
export interface FieldLabelElementProps {
  id?: string;
  htmlFor?: string;
  required?: boolean | React.ReactNode;
  size?: CoreSize;
  weight?: TextWeight;
  className?: string;
}

/** Marks `component` as a Field label element; call it next to `displayName`. */
export function markFieldLabel<T extends object>(component: T): T {
  (component as Record<symbol, unknown>)[FIELD_LABEL] = true;
  return component;
}

/** Whether `node` is an element of a marked component (lazy client references resolved). */
export function isFieldLabelElement(
  node: React.ReactNode,
): node is React.ReactElement<FieldLabelElementProps> {
  if (!React.isValidElement(node)) return false;
  const type = getElementType(node);
  return (
    (typeof type === 'function' || (typeof type === 'object' && type !== null)) &&
    (type as Record<symbol, unknown>)[FIELD_LABEL] === true
  );
}
