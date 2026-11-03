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
export const TAG_ROOT_BASE_CLASSES = 'wave:inline-flex wave:items-center wave:border';

/** Height, gap between the parts and type of a tag per size: 28, 24 or 20px tall. */
export const tagSizeClasses: Readonly<Record<TagSize, string>> = {
  medium: 'wave:min-h-7 wave:gap-1 wave:text-body-1',
  small: 'wave:min-h-6 wave:gap-1 wave:text-caption-1',
  'extra-small': 'wave:min-h-5 wave:gap-0.5 wave:text-caption-1',
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
  medium: { text: 'wave:ps-2.75', icon: 'wave:ps-1.75', media: 'wave:ps-px' },
  small: { text: 'wave:ps-1.75', icon: 'wave:ps-1.25', media: 'wave:ps-px' },
  'extra-small': { text: 'wave:ps-1.75', icon: 'wave:ps-1.25', media: 'wave:ps-px' },
};

/**
 * End inset per size and trailing part, the border included: 12 or 8px after the text; 6, 4 or
 * 2px after the Dismiss button.
 */
export const tagEndInsetClasses: Readonly<
  Record<TagSize, Readonly<Record<TagTrailingPart, string>>>
> = {
  medium: { text: 'wave:pe-2.75', dismiss: 'wave:pe-1.25' },
  small: { text: 'wave:pe-1.75', dismiss: 'wave:pe-0.75' },
  'extra-small': { text: 'wave:pe-1.75', dismiss: 'wave:pe-px' },
};

/**
 * Border, fill and text of each appearance: a neutral fill, a border on the surface behind it, or
 * the light brand tint (brand 160 on brand 60 in the light theme, so it follows the brand ramp).
 */
export const tagAppearanceClasses: Readonly<Record<TagAppearance, string>> = {
  filled: 'wave:border-transparent wave:bg-muted wave:text-foreground',
  outline: 'wave:border-stroke wave:bg-transparent wave:text-foreground',
  brand: 'wave:border-transparent wave:bg-selected wave:text-selected-foreground',
};

/**
 * The selected look, over every appearance (the brand fill). Compose it with
 * `forcedColors.selectedContainer`: forced colours remove the fill.
 */
export const TAG_SELECTED_CLASSES =
  'wave:border-primary wave:bg-primary wave:text-primary-foreground';

/**
 * The dimming of a disabled tag, lifted while a focus ring shows on the root (a held link) or
 * inside it (a held Dismiss button), because opacity would dim the ring too.
 */
export const TAG_DISABLED_DIM_CLASSES =
  'wave:opacity-50 wave:focus-visible:opacity-100 wave:has-focus-visible:opacity-100';

/** Corners per shape: a pill, or 4px. */
export const tagShapeClasses: Readonly<Record<TagShape, string>> = {
  circular: 'wave:rounded-full',
  rounded: 'wave:rounded',
};

/** The media span per size; with the gap, 8, 6 or 4px to the text. */
export const tagMediaClasses: Readonly<Record<TagSize, string>> = {
  medium: 'wave:inline-flex wave:shrink-0 wave:me-1',
  small: 'wave:inline-flex wave:shrink-0 wave:me-0.5',
  'extra-small': 'wave:inline-flex wave:shrink-0 wave:me-0.5',
};

/** The icon box per size (20, 16 or 12px), whose `<svg>` fills it. */
export const tagIconClasses: Readonly<Record<TagSize, string>> = {
  medium:
    'wave:inline-flex wave:size-5 wave:shrink-0 wave:items-center wave:justify-center wave:[&>svg]:size-full',
  small:
    'wave:inline-flex wave:size-4 wave:shrink-0 wave:items-center wave:justify-center wave:[&>svg]:size-full',
  'extra-small':
    'wave:inline-flex wave:size-3 wave:shrink-0 wave:items-center wave:justify-center wave:[&>svg]:size-full',
};

/** The layout wrapper of the primary and secondary text, while `secondaryText` renders. */
export const TAG_TEXT_COLUMN_CLASSES =
  'wave:inline-flex wave:min-w-0 wave:flex-col wave:text-start';

/** The type of the primary text next to a second line (26px of lines in the 28px box). */
export const TAG_PRIMARY_TEXT_TWO_LINE_CLASSES = 'wave:text-caption-1 wave:leading-3.5';

/** The type of the second line of text; its colour is inherited. */
export const TAG_SECONDARY_TEXT_CLASSES = 'wave:text-caption-2 wave:leading-3';

/**
 * What every Dismiss button draws: a transparent circle with no padding of its own (C-NATIVE),
 * the tag's text colour, a positioned pointer-target layer, the not-allowed cursor of both
 * disabled states and, in forced colours, a Highlight glyph on hover (its hover fill becomes
 * Canvas there).
 */
export const TAG_DISMISS_BASE_CLASSES =
  'wave:relative wave:inline-flex wave:shrink-0 wave:items-center wave:justify-center wave:rounded-full wave:border-0 wave:bg-transparent wave:p-0 wave:text-inherit wave:before:absolute wave:disabled:cursor-not-allowed wave:aria-disabled:cursor-not-allowed wave:forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]';

/**
 * The Dismiss button per size: 20 or 16px, with a transparent layer that makes the pointer target
 * 24px (2px beyond each edge of the 20px button, 4px beyond the 16px one).
 */
export const tagDismissSizeClasses: Readonly<Record<TagSize, string>> = {
  medium: 'wave:size-5 wave:before:-inset-0.5',
  small: 'wave:size-4 wave:before:-inset-1',
  'extra-small': 'wave:size-4 wave:before:-inset-1',
};

/**
 * The ring offset of the Dismiss button per size, after `focusRing`: 0 at `extra-small`, where
 * the tag leaves 2px around the button and a 2px offset would put the ring on the page.
 */
export const tagDismissRingClasses: Readonly<Record<TagSize, string>> = {
  medium: '',
  small: '',
  'extra-small': 'wave:focus-visible:outline-offset-0',
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
    'wave:not-disabled:not-aria-disabled:hover:bg-muted-hover wave:not-disabled:not-aria-disabled:active:bg-muted-pressed',
  outline:
    'wave:not-disabled:not-aria-disabled:hover:bg-muted-hover wave:not-disabled:not-aria-disabled:active:bg-muted-pressed',
  brand:
    'wave:not-disabled:not-aria-disabled:hover:bg-selected-hover wave:not-disabled:not-aria-disabled:active:bg-selected-pressed',
  selected:
    'wave:not-disabled:not-aria-disabled:hover:bg-primary-hover wave:not-disabled:not-aria-disabled:active:bg-primary-pressed',
};

/**
 * The Dismiss button's ring colour on a selected tag, after `focusRing`: the default ring colour
 * is the primary fill itself.
 */
export const TAG_DISMISS_SELECTED_RING_CLASSES = 'wave:focus-visible:outline-primary-foreground';

// ---------------------------------------------------------------------------
// InteractionTag: two sibling buttons on the same table
// ---------------------------------------------------------------------------

/**
 * What both InteractionTag buttons draw: a 1px border, a colour transition switched off for
 * reduced motion, and a raised stacking level while their focus ring shows, so the neighbouring
 * button does not cover the ring.
 */
export const INTERACTION_TAG_BUTTON_BASE_CLASSES =
  'wave:relative wave:inline-flex wave:items-center wave:border wave:transition-colors wave:motion-reduce:transition-none wave:focus-visible:z-10';

/** The Primary button's own layout: no block padding of its own (C-NATIVE), text from the start. */
export const INTERACTION_TAG_PRIMARY_BASE_CLASSES = 'wave:py-0 wave:text-start';

/**
 * The Primary's end inset per size, the border included: 12 or 8px alone; next to a Secondary
 * (the root holds a Dismiss control) 8, 6 or 4px, with no end border (the Secondary's start border
 * is the divider). Read from the root's named group in CSS, so the server HTML is right without a
 * registration render.
 */
export const interactionTagPrimaryEndInsetClasses: Readonly<Record<TagSize, string>> = {
  medium: 'wave:pe-2.75 wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-2',
  small: 'wave:pe-1.75 wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-1.5',
  'extra-small': 'wave:pe-1.75 wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-1',
};

/** The Primary's end corners and end border next to a Secondary: square, and none. */
export const INTERACTION_TAG_PRIMARY_JOINED_CLASSES =
  'wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:rounded-e-none wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:border-e-0';

/**
 * What the Secondary (the Dismiss button) draws: its content centred, no padding of its own
 * (C-NATIVE: a glyph Secondary is exactly its minimum width), and in forced colours a Highlight
 * glyph on hover (its hover fill becomes Canvas there).
 */
export const INTERACTION_TAG_SECONDARY_BASE_CLASSES =
  'wave:shrink-0 wave:justify-center wave:p-0 wave:forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]';

/**
 * The element that holds the Secondary's children while they render a text label ("Remove"):
 * 6px on each side, so the label does not touch the divider or the end of the tag.
 */
export const INTERACTION_TAG_SECONDARY_LABEL_CLASSES = 'wave:px-1.5';

/**
 * The Secondary per size: at least 28, 24 or 24px wide (exactly that with a glyph: the 12, 12 or
 * 10px glyph and the borders fit inside), as tall as the Primary (the root stretches both), with
 * the text of the tag's size for a text label.
 */
export const interactionTagSecondarySizeClasses: Readonly<Record<TagSize, string>> = {
  medium: 'wave:min-w-7 wave:text-body-1',
  small: 'wave:min-w-6 wave:text-caption-1',
  'extra-small': 'wave:min-w-6 wave:text-caption-1',
};

/**
 * Border, fill and text of both buttons per look, with their hover and pressed fills behind the
 * literal gate (C-TOKENS): the neutral states on filled tags, Button's outline states on outline
 * tags, the brand states on brand tags and the primary states on selected ones. Compose the
 * selected look with {@link INTERACTION_TAG_SELECTED_FORCED_COLORS}.
 */
export const interactionTagLookClasses: Readonly<Record<TagLook, string>> = {
  filled:
    'wave:border-transparent wave:bg-muted wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-muted-hover wave:not-disabled:not-aria-disabled:active:bg-muted-pressed',
  outline:
    'wave:border-stroke wave:bg-transparent wave:text-foreground wave:not-disabled:not-aria-disabled:hover:border-stroke-hover wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  brand:
    'wave:border-transparent wave:bg-selected wave:text-selected-foreground wave:not-disabled:not-aria-disabled:hover:bg-selected-hover wave:not-disabled:not-aria-disabled:active:bg-selected-pressed',
  selected:
    'wave:border-primary wave:bg-primary wave:text-primary-foreground wave:not-disabled:not-aria-disabled:hover:bg-primary-hover wave:not-disabled:not-aria-disabled:active:bg-primary-pressed',
};

/**
 * The selected buttons in forced colours, after `forcedColors.selectedContainer` (a Highlight
 * outline inside): a Highlight border too, as a pressed Button draws it.
 */
export const INTERACTION_TAG_SELECTED_FORCED_COLORS = 'wave:forced-colors:border-[Highlight]';

/**
 * The divider between the two buttons: the Secondary's start border, after the look's border
 * colour. Decorative: the neutral stroke, or the on-primary colour on a selected tag.
 */
export const interactionTagDividerClasses: Readonly<Record<TagLook, string>> = {
  filled: 'wave:border-s-stroke',
  outline: 'wave:border-s-stroke',
  brand: 'wave:border-s-stroke',
  selected: 'wave:border-s-primary-foreground',
};

/** The Secondary's corners per shape: square at its start, the tag's shape at its end. */
export const interactionTagSecondaryShapeClasses: Readonly<Record<TagShape, string>> = {
  circular: 'wave:rounded-s-none wave:rounded-e-full',
  rounded: 'wave:rounded-s-none wave:rounded-e',
};

/**
 * The disabled look of both buttons while natively disabled; a held button (`aria-disabled`) adds
 * `mergedAriaDisabledClasses`. Each button dims itself: the root is never dimmed.
 */
export const INTERACTION_TAG_DISABLED_CLASSES =
  'wave:disabled:cursor-not-allowed wave:disabled:opacity-50';

/**
 * The disabled cursor alone, for a host that dims the area holding its tags as a whole (the
 * host's `dimDisabled: false`): no button dims itself then.
 */
export const INTERACTION_TAG_UNDIMMED_DISABLED_CLASSES =
  'wave:disabled:cursor-not-allowed wave:aria-disabled:cursor-not-allowed';

/**
 * The pointer target of both buttons at `extra-small`: a transparent layer 2px above and below
 * the 20px button (24px tall), as wide as the button, so two neighbouring targets never overlap.
 */
export const INTERACTION_TAG_EXTRA_SMALL_HIT_CLASSES =
  'wave:before:absolute wave:before:inset-x-0 wave:before:-inset-y-0.5';

/**
 * The root utilities of a text-only, non-dismissible, unselected, enabled tag of a size,
 * appearance and shape, without a stable class (TagPicker's count chip carries its own).
 *
 * @example
 * <span className={wcn(chipClassName, tagRootClasses({ size, appearance, shape }))}>+3</span>
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
