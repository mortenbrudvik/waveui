import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  drawerBodyClassNames,
  drawerClassNames,
  drawerFooterClassNames,
  drawerHeaderClassNames,
  drawerHeaderNavigationClassNames,
  drawerHeaderTitleClassNames,
  drawerTitleClassNames,
} from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { materialiseSlotContent, renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import { focusRingInset } from '../../lib/styles';
import type { HeadingLevel } from '../../lib/types';
import {
  useModalClosePart,
  useModalTitle,
  useModalTriggerPart,
  type ModalRequestOpen,
} from './Dialog.shared';
import { ModalCloseButton } from './Dialog.slots';
import {
  DrawerHeaderContext,
  DrawerPartContext,
  DrawerScrollStateContext,
  useDrawerContext,
} from './Drawer.context';
import { scrollSeparatorClasses } from './Drawer.scroll';

/*
 * The Drawer's parts. Imports the context and scroll modules only (never the root or
 * `Drawer.tsx`).
 */

/** Props a `Drawer.Trigger` puts on its element (and passes to a render-prop child). */
export interface DrawerTriggerRenderProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * `'dialog'` for an overlay drawer; absent (no key) for an inline drawer, which is not a popup.
   */
  'aria-haspopup'?: 'dialog';
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
   * The element that opens and closes the drawer. A single element receives the trigger props
   * (merged with its own); a function receives them.
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
  /**
   * Level of the heading element (`h1` … `h6`). Fluent's `heading` slot, which also takes another
   * element.
   * @default 2
   */
  headingLevel?: HeadingLevel;
  /** Ref to the heading element. */
  ref?: React.Ref<HTMLHeadingElement>;
}

/** Properties for the DrawerHeader sub-component. */
export interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `Drawer.HeaderNavigation`, `Drawer.HeaderTitle`, or any content, in the order written. */
  children?: React.ReactNode;
  /** Ref to the header element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DrawerHeaderTitle sub-component. */
export interface DrawerHeaderTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The title; any content. The heading names the drawer (`aria-labelledby`). */
  children: React.ReactNode;
  /**
   * Content between the heading and the built-in Close button, such as icon buttons for the
   * drawer's own commands (Fluent's `action`). It comes before the Close button in DOM and Tab
   * order and is interactive (not `aria-hidden`): name icon-only buttons. Renders nothing when it
   * renders no content.
   */
  action?: Slot<'span'>;
  /** Id of the heading element, the element that names the drawer. @default a generated id */
  id?: string;
  /**
   * Level of the heading element (`h1` … `h6`). Fluent's `heading` slot, which also takes another
   * element.
   * @default 2
   */
  headingLevel?: HeadingLevel;
  /** Ref to the title row (the heading's parent). */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DrawerHeaderNavigation sub-component. */
export interface DrawerHeaderNavigationProps extends React.HTMLAttributes<HTMLElement> {
  /** The navigation controls: a Back button, a Toolbar of commands. */
  children?: React.ReactNode;
  /** Ref to the `<nav>` element. */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the DrawerBody sub-component. */
export interface DrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content of the scrolling body, rendered in the Body's place among the other content. */
  children?: React.ReactNode;
  /** Ref to the scrolling body element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DrawerFooter sub-component. */
export interface DrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The drawer's actions, typically buttons (wrap closing ones in `Drawer.Close`). */
  children?: React.ReactNode;
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The warning key of a `Drawer.Trigger` that renders as panel content (the root checks it too). */
export const NESTED_TRIGGER_WARNING_KEY = 'Drawer.Trigger:nested';

/** The text of the {@link NESTED_TRIGGER_WARNING_KEY} warning. */
export const NESTED_TRIGGER_WARNING =
  'Drawer.Trigger must be a direct child of Drawer (a Fragment is fine). Inside another element or a component it is rendered as panel content, which is not rendered (or, with `unmountOnClose={false}`, is hidden) while the drawer is closed, so it cannot open the drawer. Make it a direct child, put wrappers such as a Tooltip inside the trigger, or control the Drawer with `open`/`onOpenChange` and open it from your own button.';

/**
 * Opens and closes the drawer: a click while it is open asks it to close (reason `trigger`), which
 * only the trigger of a non-modal or inline drawer can receive (a modal one makes the page inert).
 * Place it directly inside `Drawer`, or in a Fragment there (not inside a wrapper element or a
 * component of your own): it renders in place, not in the panel (an inline drawer's triggers
 * render right before its panel, so the panel follows its button in the reading order); a
 * misplaced one warns in development. A Drawer may have several triggers: focus returns to the one
 * that opened it. Puts `aria-haspopup="dialog"` (none on an inline drawer's trigger: an inline
 * panel is page content, not a popup), `aria-expanded`, `aria-controls` (while open), a click
 * handler and a ref on its single child, or passes them to a render-prop child. A custom child
 * component must forward `ref` and spread its props; one that does not is wrapped in a `<span>`
 * automatically (with a development warning), the span that `asChild={false}` renders. Focus
 * returns to the trigger when the drawer closes (for a non-modal or inline drawer, only when focus
 * was inside it). On the span, the state ARIA goes to the first element in the tab order inside
 * it, and focus returns to that element (to the span when you made it the trigger with a `role`
 * such as `button` and `tabIndex={0}`, or when nothing inside it can take focus).
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
  const { open, requestOpen, trigger, panelId, type, inPanel } = useDrawerContext('Drawer.Trigger');

  // Rendered inside its own drawer's panel (e.g. by a component): not rendered (or, kept mounted,
  // hidden) while the drawer is closed.
  React.useEffect(() => {
    if (inPanel) warnOnce(NESTED_TRIGGER_WARNING_KEY, NESTED_TRIGGER_WARNING);
  }, [inPanel]);

  return useModalTriggerPart<DrawerTriggerRenderProps>(
    {
      open,
      requestOpen,
      trigger,
      controlsId: panelId,
      popup: type === 'inline' ? false : 'dialog',
    },
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
 * inside the Drawer's content (instead of the `title` prop); for the title of a composed header,
 * use `Drawer.HeaderTitle` in a `Drawer.Header`. `headingLevel` picks the heading element (`h2`
 * by default).
 */
export const DrawerTitle = ({
  id,
  headingLevel = 2,
  className,
  children,
  ref,
  ...rest
}: DrawerTitleProps) => {
  const { id: titleId, ref: titleRef } = useModalTitle('Drawer.Title', 'Drawer', id, ref);
  const Heading: `h${HeadingLevel}` = `h${headingLevel}`;
  return (
    <Heading
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
    </Heading>
  );
};
DrawerTitle.displayName = 'DrawerTitle';

/** Properties of the internal {@link DrawerCloseButton}. */
export interface DrawerCloseButtonProps {
  /** The Drawer's request function: the button asks it to close, reason `close-button`. */
  requestOpen: ModalRequestOpen;
  /** The button's accessible name (the Drawer's `closeLabel`). */
  label: string;
  /** The Drawer's `closeButton` slot: the button's content, or `null` to render none. */
  closeButton: Slot<'span'> | undefined;
  /** Placement classes, after the button's own (`drawerClassNames.closeButton`). */
  className?: string;
}

/**
 * The Drawer's built-in Close button (internal): the Wave `Button`, subtle and small, with the
 * dismiss glyph or the Drawer's `closeButton` content (the slot rules of `Dialog.Content`'s
 * `closeButton`), named by the Drawer's `closeLabel`. The built-in header and every
 * `Drawer.HeaderTitle` in a `Drawer.Header` render it; it carries `drawerClassNames.closeButton`.
 * Renders nothing for `closeButton={null}`.
 */
export const DrawerCloseButton = ({
  requestOpen,
  label,
  closeButton,
  className,
}: DrawerCloseButtonProps) => (
  <ModalCloseButton
    componentName="Drawer"
    closeButton={closeButton}
    closeLabel={label}
    onClose={(event) => requestOpen(false, { reason: 'close-button', event })}
    className={cn(drawerClassNames.closeButton, className)}
  />
);
DrawerCloseButton.displayName = 'DrawerCloseButton';

/** The warning key of a `Drawer.Header` that the Drawer's scan did not place. */
const HEADER_UNSCANNED_WARNING_KEY = 'Drawer.Header:unscanned';
const HEADER_UNSCANNED_WARNING =
  'Drawer.Header is not a direct child of Drawer, so it renders inside the body instead of replacing the header. Make it a direct child (a Fragment there is fine).';

/** The warning key of a `Drawer.Body` that the Drawer's scan did not place. */
const BODY_UNSCANNED_WARNING_KEY = 'Drawer.Body:unscanned';
const BODY_UNSCANNED_WARNING =
  'Drawer.Body is not a direct child of Drawer, so its props do not reach the scrolling body and it renders as an element inside it. Make it a direct child (a Fragment there is fine).';

/** The warning key of a `Drawer.Footer` that the Drawer's scan did not place. */
const FOOTER_UNSCANNED_WARNING_KEY = 'Drawer.Footer:unscanned';
const FOOTER_UNSCANNED_WARNING =
  'Drawer.Footer is not a direct child of Drawer, so it renders inside the scrolling body instead of below it. Make it a direct child (a Fragment there is fine); a submit button in it can name a form in the body with the `form` attribute.';

/** The warning key of a `Drawer.HeaderTitle` outside a `Drawer.Header`. */
const HEADER_TITLE_OUTSIDE_WARNING_KEY = 'Drawer.HeaderTitle:outside-header';
const HEADER_TITLE_OUTSIDE_WARNING =
  'Drawer.HeaderTitle is not inside a Drawer.Header, so it renders in the body without the Close button. Put it in a Drawer.Header, or use Drawer.Title for a heading in the body.';

/** Whether the Drawer's scan placed the part that reads this (a direct child of the Drawer). */
function usePlaced(): boolean {
  return React.useContext(DrawerPartContext) === 'placed';
}

/** Warns once, from an effect, while `condition` holds. */
function useWarnWhen(condition: boolean, key: string, message: string): void {
  React.useEffect(() => {
    if (condition) warnOnce(key, message);
  }, [condition, key, message]);
}

/**
 * The drawer's header, replacing the built-in one (the `title` and Close button row): a
 * `Drawer.HeaderNavigation` row and a `Drawer.HeaderTitle`, or your own content. The built-in
 * Close button ends each `Drawer.HeaderTitle`; a header without one has no Close button (wrap your
 * own in `Drawer.Close`). Make it a direct child of `Drawer` (a Fragment there is fine); nested in
 * an element or rendered by a component of yours it renders in the body, with a development
 * warning. It draws a line under itself while the body is scrolled away from its top
 * (`data-scroll-state`). When an overlay drawer opens, focus goes to the header's first focusable
 * element (a Back button, a title action): give the control that should start `autoFocus`. A
 * header whose children render nothing renders no element (the drawer then has no header; Escape
 * and the backdrop of an overlay, and `Drawer.Close`, still close it). Fluent's `DrawerHeader`.
 */
export const DrawerHeader = ({ className, children, ref, ...rest }: DrawerHeaderProps) => {
  useDrawerContext('Drawer.Header');
  const placed = usePlaced();
  const scrollState = React.useContext(DrawerScrollStateContext) ?? 'none';
  useWarnWhen(!placed, HEADER_UNSCANNED_WARNING_KEY, HEADER_UNSCANNED_WARNING);
  if (!slotRendersContent(children)) return null;
  return (
    <div
      data-scroll-state={scrollState}
      {...rest}
      ref={ref}
      className={cn(
        drawerHeaderClassNames.root,
        'flex shrink-0 flex-col gap-2 p-4',
        scrollSeparatorClasses.header,
        className,
      )}
    >
      <DrawerHeaderContext.Provider value={true}>
        <DrawerPartContext.Provider value="content">
          {materialiseSlotContent(children)}
        </DrawerPartContext.Provider>
      </DrawerHeaderContext.Provider>
    </div>
  );
};
DrawerHeader.displayName = 'DrawerHeader';

/**
 * A title row for `Drawer.Header`: the heading that names the drawer, your `action` content and
 * the built-in Close button (named by the Drawer's `closeLabel`; the Drawer's `closeButton` sets
 * its content, or hides it with `null`), in that DOM and Tab order.
 * Render one per header; `headingLevel` picks the heading element (`h2` by default). Outside a
 * `Drawer.Header` it renders without the Close button and warns: use `Drawer.Title` for a heading
 * in the body. Unlike Fluent's `DrawerHeaderTitle`, whose `action` is where you put a close
 * button, it renders the Close button itself.
 */
export const DrawerHeaderTitle = ({
  id,
  headingLevel = 2,
  action,
  className,
  children,
  ref,
  ...rest
}: DrawerHeaderTitleProps) => {
  const { requestOpen, closeLabel, closeButton } = useDrawerContext('Drawer.HeaderTitle');
  const inHeader = React.useContext(DrawerHeaderContext);
  const { id: headingId, ref: headingRef } = useModalTitle(
    'Drawer.HeaderTitle',
    'Drawer',
    id,
    undefined,
  );
  useWarnWhen(!inHeader, HEADER_TITLE_OUTSIDE_WARNING_KEY, HEADER_TITLE_OUTSIDE_WARNING);
  const Heading: `h${HeadingLevel}` = `h${headingLevel}`;
  return (
    <div
      {...rest}
      ref={ref}
      className={cn(drawerHeaderTitleClassNames.root, 'flex items-start gap-2', className)}
    >
      <DrawerPartContext.Provider value="content">
        <Heading
          id={headingId}
          ref={headingRef}
          className={cn(
            drawerHeaderTitleClassNames.heading,
            'min-w-0 flex-1 text-subtitle-1 font-semibold text-foreground',
          )}
        >
          {children}
        </Heading>
        {slotRendersContent(action)
          ? renderSlot(
              action,
              'span',
              cn(drawerHeaderTitleClassNames.action, 'flex min-h-7 shrink-0 items-center gap-1'),
            )
          : null}
        {inHeader && (
          <DrawerCloseButton
            requestOpen={requestOpen}
            label={closeLabel}
            closeButton={closeButton}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
        )}
      </DrawerPartContext.Provider>
    </div>
  );
};
DrawerHeaderTitle.displayName = 'DrawerHeaderTitle';

/**
 * A `<nav>` row at the top of `Drawer.Header`, for a multi-level drawer's Back button and the
 * drawer's commands. Give it an `aria-label` when the page has other navigation landmarks.
 * Fluent's `DrawerHeaderNavigation`.
 */
export const DrawerHeaderNavigation = ({
  className,
  children,
  ref,
  ...rest
}: DrawerHeaderNavigationProps) => {
  useDrawerContext('Drawer.HeaderNavigation');
  return (
    <nav
      {...rest}
      ref={ref}
      className={cn(drawerHeaderNavigationClassNames.root, 'flex items-center gap-1', className)}
    >
      <DrawerPartContext.Provider value="content">{children}</DrawerPartContext.Provider>
    </nav>
  );
};
DrawerHeaderNavigation.displayName = 'DrawerHeaderNavigation';

/**
 * Optional: gives the drawer's scrolling body your props (`className`, `style`, `ref`, `id`,
 * `role`, `tabIndex`, `aria-*`, `data-*`, handlers), for example `tabIndex={0} role="region"
 * aria-label="…"` to let the keyboard scroll a body without focusable content (the body then
 * shows the focus ring inside its edge). Its children render in its place among the drawer's
 * other content. Make it a direct child of `Drawer` (a Fragment there is fine) and render one;
 * nested in an element or rendered by a component of yours it renders as an element inside the
 * body, with a development warning. Fluent's `DrawerBody`.
 */
export const DrawerBody = ({ className, children, ref, ...rest }: DrawerBodyProps) => {
  useDrawerContext('Drawer.Body');
  // The Drawer renders a placed Body's props on its scrolling body and its children in place, so
  // this element renders only for a Body its scan did not place.
  useWarnWhen(true, BODY_UNSCANNED_WARNING_KEY, BODY_UNSCANNED_WARNING);
  return (
    <div {...rest} ref={ref} className={cn(drawerBodyClassNames.root, focusRingInset, className)}>
      <DrawerPartContext.Provider value="content">{children}</DrawerPartContext.Provider>
    </div>
  );
};
DrawerBody.displayName = 'DrawerBody';

/**
 * The drawer's action row, below the scrolling body: it never scrolls and never covers a focused
 * field. Its actions start at the inline start and wrap. Make it a direct child of `Drawer` (a
 * Fragment there is fine): it renders after the body wherever it is written; nested in an element
 * (a `<form>`) or rendered by a component of yours it renders where it is, in the body, with a
 * development warning. For a form in the body, give the footer's submit button `form={formId}`.
 * It draws a line above itself while content continues below (`data-scroll-state`). A footer
 * whose children render nothing renders no element. Fluent's `DrawerFooter`.
 */
export const DrawerFooter = ({ className, children, ref, ...rest }: DrawerFooterProps) => {
  useDrawerContext('Drawer.Footer');
  const placed = usePlaced();
  const scrollState = React.useContext(DrawerScrollStateContext) ?? 'none';
  useWarnWhen(!placed, FOOTER_UNSCANNED_WARNING_KEY, FOOTER_UNSCANNED_WARNING);
  if (!slotRendersContent(children)) return null;
  return (
    <div
      data-scroll-state={scrollState}
      {...rest}
      ref={ref}
      className={cn(
        drawerFooterClassNames.root,
        'flex shrink-0 flex-wrap items-center gap-2 p-4',
        scrollSeparatorClasses.footer,
        className,
      )}
    >
      <DrawerPartContext.Provider value="content">
        {materialiseSlotContent(children)}
      </DrawerPartContext.Provider>
    </div>
  );
};
DrawerFooter.displayName = 'DrawerFooter';
