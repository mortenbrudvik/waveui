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
 *
 * The table ships with every import of `WaveProvider`, so it is written compactly and expanded on
 * first use: the brand ramp as its hex digits (stops 10 to 160 in steps of 10), the grey ramp as
 * its stops (a stop is a percentage of 255: `grey50` is `#808080`), and the durations and curves as
 * a suffix and a number list.
 */
type DefaultsTable = { [K in WaveTokenName]?: string };

let defaultsTable: DefaultsTable | undefined;

/** Adds `prefix + word` for each `word value` pair of `pairs`, the value mapped by `format`. */
function addPairs(
  table: Record<string, string>,
  prefix: string,
  pairs: string,
  format: (value: string) => string,
): void {
  const words = pairs.split(' ');
  for (let index = 0; index < words.length; index += 2) {
    table[prefix + words[index]] = format(words[index + 1]);
  }
}

function themeIndependentDefaults(): DefaultsTable {
  if (defaultsTable) return defaultsTable;
  const sans =
    "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif";
  const table: Record<string, string> = {
    fontFamily: sans,
    fontFamilyMonospace: "Consolas, 'Courier New', Courier, monospace",
    fontFamilyNumeric: 'Bahnschrift, ' + sans,
    zOverlay: '1000',
    zToast: '1100',
    zTooltip: '1200',
  };
  addPairs(
    table,
    'duration',
    'UltraFast 50 Faster 100 Fast 150 Normal 200 Gentle 250 Slow 300 Slower 400 UltraSlow 500',
    (value) => value + 'ms',
  );
  addPairs(
    table,
    'curve',
    'AccelerateMax 0.9,0.1,1,0.2 AccelerateMid 1,0,1,1 AccelerateMin 0.8,0,0.78,1 DecelerateMax 0.1,0.9,0.2,1 DecelerateMid 0,0,0,1 DecelerateMin 0.33,0,0.1,1 EasyEaseMax 0.8,0,0.2,1 EasyEase 0.33,0,0.67,1 Linear 0,0,1,1',
    (value) => 'cubic-bezier(' + value.replaceAll(',', ', ') + ')',
  );
  '061724 082338 0a2e4a 0c3b5e 0e4775 0f548c 115ea3 0f6cbd 2886de 479ef5 62abf5 77b7f7 96c6fa b4d6fa cfe4fa ebf3fc'
    .split(' ')
    .forEach((hex, index) => {
      table['brand' + (index + 1) * 10] = '#' + hex;
    });
  '2 4 6 8 10 12 14 16 20 24 26 30 34 38 40 44 50 60 68 74 78 82 86 88 90 92 94 96 98'
    .split(' ')
    .forEach((stop) => {
      const byte = Math.round((+stop * 255) / 100)
        .toString(16)
        .padStart(2, '0');
      table['grey' + stop] = '#' + byte + byte + byte;
    });
  return (defaultsTable = table as DefaultsTable);
}

/**
 * The inline style that resets the theme-independent tokens that `inherited` overrides: one
 * `--wave-*` custom property per such key, set to the stylesheet's value. `undefined` when
 * `inherited` overrides none of them (the tokens a theme declares are reset by the theme class on
 * the same element, so they need nothing). The keys keep the order of `inherited`.
 */
export function resetTokenStyle(inherited: WaveTokenOverrides): TokenStyle | undefined {
  let style: Record<string, string> | undefined;
  for (const key of Object.keys(inherited)) {
    const defaults = themeIndependentDefaults();
    const fallback = Object.hasOwn(defaults, key) ? defaults[key as WaveTokenName] : undefined;
    if (fallback === undefined || inherited[key as WaveTokenName] === undefined) continue;
    (style ??= {})[tokenVariable(key)] = fallback;
  }
  return style as TokenStyle | undefined;
}
