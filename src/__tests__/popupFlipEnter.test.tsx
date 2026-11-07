import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover } from '../components/overlays/Popover';
import { Menu } from '../components/navigation/Menu';
import { TeachingPopover } from '../components/overlays/TeachingPopover';
import { InfoButton } from '../components/data-display/InfoButton';
import { Button } from '../components/button/Button';
import { Combobox } from '../components/input/Combobox';
import { Dropdown } from '../components/input/Dropdown';
import { ListboxSurface, Option, useListboxPopup } from '../components/input/Option';
import { TagPicker } from '../components/input/TagPicker';
import { TimePicker } from '../components/input/TimePicker';
import { useListbox } from '../hooks/useListbox';
import { useMergedRefs } from '../hooks/useMergedRefs';
import { timePickerClassNames } from '../lib/classNames';
import type { MotionSlot } from '../lib/types';
import { popupMotion } from '../lib/motion';
import { mockAnimations, renderWithProviders } from '../test-utils';

/*
 * The enter slide of a popup whose placement flips (ROADMAP §8.5). A popup mounts with the side it
 * was asked for, and floating-ui places it, flipping it, a moment later. The enter must start from
 * the resolved side: the surface mounts exited (the recipe's start of the enter, transparent and
 * moved toward its anchor), the style of the placed surface is resolved on its resolved side, and
 * only then does it enter. jsdom loads no CSS and plays no animation, so these tests pin the
 * order of what the DOM is told: the sides the surface renders, the style resolutions, and the
 * side it has when the entering phase is written. The pixels are a real-browser check.
 */

const html = document.documentElement;

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    Reflect.deleteProperty(html, 'clientWidth');
    Reflect.deleteProperty(html, 'clientHeight');
  }
});

type Box = { x: number; y: number; width: number; height: number };

/**
 * A 1024×768 viewport, the anchor (`data-testid="anchor"`) at `anchor`, and the popup surface (the
 * element with a presence phase) 256×120, so floating-ui computes real placements.
 */
function mockLayout(anchor: Box) {
  Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
  Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
  const boxOf = (el: Element): Box | undefined => {
    if (el.getAttribute('data-testid') === 'anchor') return anchor;
    if (el.hasAttribute('data-presence')) return { x: 0, y: 0, width: 256, height: 120 };
    return undefined;
  };
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const { x, y, width, height } = boxOf(this) ?? { x: 0, y: 0, width: 0, height: 0 };
    const full = { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
    return { ...full, toJSON: () => full } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.width ?? 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.height ?? 0;
  });
}

/** An anchor near the bottom of the viewport: a popup below it flips above. */
const NEAR_BOTTOM: Box = { x: 100, y: 720, width: 80, height: 30 };
/** An anchor near the top of the viewport: a popup above it flips below. */
const NEAR_TOP: Box = { x: 100, y: 8, width: 24, height: 24 };
/** An anchor with room on every side. */
const MIDDLE: Box = { x: 100, y: 300, width: 80, height: 30 };

/** What happened to the popup surface: the order of its presence phases and style resolutions. */
interface Observation {
  /** Each write of `data-presence`, with the side and the transform the surface had. */
  phases: Array<{
    phase: string;
    side: string | null;
    placed: boolean;
    /** The last style resolution of the surface before this write. */
    resolved: { phase: string | null; side: string | null } | undefined;
  }>;
  /** Every `data-side` the surface was given, in order. */
  sides: string[];
  /** Each style resolution of the surface (a `getComputedStyle` call), with its phase and side. */
  resolutions: Array<{ phase: string | null; side: string | null }>;
}

/** Observes the popup surface (the first element given a `data-presence`) until the test ends. */
function observeSurface(): Observation {
  const observation: Observation = { phases: [], sides: [], resolutions: [] };
  const found: { surface: Element | null } = { surface: null };
  // A surface gets its data-side before its data-presence when it spreads placement props first.
  const earlier = new WeakMap<Element, string[]>();
  const setAttribute = Element.prototype.setAttribute;
  vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
    this: Element,
    name: string,
    value: string,
  ) {
    setAttribute.call(this, name, value);
    if (name === 'data-side' && found.surface === null) {
      earlier.set(this, [...(earlier.get(this) ?? []), value]);
    }
    if (name === 'data-presence' && found.surface === null) {
      found.surface = this;
      observation.sides.push(...(earlier.get(this) ?? []));
    }
    if (this !== found.surface) return;
    if (name === 'data-side') observation.sides.push(value);
    if (name === 'data-presence') {
      observation.phases.push({
        phase: value,
        side: this.getAttribute('data-side'),
        placed: (this as HTMLElement).style.transform !== '',
        resolved: observation.resolutions[observation.resolutions.length - 1],
      });
    }
  });
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
    if (el !== null && el === found.surface) {
      observation.resolutions.push({
        phase: (el as Element).getAttribute('data-presence'),
        side: (el as Element).getAttribute('data-side'),
      });
    }
    return getComputedStyle(el, pseudo);
  });
  return observation;
}

const isSurface = (el: Element) => el.hasAttribute('data-presence');
const surfaceNow = () => document.querySelector<HTMLElement>('[data-presence]');

/**
 * The popup entered on `side` after a flip from the requested side, and nothing entered on the
 * wrong one: the surface was asked for `requested`, rendered both, wrote `entering` once, on the
 * resolved side and already positioned, and resolved its style on that side in the exited phase
 * just before.
 */
function expectEnteredOnResolvedSide(observation: Observation, requested: string, side: string) {
  const entering = observation.phases.filter(({ phase }) => phase === 'entering');
  // The last style the browser resolved before the enter is the exited surface on its resolved
  // side, so the transition starts from the resolved side's offset.
  expect(entering).toEqual([
    { phase: 'entering', side, placed: true, resolved: { phase: 'exited', side } },
  ]);
  // The flip happened: the surface was rendered with the requested side first.
  expect(observation.sides[0]).toBe(requested);
  expect(observation.sides).toContain(side);
  // Held until then, transparent by the recipe's exited rules.
  expect(observation.phases[0].phase).toBe('exited');
}

describe('Popover — the enter follows the flip', () => {
  function Example() {
    return (
      <Popover>
        <Popover.Trigger>
          <button type="button" data-testid="anchor">
            Show details
          </button>
        </Popover.Trigger>
        <Popover.Content title="Details">
          <button type="button">Edit</button>
        </Popover.Content>
      </Popover>
    );
  }

  it('a popover that flips above its trigger enters from above', async () => {
    mockLayout(NEAR_BOTTOM);
    const motion = mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expect(surfaceNow()).toHaveAttribute('data-side', 'top');
    expect(surfaceNow()).toHaveClass(...popupMotionStart());
    expectEnteredOnResolvedSide(observation, 'bottom', 'top');
    await act(async () => {
      await motion.finishAll();
    });
    expect(surfaceNow()).toHaveAttribute('data-presence', 'entered');
  });

  it('a popover that does not flip enters from its requested side', async () => {
    mockLayout(MIDDLE);
    mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    const entering = observation.phases.filter(({ phase }) => phase === 'entering');
    expect(entering).toEqual([
      {
        phase: 'entering',
        side: 'bottom',
        placed: true,
        resolved: { phase: 'exited', side: 'bottom' },
      },
    ]);
    expect(observation.sides).not.toContain('top');
  });

  it('a popover open by default flips and enters from the resolved side too', async () => {
    mockLayout(NEAR_BOTTOM);
    mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    render(
      <Popover defaultOpen>
        <Popover.Trigger>
          <button type="button" data-testid="anchor">
            Show details
          </button>
        </Popover.Trigger>
        <Popover.Content title="Details">
          <button type="button">Edit</button>
        </Popover.Content>
      </Popover>,
    );
    expect(surfaceNow()).toHaveAttribute('data-presence', 'exited');
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expectEnteredOnResolvedSide(observation, 'bottom', 'top');
  });

  it('exits on the resolved side, as before', async () => {
    mockLayout(NEAR_BOTTOM);
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    await act(async () => {
      await motion.finishAll();
    });
    await user.keyboard('{Escape}');
    expect(surfaceNow()).toHaveAttribute('data-presence', 'exiting');
    expect(surfaceNow()).toHaveAttribute('data-side', 'top');
    await act(async () => {
      await motion.finishAll();
    });
    expect(surfaceNow()).toBeNull();
  });
});

describe('Menu.Popover — the enter follows the flip', () => {
  it('a menu that flips above its trigger enters from above', async () => {
    mockLayout(NEAR_BOTTOM);
    mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button" data-testid="anchor">
            File
          </button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>New</Menu.Item>
          <Menu.Item>Open</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'File' }));
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expect(screen.getByRole('menu', { name: 'File' })).toHaveAttribute('data-side', 'top');
    expectEnteredOnResolvedSide(observation, 'bottom', 'top');
    // Focus moved into the menu in the commit that opened it, not after the enter.
    expect(screen.getByRole('menuitem', { name: 'New' })).toHaveFocus();
  });
});

describe('InfoButton — the enter follows the flip', () => {
  it('a note that flips below its button enters from below', async () => {
    mockLayout(NEAR_TOP);
    mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} data-testid="anchor" />);
    await user.click(screen.getByRole('button', { name: 'Information' }));
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expect(surfaceNow()).toHaveAttribute('data-side', 'bottom');
    expectEnteredOnResolvedSide(observation, 'top', 'bottom');
  });
});

describe('TeachingPopover — the enter follows the flip', () => {
  const steps = [{ title: 'Welcome', body: 'This is step one.' }];

  function Tour() {
    const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
    return (
      <>
        <button type="button" ref={setAnchor} data-testid="anchor">
          Search
        </button>
        <TeachingPopover steps={steps} target={anchor}>
          <TeachingPopover.Trigger>
            <Button>Take the tour</Button>
          </TeachingPopover.Trigger>
        </TeachingPopover>
      </>
    );
  }

  it('a popover that flips above its target enters from above', async () => {
    mockLayout(NEAR_BOTTOM);
    mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    const user = userEvent.setup();
    render(<Tour />);
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expect(surfaceNow()).toHaveAttribute('data-side', 'top');
    expectEnteredOnResolvedSide(observation, 'bottom', 'top');
  });

  it('a popover rendered in place, without a target, fades in from the exited phase', async () => {
    mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    render(<TeachingPopover steps={steps} defaultOpen />);
    // Nothing to wait for: it is armed in the commit that mounts it, before the browser paints.
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expect(observation.phases.map(({ phase }) => phase)).toEqual(['exited', 'entering']);
    expect(surfaceNow()).not.toHaveAttribute('data-side');
  });
});

describe('a motion of your own keeps the entering phase at mount', () => {
  it('a popover with a motion class string mounts entering, not exited', async () => {
    mockLayout(NEAR_BOTTOM);
    mockAnimations({ animated: isSurface });
    const observation = observeSurface();
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger>
          <button type="button" data-testid="anchor">
            Show details
          </button>
        </Popover.Trigger>
        <Popover.Content title="Details" motion="transition-opacity">
          <button type="button">Edit</button>
        </Popover.Content>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expect(observation.phases[0].phase).toBe('entering');
    expect(observation.phases.map(({ phase }) => phase)).not.toContain('exited');
  });

  it('under a provider with motion none it mounts entered at once', async () => {
    mockLayout(NEAR_BOTTOM);
    const observation = observeSurface();
    const user = userEvent.setup();
    renderWithProviders(
      <Popover>
        <Popover.Trigger>
          <button type="button" data-testid="anchor">
            Show details
          </button>
        </Popover.Trigger>
        <Popover.Content title="Details">
          <button type="button">Edit</button>
        </Popover.Content>
      </Popover>,
      { motion: 'none' },
    );
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    expect(surfaceNow()).toHaveAttribute('data-presence', 'entered');
    expect(observation.phases.map(({ phase }) => phase)).not.toContain('exited');
  });
});

/** The words of the recipe that style the exited phase: the start of the enter. */
function popupMotionStart(): string[] {
  return popupMotion.split(' ').filter((word) => word.includes('data-[presence=exited]'));
}

describe('the listbox popups of the pickers — the enter follows the flip', () => {
  const FRUITS = ['Apple', 'Banana', 'Cherry'];
  const OPTIONS = FRUITS.map((label) => ({ value: label.toLowerCase(), label }));
  const options = FRUITS.map((label) => (
    <Option key={label} value={label.toLowerCase()}>
      {label}
    </Option>
  ));

  interface PickerCase {
    name: string;
    label: string;
    ui: (motion?: MotionSlot | null) => React.ReactElement;
    /** The element that positions the popup. */
    anchor?: (combobox: HTMLElement) => HTMLElement | null;
  }

  const CASES: PickerCase[] = [
    {
      name: 'Dropdown',
      label: 'Fruit',
      ui: (motion) => (
        <Dropdown aria-label="Fruit" motion={motion}>
          {options}
        </Dropdown>
      ),
    },
    {
      name: 'Combobox',
      label: 'Fruit',
      ui: (motion) => (
        <Combobox aria-label="Fruit" motion={motion}>
          {options}
        </Combobox>
      ),
    },
    {
      name: 'TagPicker',
      label: 'Fruit',
      ui: (motion) => <TagPicker aria-label="Fruit" options={OPTIONS} motion={motion} />,
      anchor: (combobox) => combobox.closest('[data-wave-tagpicker-control]'),
    },
    {
      name: 'TimePicker',
      label: 'Time',
      ui: (motion) => <TimePicker aria-label="Time" motion={motion} />,
      anchor: (combobox) => combobox.parentElement,
    },
  ];

  /** Gives the layout mock its anchor (the combobox positions the popup) and opens the picker. */
  async function openPicker(
    label: string,
    box: Box,
    anchor: PickerCase['anchor'] = (combobox) => combobox,
  ) {
    mockLayout(box);
    const user = userEvent.setup();
    const combobox = screen.getByRole('combobox', { name: label });
    anchor(combobox)?.setAttribute('data-testid', 'anchor');
    await user.click(combobox);
    return { user, combobox };
  }

  const isListSurface = (el: Element) =>
    el.hasAttribute('data-wave-listbox-surface') ||
    el.classList.contains(timePickerClassNames.surface);

  describe.each(CASES)('$name', ({ ui, label, anchor }) => {
    it('a popup that flips above its field enters once, from above', async () => {
      const motion = mockAnimations({ animated: isListSurface });
      const observation = observeSurface();
      render(ui());
      const { combobox } = await openPicker(label, NEAR_BOTTOM, anchor);
      await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
      expect(surfaceNow()).toHaveAttribute('data-side', 'top');
      expect(surfaceNow()).toHaveClass(...popupMotionStart());
      expectEnteredOnResolvedSide(observation, 'bottom', 'top');
      // The one listbox is in the document, in the surface, and reachable from the combobox.
      const listbox = document.getElementById(combobox.getAttribute('aria-controls') ?? '');
      expect(listbox).not.toBeNull();
      expect(surfaceNow()).toContainElement(listbox);
      await act(async () => {
        await motion.finishAll();
      });
      expect(surfaceNow()).toHaveAttribute('data-presence', 'entered');
      expect(screen.getAllByRole('listbox', { hidden: true })).toHaveLength(1);
    });

    it('a popup that does not flip enters from the side it was asked for', async () => {
      mockAnimations({ animated: isListSurface });
      const observation = observeSurface();
      render(ui());
      await openPicker(label, MIDDLE, anchor);
      await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
      const entering = observation.phases.filter(({ phase }) => phase === 'entering');
      expect(entering).toEqual([
        {
          phase: 'entering',
          side: 'bottom',
          placed: true,
          resolved: { phase: 'exited', side: 'bottom' },
        },
      ]);
      expect(observation.sides).not.toContain('top');
    });

    it('exits on the resolved side with the listbox kept in the surface', async () => {
      const motion = mockAnimations({ animated: isListSurface });
      render(ui());
      const { user, combobox } = await openPicker(label, NEAR_BOTTOM, anchor);
      await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
      await act(async () => {
        await motion.finishAll();
      });
      await user.keyboard('{Escape}');
      expect(surfaceNow()).toHaveAttribute('data-presence', 'exiting');
      expect(surfaceNow()).toHaveAttribute('data-side', 'top');
      const listbox = document.getElementById(combobox.getAttribute('aria-controls') ?? '');
      expect(listbox).not.toBeNull();
      expect(surfaceNow()).toContainElement(listbox);
      await act(async () => {
        await motion.finishAll();
      });
      expect(surfaceNow()).toBeNull();
      expect(screen.getAllByRole('listbox', { hidden: true })).toHaveLength(1);
    });

    it('closed before it was placed: it never showed, and unmounts at once', async () => {
      mockAnimations({ animated: isListSurface });
      render(ui());
      mockLayout(NEAR_BOTTOM);
      const combobox = screen.getByRole('combobox', { name: label });
      anchor?.(combobox)?.setAttribute('data-testid', 'anchor');
      // Open and close in two synchronous steps, before floating-ui has placed the popup.
      act(() => {
        combobox.focus();
        fireEvent.click(combobox);
      });
      expect(surfaceNow()).toHaveAttribute('data-presence', 'exited');
      act(() => {
        fireEvent.keyDown(combobox, { key: 'Escape' });
      });
      expect(surfaceNow()).toBeNull();
    });

    it('a motion of your own mounts entering, not exited', async () => {
      mockAnimations({ animated: isListSurface });
      const observation = observeSurface();
      render(ui('transition-opacity'));
      await openPicker(label, NEAR_BOTTOM, anchor);
      await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
      expect(observation.phases[0].phase).toBe('entering');
      expect(observation.phases.map(({ phase }) => phase)).not.toContain('exited');
    });

    it('no motion: it never waits for a position', async () => {
      const observation = observeSurface();
      render(ui(null));
      await openPicker(label, NEAR_BOTTOM, anchor);
      expect(surfaceNow()).toHaveAttribute('data-presence', 'entered');
      expect(observation.phases.map(({ phase }) => phase)).not.toContain('exited');
    });

    it('under a provider with motion none it never waits for a position', async () => {
      const observation = observeSurface();
      renderWithProviders(ui(), { motion: 'none' });
      await openPicker(label, NEAR_BOTTOM, anchor);
      expect(surfaceNow()).toHaveAttribute('data-presence', 'entered');
      expect(observation.phases.map(({ phase }) => phase)).not.toContain('exited');
    });
  });

  it('the "No matches" row of a Combobox enters on the resolved side too', async () => {
    mockAnimations({ animated: isListSurface });
    const observation = observeSurface();
    render(
      <Combobox aria-label="Fruit" freeform>
        {options}
      </Combobox>,
    );
    mockLayout(NEAR_BOTTOM);
    const user = userEvent.setup();
    const combobox = screen.getByRole('combobox', { name: 'Fruit' });
    combobox.setAttribute('data-testid', 'anchor');
    await user.type(combobox, 'zzz');
    await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
    expect(surfaceNow()).toHaveTextContent('No matches');
    expectEnteredOnResolvedSide(observation, 'bottom', 'top');
  });

  describe('a custom picker on ListboxSurface', () => {
    function Custom({ pass }: { pass: boolean }) {
      const rootRef = React.useRef<HTMLDivElement | null>(null);
      const anchorRef = React.useRef<HTMLButtonElement | null>(null);
      const [open, setOpen] = React.useState(false);
      const listbox = useListbox({
        open,
        onOpenChange: setOpen,
        mode: 'select-only',
        selectedValues: [],
        onSelect: () => {},
      });
      const expanded = open && listbox.items.length > 0;
      const { layerId, setReference, surfaceRef, floatingProps, isPositioned } = useListboxPopup({
        open,
        surfaceOpen: expanded,
        onDismiss: () => setOpen(false),
        rootRef,
        anchorRef,
      });
      const buttonRef = useMergedRefs<HTMLButtonElement>(anchorRef, setReference);
      return (
        <div ref={rootRef}>
          <button
            type="button"
            ref={buttonRef}
            data-testid="anchor"
            {...listbox.getComboboxProps()}
            aria-label="Custom"
            aria-expanded={expanded}
            onClick={() => setOpen((current) => !current)}
          />
          <ListboxSurface
            listbox={listbox}
            layerId={layerId}
            surfaceRef={surfaceRef}
            floatingProps={floatingProps}
            isPositioned={pass ? isPositioned : undefined}
            open={open}
            expanded={expanded}
            aria-label="Custom list"
          >
            {options}
          </ListboxSurface>
        </div>
      );
    }

    it('enters on the resolved side when it passes isPositioned', async () => {
      mockAnimations({ animated: isListSurface });
      mockLayout(NEAR_BOTTOM);
      const observation = observeSurface();
      const user = userEvent.setup();
      render(<Custom pass />);
      await user.click(screen.getByRole('combobox', { name: 'Custom' }));
      await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
      expectEnteredOnResolvedSide(observation, 'bottom', 'top');
    });

    it('enters as it mounts, as before, when it does not', async () => {
      mockAnimations({ animated: isListSurface });
      mockLayout(NEAR_BOTTOM);
      const observation = observeSurface();
      const user = userEvent.setup();
      render(<Custom pass={false} />);
      await user.click(screen.getByRole('combobox', { name: 'Custom' }));
      await waitFor(() => expect(surfaceNow()).toHaveAttribute('data-presence', 'entering'));
      expect(observation.phases[0].phase).toBe('entering');
      expect(observation.phases.map(({ phase }) => phase)).not.toContain('exited');
    });
  });
});
