import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TabList,
  TabListTab,
  TabListPanel,
  TabListPanels,
  type TabListProps,
  type TabProps,
  type TabPanelProps,
  type TabPanelsProps,
} from '../TabList';
import type { Orientation } from '../../../lib/types';
import {
  asClientReference,
  expectNoA11yViolations,
  renderWithProviders,
  testSystemProps,
  testCompoundExposure,
  testComposedHandler,
  expectThrows,
} from '../../../test-utils';

const tabsWithPanels = (
  <>
    <TabList.Tab value="a">Tab A</TabList.Tab>
    <TabList.Tab value="b">Tab B</TabList.Tab>
    <TabList.Tab value="c">Tab C</TabList.Tab>
    <TabList.Panel value="a">Panel A</TabList.Panel>
    <TabList.Panel value="b">Panel B</TabList.Panel>
    <TabList.Panel value="c">Panel C</TabList.Panel>
  </>
);

const threeTabs = (
  <>
    <TabList.Tab value="a">Tab A</TabList.Tab>
    <TabList.Tab value="b">Tab B</TabList.Tab>
    <TabList.Tab value="c">Tab C</TabList.Tab>
  </>
);

const tab = (name: string) => screen.getByRole('tab', { name });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** The `[WaveUI]` warnings logged so far (asserted, never silenced). */
const warnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.map(([message]) => String(message));

/** A TabList deprecation warning (asserted exactly). */
const deprecated = (oldName: string, newName: string, extra = '') =>
  `[WaveUI] TabList: \`${oldName}\` is deprecated and will be removed in 1.0. Use \`${newName}\` instead.${extra}`;

/** useControllable's warning when a value switches between controlled and uncontrolled. */
const modeSwitch = (from: string, to: string) =>
  `[WaveUI] A component is changing from ${from} to ${to}. Components should not switch ` +
  'between controlled and uncontrolled: pass `undefined` only when the component is ' +
  'uncontrolled, and the empty value (for example `[]`, `null` or `""`) to clear a controlled ' +
  'value.';

describe('TabList', () => {
  testSystemProps(TabList, {
    expectedTag: 'div',
    displayName: 'TabList',
    defaultProps: { children: tabsWithPanels },
    a11yVariants: [
      { name: 'selected tab with its panel', props: { defaultValue: 'b' } },
      { name: 'vertical', props: { orientation: 'vertical', defaultValue: 'c' } },
      { name: 'tabs without panels (filter bar)', props: { children: threeTabs } },
      {
        name: 'disabled tab',
        props: {
          children: (
            <>
              <TabList.Tab value="a">Tab A</TabList.Tab>
              <TabList.Tab value="b" disabled>
                Tab B
              </TabList.Tab>
              <TabList.Panel value="a">Panel A</TabList.Panel>
            </>
          ),
        },
      },
    ],
  });

  testCompoundExposure(TabList, ['Tab', 'Panel', 'Panels']);

  it('exports every sub-component under its flat name (C-COMPOUND)', () => {
    expect(TabListTab).toBe(TabList.Tab);
    expect(TabListPanel).toBe(TabList.Panel);
    expect(TabListPanels).toBe(TabList.Panels);
  });

  it('renders a tablist containing role="tab" buttons', () => {
    render(<TabList aria-label="Sections">{threeTabs}</TabList>);
    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(3);
    expect(tab('Tab A')).toHaveAttribute('type', 'button');
  });

  it('sets aria-orientation from the orientation prop', () => {
    const { rerender } = render(<TabList>{threeTabs}</TabList>);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    rerender(<TabList orientation="vertical">{threeTabs}</TabList>);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('gates the hover color of tabs (C-TOKENS)', () => {
    render(<TabList>{threeTabs}</TabList>);
    expect(tab('Tab B')).toHaveClass('not-disabled:not-aria-disabled:hover:text-foreground');
    expect(tab('Tab B').className).not.toMatch(/(^|\s)enabled:/);
  });

  it('a conflicting className on a tab wins over the default', () => {
    render(
      <TabList>
        <TabList.Tab value="a" className="px-8">
          Tab A
        </TabList.Tab>
      </TabList>,
    );
    expect(tab('Tab A')).toHaveClass('px-8');
    expect(tab('Tab A')).not.toHaveClass('px-4');
  });

  it('types ref on the Props interfaces (C-REF) and orientation as the shared type', () => {
    expectTypeOf<TabListProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<TabProps['ref']>().toEqualTypeOf<React.Ref<HTMLButtonElement> | undefined>();
    expectTypeOf<TabPanelProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<TabPanelsProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<NonNullable<TabListProps['orientation']>>().toEqualTypeOf<Orientation>();
  });

  it('the ref receives the tablist once, not on every render (overlays#35)', () => {
    const ref = vi.fn();
    const { rerender } = render(<TabList ref={ref}>{threeTabs}</TabList>);
    rerender(<TabList ref={ref}>{threeTabs}</TabList>);
    rerender(<TabList ref={ref}>{threeTabs}</TabList>);
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledWith(screen.getByRole('tablist'));
  });

  it('throws when a Tab is used outside a TabList (C-CONTEXT)', () => {
    expectThrows(
      <TabList.Tab value="a">Orphan</TabList.Tab>,
      '[WaveUI] TabList.Tab must be used within <TabList>',
    );
    expectThrows(
      <TabList.Panel value="a">Orphan</TabList.Panel>,
      '[WaveUI] TabList.Panel must be used within <TabList>',
    );
  });

  it('in production, parts outside a TabList log once each and render inertly (C-CONTEXT)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orphans = (
      <>
        <TabList.Tab value="a">Orphan</TabList.Tab>
        <TabList.Panel value="a">Orphan panel</TabList.Panel>
      </>
    );
    const { rerender } = render(orphans);
    rerender(orphans);
    expect(tab('Orphan')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('Orphan panel')).not.toBeInTheDocument();
    expect(error.mock.calls).toEqual([
      ['[WaveUI] TabList.Tab must be used within <TabList>'],
      ['[WaveUI] TabList.Panel must be used within <TabList>'],
    ]);
  });

  it('parts written in a Server Component (lazy types) render the same server HTML and behave the same (C-COMPOUND)', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    const sections = (
      Tab: typeof TabList.Tab,
      Panel: typeof TabList.Panel,
      Panels: typeof TabList.Panels,
    ) => (
      <TabList aria-label="Sections">
        <Tab value="a" disabled>
          Tab A
        </Tab>
        <Tab value="b">Tab B</Tab>
        <Tab value="c" id="custom-tab-c">
          Tab C
        </Tab>
        <Panel value="b">Panel B</Panel>
        <Panels>
          <Panel value="c" id="custom-panel-c">
            Panel C
          </Panel>
        </Panels>
      </TabList>
    );
    const plain = renderToString(sections(TabList.Tab, TabList.Panel, TabList.Panels));
    const lazy = sections(
      asClientReference(TabList.Tab),
      asClientReference(TabList.Panel),
      asClientReference(TabList.Panels),
    );
    expect(renderToString(lazy)).toBe(plain);

    render(lazy);
    // The first enabled written tab is the default, and the panels render after the tablist.
    const tablist = screen.getByRole('tablist');
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(tablist).not.toContainElement(screen.getByRole('tabpanel', { name: 'Tab B' }));
    await user.click(tab('Tab C'));
    expect(screen.getByRole('tabpanel', { name: 'Tab C' })).toHaveAttribute('id', 'custom-panel-c');
    expect(tab('Tab C')).toHaveAttribute('aria-controls', 'custom-panel-c');
    expect(warn).not.toHaveBeenCalled();
    await expectNoA11yViolations();
  });

  it('warns once per value shared by several tabs (C-DEV)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const duplicated = (
      <TabList aria-label="Sections" defaultValue="a">
        <TabList.Tab value="a">First</TabList.Tab>
        <TabList.Tab value="a">Copy</TabList.Tab>
        <TabList.Tab value="b">Second</TabList.Tab>
      </TabList>
    );
    const { rerender } = render(duplicated);
    rerender(duplicated);
    expect(warnings(warn)).toEqual([
      '[WaveUI] TabList: several tabs share the value "a". Tab values must be unique within a ' +
        'TabList; tabs with the same value share one id and are selected (and tab stops) together.',
    ]);
  });

  it('does not warn about tab values in StrictMode, when keyed tabs are reordered or when a tab is replaced (C-DEV)', async () => {
    const warn = vi.spyOn(console, 'warn');
    const renderTabs = (keys: string[]) => (
      <React.StrictMode>
        <TabList aria-label="Sections" defaultValue="a">
          {keys.map((key) => (
            <TabList.Tab key={key} value={key.replace('-new', '')}>
              {key}
            </TabList.Tab>
          ))}
        </TabList>
      </React.StrictMode>
    );
    const { rerender } = render(renderTabs(['a', 'b', 'c']));
    // Async act: the roving store sees the moved tabs through a MutationObserver (a microtask).
    await act(async () => rerender(renderTabs(['c', 'a', 'b'])));
    await act(async () => rerender(renderTabs(['c', 'a-new', 'b'])));
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(warn).not.toHaveBeenCalled();
  });

  describe('re-rendering with unchanged state and inline callbacks does not re-render memoized tabs and panels (table-core#25)', () => {
    const Tabs = React.memo(function Tabs({
      onRender,
    }: {
      onRender: React.ProfilerOnRenderCallback;
    }) {
      return (
        <React.Profiler id="tabs" onRender={onRender}>
          <TabList.Tab value="a">Tab A</TabList.Tab>
          <TabList.Tab value="b">Tab B</TabList.Tab>
        </React.Profiler>
      );
    });
    const Panels = React.memo(function Panels({
      onRender,
    }: {
      onRender: React.ProfilerOnRenderCallback;
    }) {
      return (
        <React.Profiler id="panels" onRender={onRender}>
          <TabList.Panel value="a">Panel A</TabList.Panel>
          <TabList.Panel value="b">Panel B</TabList.Panel>
        </React.Profiler>
      );
    });

    it.each<[string, Partial<TabListProps>, string]>([
      ['uncontrolled with defaultValue', { defaultValue: 'b' }, 'Tab B'],
      ['uncontrolled without a default (derived selection)', {}, 'Tab A'],
      ['controlled', { value: 'b' }, 'Tab B'],
    ])('%s', (_name, props, selectedTab) => {
      const onRender = vi.fn();
      function Host({ tick }: { tick: number }) {
        return (
          <TabList aria-label="Sections" data-tick={tick} {...props} onValueChange={() => {}}>
            <Tabs onRender={onRender} />
            <TabList.Panels>
              <Panels onRender={onRender} />
            </TabList.Panels>
          </TabList>
        );
      }
      const { rerender } = render(<Host tick={0} />);
      expect(screen.getByRole('tabpanel', { name: selectedTab })).toBeInTheDocument();
      const initial = onRender.mock.calls.length;
      rerender(<Host tick={1} />);
      rerender(<Host tick={2} />);
      expect(screen.getByRole('tablist')).toHaveAttribute('data-tick', '2');
      expect(onRender.mock.calls.length).toBe(initial);
    });
  });
});

describe('TabList - uncontrolled', () => {
  it('selects defaultValue', () => {
    render(<TabList defaultValue="b">{threeTabs}</TabList>);
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'false');
  });

  it('changes tab on click', async () => {
    const user = userEvent.setup();
    render(<TabList defaultValue="a">{threeTabs}</TabList>);
    await user.click(tab('Tab B'));
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'false');
  });

  it('selects the first tab and shows its panel without value or defaultValue (table-core#5)', () => {
    render(<TabList>{tabsWithPanels}</TabList>);
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tabpanel', { name: 'Tab A' })).toHaveTextContent('Panel A');
  });

  it('the derived default is in the first commit and in server-rendered HTML (table-core#5)', () => {
    let firstCommit: { selected: string | null; panel: string | null } | null = null;
    function FirstCommitProbe() {
      React.useLayoutEffect(() => {
        firstCommit = {
          selected:
            document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null,
          panel: document.querySelector('[role="tabpanel"]')?.textContent ?? null,
        };
      }, []);
      return null;
    }
    render(
      <>
        <TabList>{tabsWithPanels}</TabList>
        <FirstCommitProbe />
      </>,
    );
    expect(firstCommit).toEqual({ selected: 'Tab A', panel: 'Panel A' });

    const html = renderToString(
      <TabList>
        <TabList.Tab value="a" aria-disabled="true">
          Tab A
        </TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a">Panel A</TabList.Panel>
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </TabList>,
    );
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const selected = parsed.querySelector('[role="tab"][aria-selected="true"]');
    expect(selected?.textContent).toBe('Tab B');
    expect(selected?.getAttribute('tabindex')).toBe('0');
    const panel = parsed.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toBe('Panel B');
    expect(selected?.getAttribute('aria-controls')).toBe(panel?.id);
    expect(panel?.getAttribute('aria-labelledby')).toBe(selected?.id);
  });

  it('selects the first enabled tab when the first tab is disabled', () => {
    render(
      <TabList defaultValue="">
        <TabList.Tab value="a" disabled>
          Tab A
        </TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a">Panel A</TabList.Panel>
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </TabList>,
    );
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Tab B' })).toHaveTextContent('Panel B');
  });

  it('mixed custom and written tabs: the default is the first written tab; defaultValue picks a custom one (table-core#5)', () => {
    function CustomA() {
      return <TabList.Tab value="a">Tab A</TabList.Tab>;
    }
    const { unmount } = render(
      <TabList>
        <CustomA />
        <TabList.Tab value="b">Tab B</TabList.Tab>
      </TabList>,
    );
    // Documented on `defaultValue`: server and client can only see the written tab.
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'false');
    unmount();
    render(
      <TabList defaultValue="a">
        <CustomA />
        <TabList.Tab value="b">Tab B</TabList.Tab>
      </TabList>,
    );
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
  });

  it('without a default: Tab reaches the first tab and ArrowRight moves to the second (table-core#5)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TabList onValueChange={onValueChange}>{threeTabs}</TabList>);
    await user.tab();
    expect(tab('Tab A')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab('Tab B')).toHaveFocus();
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('clicking the derived default tab does not report a change', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TabList onValueChange={onValueChange}>{threeTabs}</TabList>);
    await user.click(tab('Tab A'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
  });

  it('StrictMode: onValueChange fires exactly once per click (table-core#3)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <TabList defaultValue="a" onValueChange={onValueChange}>
          {threeTabs}
        </TabList>
      </React.StrictMode>,
    );
    await user.click(tab('Tab C'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('c');
  });
});

describe('TabList - controlled', () => {
  it('respects the value prop', () => {
    render(<TabList value="b">{threeTabs}</TabList>);
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onValueChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabList value="a" onValueChange={onValueChange}>
        {threeTabs}
      </TabList>,
    );
    await user.click(tab('Tab B'));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('a parent that ignores onValueChange keeps the selection and is told again on the next click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabList value="a" onValueChange={onValueChange}>
        {threeTabs}
      </TabList>,
    );
    await user.click(tab('Tab B'));
    await user.click(tab('Tab B'));
    expect(onValueChange.mock.calls).toEqual([['b'], ['b']]);
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
  });

  it('value="" in controlled mode selects nothing', () => {
    render(<TabList value="">{tabsWithPanels}</TabList>);
    expect(screen.queryByRole('tab', { selected: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(tab('Tab A')).toHaveAttribute('tabindex', '0');
  });

  it('a controlled value that becomes undefined clears the selection and stays controlled', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onValueChange = vi.fn();
    const { rerender } = render(
      <TabList value="b" onValueChange={onValueChange}>
        {tabsWithPanels}
      </TabList>,
    );
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    rerender(
      <TabList value={undefined} onValueChange={onValueChange}>
        {tabsWithPanels}
      </TabList>,
    );
    // Like value="": no tab is selected and no panel is shown (the first tab stays the tab stop).
    expect(screen.queryByRole('tab', { selected: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(tab('Tab A')).toHaveAttribute('tabindex', '0');
    // Still controlled: a click reports the tab and the parent decides.
    await user.click(tab('Tab B'));
    expect(onValueChange.mock.calls).toEqual([['b']]);
    expect(screen.queryByRole('tab', { selected: true })).not.toBeInTheDocument();
    expect(warnings(warn)).toEqual([modeSwitch('controlled', 'uncontrolled')]);
  });
});

describe('TabList - parts that unmount', () => {
  type Toggle = (show: boolean) => void;

  /** Renders its children until told otherwise, without rendering the TabList again. */
  function Removable({ api, children }: { api: React.Ref<Toggle>; children: React.ReactNode }) {
    const [show, setShow] = React.useState(true);
    React.useImperativeHandle(api, () => setShow, []);
    return show ? children : null;
  }

  it('a Panel that unmounts: its Tab drops aria-controls, and gets it back when it mounts again', async () => {
    const toggle = React.createRef<Toggle>();
    render(
      <TabList aria-label="Sections" value="b">
        {threeTabs}
        <TabList.Panels>
          <Removable api={toggle}>
            <TabList.Panel value="b">Panel B</TabList.Panel>
          </Removable>
        </TabList.Panels>
      </TabList>,
    );
    expect(tab('Tab B')).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);

    act(() => toggle.current?.(false));
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(tab('Tab B')).not.toHaveAttribute('aria-controls');
    await expectNoA11yViolations();

    act(() => toggle.current?.(true));
    expect(tab('Tab B')).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
  });

  it('a Tab that unmounts: its Panel drops aria-labelledby', async () => {
    const toggle = React.createRef<Toggle>();
    render(
      <TabList aria-label="Sections" value="a">
        <Removable api={toggle}>
          <TabList.Tab value="a">Tab A</TabList.Tab>
        </Removable>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a">Panel A</TabList.Panel>
      </TabList>,
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tab('Tab A').id);

    act(() => toggle.current?.(false));
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('aria-labelledby');
    await expectNoA11yViolations();
  });

  it('two Panels with the same value: when the first unmounts, the Tab references the second', () => {
    const toggle = React.createRef<Toggle>();
    render(
      <TabList aria-label="Sections" value="b">
        {threeTabs}
        <TabList.Panels>
          <Removable api={toggle}>
            <TabList.Panel value="b" id="first-b">
              First B
            </TabList.Panel>
          </Removable>
          <TabList.Panel value="b" id="second-b">
            Second B
          </TabList.Panel>
        </TabList.Panels>
      </TabList>,
    );
    expect(tab('Tab B')).toHaveAttribute('aria-controls', 'first-b');
    act(() => toggle.current?.(false));
    expect(tab('Tab B')).toHaveAttribute('aria-controls', 'second-b');
  });
});

describe('TabList - deprecated aliases (feedback-navigation#46, layout#16)', () => {
  const ON_TAB_SELECT_DEPRECATED = deprecated(
    'onTabSelect',
    'onValueChange',
    ' `onValueChange` is called only when the selected tab changes.',
  );

  it('selectedValue, defaultSelectedValue, onTabSelect and vertical still work and warn once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    const { rerender } = render(
      <TabList defaultSelectedValue="b" onTabSelect={onTabSelect} vertical>
        {threeTabs}
      </TabList>,
    );
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    await user.click(tab('Tab C'));
    expect(onTabSelect).toHaveBeenCalledWith('c');

    rerender(
      <TabList selectedValue="a" onTabSelect={onTabSelect}>
        {threeTabs}
      </TabList>,
    );
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');

    expect(warnings(warn)).toEqual([
      deprecated('defaultSelectedValue', 'defaultValue'),
      deprecated('vertical', 'orientation'),
      ON_TAB_SELECT_DEPRECATED,
      deprecated('selectedValue', 'value'),
      // The rerender passes a value where the first render had none.
      modeSwitch('uncontrolled', 'controlled'),
    ]);
  });

  it('the new names win over the deprecated ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <TabList value="c" selectedValue="a" orientation="horizontal" vertical>
        {threeTabs}
      </TabList>,
    );
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(warnings(warn)).toEqual([
      deprecated('selectedValue', 'value'),
      deprecated('vertical', 'orientation'),
    ]);
  });

  it('onTabSelect fires when the selected tab is activated again; onValueChange does not', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    const onValueChange = vi.fn();
    render(
      <TabList defaultValue="a" onTabSelect={onTabSelect} onValueChange={onValueChange}>
        {threeTabs}
      </TabList>,
    );
    await user.click(tab('Tab A'));
    expect(onTabSelect).toHaveBeenCalledTimes(1);
    expect(onTabSelect).toHaveBeenCalledWith('a');
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(tab('Tab B'));
    expect(onTabSelect).toHaveBeenLastCalledWith('b');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(warnings(warn)).toEqual([ON_TAB_SELECT_DEPRECATED]);
  });

  it('onTabSelect does not fire when a disabled tab is clicked (layout#13)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList defaultValue="a" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b" disabled>
          Tab B
        </TabList.Tab>
        <TabList.Tab value="c" aria-disabled="true">
          Tab C
        </TabList.Tab>
      </TabList>,
    );
    await user.click(tab('Tab B'));
    await user.click(tab('Tab C'));
    expect(onTabSelect).not.toHaveBeenCalled();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    expect(warnings(warn)).toEqual([ON_TAB_SELECT_DEPRECATED]);
  });
});

describe('TabList.Panel', () => {
  it('renders only the active panel', () => {
    render(<TabList defaultValue="a">{tabsWithPanels}</TabList>);
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
  });

  it('switches panel on tab click', async () => {
    const user = userEvent.setup();
    render(<TabList defaultValue="a">{tabsWithPanels}</TabList>);
    await user.click(tab('Tab B'));
    expect(screen.queryByText('Panel A')).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Tab B' })).toHaveTextContent('Panel B');
  });

  it('links the selected tab and its panel through aria-controls and aria-labelledby (layout#11)', () => {
    render(<TabList defaultValue="a">{tabsWithPanels}</TabList>);
    const panel = screen.getByRole('tabpanel');
    expect(tab('Tab A').getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('Tab A').id);
    expect(tab('Tab B')).not.toHaveAttribute('aria-controls');
  });

  it('two tab lists with the same values get distinct ids (layout#11)', () => {
    render(
      <>
        <TabList aria-label="First" defaultValue="a">
          {tabsWithPanels}
        </TabList>
        <TabList aria-label="Second" defaultValue="a">
          {tabsWithPanels}
        </TabList>
      </>,
    );
    const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const [firstPanel, secondPanel] = screen.getAllByRole('tabpanel');
    const first = within(screen.getByRole('tablist', { name: 'First' })).getByRole('tab', {
      name: 'Tab A',
    });
    const second = within(screen.getByRole('tablist', { name: 'Second' })).getByRole('tab', {
      name: 'Tab A',
    });
    expect(firstPanel.getAttribute('aria-labelledby')).toBe(first.id);
    expect(secondPanel.getAttribute('aria-labelledby')).toBe(second.id);
  });

  it('values that differ only in punctuation or spaces do not collide (layout#11)', () => {
    render(
      <TabList defaultValue="a.b">
        <TabList.Tab value="a b">Space</TabList.Tab>
        <TabList.Tab value="a.b">Dot</TabList.Tab>
        <TabList.Tab value="a_b">Underscore</TabList.Tab>
        <TabList.Panel value="a.b">Dot panel</TabList.Panel>
      </TabList>,
    );
    const ids = screen.getAllByRole('tab').map((el) => el.id);
    expect(new Set(ids).size).toBe(3);
    expect(screen.getByRole('tabpanel', { name: 'Dot' })).toHaveTextContent('Dot panel');
  });

  it('a tab without a panel (a filter bar) has no aria-controls (layout#11)', async () => {
    render(<TabList aria-label="Filters">{threeTabs}</TabList>);
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).not.toHaveAttribute('aria-controls');
    await expectNoA11yViolations();
  });

  it('links the selected tab to a panel rendered inside a custom component', async () => {
    const user = userEvent.setup();
    function SettingsPanel() {
      return <TabList.Panel value="b">Panel B</TabList.Panel>;
    }
    render(
      <TabList defaultValue="a">
        {threeTabs}
        <TabList.Panels>
          <TabList.Panel value="a">Panel A</TabList.Panel>
          <SettingsPanel />
        </TabList.Panels>
      </TabList>,
    );
    await user.click(tab('Tab B'));
    const panel = screen.getByRole('tabpanel', { name: 'Tab B' });
    expect(tab('Tab B')).toHaveAttribute('aria-controls', panel.id);
    await user.click(tab('Tab C'));
    expect(tab('Tab C')).not.toHaveAttribute('aria-controls');
    await expectNoA11yViolations();
  });

  it('keeps a consumer id on a Tab and a Panel and links them through it (layout#10)', () => {
    render(
      <TabList defaultValue="a">
        <TabList.Tab value="a" id="my-tab">
          Tab A
        </TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a" id="my-panel">
          Panel A
        </TabList.Panel>
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </TabList>,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Tab A' });
    expect(tab('Tab A')).toHaveAttribute('id', 'my-tab');
    expect(panel).toHaveAttribute('id', 'my-panel');
    expect(tab('Tab A')).toHaveAttribute('aria-controls', 'my-panel');
    expect(panel).toHaveAttribute('aria-labelledby', 'my-tab');
  });

  it('an empty consumer id counts as none: the generated ids are rendered and linked (layout#10)', async () => {
    function CustomTab() {
      return (
        <TabList.Tab value="b" id="">
          Tab B
        </TabList.Tab>
      );
    }
    const user = userEvent.setup();
    render(
      <TabList defaultValue="a">
        <TabList.Tab value="a" id="">
          Tab A
        </TabList.Tab>
        <CustomTab />
        <TabList.Panel value="a" id="">
          Panel A
        </TabList.Panel>
        <TabList.Panel value="b" id="">
          Panel B
        </TabList.Panel>
      </TabList>,
    );
    for (const name of ['Tab A', 'Tab B']) {
      if (name === 'Tab B') await user.click(tab('Tab B'));
      const panel = screen.getByRole('tabpanel', { name });
      expect(tab(name).id).not.toBe('');
      expect(panel.id).not.toBe('');
      expect(tab(name)).toHaveAttribute('aria-controls', panel.id);
      expect(panel).toHaveAttribute('aria-labelledby', tab(name).id);
    }
    await expectNoA11yViolations();
  });

  it('after mount, only a mounted panel is referenced: a Panel inside a wrapper that renders nothing is not (layout#11)', async () => {
    function FeatureGate(_props: { children: React.ReactNode }) {
      return null;
    }
    render(
      <TabList defaultValue="a">
        {threeTabs}
        <TabList.Panels>
          <FeatureGate>
            <TabList.Panel value="a">Panel A</TabList.Panel>
          </FeatureGate>
          <TabList.Panel value="b">Panel B</TabList.Panel>
        </TabList.Panels>
      </TabList>,
    );
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).not.toHaveAttribute('aria-controls');
    await expectNoA11yViolations();
    // The static structure still links the tab in server-rendered HTML, before anything mounts.
    const html = renderToString(
      <TabList defaultValue="b">
        {threeTabs}
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </TabList>,
    );
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const panel = parsed.querySelector('[role="tabpanel"]');
    expect(
      parsed.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('aria-controls'),
    ).toBe(panel?.id);
  });

  it('a Panel whose Tab never mounts has no aria-labelledby (layout#11)', () => {
    function FeatureGate(_props: { children: React.ReactNode }) {
      return null;
    }
    render(
      <TabList defaultValue="a">
        <FeatureGate>
          <TabList.Tab value="a">Tab A</TabList.Tab>
        </FeatureGate>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a">Panel A</TabList.Panel>
      </TabList>,
    );
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('aria-labelledby');
  });

  it('a consumer id given inside a custom component is linked once it mounts', () => {
    function CustomTab() {
      return (
        <TabList.Tab value="a" id="custom-tab">
          Tab A
        </TabList.Tab>
      );
    }
    render(
      <TabList defaultValue="a">
        <CustomTab />
        <TabList.Panel value="a">Panel A</TabList.Panel>
      </TabList>,
    );
    expect(screen.getByRole('tabpanel', { name: 'Tab A' })).toHaveAttribute(
      'aria-labelledby',
      'custom-tab',
    );
  });

  it('panel has tabIndex 0 for keyboard access', () => {
    render(<TabList defaultValue="a">{tabsWithPanels}</TabList>);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');
  });
});

describe('TabList - registration and structure (layout#12)', () => {
  /** Stand-in for a Tooltip (P16): a wrapper component around its child (§5.9). */
  const WrapperStandIn = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex">{children}</span>
  );

  it('renders Fragment- and wrapper-wrapped tabs inside the tablist and reaches them by keyboard', async () => {
    const user = userEvent.setup();
    render(
      <TabList defaultValue="a">
        <>
          <TabList.Tab value="a">Tab A</TabList.Tab>
          <TabList.Tab value="b">Tab B</TabList.Tab>
        </>
        <WrapperStandIn>
          <TabList.Tab value="c" aria-label="Tab C" />
        </WrapperStandIn>
        <TabList.Panel value="c">Panel C</TabList.Panel>
      </TabList>,
    );
    const tablist = screen.getByRole('tablist');
    for (const name of ['Tab A', 'Tab B', 'Tab C']) {
      expect(tablist).toContainElement(tab(name));
    }
    act(() => tab('Tab A').focus());
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(tab('Tab C')).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Tab C' })).toHaveTextContent('Panel C');
    expect(tablist).not.toContainElement(screen.getByRole('tabpanel'));
  });

  it('renders panels inside TabList.Panels after the tablist', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <TabList defaultValue="b">
        {threeTabs}
        <TabList.Panels ref={ref} className="custom-panels" data-testid="panels">
          <TabList.Panel value="a">Panel A</TabList.Panel>
          <TabList.Panel value="b">Panel B</TabList.Panel>
        </TabList.Panels>
      </TabList>,
    );
    const panels = screen.getByTestId('panels');
    expect(ref.current).toBe(panels);
    expect(panels).toHaveClass('custom-panels');
    expect(screen.getByRole('tablist')).not.toContainElement(panels);
    expect(within(panels).getByRole('tabpanel', { name: 'Tab B' })).toHaveTextContent('Panel B');
  });

  /** Renders its children as they are, like an error boundary. */
  function Boundary({ children }: { children: React.ReactNode }) {
    return children;
  }

  it.each<[string, (panel: React.ReactNode) => React.ReactNode]>([
    ['a wrapper component', (panel) => <WrapperStandIn>{panel}</WrapperStandIn>],
    ['a component that renders its children', (panel) => <Boundary>{panel}</Boundary>],
    ['Suspense', (panel) => <React.Suspense fallback={<p>Loading</p>}>{panel}</React.Suspense>],
    [
      'a <div> with other content',
      (panel) => (
        <div data-testid="panel-wrapper">
          <p>Details</p>
          {panel}
        </div>
      ),
    ],
  ])('renders a Panel wrapped in %s after the tablist, not inside it', async (_name, wrap) => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <TabList aria-label="Sections" defaultValue="a">
        {threeTabs}
        {wrap(<TabList.Panel value="a">Panel A</TabList.Panel>)}
      </TabList>,
    );
    const tablist = screen.getByRole('tablist');
    const panel = screen.getByRole('tabpanel', { name: 'Tab A' });
    expect(tablist).not.toContainElement(panel);
    expect(within(tablist).getAllByRole('tab')).toHaveLength(3);
    expect(tab('Tab A')).toHaveAttribute('aria-controls', panel.id);
    expect(warn).not.toHaveBeenCalled();
    await expectNoA11yViolations();
  });

  function SettingsPanel() {
    return <TabList.Panel value="a">Panel A</TabList.Panel>;
  }

  it.each<[string, React.ReactNode, string]>([
    ['a component that renders the Panel itself', <SettingsPanel key="opaque" />, 'a'],
    ['the same, while the Panel is hidden', <SettingsPanel key="opaque" />, 'b'],
    [
      'a wrapper that also holds a Tab',
      <WrapperStandIn key="mixed">
        <TabList.Tab value="d">Tab D</TabList.Tab>
        <TabList.Panel value="a">Panel A</TabList.Panel>
      </WrapperStandIn>,
      'a',
    ],
  ])('warns once when a Panel ends up inside the tablist: %s', (_name, content, defaultValue) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderTabList = () => (
      <TabList defaultValue={defaultValue}>
        {threeTabs}
        {content}
      </TabList>
    );
    const { rerender } = render(renderTabList());
    rerender(renderTabList());
    expect(warnings(warn)).toEqual([
      '[WaveUI] TabList.Panel was rendered inside the role="tablist" element, where only tabs ' +
        'belong (axe aria-required-children). The TabList moves a Panel after the tablist when it ' +
        'is its child, or in a wrapper that holds no Tab, but it cannot see a Panel that a ' +
        "component renders itself, or separate a wrapper's Panels from its Tabs. Place such " +
        'panels inside TabList.Panels, which renders after the tablist.',
    ]);
  });

  it('Panels in TabList.Panels or after the tablist never warn, also when they show later', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    function LaterPanel() {
      return <TabList.Panel value="c">Panel C</TabList.Panel>;
    }
    render(
      <TabList defaultValue="a">
        {threeTabs}
        <TabList.Panels>
          <TabList.Panel value="a">Panel A</TabList.Panel>
          <LaterPanel />
        </TabList.Panels>
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </TabList>,
    );
    await user.click(tab('Tab C'));
    expect(screen.getByRole('tabpanel', { name: 'Tab C' })).toHaveTextContent('Panel C');
    await user.click(tab('Tab B'));
    expect(screen.getByRole('tabpanel', { name: 'Tab B' })).toHaveTextContent('Panel B');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps keyed tabs mounted (and focused) when they are reordered', async () => {
    const renderTabs = (order: string[]) => (
      <TabList defaultValue="b">
        {order.map((value) => (
          <TabList.Tab key={value} value={value}>{`Tab ${value.toUpperCase()}`}</TabList.Tab>
        ))}
      </TabList>
    );
    const { rerender } = render(renderTabs(['a', 'b', 'c']));
    const tabB = tab('Tab B');
    act(() => tabB.focus());
    // Async act: the reorder is seen by the roving store's MutationObserver in a microtask.
    await act(async () => rerender(renderTabs(['c', 'a', 'b'])));
    expect(tab('Tab B')).toBe(tabB);
    expect(tabB).toHaveFocus();
  });
});

describe('TabList - keyboard', () => {
  it('only the selected tab has tabIndex 0', () => {
    render(<TabList defaultValue="b">{threeTabs}</TabList>);
    expect(tab('Tab A')).toHaveAttribute('tabindex', '-1');
    expect(tab('Tab B')).toHaveAttribute('tabindex', '0');
    expect(tab('Tab C')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight moves focus and selects the next tab (horizontal)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabList defaultValue="a" onValueChange={onValueChange}>
        {threeTabs}
      </TabList>,
    );
    act(() => tab('Tab A').focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(tab('Tab B')).toHaveFocus();
  });

  it('ArrowLeft moves focus to the previous tab', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabList defaultValue="b" onValueChange={onValueChange}>
        {threeTabs}
      </TabList>,
    );
    act(() => tab('Tab B').focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenCalledWith('a');
    expect(tab('Tab A')).toHaveFocus();
  });

  it('wraps from the last to the first tab', async () => {
    const user = userEvent.setup();
    render(<TabList defaultValue="c">{threeTabs}</TabList>);
    act(() => tab('Tab C').focus());
    await user.keyboard('{ArrowRight}');
    expect(tab('Tab A')).toHaveFocus();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
  });

  it('Home and End move to the first and last tab', async () => {
    const user = userEvent.setup();
    render(<TabList defaultValue="b">{threeTabs}</TabList>);
    act(() => tab('Tab B').focus());
    await user.keyboard('{End}');
    expect(tab('Tab C')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tab('Tab A')).toHaveFocus();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
  });

  it('vertical: ArrowDown then ArrowUp returns to the first tab; ArrowRight is ignored (layout#14)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabList orientation="vertical" defaultValue="a" onValueChange={onValueChange}>
        {threeTabs}
      </TabList>,
    );
    act(() => tab('Tab A').focus());
    await user.keyboard('{ArrowDown}');
    expect(tab('Tab B')).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('b');
    await user.keyboard('{ArrowUp}');
    expect(tab('Tab A')).toHaveFocus();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    onValueChange.mockClear();
    await user.keyboard('{ArrowRight}');
    expect(tab('Tab A')).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('vertical: ArrowDown wraps from the last tab', async () => {
    const user = userEvent.setup();
    render(
      <TabList orientation="vertical" defaultValue="c">
        {threeTabs}
      </TabList>,
    );
    act(() => tab('Tab C').focus());
    await user.keyboard('{ArrowDown}');
    expect(tab('Tab A')).toHaveFocus();
  });

  it('RTL: ArrowLeft moves to the next tab and ArrowRight to the previous (table-core#7)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TabList defaultValue="b">{threeTabs}</TabList>, { dir: 'rtl' });
    act(() => tab('Tab B').focus());
    await user.keyboard('{ArrowLeft}');
    expect(tab('Tab C')).toHaveFocus();
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(tab('Tab A')).toHaveFocus();
  });

  testComposedHandler(TabList, {
    handler: 'onKeyDown',
    defaultProps: { children: threeTabs, defaultValue: 'a' },
    act: async ({ user }) => {
      act(() => tab('Tab A').focus());
      await user.keyboard('{ArrowRight}');
    },
    assertInternal: () => {
      expect(tab('Tab B')).toHaveFocus();
    },
    assertInternalSuppressed: () => {
      expect(tab('Tab A')).toHaveFocus();
    },
  });

  it('a consumer onFocus runs for every tab that receives focus, also when it calls preventDefault(), and the keys still work', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn((event: React.FocusEvent) => event.preventDefault());
    const onValueChange = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <TabList defaultValue="a" onFocus={onFocus} onValueChange={onValueChange}>
          {threeTabs}
        </TabList>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(tab('Tab A')).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0][0].target).toBe(tab('Tab A'));

    await user.keyboard('{ArrowRight}');
    expect(tab('Tab B')).toHaveFocus();
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange.mock.calls).toEqual([['b']]);
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(onFocus.mock.calls[1][0].target).toBe(tab('Tab B'));
  });

  testComposedHandler(TabList.Tab, {
    handler: 'onClick',
    defaultProps: { value: 'b', children: 'Composed' },
    wrapper: ({ children }) => (
      <TabList defaultValue="a">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        {children}
      </TabList>
    ),
    act: async ({ user }) => {
      await user.click(tab('Composed'));
    },
    assertInternal: () => {
      expect(tab('Composed')).toHaveAttribute('aria-selected', 'true');
    },
    assertInternalSuppressed: () => {
      expect(tab('Composed')).toHaveAttribute('aria-selected', 'false');
    },
  });
});

describe('TabList - disabled tabs (layout#13)', () => {
  const withDisabledB = (
    <>
      <TabList.Tab value="a">Tab A</TabList.Tab>
      <TabList.Tab value="b" disabled>
        Tab B
      </TabList.Tab>
      <TabList.Tab value="c">Tab C</TabList.Tab>
    </>
  );

  it('Arrow keys skip a disabled tab', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabList defaultValue="a" onValueChange={onValueChange}>
        {withDisabledB}
      </TabList>,
    );
    act(() => tab('Tab A').focus());
    await user.keyboard('{ArrowRight}');
    expect(tab('Tab C')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tab('Tab A')).toHaveFocus();
    expect(onValueChange.mock.calls).toEqual([['c'], ['a']]);
  });

  it('Home and End skip disabled tabs at the ends', async () => {
    const user = userEvent.setup();
    render(
      <TabList defaultValue="b">
        <TabList.Tab value="a" disabled>
          Tab A
        </TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c" disabled>
          Tab C
        </TabList.Tab>
        <TabList.Tab value="d">Tab D</TabList.Tab>
        <TabList.Tab value="e" disabled>
          Tab E
        </TabList.Tab>
      </TabList>,
    );
    act(() => tab('Tab B').focus());
    await user.keyboard('{End}');
    expect(tab('Tab D')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tab('Tab B')).toHaveFocus();
  });

  it('clicking a disabled tab does not select it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabList defaultValue="a" onValueChange={onValueChange}>
        {withDisabledB}
        <TabList.Tab value="d" aria-disabled="true">
          Tab D
        </TabList.Tab>
      </TabList>,
    );
    await user.click(tab('Tab B'));
    await user.click(tab('Tab D'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
  });

  it('the tab stop falls back to the first enabled tab when the selected tab is disabled', () => {
    render(<TabList defaultValue="b">{withDisabledB}</TabList>);
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab B')).toHaveAttribute('tabindex', '-1');
    expect(tab('Tab A')).toHaveAttribute('tabindex', '0');
  });

  it('a Tab that disables itself from its own state moves the tab stop without an owner re-render', async () => {
    const user = userEvent.setup();
    let disableSelf: () => void = () => {};
    let ownerRenders = 0;
    function SelfDisablingTab() {
      const [disabled, setDisabled] = React.useState(false);
      disableSelf = () => setDisabled(true);
      return (
        <TabList.Tab value="b" disabled={disabled}>
          Tab B
        </TabList.Tab>
      );
    }
    function Owner() {
      ownerRenders += 1;
      return (
        <TabList defaultValue="b">
          <TabList.Tab value="a">Tab A</TabList.Tab>
          <SelfDisablingTab />
          <TabList.Tab value="c">Tab C</TabList.Tab>
        </TabList>
      );
    }
    render(<Owner />);
    expect(tab('Tab B')).toHaveAttribute('tabindex', '0');
    await act(async () => {
      disableSelf();
    });
    expect(tab('Tab B')).toBeDisabled();
    expect(tab('Tab A')).toHaveAttribute('tabindex', '0');
    expect(tab('Tab B')).toHaveAttribute('tabindex', '-1');
    expect(ownerRenders).toBe(1);
    act(() => tab('Tab A').focus());
    await user.keyboard('{ArrowRight}');
    expect(tab('Tab C')).toHaveFocus();
  });
});

describe('TabList - RTL layout (feedback-navigation#34)', () => {
  it('uses logical border and alignment classes in a vertical tablist', () => {
    renderWithProviders(
      <TabList orientation="vertical" defaultValue="a">
        {threeTabs}
      </TabList>,
      { dir: 'rtl' },
    );
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveClass('flex-col', 'border-e');
    expect(tablist.className).not.toMatch(/border-(r|l)\b/);
    expect(tab('Tab A')).toHaveClass('text-start', 'border-s-2', 'border-s-primary');
    expect(tab('Tab A').className).not.toMatch(/text-left|border-l/);
  });
});

// The TabList looks for its tabs and panels through wrapper elements, `<Suspense>` included.
// Panels still loading inside the consumer's own <Suspense> (the documented TabList.Panels
// pattern, code-split) suspend that boundary only, never the TabList.
describe('TabList - panels still loading inside their own Suspense', () => {
  type PanelsModule = { default: React.ComponentType };

  function LoadedPanels() {
    return (
      <>
        <TabList.Panel value="a">Panel A</TabList.Panel>
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </>
    );
  }

  /** A `React.lazy` of the panels whose chunk loads only when `load()` is called. */
  function pendingPanels() {
    let resolveModule: (module: PanelsModule) => void = () => {};
    const loading = new Promise<PanelsModule>((resolve) => {
      resolveModule = resolve;
    });
    const LazyPanels = React.lazy(() => loading);
    return { LazyPanels, load: () => resolveModule({ default: LoadedPanels }) };
  }

  const sections = (LazyPanels: React.ComponentType) => (
    <TabList aria-label="Sections">
      <TabList.Tab value="a">Tab A</TabList.Tab>
      <TabList.Tab value="b">Tab B</TabList.Tab>
      <TabList.Panels>
        <React.Suspense fallback="Loading panels">
          <LazyPanels />
        </React.Suspense>
      </TabList.Panels>
    </TabList>
  );

  it('shows the tabs and the consumer fallback, not an outer fallback instead of the TabList', async () => {
    const user = userEvent.setup();
    const { LazyPanels, load } = pendingPanels();
    render(<React.Suspense fallback="Loading page">{sections(LazyPanels)}</React.Suspense>);
    expect(screen.queryByText('Loading page')).not.toBeInTheDocument();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Loading panels')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).not.toHaveTextContent('Loading panels');

    await act(async () => load());
    const panel = screen.getByRole('tabpanel', { name: 'Tab A' });
    expect(panel).toHaveTextContent('Panel A');
    expect(tab('Tab A')).toHaveAttribute('aria-controls', panel.id);
    await user.click(tab('Tab B'));
    expect(screen.getByRole('tabpanel', { name: 'Tab B' })).toHaveTextContent('Panel B');
  });

  it('server-renders the TabList around the consumer fallback', () => {
    const { LazyPanels } = pendingPanels();
    const html = renderToString(sections(LazyPanels));
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/aria-selected="true"[^>]*>Tab A</);
    expect(html).toContain('Loading panels');
  });
});
