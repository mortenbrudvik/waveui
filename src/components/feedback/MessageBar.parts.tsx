import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { messageBarActionsClassNames, messageBarTitleClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';

/** Properties for the MessageBarTitle sub-component. */
export interface MessageBarTitleProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Ref to the title `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/** Properties for the MessageBarActions sub-component. */
export interface MessageBarActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the element that holds the actions. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Where a MessageBar put a part (C-CONTEXT: `null` outside every MessageBar). The bar provides
 * `'content'` around everything it renders and a more specific value around the parts that its
 * scan of its direct children placed; each part resets it to `'content'` for its own children, so
 * a part inside another part, or inside the app's own component, counts as not placed.
 */
export interface MessageBarPartContextValue {
  /**
   * `'title'`: the bar's title, first in the text column. `'actions'`: in the action area.
   * `'extra-title'`: a later title, left in the body. `'content'`: anywhere else inside the bar.
   */
  placement: 'title' | 'actions' | 'extra-title' | 'content';
  /** The id the placed title renders (its own `id`, else a generated one); `'title'` only. */
  titleId?: string;
}

export const MessageBarPartContext = React.createContext<MessageBarPartContextValue | null>(null);
MessageBarPartContext.displayName = 'MessageBarPartContext';

/** Inside a bar but not placed by its scan (also the inert value in production, C-CONTEXT). */
export const CONTENT_PLACEMENT: MessageBarPartContextValue = { placement: 'content' };
/** A `MessageBar.Actions` the bar placed in its action area. */
export const ACTIONS_PLACEMENT: MessageBarPartContextValue = { placement: 'actions' };
/** A second or later `MessageBar.Title`, rendered where it is in the body. */
export const EXTRA_TITLE_PLACEMENT: MessageBarPartContextValue = { placement: 'extra-title' };

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
function useMessageBarPart(componentName: string): MessageBarPartContextValue {
  const context = React.useContext(MessageBarPartContext);
  if (context) return context;
  reportMissingContext(componentName, '<MessageBar>');
  return CONTENT_PLACEMENT;
}

/**
 * The bar's title, read right after the severity text. Names the bar when the bar has a non-live
 * `role` (`region`, `group`). Must be a direct child of MessageBar (a Fragment there counts, and so
 * does a title written in a Server Component); anywhere else it renders where it is, without its
 * place or the naming (development warning). Give a bar one title: a second one renders as body
 * text (development warning). A title whose children render nothing is left out.
 *
 * Also exported as `MessageBarTitle` (import the flat name from React Server Components).
 */
export const MessageBarTitle = ({
  id,
  className,
  children,
  ref,
  ...rest
}: MessageBarTitleProps) => {
  const part = useMessageBarPart('MessageBar.Title');
  const placed = part.placement === 'title';
  const problem: 'unscanned' | 'multiple' | null = placed
    ? null
    : part.placement === 'extra-title'
      ? 'multiple'
      : 'unscanned';
  React.useEffect(() => {
    if (problem === 'unscanned') {
      warnOnce(
        'MessageBar.Title:unscanned',
        'MessageBar.Title is not a direct child of MessageBar, so it is not placed first in the text. Make it a direct child.',
      );
    } else if (problem === 'multiple') {
      warnOnce(
        'MessageBar.Title:multiple',
        'MessageBar.Title: this MessageBar already has a title (its first MessageBar.Title among its direct children), so this one renders as body text. Give a bar one title.',
      );
    }
  }, [problem]);

  return (
    <span
      {...rest}
      ref={ref}
      id={(placed ? part.titleId : id) || undefined}
      className={cn(messageBarTitleClassNames.root, 'font-semibold', className)}
    >
      <MessageBarPartContext.Provider value={CONTENT_PLACEMENT}>
        {materialiseSlotContent(children)}
      </MessageBarPartContext.Provider>
    </span>
  );
};
MessageBarTitle.displayName = 'MessageBarTitle';

/**
 * The bar's actions (Retry, Learn more): after the text on one row, on their own row under it in
 * the multiline layout. Must be a direct child of MessageBar (a Fragment there counts, and so does
 * a part written in a Server Component); anywhere else it renders where it is (development
 * warning). Actions whose children render nothing are left out, so the bar keeps its look without
 * actions. The actions have no role of their own: the bar is already the grouping.
 *
 * Also exported as `MessageBarActions` (import the flat name from React Server Components).
 */
export const MessageBarActions = ({
  className,
  children,
  ref,
  ...rest
}: MessageBarActionsProps) => {
  const part = useMessageBarPart('MessageBar.Actions');
  const placed = part.placement === 'actions';
  React.useEffect(() => {
    if (!placed) {
      warnOnce(
        'MessageBar.Actions:unscanned',
        'MessageBar.Actions is not a direct child of MessageBar, so it is not placed in the action area. Make it a direct child.',
      );
    }
  }, [placed]);

  return (
    <div
      {...rest}
      ref={ref}
      className={cn(
        messageBarActionsClassNames.root,
        'flex shrink-0 flex-wrap items-center gap-2',
        className,
      )}
    >
      <MessageBarPartContext.Provider value={CONTENT_PLACEMENT}>
        {materialiseSlotContent(children)}
      </MessageBarPartContext.Provider>
    </div>
  );
};
MessageBarActions.displayName = 'MessageBarActions';

/** The context value of the placed title (C-MEMO): stable while its id is. */
export function useTitlePlacement(
  ownTitleId: string | undefined,
  generatedTitleId: string,
): MessageBarPartContextValue {
  const titleId = ownTitleId || generatedTitleId;
  return React.useMemo<MessageBarPartContextValue>(
    () => ({ placement: 'title', titleId }),
    [titleId],
  );
}

/** How a MessageBar sorts its direct children (D15). */
export interface MessageBarPartition {
  /** The first `MessageBar.Title` whose children render content, with its flattened key. */
  title: { key: string; element: React.ReactElement<MessageBarTitleProps> } | undefined;
  /** The `id` the first title was given by its consumer, if any. */
  ownTitleId: string | undefined;
  /** Every `MessageBar.Actions` whose children render content, in order. */
  actions: Array<{ key: string; element: React.ReactElement<MessageBarActionsProps> }>;
  /** Everything else, in order; `extraTitle` marks a later title that renders content. */
  body: Array<{ key: string; node: React.ReactNode; extraTitle: boolean }>;
}

/**
 * The static scan of D15, during render (so the placement is in the server HTML): the direct
 * children with Fragments flattened, parts recognised by `isElementOfType` (a part written in a
 * Server Component arrives as a lazy reference). A part whose children render nothing
 * (`slotRendersContent`) is dropped.
 */
export function partitionMessageBarChildren(children: React.ReactNode): MessageBarPartition {
  let title: MessageBarPartition['title'];
  const actions: MessageBarPartition['actions'] = [];
  const body: MessageBarPartition['body'] = [];
  for (const { key, node } of flattenChildren(children)) {
    if (isElementOfType<MessageBarTitleProps>(node, MessageBarTitle)) {
      if (!slotRendersContent(node.props.children)) continue;
      if (title === undefined) title = { key, element: node };
      else body.push({ key, node, extraTitle: true });
    } else if (isElementOfType<MessageBarActionsProps>(node, MessageBarActions)) {
      if (slotRendersContent(node.props.children)) actions.push({ key, element: node });
    } else {
      body.push({ key, node, extraTitle: false });
    }
  }
  return { title, ownTitleId: title?.element.props.id, actions, body };
}
