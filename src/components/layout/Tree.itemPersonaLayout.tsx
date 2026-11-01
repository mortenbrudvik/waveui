import * as React from 'react';
import { treeItemPersonaLayoutClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { HIDDEN_PART_LOCKS, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { useId } from '../../hooks/useId';
import { TREE_PART_LOCKS, useTreeItemContext } from './Tree.context';

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
  /**
   * Props for the elements the layout draws, by part, merged into each part's own: your classes
   * after the part's (yours win a conflict), your styles over its styles, your attributes and
   * handlers added, your ref attached. Every attribute the layout sets on a part is locked and
   * keeps the layout's value, and no part takes a role, a tab index or the markers by which the
   * tree reads an item, so a part changes neither the item's name, its description, its
   * typeahead text nor the tree's items and tab stop. A part takes no `children` (the layout draws
   * their content); the layout's own element takes its own props. No part carries a handler: an
   * event on a part reaches the item and its tree after your handler, as one on the label does,
   * and `preventDefault()` in yours skips their handling of it there too: a click you prevent
   * neither activates nor expands the item, while the `Tree.Item`'s own `onClick` is still
   * called, as for a prevented click on its label. Fluent UI's TreeItemPersonaLayout gives these
   * parts slots of their own (`media`, `main`, `description`).
   */
  slotProps?: {
    /**
     * The `<span>` of `media`, rendered while `media` renders content (stable class
     * `wave-tree-item-persona-layout__media`). Locked: no role or tab index, and none of the
     * tree's markers (typeahead would read the media's text as the item's).
     */
    media?: SlotPart<'span'>;
    /**
     * The `<span>` of the name (`children`), which names the item (stable class
     * `wave-tree-item-persona-layout__main`). Locked: its `id` (the item's `aria-labelledby`),
     * its marker (typeahead reads the item's text from it), no `aria-label` (it would replace the
     * name's text), no role or tab index, the tree's other markers, and no `hidden`, `inert` or
     * `aria-hidden`.
     */
    main?: SlotPart<'span'>;
    /**
     * The `<span>` of `description`, rendered while `description` renders content, which
     * describes the item (stable class `wave-tree-item-persona-layout__description`). Locked: its
     * `id` (the item's `aria-describedby`), no `aria-label`, no role or tab index, none of the
     * tree's markers, and no `hidden`, `inert` or `aria-hidden`.
     */
    description?: SlotPart<'span'>;
  };
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
  slotProps,
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

  // The parts are merged only when given: a tree renders many items.
  const mediaClasses = hasMedia
    ? cn(treeItemPersonaLayoutClassNames.media, 'inline-flex shrink-0')
    : undefined;
  const mainClasses = cn(treeItemPersonaLayoutClassNames.main, 'truncate');
  const descriptionClasses = hasDescription
    ? cn(
        treeItemPersonaLayoutClassNames.description,
        'truncate text-caption-1 text-muted-foreground',
      )
    : undefined;

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
        <span
          className={mediaClasses}
          {...(slotProps?.media &&
            mergeSlotProps(slotProps.media, { className: mediaClasses, locked: TREE_PART_LOCKS }))}
        >
          {materialiseSlotContent(media)}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span
          id={nameId}
          data-tree-persona-name=""
          className={mainClasses}
          {...(slotProps?.main &&
            mergeSlotProps(slotProps.main, {
              className: mainClasses,
              locked: {
                ...TREE_PART_LOCKS,
                ...HIDDEN_PART_LOCKS,
                id: nameId,
                'aria-label': undefined,
                'data-tree-persona-name': '',
              },
            }))}
        >
          {children}
        </span>
        {hasDescription && (
          <span
            id={descriptionId}
            className={descriptionClasses}
            {...(slotProps?.description &&
              mergeSlotProps(slotProps.description, {
                className: descriptionClasses,
                locked: {
                  ...TREE_PART_LOCKS,
                  ...HIDDEN_PART_LOCKS,
                  id: descriptionId,
                  'aria-label': undefined,
                },
              }))}
          >
            {materialiseSlotContent(description)}
          </span>
        )}
      </span>
    </span>
  );
};
TreeItemPersonaLayout.displayName = 'TreeItemPersonaLayout';
