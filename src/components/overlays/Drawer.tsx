import {
  DrawerBody,
  DrawerClose,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderNavigation,
  DrawerHeaderTitle,
  DrawerTitle,
  DrawerTrigger,
} from './Drawer.parts';
import { DrawerRoot } from './Drawer.root';

export type {
  DrawerPosition,
  DrawerSize,
  DrawerModalType,
  DrawerOpenChangeReason,
  DrawerOpenChangeDetails,
} from './Drawer.context';
export type { DrawerProps } from './Drawer.root';
export type {
  DrawerTriggerProps,
  DrawerTriggerRenderProps,
  DrawerCloseProps,
  DrawerCloseRenderProps,
  DrawerTitleProps,
  DrawerHeaderProps,
  DrawerHeaderTitleProps,
  DrawerHeaderNavigationProps,
  DrawerBodyProps,
  DrawerFooterProps,
} from './Drawer.parts';

/**
 * A panel attached to a side or to the bottom of the screen (Fluent UI v2 style), modal by
 * default, rendered in a portal (inheriting the WaveProvider theme) while open.
 *
 * - **Opening**: controlled (`open`), or uncontrolled with a `Drawer.Trigger` placed directly inside
 *   the Drawer or in a Fragment there (it renders in place, outside the panel); the trigger opens
 *   and closes it.
 * - **Modal**: focus moves into the panel and Tab stays inside it (toasts included), the rest of the
 *   page is `inert` (instead of `aria-modal`), and the page does not scroll. `modalType="alert"`
 *   renders `role="alertdialog"`, and a backdrop press does not close it.
 * - **Non-modal**: `modalType="non-modal"` leaves the page usable (no backdrop, no focus trap,
 *   nothing inert, the page scrolls). Focus moves in on open; Tab and Shift+Tab leave the panel in
 *   the page's order right after the element that opened it; Escape closes it only while focus is
 *   inside it; presses on the page never close it; focus returns to the opener only from inside.
 *   Reserve the panel's room in the page layout while it is open, so it hides no page control.
 * - **Closing**: Escape (only the topmost layer: a popup opened inside closes first), a click on the
 *   backdrop (a drag that starts inside does not close it), the Close button and `Drawer.Close`.
 *   `onOpenChange` gets the reason as its second argument (`details.reason`), so a controlled
 *   drawer can refuse some of them. A backdrop press blurs the focused field before the drawer
 *   closes, so a typed value is committed as with the Close button; when a controlled drawer
 *   refuses the press, the field gets focus back. Focus returns to the first of these that can
 *   take focus: `finalFocusRef`, the element that had focus when the drawer opened, the trigger,
 *   an element next to where that opener was.
 * - **Size and position**: `position` is `end` (default) or `start`, which follow the text
 *   direction, `left` or `right`, or `bottom` (along the bottom edge, the window wide). `size` sets
 *   the width at a side and the height at the bottom: `small` (default, 320px), `medium` (592px),
 *   `large` (940px) or `full`; the panel never grows past the window. A width class in
 *   `className` (a height class for `bottom`) replaces the size. The panel pads the safe-area
 *   insets of the screen edges it touches (the iOS home indicator, once the page sets
 *   `viewport-fit=cover`). Both render as `data-position` and `data-size`.
 * - **Layout**: the `title` prop and the built-in Close button make the header row; a
 *   `Drawer.Header` replaces it, with a `Drawer.HeaderNavigation` row (a Back button, commands)
 *   and a `Drawer.HeaderTitle` (the heading, an `action` area and the Close button). The rest of
 *   the content scrolls in the body (`Drawer.Body` gives it your props); a `Drawer.Footer` is an
 *   action row below the body that never scrolls. Make the parts direct children of the Drawer (a
 *   Fragment there is fine). The header draws a line under itself once the body is scrolled, the
 *   footer one above itself while content continues below: the body, the header and the footer
 *   render the body's scroll state as `data-scroll-state` (`none`, `top`, `middle`, `bottom`).
 * - **Backdrop, Close button and title actions**: the backdrop is the panel's sibling and a slot
 *   (`backdrop`: `null` removes it, `appearance` picks `dimmed` or `transparent`); a modal opened
 *   over another modal dims the page once. `closeButton` sets the content of every built-in Close
 *   button, or hides them (`null`); a button passed there is merged into it. `titleAction` places
 *   header buttons between the `title` heading and the Close button.
 *
 * The sub-components are also exported under flat names (`DrawerTrigger`, `DrawerClose`,
 * `DrawerTitle`, `DrawerHeader`, `DrawerHeaderTitle`, `DrawerHeaderNavigation`, `DrawerBody`,
 * `DrawerFooter`) for React Server Components, which cannot use the dotted form; dotted access
 * (`Drawer.Trigger`) needs a client file.
 *
 * @example
 * <Drawer>
 *   <Drawer.Trigger><Button>Filters</Button></Drawer.Trigger>
 *   <Drawer.Header>
 *     <Drawer.HeaderTitle>Filters</Drawer.HeaderTitle>
 *   </Drawer.Header>
 *   <FilterForm id="filters" />
 *   <Drawer.Footer>
 *     <Button appearance="primary" type="submit" form="filters">Apply</Button>
 *     <Drawer.Close><Button>Cancel</Button></Drawer.Close>
 *   </Drawer.Footer>
 * </Drawer>
 */
export const Drawer = /* @__PURE__ */ Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Close: DrawerClose,
  Title: DrawerTitle,
  Header: DrawerHeader,
  HeaderTitle: DrawerHeaderTitle,
  HeaderNavigation: DrawerHeaderNavigation,
  Body: DrawerBody,
  Footer: DrawerFooter,
});

export {
  DrawerTrigger,
  DrawerClose,
  DrawerTitle,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerHeaderNavigation,
  DrawerBody,
  DrawerFooter,
};
