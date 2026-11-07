import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { wcn } from '../../lib/cn';
import { avatarGroupClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import type { MotionSlot } from '../../lib/types';
import { avatarSizeClassesFor, type AvatarSize } from './Avatar.sizes';
import { AvatarGroupContext } from './AvatarGroup.context';
import { partitionAvatarGroupItems, type AvatarGroupLayout } from './AvatarGroup.partition';
import {
  AVATAR_GROUP_PART_LOCKS,
  AvatarGroupItem,
  AvatarGroupPopover,
  DEFAULT_UNNAMED_MEMBER_LABEL,
  type AvatarGroupItemProps,
  type AvatarGroupOpenChangeDetails,
  type AvatarGroupPopoverProps,
} from './AvatarGroup.parts';

export { AvatarGroupItem, AvatarGroupPopover };
export type { AvatarGroupItemProps, AvatarGroupOpenChangeDetails, AvatarGroupPopoverProps };
export type { AvatarGroupLayout };

/** Properties for the AvatarGroup component. */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum number of avatars to display. The others are replaced by an overflow button that
   * lists their names. `0` or a negative value shows only the overflow button, a fraction is
   * rounded down, and `NaN` shows every member (as without `max`). The members of a Fragment
   * count one by one. A `pie` shows at most three.
   */
  max?: number;
  /**
   * Size of the avatars. It reaches the members that set no `size` of their own, and the overflow
   * button.
   * @default 'medium' ('large' in a `pie`)
   */
  size?: AvatarSize;
  /**
   * How the members are laid out: `stack` overlaps them, `spread` puts them side by side, `pie`
   * draws up to three of them as the wedges of one circle (the group's name is then the only name).
   * @default 'stack'
   */
  layout?: AvatarGroupLayout;
  /**
   * What the overflow button shows: the number of hidden members (`+3`, capped at `99+`), or an
   * icon.
   * @default 'count'
   */
  overflowIndicator?: 'count' | 'icon';
  /**
   * Accessible name of the overflow button (and its popup). A function receives the number of
   * hidden members. Localise it here.
   * @default (count) => `${count} more`
   */
  overflowLabel?: string | ((count: number) => string);
  /**
   * Text listed in the overflow popup for a hidden member that has no accessible name (an
   * `Avatar` without `name`, `aria-label`, `aria-labelledby` or image `alt`, or blank text).
   * Localise it here; better still, give every member a name (a development warning asks for it).
   * @default 'Unnamed member'
   */
  unnamedMemberLabel?: string;
  /** Whether the overflow popup is open (controlled). */
  open?: boolean;
  /**
   * Whether the overflow popup starts open (uncontrolled).
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called when the overflow popup asks to open or close, with the reason: `trigger` (the button),
   * `escape`, `outside-press` or `focus-outside`, and the event (`details.event`). WaveUI always
   * passes `details`.
   */
  onOpenChange?: (open: boolean, details: AvatarGroupOpenChangeDetails) => void;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * The overflow popup's motion. By default it fades in and slides 4px away from the overflow
   * button, on the side it opened on, over 200 ms with a decelerating curve, and fades out and
   * slides back over 100 ms with an accelerating curve (focus has moved back to the button by
   * then); under reduced motion it appears and disappears at once. `null` turns the motion off
   * (the popup still renders its `data-presence` phases, which then end at once); a class string
   * or `{ className }` replaces the default classes with yours (see `MotionSlot`), also under a
   * `WaveProvider` with `motion="none"`, which otherwise turns the default off. Fluent's popup
   * `surfaceMotion`.
   * @default the fade and slide above
   */
  motion?: MotionSlot | null;
  /**
   * Props for the elements the group draws, by part, merged into each part's own: your classes
   * after the part's (yours win a conflict), your styles over its styles, your attributes and
   * handlers added (yours run first), your ref attached. Every attribute the group sets on a part
   * is locked. A part takes no `children` (the group draws their content); the members and the
   * overflow button take their own props (an `AvatarGroup.Popover` you write is the button).
   *
   * The wrappers, the pie and the list parts hold the members, which may be links: each locks,
   * unset, `role`, `tabIndex`, the roving container marker `data-roving-container` (it would
   * take a member out of the arrow-key order of a toolbar around the group) and `hidden`, `inert`
   * and `aria-hidden`. The popup's parts reach the built-in overflow and an `AvatarGroup.Popover`
   * you write alike, through the group's context: keep the `surface`, `list` and `listItem`
   * objects stable (a constant or a memoised value) where the members are memoised, since a new
   * object renders every member again.
   */
  slotProps?: {
    /**
     * The wrapper around each shown member (stable class `wave-avatar-group__item`), merged into
     * every one. In a `pie` it is a wedge, which keeps `aria-hidden="true"` (the group's name is
     * the pie's only name).
     */
    item?: SlotPart<'span'>;
    /** The circle of a `pie` around its wedges (stable class `wave-avatar-group__pie`). */
    pie?: SlotPart<'span'>;
    /**
     * The overflow popup (stable class `wave-avatar-group__surface`), rendered in a portal while
     * open. Locked: its `id` (the button's `aria-controls`), `role="dialog"`, `aria-label`, no
     * `aria-modal`, `tabIndex={-1}` (focus moves to it as it opens), `data-state`,
     * `data-presence`, `inert` while it exits, `data-side` and `data-align`, `hidden` and
     * `aria-hidden` unset, and its position, which wins over your style. Its key handler moves Tab through the popup and closes it when Tab leaves:
     * `preventDefault()` in your `onKeyDown` skips that: the popup neither moves focus nor
     * closes, and focus stays where it is unless your handler moves it.
     */
    surface?: SlotPart<'div'>;
    /** The popup's list (stable class `wave-avatar-group__list`). */
    list?: SlotPart<'ul'>;
    /**
     * Each item of the popup's list (stable class `wave-avatar-group__list-item`), merged into
     * every one.
     */
    listItem?: SlotPart<'li'>;
  };
}

/** What a wedge of a pie locks: the group's part locks, and hidden from assistive technology. */
const PIE_ITEM_PART_LOCKS = { ...AVATAR_GROUP_PART_LOCKS, 'aria-hidden': true } as const;

/** The clip of each wedge of a pie, by the number of wedges (one wedge is a full circle). Literal strings only. */
const pieWedgeClasses: ReadonlyArray<ReadonlyArray<string>> = [
  [''],
  ['wave:[clip-path:inset(0_50%_0_0)]', 'wave:[clip-path:inset(0_0_0_50%)]'],
  [
    'wave:[clip-path:inset(0_50%_0_0)]',
    'wave:[clip-path:inset(0_0_50%_50%)]',
    'wave:[clip-path:inset(50%_0_0_50%)]',
  ],
];

const AvatarGroupRoot = ({
  max,
  size,
  layout = 'stack',
  overflowIndicator = 'count',
  overflowLabel,
  unnamedMemberLabel = DEFAULT_UNNAMED_MEMBER_LABEL,
  open,
  defaultOpen,
  onOpenChange,
  motion,
  className,
  children,
  ref,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  slotProps,
  ...props
}: AvatarGroupProps) => {
  // Fragments are flattened, so each member counts, overlaps and is listed on its own (C-COMPOUND).
  // A consumer-written AvatarGroup.Popover is the overflow part, not a member.
  const parts = flattenChildren(children);
  const customPopover = parts.find(({ node }) => isElementOfType(node, AvatarGroupPopover));
  const items = parts.filter(({ node }) => !isElementOfType(node, AvatarGroupPopover));
  const resolvedSize: AvatarSize = size ?? (layout === 'pie' ? 'large' : 'medium');
  const { inlineItems: visible, overflowItems } = partitionAvatarGroupItems({
    items,
    maxInlineItems: max,
    layout,
  });
  const hidden = overflowItems ?? [];
  const hasInlineItems = visible.length > 0;
  // The popup's parts reach AvatarGroup.Popover, built in or yours, through the context.
  const surface = slotProps?.surface;
  const list = slotProps?.list;
  const listItem = slotProps?.listItem;
  const groupContext = React.useMemo(
    () => ({ size: resolvedSize, layout, hasInlineItems, surface, list, listItem, motion }),
    [resolvedSize, layout, hasInlineItems, surface, list, listItem, motion],
  );
  // The wrappers merge a part only when given, so a group without `slotProps` allocates nothing.
  const itemPart = slotProps?.item;
  const piePart = slotProps?.pie;
  const pieClassName =
    layout === 'pie'
      ? wcn(
          avatarGroupClassNames.pie,
          'wave:relative wave:inline-block wave:shrink-0 wave:overflow-hidden wave:rounded-full',
          avatarSizeClassesFor(resolvedSize),
        )
      : undefined;

  const unnamed = ariaLabel === undefined && ariaLabelledBy === undefined;
  React.useEffect(() => {
    if (unnamed) {
      warnOnce(
        'AvatarGroup:unnamed',
        'AvatarGroup: the group has no accessible name. Pass `aria-label` (or `aria-labelledby`) describing the people it shows.',
      );
    }
  }, [unnamed]);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-layout={layout}
      {...props}
      className={wcn(
        avatarGroupClassNames.root,
        'wave:inline-flex wave:items-center',
        layout !== 'stack' && 'wave:gap-1',
        className,
      )}
    >
      <AvatarGroupContext.Provider value={groupContext}>
        {layout === 'pie'
          ? visible.length > 0 && (
              <span
                className={pieClassName}
                {...(piePart &&
                  mergeSlotProps(piePart, {
                    className: pieClassName,
                    locked: AVATAR_GROUP_PART_LOCKS,
                  }))}
              >
                {visible.map(({ key, node }, i) => {
                  const itemClassName = wcn(
                    avatarGroupClassNames.item,
                    'wave:absolute wave:inset-0 wave:inline-flex',
                    pieWedgeClasses[visible.length - 1]?.[i],
                  );
                  return (
                    <span
                      key={key}
                      aria-hidden="true"
                      className={itemClassName}
                      {...(itemPart &&
                        mergeSlotProps(itemPart, {
                          className: itemClassName,
                          locked: PIE_ITEM_PART_LOCKS,
                        }))}
                    >
                      {node}
                    </span>
                  );
                })}
              </span>
            )
          : visible.map(({ key, node }, i) => {
              const itemClassName = wcn(
                avatarGroupClassNames.item,
                'wave:inline-flex wave:rounded-full wave:ring-2 wave:ring-background',
                layout === 'stack' && i > 0 && 'wave:-ms-2',
              );
              return (
                <span
                  key={key}
                  className={itemClassName}
                  {...(itemPart &&
                    mergeSlotProps(itemPart, {
                      className: itemClassName,
                      locked: AVATAR_GROUP_PART_LOCKS,
                    }))}
                >
                  {node}
                </span>
              );
            })}
        {customPopover
          ? customPopover.node
          : hidden.length > 0 && (
              <AvatarGroupPopover
                count={hidden.length}
                indicator={overflowIndicator}
                label={overflowLabel}
                unnamedMemberLabel={unnamedMemberLabel}
                open={open}
                defaultOpen={defaultOpen}
                onOpenChange={onOpenChange}
              >
                {hidden.map(({ key, node }) => (
                  <React.Fragment key={key}>{node}</React.Fragment>
                ))}
              </AvatarGroupPopover>
            )}
      </AvatarGroupContext.Provider>
    </div>
  );
};

AvatarGroupRoot.displayName = 'AvatarGroup';

/**
 * A row of avatars (`role="group"`; name it with `aria-label`), laid out as a `stack` (overlapping),
 * `spread` or `pie` (`layout`). `size` reaches the members.
 *
 * With `max`, the avatars beyond the limit are replaced by an overflow `<button>` ("+3", named
 * "3 more", see `overflowLabel`; `overflowIndicator="icon"` shows an icon, and a count above 99
 * reads "99+"). It toggles a popup that lists the hidden members: an `AvatarGroup.Item` as a row
 * with its avatar and name, an `Avatar` by its `aria-label` or `name` prop, text as it is. Other
 * members, such as an `Avatar` inside a link or one labelled by `aria-labelledby`, are rendered as
 * they are, and an `Avatar` or text with no accessible name is listed as `unnamedMemberLabel` with
 * a development warning. Focus moves into the popup; Escape, a press outside or the button close
 * it and focus returns to the button (`open`, `defaultOpen` and `onOpenChange(open, details)`
 * control it). Tab and Shift+Tab move through the popup's own tab stops (links in rendered
 * members); Tab from the last one closes the popup and moves on to the element after the button,
 * Shift+Tab from the first one closes it and returns to the button. When the button is the last
 * tab stop (of the page, or of the Wave layer the group is in, such as a dialog), Tab is left to
 * the browser or the enclosing focus trap.
 *
 * To split the members yourself, render `AvatarGroup.Item`s and an `AvatarGroup.Popover` holding
 * the overflow items (see `partitionAvatarGroupItems`).
 *
 * @example
 * <AvatarGroup aria-label="Project team" max={3}>
 *   <AvatarGroup.Item name="Ada Lovelace" />
 *   <AvatarGroup.Item name="Alan Turing" />
 * </AvatarGroup>
 */
export const AvatarGroup = /* @__PURE__ */ Object.assign(AvatarGroupRoot, {
  Item: AvatarGroupItem,
  Popover: AvatarGroupPopover,
});
