import * as React from 'react';

/**
 * Props of the shared internal icons. Every other SVG attribute is forwarded to the `<svg>`.
 *
 * Icons are decorative by default (`aria-hidden="true"`, `focusable="false"`): the control that
 * contains them provides the accessible name. Pass `title` for a standalone meaningful icon; it
 * then renders `role="img"` with a `<title>`.
 */
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Width and height (number = px, or any CSS length). Default 16 (chevrons 12). */
  size?: number | string;
  /** Accessible name; makes the icon a named image instead of a decorative one. */
  title?: string;
}

/** An internal icon component. */
export interface IconComponent {
  (props: IconProps): React.JSX.Element;
  displayName: string;
}

interface IconDefinition {
  /** Value of `data-wave-icon`. */
  name: string;
  displayName: string;
  viewBox: string;
  defaultSize: number;
  /** Stroked glyphs paint with `stroke`, filled glyphs with `fill`. */
  paint: 'fill' | 'stroke';
  strokeWidth?: number;
  content: React.ReactNode;
}

/**
 * Builds an icon component. Side-effect free: every call site carries a `@__PURE__` annotation
 * comment so bundlers drop the icons a consumer does not use (a test bundles a one-icon entry with
 * Vite's production build). Keep that annotation on new icons.
 */
function createIcon({
  name,
  displayName,
  viewBox,
  defaultSize,
  paint,
  strokeWidth,
  content,
}: IconDefinition): IconComponent {
  const paintProps: React.SVGProps<SVGSVGElement> =
    paint === 'fill'
      ? { fill: 'currentColor' }
      : {
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        };

  const Icon = ({ size = defaultSize, title, children, ...rest }: IconProps) => {
    const a11yProps: React.SVGProps<SVGSVGElement> = title
      ? { role: 'img' }
      : { 'aria-hidden': true, focusable: 'false' };
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={viewBox}
        data-wave-icon={name}
        {...paintProps}
        {...a11yProps}
        {...rest}
      >
        {title ? <title>{title}</title> : null}
        {content}
        {children}
      </svg>
    );
  };
  Icon.displayName = displayName;
  return Icon;
}

const CHEVRON_DOWN =
  'M2.22 4.47a.75.75 0 0 1 1.06 0L6 7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06L6.53 8.78a.75.75 0 0 1-1.06 0L2.22 5.53a.75.75 0 0 1 0-1.06Z';
const CHEVRON_UP =
  'M2.22 7.53a.75.75 0 0 0 1.06 0L6 4.81l2.72 2.72a.75.75 0 1 0 1.06-1.06L6.53 3.22a.75.75 0 0 0-1.06 0L2.22 6.47a.75.75 0 0 0 0 1.06Z';
const CHEVRON_RIGHT =
  'M4.47 2.22a.75.75 0 0 0 0 1.06L7.19 6 4.47 8.72a.75.75 0 1 0 1.06 1.06l3.25-3.25a.75.75 0 0 0 0-1.06L5.53 2.22a.75.75 0 0 0-1.06 0Z';
const CHEVRON_LEFT =
  'M7.53 2.22a.75.75 0 0 1 0 1.06L4.81 6l2.72 2.72a.75.75 0 1 1-1.06 1.06L3.22 6.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z';

/** Close / clear / dismiss glyph (Dialog, Drawer, MessageBar, Toast, Tag, SearchBox, pickers). */
export const DismissIcon = /* @__PURE__ */ createIcon({
  name: 'dismiss',
  displayName: 'DismissIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
  ),
});

/** Disclosure chevron pointing down (MenuButton, SplitButton, Dropdown, Accordion). */
export const ChevronDownIcon = /* @__PURE__ */ createIcon({
  name: 'chevron-down',
  displayName: 'ChevronDownIcon',
  viewBox: '0 0 12 12',
  defaultSize: 12,
  paint: 'fill',
  content: <path d={CHEVRON_DOWN} />,
});

/** Chevron pointing up. */
export const ChevronUpIcon = /* @__PURE__ */ createIcon({
  name: 'chevron-up',
  displayName: 'ChevronUpIcon',
  viewBox: '0 0 12 12',
  defaultSize: 12,
  paint: 'fill',
  content: <path d={CHEVRON_UP} />,
});

/** Chevron pointing left (physical). Mirror directional uses with `rtl:-scale-x-100`. */
export const ChevronLeftIcon = /* @__PURE__ */ createIcon({
  name: 'chevron-left',
  displayName: 'ChevronLeftIcon',
  viewBox: '0 0 12 12',
  defaultSize: 12,
  paint: 'fill',
  content: <path d={CHEVRON_LEFT} />,
});

/** Chevron pointing right (physical). Mirror directional uses with `rtl:-scale-x-100`. */
export const ChevronRightIcon = /* @__PURE__ */ createIcon({
  name: 'chevron-right',
  displayName: 'ChevronRightIcon',
  viewBox: '0 0 12 12',
  defaultSize: 12,
  paint: 'fill',
  content: <path d={CHEVRON_RIGHT} />,
});

/** Double chevron pointing left (Pagination "first"). */
export const ChevronDoubleLeftIcon = /* @__PURE__ */ createIcon({
  name: 'chevron-double-left',
  displayName: 'ChevronDoubleLeftIcon',
  viewBox: '0 0 12 12',
  defaultSize: 12,
  paint: 'fill',
  content: (
    <>
      <path d={CHEVRON_LEFT} transform="translate(-1.4 0)" />
      <path d={CHEVRON_LEFT} transform="translate(2.6 0)" />
    </>
  ),
});

/** Double chevron pointing right (Pagination "last"). */
export const ChevronDoubleRightIcon = /* @__PURE__ */ createIcon({
  name: 'chevron-double-right',
  displayName: 'ChevronDoubleRightIcon',
  viewBox: '0 0 12 12',
  defaultSize: 12,
  paint: 'fill',
  content: (
    <>
      <path d={CHEVRON_RIGHT} transform="translate(-2.6 0)" />
      <path d={CHEVRON_RIGHT} transform="translate(1.4 0)" />
    </>
  ),
});

/** Calendar glyph (DatePicker toggle). */
export const CalendarIcon = /* @__PURE__ */ createIcon({
  name: 'calendar',
  displayName: 'CalendarIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
    />
  ),
});

/** Clock glyph (TimePicker). */
export const ClockIcon = /* @__PURE__ */ createIcon({
  name: 'clock',
  displayName: 'ClockIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm-.75 2.25a.75.75 0 0 1 1.5 0v3.94l2.28 2.28a.75.75 0 1 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1-.22-.53V5.75Z" />
  ),
});

/** Check mark (Checkbox, selected options). */
export const CheckIcon = /* @__PURE__ */ createIcon({
  name: 'check',
  displayName: 'CheckIcon',
  viewBox: '0 0 12 12',
  defaultSize: 16,
  paint: 'stroke',
  strokeWidth: 2,
  content: <path d="M2.5 6l2.5 2.5L9.5 3" />,
});

/** Horizontal bar (indeterminate Checkbox). */
export const SubtractIcon = /* @__PURE__ */ createIcon({
  name: 'subtract',
  displayName: 'SubtractIcon',
  viewBox: '0 0 12 12',
  defaultSize: 16,
  paint: 'stroke',
  strokeWidth: 2,
  content: <path d="M2.5 6h7" />,
});

/** Magnifier (SearchBox). */
export const SearchIcon = /* @__PURE__ */ createIcon({
  name: 'search',
  displayName: 'SearchIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.38l3.09 3.08a.75.75 0 1 1-1.06 1.06l-3.09-3.08A7 7 0 0 1 2 9Z"
    />
  ),
});

/** Information glyph (InfoLabel, informational MessageBar/Toast). */
export const InfoIcon = /* @__PURE__ */ createIcon({
  name: 'info',
  displayName: 'InfoIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path
      fillRule="evenodd"
      d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.5 5v1h-1V7h1Zm0 3v4h-1v-4h1Z"
    />
  ),
});

/** Success status glyph (MessageBar, Toast). */
export const SuccessIcon = /* @__PURE__ */ createIcon({
  name: 'success',
  displayName: 'SuccessIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path
      fillRule="evenodd"
      d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm3.36 5.65-4 5a.5.5 0 0 1-.72.05l-2-2a.5.5 0 0 1 .72-.7l1.77 1.76 3.6-4.5a.5.5 0 0 1 .78.62l-.15.17Z"
    />
  ),
});

/** Warning status glyph (MessageBar, Toast). */
export const WarningIcon = /* @__PURE__ */ createIcon({
  name: 'warning',
  displayName: 'WarningIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path
      fillRule="evenodd"
      d="M9.15 3.45a1 1 0 0 1 1.7 0l6.86 11.44A1 1 0 0 1 16.86 17H3.14a1 1 0 0 1-.85-1.53L9.15 3.45ZM10.5 13v1h-1v-1h1Zm0-5v4h-1V8h1Z"
    />
  ),
});

/** Error status glyph (MessageBar, Toast). */
export const ErrorIcon = /* @__PURE__ */ createIcon({
  name: 'error',
  displayName: 'ErrorIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path
      fillRule="evenodd"
      d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.5 5v4h-1V7h1Zm0 6v1h-1v-1h1Z"
    />
  ),
});

/** Star (Rating). */
export const StarIcon = /* @__PURE__ */ createIcon({
  name: 'star',
  displayName: 'StarIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 13.88l-4.94 2.82.94-5.49-4-3.9 5.53-.8L10 1.5Z" />
  ),
});

/** Plus (SpinButton increment); the {@link SubtractIcon} bar plus a vertical bar. */
export const AddIcon = /* @__PURE__ */ createIcon({
  name: 'add',
  displayName: 'AddIcon',
  viewBox: '0 0 12 12',
  defaultSize: 16,
  paint: 'stroke',
  strokeWidth: 2,
  content: <path d="M6 2.5v7M2.5 6h7" />,
});

/**
 * Generic person (Avatar fallback when there is no image, icon or name). Accepts a relative size
 * such as `size="60%"` to scale with its container.
 */
export const PersonIcon = /* @__PURE__ */ createIcon({
  name: 'person',
  displayName: 'PersonIcon',
  viewBox: '0 0 20 20',
  defaultSize: 16,
  paint: 'fill',
  content: (
    <path d="M10 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-5.5 10h11A2.5 2.5 0 0 1 18 14.5v.5c0 2.4-2.9 4-8 4s-8-1.6-8-4v-.5A2.5 2.5 0 0 1 4.5 12Z" />
  ),
});

/*
 * Presence glyphs (PresenceBadge). Drawn in a 16x16 box that the badge circle fills, with stroke
 * weights tuned for the 8-20px badge sizes; render them with `className="size-full"`. They differ
 * from CheckIcon/ClockIcon/DismissIcon in geometry, so every status keeps a distinct shape at
 * badge size. Mirror the out-of-office arrow in right-to-left layouts (`rtl:-scale-x-100`).
 */

/** Presence "available": a check mark. */
export const PresenceAvailableIcon = /* @__PURE__ */ createIcon({
  name: 'presence-available',
  displayName: 'PresenceAvailableIcon',
  viewBox: '0 0 16 16',
  defaultSize: 16,
  paint: 'stroke',
  content: <path d="M4.6 8.3l2.2 2.2 4.6-4.8" strokeWidth={2} />,
});

/**
 * Presence "busy": a full disc in `currentColor`. Forced-colors mode replaces the badge background
 * with Canvas but forces `color` to CanvasText, so busy stays a solid dot instead of an empty ring.
 */
export const PresenceBusyIcon = /* @__PURE__ */ createIcon({
  name: 'presence-busy',
  displayName: 'PresenceBusyIcon',
  viewBox: '0 0 16 16',
  defaultSize: 16,
  paint: 'fill',
  content: <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Z" />,
});

/** Presence "away": clock hands. */
export const PresenceAwayIcon = /* @__PURE__ */ createIcon({
  name: 'presence-away',
  displayName: 'PresenceAwayIcon',
  viewBox: '0 0 16 16',
  defaultSize: 16,
  paint: 'stroke',
  content: <path d="M8 4.4V8l2.6 1.8" strokeWidth={1.8} />,
});

/** Presence "offline": a hollow ring with an X. */
export const PresenceOfflineIcon = /* @__PURE__ */ createIcon({
  name: 'presence-offline',
  displayName: 'PresenceOfflineIcon',
  viewBox: '0 0 16 16',
  defaultSize: 16,
  paint: 'stroke',
  content: (
    <>
      <circle cx={8} cy={8} r={6.5} strokeWidth={2.5} />
      <path d="M6 6l4 4m0-4l-4 4" strokeWidth={1.6} />
    </>
  ),
});

/** Presence "do not disturb": a horizontal bar. */
export const PresenceDndIcon = /* @__PURE__ */ createIcon({
  name: 'presence-dnd',
  displayName: 'PresenceDndIcon',
  viewBox: '0 0 16 16',
  defaultSize: 16,
  paint: 'stroke',
  content: <path d="M4.5 8h7" strokeWidth={2.2} />,
});

/** Presence "out of office": an arrow pointing left (physical; mirror it in RTL). */
export const PresenceOofIcon = /* @__PURE__ */ createIcon({
  name: 'presence-oof',
  displayName: 'PresenceOofIcon',
  viewBox: '0 0 16 16',
  defaultSize: 16,
  paint: 'stroke',
  content: <path d="M11.4 8H4.8m2.9-3L4.7 8l3 3" strokeWidth={1.8} />,
});
