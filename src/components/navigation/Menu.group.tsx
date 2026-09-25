import * as React from 'react';
import { cn } from '../../lib/cn';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { useId } from '../../hooks/useId';
import { MenuColumnSpacers } from './Menu.items';

/** Properties for the MenuGroup sub-component. */
export interface MenuGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the `role="group"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the MenuGroupHeader sub-component. */
export interface MenuGroupHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the header element. */
  ref?: React.Ref<HTMLDivElement>;
}

interface MenuGroupContextValue {
  /** The id the group's header renders (its own `id`, else a generated one). */
  headerId: string;
  /**
   * Whether the group has a name: a header among its direct children (or Fragments), or the
   * consumer's `aria-label`/`aria-labelledby`. A header the scan did not find warns only without.
   */
  labelled: boolean;
}

const MenuGroupContext = React.createContext<MenuGroupContextValue | null>(null);
MenuGroupContext.displayName = 'MenuGroupContext';

/** What a misplaced header renders with in production (C-CONTEXT): its own id only, no warning. */
const INERT_GROUP_CONTEXT: MenuGroupContextValue = { headerId: '', labelled: true };

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
function useMenuGroupContext(componentName: string): MenuGroupContextValue {
  const context = React.useContext(MenuGroupContext);
  if (context) return context;
  reportMissingContext(componentName, 'Menu.Group');
  return INERT_GROUP_CONTEXT;
}

/**
 * A labelled group of menu items (`role="group"`), for example the radio items of one choice.
 * Labelled by its `Menu.GroupHeader` when the header is a direct child (or inside a Fragment; a
 * header written in a Server Component counts too); a header nested deeper does not label it
 * (development warning). Pass `aria-label` for a group without a visible header; a consumer
 * `aria-label` or `aria-labelledby` wins over the header. Give a group one header. The group
 * changes nothing about the keyboard: its items stay items of the menu. Separate groups with
 * `Menu.Divider`.
 *
 * Also exported as `MenuGroup` (import the flat name from React Server Components).
 */
export const MenuGroup = ({ children, ref, ...rest }: MenuGroupProps) => {
  const generatedId = useId('menu-group-header');
  // A static scan, so the reference is in the server HTML and never points at a missing id.
  const header = flattenChildren(children).find(({ node }) =>
    isElementOfType<MenuGroupHeaderProps>(node, MenuGroupHeader),
  )?.node as React.ReactElement<MenuGroupHeaderProps> | undefined;
  const headerId = header?.props.id || generatedId;
  const ownName = rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined;
  const labelled = header !== undefined || ownName;

  const context = React.useMemo<MenuGroupContextValue>(
    () => ({ headerId, labelled }),
    [headerId, labelled],
  );

  return (
    <MenuGroupContext.Provider value={context}>
      <div
        role="group"
        aria-labelledby={header !== undefined && !ownName ? headerId : undefined}
        {...rest}
        ref={ref}
      >
        {children}
      </div>
    </MenuGroupContext.Provider>
  );
};
MenuGroup.displayName = 'MenuGroup';

/**
 * The visible heading of a `Menu.Group`. It is not a menu item: arrow keys and typeahead skip it.
 * Its text lines up with the item labels (it keeps the menu's check and icon columns). It labels
 * the group when it is a direct child of `Menu.Group` (or inside a Fragment there). Must be used
 * inside `Menu.Group`.
 *
 * Also exported as `MenuGroupHeader` (import the flat name from React Server Components).
 */
export const MenuGroupHeader = ({
  id,
  className,
  children,
  ref,
  ...rest
}: MenuGroupHeaderProps) => {
  const group = useMenuGroupContext('Menu.GroupHeader');

  // C-DEV: a header the group's scan did not find (inside a custom component or an element) does
  // not label the group.
  const unlabelled = !group.labelled;
  React.useEffect(() => {
    if (!unlabelled) return;
    warnOnce(
      'Menu.GroupHeader:unlabelled',
      'Menu.GroupHeader: this header is not a direct child of Menu.Group (or of a Fragment in it), so it does not label the group. Make it a direct child, or pass aria-label to Menu.Group.',
    );
  }, [unlabelled]);

  return (
    <div
      {...rest}
      ref={ref}
      id={id || group.headerId || undefined}
      className={cn(
        'flex items-center gap-2 px-3 pb-1 pt-2 text-caption-1 font-semibold text-muted-foreground',
        className,
      )}
    >
      <MenuColumnSpacers />
      {children}
    </div>
  );
};
MenuGroupHeader.displayName = 'MenuGroupHeader';
