import {
  tokenVariable,
  type TokenStyle,
  type WaveTokenName,
  type WaveTokenOverrides,
} from './tokens';

/**
 * The stylesheet's own values of the theme-independent tokens: the ones `tokens.css` declares once
 * on `:root` (the font families, the stacking layers, the motion durations and curves, the brand
 * and grey ramps), where the three themes declare the rest per theme. `WaveProvider` writes them
 * on a root whose `tokens` is `null`, for the tokens an enclosing provider overrode, so the
 * subtree is reset to the library's values (an inline override on an enclosing element reaches
 * every descendant through the cascade, and a theme class cannot shadow these, since it does not
 * declare them). A parity test keeps the table equal to the `:root` block of `tokens.css`.
 * Module-only: the provider is the only caller, and an import of anything else carries none of it.
 */
const THEME_INDEPENDENT_DEFAULTS: { readonly [K in WaveTokenName]?: string } = {
  fontFamily:
    "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif",
  fontFamilyMonospace: "Consolas, 'Courier New', Courier, monospace",
  fontFamilyNumeric:
    "Bahnschrift, 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif",
  zOverlay: '1000',
  zToast: '1100',
  zTooltip: '1200',
  durationUltraFast: '50ms',
  durationFaster: '100ms',
  durationFast: '150ms',
  durationNormal: '200ms',
  durationGentle: '250ms',
  durationSlow: '300ms',
  durationSlower: '400ms',
  durationUltraSlow: '500ms',
  curveAccelerateMax: 'cubic-bezier(0.9, 0.1, 1, 0.2)',
  curveAccelerateMid: 'cubic-bezier(1, 0, 1, 1)',
  curveAccelerateMin: 'cubic-bezier(0.8, 0, 0.78, 1)',
  curveDecelerateMax: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
  curveDecelerateMid: 'cubic-bezier(0, 0, 0, 1)',
  curveDecelerateMin: 'cubic-bezier(0.33, 0, 0.1, 1)',
  curveEasyEaseMax: 'cubic-bezier(0.8, 0, 0.2, 1)',
  curveEasyEase: 'cubic-bezier(0.33, 0, 0.67, 1)',
  curveLinear: 'cubic-bezier(0, 0, 1, 1)',
  brand10: '#061724',
  brand20: '#082338',
  brand30: '#0a2e4a',
  brand40: '#0c3b5e',
  brand50: '#0e4775',
  brand60: '#0f548c',
  brand70: '#115ea3',
  brand80: '#0f6cbd',
  brand90: '#2886de',
  brand100: '#479ef5',
  brand110: '#62abf5',
  brand120: '#77b7f7',
  brand130: '#96c6fa',
  brand140: '#b4d6fa',
  brand150: '#cfe4fa',
  brand160: '#ebf3fc',
  grey2: '#050505',
  grey4: '#0a0a0a',
  grey6: '#0f0f0f',
  grey8: '#141414',
  grey10: '#1a1a1a',
  grey12: '#1f1f1f',
  grey14: '#242424',
  grey16: '#292929',
  grey20: '#333333',
  grey24: '#3d3d3d',
  grey26: '#424242',
  grey30: '#4d4d4d',
  grey34: '#575757',
  grey38: '#616161',
  grey40: '#666666',
  grey44: '#707070',
  grey50: '#808080',
  grey60: '#999999',
  grey68: '#adadad',
  grey74: '#bdbdbd',
  grey78: '#c7c7c7',
  grey82: '#d1d1d1',
  grey86: '#dbdbdb',
  grey88: '#e0e0e0',
  grey90: '#e6e6e6',
  grey92: '#ebebeb',
  grey94: '#f0f0f0',
  grey96: '#f5f5f5',
  grey98: '#fafafa',
};

/**
 * The inline style that resets the theme-independent tokens that `inherited` overrides: one
 * `--wave-*` custom property per such key, set to the stylesheet's value. `undefined` when
 * `inherited` overrides none of them (the tokens a theme declares are reset by the theme class on
 * the same element, so they need nothing). The keys keep the order of `inherited`.
 */
export function resetTokenStyle(inherited: WaveTokenOverrides): TokenStyle | undefined {
  let style: Record<string, string> | undefined;
  for (const key of Object.keys(inherited)) {
    const fallback = Object.hasOwn(THEME_INDEPENDENT_DEFAULTS, key)
      ? THEME_INDEPENDENT_DEFAULTS[key as WaveTokenName]
      : undefined;
    if (fallback === undefined || inherited[key as WaveTokenName] === undefined) continue;
    (style ??= {})[tokenVariable(key)] = fallback;
  }
  return style as TokenStyle | undefined;
}
