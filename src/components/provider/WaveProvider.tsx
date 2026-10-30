import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { waveProviderClassNames } from '../../lib/classNames';
import { getThemeClassName, isWaveTheme, WAVE_THEMES, type WaveTheme } from '../../lib/theme';
import {
  collectTokenStyle,
  mergeTokenOverrides,
  type TokenStyle,
  type WaveTokenOverrides,
} from '../../lib/tokens';
import type { CoreSize, InputAppearance, MotionPreference } from '../../lib/types';

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
  /**
   * Motion of the subtree. `'none'` makes every motion slot below it (a part's `motion`,
   * `backdropMotion`, `expandIconMotion` or `indeterminateMotion` left unset) behave as `null`,
   * which also stops the slide of TabList's selection line, and turns off Carousel's slide or fade
   * (a Carousel without its own `motion`) and the reveal of Nav item actions; a part's own value
   * still wins. Transitions that are no motion slot keep running: the turn of Accordion's and
   * Tree's chevrons, colour changes on hover and press. Fluent's `MotionBehaviourProvider` with `'skip'` is the counterpart, which
   * `@fluentui/react-components` does not export. A nested provider inherits an omitted `motion`
   * like `theme`.
   * @default the enclosing WaveProvider's motion, else 'default'
   */
  motion?: MotionPreference;
  /**
   * Design token overrides for the subtree: CSS values by token name, the CSS variable in camelCase
   * without its `--wave-` prefix (`brand80` for `--wave-brand-80`, `primaryForeground` for
   * `--wave-primary-foreground`; a number is written as its string). `theme` still names one of
   * the three themes, and the overrides apply over it as inline custom properties on the root and
   * on every portal of the subtree (see `applyStylesToPortals`), so its dialogs, menus, popovers,
   * tooltips and toasts take them too. Fluent's `theme` prop with a partial theme is the
   * counterpart.
   *
   * A nested provider merges its overrides over the enclosing provider's, key by key: an omitted
   * `tokens` inherits them all, and a key whose value is `undefined` inherits that key. `null`
   * clears the inherited overrides of the tokens the theme declares (the semantic colours, shadows,
   * palette) and of the subtree's overlays; theme-independent tokens (the brand and grey ramps,
   * font families, stacking order, motion durations and curves) of an enclosing provider still
   * reach the subtree's own elements through the CSS cascade, and the theme's colours built on the
   * brand ramp follow them there. A nested provider that sets another `theme` inherits the
   * overrides too, so set an override of a semantic colour (`primary`) in the provider that sets
   * the theme it was chosen for. A whole brand ramp is better made with `createBrandTokens` than
   * written by hand.
   * A key that is not a camelCase identifier, or a value that is neither a finite number nor a
   * string without `;`, `{` or `}` (such a value could add a declaration of its own to the
   * server-rendered `style` attribute), is skipped with a development warning; a well-formed name
   * is not checked against the list of tokens (TypeScript refuses a misspelled one).
   *
   * The overrides are rendered on the server too. Under a Content Security Policy that blocks
   * inline style attributes (`style-src` without `'unsafe-inline'`), the server-rendered overrides
   * do not apply and hydration does not apply them again: ship them in a stylesheet there, and pass
   * no `tokens` (nor `getTokenStyle`), since the overlays and the subtrees rendered in the client
   * would still take them and leave the page half branded.
   *
   * @example
   * <WaveProvider tokens={{ fontFamily: 'Inter, sans-serif', zOverlay: 2000 }}>
   * @default the enclosing WaveProvider's overrides, else none
   */
  tokens?: WaveTokenOverrides | null;
  /**
   * Whether the portals of the subtree (dialogs, popovers, menus, tooltips, toasts) carry the
   * overrides of `tokens`. `false` leaves them out: an overlay then shows its theme's own values
   * for the tokens the theme declares, and keeps the surrounding cascade (that of the element it
   * renders into) for the theme-independent ones. The theme classes and the direction are set on
   * every portal either way, so an overlay of a dark provider is still dark. Fluent's
   * `applyStylesToPortals` is the counterpart; unlike Fluent's, a nested provider inherits an
   * omitted value, like `theme`.
   * @default the enclosing WaveProvider's value, else true
   */
  applyStylesToPortals?: boolean;
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
  /** The motion preference of the providers above (`'default'` outside a provider). */
  motion: MotionPreference;
  /**
   * The merged token overrides of the providers above (`{}` outside a provider), as given: an
   * entry skipped for a malformed key or value stays in it, and only `tokenStyle` leaves it out.
   */
  tokens: WaveTokenOverrides;
  /**
   * The inline style that applies `tokens`, as the provider's root and, unless
   * `applyStylesToPortals` is `false`, its portals carry it; `undefined` when there is nothing to
   * set (also outside a provider).
   */
  tokenStyle: TokenStyle | undefined;
  /** Whether portals carry `tokenStyle` (`true` outside a provider). */
  applyStylesToPortals: boolean;
  /** `false` when no {@link WaveProvider} is above the caller (the defaults are returned). */
  hasProvider: boolean;
}

const DEFAULT_CONTEXT: WaveContextValue = {
  theme: 'light',
  dir: 'ltr',
  themeClassName: '',
  portalContainer: null,
  inputDefaults: {},
  motion: 'default',
  tokens: {},
  tokenStyle: undefined,
  applyStylesToPortals: true,
  hasProvider: false,
};

const WaveContext = React.createContext<WaveContextValue>(DEFAULT_CONTEXT);

/** Whether two override maps have the same keys in the same order, with the same values. */
function sameTokens(a: WaveTokenOverrides, b: WaveTokenOverrides): boolean {
  const keys = Object.keys(a) as (keyof WaveTokenOverrides)[];
  const others = Object.keys(b);
  return (
    keys.length === others.length &&
    keys.every((key, index) => key === others[index] && Object.is(a[key], b[key]))
  );
}

/**
 * Reads the theme, direction, theme classes, portal container and token overrides of the nearest
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
 * - `motion="none"` turns the default motion of every animated part below it off (its motion
 *   slots, Carousel's slide, TabList's sliding line, the reveal of Nav item actions; a part's own
 *   `motion` still wins), while transitions without a slot keep running (Accordion's and Tree's
 *   chevron turns, colour changes); a nested provider inherits an omitted `motion` like `theme`.
 * - `tokens` overrides design tokens in the subtree with inline custom properties on the root
 *   (rendered on the server too) and on every portal of the subtree, unless
 *   `applyStylesToPortals` is `false`. A nested provider merges its overrides over the enclosing
 *   provider's key by key, also when it sets another `theme`; `tokens={null}` clears them for the
 *   tokens the theme declares and for the overlays, while the theme-independent ones of an
 *   enclosing provider still reach the subtree through the CSS cascade. An override whose key is
 *   not a camelCase identifier, or whose value is neither a finite number nor a string without
 *   `;`, `{` or `}`, is skipped with a development warning. Without overrides the root renders no
 *   `style` attribute unless you pass `style`.
 */
export const WaveProvider = ({
  theme: themeProp,
  dir: dirProp,
  portalContainer: portalContainerProp,
  inputDefaults: inputDefaultsProp,
  motion: motionProp,
  tokens: tokensProp,
  applyStylesToPortals: applyStylesToPortalsProp,
  children,
  className,
  style,
  ref,
  ...rest
}: WaveProviderProps) => {
  // Omitted props come from the enclosing provider; outside one, DEFAULT_CONTEXT supplies the
  // top-level defaults. An explicit `portalContainer={null}` means document.body, so only
  // `undefined` inherits.
  const parent = React.useContext(WaveContext);
  const theme = themeProp ?? parent.theme;
  const dir = dirProp ?? parent.dir;
  const motion = motionProp ?? parent.motion;
  const applyStylesToPortals = applyStylesToPortalsProp ?? parent.applyStylesToPortals;
  const portalContainer =
    portalContainerProp === undefined ? parent.portalContainer : portalContainerProp;

  // The own overrides merged over the enclosing provider's. The merged map keeps its identity while
  // its entries are equal (a previous-value state, C-HOOKS), so an inline `tokens={{ … }}` neither
  // re-renders the consumers nor rebuilds the style.
  const mergedTokens = mergeTokenOverrides(parent.tokens, tokensProp);
  const [tokens, setTokens] = React.useState(mergedTokens);
  if (!sameTokens(tokens, mergedTokens)) setTokens(mergedTokens);
  // Collected without warnings during render; the skipped entries are reported from an effect.
  const { style: tokenStyle, invalid } = React.useMemo(() => collectTokenStyle(tokens), [tokens]);

  React.useEffect(() => {
    for (const { key, reason } of invalid) {
      warnOnce(
        `WaveProvider:tokens:${reason}:${key}`,
        `WaveProvider: \`tokens\` skips \`${key}\`: ` +
          (reason === 'name'
            ? 'not a token name (the CSS variable in camelCase without `--wave-`, such as `primaryForeground`).'
            : 'its value must be a finite number or a string without `;`, `{` or `}`.'),
      );
    }
  }, [invalid]);

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
      motion,
      tokens,
      tokenStyle,
      applyStylesToPortals,
      hasProvider: true,
    }),
    [
      resolvedTheme,
      dir,
      themeClassName,
      portalContainer,
      inputDefaults,
      motion,
      tokens,
      tokenStyle,
      applyStylesToPortals,
    ],
  );

  return (
    <WaveContext.Provider value={value}>
      <div
        {...rest}
        // The merged overrides (a nested root re-declares what its theme class would shadow), then
        // the consumer's `style`, which wins. Without overrides the consumer's `style` as given, so
        // the root has no style attribute unless the consumer passes one.
        style={tokenStyle ? { ...tokenStyle, ...style } : style}
        ref={ref}
        dir={dir}
        data-wave-theme={resolvedTheme}
        className={cn(
          waveProviderClassNames.root,
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
