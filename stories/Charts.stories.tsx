import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Switch, chartPalette, cn, useId, waveTokens } from '../src';
import type { WaveTokenName } from '../src';

// Chart.js is tree-shakable: a bar chart registers its controller, element, scales and plugins.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Legend, ChartTooltip);

// ---------------------------------------------------------------------------
// Data and encodings shared by both stories
// ---------------------------------------------------------------------------

const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

const regions = [
  { key: 'north', name: 'North', values: [42, 47, 51, 58] },
  { key: 'south', name: 'South', values: [35, 38, 36, 41] },
  { key: 'east', name: 'East', values: [28, 33, 39, 44] },
  { key: 'west', name: 'West', values: [31, 29, 34, 37] },
  { key: 'central', name: 'Central', values: [22, 26, 25, 30] },
  { key: 'online', name: 'Online', values: [18, 27, 38, 49] },
] as const;

/**
 * The second encoding, which does not rely on colour: a fill pattern per series, drawn on a tile
 * of `PATTERN_SIZE` pixels. The SVG chart draws the paths in a `<pattern>`, the canvas chart the
 * same paths through `Path2D`; `paint` says whether a path is stroked (lines) or filled (dots).
 */
interface SeriesPattern {
  d?: string;
  paint?: 'fill' | 'stroke';
}

const PATTERN_SIZE = 8;
const PATTERN_STROKE = 1.5;

const patterns: readonly SeriesPattern[] = [
  {}, // solid
  { d: 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4', paint: 'stroke' }, // diagonal lines
  { d: 'M2.4,4 a1.6,1.6 0 1,0 3.2,0 a1.6,1.6 0 1,0 -3.2,0', paint: 'fill' }, // dots
  { d: 'M2,0 v8 M6,0 v8', paint: 'stroke' }, // vertical lines
  { d: 'M0,4 h8 M4,0 v8', paint: 'stroke' }, // cross-hatch
  { d: 'M-2,6 l4,4 M0,0 l8,8 M6,-2 l4,4', paint: 'stroke' }, // back-diagonal lines
];

/** Each region with its fill, in `chartPalette` order, and its pattern. */
const series = regions.map((region, index) => ({
  ...region,
  fill: chartPalette[index],
  pattern: patterns[index],
}));

/** Whether `name` is a token name: `waveTokens` has a key for every one. */
function isTokenName(name: string): name is WaveTokenName {
  return name in waveTokens;
}

/**
 * The text colour of a palette fill (`paletteBlue` gives `paletteBlueForeground`). It inks the
 * patterns: it is readable on its fill in every theme, black on the white fills of high contrast.
 */
function foregroundOf(fill: WaveTokenName): WaveTokenName {
  const name = `${fill}Foreground`;
  return isTokenName(name) ? name : 'foreground';
}

const CHART_TITLE = 'Units sold per quarter, by region';
const CHART_LABEL = 'Bar chart of the units sold per quarter in each of six regions';
const CHART_DESCRIPTION =
  'Thousands of units sold in each quarter of 2026 in six regions. North sells the most in every quarter; Online grows the fastest, from 18 thousand in Q1 to 49 thousand in Q4. Each region also has a fill pattern of its own, so the chart reads without colour.';

// ---------------------------------------------------------------------------
// Colours: tokens in the themes, system colours in forced-colors mode
// ---------------------------------------------------------------------------

/** A system colour of forced-colors mode. */
type SystemColor = 'Canvas' | 'CanvasText' | 'GrayText';

interface SeriesColors {
  fill: string;
  ink: string;
}

/** Every colour a chart draws with. Text never takes a series colour. */
interface ChartColors {
  text: string;
  mutedText: string;
  grid: string;
  cursor: string;
  tooltip: { background: string; text: string; border: string };
  series: SeriesColors[];
}

/**
 * The chart's colours: `token` turns a token name into a colour the library can draw (a `var()`
 * for SVG, a resolved value for a canvas) and `system` does the same for a system colour. In
 * forced-colors mode the chart draws with system colours, the way the high-contrast theme draws
 * it: every bar in the text colour, its pattern in the page colour.
 */
function chartColors(
  forcedColors: boolean,
  token: (name: WaveTokenName) => string,
  system: (color: SystemColor) => string,
): ChartColors {
  if (forcedColors) {
    const text = system('CanvasText');
    const page = system('Canvas');
    return {
      text,
      mutedText: text,
      grid: system('GrayText'),
      cursor: page,
      tooltip: { background: page, text, border: text },
      series: series.map(() => ({ fill: text, ink: page })),
    };
  }
  return {
    text: token('foreground'),
    mutedText: token('mutedForeground'),
    grid: token('border'),
    cursor: token('subtleHover'),
    tooltip: {
      background: token('inverted'),
      text: token('invertedForeground'),
      border: token('invertedBorder'),
    },
    series: series.map(({ fill }) => ({ fill: token(fill), ink: token(foregroundOf(fill)) })),
  };
}

const FORCED_COLORS = '(forced-colors: active)';

function subscribeToForcedColors(onChange: () => void): () => void {
  const query = window.matchMedia(FORCED_COLORS);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether forced colors (Windows High Contrast) are active. */
function useForcedColors(): boolean {
  return React.useSyncExternalStore(
    subscribeToForcedColors,
    () => window.matchMedia(FORCED_COLORS).matches,
    () => false,
  );
}

// ---------------------------------------------------------------------------
// The accessible frame shared by both stories
// ---------------------------------------------------------------------------

/** The data of the chart as a table: the fallback that screen readers and keyboards can read. */
function SalesTable() {
  const cell = 'border-b border-border px-3 py-2';
  return (
    <table className="w-full border-collapse text-body-1">
      <caption className="pb-2 text-start font-semibold">
        Units sold per quarter, by region (thousands)
      </caption>
      <thead>
        <tr>
          <th scope="col" className={cn(cell, 'text-start font-semibold')}>
            Region
          </th>
          {quarters.map((quarter) => (
            <th key={quarter} scope="col" className={cn(cell, 'text-end font-semibold')}>
              {quarter}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {regions.map((region) => (
          <tr key={region.key}>
            <th scope="row" className={cn(cell, 'text-start font-normal')}>
              {region.name}
            </th>
            {region.values.map((value, index) => (
              <td key={quarters[index]} className={cn(cell, 'text-end tabular-nums')}>
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A chart as an image with a name and a description, followed by its data table. The table is
 * always in the accessibility tree; the switch only makes it visible. In forced-colors mode the
 * chart keeps the system colours it chose (`chartColors`) instead of having them replaced.
 */
function ChartFigure({ children }: { children: React.ReactNode }) {
  const descriptionId = useId('chart-description');
  const [showTable, setShowTable] = React.useState(false);
  return (
    <div className="flex max-w-2xl flex-col gap-4 p-6">
      <h3 className="text-subtitle-1 font-semibold">{CHART_TITLE}</h3>
      <div
        role="img"
        aria-label={CHART_LABEL}
        aria-describedby={descriptionId}
        className="flex flex-col gap-3 forced-colors:forced-color-adjust-none"
      >
        {children}
      </div>
      <p id={descriptionId} className="text-body-1 text-muted-foreground">
        {CHART_DESCRIPTION}
      </p>
      <Switch label="Show the data table" checked={showTable} onCheckedChange={setShowTable} />
      <div className={cn(!showTable && 'sr-only')}>
        <SalesTable />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recharts (SVG): the tokens go in as `var()` and follow the theme on their own
// ---------------------------------------------------------------------------

/** The fill of series `index` in the SVG chart: its pattern, or its colour for the solid one. */
function svgFill(patternId: string, colors: ChartColors, index: number): string {
  return series[index].pattern.d ? `url(#${patternId}-${index})` : colors.series[index].fill;
}

/**
 * The pattern of each series, in an SVG of its own so that the bars and the legend swatches can
 * both refer to it. Not `display: none`, which would stop the patterns from painting.
 */
function SvgPatterns({ id, colors }: { id: string; colors: ChartColors }) {
  return (
    <svg aria-hidden width={0} height={0} className="absolute">
      <defs>
        {series.map(({ key, pattern }, index) =>
          pattern.d ? (
            <pattern
              key={key}
              id={`${id}-${index}`}
              width={PATTERN_SIZE}
              height={PATTERN_SIZE}
              patternUnits="userSpaceOnUse"
            >
              <rect width={PATTERN_SIZE} height={PATTERN_SIZE} fill={colors.series[index].fill} />
              <path
                d={pattern.d}
                fill={pattern.paint === 'fill' ? colors.series[index].ink : 'none'}
                stroke={pattern.paint === 'stroke' ? colors.series[index].ink : 'none'}
                strokeWidth={PATTERN_STROKE}
              />
            </pattern>
          ) : null,
        )}
      </defs>
    </svg>
  );
}

/**
 * The legend, in HTML under the chart. Recharts' own legend draws each swatch at less than half
 * scale, too small to show a pattern; these swatches draw it at full size.
 */
function SvgLegend({ patternId, colors }: { patternId: string; colors: ChartColors }) {
  return (
    <ul
      className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-caption-1"
      style={{ color: colors.text }}
    >
      {series.map((item, index) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <svg aria-hidden width={16} height={16} className="shrink-0">
            <rect width={16} height={16} rx={2} fill={svgFill(patternId, colors, index)} />
          </svg>
          {item.name}
        </li>
      ))}
    </ul>
  );
}

const rechartsData = quarters.map((quarter, index) => ({
  quarter,
  ...Object.fromEntries(regions.map((region) => [region.key, region.values[index]])),
}));

/**
 * Recharts measures text in a hidden span that it appends to `document.body` and keeps there;
 * removing it when the chart unmounts leaves the page as the story found it (Recharts creates it
 * again when a chart next measures).
 */
function useRechartsMeasurementCleanup() {
  React.useEffect(() => () => document.getElementById('recharts_measurement_span')?.remove(), []);
}

function RechartsExample() {
  const patternId = useId('recharts-pattern');
  const forcedColors = useForcedColors();
  const colors = chartColors(
    forcedColors,
    (name) => waveTokens[name],
    (color) => color,
  );
  useRechartsMeasurementCleanup();
  return (
    <ChartFigure>
      <SvgPatterns id={patternId} colors={colors} />
      <BarChart
        data={rechartsData}
        // The frame is the image; its data table is the keyboard and screen-reader route, so the
        // chart's own keyboard layer (an `application` with a tab stop) stays off.
        accessibilityLayer={false}
        responsive
        style={{ width: '100%', height: 320 }}
        barGap={2}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis
          dataKey="quarter"
          stroke={colors.grid}
          tick={{ fill: colors.mutedText }}
          tickLine={false}
        />
        <YAxis
          stroke={colors.grid}
          tick={{ fill: colors.mutedText }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ fill: colors.cursor }}
          contentStyle={{
            background: colors.tooltip.background,
            border: `1px solid ${colors.tooltip.border}`,
            borderRadius: 4,
          }}
          labelStyle={{ color: colors.tooltip.text, fontWeight: 600 }}
          itemStyle={{ color: colors.tooltip.text }}
          // The series order of the legend (Recharts sorts the items by name by default).
          itemSorter={(item) => regions.findIndex((region) => region.key === item.dataKey)}
        />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.name}
            fill={svgFill(patternId, colors, index)}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        ))}
      </BarChart>
      <SvgLegend patternId={patternId} colors={colors} />
    </ChartFigure>
  );
}

// ---------------------------------------------------------------------------
// Chart.js (canvas): the colours are resolved, and resolved again when the theme changes
// ---------------------------------------------------------------------------

/** Whether this DOM can draw on a 2D canvas. A test DOM (jsdom) cannot: it gets the frame only. */
function canDrawOnCanvas(): boolean {
  return typeof CanvasRenderingContext2D === 'function';
}

/** The custom property a token reads: `--wave-palette-blue` for `paletteBlue`. */
function tokenProperty(name: WaveTokenName): string {
  return waveTokens[name].slice('var('.length, -')'.length);
}

/** A system colour as a canvas can paint it: the computed colour of a probe element. */
function resolveSystemColor(container: Element, color: SystemColor): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  container.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

/**
 * The chart's colours and font for a canvas, each token read with `getComputedStyle` at the
 * canvas, so they are the theme's and the provider's overrides at the time of the call.
 */
function resolveCanvasTheme(canvas: HTMLCanvasElement, forcedColors: boolean) {
  const style = getComputedStyle(canvas);
  const token = (name: WaveTokenName) => style.getPropertyValue(tokenProperty(name)).trim();
  const container = canvas.parentElement ?? canvas;
  return {
    colors: chartColors(forcedColors, token, (color) => resolveSystemColor(container, color)),
    font: token('fontFamily'),
  };
}

/** The fill of one series on the canvas: its pattern on a tile drawn at the device's resolution. */
function canvasFill(
  context: CanvasRenderingContext2D,
  colors: SeriesColors,
  pattern: SeriesPattern,
  ratio: number,
): string | CanvasPattern {
  const tile = document.createElement('canvas');
  tile.width = PATTERN_SIZE * ratio;
  tile.height = PATTERN_SIZE * ratio;
  const tileContext = pattern.d ? tile.getContext('2d') : null;
  if (!pattern.d || !tileContext) return colors.fill;
  tileContext.scale(ratio, ratio);
  tileContext.fillStyle = colors.fill;
  tileContext.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE);
  const path = new Path2D(pattern.d);
  if (pattern.paint === 'fill') {
    tileContext.fillStyle = colors.ink;
    tileContext.fill(path);
  } else {
    tileContext.strokeStyle = colors.ink;
    tileContext.lineWidth = PATTERN_STROKE;
    tileContext.stroke(path);
  }
  const fill = context.createPattern(tile, 'repeat');
  fill?.setTransform(new DOMMatrix().scale(1 / ratio));
  return fill ?? colors.fill;
}

function chartJsOptions(
  { colors, font }: ReturnType<typeof resolveCanvasTheme>,
  animate: boolean,
): ChartOptions<'bar'> {
  const ticks = { color: colors.mutedText, font: { family: font } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: animate ? undefined : false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: colors.text, font: { family: font }, boxWidth: 16, boxHeight: 16 },
      },
      tooltip: {
        backgroundColor: colors.tooltip.background,
        titleColor: colors.tooltip.text,
        bodyColor: colors.tooltip.text,
        borderColor: colors.tooltip.border,
        borderWidth: 1,
        titleFont: { family: font },
        bodyFont: { family: font },
      },
    },
    scales: {
      x: { ticks, grid: { display: false }, border: { color: colors.grid } },
      y: { beginAtZero: true, ticks, grid: { color: colors.grid }, border: { display: false } },
    },
  };
}

function ChartJsExample() {
  const [canvas, setCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const forcedColors = useForcedColors();

  React.useEffect(() => {
    const context = canvas && canDrawOnCanvas() ? canvas.getContext('2d') : null;
    if (!canvas || !context) return undefined;
    const ratio = window.devicePixelRatio || 1;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const theme = resolveCanvasTheme(canvas, forcedColors);
    const chart = new Chart(context, {
      type: 'bar',
      data: {
        labels: [...quarters],
        datasets: series.map((item, index) => ({
          label: item.name,
          data: [...item.values],
          backgroundColor: canvasFill(context, theme.colors.series[index], item.pattern, ratio),
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: 'start',
          maxBarThickness: 24,
        })),
      },
      options: chartJsOptions(theme, !reducedMotion),
    });

    // A canvas cannot read `var()`: when the theme toolbar (or a provider's `tokens`) changes the
    // provider root, resolve every colour again and redraw. The redraw is a normal update with
    // animation off: Chart.js refreshes the options its bars share only in such an update (after
    // `update('none')` the bars would keep the old theme's colours).
    const repaint = () => {
      const next = resolveCanvasTheme(canvas, forcedColors);
      chart.data.datasets.forEach((dataset, index) => {
        dataset.backgroundColor = canvasFill(
          context,
          next.colors.series[index],
          series[index].pattern,
          ratio,
        );
      });
      chart.options = chartJsOptions(next, false);
      chart.update();
    };
    const observer = new MutationObserver(repaint);
    const themeRoot = canvas.closest('[data-wave-theme]');
    if (themeRoot) {
      observer.observe(themeRoot, {
        attributes: true,
        attributeFilter: ['class', 'data-wave-theme', 'style'],
      });
    }
    return () => {
      observer.disconnect();
      chart.destroy();
    };
  }, [canvas, forcedColors]);

  return (
    <ChartFigure>
      <div className="relative h-80 w-full">
        <canvas ref={setCanvas} />
      </div>
    </ChartFigure>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const meta = {
  title: 'Guides/Charts',
  parameters: {
    docs: {
      description: {
        component:
          'WaveUI ships no chart component: these two recipes draw charts from third-party libraries with the WaveUI tokens, so they follow the theme toolbar. Both use the first six colours of `chartPalette`, a fill pattern per series as a second encoding (colour is never the only one, and in high contrast every palette fill is white), text in the `foreground` colours, and an image name, a description and a data table. Recharts and Chart.js are development dependencies of these stories only; neither is part of the package.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An SVG chart: each series takes `waveTokens[chartPalette[index]]` (`var(--wave-palette-blue)`, …)
 * as its colour, so the bars, the patterns and the legend follow the theme with no code. The
 * patterns are SVG `<pattern>`s inked in each fill's `-foreground` token, which reads on its fill in
 * every theme. In forced-colors mode the chart draws with system colours.
 */
export const Recharts: Story = {
  render: () => <RechartsExample />,
};

/**
 * A canvas chart. A canvas cannot read a CSS variable, so the story resolves each token with
 * `getComputedStyle(canvas).getPropertyValue('--wave-palette-blue')` and draws the patterns on
 * canvas tiles. A `MutationObserver` on the closest `[data-wave-theme]` element (the provider
 * root) resolves them again and redraws when its theme class or its `tokens` style changes.
 */
export const ChartJs: Story = {
  name: 'Chart.js',
  render: () => <ChartJsExample />,
};
