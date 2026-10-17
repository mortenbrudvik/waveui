import * as React from 'react';
import { treeItemPersonaLayoutClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { useId } from '../../hooks/useId';
import { useTreeItemContext } from './Tree.context';

/** Properties for the TreeItemPersonaLayout sub-component (Fluent's `TreeItemPersonaLayout`). */
export interface TreeItemPersonaLayoutProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * The person's picture, usually an Avatar (`size="small"`, 32 px, fits a row). The name is shown
   * next to it, so make it decorative (`<Avatar decorative … />`).
   */
  media?: React.ReactNode;
  /** A second line under the name; it describes the item. */
  description?: React.ReactNode;
  ref?: React.Ref<HTMLSpanElement>;
}

/**
 * Lays out an item's label as a person: `media`, the name (children) and a `description` under
 * it. Use it as a Tree.Item's label content: the item is named by the name and described by the
 * description. Also exported as `TreeItemPersonaLayout` (Fluent's name; import the flat name from
 * React Server Components).
 */
export const TreeItemPersonaLayout = ({
  media,
  description,
  className,
  children,
  ref,
  ...rest
}: TreeItemPersonaLayoutProps) => {
  const { registerLayout } = useTreeItemContext('Tree.ItemPersonaLayout');
  const nameId = useId('tree-persona-name');
  const descriptionId = useId('tree-persona-description');
  const hasMedia = slotRendersContent(media);
  const hasDescription = slotRendersContent(description);

  React.useLayoutEffect(
    () => registerLayout({ nameId, descriptionId: hasDescription ? descriptionId : undefined }),
    [registerLayout, nameId, descriptionId, hasDescription],
  );

  return (
    <span
      ref={ref}
      className={cn(
        treeItemPersonaLayoutClassNames.root,
        'flex min-w-0 items-center gap-2',
        className,
      )}
      {...rest}
    >
      {hasMedia && (
        <span className={cn(treeItemPersonaLayoutClassNames.media, 'inline-flex shrink-0')}>
          {materialiseSlotContent(media)}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span
          id={nameId}
          data-tree-persona-name=""
          className={cn(treeItemPersonaLayoutClassNames.main, 'truncate')}
        >
          {children}
        </span>
        {hasDescription && (
          <span
            id={descriptionId}
            className={cn(
              treeItemPersonaLayoutClassNames.description,
              'truncate text-caption-1 text-muted-foreground',
            )}
          >
            {materialiseSlotContent(description)}
          </span>
        )}
      </span>
    </span>
  );
};
TreeItemPersonaLayout.displayName = 'TreeItemPersonaLayout';
