import {
  TeachingPopoverBody,
  TeachingPopoverFooter,
  TeachingPopoverHeader,
  TeachingPopoverSurface,
  TeachingPopoverTitle,
  TeachingPopoverTrigger,
} from './TeachingPopover.parts';
import { TeachingPopoverRoot } from './TeachingPopover.root';

export type {
  TeachingPopoverAction,
  TeachingPopoverLabels,
  TeachingPopoverStep,
} from './TeachingPopover.context';
export type { TeachingPopoverProps } from './TeachingPopover.root';
export type {
  TeachingPopoverBodyProps,
  TeachingPopoverFooterProps,
  TeachingPopoverHeaderProps,
  TeachingPopoverSurfaceProps,
  TeachingPopoverTitleOwnProps,
  TeachingPopoverTitleProps,
  TeachingPopoverTriggerChildProps,
  TeachingPopoverTriggerProps,
} from './TeachingPopover.parts';

/**
 * A step-by-step onboarding popover (a non-modal `role="dialog"`) with Back/Next (Done on the
 * last step) and Close.
 *
 * - Visibility is controllable: `open`/`defaultOpen` (default `true`, or `false` with a direct
 *   `TeachingPopover.Trigger`)/`onOpenChange`; Close, Done, Escape (anywhere in the document) and
 *   the Trigger dismiss it and call `onDismiss`.
 * - The step is controllable with `activeStep`/`defaultActiveStep`/`onStepChange` and clamped to
 *   the available steps. The heading carries a visually hidden “step n of m”, the new step is
 *   announced politely, and Back stays focusable (`aria-disabled`) on the first step.
 * - `primaryAction` and `secondaryAction` (on the popover, or on a step, which wins) replace Next/Done
 *   and Back: a label, a Button-like element or a slot object. The consumer's `onClick` runs first,
 *   then the step's normal action unless it called `preventDefault()`. Done calls `onFinish`
 *   (and, in 0.x, `onDismiss`); `footerLayout` stacks the buttons.
 * - The built-in text is English: `labels` localizes Back, Next, Done and the step position, and
 *   `closeLabel` the Close button.
 * - Focus moves to the popover when it opens and returns to the element that had it when it
 *   closes (with `target`, to the target when nothing had focus, e.g. a tour opened on page load).
 * - With `target`, the popover is portaled and positioned next to that element with a beak (it
 *   inherits the surface colors); it stays hidden while the target is `null`, not positioned yet or
 *   no longer mounted (a ref target is read after each render of the popover; see `target`).
 * - With a `VirtualElement` target there is no element to follow: the popover keeps the place of
 *   its portal in the keyboard order.
 * - With an element or ref `target`, the keyboard order treats the popover as if it followed the target: Tab past
 *   its last button continues after the target, Shift+Tab from its first button (or from the
 *   popover itself) returns to the target (for a target outside the Tab order, to the last control
 *   inside it, else to the control before it), Tab from there enters the popover, and Shift+Tab
 *   from the control after the target enters it at its last button. Tab from the last control of
 *   the page moves past the popover (it was visited after the target), and Shift+Tab from outside
 *   the page reaches the page's last control first, so a lap visits it once and Tab never cycles.
 *   With no control at or before the target, the popover is reached where it is portaled, at the
 *   end of the page: Tab from the page's last control and Shift+Tab from outside the page enter
 *   it.
 * - **Parts** (Fluent's composition): `TeachingPopover.Trigger` opens and closes the popover, gets
 *   focus back when it closes and, without a `target`, is what it points at; written directly
 *   inside TeachingPopover (a Fragment is fine), it makes the popover start closed (`defaultOpen`
 *   `false`). `TeachingPopover.Surface` is the surface itself: it takes the `className`, `style`,
 *   `ref` and other element props that the `steps` form takes on TeachingPopover. Inside it,
 *   `TeachingPopover.Header` (the Close button, with an optional caption and `icon`),
 *   `TeachingPopover.Title` (the step title with the hidden step position; it names the popover),
 *   `TeachingPopover.Body` (the step body, after an optional `media`) and
 *   `TeachingPopover.Footer` (the step dots and the buttons) each show their share of the current
 *   step unless given children; a Surface without children shows all four, which is what the
 *   `steps` form renders. Both forms share one state: the steps, the labels, the actions and the
 *   callbacks stay on TeachingPopover. A part outside a TeachingPopover throws in development.
 *
 * The parts are also exported under flat names (`TeachingPopoverTrigger`,
 * `TeachingPopoverSurface`, `TeachingPopoverHeader`, `TeachingPopoverTitle`,
 * `TeachingPopoverBody`, `TeachingPopoverFooter`) for React Server Components, which cannot use
 * the dotted form; dotted access (`TeachingPopover.Trigger`) needs a client file.
 *
 * @example
 * <TeachingPopover steps={steps} onFinish={markTourSeen}>
 *   <TeachingPopover.Trigger>
 *     <Button>Take the tour</Button>
 *   </TeachingPopover.Trigger>
 *   <TeachingPopover.Surface>
 *     <TeachingPopover.Header icon={<LightbulbIcon />}>Tip</TeachingPopover.Header>
 *     <TeachingPopover.Title />
 *     <TeachingPopover.Body media={<img src="/tour/search.png" alt="" />} />
 *     <TeachingPopover.Footer />
 *   </TeachingPopover.Surface>
 * </TeachingPopover>
 */
export const TeachingPopover = /* @__PURE__ */ Object.assign(TeachingPopoverRoot, {
  Trigger: TeachingPopoverTrigger,
  Surface: TeachingPopoverSurface,
  Header: TeachingPopoverHeader,
  Title: TeachingPopoverTitle,
  Body: TeachingPopoverBody,
  Footer: TeachingPopoverFooter,
});

export {
  TeachingPopoverTrigger,
  TeachingPopoverSurface,
  TeachingPopoverHeader,
  TeachingPopoverTitle,
  TeachingPopoverBody,
  TeachingPopoverFooter,
};
