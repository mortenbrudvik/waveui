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
   * The props object of the header the group's scan found (the first one among its direct
   * children or Fragments), or `undefined`. React renders an element with that same object, so
   * the header whose props are these is the scanned one: only it renders `headerId`.
   */
  headerProps: MenuGroupHeaderProps | undefined;
  /**
   * Whether the group has a name: a header among its direct children (or Fragments), or the
   * consumer's `aria-label`/`aria-labelledby`. A header the scan did not find, in a group whose
   * scan found none, warns only without.
   */
  labelled: boolean;
}

const MenuGroupContext = React.createContext<MenuGroupContextValue | null>(null);
MenuGroupContext.displayName = 'MenuGroupContext';

/** What a misplaced header renders with in production (C-CONTEXT): its own id only, no warning. */
const INERT_GROUP_CONTEXT: MenuGroupContextValue = {
  headerId: '',
  headerProps: undefined,
  labelled: true,
};

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
 * `aria-label` or `aria-labelledby` wins over the header (one that holds `undefined` does not).
 * Give a group one header: only the first header among its direct children labels it, and any
 * other header renders only its own `id` (development warning). The group changes nothing about
 * the keyboard: its items stay items of the menu. Separate groups with `Menu.Divider`.
 *
 * Also exported as `MenuGroup` (import the flat name from React Server Components).
 */
export const MenuGroup = ({ children, ref, ...rest }: MenuGroupProps) => {
  const generatedId = useId('menu-group-header');
  // A static scan, so the reference is in the server HTML and never points at a missing id.
  const header = flattenChildren(children).find(({ node }) =>
    isElementOfType<MenuGroupHeaderProps>(node, MenuGroupHeader),
  )?.node as React.ReactElement<MenuGroupHeaderProps> | undefined;
  const headerProps = header?.props;
  const headerId = headerProps?.id || generatedId;
  // A prop that holds `undefined` (a wrapper forwarding it) is no name of the consumer's.
  const ownName = rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined;
  const labelled = header !== undefined || ownName;
  // Written after the spread, so a forwarded `aria-labelledby={undefined}` cannot remove it.
  const labelledBy = ownName
    ? rest['aria-labelledby']
    : header !== undefined
      ? headerId
      : undefined;

  const context = React.useMemo<MenuGroupContextValue>(
    () => ({ headerId, headerProps, labelled }),
    [headerId, headerProps, labelled],
  );

  return (
    <MenuGroupContext.Provider value={context}>
      <div role="group" {...rest} ref={ref} aria-labelledby={labelledBy}>
        {children}
      </div>
    </MenuGroupContext.Provider>
  );
};
MenuGroup.displayName = 'MenuGroup';

/**
 * The visible heading of a `Menu.Group`. It is not a menu item: arrow keys and typeahead skip it.
 * Its text lines up with the item labels (it keeps the menu's check and icon columns). It labels
 * the group when it is the group's first header among its direct children (or inside a Fragment
 * there); any other header labels nothing and renders only its own `id` (development warning).
 * Must be used inside `Menu.Group`.
 *
 * Also exported as `MenuGroupHeader` (import the flat name from React Server Components).
 */
export const MenuGroupHeader = (props: MenuGroupHeaderProps) => {
  const { id, className, children, ref, ...rest } = props;
  const group = useMenuGroupContext('Menu.GroupHeader');

  // The header the group's scan found is the one rendered with the scanned element's props object.
  // Only it renders the id the group points at: any other header (inside a custom component or an
  // element, or a second one) keeps only its own id, so no two headers share one.
  const scanned = group.headerProps === props;
  // C-DEV: any other header labels nothing and warns, except in a group that has no header its
  // scan found and is named by the consumer's label (that label is the unlabelled warning's remedy).
  let problem: 'unlabelled' | 'extra-header' | null = null;
  if (!scanned && group.headerProps !== undefined) problem = 'extra-header';
  else if (!scanned && !group.labelled) problem = 'unlabelled';
  React.useEffect(() => {
    if (problem === 'unlabelled') {
      warnOnce(
        'Menu.GroupHeader:unlabelled',
        'Menu.GroupHeader: this header is not a direct child of Menu.Group (or of a Fragment in it), so it does not label the group. Make it a direct child, or pass aria-label to Menu.Group.',
      );
    } else if (problem === 'extra-header') {
      warnOnce(
        'Menu.GroupHeader:extra-header',
        'Menu.GroupHeader: this Menu.Group already has a header (its first direct child header), so this one does not label the group. Give a group one header, or put this one in a Menu.Group of its own.',
      );
    }
  }, [problem]);

  return (
    <div
      {...rest}
      ref={ref}
      id={(scanned ? group.headerId : id) || undefined}
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
