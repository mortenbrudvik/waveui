import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { getTabbableElements } from '../../lib/focus';
import { isInsideLayerTree } from '../../lib/layers';
import { focusRing } from '../../lib/styles';
import type { Size } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { DismissLayerContext, useDismiss } from '../../hooks/useDismiss';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { Portal } from '../portal/Portal';
import { Avatar } from './Avatar';
import type { AvatarProps } from './Avatar';

/** Properties for the AvatarGroup component. */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum number of avatars to display. The others are replaced by an overflow button that
   * lists their names. `0` shows only the overflow button.
   */
  max?: number;
  /** Size of the overflow button (match it to the avatars).
   * @default 'medium'
   */
  size?: Size;
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
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

const overflowSizeMap: Record<Size, string> = {
  'extra-small': 'w-6 h-6 text-[10px]',
  small: 'w-8 h-8 text-xs',
  medium: 'w-10 h-10 text-sm',
  large: 'w-12 h-12 text-base',
  'extra-large': 'w-14 h-14 text-lg',
};

/** Default text listed for a hidden member that would render with no accessible name. */
const DEFAULT_UNNAMED_MEMBER_LABEL = 'Unnamed member';

const nonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/**
 * The text name of a member for the overflow list: the text of a text member, or the accessible
 * name of an `Avatar` given by its props (`aria-label` before `name`). An `Avatar` labelled by
 * `aria-labelledby` (unless `decorative`) and every other element have none: they are rendered as
 * they are, so a link keeps working and keeps its own label.
 */
function getMemberName(member: React.ReactNode): string | undefined {
  if (typeof member === 'string' || typeof member === 'number') {
    return String(member).trim() || undefined;
  }
  if (!React.isValidElement(member) || member.type !== Avatar) return undefined;
  const {
    decorative,
    name,
    'aria-label': label,
    'aria-labelledby': labelledBy,
  } = member.props as AvatarProps;
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
function rendersUnnamed(member: React.ReactNode): boolean {
  if (typeof member === 'string' || typeof member === 'number') return true;
  if (!React.isValidElement(member) || member.type !== Avatar) return false;
  const { decorative, image, 'aria-labelledby': labelledBy } = member.props as AvatarProps;
  if (decorative) return true;
  if (nonBlank(labelledBy)) return false;
  const imageProps: unknown = React.isValidElement(image) ? image.props : image;
  const alt =
    typeof imageProps === 'object' && imageProps !== null && 'alt' in imageProps
      ? imageProps.alt
      : undefined;
  return !nonBlank(alt);
}

/**
 * A row of overlapping avatars (`role="group"`; name it with `aria-label`).
 *
 * With `max`, the avatars beyond the limit are replaced by an overflow `<button>` ("+3", named
 * "3 more", see `overflowLabel`). It toggles a popup that lists the hidden members' names: an
 * `Avatar` by its `aria-label` or `name` prop, text as it is. Other members, such as an `Avatar`
 * inside a link or one labelled by `aria-labelledby`, are rendered as they are, and an `Avatar` or
 * text with no accessible name is listed as `unnamedMemberLabel` with a development warning.
 * Focus moves into the popup; Escape, a press outside or the button close it and focus returns to
 * the button. Tab and Shift+Tab move through the popup's own tab stops (links in rendered
 * members); Tab from the last one closes the popup and moves on to the element after the button,
 * Shift+Tab from the first one closes it and returns to the button. When the button is the last
 * tab stop (of the page, or of the Wave layer the group is in, such as a dialog), Tab is left to
 * the browser or the enclosing focus trap.
 *
 * @example
 * <AvatarGroup aria-label="Project team" max={3}>
 *   <Avatar name="Ada Lovelace" />
 *   <Avatar name="Alan Turing" />
 * </AvatarGroup>
 */
export const AvatarGroup = ({
  max,
  size = 'medium',
  overflowLabel,
  unnamedMemberLabel = DEFAULT_UNNAMED_MEMBER_LABEL,
  className,
  children,
  ref,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: AvatarGroupProps) => {
  const items = React.Children.toArray(children);
  const limit = max === undefined || Number.isNaN(max) ? Infinity : Math.max(0, Math.floor(max));
  const visible = items.slice(0, limit);
  const hidden = items.slice(visible.length);
  const overflow = hidden.length;

  const unnamed = ariaLabel === undefined && ariaLabelledBy === undefined;
  React.useEffect(() => {
    if (unnamed) {
      warnOnce(
        'AvatarGroup:unnamed',
        'AvatarGroup: the group has no accessible name. Pass `aria-label` (or `aria-labelledby`) describing the people it shows.',
      );
    }
  }, [unnamed]);

  const popupId = useId('avatar-group-overflow');
  const [open, setOpen] = React.useState(false);
  // Nothing is hidden any more: close, so the popup does not reappear when members overflow again.
  if (open && overflow === 0) setOpen(false);
  const isOpen = open && overflow > 0;
  const label =
    typeof overflowLabel === 'function'
      ? overflowLabel(overflow)
      : (overflowLabel ?? `${overflow} more`);

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
    onDismiss: () => setOpen(false),
    refs: [triggerRef, surfaceRef],
    anchorRef: triggerRef,
    focusOutside: true,
  });
  useRestoreFocus({ enabled: isOpen, container: surface, triggerRef, onlyIfFocusInside: true });
  const triggerRefs = useMergedRefs<HTMLButtonElement>(triggerRef, setReference);
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
  // Tab stops are computed at keydown time, never cached (§2.2 focus utilities).
  const handleSurfaceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const trigger = triggerRef.current;
    if (event.key !== 'Tab' || event.defaultPrevented || !trigger) return;
    const popup = event.currentTarget;
    const inner = getTabbableElements(popup);
    // -1 while focus is on the popup itself (or on something that is not a tab stop).
    const current = inner.findIndex((el) => el.contains(event.target as Node));
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
    setOpen(false);
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  const hasUnnamedMember =
    isOpen && hidden.some((child) => getMemberName(child) === undefined && rendersUnnamed(child));
  React.useEffect(() => {
    if (hasUnnamedMember) {
      warnOnce(
        'AvatarGroup:unnamed-member',
        `AvatarGroup: a hidden member has no accessible name and is listed as "${unnamedMemberLabel}". Give each member a \`name\` or \`aria-label\`.`,
      );
    }
  }, [hasUnnamedMember, unnamedMemberLabel]);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      {...props}
      className={cn('inline-flex items-center', className)}
    >
      {visible.map((child, i) => (
        <span
          key={React.isValidElement(child) && child.key !== null ? child.key : i}
          className={cn('inline-flex rounded-full ring-2 ring-background', i > 0 && '-ms-2')}
        >
          {child}
        </span>
      ))}
      {overflow > 0 && (
        <button
          ref={triggerRefs}
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? popupId : undefined}
          className={cn(
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 font-semibold',
            'bg-muted text-muted-foreground ring-2 ring-background',
            'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
            focusRing,
            visible.length > 0 && '-ms-2',
            overflowSizeMap[size],
          )}
          onClick={() => setOpen((value) => !value)}
        >
          +{overflow}
        </button>
      )}
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
              'min-w-32 max-w-xs rounded-md border border-border bg-background p-2 text-body-1 text-foreground shadow-16',
              focusRing,
            )}
            onKeyDown={handleSurfaceKeyDown}
          >
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {hidden.map((child, i) => (
                <li
                  key={React.isValidElement(child) && child.key !== null ? child.key : i}
                  className="px-1 py-0.5"
                >
                  {getMemberName(child) ?? (rendersUnnamed(child) ? unnamedMemberLabel : child)}
                </li>
              ))}
            </ul>
          </div>
        </Portal>
      )}
    </div>
  );
};

AvatarGroup.displayName = 'AvatarGroup';
