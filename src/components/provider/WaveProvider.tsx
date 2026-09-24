import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { getThemeClassName, isWaveTheme, WAVE_THEMES, type WaveTheme } from '../../lib/theme';

// The theme helper lives in server-safe src/lib (no "use client"), so React Server Components can
// call it; it stays exported from here too.
export { getThemeClassName } from '../../lib/theme';
export type { WaveTheme } from '../../lib/theme';

/** Text direction for bidirectional layout support. */
export type WaveDir = 'ltr' | 'rtl';

/** Props accepted by {@link WaveProvider}. */
export interface WaveProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual theme applied to the subtree. Providers can be nested in any order: each root declares
   * its theme's tokens, so a light panel inside a dark app (and the reverse) renders correctly.
   * @default 'light'
   */
  theme?: WaveTheme;
  /**
   * Text direction for the subtree (also read by portaled overlays and keyboard navigation).
   * @default 'ltr'
   */
  dir?: WaveDir;
  /**
   * Element that portaled overlays (dialogs, popovers, menus, toasts) render into.
   * @default document.body
   */
  portalContainer?: HTMLElement | null;
  /** Content rendered inside the themed container. */
  children: React.ReactNode;
  /** Ref to the themed root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Value provided by {@link WaveProvider} and returned by {@link useWaveTheme}. */
export interface WaveContextValue {
  /** The active theme. */
  theme: WaveTheme;
  /** The active text direction. */
  dir: WaveDir;
  /**
   * Theme classes of the nearest provider (see {@link getThemeClassName}); portals put them on
   * their wrapper so overlays inherit the theme. `''` outside a provider (the page's own theme).
   */
  themeClassName: string;
  /** Element portaled overlays render into; `null` means `document.body`. */
  portalContainer: HTMLElement | null;
  /** `false` when no {@link WaveProvider} is above the caller (the defaults are returned). */
  hasProvider: boolean;
}

const DEFAULT_CONTEXT: WaveContextValue = {
  theme: 'light',
  dir: 'ltr',
  themeClassName: '',
  portalContainer: null,
  hasProvider: false,
};

const WaveContext = React.createContext<WaveContextValue>(DEFAULT_CONTEXT);

/**
 * Reads the theme, direction, theme classes and portal container of the nearest
 * {@link WaveProvider}. Outside a provider it returns light/ltr defaults with `hasProvider: false`.
 *
 * @returns The {@link WaveContextValue} of the nearest provider.
 */
export function useWaveTheme(): WaveContextValue {
  return React.useContext(WaveContext);
}

/**
 * Applies Wave theming to an application or subtree.
 *
 * - Renders a `<div class="wave-root wave-<theme>">` that declares the theme's tokens and paints
 *   the themed background, text colour and font (`bg-background text-foreground font-wave
 *   text-body-1`; a `className` passed by you wins). The precompiled `./styles` entry scopes its base
 *   styles and native-element reset to this root, so it is required there.
 * - Sets `dir` and `data-wave-theme` on the root. An unknown `theme` value (from untyped code)
 *   falls back to `'light'` — classes, `data-wave-theme` and the context value — and warns once in
 *   development.
 * - Provides theme, direction, theme classes and the portal container through context, so
 *   portaled overlays render with the same theme and direction.
 */
export const WaveProvider = ({
  theme = 'light',
  dir = 'ltr',
  portalContainer = null,
  children,
  className,
  ref,
  ...rest
}: WaveProviderProps) => {
  // An unknown value (untyped callers) renders, and is reported, as the light theme.
  const resolvedTheme: WaveTheme = isWaveTheme(theme) ? theme : 'light';
  const themeClassName = getThemeClassName(resolvedTheme);

  React.useEffect(() => {
    if (!isWaveTheme(theme)) {
      warnOnce(
        `WaveProvider:theme:${String(theme)}`,
        `WaveProvider: unknown theme "${String(theme)}". Valid themes: ${WAVE_THEMES.join(', ')}. Using "light".`,
      );
    }
  }, [theme]);

  const value = React.useMemo<WaveContextValue>(
    () => ({ theme: resolvedTheme, dir, themeClassName, portalContainer, hasProvider: true }),
    [resolvedTheme, dir, themeClassName, portalContainer],
  );

  return (
    <WaveContext.Provider value={value}>
      <div
        {...rest}
        ref={ref}
        dir={dir}
        data-wave-theme={resolvedTheme}
        className={cn(
          'wave-root',
          themeClassName,
          'bg-background text-foreground font-wave text-body-1',
          className,
        )}
      >
        {children}
      </div>
    </WaveContext.Provider>
  );
};

WaveProvider.displayName = 'WaveProvider';
