import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { WaveProvider, useWaveTheme, type WaveContextValue } from '../WaveProvider';
import { Portal } from '../../portal/Portal';
import { Dialog } from '../../overlays/Dialog';
import { Popover } from '../../overlays/Popover';
import { Tooltip } from '../../overlays/Tooltip';
import { Menu } from '../../navigation/Menu';
import { Toaster, useToastController } from '../../feedback/Toast';
import { getTokenStyle, type WaveTokenOverrides } from '../../../lib/tokens';
import { renderWithProviders } from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function root(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

/** The custom properties of an element's inline style, in their order, with their values. */
function customProperties(el: Element): Record<string, string> {
  const { style } = el as HTMLElement;
  return Object.fromEntries(
    Array.from(style)
      .filter((name) => name.startsWith('--'))
      .map((name) => [name, style.getPropertyValue(name)]),
  );
}

/** The portal wrapper around an element. */
function wrapperOf(el: Element): HTMLElement {
  const wrapper = el.closest<HTMLElement>('[data-wave-portal]');
  if (!wrapper) throw new Error('the element is not in a portal wrapper');
  return wrapper;
}

/** Records every context value its provider gives it. */
function Capture({ onValue }: { onValue: (value: WaveContextValue) => void }) {
  onValue(useWaveTheme());
  return null;
}

/** Overrides from untyped code: keys and values TypeScript would refuse. */
function untyped(overrides: Record<string, unknown>): WaveTokenOverrides {
  return overrides as WaveTokenOverrides;
}

const BRAND = { brand80: '#c43e00', paletteRedTint: '#fde7e9' } satisfies WaveTokenOverrides;
const BRAND_PROPERTIES = { '--wave-brand-80': '#c43e00', '--wave-palette-red-tint': '#fde7e9' };

const NAME_WARNING = (key: string) =>
  `[WaveUI] WaveProvider: \`tokens\` skips \`${key}\`: not a token name (the CSS variable in ` +
  'camelCase without `--wave-`, such as `primaryForeground`).';
const VALUE_WARNING = (key: string) =>
  `[WaveUI] WaveProvider: \`tokens\` skips \`${key}\`: its value must be a finite number, or CSS ` +
  'text with balanced quotes, brackets and comments, without `;`, `{`, `}` or `url(` and without ' +
  '`!` outside a string.';

/** The markup of a provider without overrides (0.16's), which a skipped override leaves as it is. */
const PLAIN_MARKUP =
  '<div dir="ltr" data-wave-theme="light" class="wave-root wave-light bg-background ' +
  'text-foreground font-wave text-body-1">Content</div>';

/** A value that would write a second declaration into a server-rendered style attribute. */
const INJECTION = 'red;background:url(x)';

describe('WaveProvider tokens: the root style', () => {
  it('puts each override on the root as a custom property', () => {
    const { container } = render(<WaveProvider tokens={BRAND}>Content</WaveProvider>);
    expect(customProperties(root(container))).toEqual(BRAND_PROPERTIES);
  });

  it('writes a number as its string', () => {
    const { container } = render(<WaveProvider tokens={{ zOverlay: 2000 }}>Content</WaveProvider>);
    expect(customProperties(root(container))).toEqual({ '--wave-z-overlay': '2000' });
  });

  it.each([
    ['omitted', undefined],
    ['null', null],
    ['empty', {}],
    ['only undefined values', { brand80: undefined }],
  ] as const)('renders no style attribute when tokens is %s', (_, tokens) => {
    const { container } = render(<WaveProvider tokens={tokens}>Content</WaveProvider>);
    expect(root(container)).not.toHaveAttribute('style');
  });

  it('keeps the 0.16 server markup without tokens (byte for byte)', () => {
    expect(renderToString(<WaveProvider>Content</WaveProvider>)).toBe(PLAIN_MARKUP);
    expect(renderToString(<WaveProvider tokens={null}>Content</WaveProvider>)).toBe(PLAIN_MARKUP);
    expect(renderToString(<WaveProvider tokens={{}}>Content</WaveProvider>)).toBe(PLAIN_MARKUP);
  });

  // React writes a custom property's value into the server-rendered `style` attribute as text, so
  // a semicolon in it would add a declaration of the caller's to the root (the class list holds
  // the word "background" too, hence the checks on the declaration and the property).
  it('renders no declaration of a value with a semicolon or a brace on the server', () => {
    const warn = vi.spyOn(console, 'warn');
    const html = renderToString(
      <WaveProvider tokens={{ brand80: INJECTION }}>Content</WaveProvider>,
    );
    expect(html).not.toContain('--wave-brand-80');
    expect(html).not.toMatch(/background\s*:/);
    expect(html).not.toContain('url(');
    expect(html).toBe(PLAIN_MARKUP);
    expect(
      renderToString(
        <WaveProvider tokens={{ brand80: INJECTION, primary: '#115ea3', ring: 'red }' }}>
          Content
        </WaveProvider>,
      ),
    ).toContain('style="--wave-primary:#115ea3"');
    expect(warn).not.toHaveBeenCalled();
  });

  // An open string, comment, parenthesis or bracket (also one after an unquoted URL's first `)`)
  // would run on to the end of the server-rendered attribute, and a trailing backslash would escape
  // the semicolon after it, so the declarations after the value (a later token, the consumer's
  // `style`) would be lost on the server only; `!important` would be a priority there only.
  it.each([
    ['an unclosed single quote', "'abc"],
    ['an unclosed double quote', '"abc'],
    ['an unterminated comment', '#c43e00 /* brand'],
    ['an unclosed parenthesis', 'rgba(0, 0, 0, 0.5'],
    ['a trailing backslash', '#c43e00\\'],
    ['a stray closing parenthesis', '#c43e00)'],
    ['an unclosed square bracket', '[content-start'],
    ['a quote inside an unquoted url(', 'url(a"b)c")'],
    ['an important flag', '#c43e00 !important'],
  ])(
    'renders no declaration of a value with %s on the server, and keeps the ones after it',
    (_label, value) => {
      const warn = vi.spyOn(console, 'warn');
      const html = renderToString(
        <WaveProvider tokens={{ brand80: value, primary: '#c43e00' }}>Content</WaveProvider>,
      );
      expect(html).toContain('style="--wave-primary:#c43e00"');
      expect(html).not.toContain('--wave-brand-80');
      expect(
        renderToString(
          <WaveProvider tokens={{ brand80: value }} style={{ padding: 4 }}>
            Content
          </WaveProvider>,
        ),
      ).toContain('style="padding:4px"');
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it("merges the consumer's style, which wins a conflicting property", () => {
    const style = { '--wave-brand-80': '#0f6cbd', padding: 4 } as React.CSSProperties;
    const { container } = render(
      <WaveProvider tokens={BRAND} style={style}>
        Content
      </WaveProvider>,
    );
    const el = root(container);
    expect(customProperties(el)).toEqual({
      '--wave-brand-80': '#0f6cbd',
      '--wave-palette-red-tint': '#fde7e9',
    });
    expect(el.style.padding).toBe('4px');
  });

  it("keeps a consumer's style without tokens", () => {
    const { container } = render(<WaveProvider style={{ padding: 4 }}>Content</WaveProvider>);
    expect(root(container)).toHaveAttribute('style', 'padding: 4px;');
  });

  it('keeps the order of the keys', () => {
    const { container } = render(
      <WaveProvider tokens={{ primary: '#c43e00', brand80: '#0f6cbd', zOverlay: 2000 }}>
        Content
      </WaveProvider>,
    );
    expect(Array.from(root(container).style)).toEqual([
      '--wave-primary',
      '--wave-brand-80',
      '--wave-z-overlay',
    ]);
  });

  it('renders the style on the server', () => {
    const html = renderToString(
      <WaveProvider tokens={{ brand80: '#c43e00', zOverlay: 2000 }}>Content</WaveProvider>,
    );
    expect(html).toContain('style="--wave-brand-80:#c43e00;--wave-z-overlay:2000"');
  });

  it('applies the style getTokenStyle returns for the same map', () => {
    let value: WaveContextValue | undefined;
    render(
      <WaveProvider tokens={{ ...BRAND, zOverlay: 2000 }}>
        <Capture onValue={(next) => (value = next)} />
      </WaveProvider>,
    );
    expect(value?.tokenStyle).toEqual(getTokenStyle({ ...BRAND, zOverlay: 2000 }));
  });
});

describe('WaveProvider tokens: nesting', () => {
  it('merges a nested map key by key, and the nested root carries the merged map', () => {
    let inner: WaveContextValue | undefined;
    render(
      <WaveProvider tokens={{ brand80: '#c43e00', brand70: '#a33500' }} data-testid="outer">
        <WaveProvider tokens={{ brand70: '#0f6cbd', primary: '#115ea3' }} data-testid="inner">
          <Capture onValue={(value) => (inner = value)} />
        </WaveProvider>
      </WaveProvider>,
    );
    expect(inner?.tokens).toEqual({ brand80: '#c43e00', brand70: '#0f6cbd', primary: '#115ea3' });
    expect(customProperties(screen.getByTestId('inner'))).toEqual({
      '--wave-brand-80': '#c43e00',
      '--wave-brand-70': '#0f6cbd',
      '--wave-primary': '#115ea3',
    });
    expect(customProperties(screen.getByTestId('outer'))).toEqual({
      '--wave-brand-80': '#c43e00',
      '--wave-brand-70': '#a33500',
    });
  });

  // Asserts the context, the root's style attribute and the portal only: jsdom does not cascade
  // custom properties, and the theme-independent tokens (ramps, font families, stacking order,
  // motion) of the outer root still reach the inner subtree's own elements in a browser (a check of
  // the real-browser pass).
  it('null clears the inherited overrides from the context, the root style and the portal', () => {
    let inner: WaveContextValue | undefined;
    render(
      <WaveProvider tokens={BRAND}>
        <WaveProvider tokens={null} data-testid="inner">
          <Capture onValue={(value) => (inner = value)} />
          <Portal>
            <span>Cleared</span>
          </Portal>
        </WaveProvider>
      </WaveProvider>,
    );
    expect(inner?.tokens).toEqual({});
    expect(inner?.tokenStyle).toBeUndefined();
    expect(screen.getByTestId('inner')).not.toHaveAttribute('style');
    expect(customProperties(wrapperOf(screen.getByText('Cleared')))).toEqual({});
  });

  it('an omitted map, and a key whose value is undefined, inherit', () => {
    let omitted: WaveContextValue | undefined;
    let undefinedKey: WaveContextValue | undefined;
    render(
      <WaveProvider tokens={BRAND}>
        <WaveProvider data-testid="omitted">
          <Capture onValue={(value) => (omitted = value)} />
        </WaveProvider>
        <WaveProvider tokens={{ brand80: undefined, primary: '#115ea3' }} data-testid="undefined">
          <Capture onValue={(value) => (undefinedKey = value)} />
        </WaveProvider>
      </WaveProvider>,
    );
    expect(omitted?.tokens).toEqual(BRAND);
    expect(customProperties(screen.getByTestId('omitted'))).toEqual(BRAND_PROPERTIES);
    expect(undefinedKey?.tokens).toEqual({ ...BRAND, primary: '#115ea3' });
    expect(customProperties(screen.getByTestId('undefined'))).toEqual({
      ...BRAND_PROPERTIES,
      '--wave-primary': '#115ea3',
    });
  });

  it('a nested provider with another theme keeps the enclosing overrides', () => {
    render(
      <WaveProvider tokens={BRAND}>
        <WaveProvider theme="dark" data-testid="inner">
          Panel
        </WaveProvider>
      </WaveProvider>,
    );
    const inner = screen.getByTestId('inner');
    expect(inner).toHaveClass('wave-dark');
    expect(customProperties(inner)).toEqual(BRAND_PROPERTIES);
  });

  it('updating the enclosing provider updates the nested one', () => {
    const tree = (brand80: string) => (
      <WaveProvider tokens={{ brand80 }}>
        <WaveProvider tokens={{ primary: '#115ea3' }} data-testid="inner">
          Panel
        </WaveProvider>
      </WaveProvider>
    );
    const { rerender } = render(tree('#c43e00'));
    rerender(tree('#0f6cbd'));
    expect(customProperties(screen.getByTestId('inner'))).toEqual({
      '--wave-brand-80': '#0f6cbd',
      '--wave-primary': '#115ea3',
    });
  });
});

describe('WaveProvider tokens: portals', () => {
  /** Expects the token properties on a wrapper that keeps its position and stacking. */
  function expectTokenWrapper(wrapper: HTMLElement, layer: 'overlay' | 'toast' | 'tooltip') {
    expect(customProperties(wrapper)).toEqual(BRAND_PROPERTIES);
    expect(wrapper.style.position).toBe('relative');
    expect(wrapper.style.zIndex).toMatch(
      new RegExp(`^calc\\(var\\(--wave-z-${layer}, \\d+\\) \\+ 0\\)$`),
    );
    expect(wrapper).toHaveClass('wave-portal', 'wave-light');
  }

  it('a Dialog opened inside the provider carries the overrides', () => {
    render(
      <WaveProvider tokens={BRAND}>
        <Dialog defaultOpen>
          <Dialog.Trigger>
            <button type="button">Open</button>
          </Dialog.Trigger>
          <Dialog.Content title="Settings">Body</Dialog.Content>
        </Dialog>
      </WaveProvider>,
    );
    expectTokenWrapper(wrapperOf(screen.getByRole('dialog')), 'overlay');
  });

  it('a Menu opened inside the provider carries the overrides', async () => {
    const user = userEvent.setup();
    render(
      <WaveProvider tokens={BRAND}>
        <Menu>
          <Menu.Trigger>
            <button type="button">Actions</button>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Edit</Menu.Item>
          </Menu.Popover>
        </Menu>
      </WaveProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expectTokenWrapper(wrapperOf(screen.getByRole('menu')), 'overlay');
  });

  it('a Popover opened inside the provider carries the overrides', () => {
    render(
      <WaveProvider tokens={BRAND}>
        <Popover defaultOpen>
          <Popover.Trigger>
            <button type="button">Toggle</button>
          </Popover.Trigger>
          <Popover.Content aria-label="Details">Body</Popover.Content>
        </Popover>
      </WaveProvider>,
    );
    expectTokenWrapper(wrapperOf(screen.getByRole('dialog', { name: 'Details' })), 'overlay');
  });

  it('a Tooltip shown inside the provider carries the overrides', () => {
    render(
      <WaveProvider tokens={BRAND}>
        <Tooltip content="Tip" open onOpenChange={() => {}}>
          <button type="button">Target</button>
        </Tooltip>
      </WaveProvider>,
    );
    const surface = document.querySelector('[data-wave-tooltip-surface]');
    if (!surface) throw new Error('the tooltip surface is not shown');
    expectTokenWrapper(wrapperOf(surface), 'tooltip');
  });

  it('a Toaster inside the provider carries the overrides on its region and its toasts', async () => {
    function Notify() {
      const { dispatchToast } = useToastController();
      return (
        <button type="button" onClick={() => dispatchToast({ title: 'Saved', timeout: 0 })}>
          Notify
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <WaveProvider tokens={BRAND}>
        <Toaster>
          <Notify />
        </Toaster>
      </WaveProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    const wrapper = wrapperOf(screen.getByRole('region', { name: 'Notifications' }));
    expectTokenWrapper(wrapper, 'toast');
    expect(wrapper).toContainElement(screen.getByText('Saved'));
  });

  it("a nested provider's overrides reach its own portals and not a sibling provider's", () => {
    render(
      <WaveProvider tokens={{ brand80: '#c43e00' }}>
        <WaveProvider tokens={{ primary: '#115ea3' }}>
          <Portal>
            <span>First</span>
          </Portal>
        </WaveProvider>
        <WaveProvider tokens={{ primary: '#0e700e' }}>
          <Portal>
            <span>Second</span>
          </Portal>
        </WaveProvider>
        <Portal>
          <span>Outer</span>
        </Portal>
      </WaveProvider>,
    );
    expect(customProperties(wrapperOf(screen.getByText('First')))).toEqual({
      '--wave-brand-80': '#c43e00',
      '--wave-primary': '#115ea3',
    });
    expect(customProperties(wrapperOf(screen.getByText('Second')))).toEqual({
      '--wave-brand-80': '#c43e00',
      '--wave-primary': '#0e700e',
    });
    expect(customProperties(wrapperOf(screen.getByText('Outer')))).toEqual({
      '--wave-brand-80': '#c43e00',
    });
  });

  it('a portal without overrides has no custom property (the 0.16 wrapper style)', () => {
    render(
      <WaveProvider>
        <WaveProvider tokens={null}>
          <Portal>
            <span>Plain</span>
          </Portal>
        </WaveProvider>
      </WaveProvider>,
    );
    const wrapper = wrapperOf(screen.getByText('Plain'));
    expect(customProperties(wrapper)).toEqual({});
    expect(wrapper).toHaveAttribute(
      'style',
      'position: relative; z-index: calc(var(--wave-z-overlay, 1000) + 0);',
    );
  });

  it('applyStylesToPortals={false} drops the overrides and keeps the theme classes and direction', () => {
    render(
      <WaveProvider tokens={BRAND} theme="dark" dir="rtl" applyStylesToPortals={false}>
        <Portal>
          <span>Overlay</span>
        </Portal>
      </WaveProvider>,
    );
    const wrapper = wrapperOf(screen.getByText('Overlay'));
    expect(customProperties(wrapper)).toEqual({});
    expect(wrapper).toHaveClass('wave-portal', 'wave-dark', 'dark');
    expect(wrapper).toHaveAttribute('dir', 'rtl');
    expect(wrapper.style.position).toBe('relative');
    expect(wrapper.style.zIndex).toBe('calc(var(--wave-z-overlay, 1000) + 0)');
  });

  it('a nested provider inherits applyStylesToPortals, and true re-enables it', () => {
    let inherited: WaveContextValue | undefined;
    render(
      <WaveProvider tokens={BRAND} applyStylesToPortals={false}>
        <WaveProvider tokens={{ primary: '#115ea3' }}>
          <Capture onValue={(value) => (inherited = value)} />
          <Portal>
            <span>Inherited</span>
          </Portal>
        </WaveProvider>
        <WaveProvider applyStylesToPortals>
          <Portal>
            <span>Enabled</span>
          </Portal>
        </WaveProvider>
      </WaveProvider>,
    );
    expect(inherited?.applyStylesToPortals).toBe(false);
    expect(customProperties(wrapperOf(screen.getByText('Inherited')))).toEqual({});
    expect(customProperties(wrapperOf(screen.getByText('Enabled')))).toEqual(BRAND_PROPERTIES);
  });

  it('a portal in an RTL provider carries the overrides and the direction', () => {
    renderWithProviders(
      <WaveProvider tokens={BRAND}>
        <Portal>
          <span>Mirrored</span>
        </Portal>
      </WaveProvider>,
      { dir: 'rtl' },
    );
    const wrapper = wrapperOf(screen.getByText('Mirrored'));
    expect(wrapper).toHaveAttribute('dir', 'rtl');
    expect(customProperties(wrapper)).toEqual(BRAND_PROPERTIES);
  });
});

describe('WaveProvider tokens: the context value', () => {
  it('useWaveTheme returns the defaults outside a provider', () => {
    let value: WaveContextValue | undefined;
    render(<Capture onValue={(next) => (value = next)} />);
    expect(value).toMatchObject({ tokens: {}, tokenStyle: undefined, applyStylesToPortals: true });
  });

  it('useWaveTheme exposes the merged overrides, their style and applyStylesToPortals', () => {
    let value: WaveContextValue | undefined;
    render(
      <WaveProvider tokens={BRAND} applyStylesToPortals={false}>
        <Capture onValue={(next) => (value = next)} />
      </WaveProvider>,
    );
    expect(value).toMatchObject({
      tokens: BRAND,
      tokenStyle: BRAND_PROPERTIES,
      applyStylesToPortals: false,
    });
  });

  it('a provider without tokens provides an empty map and no style', () => {
    let value: WaveContextValue | undefined;
    render(
      <WaveProvider>
        <Capture onValue={(next) => (value = next)} />
      </WaveProvider>,
    );
    expect(value).toMatchObject({ tokens: {}, tokenStyle: undefined, applyStylesToPortals: true });
  });

  it('keeps the identity of the context value and of tokenStyle across an equal inline map', () => {
    const values = new Set<WaveContextValue>();
    const styles = new Set<unknown>();
    let renders = 0;
    function Collect() {
      const value = useWaveTheme();
      values.add(value);
      styles.add(value.tokenStyle);
      renders++;
      return null;
    }
    const child = <Collect />;
    const { rerender } = render(
      <WaveProvider tokens={{ brand80: '#c43e00', zOverlay: 2000 }}>{child}</WaveProvider>,
    );
    rerender(<WaveProvider tokens={{ brand80: '#c43e00', zOverlay: 2000 }}>{child}</WaveProvider>);
    rerender(<WaveProvider tokens={{ brand80: '#c43e00', zOverlay: 2000 }}>{child}</WaveProvider>);
    expect(values.size).toBe(1);
    expect(styles.size).toBe(1);
    expect(renders).toBe(1);
    rerender(<WaveProvider tokens={{ brand80: '#0f6cbd', zOverlay: 2000 }}>{child}</WaveProvider>);
    expect(values.size).toBe(2);
    expect(styles.size).toBe(2);
    expect(renders).toBe(2);
  });

  it('a nested provider keeps its identity while the enclosing map is equal', () => {
    const values = new Set<WaveContextValue>();
    function Collect() {
      values.add(useWaveTheme());
      return null;
    }
    const child = <Collect />;
    const tree = () => (
      <WaveProvider tokens={{ brand80: '#c43e00' }}>
        <WaveProvider tokens={{ primary: '#115ea3' }}>{child}</WaveProvider>
      </WaveProvider>
    );
    const { rerender } = render(tree());
    rerender(tree());
    expect(values.size).toBe(1);
  });

  it('works in StrictMode', () => {
    const { container } = render(
      <React.StrictMode>
        <WaveProvider tokens={BRAND}>
          <Portal>
            <span>Strict</span>
          </Portal>
        </WaveProvider>
      </React.StrictMode>,
    );
    expect(customProperties(root(container))).toEqual(BRAND_PROPERTIES);
    expect(customProperties(wrapperOf(screen.getByText('Strict')))).toEqual(BRAND_PROPERTIES);
  });
});

describe('WaveProvider tokens: development warnings', () => {
  it('warns once from an effect for a key that is not a token name, and skips it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let warningsDuringRender = -1;
    function Probe() {
      warningsDuringRender = warn.mock.calls.length;
      return null;
    }
    const tokens = untyped({ 'brand-80': '#c43e00', primary: '#115ea3' });
    const { container, rerender } = render(
      <React.StrictMode>
        <WaveProvider tokens={tokens}>
          <WaveProvider tokens={{ brand70: '#0f6cbd' }}>
            <Probe />
          </WaveProvider>
        </WaveProvider>
      </React.StrictMode>,
    );
    expect(warningsDuringRender).toBe(0);
    rerender(
      <React.StrictMode>
        <WaveProvider tokens={tokens}>Again</WaveProvider>
      </React.StrictMode>,
    );
    expect(warn.mock.calls).toEqual([[NAME_WARNING('brand-80')]]);
    expect(customProperties(root(container))).toEqual({ '--wave-primary': '#115ea3' });
  });

  it('warns once from an effect for a value that is not a finite number or a string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let warningsDuringRender = -1;
    function Probe() {
      warningsDuringRender = warn.mock.calls.length;
      return null;
    }
    const { container } = render(
      <React.StrictMode>
        <WaveProvider tokens={untyped({ zOverlay: Number.NaN, brand80: '#c43e00' })}>
          <Probe />
        </WaveProvider>
      </React.StrictMode>,
    );
    expect(warningsDuringRender).toBe(0);
    expect(warn.mock.calls).toEqual([[VALUE_WARNING('zOverlay')]]);
    expect(customProperties(root(container))).toEqual({ '--wave-brand-80': '#c43e00' });
  });

  it('warns once from an effect for a string with a semicolon, skips it on the root and the portals, and keeps it in the context', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let warningsDuringRender = -1;
    let value: WaveContextValue | undefined;
    function Probe() {
      warningsDuringRender = warn.mock.calls.length;
      return null;
    }
    const tokens = { brand80: INJECTION, primary: '#115ea3' } satisfies WaveTokenOverrides;
    const { container } = render(
      <React.StrictMode>
        <WaveProvider tokens={tokens}>
          <Probe />
          <Capture onValue={(next) => (value = next)} />
          <Portal>
            <span>Overlay</span>
          </Portal>
        </WaveProvider>
      </React.StrictMode>,
    );
    expect(warningsDuringRender).toBe(0);
    expect(warn.mock.calls).toEqual([[VALUE_WARNING('brand80')]]);
    expect(customProperties(root(container))).toEqual({ '--wave-primary': '#115ea3' });
    expect(customProperties(wrapperOf(screen.getByText('Overlay')))).toEqual({
      '--wave-primary': '#115ea3',
    });
    expect(value?.tokens).toEqual(tokens);
    expect(value?.tokenStyle).toEqual({ '--wave-primary': '#115ea3' });
  });

  it('warns once from an effect for an unbalanced string, and skips it on the root and the portals', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let warningsDuringRender = -1;
    function Probe() {
      warningsDuringRender = warn.mock.calls.length;
      return null;
    }
    const tokens = {
      fontFamily: "'Segoe UI, sans-serif",
      shadow2: '0 0 2px rgba(0, 0, 0, 0.12',
      primary: '#115ea3',
    } satisfies WaveTokenOverrides;
    const { container, rerender } = render(
      <React.StrictMode>
        <WaveProvider tokens={tokens}>
          <Probe />
          <Portal>
            <span>Overlay</span>
          </Portal>
        </WaveProvider>
      </React.StrictMode>,
    );
    expect(warningsDuringRender).toBe(0);
    expect(customProperties(wrapperOf(screen.getByText('Overlay')))).toEqual({
      '--wave-primary': '#115ea3',
    });
    rerender(
      <React.StrictMode>
        <WaveProvider tokens={{ ...tokens }}>Again</WaveProvider>
      </React.StrictMode>,
    );
    expect(warn.mock.calls).toEqual([[VALUE_WARNING('fontFamily')], [VALUE_WARNING('shadow2')]]);
    expect(customProperties(root(container))).toEqual({ '--wave-primary': '#115ea3' });
  });

  // The effect reads `process.env.NODE_ENV` written out, so a production bundle drops it.
  it('logs nothing in production, and still skips the invalid entries', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <WaveProvider
        tokens={untyped({ 'brand-80': '#c43e00', fontFamily: "'Segoe UI", primary: '#115ea3' })}
      >
        <Portal>
          <span>Overlay</span>
        </Portal>
      </WaveProvider>,
    );
    expect(warn).not.toHaveBeenCalled();
    expect(customProperties(root(container))).toEqual({ '--wave-primary': '#115ea3' });
    expect(customProperties(wrapperOf(screen.getByText('Overlay')))).toEqual({
      '--wave-primary': '#115ea3',
    });
  });

  it('logs nothing while rendering on the server', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = renderToString(
      <WaveProvider tokens={untyped({ 'brand-80': '#c43e00', zOverlay: {}, primary: '#115ea3' })}>
        Content
      </WaveProvider>,
    );
    expect(html).toContain('style="--wave-primary:#115ea3"');
    expect(warn).not.toHaveBeenCalled();
  });
});
