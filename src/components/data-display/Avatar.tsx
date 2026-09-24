import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { PersonIcon } from '../../lib/icons';
import type { Size, Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';

/** Properties for the Avatar component. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * URL of the avatar image. When it fails to load (also before hydration, for server-rendered
   * markup), the avatar falls back to its icon or initials; a new `src` is tried again.
   */
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
   * (`{ src, alt, … }`). Takes precedence over `src`; its `alt` defaults to `name` (an `alt` that
   * is `undefined` counts as not given). When its alt names the avatar, the avatar's
   * `aria-describedby` ids are joined with the slot's own, while the slot's own `aria-description`
   * and `aria-details` win over the avatar's. When the image fails to load, an avatar without a
   * `name` keeps the name of the slot's own `alt`. After a load failure, a new image is tried
   * again: another `src` or `srcSet` of any type (an equal inline object is the same image), or
   * for an element slot another component type or `key`.
   */
  image?: Slot<'img'>;
  /**
   * Badge shown at the bottom end corner, e.g. `<PresenceBadge status="busy" />`. With a badge
   * the avatar is wrapped in an outer `<span>` that receives `ref`, `className` and the other
   * props; `role`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-description` and
   * `aria-details` stay on the avatar visual, so the badge keeps its own accessible name. A falsy
   * value (`null`, `false`, `''`, `0`, `NaN`, e.g. `badge={count && <CounterBadge count={count} />}`)
   * counts as no badge, as in 0.4, and so does an array, `Set` or generator whose items render
   * nothing: the avatar then renders without the wrapper.
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

/**
 * Width, height and text size classes of the avatar per `size`. Module-only (not in the barrel):
 * AvatarGroup sizes its overflow button with the same classes, so the two always match.
 */
export const avatarSizeClasses: Readonly<Record<Size, string>> = {
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
  alt?: string;
  'aria-describedby'?: string;
}

/** The props of an element or object image slot that the avatar reads. */
interface ImageSlotProps {
  src?: unknown;
  srcSet?: unknown;
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
 * What identifies the image, so a load failure is kept for it and a new image is tried again
 * (data-display#4): the `src` and `srcSet`, of any type (a framework image component may take a
 * static-import object), and for an element slot also its type and `key`.
 */
type ImageKey = readonly [type: unknown, key: unknown, src: unknown, srcSet: unknown];

function getImageKey(
  imageSlot: unknown,
  slotProps: ImageSlotProps | undefined,
  src: string | undefined,
): ImageKey {
  if (imageSlot === undefined) return [undefined, undefined, src || undefined, undefined];
  if (typeof imageSlot === 'string') return [undefined, undefined, imageSlot, undefined];
  const element = React.isValidElement(imageSlot) ? imageSlot : undefined;
  return [element?.type, element?.key, slotProps?.src, slotProps?.srcSet];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Same value, or plain objects with the same entries (an inline `src={{ … }}` on each render). */
function sameKeyPart(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]))
  );
}

function sameImageKey(a: ImageKey, b: ImageKey): boolean {
  return a.every((part, i) => sameKeyPart(part, b[i]));
}

/**
 * A circular picture of a person: their image, an icon, or the initials of their `name`.
 *
 * - **Image**: `image` (URL string, element or `{ src, alt }` object) or `src`. If the image fails
 *   to load, the avatar falls back to `icon`, the initials or a person glyph, with their
 *   background; a new image is tried again. A server-rendered image that failed before hydration
 *   is detected after mount (settled without a natural size, confirmed by `decode()`).
 * - **Accessible name**: an image uses `name` (whitespace collapsed) as its `alt`, or `''` when the
 *   name is blank. Without an image (none given, or it failed to load) the avatar is `role="img"`
 *   with `aria-label={name}` (without a name: the image slot's own `alt`) and the initials/icon
 *   are hidden; without either (and without `aria-label`/`aria-labelledby`) it is decorative
 *   (`aria-hidden`). A consumer `aria-label`, `aria-labelledby` or `role` (other than
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
  const imageKey = getImageKey(imageSlot, slotProps, src);

  // Load failure of the current image; a new image is tried again (C-HOOKS: adjust state during
  // render on prop change).
  const [failed, setFailed] = React.useState(false);
  const [prevImageKey, setPrevImageKey] = React.useState(imageKey);
  if (!sameImageKey(prevImageKey, imageKey)) {
    setPrevImageKey(imageKey);
    setFailed(false);
  }

  // An image that failed before hydration (a fast 404 of server-rendered markup) never reaches
  // `onError`: React attaches the listener while hydrating and does not replay the event. After
  // mount, a settled image without a natural size is broken, unless it is an SVG without one, so
  // `decode()` (which rejects for a broken image) confirms it where the browser supports it. Later
  // images, rendered by the client, report their errors through `onError`.
  const visualRef = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const img = visualRef.current?.querySelector('img');
    if (!img || !img.complete || img.naturalWidth !== 0) return;
    let active = true;
    const checkedSrc = img.getAttribute('src');
    const checkedSrcSet = img.getAttribute('srcset');
    const markFailed = () => {
      // Deferred (C-HOOKS); skipped if the image was replaced or got another source meanwhile.
      if (
        active &&
        img.isConnected &&
        img.getAttribute('src') === checkedSrc &&
        img.getAttribute('srcset') === checkedSrcSet
      ) {
        setFailed(true);
      }
    };
    if (typeof img.decode === 'function') img.decode().then(undefined, markFailed);
    else queueMicrotask(markFailed);
    return () => {
      active = false;
    };
  }, []);
  const rootVisualRef = useMergedRefs(ref, visualRef);

  const hasConsumerName = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  // A consumer role goes to the visual span together with the name (data-display#19), so the
  // image inside it is presentational (`alt=""`), as with a consumer `aria-label`: the children
  // of `role="img"` are not exposed. A presentational role (`presentation`, `none`) cannot carry
  // a name, so the image keeps it.
  const roleCarriesName = role !== undefined && role !== 'presentation' && role !== 'none';
  const normalisedName = normaliseName(name);
  const imageAlt = decorative || hasConsumerName || roleCarriesName ? '' : (normalisedName ?? '');
  const handleError: ImageErrorHandler = () => setFailed(true);

  // The alt text the image renders with: an element or object slot's own `alt` wins over ours. An
  // `alt` that is `undefined` (an optional `alt: user.photoAlt`, a wrapper forwarding `alt={alt}`)
  // or `null` is not given, so ours applies (the slot's own value would otherwise override it).
  const ownAlt = slotProps?.alt;
  const hasOwnAlt = ownAlt !== undefined && ownAlt !== null;
  const renderedAlt: unknown = hasOwnAlt ? ownAlt : imageAlt;

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
      // The slot's own props win over renderSlot's defaults, so the composed `onError`, the
      // default `alt` (when the slot gives none) and the joined `aria-describedby` (the avatar's
      // ids, then the slot's) are set on the slot itself. A slot's own `aria-description` and
      // `aria-details` win over the avatar's.
      const overrides: SlotOverrides = {
        onError: composeEventHandlers(
          slotProps?.onError as ImageErrorHandler | undefined,
          handleError,
        ),
      };
      if (!hasOwnAlt) overrides.alt = imageAlt;
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
  // Without an image (none given, or it failed to load) it is `name`, else the slot's own alt: an
  // avatar named only by its image alt keeps that name when the image fails.
  const imageName =
    imageNode !== null && roleCarriesName && typeof renderedAlt === 'string'
      ? normaliseName(renderedAlt)
      : undefined;
  const slotAltName = typeof ownAlt === 'string' ? normaliseName(ownAlt) : undefined;
  const label =
    ariaLabel ??
    (imageNode === null
      ? (normalisedName ?? slotAltName)
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

  // A falsy or empty badge (`badge={count && <CounterBadge … />}` with count 0) is no badge, as in
  // 0.4 and like `icon`: no stray "0" in the corner, and no wrapper taking the root props.
  const badgeNode =
    badge && slotRendersContent(badge)
      ? renderSlot(badge, 'span', 'absolute bottom-0 end-0 inline-flex')
      : null;
  const hasBadge = badgeNode !== null;

  const visualClassName = cn(
    'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-bold',
    avatarSizeClasses[size],
    colorClass,
  );

  if (!hasBadge) {
    return (
      <span ref={rootVisualRef} {...a11yProps} {...rest} className={cn(visualClassName, className)}>
        {content}
      </span>
    );
  }

  return (
    <span ref={ref} {...rest} className={cn('relative inline-flex shrink-0', className)}>
      <span ref={visualRef} {...a11yProps} className={visualClassName}>
        {content}
      </span>
      {badgeNode}
    </span>
  );
};

Avatar.displayName = 'Avatar';
