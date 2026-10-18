import * as React from 'react';
import { cn } from '../../lib/cn';
import { drawerTitleClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { useModalClosePart, useModalTitle, useModalTriggerPart } from './Dialog.shared';
import { useDrawerContext } from './Drawer.context';

/*
 * The Drawer's parts. Imports the context module only (never the root or `Drawer.tsx`).
 */

/** Props a `Drawer.Trigger` puts on its element (and passes to a render-prop child). */
export interface DrawerTriggerRenderProps extends React.HTMLAttributes<HTMLElement> {
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  /** The panel's id, while the drawer is open. */
  'aria-controls'?: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the DrawerTrigger sub-component. */
export interface DrawerTriggerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The element that opens the drawer. A single element receives the trigger props (merged with its
   * own); a function receives them.
   */
  children: React.ReactNode | ((props: DrawerTriggerRenderProps) => React.ReactNode);
  /**
   * `false` renders a wrapper `<span>` around the children instead of merging the trigger props
   * onto the child. The span carries the click handler; `aria-haspopup`, `aria-expanded` and
   * `aria-controls` go to the first element in the tab order inside it.
   * @default true
   */
  asChild?: boolean;
  /** Ref to the trigger element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/** Props a `Drawer.Close` puts on its element (and passes to a render-prop child). */
export interface DrawerCloseRenderProps extends React.HTMLAttributes<HTMLElement> {
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the DrawerClose sub-component. */
export interface DrawerCloseProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The element that closes the drawer. A single element receives an `onClick` composed with its own
   * (its handler runs first; `preventDefault()` keeps the drawer open); a function receives the
   * props.
   */
  children: React.ReactNode | ((props: DrawerCloseRenderProps) => React.ReactNode);
  /** `false` renders a wrapper `<span>` that closes the drawer on click. @default true */
  asChild?: boolean;
  /** Ref to the close element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the DrawerTitle sub-component. */
export interface DrawerTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** The title; any content. */
  children: React.ReactNode;
  /** Ref to the heading element. */
  ref?: React.Ref<HTMLHeadingElement>;
}

/** The warning key of a `Drawer.Trigger` that renders as panel content (the root checks it too). */
export const NESTED_TRIGGER_WARNING_KEY = 'Drawer.Trigger:nested';

/** The text of the {@link NESTED_TRIGGER_WARNING_KEY} warning. */
export const NESTED_TRIGGER_WARNING =
  'Drawer.Trigger must be a direct child of Drawer (a Fragment is fine). Inside another element or a component it is rendered as panel content, which exists only while the drawer is open, so it cannot open the drawer. Make it a direct child, put wrappers such as a Tooltip inside the trigger, or control the Drawer with `open`/`onOpenChange` and open it from your own button.';

/**
 * Opens the drawer. Place it directly inside `Drawer`, or in a Fragment there (not inside a wrapper
 * element or a component of your own): it renders in place, not in the panel; a misplaced one warns
 * in development. A Drawer may have several triggers: focus returns to the one that opened it. Puts
 * `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), a click handler and a
 * ref on its single child, or passes them to a render-prop child. A custom child component must
 * forward `ref` and spread its props; one that does not is wrapped in a `<span>` automatically
 * (with a development warning), the span that `asChild={false}` renders. Focus returns to the
 * trigger when the drawer closes. On the span, the state ARIA goes to the first element in the tab
 * order inside it, and focus returns to that element (to the span when you made it the trigger
 * with a `role` such as `button` and `tabIndex={0}`, or when nothing inside it can take focus).
 *
 * A Tooltip (or any other wrapper) goes inside the trigger, not around it. Use a render-prop child
 * so the trigger props land on the button and the Tooltip describes that same button:
 *
 * @example
 * <Drawer title="Filters">
 *   <Drawer.Trigger>
 *     {(triggerProps) => (
 *       <Tooltip content="Narrow the list">
 *         <Button {...triggerProps}>Filters</Button>
 *       </Tooltip>
 *     )}
 *   </Drawer.Trigger>
 *   <FilterForm />
 * </Drawer>
 */
export const DrawerTrigger = (props: DrawerTriggerProps) => {
  const { open, requestOpen, trigger, panelId, inPanel } = useDrawerContext('Drawer.Trigger');

  // Rendered inside its own drawer's panel (e.g. by a component): it only exists while open.
  React.useEffect(() => {
    if (inPanel) warnOnce(NESTED_TRIGGER_WARNING_KEY, NESTED_TRIGGER_WARNING);
  }, [inPanel]);

  return useModalTriggerPart<DrawerTriggerRenderProps>(
    { open, requestOpen, trigger, controlsId: panelId },
    props,
    'Drawer.Trigger',
  );
};
DrawerTrigger.displayName = 'DrawerTrigger';

/**
 * Closes the drawer: composes a click handler onto its single child (its own `onClick` runs first;
 * calling `preventDefault()` there keeps the drawer open), or passes it to a render-prop child.
 */
export const DrawerClose = (props: DrawerCloseProps) => {
  const { requestOpen } = useDrawerContext('Drawer.Close');
  return useModalClosePart<DrawerCloseRenderProps>(requestOpen, props, 'Drawer.Close');
};
DrawerClose.displayName = 'DrawerClose';

/**
 * A heading that names the drawer (`aria-labelledby`), for rich titles or custom layouts. Render it
 * inside the Drawer's content (instead of the `title` prop).
 */
export const DrawerTitle = ({ id, className, children, ref, ...rest }: DrawerTitleProps) => {
  const { id: titleId, ref: titleRef } = useModalTitle('Drawer.Title', 'Drawer', id, ref);
  return (
    <h2
      {...rest}
      id={titleId}
      ref={titleRef}
      className={cn(
        drawerTitleClassNames.root,
        'text-subtitle-1 font-semibold text-foreground',
        className,
      )}
    >
      {children}
    </h2>
  );
};
DrawerTitle.displayName = 'DrawerTitle';
