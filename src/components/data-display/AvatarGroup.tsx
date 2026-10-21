import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { avatarGroupClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { avatarSizeClassesFor, type AvatarSize } from './Avatar.sizes';
import { AvatarGroupContext } from './AvatarGroup.context';
import { partitionAvatarGroupItems, type AvatarGroupLayout } from './AvatarGroup.partition';
import {
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
   * `escape`, `outside-press` or `focus-outside`.
   */
  onOpenChange?: (open: boolean, details?: AvatarGroupOpenChangeDetails) => void;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The clip of each wedge of a pie, by the number of wedges (one wedge is a full circle). Literal strings only. */
const pieWedgeClasses: ReadonlyArray<ReadonlyArray<string>> = [
  [''],
  ['[clip-path:inset(0_50%_0_0)]', '[clip-path:inset(0_0_0_50%)]'],
  [
    '[clip-path:inset(0_50%_0_0)]',
    '[clip-path:inset(0_0_50%_50%)]',
    '[clip-path:inset(50%_0_0_50%)]',
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
  className,
  children,
  ref,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
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
  const groupContext = React.useMemo(
    () => ({ size: resolvedSize, layout, hasInlineItems }),
    [resolvedSize, layout, hasInlineItems],
  );

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
      className={cn(
        avatarGroupClassNames.root,
        'inline-flex items-center',
        layout !== 'stack' && 'gap-1',
        className,
      )}
    >
      <AvatarGroupContext.Provider value={groupContext}>
        {layout === 'pie'
          ? visible.length > 0 && (
              <span
                className={cn(
                  avatarGroupClassNames.pie,
                  'relative inline-block shrink-0 overflow-hidden rounded-full',
                  avatarSizeClassesFor(resolvedSize),
                )}
              >
                {visible.map(({ key, node }, i) => (
                  <span
                    key={key}
                    aria-hidden="true"
                    className={cn(
                      avatarGroupClassNames.item,
                      'absolute inset-0 inline-flex',
                      pieWedgeClasses[visible.length - 1]?.[i],
                    )}
                  >
                    {node}
                  </span>
                ))}
              </span>
            )
          : visible.map(({ key, node }, i) => (
              <span
                key={key}
                className={cn(
                  avatarGroupClassNames.item,
                  'inline-flex rounded-full ring-2 ring-background',
                  layout === 'stack' && i > 0 && '-ms-2',
                )}
              >
                {node}
              </span>
            ))}
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
