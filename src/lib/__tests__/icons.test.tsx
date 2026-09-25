import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
// Bundled through Vite's public build API (`vite` is a declared devDependency), not through its
// internal bundler package, so the test does not depend on how npm hoists Vite's dependencies.
import { build } from 'vite';
import * as Icons from '../icons';
import type { IconProps } from '../icons';
import iconsSource from '../icons.tsx?raw';

const ICONS: Array<[name: string, dataName: string, defaultSize: number]> = [
  ['DismissIcon', 'dismiss', 16],
  ['ChevronDownIcon', 'chevron-down', 12],
  ['ChevronUpIcon', 'chevron-up', 12],
  ['ChevronLeftIcon', 'chevron-left', 12],
  ['ChevronRightIcon', 'chevron-right', 12],
  ['ChevronDoubleLeftIcon', 'chevron-double-left', 12],
  ['ChevronDoubleRightIcon', 'chevron-double-right', 12],
  ['CalendarIcon', 'calendar', 16],
  ['ClockIcon', 'clock', 16],
  ['CheckIcon', 'check', 16],
  ['SubtractIcon', 'subtract', 16],
  ['SearchIcon', 'search', 16],
  ['InfoIcon', 'info', 16],
  ['SuccessIcon', 'success', 16],
  ['WarningIcon', 'warning', 16],
  ['ErrorIcon', 'error', 16],
  ['StarIcon', 'star', 16],
  ['AddIcon', 'add', 16],
  ['PersonIcon', 'person', 16],
  ['PresenceAvailableIcon', 'presence-available', 16],
  ['PresenceBusyIcon', 'presence-busy', 16],
  ['PresenceAwayIcon', 'presence-away', 16],
  ['PresenceOfflineIcon', 'presence-offline', 16],
  ['PresenceDndIcon', 'presence-dnd', 16],
  ['PresenceOofIcon', 'presence-oof', 16],
];

type IconComponent = (props: IconProps) => React.ReactNode;

/**
 * Bundles a consumer entry that imports only `DismissIcon` from the given icons source (as a
 * virtual module) with Vite's production build, and returns the `data-wave-icon` names of the icons
 * left in the output.
 */
async function iconsKeptWhenImportingDismissOnly(source: string): Promise<string[]> {
  const ENTRY = '\0entry.js';
  const ICONS_MODULE = '\0icons.tsx';
  const result = await build({
    configFile: false,
    envFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'virtual-icons',
        resolveId(id) {
          if (id === ENTRY) return ENTRY;
          if (id === './icons') return ICONS_MODULE;
          return null;
        },
        load(id) {
          if (id === ENTRY) {
            return "import { DismissIcon } from './icons'; export default DismissIcon;";
          }
          if (id === ICONS_MODULE) return { code: source, moduleType: 'tsx' };
          return null;
        },
      },
    ],
    build: {
      // Nothing touches the repo's outDir (dist/): the output stays in memory.
      write: false,
      emptyOutDir: false,
      minify: false,
      copyPublicDir: false,
      modulePreload: false,
      reportCompressedSize: false,
      rolldownOptions: {
        input: ENTRY,
        // Keep the entry's export: an app build would otherwise drop it and every icon with it.
        preserveEntrySignatures: 'strict',
        external: [/^react(\/|$)/],
      },
    },
  });
  // `build` resolves to one output per format (or a watcher in watch mode, which is not used here).
  const code = (Array.isArray(result) ? result : [result])
    .flatMap((bundle) => ('output' in bundle ? bundle.output : []))
    .map((file) => (file.type === 'chunk' ? file.code : ''))
    .join('\n');
  return ICONS.map(([, dataName]) => dataName).filter((dataName) =>
    new RegExp(`["'\`]${dataName}["'\`]`).test(code),
  );
}

function getIcon(name: string): IconComponent & { displayName?: string } {
  return (Icons as unknown as Record<string, IconComponent & { displayName?: string }>)[name];
}

describe('icons (input-datetime#22, button-provider#20)', () => {
  it('covers every export of the icons module (the table drives the per-icon and tree-shaking tests)', () => {
    // A new icon must be added to ICONS, so its a11y defaults, paint, displayName and
    // `/* @__PURE__ */` annotation are checked too. The module exports only icons (types are erased).
    expect(Object.keys(Icons).sort()).toEqual(ICONS.map(([name]) => name).sort());
    // The tree-shaking test identifies icons by `data-wave-icon`, so those names must be unique.
    expect(new Set(ICONS.map(([, dataName]) => dataName)).size).toBe(ICONS.length);
    // Every `createIcon` call site carries the annotation the tree-shaking test relies on.
    const callSites = iconsSource.match(/=\s*(?:\/\*\s*@__PURE__\s*\*\/\s*)?createIcon\(/g) ?? [];
    expect(callSites).toHaveLength(ICONS.length);
    expect(callSites.every((site) => site.includes('/* @__PURE__ */'))).toBe(true);
  });

  it.each(ICONS)('%s is hidden from assistive technology by default', (name, dataName, size) => {
    const Icon = getIcon(name);
    expect(Icon).toBeTypeOf('function');
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).toHaveAttribute('data-wave-icon', dataName);
    expect(svg).toHaveAttribute('width', String(size));
    expect(svg).toHaveAttribute('height', String(size));
    expect(svg.querySelector('path')).not.toBeNull();
  });

  it.each(ICONS)('%s paints with currentColor only', (name) => {
    const Icon = getIcon(name);
    const { container } = render(<Icon />);
    const painted = Array.from(container.querySelectorAll('svg, svg *'))
      .flatMap((el) => [el.getAttribute('fill'), el.getAttribute('stroke')])
      .filter((value): value is string => value !== null && value !== 'none');
    expect(painted.length).toBeGreaterThan(0);
    expect(new Set(painted)).toEqual(new Set(['currentColor']));
  });

  it.each(ICONS)('%s has a displayName', (name) => {
    expect(getIcon(name).displayName).toBe(name);
  });

  it('exposes a named image when a title is given', () => {
    render(<Icons.WarningIcon title="Warning" />);
    const img = screen.getByRole('img', { name: 'Warning' });
    expect(img).not.toHaveAttribute('aria-hidden');
    expect(img.querySelector('title')).toHaveTextContent('Warning');
  });

  it('keeps icon content out of the accessible name of the control that contains it', () => {
    // SVG text inside the icon joins the button's name from content unless the icon is hidden.
    render(
      <>
        <button type="button" data-testid="default">
          <Icons.SearchIcon>
            <text>magnifier</text>
          </Icons.SearchIcon>
          Search
        </button>
        <button type="button" data-testid="exposed">
          <Icons.SearchIcon aria-hidden={false}>
            <text>magnifier</text>
          </Icons.SearchIcon>
          Search
        </button>
      </>,
    );
    expect(screen.getByTestId('default')).toHaveAccessibleName('Search');
    // Control: the same markup without the aria-hidden default leaks the icon text into the name.
    expect(screen.getByTestId('exposed')).toHaveAccessibleName(/magnifier/);
  });

  it('lets bundlers drop the icons a consumer does not import (/* @__PURE__ */ createIcon)', async () => {
    expect(await iconsKeptWhenImportingDismissOnly(iconsSource)).toEqual(['dismiss']);
    // Control: the same bundle without the annotations keeps every icon, so the assertion above
    // really depends on them (a createIcon call is not provably side-effect free on its own).
    const withoutPureAnnotations = iconsSource.replaceAll('/* @__PURE__ */', '');
    expect(withoutPureAnnotations).not.toBe(iconsSource);
    expect(await iconsKeptWhenImportingDismissOnly(withoutPureAnnotations)).toEqual(
      ICONS.map(([, dataName]) => dataName),
    );
  }, 30_000);

  it('tells directional uses to mirror with the wave-rtl variant, never the bare rtl one (C-LOGICAL)', () => {
    // Tailwind's `rtl:` also matches inside an LTR subtree of an RTL page; `wave-rtl:` follows the
    // element's own direction. The styles build compiles this class from these comments.
    expect(iconsSource.match(/wave-rtl:-scale-x-100/g)).toHaveLength(3);
    expect(iconsSource).not.toMatch(/(?<![\w-])rtl:/);
  });

  it('accepts a size (number or CSS length)', () => {
    const { container, rerender } = render(<Icons.CalendarIcon size={20} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
    rerender(<Icons.CalendarIcon size="1.25em" />);
    expect(container.querySelector('svg')).toHaveAttribute('height', '1.25em');
  });

  it('forwards className, other SVG props and ref', () => {
    const ref = React.createRef<SVGSVGElement>();
    const { container } = render(
      <Icons.ChevronDownIcon ref={ref} className="wave-rtl:-scale-x-100" data-testid="chevron" />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveClass('wave-rtl:-scale-x-100');
    expect(svg).toHaveAttribute('data-testid', 'chevron');
    expect(ref.current).toBe(svg);
  });

  it('AddIcon draws a stroked plus in the SubtractIcon geometry (SpinButton increment)', () => {
    const { container } = render(
      <>
        <Icons.AddIcon size={12} />
        <Icons.SubtractIcon size={12} />
      </>,
    );
    const add = container.querySelector('svg[data-wave-icon="add"]')!;
    const subtract = container.querySelector('svg[data-wave-icon="subtract"]')!;
    expect(add).toHaveAttribute('aria-hidden', 'true');
    expect(add).toHaveAttribute('width', '12');
    for (const attr of ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap']) {
      expect(add.getAttribute(attr)).toBe(subtract.getAttribute(attr));
    }
    // The plus is the subtract bar plus a vertical bar of the same length.
    expect(add.querySelector('path')).toHaveAttribute('d', 'M6 2.5v7M2.5 6h7');
    expect(subtract.querySelector('path')).toHaveAttribute('d', 'M2.5 6h7');
  });

  it('PersonIcon is a filled person glyph that scales with a relative size (Avatar fallback)', () => {
    const { container } = render(<Icons.PersonIcon size="60%" />);
    const svg = container.querySelector('svg[data-wave-icon="person"]')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 20 20');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).not.toHaveAttribute('stroke');
    expect(svg).toHaveAttribute('width', '60%');
    expect(svg).toHaveAttribute('height', '60%');
  });

  describe('presence glyphs (PresenceBadge)', () => {
    const PRESENCE: Array<[name: string, paint: 'fill' | 'stroke']> = [
      ['PresenceAvailableIcon', 'stroke'],
      ['PresenceBusyIcon', 'fill'],
      ['PresenceAwayIcon', 'stroke'],
      ['PresenceOfflineIcon', 'stroke'],
      ['PresenceDndIcon', 'stroke'],
      ['PresenceOofIcon', 'stroke'],
    ];

    it.each(PRESENCE)('%s is drawn in the 16x16 badge box', (name, paint) => {
      const Icon = getIcon(name);
      const { container } = render(<Icon className="size-full" />);
      const svg = container.querySelector('svg')!;
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
      expect(svg).toHaveClass('size-full');
      if (paint === 'stroke') {
        expect(svg).toHaveAttribute('fill', 'none');
        expect(svg).toHaveAttribute('stroke', 'currentColor');
        expect(svg).toHaveAttribute('stroke-linecap', 'round');
        // Each glyph sets its own stroke weights for the badge sizes (8-20px).
        const weights = Array.from(svg.querySelectorAll('path, circle')).map((el) =>
          el.getAttribute('stroke-width'),
        );
        expect(weights.length).toBeGreaterThan(0);
        expect(weights.every((w) => w !== null && Number(w) > 0)).toBe(true);
      } else {
        expect(svg).toHaveAttribute('fill', 'currentColor');
        expect(svg).not.toHaveAttribute('stroke');
      }
    });

    it('busy is a full disc, so forced colors keep it solid (not an empty ring)', () => {
      const { container } = render(<Icons.PresenceBusyIcon />);
      expect(container.querySelector('path')).toHaveAttribute(
        'd',
        'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Z',
      );
    });

    it('offline is a ring with an X', () => {
      const { container } = render(<Icons.PresenceOfflineIcon />);
      expect(container.querySelector('circle')).toHaveAttribute('r', '6.5');
      expect(container.querySelector('path')).toHaveAttribute('d', 'M6 6l4 4m0-4l-4 4');
    });

    it('every presence glyph is distinct (status is not conveyed by color alone)', () => {
      const shapes = PRESENCE.map(([name]) => {
        const Icon = getIcon(name);
        const { container, unmount } = render(<Icon />);
        const markup = container.querySelector('svg')!.innerHTML;
        unmount();
        return markup;
      });
      expect(new Set(shapes).size).toBe(PRESENCE.length);
    });
  });

  it('lets consumers override the default a11y attributes', () => {
    const { container } = render(
      <Icons.InfoIcon aria-hidden={false} aria-label="Info" role="img" />,
    );
    expect(screen.getByRole('img', { name: 'Info' })).toBe(container.querySelector('svg'));
  });
});
