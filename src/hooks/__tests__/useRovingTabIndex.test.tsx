import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import {
  useRovingTabIndex,
  type UseRovingTabIndexOptions,
  type UseRovingTabIndexResult,
} from '../useRovingTabIndex';

type Orientation = UseRovingTabIndexOptions['orientation'];

/**
 * Legacy harness (0.4 call shape: container ref + explicit `items`). Options are forwarded only
 * when a test sets them, so the hook's own defaults are exercised.
 */
function TestGroup({
  activeValue,
  items,
  orientation,
  loop,
  onFocusMove,
}: {
  activeValue: string;
  items: string[];
  orientation?: Orientation;
  loop?: boolean;
  onFocusMove?: (value: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const options: UseRovingTabIndexOptions = { activeValue, items, onFocusMove };
  if (orientation !== undefined) options.orientation = orientation;
  if (loop !== undefined) options.loop = loop;
  const { handleKeyDown, getTabIndex } = useRovingTabIndex(containerRef, options);

  return (
    <div ref={containerRef} role="group" onKeyDown={handleKeyDown}>
      {items.map((item) => (
        <button key={item} type="button" data-roving-value={item} tabIndex={getTabIndex(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

interface DomItem {
  value: string;
  label?: string;
  disabled?: boolean;
  ariaDisabled?: boolean;
  text?: string;
}

/** DOM-mode harness: no `items`, items found through `data-roving-value`, `containerProps` spread. */
function DomGroup({
  items,
  wrap = false,
  onResult,
  containerTabIndex,
  ...options
}: Omit<UseRovingTabIndexOptions, 'items'> & {
  items: DomItem[];
  wrap?: boolean;
  onResult?: (result: UseRovingTabIndexResult) => void;
  /** Makes the container itself focusable (a surface that takes focus before its items). */
  containerTabIndex?: number;
}) {
  const result = useRovingTabIndex(options);
  onResult?.(result);
  return (
    <div role="group" aria-label="group" tabIndex={containerTabIndex} {...result.containerProps}>
      {items.map((item) => {
        const button = (
          <button
            key={item.value}
            type="button"
            data-roving-value={item.value}
            data-roving-text={item.text}
            disabled={item.disabled}
            aria-disabled={item.ariaDisabled || undefined}
            tabIndex={result.getTabIndex(item.value)}
          >
            {item.label ?? item.value}
          </button>
        );
        return wrap ? <div key={item.value}>{button}</div> : button;
      })}
    </div>
  );
}

const ABC: DomItem[] = [{ value: 'a' }, { value: 'b' }, { value: 'c' }];

const TOOLBAR_SELECTOR = 'button, [href], input, select, textarea, [role="button"], [tabindex]';

/** Managed harness (Toolbar-like): the hook writes tabIndex onto children it does not render. */
function Managed({
  children,
  tabStop,
  orientation,
  onResult,
}: {
  children: React.ReactNode;
  tabStop?: 'active' | 'last-focused';
  orientation?: Orientation;
  onResult?: (result: UseRovingTabIndexResult) => void;
}) {
  const result = useRovingTabIndex({
    itemSelector: TOOLBAR_SELECTOR,
    manageTabIndex: true,
    tabStop,
    orientation,
  });
  onResult?.(result);
  return (
    <div role="toolbar" aria-label="Formatting" {...result.containerProps}>
      {children}
    </div>
  );
}

function button(name: string) {
  return screen.getByRole('button', { name });
}

/**
 * Focuses `el` inside `act()`. Focusing an item runs the container's `onFocus` (`handleFocus`),
 * which stores the item as `focusedValue` (React state), so a bare `el.focus()` would update
 * state outside `act()`.
 */
function focus(el: HTMLElement) {
  act(() => el.focus());
}

describe('useRovingTabIndex', () => {
  describe('legacy call shape (container ref + items)', () => {
    it('sets tabIndex 0 on active item and -1 on others', () => {
      render(<TestGroup activeValue="b" items={['a', 'b', 'c']} />);
      expect(button('a')).toHaveAttribute('tabindex', '-1');
      expect(button('b')).toHaveAttribute('tabindex', '0');
      expect(button('c')).toHaveAttribute('tabindex', '-1');
    });

    it('falls back to first item when activeValue is not in items', () => {
      render(<TestGroup activeValue="z" items={['a', 'b', 'c']} />);
      expect(button('a')).toHaveAttribute('tabindex', '0');
      expect(button('b')).toHaveAttribute('tabindex', '-1');
    });

    it('moves focus right with ArrowRight (horizontal)', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(<TestGroup activeValue="a" items={['a', 'b', 'c']} onFocusMove={onFocusMove} />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      expect(onFocusMove).toHaveBeenCalledWith('b', expect.objectContaining({ key: 'ArrowRight' }));
      expect(button('b')).toHaveFocus();
    });

    it('moves focus left with ArrowLeft (horizontal)', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(<TestGroup activeValue="b" items={['a', 'b', 'c']} onFocusMove={onFocusMove} />);
      focus(button('b'));
      await user.keyboard('{ArrowLeft}');
      expect(onFocusMove).toHaveBeenCalledWith('a', expect.anything());
      expect(button('a')).toHaveFocus();
    });

    it('wraps focus around with loop=true', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(<TestGroup activeValue="c" items={['a', 'b', 'c']} loop onFocusMove={onFocusMove} />);
      focus(button('c'));
      await user.keyboard('{ArrowRight}');
      expect(onFocusMove).toHaveBeenCalledWith('a', expect.anything());
      expect(button('a')).toHaveFocus();
    });

    it('does not wrap with loop=false', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(
        <TestGroup
          activeValue="c"
          items={['a', 'b', 'c']}
          loop={false}
          onFocusMove={onFocusMove}
        />,
      );
      focus(button('c'));
      await user.keyboard('{ArrowRight}');
      expect(onFocusMove).not.toHaveBeenCalled();
      expect(button('c')).toHaveFocus();
    });

    it('does not wrap at the start boundary with loop=false, but Home/End still work', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(
        <TestGroup
          activeValue="a"
          items={['a', 'b', 'c']}
          loop={false}
          onFocusMove={onFocusMove}
        />,
      );
      focus(button('a'));
      await user.keyboard('{ArrowLeft}');
      expect(onFocusMove).not.toHaveBeenCalled();
      expect(button('a')).toHaveFocus();

      await user.keyboard('{End}');
      expect(button('c')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('a')).toHaveFocus();
    });

    it('supports vertical orientation with ArrowDown/ArrowUp', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(
        <TestGroup
          activeValue="a"
          items={['a', 'b', 'c']}
          orientation="vertical"
          onFocusMove={onFocusMove}
        />,
      );
      focus(button('a'));
      await user.keyboard('{ArrowDown}');
      expect(onFocusMove).toHaveBeenLastCalledWith('b', expect.anything());

      await user.keyboard('{ArrowUp}');
      expect(onFocusMove).toHaveBeenLastCalledWith('a', expect.anything());

      onFocusMove.mockClear();
      await user.keyboard('{ArrowRight}');
      expect(onFocusMove).not.toHaveBeenCalled();
    });

    it('does not respond to ArrowDown/ArrowUp in horizontal mode', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(
        <TestGroup
          activeValue="a"
          items={['a', 'b', 'c']}
          orientation="horizontal"
          onFocusMove={onFocusMove}
        />,
      );
      focus(button('a'));
      await user.keyboard('{ArrowDown}');
      expect(onFocusMove).not.toHaveBeenCalled();
    });

    it('Home moves to first item', async () => {
      const user = userEvent.setup();
      render(<TestGroup activeValue="c" items={['a', 'b', 'c']} />);
      focus(button('c'));
      await user.keyboard('{Home}');
      expect(button('a')).toHaveFocus();
    });

    it('End moves to last item', async () => {
      const user = userEvent.setup();
      render(<TestGroup activeValue="a" items={['a', 'b', 'c']} />);
      focus(button('a'));
      await user.keyboard('{End}');
      expect(button('c')).toHaveFocus();
    });
  });

  describe('defaults and key handling (table-core#29)', () => {
    it('defaults to horizontal orientation with looping', async () => {
      const user = userEvent.setup();
      render(<TestGroup activeValue="c" items={['a', 'b', 'c']} />);
      focus(button('c'));
      await user.keyboard('{ArrowDown}');
      expect(button('c')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('a')).toHaveFocus();
    });

    it("handles all four arrows with orientation 'both'", async () => {
      const user = userEvent.setup();
      render(<DomGroup items={ABC} orientation="both" activeValue="a" />);
      focus(button('a'));
      await user.keyboard('{ArrowDown}');
      expect(button('b')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('c')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(button('b')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('a')).toHaveFocus();
    });

    it('prevents the default action of handled keys only', () => {
      render(<DomGroup items={ABC} activeValue="a" />);
      const a = button('a');
      focus(a);
      expect(fireEvent.keyDown(a, { key: 'ArrowRight' })).toBe(false);
      expect(fireEvent.keyDown(button('b'), { key: 'Home' })).toBe(false);
      expect(fireEvent.keyDown(button('a'), { key: 'Tab' })).toBe(true);
      expect(fireEvent.keyDown(button('a'), { key: 'Enter' })).toBe(true);
      expect(fireEvent.keyDown(button('a'), { key: 'x' })).toBe(true);
      // ArrowDown is not an arrow of a horizontal group
      expect(fireEvent.keyDown(button('a'), { key: 'ArrowDown' })).toBe(true);
    });

    it('ignores keys whose default was already prevented', () => {
      function Group() {
        const { containerProps, getTabIndex } = useRovingTabIndex({ activeValue: 'a' });
        return (
          <div {...containerProps}>
            <button
              type="button"
              data-roving-value="a"
              tabIndex={getTabIndex('a')}
              onKeyDown={(e) => e.preventDefault()}
            >
              a
            </button>
            <button type="button" data-roving-value="b" tabIndex={getTabIndex('b')}>
              b
            </button>
          </div>
        );
      }
      render(<Group />);
      focus(button('a'));
      fireEvent.keyDown(button('a'), { key: 'ArrowRight' });
      expect(button('a')).toHaveFocus();
    });

    it('ignores arrows with Alt, Ctrl or Meta held', () => {
      render(<DomGroup items={ABC} activeValue="a" />);
      focus(button('a'));
      expect(fireEvent.keyDown(button('a'), { key: 'ArrowRight', ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(button('a'), { key: 'ArrowRight', altKey: true })).toBe(true);
      expect(fireEvent.keyDown(button('a'), { key: 'ArrowRight', metaKey: true })).toBe(true);
      expect(button('a')).toHaveFocus();
    });

    it('follows an activeValue change, then arrows from the focused item', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TestGroup activeValue="a" items={['a', 'b', 'c']} />);
      rerender(<TestGroup activeValue="c" items={['a', 'b', 'c']} />);
      expect(button('c')).toHaveAttribute('tabindex', '0');
      expect(button('a')).toHaveAttribute('tabindex', '-1');

      await user.tab();
      expect(button('c')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('a')).toHaveFocus();
    });

    it('can disable Home/End handling', () => {
      render(<DomGroup items={ABC} activeValue="b" homeEndKeys={false} />);
      focus(button('b'));
      expect(fireEvent.keyDown(button('b'), { key: 'Home' })).toBe(true);
      expect(button('b')).toHaveFocus();
    });
  });

  describe('no selected value (table-core#5)', () => {
    it('makes the first item the tab stop and arrows move from it', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">before</button>
          <DomGroup items={ABC} />
        </>,
      );
      expect(button('a')).toHaveAttribute('tabindex', '0');
      focus(button('before'));
      await user.tab();
      expect(button('a')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('b')).toHaveFocus();
    });

    it("treats '' and null as no selection", () => {
      const { rerender } = render(<DomGroup items={ABC} activeValue="" />);
      expect(button('a')).toHaveAttribute('tabindex', '0');
      rerender(<DomGroup items={ABC} activeValue={null} />);
      expect(button('a')).toHaveAttribute('tabindex', '0');
    });

    it('moves to the first item with next when focus is on no item', () => {
      render(<DomGroup items={ABC} loop={false} />);
      fireEvent.keyDown(screen.getByRole('group', { name: 'group' }), { key: 'ArrowRight' });
      expect(button('a')).toHaveFocus();
    });

    it('moves to the last item with prev when focus is on no item', () => {
      render(<DomGroup items={ABC} loop={false} />);
      fireEvent.keyDown(screen.getByRole('group', { name: 'group' }), { key: 'ArrowLeft' });
      expect(button('c')).toHaveFocus();
    });

    it('ignores the last focused item when the key starts on the container itself', async () => {
      const user = userEvent.setup();
      render(<DomGroup items={ABC} loop={false} containerTabIndex={-1} />);
      const group = screen.getByRole('group', { name: 'group' });
      await user.click(button('b'));
      focus(group);
      await user.keyboard('{ArrowLeft}');
      // Not 'a' (the item before the last focused 'b'): prev from no item is the last item.
      expect(button('c')).toHaveFocus();
      focus(group);
      await user.keyboard('{ArrowRight}');
      // Not "nothing" (next from the last focused 'c' at the end, loop=false): the first item.
      expect(button('a')).toHaveFocus();
    });

    it('arrows start from the item that received the event even if the hook never saw it focused', () => {
      render(<TestGroup activeValue="" items={['a', 'b', 'c']} />);
      fireEvent.keyDown(button('b'), { key: 'ArrowRight' });
      expect(button('c')).toHaveFocus();
    });
  });

  describe('RTL (table-core#7)', () => {
    it('swaps ArrowLeft/ArrowRight under an rtl ancestor', async () => {
      const user = userEvent.setup();
      render(
        <div dir="rtl">
          <DomGroup items={ABC} activeValue="a" />
        </div>,
      );
      focus(button('a'));
      await user.keyboard('{ArrowLeft}');
      expect(button('b')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('a')).toHaveFocus();
    });

    it("swaps Left/Right in orientation 'both' but keeps Up/Down", async () => {
      const user = userEvent.setup();
      render(
        <div dir="rtl">
          <DomGroup items={ABC} activeValue="a" orientation="both" />
        </div>,
      );
      focus(button('a'));
      await user.keyboard('{ArrowLeft}');
      expect(button('b')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(button('c')).toHaveFocus();
    });

    it('does not change vertical navigation', async () => {
      const user = userEvent.setup();
      render(
        <div dir="rtl">
          <DomGroup items={ABC} activeValue="a" orientation="vertical" />
        </div>,
      );
      focus(button('a'));
      await user.keyboard('{ArrowDown}');
      expect(button('b')).toHaveFocus();
    });

    it('honours an explicit dir option', async () => {
      const user = userEvent.setup();
      render(<DomGroup items={ABC} activeValue="a" dir="rtl" />);
      focus(button('a'));
      await user.keyboard('{ArrowLeft}');
      expect(button('b')).toHaveFocus();
    });

    it('resolves the direction at key time (a later dir change applies)', async () => {
      const user = userEvent.setup();
      function Wrapper({ dir }: { dir: 'ltr' | 'rtl' }) {
        return (
          <div dir={dir}>
            <DomGroup items={ABC} activeValue="a" />
          </div>
        );
      }
      const { rerender } = render(<Wrapper dir="ltr" />);
      rerender(<Wrapper dir="rtl" />);
      focus(button('a'));
      await user.keyboard('{ArrowLeft}');
      expect(button('b')).toHaveFocus();
    });
  });

  describe('disabled items (layout#13)', () => {
    const WITH_DISABLED: DomItem[] = [
      { value: 'a' },
      { value: 'b', disabled: true },
      { value: 'c', ariaDisabled: true },
      { value: 'd' },
    ];

    it('skips disabled and aria-disabled items with arrows', async () => {
      const user = userEvent.setup();
      render(<DomGroup items={WITH_DISABLED} activeValue="a" />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      expect(button('d')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('a')).toHaveFocus();
    });

    it('skips disabled items with Home and End', async () => {
      const user = userEvent.setup();
      render(
        <DomGroup
          items={[
            { value: 'a', disabled: true },
            { value: 'b' },
            { value: 'c' },
            { value: 'd', disabled: true },
          ]}
          activeValue="b"
        />,
      );
      focus(button('b'));
      await user.keyboard('{End}');
      expect(button('c')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('b')).toHaveFocus();
    });

    it('skips items marked data-roving-disabled', async () => {
      const user = userEvent.setup();
      function Group() {
        const { containerProps, getTabIndex } = useRovingTabIndex({ activeValue: 'a' });
        return (
          <div {...containerProps}>
            {['a', 'b', 'c'].map((v) => (
              <button
                key={v}
                type="button"
                data-roving-value={v}
                data-roving-disabled={v === 'b' ? '' : undefined}
                tabIndex={getTabIndex(v)}
              >
                {v}
              </button>
            ))}
          </div>
        );
      }
      render(<Group />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      expect(button('c')).toHaveFocus();
    });

    it('moves the tab stop to the first enabled item when the active item is disabled', () => {
      render(<DomGroup items={[{ value: 'a' }, { value: 'b', disabled: true }]} activeValue="b" />);
      expect(button('a')).toHaveAttribute('tabindex', '0');
      expect(button('b')).toHaveAttribute('tabindex', '-1');
    });

    it('never gives the tab stop to a disabled first item', () => {
      render(<DomGroup items={[{ value: 'a', disabled: true }, { value: 'b' }]} />);
      expect(button('a')).toHaveAttribute('tabindex', '-1');
      expect(button('b')).toHaveAttribute('tabindex', '0');
    });

    it('filters disabled items of an explicit items list too', async () => {
      const user = userEvent.setup();
      function Legacy() {
        const ref = React.useRef<HTMLDivElement>(null);
        const { handleKeyDown, getTabIndex } = useRovingTabIndex(ref, {
          activeValue: 'a',
          items: ['a', 'b', 'c'],
        });
        return (
          <div ref={ref} onKeyDown={handleKeyDown}>
            {['a', 'b', 'c'].map((v) => (
              <button
                key={v}
                type="button"
                data-roving-value={v}
                disabled={v === 'b'}
                tabIndex={getTabIndex(v)}
              >
                {v}
              </button>
            ))}
          </div>
        );
      }
      render(<Legacy />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      expect(button('c')).toHaveFocus();
    });

    it('updates the tab stop when an item disables itself without an owner re-render', async () => {
      const toggles: Array<(disabled: boolean) => void> = [];
      let ownerRenders = 0;
      function SelfDisablingItem({ value, tabIndex }: { value: string; tabIndex: 0 | -1 }) {
        const [disabled, setDisabled] = React.useState(false);
        toggles.push(setDisabled);
        return (
          <button type="button" data-roving-value={value} disabled={disabled} tabIndex={tabIndex}>
            {value}
          </button>
        );
      }
      const MemoItem = React.memo(SelfDisablingItem);
      function Owner() {
        ownerRenders++;
        const { containerProps, getTabIndex } = useRovingTabIndex({ activeValue: 'a' });
        return (
          <div {...containerProps}>
            <MemoItem value="a" tabIndex={getTabIndex('a')} />
            <MemoItem value="b" tabIndex={getTabIndex('b')} />
          </div>
        );
      }
      render(<Owner />);
      expect(button('a')).toHaveAttribute('tabindex', '0');
      const rendersBefore = ownerRenders;

      await act(async () => {
        toggles[0](true);
      });
      expect(button('a')).toBeDisabled();
      expect(button('b')).toHaveAttribute('tabindex', '0');
      expect(ownerRenders).toBeGreaterThan(rendersBefore);

      await act(async () => {
        toggles[0](false);
      });
      expect(button('a')).toHaveAttribute('tabindex', '0');
      expect(button('b')).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('DOM item resolution (feedback-navigation#47)', () => {
    it('finds items wrapped in other elements, in DOM order', async () => {
      const user = userEvent.setup();
      render(<DomGroup items={ABC} wrap activeValue="a" />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      expect(button('b')).toHaveFocus();
      await user.keyboard('{End}');
      expect(button('c')).toHaveFocus();
    });

    it('finds items rendered through Fragments and skips hidden ones', async () => {
      const user = userEvent.setup();
      function Item({ value, hidden }: { value: string; hidden?: boolean }) {
        return (
          <>
            <button type="button" data-roving-value={value} hidden={hidden}>
              {value}
            </button>
          </>
        );
      }
      function Group() {
        const { containerProps } = useRovingTabIndex({ activeValue: 'a' });
        return (
          <div {...containerProps}>
            <Item value="a" />
            <Item value="b" hidden />
            <div hidden>
              <Item value="c" />
            </div>
            <Item value="d" />
          </div>
        );
      }
      render(<Group />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      expect(button('d')).toHaveFocus();
    });

    it("ignores items of a nested roving container (they belong to that container's hook)", async () => {
      const user = userEvent.setup();
      function Inner() {
        const { containerProps, getTabIndex } = useRovingTabIndex({ activeValue: 'x' });
        return (
          <div role="radiogroup" aria-label="inner" {...containerProps}>
            <button
              type="button"
              role="radio"
              aria-checked
              data-roving-value="x"
              tabIndex={getTabIndex('x')}
            >
              x
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={false}
              data-roving-value="y"
              tabIndex={getTabIndex('y')}
            >
              y
            </button>
          </div>
        );
      }
      function Outer() {
        const { containerProps, getTabIndex } = useRovingTabIndex({
          activeValue: 'a',
          orientation: 'both',
        });
        return (
          <div {...containerProps}>
            <button type="button" data-roving-value="a" tabIndex={getTabIndex('a')}>
              a
            </button>
            <Inner />
            <button type="button" data-roving-value="b" tabIndex={getTabIndex('b')}>
              b
            </button>
          </div>
        );
      }
      render(<Outer />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      // the nested composite is one item: focus lands on its own tab stop
      expect(screen.getByRole('radio', { name: 'x' })).toHaveFocus();
      // the inner group handles its arrows itself (preventDefault), so the outer ignores them
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('radio', { name: 'y' })).toHaveFocus();
      // keys the inner (horizontal) group does not handle continue in the outer group
      await user.keyboard('{ArrowDown}');
      expect(button('b')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(screen.getByRole('radio', { name: 'x' })).toHaveFocus();
    });

    it('0.4 call shape: a container ref on a wrapper around a role=radiogroup keeps its items', async () => {
      const user = userEvent.setup();
      const values = ['a', 'b', 'c'];
      function LegacyWrapper() {
        const containerRef = React.useRef<HTMLDivElement>(null);
        const { handleKeyDown, getTabIndex } = useRovingTabIndex(containerRef, {
          activeValue: 'a',
          items: values,
        });
        return (
          <div ref={containerRef} onKeyDown={handleKeyDown}>
            <div role="radiogroup" aria-label="choices">
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={value === 'a'}
                  data-roving-value={value}
                  tabIndex={getTabIndex(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        );
      }
      render(<LegacyWrapper />);
      const radio = (name: string) => screen.getByRole('radio', { name });
      expect(radio('a')).toHaveAttribute('tabindex', '0');
      expect(radio('b')).toHaveAttribute('tabindex', '-1');
      focus(radio('a'));
      await user.keyboard('{ArrowRight}');
      expect(radio('b')).toHaveFocus();
      await user.keyboard('{End}');
      expect(radio('c')).toHaveFocus();
    });

    it('explicit items: a role-only composite between the container and the items is not collapsed', async () => {
      const user = userEvent.setup();
      const values = ['one', 'two', 'three'];
      function ItemsWrapper() {
        const { containerProps, getTabIndex } = useRovingTabIndex({ items: values });
        return (
          <div {...containerProps}>
            <div role="tablist" aria-label="tabs">
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  data-roving-value={value}
                  tabIndex={getTabIndex(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        );
      }
      render(<ItemsWrapper />);
      const tab = (name: string) => screen.getByRole('tab', { name });
      expect(tab('one')).toHaveAttribute('tabindex', '0');
      focus(tab('one'));
      await user.keyboard('{ArrowRight}');
      expect(tab('two')).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(tab('three')).toHaveFocus();
    });

    it('explicit items: a nested roving container still counts as one item', async () => {
      const user = userEvent.setup();
      function Inner() {
        const { containerProps, getTabIndex } = useRovingTabIndex({ activeValue: 'x' });
        return (
          <div role="radiogroup" aria-label="inner" {...containerProps}>
            {['x', 'y'].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={value === 'x'}
                data-roving-value={value}
                tabIndex={getTabIndex(value)}
              >
                {value}
              </button>
            ))}
          </div>
        );
      }
      function Outer() {
        const containerRef = React.useRef<HTMLDivElement>(null);
        const { handleKeyDown, getTabIndex } = useRovingTabIndex(containerRef, {
          activeValue: 'a',
          items: ['a', 'b'],
          orientation: 'vertical',
        });
        return (
          <div ref={containerRef} onKeyDown={handleKeyDown}>
            <button type="button" data-roving-value="a" tabIndex={getTabIndex('a')}>
              a
            </button>
            <Inner />
            <button type="button" data-roving-value="b" tabIndex={getTabIndex('b')}>
              b
            </button>
          </div>
        );
      }
      render(<Outer />);
      focus(button('a'));
      await user.keyboard('{ArrowDown}');
      // The inner group's items are not in `items` and belong to the inner hook: skipped.
      expect(button('b')).toHaveFocus();
    });

    it('generates values for items without data-roving-value (manageTabIndex)', () => {
      render(
        <Managed>
          <button type="button">Bold</button>
          <button type="button">Italic</button>
        </Managed>,
      );
      const values = [button('Bold'), button('Italic')].map((el) =>
        el.getAttribute('data-roving-value'),
      );
      expect(values[0]).toMatch(/^auto-/);
      expect(values[1]).toMatch(/^auto-/);
      expect(values[0]).not.toBe(values[1]);
    });
  });

  describe('manageTabIndex (button-provider#12)', () => {
    it('writes tabIndex onto children it does not render and moves with arrows', async () => {
      const user = userEvent.setup();
      render(
        <Managed>
          <button type="button">Bold</button>
          <button type="button">Italic</button>
          <a href="#u">Underline</a>
        </Managed>,
      );
      expect(button('Bold')).toHaveAttribute('tabindex', '0');
      expect(button('Italic')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('link', { name: 'Underline' })).toHaveAttribute('tabindex', '-1');

      await user.tab();
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('link', { name: 'Underline' })).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('Bold')).toHaveFocus();
    });

    it('keeps the tab stop on the last focused item with tabStop="last-focused"', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Managed tabStop="last-focused">
            <button type="button">Bold</button>
            <button type="button">Italic</button>
            <button type="button">Underline</button>
          </Managed>
          <button type="button">after</button>
        </>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      expect(button('Italic')).toHaveAttribute('tabindex', '0');
      expect(button('Bold')).toHaveAttribute('tabindex', '-1');

      await user.tab();
      expect(button('after')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Italic')).toHaveFocus();
    });

    it("keeps the tab stop on the active item with the default tabStop='active'", async () => {
      const user = userEvent.setup();
      render(<DomGroup items={ABC} activeValue="a" />);
      focus(button('a'));
      await user.keyboard('{ArrowRight}');
      expect(button('b')).toHaveFocus();
      expect(button('a')).toHaveAttribute('tabindex', '0');
      expect(button('b')).toHaveAttribute('tabindex', '-1');
    });

    it('skips a disabled child and re-includes it when it enables itself (no owner re-render)', async () => {
      const user = userEvent.setup();
      function Italic() {
        const [disabled, setDisabled] = React.useState(true);
        React.useEffect(() => {
          const enable = () => setDisabled(false);
          window.addEventListener('test:enable-italic', enable);
          return () => window.removeEventListener('test:enable-italic', enable);
        }, []);
        return (
          <button type="button" disabled={disabled}>
            Italic
          </button>
        );
      }
      const italic = <Italic />;
      render(
        <Managed>
          <button type="button">Bold</button>
          {italic}
          <button type="button">Underline</button>
        </Managed>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(button('Underline')).toHaveFocus();

      await act(async () => {
        window.dispatchEvent(new Event('test:enable-italic'));
      });
      await user.keyboard('{ArrowLeft}');
      expect(button('Italic')).toHaveFocus();
    });

    it('stamps children added later without an owner re-render', async () => {
      function MoreButtons() {
        const [shown, setShown] = React.useState(false);
        React.useEffect(() => {
          const show = () => setShown(true);
          window.addEventListener('test:show-more', show);
          return () => window.removeEventListener('test:show-more', show);
        }, []);
        return shown ? <button type="button">Strike</button> : null;
      }
      render(
        <Managed>
          <button type="button">Bold</button>
          <MoreButtons />
        </Managed>,
      );
      await act(async () => {
        window.dispatchEvent(new Event('test:show-more'));
      });
      expect(button('Strike')).toHaveAttribute('tabindex', '-1');
      expect(button('Bold')).toHaveAttribute('tabindex', '0');
    });

    it('leaves elements with an author tabindex=-1 untouched and skips them', async () => {
      const user = userEvent.setup();
      render(
        <Managed>
          <button type="button">Bold</button>
          <span>
            <button type="button" tabIndex={-1}>
              Increment
            </button>
          </span>
          <button type="button">Italic</button>
        </Managed>,
      );
      expect(button('Increment')).toHaveAttribute('tabindex', '-1');
      expect(button('Increment')).not.toHaveAttribute('data-roving-value');
      focus(button('Bold'));
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
    });

    it('treats a nested composite as one item and never writes tabindex inside it', async () => {
      const user = userEvent.setup();
      render(
        <Managed>
          <button type="button">Bold</button>
          <div role="radiogroup" aria-label="Align">
            <button type="button" role="radio" aria-checked tabIndex={0}>
              Left
            </button>
            <button type="button" role="radio" aria-checked={false} tabIndex={-1}>
              Center
            </button>
          </div>
          <button type="button">Italic</button>
        </Managed>,
      );
      const left = screen.getByRole('radio', { name: 'Left' });
      const center = screen.getByRole('radio', { name: 'Center' });
      expect(left).toHaveAttribute('tabindex', '0');
      expect(center).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('tabindex');

      focus(button('Bold'));
      await user.keyboard('{ArrowRight}');
      expect(left).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(left).toHaveFocus();
      expect(left).toHaveAttribute('tabindex', '0');
      expect(center).toHaveAttribute('tabindex', '-1');
    });

    it('keeps Left/Right for the caret in a text input (APG Toolbar)', async () => {
      const user = userEvent.setup();
      render(
        <Managed>
          <button type="button">Bold</button>
          <input aria-label="Search" defaultValue="abc" />
          <button type="button">Italic</button>
        </Managed>,
      );
      const input = screen.getByRole('textbox', { name: 'Search' });
      focus(button('Bold'));
      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();
      expect(fireEvent.keyDown(input, { key: 'ArrowRight' })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'Home' })).toBe(true);
      await user.keyboard('{ArrowLeft}');
      expect(input).toHaveFocus();
    });

    it.each([
      ['textarea', <textarea key="t" aria-label="field" />],
      [
        'select',
        <select key="s" aria-label="field">
          <option>1</option>
        </select>,
      ],
      ['slider', <div key="sl" role="slider" aria-label="field" aria-valuenow={1} tabIndex={0} />],
      ['spinbutton', <input key="sp" role="spinbutton" aria-label="field" />],
      ['combobox', <input key="c" role="combobox" aria-label="field" aria-expanded={false} />],
      [
        'contenteditable',
        <div
          key="ce"
          aria-label="field"
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
        />,
      ],
    ])('ignores arrow keys that start in a %s', (_name, field) => {
      render(
        <Managed>
          <button type="button">Bold</button>
          {field}
        </Managed>,
      );
      const el = screen.getByLabelText('field');
      focus(el);
      expect(fireEvent.keyDown(el, { key: 'ArrowLeft' })).toBe(true);
      expect(el).toHaveFocus();
    });

    it('supports vertical toolbars', async () => {
      const user = userEvent.setup();
      render(
        <Managed orientation="vertical">
          <button type="button">Bold</button>
          <button type="button">Italic</button>
        </Managed>,
      );
      focus(button('Bold'));
      await user.keyboard('{ArrowDown}');
      expect(button('Italic')).toHaveFocus();
    });
  });

  describe('typeahead', () => {
    it('moves focus to the next item whose text starts with the typed characters', async () => {
      const user = userEvent.setup();
      render(
        <DomGroup
          items={[
            { value: 'new', label: 'New file' },
            { value: 'open', label: 'Open' },
            { value: 'close', label: 'Close', disabled: true },
            { value: 'copy', label: 'Copy' },
          ]}
          orientation="vertical"
          typeahead
        />,
      );
      focus(button('New file'));
      await user.keyboard('c');
      expect(button('Copy')).toHaveFocus();
      await user.keyboard('o');
      expect(button('Copy')).toHaveFocus();
    });

    it('uses data-roving-text when present', async () => {
      const user = userEvent.setup();
      render(
        <DomGroup
          items={[
            { value: 'a', label: '★ Alpha', text: 'Alpha' },
            { value: 'b', label: '★ Beta', text: 'Beta' },
          ]}
          typeahead
        />,
      );
      focus(button('★ Alpha'));
      await user.keyboard('b');
      expect(button('★ Beta')).toHaveFocus();
    });

    it('is off by default', async () => {
      const user = userEvent.setup();
      render(<DomGroup items={[{ value: 'a' }, { value: 'b' }]} />);
      focus(button('a'));
      await user.keyboard('b');
      expect(button('a')).toHaveFocus();
    });
  });

  describe('nested items: the innermost item owns the event (layout#31, layout#30)', () => {
    /** APG tree shape: div[role=treeitem] > text + div[role=group] > nested treeitems. */
    function NestedTree({
      tabStop,
      typeahead,
      onResult,
    }: {
      tabStop?: UseRovingTabIndexOptions['tabStop'];
      typeahead?: boolean;
      onResult?: (result: UseRovingTabIndexResult) => void;
    }) {
      const options: UseRovingTabIndexOptions = { orientation: 'vertical', loop: false };
      if (tabStop !== undefined) options.tabStop = tabStop;
      if (typeahead !== undefined) options.typeahead = typeahead;
      const result = useRovingTabIndex(options);
      onResult?.(result);
      const { containerProps, getTabIndex } = result;
      return (
        <div role="tree" aria-label="Nested" {...containerProps}>
          <div
            role="treeitem"
            aria-label="A"
            aria-expanded="true"
            data-roving-value="a"
            data-roving-text="A"
            tabIndex={getTabIndex('a')}
          >
            A
            <div role="group">
              <div
                role="treeitem"
                aria-label="A1"
                data-roving-value="a1"
                data-roving-text="Apple"
                tabIndex={getTabIndex('a1')}
              >
                A1
              </div>
              <div
                role="treeitem"
                aria-label="A2"
                data-roving-value="a2"
                data-roving-text="Apricot"
                tabIndex={getTabIndex('a2')}
              >
                A2
              </div>
            </div>
          </div>
          <div
            role="treeitem"
            aria-label="B"
            data-roving-value="b"
            data-roving-text="Banana"
            tabIndex={getTabIndex('b')}
          >
            B
          </div>
        </div>
      );
    }
    const treeitem = (name: string) => screen.getByRole('treeitem', { name });

    it('arrow keys move from the innermost item that contains focus', async () => {
      const user = userEvent.setup();
      render(<NestedTree />);
      await user.tab();
      expect(treeitem('A')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(treeitem('A1')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(treeitem('A2')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(treeitem('B')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(treeitem('A2')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(treeitem('A1')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(treeitem('A')).toHaveFocus();
    });

    it('typeahead starts after the innermost focused item', async () => {
      const user = userEvent.setup();
      render(<NestedTree typeahead />);
      focus(treeitem('A1'));
      // From A1 ("Apple") the next item starting with "a" is A2 ("Apricot"), not A1 again.
      await user.keyboard('a');
      expect(treeitem('A2')).toHaveFocus();
    });

    it('records the innermost focused item (focusedValue and the last-focused tab stop)', () => {
      let latest: UseRovingTabIndexResult | undefined;
      render(<NestedTree tabStop="last-focused" onResult={(r) => (latest = r)} />);
      focus(treeitem('A2'));
      expect(latest!.focusedValue).toBe('a2');
      expect(treeitem('A2')).toHaveAttribute('tabindex', '0');
      expect(treeitem('A')).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('events from a portal: only keys and focus inside the container DOM count', () => {
    /**
     * Popups a Toolbar item renders through a portal (Menu.Popover, Popover.Content): React
     * bubbles their keydown and focus events through the Toolbar, but their DOM is in
     * document.body. The menu is a vertical roving group of its own (Left/Right unhandled); the
     * popover handles no keys at all.
     */
    function PopupMenu() {
      const { containerProps, getTabIndex } = useRovingTabIndex({
        orientation: 'vertical',
        activeValue: 'cut',
      });
      return createPortal(
        <div role="menu" aria-label="Edit" {...containerProps}>
          <button
            type="button"
            role="menuitem"
            data-roving-value="cut"
            tabIndex={getTabIndex('cut')}
          >
            Cut
          </button>
          <button
            type="button"
            role="menuitem"
            data-roving-value="copy"
            tabIndex={getTabIndex('copy')}
          >
            Copy
          </button>
        </div>,
        document.body,
      );
    }

    function ToolbarWithPopups({
      typeahead,
      onResult,
    }: {
      typeahead?: boolean;
      onResult?: (result: UseRovingTabIndexResult) => void;
    }) {
      const result = useRovingTabIndex({
        itemSelector: TOOLBAR_SELECTOR,
        manageTabIndex: true,
        tabStop: 'last-focused',
        typeahead,
      });
      onResult?.(result);
      return (
        <div role="toolbar" aria-label="Formatting" {...result.containerProps}>
          <button type="button" data-roving-value="bold">
            Bold
          </button>
          <button type="button" data-roving-value="edit">
            Edit
          </button>
          <PopupMenu />
          <button type="button" data-roving-value="link">
            Link
          </button>
          {createPortal(
            <div role="dialog" aria-label="Insert link">
              <button type="button">Apply</button>
            </div>,
            document.body,
          )}
          <button type="button" data-roving-value="underline">
            Underline
          </button>
        </div>
      );
    }
    const menuitem = (name: string) => screen.getByRole('menuitem', { name });

    it('arrows a portaled menu leaves unhandled do not move focus out of it', async () => {
      const user = userEvent.setup();
      render(<ToolbarWithPopups />);
      focus(menuitem('Cut'));
      await user.keyboard('{ArrowRight}');
      expect(menuitem('Cut')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(menuitem('Cut')).toHaveFocus();
      // The menu's own arrows still work.
      await user.keyboard('{ArrowDown}');
      expect(menuitem('Copy')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(menuitem('Copy')).toHaveFocus();
    });

    it('does not handle or prevent arrows, Home or End pressed in a portaled popover', () => {
      render(<ToolbarWithPopups />);
      const apply = button('Apply');
      focus(apply);
      for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
        expect(fireEvent.keyDown(apply, { key })).toBe(true);
        expect(apply).toHaveFocus();
      }
    });

    it('typeahead ignores keys typed in a portal', async () => {
      const user = userEvent.setup();
      render(<ToolbarWithPopups typeahead />);
      focus(button('Apply'));
      await user.keyboard('u');
      expect(button('Apply')).toHaveFocus();
    });

    it('focus in a portal does not move the tab stop or focusedValue', () => {
      let latest: UseRovingTabIndexResult | undefined;
      render(<ToolbarWithPopups onResult={(r) => (latest = r)} />);
      focus(button('Edit'));
      expect(latest!.focusedValue).toBe('edit');
      focus(menuitem('Copy'));
      focus(button('Apply'));
      expect(latest!.focusedValue).toBe('edit');
      expect(button('Edit')).toHaveAttribute('tabindex', '0');
      expect(button('Bold')).toHaveAttribute('tabindex', '-1');
    });

    it('keys on the container itself still move to the first or last item', () => {
      render(<ToolbarWithPopups />);
      const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
      fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
      expect(button('Bold')).toHaveFocus();
      fireEvent.keyDown(toolbar, { key: 'End' });
      expect(button('Underline')).toHaveFocus();
    });
  });

  describe('rendering environments', () => {
    it('works under StrictMode (store subscription survives the double mount)', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <DomGroup items={[{ value: 'a' }, { value: 'b', disabled: true }, { value: 'c' }]} />
        </React.StrictMode>,
      );
      expect(button('a')).toHaveAttribute('tabindex', '0');
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(button('c')).toHaveFocus();
    });

    it('renders on the server with the active item as the tab stop', () => {
      const html = renderToString(<DomGroup items={ABC} activeValue="b" />);
      expect(html).toContain('data-roving-container=""');
      expect(html).toMatch(
        /data-roving-value="b"[^>]*tabindex="0"|tabindex="0"[^>]*data-roving-value="b"/,
      );
    });
  });

  describe('result API', () => {
    it('exposes container props, stable handlers and focus helpers', () => {
      let latest: UseRovingTabIndexResult | undefined;
      render(<DomGroup items={ABC} activeValue="b" onResult={(r) => (latest = r)} />);
      const group = screen.getByRole('group', { name: 'group' });
      expect(group).toHaveAttribute('data-roving-container', '');
      expect(latest!.containerProps.onKeyDown).toBe(latest!.handleKeyDown);
      expect(latest!.containerProps.onFocus).toBe(latest!.handleFocus);

      act(() => latest!.focusLast());
      expect(button('c')).toHaveFocus();
      act(() => latest!.focusFirst());
      expect(button('a')).toHaveFocus();
      act(() => latest!.focusValue('b'));
      expect(button('b')).toHaveFocus();
      expect(latest!.focusedValue).toBe('b');
    });

    it('keeps handler identities across rerenders', () => {
      const seen: UseRovingTabIndexResult[] = [];
      const { rerender } = render(
        <DomGroup items={ABC} activeValue="a" onResult={(r) => seen.push(r)} />,
      );
      rerender(<DomGroup items={ABC} activeValue="b" onResult={(r) => seen.push(r)} />);
      const first = seen[0];
      const last = seen[seen.length - 1];
      expect(last.handleKeyDown).toBe(first.handleKeyDown);
      expect(last.handleFocus).toBe(first.handleFocus);
      expect(last.containerProps.ref).toBe(first.containerProps.ref);
    });

    it('focusValue ignores disabled and unknown values', () => {
      let latest: UseRovingTabIndexResult | undefined;
      render(
        <DomGroup
          items={[{ value: 'a' }, { value: 'b', disabled: true }]}
          activeValue="a"
          onResult={(r) => (latest = r)}
        />,
      );
      focus(button('a'));
      act(() => latest!.focusValue('b'));
      act(() => latest!.focusValue('zzz'));
      expect(button('a')).toHaveFocus();
    });

    it('passes the keyboard event to onFocusMove', async () => {
      const user = userEvent.setup();
      const onFocusMove = vi.fn();
      render(<DomGroup items={ABC} activeValue="a" onFocusMove={onFocusMove} />);
      focus(button('a'));
      await user.keyboard('{End}');
      expect(onFocusMove).toHaveBeenCalledWith('c', expect.objectContaining({ key: 'End' }));
    });

    it('has exported option and result types', () => {
      expectTypeOf<UseRovingTabIndexResult['getTabIndex']>().toEqualTypeOf<
        (value: string) => 0 | -1
      >();
      expectTypeOf<UseRovingTabIndexResult['focusedValue']>().toEqualTypeOf<string | null>();
      expectTypeOf<UseRovingTabIndexOptions['tabStop']>().toEqualTypeOf<
        'active' | 'last-focused' | undefined
      >();
    });
  });
});
