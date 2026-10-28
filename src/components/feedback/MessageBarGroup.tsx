import * as React from 'react';
import { messageBarGroupClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { getFirstTabbable } from '../../lib/focus';
import {
  messageBarGroupEnterMotion,
  messageBarGroupExitMotion,
  messageBarGroupItemStructure,
} from '../../lib/motion';
import type { MotionSlot } from '../../lib/types';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useMotionClasses } from '../../hooks/useMotion';
import { usePresence } from '../../hooks/usePresence';
import { usePresenceGroup, type PresenceGroupEntry } from '../../hooks/usePresenceGroup';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';

/** Properties for the MessageBarGroup component. */
export interface MessageBarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Which changes animate: `'exit-only'` (a bar removed from the children fades and collapses
   * out) or `'both'` (a bar added after mount also fades and slides in). Bars present at the
   * group's first render never animate. Fluent's `animate`. The root renders it as
   * `data-animate`.
   * @default 'exit-only'
   */
  animate?: 'exit-only' | 'both';
  /**
   * Replaces the bars' motion (both directions); `null` turns it off. The motion is on the element
   * around each bar (`className` stays on the root). By default a removed bar fades out while its
   * row and its bottom margin close over 250 ms with the linear curve, so the bars after it glide
   * up and nothing jumps when it unmounts (the margin makes up for the group's 8px gap); with
   * `animate="both"`, a bar added after mount opens its row and fades in the same way. Under
   * reduced motion bars appear and disappear at once. `null` turns the motion off (the element
   * still renders its `data-presence` phases, which then end at once); a class string or
   * `{ className }` replaces the default classes with yours (see `MotionSlot`), also under a
   * `WaveProvider` with `motion="none"`, which otherwise turns the default off. A WaveUI addition:
   * Fluent's MessageBarGroup has no motion slot (its bar only fades out).
   * @default the collapse and fade above
   */
  motion?: MotionSlot | null;
  /** MessageBar elements, each with a stable `key`. */
  children?: React.ReactNode;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

interface MessageBarGroupItemProps {
  entry: PresenceGroupEntry;
  motionClassName: string;
  onExited: (key: string) => void;
}

/** Whether `el` is the element around a bar that stays: an item that is not exiting. */
function isRemainingItem(el: Element): boolean {
  return (
    el.classList.contains(messageBarGroupClassNames.item) &&
    el.getAttribute('data-presence') !== 'exiting'
  );
}

/**
 * Where focus goes when the bar of `item` leaves with focus inside it: the first tabbable element
 * of the nearest bar after it that stays and holds one, else of the nearest such bar before it.
 */
function nextBarFocus(item: HTMLElement | null): HTMLElement | null {
  if (!item) return null;
  for (let el = item.nextElementSibling; el; el = el.nextElementSibling) {
    const target = isRemainingItem(el) ? getFirstTabbable(el) : null;
    if (target) return target;
  }
  for (let el = item.previousElementSibling; el; el = el.previousElementSibling) {
    const target = isRemainingItem(el) ? getFirstTabbable(el) : null;
    if (target) return target;
  }
  return null;
}

// The element around one bar: the presence element, whose motion ends the bar's phases.
const MessageBarGroupItem = ({ entry, motionClassName, onExited }: MessageBarGroupItemProps) => {
  const { key, element, visible, appear } = entry;
  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const {
    isMounted,
    ref: presenceRef,
    presenceProps,
  } = usePresence(visible, { appear, onExited: () => onExited(key) });
  const itemRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(itemRef, presenceRef);
  // Focus leaves a removed bar in its removing commit: `enabled` flipping to `false` moves it in
  // the layout phase, while the exiting item is still there.
  usePreserveFocus(itemRef, () => nextBarFocus(itemRef.current), { enabled: visible });
  if (!isMounted) return null;
  return (
    <div
      ref={mergedRef}
      {...presenceProps}
      className={cn(messageBarGroupClassNames.item, messageBarGroupItemStructure, motionClassName)}
    >
      {element}
    </div>
  );
};
MessageBarGroupItem.displayName = 'MessageBarGroupItem';

/**
 * A stack of MessageBars that animates the bars it gains and loses, Fluent's MessageBarGroup with
 * its `animate` prop: a bar removed from the children fades out while its row closes, so the bars
 * below glide up instead of jumping (Fluent's bar only fades, and the bars below jump when it is
 * gone), and with `animate="both"` a bar added after mount opens its row and fades in.
 *
 * - **Keys.** Give every bar a stable `key` (`key={message.id}`): the group follows its children
 *   by key, so it can keep a removed bar on screen during its exit, in its place, and move bars
 *   that are reordered without replacing them. A removed bar that comes back during its exit is
 *   shown again. A child without a key of its own, or text, renders after the bars as given,
 *   without motion, with a development warning. Any keyed element animates; MessageBar is the
 *   one the group is made for.
 * - **Motion.** Bars present at the group's first render (on the server too) never animate. Each
 *   bar sits in an element of its own, which renders no box while the bar is shown, so the bars
 *   are the stack's own items; while a bar enters or exits, that element clips it while its row
 *   opens or closes. An exiting bar is `inert`. See `motion` for the default and how to replace
 *   or turn it off; under `prefers-reduced-motion: reduce` a bar is added and removed at once.
 * - **Focus.** When a bar leaves with focus inside it (its Dismiss button was pressed), focus moves
 *   in the same commit to the first tabbable element of the next bar that stays, else of the
 *   previous one. When the last bar leaves, the app decides where focus goes.
 * - **Markup.** A plain `<div>` without a role stacking the bars with an 8px gap; each MessageBar
 *   stays its own live region. MessageBarGroup is a component of its own rather than a part of
 *   MessageBar, so a page that imports only MessageBar does not load the group's motion.
 *
 * @example
 * <MessageBarGroup animate="both">
 *   {messages.map((message) => (
 *     <MessageBar key={message.id} status={message.status} onDismiss={() => dismiss(message.id)}>
 *       {message.text}
 *     </MessageBar>
 *   ))}
 * </MessageBarGroup>
 */
export const MessageBarGroup = ({
  animate = 'exit-only',
  motion,
  children,
  className,
  ref,
  ...rest
}: MessageBarGroupProps) => {
  const { entries, skipped, onExited } = usePresenceGroup(children, {
    appear: animate === 'both',
  });
  // The bars' motion: the exit, and the enter with `animate="both"` (composed at run time).
  const motionClassName = useMotionClasses(
    motion,
    animate === 'both'
      ? `${messageBarGroupExitMotion} ${messageBarGroupEnterMotion}`
      : messageBarGroupExitMotion,
  );
  const hasSkipped = skipped.length > 0;
  React.useEffect(() => {
    if (hasSkipped) {
      warnOnce(
        'MessageBarGroup:children',
        'MessageBarGroup: every child should be an element with a key of its own (a MessageBar with `key={id}`); other children render after the bars, without motion.',
      );
    }
  }, [hasSkipped]);

  return (
    <div
      ref={ref}
      data-animate={animate}
      {...rest}
      className={cn(messageBarGroupClassNames.root, 'flex flex-col gap-2', className)}
    >
      {entries.map((entry) => (
        <MessageBarGroupItem
          key={entry.key}
          entry={entry}
          motionClassName={motionClassName}
          onExited={onExited}
        />
      ))}
      {skipped}
    </div>
  );
};
MessageBarGroup.displayName = 'MessageBarGroup';
