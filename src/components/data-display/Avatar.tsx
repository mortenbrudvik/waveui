import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { PersonIcon } from '../../lib/icons';
import type { Size, Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';

/** Properties for the Avatar component. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** URL of the avatar image. When it fails to load, the avatar falls back to its icon or initials. */
  src?: string;
  /**
   * Full name of the person. It names the avatar for assistive technology (the image `alt`; in
   * initials and icon mode, or with a consumer `role`, the avatar's `aria-label`, with
   * `role="img"` unless `role` is given) and generates the initials shown when there is no image.
   */
  name?: string;
  /** Size of the avatar.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Icon shown instead of the initials when there is no image. Rendered in an `aria-hidden`
   * `<span>` (a slot object can override its attributes). A falsy value (`null`, `false`, `''`,
   * `0`, `NaN`, e.g. `icon={count && <Icon />}`) counts as no icon, as in 0.4, and so does an
   * array, `Set` or generator whose items render nothing. Without `icon` and without a usable
   * `name`, a generic person glyph is shown.
   */
  icon?: Slot<'span'>;
  /**
   * Custom image. Accepts a URL string (treated like `src`), an element (rendered as the image
   * itself, e.g. `<img>` or a framework image component) or an object of `<img>` attributes
   * (`{ src, alt, … }`). Takes precedence over `src`; its `alt` defaults to `name`. When its alt
   * names the avatar, the avatar's `aria-describedby` ids are joined with the slot's own, while the
   * slot's own `aria-description` and `aria-details` win over the avatar's.
   */
  image?: Slot<'img'>;
  /**
   * Badge shown at the bottom end corner, e.g. `<PresenceBadge status="busy" />`. With a badge
   * the avatar is wrapped in an outer `<span>` that receives `ref`, `className` and the other
   * props; `role`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-description` and
   * `aria-details` stay on the avatar visual, so the badge keeps its own accessible name.
   */
  badge?: Slot<'span'>;
  /**
   * Hides the avatar visual from assistive technology (`aria-hidden`, empty image `alt`, no
   * `role="img"`). Use it when the name is already shown next to the avatar (Persona). A badge
   * stays exposed.
   * @default false
   */
  decorative?: boolean;
  /** Ref to the root `<span>`: the avatar itself, or the badge wrapper when `badge` is set. */
  ref?: React.Ref<HTMLSpanElement>;
}

const sizeMap: Record<Size, string> = {
  'extra-small': 'w-6 h-6 text-[10px]', // 24px
  small: 'w-8 h-8 text-xs', // 32px
  medium: 'w-10 h-10 text-sm', // 40px
  large: 'w-12 h-12 text-base', // 48px
  'extra-large': 'w-14 h-14 text-lg', // 56px
};

const IMAGE_CLASS = 'w-full h-full object-cover';

/** First letter of the first and last word, upper-cased; `''` for a blank name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = Array.from(parts[0]!)[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1]!)[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** A name with its whitespace collapsed, or `undefined` when it is blank. */
function normaliseName(name: string | undefined): string | undefined {
  return name?.trim().replace(/\s+/g, ' ') || undefined;
}

type ImageErrorHandler = React.ReactEventHandler<HTMLImageElement>;

/** Description props that go to the element carrying the avatar's name (data-display#19). */
type DescriptionProps = Pick<
  React.HTMLAttributes<HTMLElement>,
  'aria-describedby' | 'aria-description' | 'aria-details'
>;

/** Props the avatar sets on an element or object image slot, over the slot's own. */
interface SlotOverrides {
  onError: ImageErrorHandler;
  'aria-describedby'?: string;
}

/** The props of an element or object image slot that the avatar reads. */
interface ImageSlotProps {
  src?: unknown;
  alt?: unknown;
  onError?: unknown;
  'aria-describedby'?: unknown;
}

/** The props of an element or object image slot (to read its `src`, `alt` and handlers). */
function readSlotProps(slot: unknown): ImageSlotProps | undefined {
  if (React.isValidElement(slot)) return slot.props as ImageSlotProps;
  if (typeof slot === 'object' && slot !== null && !(Symbol.iterator in slot)) {
    return slot as ImageSlotProps;
  }
  return undefined;
}

/**
 * A circular picture of a person: their image, an icon, or the initials of their `name`.
 *
 * - **Image**: `image` (URL string, element or `{ src, alt }` object) or `src`. If the image fails
 *   to load, the avatar falls back to `icon`, the initials or a person glyph, with their
 *   background; a new `src` is tried again.
 * - **Accessible name**: an image uses `name` (whitespace collapsed) as its `alt`, or `''` when the
 *   name is blank. Without an image the avatar is `role="img"` with `aria-label={name}` and the
 *   initials/icon are hidden; without a name (and without `aria-label`/`aria-labelledby`) it is
 *   decorative (`aria-hidden`). A consumer `aria-label`, `aria-labelledby` or `role` (other than
 *   `presentation`/`none`) puts the name on the avatar visual, and an image inside it gets
 *   `alt=""`. `decorative` hides it in every mode. `aria-describedby`, `aria-description` and
 *   `aria-details` go to the element that carries the name: the `<img>` when a non-blank `alt`
 *   names it, otherwise the avatar visual (never an `alt=""` image).
 * - **Badge**: `badge` renders at the bottom end corner (logical, RTL-safe) as a sibling of the
 *   avatar visual, so a `PresenceBadge` keeps its own name. With a badge, `ref`, `className` and
 *   the rest props go to the outer wrapper.
 *
 * @example
 * <Avatar name="Jane Doe" src="/jane.jpg" badge={<PresenceBadge status="available" />} />
 */
export const Avatar = ({
  src,
  name,
  size = 'medium',
  icon,
  image,
  badge,
  decorative = false,
  className,
  ref,
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-description': ariaDescription,
  'aria-details': ariaDetails,
  ...rest
}: AvatarProps) => {
  const imageSlot =
    image === null || image === undefined || typeof image === 'boolean' || image === ''
      ? undefined
      : image;
  const slotProps = readSlotProps(imageSlot);
  const imageSource =
    imageSlot === undefined
      ? src || undefined
      : typeof imageSlot === 'string'
        ? imageSlot
        : typeof slotProps?.src === 'string'
          ? slotProps.src
          : undefined;

  // Load failure of the current image source; a new source is tried again (C-HOOKS: adjust
  // state during render on prop change).
  const [failed, setFailed] = React.useState(false);
  const [prevSource, setPrevSource] = React.useState(imageSource);
  if (prevSource !== imageSource) {
    setPrevSource(imageSource);
    setFailed(false);
  }

  const hasConsumerName = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  // A consumer role goes to the visual span together with the name (data-display#19), so the
  // image inside it is presentational (`alt=""`), as with a consumer `aria-label`: the children
  // of `role="img"` are not exposed. A presentational role (`presentation`, `none`) cannot carry
  // a name, so the image keeps it.
  const roleCarriesName = role !== undefined && role !== 'presentation' && role !== 'none';
  const normalisedName = normaliseName(name);
  const imageAlt = decorative || hasConsumerName || roleCarriesName ? '' : (normalisedName ?? '');
  const handleError: ImageErrorHandler = () => setFailed(true);

  // The alt text the image renders with: an element or object slot's own `alt` wins over ours.
  const renderedAlt: unknown =
    slotProps !== undefined && typeof imageSlot !== 'string' && 'alt' in slotProps
      ? slotProps.alt
      : imageAlt;

  // The description goes to the element that carries the name: the image itself when a non-blank
  // `alt` names it (the visual span then has no role, or a presentational one), otherwise the
  // visual span. An image with an empty `alt` is presentational, and a description on it would
  // conflict with that role.
  const description: DescriptionProps = {
    'aria-describedby': ariaDescribedBy,
    'aria-description': ariaDescription,
    'aria-details': ariaDetails,
  };
  const imageIsNamed =
    !decorative &&
    !hasConsumerName &&
    !roleCarriesName &&
    typeof renderedAlt === 'string' &&
    renderedAlt.trim() !== '';
  const imageDescription: DescriptionProps = imageIsNamed ? description : {};

  let imageNode: React.ReactNode = null;
  if (!failed) {
    if (typeof imageSlot === 'string') {
      imageNode = (
        <img
          src={imageSlot}
          alt={imageAlt}
          {...imageDescription}
          className={IMAGE_CLASS}
          onError={handleError}
        />
      );
    } else if (imageSlot !== undefined) {
      // The slot's own props win over renderSlot's defaults, so the composed `onError` and the
      // joined `aria-describedby` (the avatar's ids, then the slot's) are set on the slot itself.
      // A slot's own `aria-description` and `aria-details` win over the avatar's.
      const overrides: SlotOverrides = {
        onError: composeEventHandlers(
          slotProps?.onError as ImageErrorHandler | undefined,
          handleError,
        ),
      };
      if (imageIsNamed) {
        const ownIds = slotProps?.['aria-describedby'];
        overrides['aria-describedby'] = joinIds(
          ariaDescribedBy,
          typeof ownIds === 'string' ? ownIds : undefined,
        );
      }
      const slot = React.isValidElement(imageSlot)
        ? React.cloneElement(imageSlot as React.ReactElement<SlotOverrides>, overrides)
        : slotProps
          ? { ...(imageSlot as object), ...overrides }
          : imageSlot;
      imageNode = renderSlot(slot as Slot<'img'>, 'img', IMAGE_CLASS, {
        alt: imageAlt,
        ...imageDescription,
      });
    } else if (src) {
      imageNode = (
        <img
          src={src}
          alt={imageAlt}
          {...imageDescription}
          className={IMAGE_CLASS}
          onError={handleError}
        />
      );
    }
  }
  const visualDescription = imageNode !== null && imageIsNamed ? {} : description;

  // A falsy icon (`icon={count && <Icon />}` with count 0) is no icon, as in 0.4, and so is a
  // collection whose items render nothing (`icon={items.map(…)}` mapping to nothing). The check
  // does not consume a generator: renderSlot still renders its items.
  const iconNode =
    imageNode === null && icon && slotRendersContent(icon)
      ? renderSlot(icon, 'span', 'inline-flex', { 'aria-hidden': true })
      : null;
  const initials = imageNode === null && iconNode === null && name ? getInitials(name) : '';

  let content: React.ReactNode;
  let colorClass: string | undefined;
  if (imageNode !== null) {
    content = imageNode;
  } else if (iconNode !== null) {
    content = iconNode;
    colorClass = 'bg-muted text-muted-foreground';
  } else if (initials) {
    content = <span aria-hidden="true">{initials}</span>;
    colorClass = 'bg-primary text-primary-foreground';
  } else {
    content = <PersonIcon size="60%" />;
    colorClass = 'bg-muted text-muted-foreground';
  }

  // Accessible name of the avatar visual (data-display#19, #27). With a consumer role and an
  // image it is the name the image would carry: an element or object slot's own alt, else `name`.
  const imageName =
    imageNode !== null && roleCarriesName && typeof renderedAlt === 'string'
      ? normaliseName(renderedAlt)
      : undefined;
  const label =
    ariaLabel ??
    (imageNode === null
      ? normalisedName
      : roleCarriesName
        ? (imageName ?? normalisedName)
        : undefined);
  let a11yProps: React.HTMLAttributes<HTMLSpanElement>;
  if (decorative) {
    a11yProps = { 'aria-hidden': true, ...visualDescription };
  } else if (label !== undefined || ariaLabelledBy !== undefined) {
    a11yProps = {
      role: role ?? 'img',
      'aria-label': label,
      'aria-labelledby': ariaLabelledBy,
      ...visualDescription,
    };
  } else if (imageNode !== null || role !== undefined) {
    a11yProps = { role, ...visualDescription };
  } else {
    a11yProps = { 'aria-hidden': true, ...visualDescription };
  }

  const badgeNode = renderSlot(badge, 'span', 'absolute bottom-0 end-0 inline-flex');
  const hasBadge = badgeNode !== null;

  const visualClassName = cn(
    'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-bold',
    sizeMap[size],
    colorClass,
  );

  if (!hasBadge) {
    return (
      <span ref={ref} {...a11yProps} {...rest} className={cn(visualClassName, className)}>
        {content}
      </span>
    );
  }

  return (
    <span ref={ref} {...rest} className={cn('relative inline-flex shrink-0', className)}>
      <span {...a11yProps} className={visualClassName}>
        {content}
      </span>
      {badgeNode}
    </span>
  );
};

Avatar.displayName = 'Avatar';
