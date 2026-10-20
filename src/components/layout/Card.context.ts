import * as React from 'react';
import type { Orientation } from '../../lib/types';

/*
 * What a Card gives its parts. Internal (never exported from a barrel); imports no component, so a
 * part that reads it does not import the Card.
 */

/** The orientation of the enclosing Card, for `Card.Preview`; `'vertical'` outside a Card. */
export const CardOrientationContext = React.createContext<Orientation>('vertical');
CardOrientationContext.displayName = 'CardOrientationContext';

/** Which corners of the enclosing Card hold controls, for `Card.Header`'s padding. */
export interface CardCornersContextValue {
  /** The built-in checkbox sits in the top start corner (a floating action takes the end). */
  checkboxAtStart: boolean;
  /** A floating action sits in the top end corner. */
  floatingAction: boolean;
}

/** The corners of the enclosing Card; both `false` outside a Card. */
export const CardCornersContext = React.createContext<CardCornersContextValue>({
  checkboxAtStart: false,
  floatingAction: false,
});
CardCornersContext.displayName = 'CardCornersContext';
