/**
 * TabList's sliding indicator (spec §9.2, Ruling R12): the selected transparent tab draws its line
 * as an `::after` over a transparent 2px border, and a selection change slides it from the
 * previously selected tab (FLIP). The root measures both tabs in a layout effect and writes the
 * offset and scale as custom properties on the new tab, without the transition, for one frame;
 * the frame clears them and adds `tabIndicatorMotion`, so the line glides back to its own tab.
 *
 * jsdom has no layout: the tabs get their boxes from `mockRect`, and `requestAnimationFrame` is
 * replaced by a spy that holds each frame until {@link runFrames} (every frame is held, so the
 * properties stay written until a test runs them).
 */
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabList, type TabListProps } from '../TabList';
import { tabIndicatorMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  expectNoA11yViolations,
  mockMatchMedia,
  mockRect,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

const OFFSET = '--wave-tab-indicator-offset';
const SCALE = '--wave-tab-indicator-scale';

/** The selected transparent tab's line in a horizontal list (spec §9.2, verbatim). */
const HORIZONTAL_INDICATOR = [
  'relative',
  'border-b-2',
  'border-b-transparent',
  'after:absolute',
  'after:inset-x-0',
  'after:-bottom-0.5',
  'after:border-b-2',
  'after:border-b-primary',
  'after:origin-left',
  'after:translate-x-[var(--wave-tab-indicator-offset,0px)]',
  'after:scale-x-[var(--wave-tab-indicator-scale,1)]',
  'forced-colors:after:border-[Highlight]',
];

/** The selected transparent tab's line in a vertical list (spec §9.2, verbatim). */
const VERTICAL_INDICATOR = [
  'relative',
  'border-s-2',
  'border-s-transparent',
  'after:absolute',
  'after:inset-y-0',
  'after:-start-0.5',
  'after:border-s-2',
  'after:border-s-primary',
  'after:origin-top',
  'after:translate-y-[var(--wave-tab-indicator-offset,0px)]',
  'after:scale-y-[var(--wave-tab-indicator-scale,1)]',
  'forced-colors:after:border-[Highlight]',
];

const MOTION = motionClasses(tabIndicatorMotion);

const tab = (name: string) => screen.getByRole('tab', { name });
const offset = (el: HTMLElement) => el.style.getPropertyValue(OFFSET);
const scale = (el: HTMLElement) => el.style.getPropertyValue(SCALE);
const classes = (el: HTMLElement) => Array.from(el.classList);
/** The words of `words` that `el` carries. */
const carried = (el: HTMLElement, words: readonly string[]) =>
  words.filter((word) => el.classList.contains(word));

/** A horizontal row: A at 0 (60 wide), B at 80 (100 wide), C at 200 (50 wide). */
const ROW: Record<string, Partial<DOMRect>> = {
  'Tab A': { left: 0, top: 0, width: 60, height: 40 },
  'Tab B': { left: 80, top: 0, width: 100, height: 40 },
  'Tab C': { left: 200, top: 0, width: 50, height: 40 },
};

/**
 * A vertical column: A at 0 (40 high), B at 48 (32 high). The widths differ too, so a horizontal
 * computation would give other numbers.
 */
const COLUMN: Record<string, Partial<DOMRect>> = {
  'Tab A': { left: 0, top: 0, width: 160, height: 40 },
  'Tab B': { left: 0, top: 48, width: 100, height: 32 },
  'Tab C': { left: 0, top: 88, width: 120, height: 40 },
};

function layOut(rects: Record<string, Partial<DOMRect>>) {
  for (const [name, rect] of Object.entries(rects)) mockRect(tab(name), rect);
}

const threeTabs = (
  <>
    <TabList.Tab value="a">Tab A</TabList.Tab>
    <TabList.Tab value="b">Tab B</TabList.Tab>
    <TabList.Tab value="c">Tab C</TabList.Tab>
  </>
);

const tabList = (props: Partial<TabListProps> = {}, children: React.ReactNode = threeTabs) => (
  <TabList aria-label="Sections" defaultValue="a" {...props}>
    {children}
  </TabList>
);

/** The frames requested so far and not yet run or cancelled, by id. */
let frames: Map<number, FrameRequestCallback>;
let requestFrame: MockInstance<typeof window.requestAnimationFrame>;
let cancelFrame: MockInstance<typeof window.cancelAnimationFrame>;
let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;

beforeEach(() => {
  frames = new Map();
  let nextId = 0;
  requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextId += 1;
    frames.set(nextId, callback);
    return nextId;
  });
  cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
});

afterEach(() => {
  try {
    // Nothing was logged: no warning, no act() or state-update error.
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

/** Runs, inside `act`, every frame held so far. */
function runFrames() {
  act(() => {
    const pending = Array.from(frames.values());
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
}

describe('TabList - sliding indicator (spec §9.2, R12)', () => {
  it('types motion as a motion slot', () => {
    expectTypeOf<TabListProps['motion']>().toEqualTypeOf<MotionSlot | null | undefined>();
  });

  it('draws the selected transparent tab’s line as an ::after over a transparent border', () => {
    render(tabList());
    expect(tab('Tab A')).toHaveClass(...HORIZONTAL_INDICATOR);
    expect(tab('Tab A')).not.toHaveClass('border-b-primary', 'forced-colors:border-[Highlight]');
    // Unselected tabs draw no line.
    expect(carried(tab('Tab B'), HORIZONTAL_INDICATOR)).toEqual([]);
    expect(classes(tab('Tab B')).filter((word) => word.includes('after:'))).toEqual([]);
  });

  it('draws the vertical line on the start side, with the vertical FLIP properties', () => {
    renderWithProviders(tabList({ orientation: 'vertical' }), { dir: 'rtl' });
    expect(tab('Tab A')).toHaveClass(...VERTICAL_INDICATOR);
    expect(tab('Tab A')).not.toHaveClass('border-s-primary');
    expect(carried(tab('Tab B'), VERTICAL_INDICATOR)).toEqual([]);
  });

  it('keeps the selected tab’s line visible in forced colors', () => {
    render(tabList({ defaultValue: 'b' }));
    expect(tab('Tab B')).toHaveClass('forced-colors:after:border-[Highlight]');
  });

  it.each(['horizontal', 'vertical'] as const)(
    '%s: every tab’s own border keeps one color, selected or not, so a selection fades no second line in',
    (orientation) => {
      render(tabList({ orientation }));
      // The tab's color transition covers its border: a border color that changed with the
      // selection would fade in under the new tab while the line slides there. Forced colors turn
      // a transparent border into the text color, but keep a system color.
      for (const name of ['Tab A', 'Tab B']) {
        expect(tab(name)).toHaveClass('border-transparent', 'forced-colors:border-[Canvas]');
      }
    },
  );

  it('no own border color for the other appearances', () => {
    render(tabList({ appearance: 'subtle' }));
    expect(tab('Tab A')).not.toHaveClass('border-transparent', 'forced-colors:border-[Canvas]');
  });

  it('selecting B writes the FLIP start on B without the transition; the frame clears it and adds the transition', async () => {
    const user = userEvent.setup();
    render(tabList());
    layOut(ROW);
    expect(tab('Tab A')).toHaveClass(...MOTION);

    await user.click(tab('Tab B'));
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(offset(tab('Tab B'))).toBe('-80px');
    expect(scale(tab('Tab B'))).toBe('0.6');
    expect(carried(tab('Tab B'), MOTION)).toEqual([]);
    // The previous tab draws no line any more.
    expect(carried(tab('Tab A'), [...HORIZONTAL_INDICATOR, ...MOTION])).toEqual([]);
    expect(frames.size).toBe(1);

    runFrames();
    expect(offset(tab('Tab B'))).toBe('');
    expect(scale(tab('Tab B'))).toBe('');
    expect(tab('Tab B')).toHaveClass(...MOTION, ...HORIZONTAL_INDICATOR);
    expect(frames.size).toBe(0);
  });

  it('slides from the derived default too (no value or defaultValue), and on keyboard selection', async () => {
    const user = userEvent.setup();
    render(<TabList aria-label="Sections">{threeTabs}</TabList>);
    layOut(ROW);
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');

    await user.click(tab('Tab B'));
    expect(offset(tab('Tab B'))).toBe('-80px');
    expect(scale(tab('Tab B'))).toBe('0.6');
    runFrames();

    await user.keyboard('{ArrowRight}');
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'true');
    // From B (80, 100 wide) to C (200, 50 wide).
    expect(offset(tab('Tab C'))).toBe('-120px');
    expect(scale(tab('Tab C'))).toBe('2');
    runFrames();
    expect(offset(tab('Tab C'))).toBe('');
  });

  it('writes nothing on mount, in the server HTML or the first commit', () => {
    const html = renderToString(tabList({ defaultValue: 'b' }));
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const selected = parsed.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    expect(selected?.getAttribute('style')).toBeNull();
    expect(selected?.classList.contains(MOTION[0])).toBe(true);

    render(tabList({ defaultValue: 'b' }));
    for (const name of ['Tab A', 'Tab B', 'Tab C']) {
      expect(offset(tab(name))).toBe('');
      expect(scale(tab(name))).toBe('');
    }
    expect(tab('Tab B')).toHaveClass(...MOTION);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('vertical: measures the tops and heights', async () => {
    const user = userEvent.setup();
    render(tabList({ orientation: 'vertical' }));
    layOut(COLUMN);
    await user.click(tab('Tab B'));
    expect(offset(tab('Tab B'))).toBe('-48px');
    expect(scale(tab('Tab B'))).toBe('1.25');
    runFrames();
    expect(offset(tab('Tab B'))).toBe('');
    expect(tab('Tab B')).toHaveClass(...MOTION, ...VERTICAL_INDICATOR);
  });

  it('RTL: the physical numbers, not mirrored ones', async () => {
    const user = userEvent.setup();
    renderWithProviders(tabList(), { dir: 'rtl' });
    layOut(ROW);
    await user.click(tab('Tab B'));
    expect(offset(tab('Tab B'))).toBe('-80px');
    expect(scale(tab('Tab B'))).toBe('0.6');

    // The usual RTL row (A on the right): the line comes from the right.
    runFrames();
    layOut({
      'Tab A': { left: 240, width: 60, height: 40 },
      'Tab B': { left: 120, width: 100, height: 40 },
      'Tab C': { left: 50, width: 50, height: 40 },
    });
    await user.click(tab('Tab A'));
    expect(offset(tab('Tab A'))).toBe('-120px');
    expect(scale(tab('Tab A'))).toBe(String(100 / 60));
  });

  it('keeps a consumer style on the selected tab, merged with the properties', async () => {
    const user = userEvent.setup();
    render(
      tabList(
        {},
        <>
          <TabList.Tab value="a">Tab A</TabList.Tab>
          <TabList.Tab value="b" style={{ minWidth: '10px' }}>
            Tab B
          </TabList.Tab>
        </>,
      ),
    );
    layOut({ 'Tab A': ROW['Tab A'], 'Tab B': ROW['Tab B'] });
    expect(tab('Tab B').style.minWidth).toBe('10px');
    await user.click(tab('Tab B'));
    expect(tab('Tab B').style.minWidth).toBe('10px');
    expect(offset(tab('Tab B'))).toBe('-80px');
    runFrames();
    expect(tab('Tab B').style.minWidth).toBe('10px');
    expect(offset(tab('Tab B'))).toBe('');
  });

  it('a value with quotes and brackets is compared as a string (no selector is built from it)', async () => {
    const user = userEvent.setup();
    render(
      tabList(
        { defaultValue: 'x"] [' },
        <>
          <TabList.Tab value={'x"] ['}>Tab A</TabList.Tab>
          <TabList.Tab value="y'],[data-roving-value">Tab B</TabList.Tab>
        </>,
      ),
    );
    layOut({ 'Tab A': ROW['Tab A'], 'Tab B': ROW['Tab B'] });
    await user.click(tab('Tab B'));
    expect(offset(tab('Tab B'))).toBe('-80px');
    expect(scale(tab('Tab B'))).toBe('0.6');
  });

  describe('when nothing is written', () => {
    it('with motion={null}: no properties, no frame and no transition words', async () => {
      const user = userEvent.setup();
      render(tabList({ motion: null }));
      layOut(ROW);
      expect(carried(tab('Tab A'), MOTION)).toEqual([]);
      await user.click(tab('Tab B'));
      expect(offset(tab('Tab B'))).toBe('');
      expect(scale(tab('Tab B'))).toBe('');
      expect(carried(tab('Tab B'), MOTION)).toEqual([]);
      expect(tab('Tab B')).toHaveClass(...HORIZONTAL_INDICATOR);
      expect(requestFrame).not.toHaveBeenCalled();
    });

    it('under the provider’s motion="none": no properties and no words; the own motion still applies', async () => {
      const user = userEvent.setup();
      const { unmount } = renderWithProviders(tabList(), { motion: 'none' });
      layOut(ROW);
      await user.click(tab('Tab B'));
      expect(offset(tab('Tab B'))).toBe('');
      expect(carried(tab('Tab B'), MOTION)).toEqual([]);
      expect(requestFrame).not.toHaveBeenCalled();
      unmount();

      renderWithProviders(tabList({ motion: 'my-motion' }), { motion: 'none' });
      layOut(ROW);
      await user.click(tab('Tab B'));
      expect(offset(tab('Tab B'))).toBe('-80px');
      runFrames();
      expect(tab('Tab B')).toHaveClass('my-motion');
      expect(carried(tab('Tab B'), MOTION)).toEqual([]);
    });

    it('under reduced motion (no properties; the words stay for CSS), and again once it is off', async () => {
      const user = userEvent.setup();
      const restore = mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      render(tabList());
      layOut(ROW);
      await user.click(tab('Tab B'));
      expect(offset(tab('Tab B'))).toBe('');
      expect(scale(tab('Tab B'))).toBe('');
      expect(tab('Tab B')).toHaveClass(...MOTION);
      expect(requestFrame).not.toHaveBeenCalled();

      act(() => restore());
      await user.click(tab('Tab C'));
      expect(offset(tab('Tab C'))).toBe('-120px');
      expect(scale(tab('Tab C'))).toBe('2');
    });

    it.each(['subtle', 'subtle-circular', 'filled-circular'] as const)(
      'in the %s appearance (no line, no motion words)',
      async (appearance) => {
        const user = userEvent.setup();
        render(tabList({ appearance }));
        layOut(ROW);
        await user.click(tab('Tab B'));
        expect(offset(tab('Tab B'))).toBe('');
        expect(carried(tab('Tab B'), [...MOTION, ...HORIZONTAL_INDICATOR])).toEqual([]);
        expect(classes(tab('Tab B')).filter((word) => word.includes('after:'))).toEqual([]);
        expect(requestFrame).not.toHaveBeenCalled();
      },
    );

    it('when the new tab has no width (not laid out)', async () => {
      const user = userEvent.setup();
      render(tabList());
      layOut({ ...ROW, 'Tab B': { left: 80, width: 0, height: 0 } });
      await user.click(tab('Tab B'));
      expect(offset(tab('Tab B'))).toBe('');
      expect(tab('Tab B')).toHaveClass(...MOTION);
      expect(requestFrame).not.toHaveBeenCalled();
    });

    it('when the previous tab is gone', async () => {
      // Keyed, so B and C keep their nodes (and boxes) when A is removed.
      const keyedTabs = (values: readonly string[]) =>
        values.map((value) => (
          <TabList.Tab key={value} value={value}>{`Tab ${value.toUpperCase()}`}</TabList.Tab>
        ));
      const { rerender } = render(
        tabList({ value: 'a', defaultValue: undefined }, keyedTabs(['a', 'b', 'c'])),
      );
      layOut(ROW);
      const tabB = tab('Tab B');
      // Async act: the roving store sees the removed tab through a MutationObserver (a microtask).
      await act(async () =>
        rerender(tabList({ value: 'b', defaultValue: undefined }, keyedTabs(['b', 'c']))),
      );
      expect(tab('Tab B')).toBe(tabB);
      expect(tabB.getBoundingClientRect().width).toBe(100);
      expect(tabB).toHaveAttribute('aria-selected', 'true');
      expect(offset(tabB)).toBe('');
      expect(tabB).toHaveClass(...MOTION);
      expect(requestFrame).not.toHaveBeenCalled();
    });
  });

  describe('a slot replacement (MotionSlot)', () => {
    it.each<[string, MotionSlot]>([
      ['a class string', 'my-motion'],
      ['{ className }', { className: 'my-motion' }],
    ])('%s replaces the transition and still slides', async (_name, slot) => {
      const user = userEvent.setup();
      render(tabList({ motion: slot }));
      layOut(ROW);
      expect(tab('Tab A')).toHaveClass('my-motion');
      await user.click(tab('Tab B'));
      expect(offset(tab('Tab B'))).toBe('-80px');
      expect(tab('Tab B')).not.toHaveClass('my-motion');
      runFrames();
      expect(tab('Tab B')).toHaveClass('my-motion');
      expect(carried(tab('Tab B'), MOTION)).toEqual([]);
    });

    it('never reaches the DOM', () => {
      render(tabList({ motion: 'my-motion' }));
      expect(screen.getByRole('tablist')).not.toHaveAttribute('motion');
    });
  });

  describe('frames (Review Focus 5)', () => {
    it('two selections before the frame: the first frame is cancelled and only the latest pair is written', async () => {
      const user = userEvent.setup();
      render(tabList());
      layOut(ROW);
      await user.click(tab('Tab B'));
      expect(frames.size).toBe(1);
      const [first] = Array.from(frames.keys());

      await user.click(tab('Tab C'));
      expect(cancelFrame).toHaveBeenCalledWith(first);
      expect(frames.size).toBe(1);
      expect(frames.has(first)).toBe(false);
      // B is no longer selected: neither its properties nor its line.
      expect(offset(tab('Tab B'))).toBe('');
      expect(carried(tab('Tab B'), HORIZONTAL_INDICATOR)).toEqual([]);
      // The latest pair, B to C.
      expect(offset(tab('Tab C'))).toBe('-120px');
      expect(scale(tab('Tab C'))).toBe('2');
      expect(carried(tab('Tab C'), MOTION)).toEqual([]);

      runFrames();
      expect(offset(tab('Tab C'))).toBe('');
      expect(tab('Tab C')).toHaveClass(...MOTION);
    });

    it('unmounting with a frame pending cancels it, so nothing sets state afterwards', async () => {
      const user = userEvent.setup();
      const { unmount } = render(tabList());
      layOut(ROW);
      await user.click(tab('Tab B'));
      const [pending] = Array.from(frames.keys());
      expect(frames.size).toBe(1);

      unmount();
      expect(cancelFrame).toHaveBeenCalledWith(pending);
      expect(frames.size).toBe(0);
    });

    it('StrictMode: one FLIP and one frame per selection', async () => {
      const user = userEvent.setup();
      render(<React.StrictMode>{tabList()}</React.StrictMode>);
      layOut(ROW);
      expect(requestFrame).not.toHaveBeenCalled();
      await user.click(tab('Tab B'));
      expect(offset(tab('Tab B'))).toBe('-80px');
      expect(requestFrame).toHaveBeenCalledTimes(1);
      expect(cancelFrame).not.toHaveBeenCalled();
      runFrames();
      expect(offset(tab('Tab B'))).toBe('');
      expect(tab('Tab B')).toHaveClass(...MOTION);
      expect(requestFrame).toHaveBeenCalledTimes(1);
    });
  });

  describe('axe', () => {
    it.each<[string, Partial<TabListProps>, Record<string, Partial<DOMRect>>]>([
      ['horizontal', {}, ROW],
      ['vertical', { orientation: 'vertical' }, COLUMN],
    ])(
      '%s: clean while the FLIP start is written and after the frame',
      async (_name, props, rects) => {
        const user = userEvent.setup();
        render(
          tabList(
            props,
            <>
              {threeTabs}
              <TabList.Panel value="a">Panel A</TabList.Panel>
              <TabList.Panel value="b">Panel B</TabList.Panel>
            </>,
          ),
        );
        layOut(rects);
        await user.click(tab('Tab B'));
        expect(offset(tab('Tab B'))).not.toBe('');
        await expectNoA11yViolations();
        runFrames();
        await expectNoA11yViolations();
      },
    );
  });
});
