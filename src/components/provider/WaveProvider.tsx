import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { getThemeClassName, isWaveTheme, WAVE_THEMES, type WaveTheme } from '../../lib/theme';
import type { CoreSize, InputAppearance } from '../../lib/types';

// The theme helper lives in server-safe src/lib (no "use client"), so React Server Components can
// call it; it stays exported from here too.
export { getThemeClassName } from '../../lib/theme';
export type { WaveTheme } from '../../lib/theme';

/** Text direction for bidirectional layout support. */
export type WaveDir = 'ltr' | 'rtl';

/** Default size and appearance of the text inputs and pickers in a subtree. */
export interface InputDefaults {
  /** Default `size` of Input, Textarea, Select, SearchBox, SpinButton and the pickers. */
  size?: CoreSize;
  /** Default `appearance` of the same controls. */
  appearance?: InputAppearance;
}

/** Props accepted by {@link WaveProvider}. */
export interface WaveProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual theme applied to the subtree. Providers can be nested in any order: each root declares
   * its theme's tokens, so a light panel inside a dark app (and the reverse) renders correctly.
   * @default the enclosing WaveProvider's theme, else 'light'
   */
  theme?: WaveTheme;
  /**
   * Text direction for the subtree (also read by portaled overlays and keyboard navigation).
   * @default the enclosing WaveProvider's direction, else 'ltr'
   */
  dir?: WaveDir;
  /**
   * Element that portaled overlays (dialogs, popovers, menus, toasts) render into. `null` renders
   * them into `document.body`, also inside a provider that sets a container.
   * @default the enclosing WaveProvider's container, else document.body
   */
  portalContainer?: HTMLElement | null;
  /**
   * Default `size` and `appearance` of the text inputs and pickers in the subtree (Input,
   * Textarea, Select, SearchBox, SpinButton, Combobox, Dropdown, DatePicker, TimePicker,
   * TagPicker). Their own props and a Field's `size` win. A nested provider merges its keys over
   * the enclosing provider's; an omitted key is inherited.
   * @default the enclosing WaveProvider's defaults, else none (`medium`, `outline`)
   */
  inputDefaults?: InputDefaults;
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
  /** The merged input defaults of the providers above (`{}` outside a provider). */
  inputDefaults: InputDefaults;
  /** `false` when no {@link WaveProvider} is above the caller (the defaults are returned). */
  hasProvider: boolean;
}

const DEFAULT_CONTEXT: WaveContextValue = {
  theme: 'light',
  dir: 'ltr',
  themeClassName: '',
  portalContainer: null,
  inputDefaults: {},
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
 * - Nests: a provider inherits every prop it omits (`theme`, `dir`, `portalContainer`) from the
 *   enclosing provider, so `<WaveProvider theme="light">` inside an RTL app is a light panel that
 *   stays right-to-left and keeps the app's portal container. At the top level the defaults are
 *   `'light'`, `'ltr'` and `document.body`.
 * - `inputDefaults` nests differently: a nested provider's defined keys override the enclosing
 *   provider's, and an omitted key is inherited, so setting only `appearance` in a nested provider
 *   keeps the enclosing provider's `size`.
 */
export const WaveProvider = ({
  theme: themeProp,
  dir: dirProp,
  portalContainer: portalContainerProp,
  inputDefaults: inputDefaultsProp,
  children,
  className,
  ref,
  ...rest
}: WaveProviderProps) => {
  // Omitted props come from the enclosing provider; outside one, DEFAULT_CONTEXT supplies the
  // top-level defaults. An explicit `portalContainer={null}` means document.body, so only
  // `undefined` inherits.
  const parent = React.useContext(WaveContext);
  const theme = themeProp ?? parent.theme;
  const dir = dirProp ?? parent.dir;
  const portalContainer =
    portalContainerProp === undefined ? parent.portalContainer : portalContainerProp;

  // Defined keys override the enclosing provider's; the merged object keeps its identity while the
  // two values are equal, so an inline `inputDefaults={{ … }}` does not re-render every input.
  const size = inputDefaultsProp?.size ?? parent.inputDefaults.size;
  const appearance = inputDefaultsProp?.appearance ?? parent.inputDefaults.appearance;
  const inputDefaults = React.useMemo<InputDefaults>(() => {
    const merged: InputDefaults = {};
    if (size !== undefined) merged.size = size;
    if (appearance !== undefined) merged.appearance = appearance;
    return merged;
  }, [size, appearance]);

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
    () => ({
      theme: resolvedTheme,
      dir,
      themeClassName,
      portalContainer,
      inputDefaults,
      hasProvider: true,
    }),
    [resolvedTheme, dir, themeClassName, portalContainer, inputDefaults],
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
