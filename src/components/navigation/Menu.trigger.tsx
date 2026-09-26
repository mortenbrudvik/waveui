import * as React from 'react';
import { warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isDisabledTrigger } from '../../lib/events';
import { mergeProps } from '../../lib/mergeProps';
import { STATE_ARIA } from '../../lib/renderTrigger';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useTriggerElement } from '../../hooks/useTriggerElement';
import { MenuSubmenuTriggerContext, useMenuContext } from './Menu.context';
import { useStaticMenuPartWarning } from './Menu.shared';

/**
 * The props `Menu.Trigger` puts on its element (merged onto the single child, or passed to a
 * render-prop child — e.g. `SplitButton`'s `menuButtonProps`). A type alias (not an interface), so
 * it is assignable to prop types with index signatures such as `data-*`.
 */
export type MenuTriggerProps = {
  /** Generated id (the child's own `id` wins; the menu is labelled by it). */
  id: string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  /** The menu's id, only while the menu is open. */
  'aria-controls'?: string;
  /**
   * Toggles the menu (opening focuses the first enabled item). Ignored when the click comes from an
   * `aria-disabled="true"` element at or inside the element that carries it.
   */
  onClick: React.MouseEventHandler<HTMLElement>;
  /**
   * Enter/Space/ArrowDown open and focus the first item; ArrowUp opens and focuses the last.
   * Ignored, without `preventDefault()`, when the key comes from an `aria-disabled="true"` element
   * at or inside the element that carries it.
   */
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  /** Anchor for positioning and focus-restore target. */
  ref: React.RefCallback<HTMLElement>;
  /** Hover opening (`openOnHover`, and every submenu): the mouse pointer enters the trigger. */
  onPointerEnter?: React.PointerEventHandler<HTMLElement>;
  /** Hover opening: the mouse pointer moves over the trigger. */
  onPointerMove?: React.PointerEventHandler<HTMLElement>;
  /** Hover opening: the mouse pointer leaves the trigger. */
  onPointerLeave?: React.PointerEventHandler<HTMLElement>;
  /**
   * Context menus (`openOnContext`): a right click (a macOS Ctrl+click, a long press) on the
   * region opens the menu at the pointer. In that mode `aria-haspopup` is still passed to a
   * render-prop child and `aria-expanded` is always `false`, but do not spread them (or
   * `aria-controls`): a context region is no menu button, and they are removed from its element
   * after each commit.
   */
  onContextMenu?: React.MouseEventHandler<HTMLElement>;
};

/** What a context-menu region's cloned child or wrapper span receives of the trigger's own props. */
type ContextTriggerProps = Pick<MenuTriggerProps, 'id' | 'ref' | 'onKeyDown' | 'onContextMenu'>;

const noop = () => {};

/**
 * Properties for the MenuTrigger sub-component. Other props (`aria-describedby` from a wrapping
 * `Tooltip`, `className`, `data-*`, handlers, …) are forwarded to the trigger element: merged with
 * the child's own props (handlers composed, classes joined, `aria-describedby` ids joined), or
 * passed to a render-prop child together with {@link MenuTriggerProps}.
 */
export interface MenuTriggerComponentProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'children'
> {
  /**
   * A single element that receives {@link MenuTriggerProps} (its own handlers run first; its own
   * `id` is kept; the trigger's `aria-expanded`/`aria-controls`/`aria-haspopup` always win), or a
   * render function that receives them (plus the forwarded props).
   */
  children: React.ReactNode | ((props: MenuTriggerProps) => React.ReactNode);
  /**
   * `false` renders a wrapper `<span>` carrying the trigger props instead of merging them onto the
   * child (the 0.4-style wrapper). The state ARIA (`aria-haspopup`, `aria-expanded`,
   * `aria-controls`), which a generic span cannot carry, goes to the first element in the tab
   * order inside the span (none for text children), and focus returns to that element when the
   * menu closes. A render-prop child still receives every prop.
   * @default true
   */
  asChild?: boolean;
  /** Ref to the trigger element (the child, or the wrapper span); the child's own ref is kept. */
  ref?: React.Ref<HTMLElement>;
}

/**
 * The element that opens a popup menu. Its single child receives {@link MenuTriggerProps}
 * (`aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while open, an id and composed
 * `onClick`/`onKeyDown`); a render function receives them instead. Click, Enter, Space and
 * ArrowDown open the menu and focus its first enabled item; ArrowUp opens it and focuses the last.
 * Other props passed to `Menu.Trigger` are forwarded to the child, so
 * `<Tooltip><Menu.Trigger><MenuButton /></Menu.Trigger></Tooltip>` describes the MenuButton.
 *
 * A trigger with `aria-disabled="true"` (a `disabledFocusable` MenuButton or SplitButton) stays
 * focusable but never opens the menu: its click, Enter, Space, ArrowDown and ArrowUp are ignored
 * and keep their default. This holds for the child itself and for an element inside the wrapper
 * span; an `aria-disabled` ancestor outside the trigger does not count.
 *
 * With `asChild={false}` (and for a child that does not attach the ref, automatically) the props
 * go on a wrapper span instead; the state ARIA then goes to the first element in the tab order
 * inside it, and focus returns to that element.
 *
 * - **Hover** (`openOnHover` on the Menu): a resting mouse pointer opens the menu without moving
 *   focus; a click, Enter, Space or ArrowDown on the trigger then keeps it open and focuses its
 *   first item (ArrowUp: the last), instead of closing it.
 * - **Submenus**: in a `<Menu>` nested in a menu list, wrap a `Menu.Item`, which becomes the
 *   submenu's trigger item (`aria-haspopup="menu"`, `aria-expanded`, a chevron that mirrors in
 *   RTL). ArrowRight (ArrowLeft in RTL), Enter, Space and a click open the submenu and focus its
 *   first item (a click never closes it); resting the mouse on it opens the submenu without moving
 *   focus. ArrowDown, ArrowUp and typeahead stay the parent list's.
 * - **Context menus** (`openOnContext` on the Menu): the child is a region (a list, a row, a
 *   canvas); a right click or Shift+F10/the ContextMenu key opens the menu. A cloned child or a
 *   wrapper span gets only the id, the ref and the context-gesture handlers: no state ARIA and no
 *   click toggle (do not spread them from a render-prop child either).
 *
 * Also exported as `MenuTrigger` (import the flat name from React Server Components).
 *
 * @example
 * <Menu>
 *   <Menu.Trigger><Button>Actions</Button></Menu.Trigger>
 *   <Menu.Popover><Menu.Item onClick={edit}>Edit</Menu.Item></Menu.Popover>
 * </Menu>
 */
export const MenuTrigger = ({ children, asChild, ref, ...rest }: MenuTriggerComponentProps) => {
  const {
    popup,
    open,
    openWithFocus,
    requestClose,
    triggerId,
    menuId,
    onTriggerId,
    triggerElement,
    setTriggerElement,
    isSubmenu,
    isHoverOpen,
    hoverTriggerHandlers,
    openOnContext,
    contextTriggerHandlers,
  } = useMenuContext('Menu.Trigger');
  useStaticMenuPartWarning('Menu.Trigger', popup);
  const elementRef = useMergedRefs<HTMLElement>(setTriggerElement, ref);

  // C-DEV: a submenu opens from one of its parent's items; any other element is not an item of
  // that menu (the arrow keys and typeahead skip it).
  React.useEffect(() => {
    if (!isSubmenu || !triggerElement || triggerElement.getAttribute('role') === 'menuitem') {
      return;
    }
    warnOnce(
      'Menu.Trigger:submenu-child',
      `Menu.Trigger: a submenu's Menu.Trigger must wrap a Menu.Item: its element has no role="menuitem", so the menu does not treat it as one of its items. Put a Menu.Item inside it (and leave asChild at its default).`,
    );
  }, [isSubmenu, triggerElement]);

  // An `aria-disabled` trigger (a focusable disabled button, a disabled trigger item) never opens
  // the menu: the event is left alone, default included, so the element keeps its own handling of
  // the key.
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || isDisabledTrigger(event)) return;
    // A click on the trigger of a hover-opened menu pins it and focuses its first item, as on a
    // closed menu. A submenu trigger item never toggles its submenu closed: a click on an open one
    // focuses its first item again.
    if (open && !isSubmenu && !isHoverOpen()) requestClose();
    else openWithFocus('first');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || isDisabledTrigger(event)) {
      return;
    }
    if (isSubmenu) {
      // "Next" (ArrowRight, ArrowLeft in RTL), Enter and Space open the submenu and focus its
      // first item. ArrowDown, ArrowUp and typeahead stay the parent list's.
      if (event.altKey) return;
      const intent = getArrowIntent(event.key, {
        orientation: 'horizontal',
        dir: getDirection(event.currentTarget),
      });
      if (intent === 'next' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWithFocus('first');
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        openWithFocus('first');
        break;
      case 'ArrowUp':
        event.preventDefault();
        openWithFocus('last');
        break;
      case 'Enter':
      case ' ':
        // Handled here (not through the native click) so non-button children work too.
        event.preventDefault();
        if (open && !isHoverOpen()) requestClose();
        else openWithFocus('first');
        break;
      default:
        break;
    }
  };

  // A context-menu region is no menu button: of its own props a cloned child or a wrapper span
  // gets only the id, the ref and the context-gesture handlers (no state ARIA, no click toggle). A
  // render-prop child still receives every member (`aria-expanded` constantly false, an onClick
  // that does nothing); useTriggerElement removes the state ARIA it spreads.
  const ownProps: MenuTriggerProps | ContextTriggerProps = openOnContext
    ? typeof children === 'function'
      ? {
          id: triggerId,
          'aria-haspopup': 'menu',
          'aria-expanded': false,
          onClick: noop,
          ref: elementRef,
          ...contextTriggerHandlers,
        }
      : { id: triggerId, ref: elementRef, ...contextTriggerHandlers }
    : {
        id: triggerId,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        ref: elementRef,
        ...hoverTriggerHandlers,
      };
  // §5.3: forwarded props merge in (a consumer `id` wins, handlers compose consumer-first), but the
  // live state ARIA always wins. On a wrapper span (`asChild={false}`, the automatic fallback)
  // useTriggerElement moves the state ARIA onto the first element in the tab order inside it.
  const triggerProps = mergeProps(ownProps, rest, { oursWin: STATE_ARIA });

  // A render-prop child always gets the full MenuTriggerProps; the context region's reduced props
  // reach only a cloned child or a wrapper span.
  const element = useTriggerElement(children, triggerProps as MenuTriggerProps, {
    componentName: 'Menu.Trigger',
    asChild,
    onResolvedId: onTriggerId,
    omitStateAria: openOnContext,
  });
  // The Menu.Item a submenu opens from shows the submenu chevron and never closes its own menu.
  return isSubmenu ? (
    <MenuSubmenuTriggerContext.Provider value>{element}</MenuSubmenuTriggerContext.Provider>
  ) : (
    element
  );
};
MenuTrigger.displayName = 'MenuTrigger';
