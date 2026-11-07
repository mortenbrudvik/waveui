import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { wcn } from '../../lib/cn';
import {
  avatarGroupClassNames,
  avatarGroupItemClassNames,
  avatarGroupPopoverClassNames,
} from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { getTabbableElements } from '../../lib/focus';
import { popupMotion } from '../../lib/motion';
import { isInsideLayerTree } from '../../lib/layers';
import { lockPositionStyle, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { focusRing } from '../../lib/styles';
import type { MotionSlot, OpenChangeDetails } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { DismissLayerContext, useDismiss, type DismissReason } from '../../hooks/useDismiss';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFocusBeforeClose } from '../../hooks/useFocusBeforeClose';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useMotionClasses } from '../../hooks/useMotion';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { usePresence } from '../../hooks/usePresence';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { Portal } from '../portal/Portal';
import { Avatar } from './Avatar';
import type { AvatarProps } from './Avatar';
import { avatarSizeClassesFor, type AvatarSize } from './Avatar.sizes';
import { AvatarGroupContext } from './AvatarGroup.context';

/** Why the popup of an AvatarGroup opens or closes: its trigger, or a dismissal. */
export type AvatarGroupOpenChangeDetails = OpenChangeDetails<DismissReason | 'trigger'>;

/** Default text listed for a hidden member that would render with no accessible name. */
export const DEFAULT_UNNAMED_MEMBER_LABEL = 'Unnamed member';

const nonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** Set by the popup around its list: an Item renders as a row (avatar and name) there. */
const OverflowContext = React.createContext<{ unnamedMemberLabel: string } | null>(null);
OverflowContext.displayName = 'AvatarGroupOverflowContext';

/**
 * What the group's structural parts lock unset (module-only): the wrapper of each member, the
 * pie, and the popup's list and its items. A role, a tab stop, a roving container's marker (which
 * would take a member out of the arrow-key order of a toolbar around the group) and the hidden
 * state, since they hold the members, which may be links.
 */
export const AVATAR_GROUP_PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'data-roving-container': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/** What the name part of an item's row locks unset: a role, a name of its own, the hidden state. */
const NAME_PART_LOCKS = {
  role: undefined,
  'aria-label': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/** Properties for the AvatarGroup.Item sub-component: the props of an Avatar, and its own parts. */
export interface AvatarGroupItemProps extends Omit<AvatarProps, 'slotProps'> {
  /**
   * Props for the element the item draws in the overflow list, by part, merged into the part's
   * own: your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref attached. Every attribute the item sets on the part is
   * locked. A part takes no `children`. These are the item's parts, not its avatar's: the item
   * passes none of them to the `Avatar` it renders, so its avatar takes no `visual` part (in the
   * group, the item's other props, its `className` and `style` included, still reach that
   * avatar).
   */
  slotProps?: {
    /**
     * The name text of the item's row in the overflow list (stable class
     * `wave-avatar-group-item__name`), the member's name there (the avatar beside it is
     * decorative). Locked, unset: `role`, `aria-label` (which would replace the text) and
     * `hidden`, `inert` and `aria-hidden`.
     */
    name?: SlotPart<'span'>;
  };
}

const AvatarGroupItemImpl = ({ className, slotProps, ...props }: AvatarGroupItemProps) => {
  const overflow = React.useContext(OverflowContext);
  if (!overflow) {
    return <Avatar {...props} className={wcn(avatarGroupItemClassNames.root, className)} />;
  }
  const { name, 'aria-label': ariaLabel, size, ref, ...avatarProps } = props;
  const text = [ariaLabel, name].find(nonBlank)?.trim() ?? overflow.unnamedMemberLabel;
  const namePart = slotProps?.name;
  return (
    <span
      className={wcn(
        avatarGroupItemClassNames.root,
        'wave:inline-flex wave:items-center wave:gap-2',
        className,
      )}
    >
      <Avatar {...avatarProps} name={name} size={size ?? 'small'} decorative />
      <span
        className={avatarGroupItemClassNames.name}
        {...(namePart &&
          mergeSlotProps(namePart, {
            className: avatarGroupItemClassNames.name,
            locked: NAME_PART_LOCKS,
          }))}
      >
        {text}
      </span>
    </span>
  );
};
AvatarGroupItemImpl.displayName = 'AvatarGroupItem';
/**
 * A member of an AvatarGroup. In the group it renders as an `Avatar`; in the overflow list of the
 * popup it renders as a row with the avatar and the name. It takes the props of an `Avatar`, but
 * its `slotProps` reach the name of that row: its avatar takes no `visual` part.
 */
export const AvatarGroupItem = AvatarGroupItemImpl;

/**
 * The text name of a member for the overflow list: the text of a text member, or the accessible
 * name of an `Avatar` or Item given by its props (`aria-label` before `name`). An `Avatar`
 * labelled by `aria-labelledby` (unless `decorative`) and every other element have none: they are
 * rendered as they are, so a link keeps working and keeps its own label.
 */
export function getMemberName(member: React.ReactNode): string | undefined {
  if (typeof member === 'string' || typeof member === 'number') {
    return String(member).trim() || undefined;
  }
  if (
    !isElementOfType<AvatarProps>(member, Avatar) &&
    !isElementOfType<AvatarProps>(member, AvatarGroupItem)
  ) {
    return undefined;
  }
  const { decorative, name, 'aria-label': label, 'aria-labelledby': labelledBy } = member.props;
  if (!decorative && nonBlank(labelledBy)) return undefined;
  for (const value of [label, name]) {
    if (nonBlank(value)) return value.trim();
  }
  return undefined;
}

/**
 * Whether a member without a {@link getMemberName} name would render with no accessible name,
 * so its list item would be empty for assistive technology: blank text, or an `Avatar` that is
 * neither labelled by `aria-labelledby` nor named by its image's `alt` (or is `decorative`).
 * Other elements are rendered as they are, since their content is unknown here.
 */
export function rendersUnnamed(member: React.ReactNode): boolean {
  if (typeof member === 'string' || typeof member === 'number') return true;
  if (!isElementOfType<AvatarProps>(member, Avatar)) return false;
  const { decorative, image, 'aria-labelledby': labelledBy } = member.props;
  if (decorative) return true;
  if (nonBlank(labelledBy)) return false;
  const imageProps: unknown = React.isValidElement(image) ? image.props : image;
  const alt =
    typeof imageProps === 'object' && imageProps !== null && 'alt' in imageProps
      ? imageProps.alt
      : undefined;
  return !nonBlank(alt);
}

/** The shown count of the overflow button: capped at `99+`. */
function countText(count: number): string {
  return count > 99 ? '99+' : `+${count}`;
}

/** Properties for the AvatarGroup.Popover sub-component. */
export interface AvatarGroupPopoverProps {
  /** The overflow members: `AvatarGroup.Item`s, `Avatar`s, text or other elements. */
  children?: React.ReactNode;
  /**
   * What the overflow button shows: the number of hidden members (`+3`, capped at `99+`), or an
   * icon.
   * @default 'count'
   */
  indicator?: 'count' | 'icon';
  /** The number of hidden members. @default the number of `children` */
  count?: number;
  /**
   * Accessible name of the overflow button and its popup. A function receives the number of hidden
   * members.
   * @default (count) => `${count} more`
   */
  label?: string | ((count: number) => string);
  /**
   * Text listed in the overflow popup for a hidden member that has no accessible name.
   * @default 'Unnamed member'
   */
  unnamedMemberLabel?: string;
  /** Whether the popup is open (controlled). */
  open?: boolean;
  /**
   * Whether the popup starts open (uncontrolled).
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called when the popup asks to open or close, with the reason (`trigger`, `escape`, …) and the
   * event in `details`, which WaveUI always passes.
   */
  onOpenChange?: (open: boolean, details: AvatarGroupOpenChangeDetails) => void;
  /**
   * The popup's motion (an `AvatarGroup`'s `motion` when this has none). By default it fades in and slides 4px away from the overflow
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
  /** Extra classes for the overflow button. */
  className?: string;
  /** Ref to the overflow `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

const MoreIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="3" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="13" cy="8" r="1.5" />
  </svg>
);

const AvatarGroupPopoverImpl = ({
  children,
  indicator = 'count',
  count,
  label: labelProp,
  unnamedMemberLabel = DEFAULT_UNNAMED_MEMBER_LABEL,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  motion: motionProp,
  className,
  ref,
}: AvatarGroupPopoverProps) => {
  const group = React.useContext(AvatarGroupContext);
  const items = flattenChildren(children);
  const overflow = count ?? items.length;
  const size: AvatarSize = group?.size ?? 'medium';
  const label =
    typeof labelProp === 'function' ? labelProp(overflow) : (labelProp ?? `${overflow} more`);

  const popupId = useId('avatar-group-overflow');
  const [openState, setOpenState] = useControllable(openProp, defaultOpen);
  // Nothing is hidden any more: the popup is closed, and does not reappear when members overflow
  // again unless asked.
  const isOpen = openState && overflow > 0;
  const requestOpen = (
    next: boolean,
    reason: AvatarGroupOpenChangeDetails['reason'],
    event: Event,
  ) => {
    if (next === isOpen) return;
    setOpenState(next);
    onOpenChange?.(next, { reason, event });
  };

  // The layer the group is rendered in (a dialog or popover), if any: the popup's parent layer.
  const parentLayerId = React.useContext(DismissLayerContext);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);

  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open: isOpen,
    side: 'bottom',
    align: 'start',
  });
  const { layerId } = useDismiss({
    open: isOpen,
    onDismiss: (reason, event) => requestOpen(false, reason, event),
    refs: [triggerRef, surfaceRef],
    anchorRef: triggerRef,
    focusOutside: true,
  });
  useRestoreFocus({ enabled: isOpen, container: surface, triggerRef, onlyIfFocusInside: true });
  // The popup mounts and unmounts through the presence core; the layer, the position and the
  // focus return key on `isOpen`, so focus leaves the popup in the closing commit, to the button,
  // while the exiting popup stays mounted, inert.
  const { isMounted, ref: presenceRef, presenceProps } = usePresence(isOpen, { appear: true });
  const motionClassName = useMotionClasses(
    motionProp !== undefined ? motionProp : group?.motion,
    popupMotion,
  );
  useFocusBeforeClose({
    open: isOpen,
    surfaceRef,
    captureOpener: () => triggerRef.current,
    candidates: () => [triggerRef.current],
  });
  const triggerRefs = useMergedRefs<HTMLButtonElement>(triggerRef, setReference, ref);
  // A surface part's ref beside the popup's own, so an inline one never detaches them.
  const surfaceRefs = useMergedRefs<HTMLDivElement>(
    surfaceRef,
    setFloating,
    setSurface,
    group?.surface?.ref,
    presenceRef,
  );

  // Move focus into the popup once it is mounted, so its list is read next.
  React.useEffect(() => {
    if (isOpen && surface) surface.focus({ preventScroll: true });
  }, [isOpen, surface]);

  // The popup is portaled, so native tabbing would leave it for the end of the page. Tab moves
  // through the popup's own tab stops (a rendered member can be a link); leaving the last one
  // closes the popup and moves on from the button instead (Shift+Tab before the first one: back to
  // the button), like a focus trap does for a popup anchored in a dialog. When nothing tabbable
  // follows the button, Tab is not prevented: focus returns to the button as the popup closes and
  // the browser (leaving the page) or an enclosing focus trap (wrapping) takes it from there.
  // Inside a parent layer (a dialog, a popover), a tab stop after the button that lies outside that
  // layer is treated the same way: a focus trap that leaves the page outside it interactive would
  // pull focus back from there, while its descendant-layer rule (§2.4) wraps from the button.
  // Tab stops are computed at keydown time, never cached (§2.2 focus utilities). A key that
  // bubbles through React from a portal a member opened is not the popup's: it is ignored. Stable,
  // since a surface part merges it during render.
  const handleSurfaceKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const trigger = triggerRef.current;
    if (event.key !== 'Tab' || event.defaultPrevented || !trigger) return;
    const popup = event.currentTarget;
    // Duck typed (`nodeType`), not `instanceof Node`: a popup portaled into another document (an
    // iframe, a popout window) holds nodes of that realm.
    const origin = event.target as Partial<Node> | null;
    if (!origin || typeof origin.nodeType !== 'number' || !popup.contains(origin as Node)) return;
    const inner = getTabbableElements(popup);
    // -1 while focus is on the popup itself (or on something that is not a tab stop).
    const current = inner.findIndex((el) => el.contains(origin as Node));
    const next = current + (event.shiftKey ? -1 : 1);
    if (next >= 0 && next < inner.length) {
      event.preventDefault();
      inner[next]!.focus();
      return;
    }
    let target: HTMLElement | undefined = trigger;
    if (!event.shiftKey) {
      const order = getTabbableElements(trigger.ownerDocument.body).filter(
        (el) => !popup.contains(el),
      );
      const index = order.indexOf(trigger);
      target = index === -1 ? trigger : order[index + 1];
      if (target && parentLayerId !== null && !isInsideLayerTree(parentLayerId, target)) {
        target = undefined;
      }
    }
    requestOpen(false, 'escape', event.nativeEvent);
    if (!target) return;
    event.preventDefault();
    target.focus();
  });

  const hasUnnamedMember =
    isOpen &&
    items.some(({ node }) =>
      isElementOfType<AvatarProps>(node, AvatarGroupItem)
        ? getMemberName(node) === undefined
        : getMemberName(node) === undefined && rendersUnnamed(node),
    );
  React.useEffect(() => {
    if (hasUnnamedMember) {
      warnOnce(
        'AvatarGroup:unnamed-member',
        `AvatarGroup: a hidden member has no accessible name and is listed as "${unnamedMemberLabel}". Give each member a \`name\` or \`aria-label\`.`,
      );
    }
  }, [hasUnnamedMember, unnamedMemberLabel]);

  const overflowContext = React.useMemo(() => ({ unnamedMemberLabel }), [unnamedMemberLabel]);

  // The popup's parts, declared by the group (`slotProps`), each merged only when given.
  const surfaceClassName = wcn(
    avatarGroupClassNames.surface,
    'wave:min-w-32 wave:max-w-xs wave:rounded-md wave:border wave:border-border wave:bg-background wave:p-2 wave:text-body-1 wave:text-foreground wave:shadow-16',
    focusRing,
    motionClassName,
  );
  const surfaceProps =
    isMounted && group?.surface
      ? mergeSlotProps(group.surface, {
          className: surfaceClassName,
          locked: {
            id: popupId,
            role: 'dialog',
            'aria-label': label,
            'aria-modal': undefined,
            tabIndex: -1,
            'data-state': isOpen ? 'open' : 'closed',
            // The presence phase, and `inert` while the popup exits (a part cannot pretend otherwise).
            'data-presence': presenceProps['data-presence'],
            'data-side': floatingProps['data-side'],
            'data-align': floatingProps['data-align'],
            hidden: undefined,
            inert: presenceProps.inert,
            'aria-hidden': undefined,
            onKeyDown: handleSurfaceKeyDown,
          },
        })
      : undefined;
  const listClassName = wcn(
    avatarGroupClassNames.list,
    'wave:m-0 wave:flex wave:list-none wave:flex-col wave:gap-1 wave:p-0',
  );
  const listItemPart = group?.listItem;

  return (
    <>
      <button
        ref={triggerRefs}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popupId : undefined}
        className={wcn(
          avatarGroupClassNames.overflowButton,
          avatarGroupPopoverClassNames.root,
          'wave:inline-flex wave:shrink-0 wave:cursor-pointer wave:items-center wave:justify-center wave:rounded-full wave:border-0 wave:p-0 wave:font-semibold',
          'wave:bg-muted wave:text-muted-foreground wave:ring-2 wave:ring-background',
          'wave:not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
          focusRing,
          group?.layout === 'stack' && group.hasInlineItems && 'wave:-ms-2',
          avatarSizeClassesFor(size),
          className,
        )}
        onClick={(event) => requestOpen(!isOpen, 'trigger', event.nativeEvent)}
      >
        {indicator === 'icon' ? <MoreIcon /> : countText(overflow)}
      </button>
      {isMounted && (
        <Portal layerId={layerId}>
          <div
            id={popupId}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            data-state={isOpen ? 'open' : 'closed'}
            {...presenceProps}
            {...floatingProps}
            className={surfaceClassName}
            onKeyDown={handleSurfaceKeyDown}
            {...surfaceProps}
            // The position wins over a part's style.
            style={lockPositionStyle(surfaceProps?.style, floatingProps.style)}
            ref={surfaceRefs}
          >
            <OverflowContext.Provider value={overflowContext}>
              <ul
                className={listClassName}
                {...(group?.list &&
                  mergeSlotProps(group.list, {
                    className: listClassName,
                    locked: AVATAR_GROUP_PART_LOCKS,
                  }))}
              >
                {items.map(({ key, node }) => {
                  const listItemClassName = wcn(
                    avatarGroupClassNames.listItem,
                    'wave:px-1 wave:py-0.5',
                  );
                  return (
                    <li
                      key={key}
                      className={listItemClassName}
                      {...(listItemPart &&
                        mergeSlotProps(listItemPart, {
                          className: listItemClassName,
                          locked: AVATAR_GROUP_PART_LOCKS,
                        }))}
                    >
                      {isElementOfType<AvatarProps>(node, AvatarGroupItem)
                        ? node
                        : (getMemberName(node) ??
                          (rendersUnnamed(node) ? unnamedMemberLabel : node))}
                    </li>
                  );
                })}
              </ul>
            </OverflowContext.Provider>
          </div>
        </Portal>
      )}
    </>
  );
};
AvatarGroupPopoverImpl.displayName = 'AvatarGroupPopover';
/**
 * The overflow of an AvatarGroup, written by hand: a "+N" button that opens a popup listing its
 * children (`AvatarGroup.Item`s, `Avatar`s, text or other elements). Write it as a child of the
 * group to replace the overflow that `max` makes; its `count`, `indicator`, `label`, `open` and
 * `onOpenChange` take over what `max` would have derived. Tab leaves the popup from the button.
 * Its popup, the popup's list and the list's items take the group's `slotProps.surface`, `list`
 * and `listItem`, as the built-in overflow's do; the button takes this component's own props.
 */
export const AvatarGroupPopover = AvatarGroupPopoverImpl;
