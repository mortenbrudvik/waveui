import * as React from 'react';
import { cn } from '../../lib/cn';
import { hamburgerClassNames } from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { NavigationIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent, type Slot } from '../../lib/slot';
import type { Appearance, Size } from '../../lib/types';
import { Button } from '../button/Button';
import { unwrapButtonGlyph, withPartClass } from '../button/Button.slots';
import { NavDrawerContext } from './NavDrawer.context';

/*
 * Hamburger: a Button with the navigation glyph that toggles the NavDrawer it sits in. Reads only
 * the NavDrawer's context module (never `NavDrawer.tsx`), so it holds no drawer machinery.
 */

/** Properties for the Hamburger component. */
export interface HamburgerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style. Fluent's `transparent` look is WaveUI's `subtle` (WaveUI's `transparent` is
   * link-coloured).
   * @default 'subtle'
   */
  appearance?: Appearance;
  /**
   * Size: the button's height and the glyph (12, 16, 20, 24 or 28px).
   * @default 'medium'
   */
  size?: Size;
  /**
   * Replaces the navigation glyph (three bars). Decorative (`aria-hidden`). Unlike Button's `icon`,
   * a Hamburger always shows a glyph: `null`, `undefined` and a value that renders nothing keep
   * the default (the last warns in development). A `<button>` or `Button` passed here is not
   * nested: its children become the glyph and its props are dropped, with a warning.
   */
  icon?: Slot<'span'>;
  /**
   * The button's name. Without `aria-label`, `aria-labelledby`, `title` or a visible label
   * (children), the Hamburger is named "Navigation"; localize it here. The name stays the same
   * while the drawer opens and closes (the state is `aria-expanded`).
   * @default 'Navigation'
   */
  'aria-label'?: string;
  /**
   * Unavailable but focusable (see `Button.disabledFocusable`): no toggle, no `onClick`.
   * @default false
   */
  disabledFocusable?: boolean;
  /** Ref to the `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

/** The default glyph's size per button size. */
const GLYPH_SIZES: Readonly<Record<Size, number>> = {
  'extra-small': 12,
  small: 16,
  medium: 20,
  large: 24,
  'extra-large': 28,
};

/**
 * A button that opens and closes a navigation drawer: a `Button` (`subtle`, icon-only) with the
 * navigation glyph, named "Navigation" by default. Inside a `NavDrawer` (in its header) it toggles
 * that drawer and reports it with `aria-expanded` and `aria-controls`. Elsewhere (your page
 * header) it is a plain button: pass `aria-expanded={open}`, `aria-controls` (while the drawer's
 * panel is rendered) and, for an overlay drawer, `aria-haspopup="dialog"`, and toggle your state
 * in `onClick`. Fluent's `Hamburger`.
 *
 * @example
 * <Hamburger
 *   aria-expanded={open}
 *   aria-controls={open ? 'main-nav' : undefined}
 *   aria-haspopup="dialog"
 *   onClick={() => setOpen(!open)}
 * />
 */
export const Hamburger = ({
  appearance = 'subtle',
  size = 'medium',
  icon,
  onClick,
  className,
  children,
  ref,
  ...rest
}: HamburgerProps) => {
  const drawer = React.useContext(NavDrawerContext);

  // A required indicator (C-SLOTS): a button passed as `icon` is unwrapped, never nested, and a
  // value that renders nothing keeps the default glyph.
  const { glyph, button: iconButton } = unwrapButtonGlyph(icon);
  const glyphRenders = slotRendersContent(glyph);
  // An unwrapped button reports its own warning only.
  const iconEmpty = iconButton === null && icon != null && !glyphRenders;
  React.useEffect(() => {
    if (iconEmpty) {
      warnOnce(
        'Hamburger:icon-empty',
        'Hamburger: `icon` renders nothing, so the default navigation glyph shows. Unlike `Button`, a Hamburger always shows a glyph: pass an icon, or leave `icon` unset.',
      );
    }
  }, [iconEmpty]);
  React.useEffect(() => {
    if (iconButton) {
      warnOnce(
        'Hamburger:icon-button',
        `Hamburger: \`icon\` received ${iconButton}; its children render as the glyph and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. \`icon={<MyIcon />}\`.`,
      );
    }
  }, [iconButton]);

  // The default name, while nothing else names the button. A generator label is read once; its
  // items are what renders.
  const label = materialiseSlotContent(children);
  const named =
    Boolean(rest['aria-label']) ||
    Boolean(rest['aria-labelledby']) ||
    Boolean(rest.title) ||
    slotRendersContent(label);

  // Inside a NavDrawer: the toggle, after the consumer's onClick (`preventDefault()` skips it).
  const toggle = drawer
    ? (event: React.MouseEvent<HTMLButtonElement>) =>
        drawer.requestOpen(!drawer.open, { reason: 'trigger', event: event.nativeEvent })
    : undefined;
  // The drawer's state wins over a consumer's (the modal triggers' rule).
  const stateProps = drawer
    ? { 'aria-expanded': drawer.open, 'aria-controls': drawer.panelId }
    : undefined;

  return (
    <Button
      {...rest}
      aria-label={named ? rest['aria-label'] : 'Navigation'}
      {...stateProps}
      ref={ref}
      appearance={appearance}
      size={size}
      icon={withPartClass(
        glyphRenders ? glyph : <NavigationIcon size={GLYPH_SIZES[size]} />,
        hamburgerClassNames.icon,
      )}
      onClick={composeEventHandlers(onClick, toggle)}
      className={cn(hamburgerClassNames.root, className)}
    >
      {label}
    </Button>
  );
};
Hamburger.displayName = 'Hamburger';
