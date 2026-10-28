/**
 * The cases of the `Motion` stories: each animated part's motion prop (`motion`, `backdropMotion`,
 * `expandIconMotion`, `indeterminateMotion`) left unset, `null`, and a replacement.
 *
 * - **Unset** (`undefined`): the part's default motion, which `WaveProvider motion="none"` turns
 *   off.
 * - **`null`**: no motion. The part still renders its `data-presence` phases, which end at once.
 * - **A replacement** (a class string or `{ className }`): your classes instead of the default
 *   ones, also under `motion="none"`. Write them as the default motion does: the enter's start as
 *   `data-[presence=entering]:starting:…`, the exit as `data-[presence=exiting]:…`, and a
 *   `motion-reduce:` counterpart. On the precompiled stylesheet only Wave's own classes exist, so
 *   there a replacement names a class of your own CSS.
 *
 * Each story file defines its replacement next to its story, so the class string shows in the
 * story's source.
 *
 * @example
 * {motionCases(fadeAndZoom).map(({ label, motion }) => (
 *   <Popover key={label}>
 *     <Popover.Trigger>
 *       <Button>{label}</Button>
 *     </Popover.Trigger>
 *     <Popover.Content motion={motion}>…</Popover.Content>
 *   </Popover>
 * ))}
 */
import type { MotionSlot } from '../src';

/** One case of a `Motion` story. */
export interface MotionCase {
  /** Names the case: the label of its trigger, or its heading. */
  label: string;
  /** The value of the part's motion prop. */
  motion: MotionSlot | null | undefined;
}

/**
 * The default motion, no motion and `replacement`, in that order.
 *
 * @param replacement - The story's own classes for the part.
 */
export function motionCases(replacement: MotionSlot): readonly MotionCase[] {
  return [
    { label: 'Default motion', motion: undefined },
    { label: 'No motion', motion: null },
    { label: 'Custom motion', motion: replacement },
  ];
}
