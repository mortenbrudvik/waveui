import { DrawerClose, DrawerTitle, DrawerTrigger } from './Drawer.parts';
import { DrawerRoot } from './Drawer.root';

export type {
  DrawerPosition,
  DrawerSize,
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
} from './Drawer.parts';

/**
 * A modal panel attached to a side or to the bottom of the screen (Fluent UI v2 style), rendered
 * in a portal (inheriting the WaveProvider theme) while open.
 *
 * - **Opening**: controlled (`open`), or uncontrolled with a `Drawer.Trigger` placed directly inside
 *   the Drawer or in a Fragment there (it renders in place, outside the panel).
 * - **Modal**: focus moves into the panel and Tab stays inside it (toasts included), the rest of the
 *   page is `inert` (instead of `aria-modal`), and the page does not scroll.
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
 *
 * The sub-components are also exported under flat names (`DrawerTrigger`, `DrawerClose`,
 * `DrawerTitle`) for React Server Components, which cannot use the dotted form; dotted access
 * (`Drawer.Trigger`) needs a client file.
 *
 * @example
 * <Drawer title="Filters">
 *   <Drawer.Trigger><Button>Filters</Button></Drawer.Trigger>
 *   <FilterForm />
 *   <Drawer.Close><Button appearance="primary">Apply</Button></Drawer.Close>
 * </Drawer>
 */
export const Drawer = /* @__PURE__ */ Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Close: DrawerClose,
  Title: DrawerTitle,
});

export { DrawerTrigger, DrawerClose, DrawerTitle };
