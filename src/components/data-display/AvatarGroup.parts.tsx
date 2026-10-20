import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import {
  avatarGroupClassNames,
  avatarGroupItemClassNames,
  avatarGroupPopoverClassNames,
} from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { getTabbableElements } from '../../lib/focus';
import { isInsideLayerTree } from '../../lib/layers';
import { focusRing } from '../../lib/styles';
import type { OpenChangeDetails } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { DismissLayerContext, useDismiss, type DismissReason } from '../../hooks/useDismiss';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
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

/** Properties for the AvatarGroup.Item sub-component: the props of an Avatar. */
export type AvatarGroupItemProps = AvatarProps;

/**
 * A member of an AvatarGroup. In the group it renders as an `Avatar`; in the overflow list of the
 * popup it renders as a row with the avatar and the name. It takes the props of an `Avatar`.
 */
const AvatarGroupItemImpl = ({ className, ...props }: AvatarGroupItemProps) => {
  const overflow = React.useContext(OverflowContext);
  if (!overflow) {
    return <Avatar {...props} className={cn(avatarGroupItemClassNames.root, className)} />;
  }
  const { name, 'aria-label': ariaLabel, size, ref, ...avatarProps } = props;
  const text = [ariaLabel, name].find(nonBlank)?.trim() ?? overflow.unnamedMemberLabel;
  return (
    <span
      className={cn(avatarGroupItemClassNames.root, 'inline-flex items-center gap-2', className)}
    >
      <Avatar {...avatarProps} name={name} size={size ?? 'small'} decorative />
      <span className={avatarGroupItemClassNames.name}>{text}</span>
    </span>
  );
};
AvatarGroupItemImpl.displayName = 'AvatarGroupItem';
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
  /** Called when the popup asks to open or close, with the reason (`trigger`, `escape`, …). */
  onOpenChange?: (open: boolean, details?: AvatarGroupOpenChangeDetails) => void;
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
  const triggerRefs = useMergedRefs<HTMLButtonElement>(triggerRef, setReference, ref);
  const surfaceRefs = useMergedRefs<HTMLDivElement>(surfaceRef, setFloating, setSurface);

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
  // bubbles through React from a portal a member opened is not the popup's: it is ignored.
  const handleSurfaceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
  };

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

  return (
    <>
      <button
        ref={triggerRefs}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popupId : undefined}
        className={cn(
          avatarGroupClassNames.overflowButton,
          avatarGroupPopoverClassNames.root,
          'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 font-semibold',
          'bg-muted text-muted-foreground ring-2 ring-background',
          'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
          focusRing,
          group?.layout === 'stack' && group.hasInlineItems && '-ms-2',
          avatarSizeClassesFor(size),
          className,
        )}
        onClick={(event) => requestOpen(!isOpen, 'trigger', event.nativeEvent)}
      >
        {indicator === 'icon' ? <MoreIcon /> : countText(overflow)}
      </button>
      {isOpen && (
        <Portal layerId={layerId}>
          <div
            ref={surfaceRefs}
            id={popupId}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            data-state="open"
            {...floatingProps}
            className={cn(
              avatarGroupClassNames.surface,
              'min-w-32 max-w-xs rounded-md border border-border bg-background p-2 text-body-1 text-foreground shadow-16',
              focusRing,
            )}
            onKeyDown={handleSurfaceKeyDown}
          >
            <OverflowContext.Provider value={overflowContext}>
              <ul
                className={cn(avatarGroupClassNames.list, 'm-0 flex list-none flex-col gap-1 p-0')}
              >
                {items.map(({ key, node }) => (
                  <li key={key} className={cn(avatarGroupClassNames.listItem, 'px-1 py-0.5')}>
                    {isElementOfType<AvatarProps>(node, AvatarGroupItem)
                      ? node
                      : (getMemberName(node) ?? (rendersUnnamed(node) ? unnamedMemberLabel : node))}
                  </li>
                ))}
              </ul>
            </OverflowContext.Provider>
          </div>
        </Portal>
      )}
    </>
  );
};
AvatarGroupPopoverImpl.displayName = 'AvatarGroupPopover';
export const AvatarGroupPopover = AvatarGroupPopoverImpl;
