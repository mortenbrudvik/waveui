import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { Status } from '../../lib/types';

/*
 * The context a MessageBar gives everything it renders, and the public hook that reads it (P13-02,
 * R15): the bar's status and the layout it renders. The context object stays internal (R11); the
 * placement of the parts has a context of its own (`MessageBar.parts.tsx`), so a part placed by
 * the bar's scan never re-renders for a layout change. Imports no component: `MessageBar.tsx`
 * imports this module, never the reverse.
 */

/** The state of a `MessageBar` that {@link useMessageBarContext} returns. */
export interface MessageBarContextValue {
  /** The bar's `status`, `'info'` when it has none (Fluent's `intent`). */
  intent: Status;
  /**
   * The layout the bar renders, as its root's `data-layout` says: an explicit `layout`, or, for
   * `layout="auto"` with `MessageBar.Actions`, the one its measurement chose (`'singleline'` in the
   * server HTML, on the first render and while the text fits on one row; `'multiline'` once it does
   * not), so content can follow the bar as it reflows. An `'auto'` bar without actions is
   * `'multiline'`.
   */
  layout: 'singleline' | 'multiline';
}

/** Internal: provided by `MessageBar` around everything it renders (C-MEMO: memoised there). */
export const MessageBarContext = React.createContext<MessageBarContextValue | null>(null);
MessageBarContext.displayName = 'MessageBarContext';

/** The default status, one row: outside a MessageBar in production (C-CONTEXT). */
const INERT_CONTEXT: MessageBarContextValue = { intent: 'info', layout: 'singleline' };

/**
 * The state of the surrounding `MessageBar`, for an action or other content of your own anywhere in
 * it: its `intent` (the bar's `status`) and the `layout` it renders, so the content can follow
 * them, for example an action that says "Try again" in an error bar and is a medium button once it
 * has a row of its own. It is a narrow view of the bar (the context object is not public), the same
 * object while neither value changes. The nearest `MessageBar` answers, also in a
 * `MessageBarGroup` (each bar gives its own values).
 *
 * `layout` is the one the bar renders, after `layout="auto"` has measured its text. Render from the
 * values during render, not from an effect: message text that changes with the layout then changes
 * in the commit that renders the layout, which an `'auto'` bar does not take for a new message to
 * measure; text changed later, from an effect, makes it measure again at each change.
 *
 * Must be called inside a `MessageBar`: outside one it throws in development and, in production,
 * logs once and returns an inert value (`intent: 'info'`, `layout: 'singleline'`).
 *
 * Fluent UI's counterpart is `useMessageBarContext`, which returns the layout, the title's id and
 * refs to the actions and the body, no intent, and a default value outside a bar.
 *
 * @example
 * function RetryAction({ onRetry }: { onRetry: () => void }) {
 *   const { intent, layout } = useMessageBarContext();
 *   return (
 *     <Button
 *       appearance={intent === 'error' ? 'primary' : 'outline'}
 *       size={layout === 'multiline' ? 'medium' : 'small'}
 *       onClick={onRetry}
 *     >
 *       {intent === 'error' ? 'Try again' : 'Refresh'}
 *     </Button>
 *   );
 * }
 */
export function useMessageBarContext(): MessageBarContextValue {
  const context = React.useContext(MessageBarContext);
  if (context) return context;
  reportMissingContext('useMessageBarContext', '<MessageBar>');
  return INERT_CONTEXT;
}
