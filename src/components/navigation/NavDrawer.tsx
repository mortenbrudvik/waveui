import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  drawerClassNames,
  navDrawerBodyClassNames,
  navDrawerClassNames,
  navDrawerFooterClassNames,
  navDrawerHeaderClassNames,
} from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { hasWarned, isDev, reportMissingContext, warnOnce } from '../../lib/dev';
import type { Slot, SlotObject } from '../../lib/slot';
import type { BackdropAppearance, FocusMode, ModalType, MotionSlot } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { TOOLBAR_ITEM_SELECTOR } from '../button/Toolbar.navigation';
import {
  inertModalTrigger,
  useModalOpenState,
  useModalTriggerSession,
} from '../overlays/Dialog.shared';
import type {
  DrawerOpenChangeDetails,
  DrawerPosition,
  DrawerSize,
  DrawerType,
} from '../overlays/Drawer.context';
import { DrawerPanel, useDrawerOpen } from '../overlays/Drawer.panel';
import { scrollSeparatorClasses, useScrollState } from '../overlays/Drawer.scroll';
import {
  NavContext,
  NavRovingContext,
  useNavListChildCheck,
  type NavRovingContextValue,
} from './Nav.context';
import { useNavRootState, type NavProps } from './Nav.root';
import {
  NavDrawerContext,
  NavDrawerLayoutContext,
  type NavDrawerContextValue,
  type NavDrawerLayoutContextValue,
} from './NavDrawer.context';

/*
 * NavDrawer: Nav's state (`useNavRootState`) and a navigation landmark in the drawer panel shell
 * (`DrawerPanel`), with its Header, Body and Footer parts. Imports the Nav root and context modules
 * (never `Nav.tsx`) and the shell's modules (never Drawer's root or compound); Nav never imports
 * it, and `Hamburger.tsx` reads only `NavDrawer.context.ts`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Properties for the NavDrawer component. */
export interface NavDrawerProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'>,
    Pick<
      NavProps,
      | 'value'
      | 'defaultValue'
      | 'onValueChange'
      | 'openCategories'
      | 'defaultOpenCategories'
      | 'onOpenCategoriesChange'
      | 'currentCategory'
    > {
  /**
   * How the drawer sits on the page (Fluent's `type`).
   * - `overlay`: a panel over the page, rendered in a portal while open (in the browser only: an
   *   open overlay is closed in the server HTML and opens once hydrated). Modal by default: focus
   *   moves in and stays there, the rest of the page is `inert` and does not scroll, and Escape
   *   and a backdrop press close it. It is a dialog with the navigation's name.
   * - `inline`: a panel in the page layout, rendered where the NavDrawer is (also in the server
   *   HTML). The page stays usable around it; Escape and presses outside do nothing; opening it
   *   moves no focus, and closing it while focus is inside returns focus to `finalFocusRef`, else
   *   to the element that opened it.
   *
   * Changing `type` remounts the panel; the selection and the open categories are kept. Rendered
   * as `data-type`.
   * @default 'overlay'
   */
  type?: DrawerType;
  /** Controlled open state. */
  open?: boolean;
  /**
   * Open state for uncontrolled usage. Keep the drawer controlled instead: a closed uncontrolled
   * NavDrawer cannot be opened again (a Hamburger inside it is not shown while it is closed).
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called with the new open state when it changes, with `details.reason`: `trigger` (a Hamburger
   * inside the drawer), `escape` and `outside-press` (the backdrop; overlay only). `details` is
   * typed optional until 1.0. A controlled drawer stays as it is until you update `open`.
   */
  onOpenChange?: (open: boolean, details?: DrawerOpenChangeDetails) => void;
  /**
   * Called with an item's value every time an item is activated, also when the current page is
   * activated again (a disabled item, a link opened in another tab or window, and a button item
   * whose `onClick` calls `preventDefault()` are not activations). Close an overlay drawer here:
   * `onValueChange` fires only when the value changes. Fluent's `onNavItemSelect`.
   */
  onItemSelect?: (value: string) => void;
  /**
   * The edge the panel is attached to: an overlay's screen edge; an inline panel's inner edge is
   * the opposite one. `start`/`end` follow the text direction; `left`/`right` are physical sides;
   * `bottom` runs along the bottom edge. Unlike Drawer's (`'end'`), the default is the start edge,
   * where navigation sits (Fluent's). Rendered as `data-position`.
   * @default 'start'
   */
  position?: DrawerPosition;
  /**
   * The panel's width at a side (its height at the bottom), on Drawer's scale: `small` 320px,
   * `medium` 592px, `large` 940px, `full` the viewport (inline: the container). A width class in
   * `className` replaces it (Fluent's navigation pane is 260px wide: the width class of 65
   * spacing steps). It also times an overlay's motion: 250 ms small, 300 ms medium, 400 ms large,
   * 500 ms full (see `motion`), so a drawer without `size` takes 250 ms whatever width a class
   * gives it. Rendered as `data-size`. Drawer's default too.
   * @default 'small'
   */
  size?: DrawerSize;
  /**
   * Inline drawers: draws a line on the panel's inner edge (`data-separator`), as Nav does
   * (Drawer's `separator` defaults to `false`). An overlay always draws that edge; forced colours
   * always draw it.
   * @default true
   */
  separator?: boolean;
  /**
   * Overlay drawers: `modal` (backdrop, focus trapped, page inert and not scrolling) or
   * `non-modal` (no backdrop, no trap, nothing inert; Escape closes it while focus is inside, and
   * its Tab place follows the element that opened it). A non-modal overlay covers the page under
   * it while the page keeps its Tab order: keep the page's controls clear of it (reserve its width,
   * or its height at the bottom, in your layout while it is open) or use `type="inline"`; with
   * `size="full"` it hides the whole page and warns. Ignored by inline drawers. Rendered as
   * `data-modal-type` on an overlay's panel. Fluent's `modalType` (without `alert`: a navigation
   * pane is never an alert, so an `'alert'` is treated as `'modal'`). Drawer's default too.
   * @default 'modal'
   */
  modalType?: Extract<ModalType, 'modal' | 'non-modal'>;
  /**
   * Removes the panel when the drawer closes, once its exit motion has ended. `false` keeps it
   * mounted while closed, out of view and `inert`, so the state of what is inside survives, and a
   * Hamburger outside can point `aria-controls` at it at all times: always for an inline drawer,
   * and once the page has hydrated for an overlay (whose panel is not in the server HTML).
   * Fluent's `unmountOnClose`. Drawer's default too.
   * @default true
   */
  unmountOnClose?: boolean;
  /**
   * Where focus goes when the drawer closes with focus inside it (a modal overlay: whenever it
   * closes). Pass your page's Hamburger, so a Hamburger inside the drawer that closes it hands
   * focus to the one that opens it again.
   */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * The backdrop of a modal overlay (Drawer's `backdrop` slot: `null` renders none, a slot
   * object's `appearance` picks the fill). Ignored, with a development warning, by a non-modal or
   * inline drawer.
   */
  backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
  /**
   * Overlay drawers: the panel's motion, as Drawer's. By default the panel slides in from beyond
   * its edge and fades in with a decelerating curve, and slides back out and fades out with an
   * accelerating curve, over a duration that follows `size` both ways: 250 ms small (also without
   * `size`), 300 ms medium, 400 ms large, 500 ms full. The `start` and `end` edges follow the text
   * direction, `left` and `right` do not mirror, and a `bottom` panel rises from below. Under
   * reduced motion it appears and disappears at once. `null` turns the motion off (the panel still
   * renders its `data-presence` phases, which then end at once); a class string or
   * `{ className }` replaces the default classes with yours (see `MotionSlot`), also under a
   * `WaveProvider` with `motion="none"`, which otherwise turns the default off. A `className` that
   * holds `data-[presence=…]` classes while `motion` is unset keeps 0.14's behaviour: no default
   * motion, your classes animate the panel. Fluent's `OverlayDrawer` `surfaceMotion`.
   * @default the slide and fade above
   */
  motion?: MotionSlot | null;
  /**
   * The backdrop's motion (a modal overlay), as Drawer's. By default it fades in and out with a
   * linear curve over the panel's duration (250 to 500 ms, by `size`), so it ends with the panel;
   * under reduced motion it appears and disappears at once. `null` turns the motion off; a class
   * string or `{ className }` replaces the default classes with yours (see `MotionSlot`), also
   * under a `WaveProvider` with `motion="none"`, which otherwise turns the default off. The
   * panel's motion decides when the drawer unmounts or hides: a replacement longer than the
   * panel's exit is cut off there. Ignored, with a development warning, by a non-modal or inline
   * drawer. Fluent's `OverlayDrawer` `backdropMotion`.
   * @default the fade above
   */
  backdropMotion?: MotionSlot | null;
  /**
   * Name of the navigation landmark (and of an overlay's dialog). Localize it; rename it when the
   * page has another navigation landmark (two with one name are ambiguous). An `aria-labelledby`
   * replaces the default.
   * @default 'Navigation'
   */
  'aria-label'?: string;
  /** `NavDrawer.Header`, `NavDrawer.Body` and `NavDrawer.Footer`, rendered in the order written. */
  children?: React.ReactNode;
  /** Ref to the panel: the `role="dialog"` element of an overlay drawer, the panel element of an inline one. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the NavDrawerHeader sub-component. */
export interface NavDrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A Hamburger, the app's name, …: any content (Nav items go in the body or the footer). */
  children?: React.ReactNode;
  /** Ref to the header element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the NavDrawerBody sub-component. */
export interface NavDrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * How the keyboard reaches the items. `'tab'`: every item is a Tab stop and the arrow keys do
   * nothing (Nav's model). `'arrow'`: the body is one Tab stop, the last focused element (at first
   * the current page, or the closed category that holds it, else the first item); Down and Right
   * move to the next element and Up and Left to the previous one (Left and Right swap in a
   * right-to-left layout), wrapping, and Home and End go to the ends. Every focusable element in
   * the body joins the order, item actions included. Screen readers do not announce arrow keys in
   * a navigation landmark: prefer `'tab'` unless your users expect an app pane. Rendered as
   * `data-focus-mode`. Fluent's NavDrawer uses arrow keys by default (its `tabbable` adds Tab
   * stops).
   * @default 'tab'
   */
  focusMode?: FocusMode;
  /** Nav parts: `Nav.Item`, `Nav.Category`, `Nav.SectionHeader`, … (each renders its own list item). */
  children?: React.ReactNode;
  /** Ref to the scrolling body element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the NavDrawerFooter sub-component. */
export interface NavDrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nav parts pinned below the body (Settings, Help); wrap other content in an `<li>`. */
  children?: React.ReactNode;
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

// ---------------------------------------------------------------------------
// Development checks
// ---------------------------------------------------------------------------

const UNREACHABLE_WARNING_KEY = 'NavDrawer:unreachable';
const UNREACHABLE_WARNING =
  'NavDrawer is closed and nothing can open it: it is uncontrolled (no `open` prop), and a Hamburger inside it cannot be reached while it is closed. Control it with `open` and `onOpenChange`, and open it from a Hamburger (or any button) outside it.';

const LOOSE_ITEMS_WARNING_KEY = 'NavDrawer:loose-items';
const LOOSE_ITEMS_WARNING =
  'NavDrawer: a list item sits outside NavDrawer.Body and NavDrawer.Footer, the parts that render a list. Move Nav.Item, Nav.Category and the other Nav parts into NavDrawer.Body or NavDrawer.Footer.';

/** Whether `nav` holds an `<li>` whose parent is not a `<ul>` or `<ol>`. */
function hasLooseListItem(nav: HTMLElement): boolean {
  for (const item of Array.from(nav.querySelectorAll('li'))) {
    const parent = item.parentElement?.localName;
    if (parent !== 'ul' && parent !== 'ol') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/** The scroll state and body registry the parts read outside a NavDrawer in production. */
const INERT_LAYOUT: NavDrawerLayoutContextValue = {
  scrollState: 'none',
  registerBody: () => () => {},
};

/** C-CONTEXT: the enclosing NavDrawer's layout for the part `componentName`. */
function useNavDrawerLayout(componentName: string): NavDrawerLayoutContextValue {
  const context = React.useContext(NavDrawerLayoutContext);
  if (context) return context;
  reportMissingContext(componentName, 'NavDrawer');
  return INERT_LAYOUT;
}

// The root of `NavDrawer` (documented on the export below).
const NavDrawerRoot = ({
  type = 'overlay',
  open: openProp,
  defaultOpen,
  onOpenChange,
  onItemSelect,
  position = 'start',
  size = 'small',
  separator = true,
  modalType: modalTypeProp = 'modal',
  unmountOnClose = true,
  finalFocusRef,
  backdrop,
  motion,
  backdropMotion,
  value,
  defaultValue,
  onValueChange,
  openCategories,
  defaultOpenCategories,
  onOpenCategoriesChange,
  currentCategory,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  id,
  children,
  ref,
  ...rest
}: NavDrawerProps) => {
  const [openState, requestOpen] = useModalOpenState(openProp, defaultOpen, onOpenChange);
  // An overlay reports itself closed until the page has hydrated (its portal renders only in the
  // browser), so a Hamburger's aria-controls never names a panel that is not there.
  const open = useDrawerOpen(type, openState);
  const navState = useNavRootState({
    componentName: 'NavDrawer',
    value,
    defaultValue: defaultValue ?? '',
    onValueChange,
    onActivate: onItemSelect,
    openCategories,
    defaultOpenCategories,
    onOpenCategoriesChange,
    currentCategory,
    children,
  });
  // A navigation pane is never an alert: an 'alert' passed at run time is a modal one.
  const modalType: ModalType = modalTypeProp === 'non-modal' ? 'non-modal' : 'modal';
  const generatedId = useId('wave-nav-drawer');
  const panelId = id ?? generatedId;

  // The first mounted body, measured for the scroll-state separators of the parts.
  const [body, setBody] = React.useState<HTMLElement | null>(null);
  const registerBody = React.useCallback((element: HTMLElement) => {
    setBody((previous) => previous ?? element);
    return () => setBody((previous) => (previous === element ? null : previous));
  }, []);
  const scrollState = useScrollState(body);
  const layout = React.useMemo<NavDrawerLayoutContextValue>(
    () => ({ scrollState, registerBody }),
    [scrollState, registerBody],
  );
  const drawer = React.useMemo<NavDrawerContextValue>(
    () => ({ open, requestOpen, panelId, type }),
    [open, requestOpen, panelId, type],
  );

  // An uncontrolled drawer that is closed has no way back: its Hamburgers are inside it.
  const unreachable = openProp === undefined && !openState;
  React.useEffect(() => {
    if (unreachable) warnOnce(UNREACHABLE_WARNING_KEY, UNREACHABLE_WARNING);
  }, [unreachable]);

  // Development only: after every commit, a list item outside the Body's and Footer's lists.
  const navRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!isDev || hasWarned(LOOSE_ITEMS_WARNING_KEY)) return;
    const nav = navRef.current;
    if (nav && hasLooseListItem(nav)) warnOnce(LOOSE_ITEMS_WARNING_KEY, LOOSE_ITEMS_WARNING);
  });

  // The name goes to the <nav> in both types and, in an overlay, also to its dialog panel. An
  // aria-labelledby without aria-label drops the default.
  const nameProps = {
    'aria-label': ariaLabel ?? (ariaLabelledBy === undefined ? 'Navigation' : undefined),
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
  };
  const panelNameProps = type === 'overlay' ? nameProps : undefined;

  const panel = (
    <DrawerPanel
      componentName="NavDrawer"
      type={type}
      open={open}
      requestOpen={requestOpen}
      position={position}
      size={size}
      separator={separator}
      modalType={modalType}
      unmountOnClose={unmountOnClose}
      inlineAs="div"
      trigger={inertModalTrigger}
      finalFocusRef={finalFocusRef}
      rootClassName={cn(drawerClassNames.root, navDrawerClassNames.root)}
      backdropClassName={cn(drawerClassNames.backdrop, navDrawerClassNames.backdrop)}
      backdrop={backdrop}
      motion={motion}
      backdropMotion={backdropMotion}
      id={panelId}
      {...panelNameProps}
      {...rest}
      ref={ref as React.Ref<HTMLElement> | undefined}
    >
      <nav
        ref={navRef}
        {...nameProps}
        className={cn(navDrawerClassNames.nav, 'flex min-h-0 flex-1 flex-col')}
      >
        {children}
      </nav>
    </DrawerPanel>
  );
  // After the shell's effects (focus restore), as the shell's contract asks.
  useModalTriggerSession(inertModalTrigger, open);

  return (
    <NavContext.Provider value={navState}>
      <NavDrawerContext.Provider value={drawer}>
        <NavDrawerLayoutContext.Provider value={layout}>{panel}</NavDrawerLayoutContext.Provider>
      </NavDrawerContext.Provider>
    </NavContext.Provider>
  );
};
NavDrawerRoot.displayName = 'NavDrawer';

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/**
 * The header row of a NavDrawer: a Hamburger, the app's name, … (no list: Nav items go in the
 * body or the footer). Its line underneath shows while the body is scrolled away from its top.
 */
export const NavDrawerHeader = ({ className, children, ref, ...rest }: NavDrawerHeaderProps) => {
  const { scrollState } = useNavDrawerLayout('NavDrawer.Header');
  return (
    <div
      data-scroll-state={scrollState}
      {...rest}
      ref={ref}
      className={cn(
        navDrawerHeaderClassNames.root,
        'flex shrink-0 items-center gap-2 ps-2.5 pe-2 py-2',
        scrollSeparatorClasses.header,
        className,
      )}
    >
      {children}
    </div>
  );
};
NavDrawerHeader.displayName = 'NavDrawerHeader';

/**
 * The scrolling list of a NavDrawer: the Nav parts (`Nav.Item`, `Nav.Category`, …) as the items of
 * its list. With `focusMode="arrow"` it is one Tab stop and the arrow keys move through it.
 */
export const NavDrawerBody = ({
  focusMode = 'tab',
  className,
  onKeyDown,
  onFocus,
  children,
  ref,
  ...rest
}: NavDrawerBodyProps) => {
  const { scrollState, registerBody } = useNavDrawerLayout('NavDrawer.Body');
  const nav = React.useContext(NavContext);
  const arrow = focusMode === 'arrow';

  // The closed category that holds the current page, reported by the categories of an arrow body
  // from their layout effects: it holds the first Tab stop while the current page is hidden.
  const [currentCategory, setCurrentCategory] = React.useState<string | null>(null);
  const reportCurrentCategory = React.useCallback((category: string, holdsCurrent: boolean) => {
    setCurrentCategory((previous) =>
      holdsCurrent ? category : previous === category ? null : previous,
    );
  }, []);
  const roving = React.useMemo<NavRovingContextValue>(
    () => ({ reportCurrentCategory }),
    [reportCurrentCategory],
  );
  const selected = nav?.value ?? '';
  const activeValue =
    currentCategory !== null ? `wave-nav-category:${currentCategory}` : selected || null;
  // Always called (C-HOOKS); the container attaches only in the arrow mode, and detaching it hands
  // every element its own tabindex back.
  const { containerProps } = useRovingTabIndex({
    itemSelector: TOOLBAR_ITEM_SELECTOR,
    manageTabIndex: true,
    tabStop: 'last-focused',
    orientation: 'both',
    loop: true,
    homeEndKeys: true,
    typeahead: false,
    activeValue,
  });

  const attachBody = React.useCallback(
    (element: HTMLDivElement | null) => (element ? registerBody(element) : undefined),
    [registerBody],
  );
  const mergedRef = useMergedRefs<HTMLDivElement>(
    ref,
    attachBody,
    arrow ? containerProps.ref : null,
  );
  // Development only: every child of the list is an <li> (`NavDrawer.Body:list-child`).
  const listRef = React.useRef<HTMLUListElement>(null);
  useNavListChildCheck(listRef, 'NavDrawer.Body', 'items');

  return (
    <div
      data-focus-mode={focusMode}
      data-scroll-state={scrollState}
      {...rest}
      ref={mergedRef}
      data-roving-container={arrow ? '' : undefined}
      onKeyDown={composeEventHandlers(onKeyDown, arrow ? containerProps.onKeyDown : undefined)}
      onFocus={composeEventHandlers(onFocus, arrow ? containerProps.onFocus : undefined, {
        checkDefaultPrevented: false,
      })}
      className={cn(navDrawerBodyClassNames.root, 'min-h-0 flex-1 overflow-y-auto py-2', className)}
    >
      <NavRovingContext.Provider value={arrow ? roving : null}>
        <ul ref={listRef} className={cn(navDrawerBodyClassNames.list, 'm-0 list-none p-0')}>
          {children}
        </ul>
      </NavRovingContext.Provider>
    </div>
  );
};
NavDrawerBody.displayName = 'NavDrawerBody';

/**
 * The list pinned below a NavDrawer's body (Settings, Help): Nav parts as the items of its list,
 * each a Tab stop. Its line above shows while more of the body is below.
 */
export const NavDrawerFooter = ({ className, children, ref, ...rest }: NavDrawerFooterProps) => {
  const { scrollState } = useNavDrawerLayout('NavDrawer.Footer');
  // Development only: every child of the list is an <li> (`NavDrawer.Footer:list-child`).
  const listRef = React.useRef<HTMLUListElement>(null);
  useNavListChildCheck(listRef, 'NavDrawer.Footer', 'items');
  return (
    <div
      data-scroll-state={scrollState}
      {...rest}
      ref={ref}
      className={cn(
        navDrawerFooterClassNames.root,
        'shrink-0 py-2',
        scrollSeparatorClasses.footer,
        className,
      )}
    >
      <ul ref={listRef} className={cn(navDrawerFooterClassNames.list, 'm-0 list-none p-0')}>
        {children}
      </ul>
    </div>
  );
};
NavDrawerFooter.displayName = 'NavDrawerFooter';

// ---------------------------------------------------------------------------
// Compound
// ---------------------------------------------------------------------------

/**
 * A navigation pane in a drawer: Nav's items, categories and selection in a `<nav>` landmark that
 * sits over the page (`type="overlay"`) or in the page layout (`type="inline"`). Fluent's
 * `NavDrawer`.
 *
 * - **Composition:** `NavDrawer.Header` (a row: a `Hamburger`, the app's name), `NavDrawer.Body`
 *   (the scrolling list) and `NavDrawer.Footer` (a list pinned below it), rendered in the order
 *   written. Nav parts (`Nav.Item`, `Nav.Category`, `Nav.SectionHeader`, `Nav.Divider`,
 *   `Nav.AppItem`, …) go in the Body and the Footer, which render the lists; wrap anything else
 *   there in an `<li>`.
 * - **Types:** `overlay` (default) is a panel over the page, in a portal, opened in the browser
 *   only; `inline` is a panel in the page layout, also in the server HTML. Changing `type`
 *   remounts the panel; the selection and the open categories are kept.
 * - **Opening and closing:** keep it controlled (`open`, `onOpenChange`): an uncontrolled drawer
 *   that is closed cannot open again. A `Hamburger` inside it toggles it (reason `trigger`);
 *   Escape and a backdrop press close an overlay (`escape`, `outside-press`). Closing an overlay
 *   when an item is chosen is yours, in `onItemSelect`, which also fires when the current page is
 *   activated again. A non-modal overlay (`modalType="non-modal"`) covers the page, which keeps
 *   its Tab order: keep the page's controls clear of it, or use `type="inline"`.
 * - **Motion:** an overlay slides in from its edge and fades in, and slides back and fades out,
 *   over 250 ms (`small`, the default), 300 ms (`medium`), 400 ms (`large`) or 500 ms (`full`),
 *   with its backdrop fading along; one open by default animates in when it mounts in the browser.
 *   Under reduced motion both appear and disappear at once. `motion` and `backdropMotion` turn
 *   each off (`null`) or replace it, and `WaveProvider motion="none"` turns both defaults off.
 *   While it exits the panel stays on screen, `inert`, and focus, the trap and the scroll lock
 *   are already released. An inline drawer has no default motion.
 * - **Focus:** pass your page's Hamburger as `finalFocusRef`, so focus returns to it when a
 *   Hamburger inside the drawer closes it. An overlay moves focus in when it opens; an inline
 *   drawer does not.
 * - **Keyboard:** every item is a Tab stop; `NavDrawer.Body focusMode="arrow"` makes the body one
 *   Tab stop with arrow keys, Home and End.
 * - **Landmark:** one `<nav>`, named "Navigation" by default (`aria-label`, `aria-labelledby`);
 *   an overlay is also a dialog with that name. Rename it when the page has another navigation
 *   landmark.
 * - **Selection:** Nav's `value`/`onValueChange` (only on a change), `openCategories` and
 *   `currentCategory`, and `onItemSelect` on every activation (Fluent's `selectedValue` and
 *   `onNavItemSelect`).
 * - **Server Components:** the parts are also exported as `NavDrawerHeader`, `NavDrawerBody` and
 *   `NavDrawerFooter`.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * const hamburgerRef = useRef<HTMLButtonElement>(null);
 * <Hamburger
 *   ref={hamburgerRef}
 *   aria-expanded={open}
 *   aria-controls={open ? 'main-nav' : undefined}
 *   aria-haspopup="dialog"
 *   onClick={() => setOpen(!open)}
 * />
 * <NavDrawer
 *   id="main-nav"
 *   open={open}
 *   onOpenChange={setOpen}
 *   onItemSelect={() => setOpen(false)}
 *   finalFocusRef={hamburgerRef}
 *   defaultValue="home"
 * >
 *   <NavDrawer.Header>
 *     <Hamburger />
 *     Contoso HR
 *   </NavDrawer.Header>
 *   <NavDrawer.Body>
 *     <Nav.Item value="home" href="/">Home</Nav.Item>
 *   </NavDrawer.Body>
 * </NavDrawer>
 */
export const NavDrawer = /* @__PURE__ */ Object.assign(NavDrawerRoot, {
  Header: NavDrawerHeader,
  Body: NavDrawerBody,
  Footer: NavDrawerFooter,
});
