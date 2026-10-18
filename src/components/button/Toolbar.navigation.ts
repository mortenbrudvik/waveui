import type { Orientation } from '../../lib/types';
import { useRovingTabIndex, type RovingContainerProps } from '../../hooks/useRovingTabIndex';

/*
 * The roving configuration of a toolbar, shared by every component that renders one. Internal: it
 * imports nothing but the roving hook and a type, so a component that reads it pulls in no Toolbar
 * code.
 */

/**
 * Every focusable control a toolbar can contain, whatever component renders it (Toolbar,
 * TagGroup, and NavDrawer.Body's arrow mode). Matches that cannot take focus (a `type="hidden"`
 * input, a control CSS hides) are dropped by the roving hook.
 */
export const TOOLBAR_ITEM_SELECTOR =
  'button, [href], input, select, textarea, [role="button"], [tabindex]';

/** Options of {@link useToolbarNavigation}. */
export interface UseToolbarNavigationOptions {
  /** The arrow-key axis: Left/Right (mirrored in RTL) when horizontal, Up/Down when vertical. */
  orientation: Orientation;
}

/**
 * The one roving configuration of an APG toolbar (`buttons-22`), shared by Toolbar and TagGroup:
 * one Tab stop (the last focused control, at first the first enabled one), the arrow keys along
 * `orientation` only, Home and End, wrapping. The caller merges `containerProps.ref` with its own,
 * renders `data-roving-container`, composes its consumer's `onKeyDown` first and `onFocus` with
 * `checkDefaultPrevented: false`. Not spreading `containerProps` detaches the container, and the
 * hook then hands every control its own `tabIndex` back.
 */
export function useToolbarNavigation({ orientation }: UseToolbarNavigationOptions): {
  containerProps: RovingContainerProps;
} {
  const { containerProps } = useRovingTabIndex({
    itemSelector: TOOLBAR_ITEM_SELECTOR,
    manageTabIndex: true,
    tabStop: 'last-focused',
    orientation,
  });
  return { containerProps };
}
