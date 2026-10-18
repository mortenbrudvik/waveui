/**
 * The look of the tag family: the size table, the appearances, the shapes, the Dismiss button and
 * the Avatar box per size. Tag reads it, and so do InteractionTag and TagPicker's tags.
 * Module-only (not in the barrel), as `buttonStyles.ts`. Class strings stay literal for
 * Tailwind's scanner. Every inset includes the tag's 1px border, so a filled and an outline tag of
 * one size have one box.
 */
import type { TagAppearance, TagShape, TagSize } from '../../lib/types';

/** The box (px) an Avatar without its own `size` takes in a tag's `media`, per tag size. */
export const TAG_AVATAR_SIZE: Readonly<Record<TagSize, 16 | 20 | 24>> = {
  medium: 24,
  small: 20,
  'extra-small': 16,
};

/** The layout every tag root shares: its parts in a centred row, with a 1px border. */
export const TAG_ROOT_BASE_CLASSES = 'inline-flex items-center border';

/** Height, gap between the parts and type of a tag per size: 28, 24 or 20px tall. */
export const tagSizeClasses: Readonly<Record<TagSize, string>> = {
  medium: 'min-h-7 gap-1 text-body-1',
  small: 'min-h-6 gap-1 text-caption-1',
  'extra-small': 'min-h-5 gap-0.5 text-caption-1',
};

/** The part a tag starts with, which sets its start inset. */
export type TagLeadingPart = 'text' | 'icon' | 'media';

/** The part a tag ends with, which sets its end inset. */
export type TagTrailingPart = 'text' | 'dismiss';

/**
 * Start inset per size and leading part, the border included: 12 or 8px before the text, 8 or
 * 6px before an icon, 2px before media.
 */
export const tagStartInsetClasses: Readonly<
  Record<TagSize, Readonly<Record<TagLeadingPart, string>>>
> = {
  medium: { text: 'ps-2.75', icon: 'ps-1.75', media: 'ps-px' },
  small: { text: 'ps-1.75', icon: 'ps-1.25', media: 'ps-px' },
  'extra-small': { text: 'ps-1.75', icon: 'ps-1.25', media: 'ps-px' },
};

/**
 * End inset per size and trailing part, the border included: 12 or 8px after the text; 6, 4 or
 * 2px after the Dismiss button.
 */
export const tagEndInsetClasses: Readonly<
  Record<TagSize, Readonly<Record<TagTrailingPart, string>>>
> = {
  medium: { text: 'pe-2.75', dismiss: 'pe-1.25' },
  small: { text: 'pe-1.75', dismiss: 'pe-0.75' },
  'extra-small': { text: 'pe-1.75', dismiss: 'pe-px' },
};

/**
 * Border, fill and text of each appearance: a neutral fill, a border on the surface behind it, or
 * the light brand tint (brand 160 on brand 60 in the light theme, so it follows the brand ramp).
 */
export const tagAppearanceClasses: Readonly<Record<TagAppearance, string>> = {
  filled: 'border-transparent bg-muted text-foreground',
  outline: 'border-stroke bg-transparent text-foreground',
  brand: 'border-transparent bg-selected text-selected-foreground',
};

/**
 * The selected look, over every appearance (the brand fill). Compose it with
 * `forcedColors.selectedContainer`: forced colours remove the fill.
 */
export const TAG_SELECTED_CLASSES = 'border-primary bg-primary text-primary-foreground';

/**
 * The dimming of a disabled tag, lifted while a focus ring shows on the root (a held link) or
 * inside it (a held Dismiss button), because opacity would dim the ring too.
 */
export const TAG_DISABLED_DIM_CLASSES =
  'opacity-50 focus-visible:opacity-100 has-focus-visible:opacity-100';

/** Corners per shape: a pill, or 4px. */
export const tagShapeClasses: Readonly<Record<TagShape, string>> = {
  circular: 'rounded-full',
  rounded: 'rounded',
};

/** The media span per size; with the gap, 8, 6 or 4px to the text. */
export const tagMediaClasses: Readonly<Record<TagSize, string>> = {
  medium: 'inline-flex shrink-0 me-1',
  small: 'inline-flex shrink-0 me-0.5',
  'extra-small': 'inline-flex shrink-0 me-0.5',
};

/** The icon box per size (20, 16 or 12px), whose `<svg>` fills it. */
export const tagIconClasses: Readonly<Record<TagSize, string>> = {
  medium: 'inline-flex size-5 shrink-0 items-center justify-center [&>svg]:size-full',
  small: 'inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-full',
  'extra-small': 'inline-flex size-3 shrink-0 items-center justify-center [&>svg]:size-full',
};

/** The layout wrapper of the primary and secondary text, while `secondaryText` renders. */
export const TAG_TEXT_COLUMN_CLASSES = 'inline-flex min-w-0 flex-col text-start';

/** The type of the primary text next to a second line (26px of lines in the 28px box). */
export const TAG_PRIMARY_TEXT_TWO_LINE_CLASSES = 'text-caption-1 leading-3.5';

/** The type of the second line of text; its colour is inherited. */
export const TAG_SECONDARY_TEXT_CLASSES = 'text-caption-2 leading-3';

/**
 * What every Dismiss button draws: a transparent circle with no padding of its own (C-NATIVE),
 * the tag's text colour, a positioned pointer-target layer, the not-allowed cursor of both
 * disabled states and, in forced colours, a Highlight glyph on hover (its hover fill becomes
 * Canvas there).
 */
export const TAG_DISMISS_BASE_CLASSES =
  'relative inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-inherit before:absolute disabled:cursor-not-allowed aria-disabled:cursor-not-allowed forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]';

/**
 * The Dismiss button per size: 20 or 16px, with a transparent layer that makes the pointer target
 * 24px (2px beyond each edge of the 20px button, 4px beyond the 16px one).
 */
export const tagDismissSizeClasses: Readonly<Record<TagSize, string>> = {
  medium: 'size-5 before:-inset-0.5',
  small: 'size-4 before:-inset-1',
  'extra-small': 'size-4 before:-inset-1',
};

/**
 * The ring offset of the Dismiss button per size, after `focusRing`: 0 at `extra-small`, where
 * the tag leaves 2px around the button and a 2px offset would put the ring on the page.
 */
export const tagDismissRingClasses: Readonly<Record<TagSize, string>> = {
  medium: '',
  small: '',
  'extra-small': 'focus-visible:outline-offset-0',
};

/** The Dismiss glyph (px) per size. */
export const TAG_DISMISS_GLYPH_SIZE: Readonly<Record<TagSize, 10 | 12>> = {
  medium: 12,
  small: 12,
  'extra-small': 10,
};

/** The look a tag draws: one of its appearances, or the selected look over them. */
export type TagLook = TagAppearance | 'selected';

/**
 * The Dismiss button's hover and pressed fills per look, behind the literal gate (C-TOKENS): the
 * neutral states on filled and outline tags (an outline tag is transparent, so its circle must
 * show on the page), the brand states on brand tags, the primary states on selected ones.
 */
export const tagDismissStateClasses: Readonly<Record<TagLook, string>> = {
  filled:
    'not-disabled:not-aria-disabled:hover:bg-muted-hover not-disabled:not-aria-disabled:active:bg-muted-pressed',
  outline:
    'not-disabled:not-aria-disabled:hover:bg-muted-hover not-disabled:not-aria-disabled:active:bg-muted-pressed',
  brand:
    'not-disabled:not-aria-disabled:hover:bg-selected-hover not-disabled:not-aria-disabled:active:bg-selected-pressed',
  selected:
    'not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed',
};

/**
 * The Dismiss button's ring colour on a selected tag, after `focusRing`: the default ring colour
 * is the primary fill itself.
 */
export const TAG_DISMISS_SELECTED_RING_CLASSES = 'focus-visible:outline-primary-foreground';

/**
 * The root utilities of a text-only, non-dismissible, unselected, enabled tag of a size,
 * appearance and shape, without a stable class (TagPicker's count chip carries its own).
 *
 * @example
 * <span className={cn(chipClassName, tagRootClasses({ size, appearance, shape }))}>+3</span>
 */
export function tagRootClasses(options: {
  size: TagSize;
  appearance: TagAppearance;
  shape: TagShape;
}): string {
  const { size, appearance, shape } = options;
  return [
    TAG_ROOT_BASE_CLASSES,
    tagSizeClasses[size],
    tagStartInsetClasses[size].text,
    tagEndInsetClasses[size].text,
    tagAppearanceClasses[appearance],
    tagShapeClasses[shape],
  ].join(' ');
}
