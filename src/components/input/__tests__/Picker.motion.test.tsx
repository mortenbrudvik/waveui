import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox } from '../Combobox';
import { DatePicker } from '../DatePicker';
import { Dropdown } from '../Dropdown';
import { Option } from '../Option';
import { TagPicker } from '../TagPicker';
import { TimePicker } from '../TimePicker';
import { datePickerClassNames, timePickerClassNames } from '../../../lib/classNames';
import { getOpenLayers } from '../../../lib/layers';
import { popupMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * Motion on the remaining popups (ROADMAP §8.5): the listbox popups of Combobox, Dropdown,
 * TagPicker and TimePicker, and the DatePicker calendar, mount through the presence core with the
 * positioned popups' default motion (`popupMotion`), take it as the `motion` slot, and exit with
 * the one `<ul role="listbox">` kept in the surface (so the option ids stay valid) and moved back
 * into the picker when the exit ends. jsdom loads no CSS, so the phases wait only where
 * `mockAnimations` gives the surface a running animation.
 */

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
  }
});

const FRUITS = ['Apple', 'Banana', 'Cherry'];
const OPTIONS = FRUITS.map((label) => ({ value: label.toLowerCase(), label }));
const options = FRUITS.map((label) => (
  <Option key={label} value={label.toLowerCase()}>
    {label}
  </Option>
));

interface Case {
  name: string;
  /** The picker, with the motion slot when given. */
  ui: (props?: { motion?: MotionSlot | null; value?: string }) => React.ReactElement;
  /** The control that opens it. */
  control: () => HTMLElement;
  /** The popup surface (the exiting one too). */
  surface: () => HTMLElement | null;
  /** Opens the popup. */
  open: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
}

const LIST_SURFACE = () => document.querySelector<HTMLElement>('[data-wave-listbox-surface]');

const LISTBOX_CASES: Case[] = [
  {
    name: 'Dropdown',
    ui: ({ motion } = {}) => (
      <Dropdown aria-label="Fruit" motion={motion}>
        {options}
      </Dropdown>
    ),
    control: () => screen.getByRole('combobox', { name: 'Fruit' }),
    surface: LIST_SURFACE,
    open: async (user) => {
      await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    },
  },
  {
    name: 'Combobox',
    ui: ({ motion } = {}) => (
      <Combobox aria-label="Fruit" motion={motion}>
        {options}
      </Combobox>
    ),
    control: () => screen.getByRole('combobox', { name: 'Fruit' }),
    surface: LIST_SURFACE,
    open: async (user) => {
      await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    },
  },
  {
    name: 'TagPicker',
    ui: ({ motion } = {}) => <TagPicker aria-label="Fruit" options={OPTIONS} motion={motion} />,
    control: () => screen.getByRole('combobox', { name: 'Fruit' }),
    surface: LIST_SURFACE,
    open: async (user) => {
      await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    },
  },
  {
    name: 'TimePicker',
    ui: ({ motion } = {}) => <TimePicker aria-label="Time" motion={motion} />,
    control: () => screen.getByRole('combobox', { name: 'Time' }),
    surface: () => document.querySelector<HTMLElement>('.' + timePickerClassNames.surface),
    open: async (user) => {
      await user.click(screen.getByRole('combobox', { name: 'Time' }));
    },
  },
];

const isSurface = (el: Element) =>
  el.hasAttribute('data-wave-listbox-surface') ||
  el.classList.contains(timePickerClassNames.surface);

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

describe.each(LISTBOX_CASES)('$name popup motion', ({ ui, control, surface, open }) => {
  describe('the motion slot', () => {
    const opened = async (slot?: MotionSlot | null, provider?: 'none') => {
      const user = userEvent.setup();
      if (provider) renderWithProviders(ui({ motion: slot }), { motion: provider });
      else render(ui({ motion: slot }));
      await open(user);
      return surface()!;
    };

    it('undefined: the default motion, by the side it opened on', async () => {
      const popup = await opened();
      expect(popup).toHaveClass(...motionClasses(popupMotion));
      expect(popup).toHaveAttribute('data-side', 'bottom');
      expect(popup).toHaveAttribute('data-state', 'open');
    });

    it('null: no motion, and the surface still renders its phase', async () => {
      const popup = await opened(null);
      expectNoWordOf(popup, popupMotion);
      expect(popup).toHaveAttribute('data-presence', 'entered');
    });

    it.each([
      ['a string', 'my-motion'],
      ['a slot object', { className: 'my-motion' }],
    ] as const)('%s replaces the default motion', async (_, slot) => {
      const popup = await opened(slot);
      expect(popup).toHaveClass('my-motion');
      expectNoWordOf(popup, popupMotion);
    });

    it('WaveProvider motion="none" turns the default off', async () => {
      const popup = await opened(undefined, 'none');
      expectNoWordOf(popup, popupMotion);
      expect(popup).toHaveAttribute('data-presence', 'entered');
    });

    it('WaveProvider motion="none": the own value still applies', async () => {
      const popup = await opened('my-motion', 'none');
      expect(popup).toHaveClass('my-motion');
      expectNoWordOf(popup, popupMotion);
    });

    it('keeps the motion prop off the DOM', async () => {
      await opened('my-motion');
      expect(control()).not.toHaveAttribute('motion');
      expect(surface()).not.toHaveAttribute('motion');
    });
  });

  describe('the exit', () => {
    it('keeps the one listbox in the surface while it exits, and moves it back when the exit ends', async () => {
      const motion = mockAnimations({ animated: isSurface });
      const user = userEvent.setup();
      render(ui());
      await open(user);
      const popup = surface()!;
      expect(popup).toHaveAttribute('data-presence', 'entering');
      expect(popup).toHaveAttribute('data-state', 'open');
      await finish(motion);
      expect(popup).toHaveAttribute('data-presence', 'entered');
      const list = screen.getByRole('listbox');
      expect(popup).toContainElement(list);
      expect(control()).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Escape}');
      // The same surface and the same list, closed and inert, with the layer released at once.
      expect(surface()).toBe(popup);
      expect(popup).toHaveAttribute('data-presence', 'exiting');
      expect(popup).toHaveAttribute('data-state', 'closed');
      expect(popup.closest('[inert]')).toBe(popup);
      expect(getOpenLayers()).toHaveLength(0);
      expect(control()).toHaveAttribute('aria-expanded', 'false');
      expect(control()).not.toHaveAttribute('aria-activedescendant');
      const lists = screen.getAllByRole('listbox', { hidden: true });
      expect(lists).toEqual([list]);
      expect(popup).toContainElement(list);
      expect(list).not.toHaveAttribute('hidden');
      expect(screen.getAllByRole('option', { hidden: true }).length).toBeGreaterThan(0);
      expect(findDanglingIdRefs()).toEqual([]);

      await finish(motion);
      expect(surface()).toBeNull();
      // The list is back inside the picker, hidden, with its options.
      const back = screen.getAllByRole('listbox', { hidden: true });
      expect(back).toHaveLength(1);
      expect(back[0]).toHaveAttribute('hidden');
      expect(popup).not.toBeInTheDocument();
      expect(findDanglingIdRefs()).toEqual([]);
    });

    it('reopened during its exit: the same surface enters again, open and not inert', async () => {
      const motion = mockAnimations({ animated: isSurface });
      const user = userEvent.setup();
      render(ui());
      await open(user);
      await finish(motion);
      const popup = surface()!;
      const list = screen.getByRole('listbox');

      await user.keyboard('{Escape}');
      expect(popup).toHaveAttribute('data-presence', 'exiting');
      await user.keyboard('{ArrowDown}');
      expect(surface()).toBe(popup);
      expect(popup).toHaveAttribute('data-presence', 'entering');
      expect(popup).toHaveAttribute('data-state', 'open');
      expect(popup.closest('[inert]')).toBeNull();
      expect(screen.getByRole('listbox')).toBe(list);
      expect(popup).toContainElement(list);

      await finish(motion);
      expect(popup).toHaveAttribute('data-presence', 'entered');
      expect(getOpenLayers()).toHaveLength(1);
      await user.keyboard('{Escape}');
      await finish(motion);
    });

    it('exits at once without a running animation (reduced motion, null motion)', async () => {
      const user = userEvent.setup();
      render(ui({ motion: null }));
      await open(user);
      expect(surface()).not.toBeNull();
      await user.keyboard('{Escape}');
      expect(surface()).toBeNull();
      expect(screen.getAllByRole('listbox', { hidden: true })).toHaveLength(1);
    });

    it('releases the layer and fires no extra callback in StrictMode', async () => {
      const motion = mockAnimations({ animated: isSurface });
      const user = userEvent.setup();
      render(<React.StrictMode>{ui()}</React.StrictMode>);
      await open(user);
      await finish(motion);
      await user.keyboard('{Escape}');
      expect(getOpenLayers()).toHaveLength(0);
      await finish(motion);
      expect(surface()).toBeNull();
    });
  });
});

describe('a list that changed as it closed exits at once', () => {
  it('Combobox: the selection that resets the filter leaves no half-redrawn surface behind', async () => {
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(
      <Combobox aria-label="Fruit" freeform={false}>
        {options}
      </Combobox>,
    );
    const input = screen.getByRole('combobox', { name: 'Fruit' });
    await user.click(input);
    await finish(motion);
    await user.keyboard('ban');
    await finish(motion);
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');
    // The filter ended with the selection: no fade of a list that would grow while it fades.
    expect(LIST_SURFACE()).toBeNull();
    expect(input).toHaveValue('Banana');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('Combobox: the "No matches" row leaves at once', async () => {
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(<Combobox aria-label="Fruit">{options}</Combobox>);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.keyboard('zzz');
    await finish(motion);
    expect(LIST_SURFACE()).toHaveTextContent('No matches');
    await user.keyboard('{Escape}');
    expect(LIST_SURFACE()).toBeNull();
  });
});

describe('DatePicker calendar motion', () => {
  const toggle = () => screen.getByRole('button', { name: 'Open calendar' });
  const calendar = () => document.querySelector<HTMLElement>('.' + datePickerClassNames.surface);
  const isCalendar = (el: Element) => el.classList.contains(datePickerClassNames.surface);

  it('mounts through the presence core with the default motion and the `motion` slot', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DatePicker aria-label="Date" />);
    await user.click(toggle());
    expect(calendar()).toHaveClass(...motionClasses(popupMotion));
    expect(calendar()).toHaveAttribute('data-state', 'open');
    expect(calendar()).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    unmount();

    for (const slot of [null, 'my-motion', { className: 'my-motion' }] as const) {
      const view = render(<DatePicker aria-label="Date" motion={slot} />);
      await user.click(toggle());
      if (slot === null) expectNoWordOf(calendar(), popupMotion);
      else {
        expect(calendar()).toHaveClass('my-motion');
        expectNoWordOf(calendar(), popupMotion);
      }
      await user.keyboard('{Escape}');
      view.unmount();
    }

    renderWithProviders(<DatePicker aria-label="Date" />, { motion: 'none' });
    await user.click(toggle());
    expectNoWordOf(calendar(), popupMotion);
    await user.keyboard('{Escape}');
  });

  it('exits with focus back on the toggle in the closing commit, the layer released and the calendar inert', async () => {
    honourInert();
    const motion = mockAnimations({ animated: isCalendar });
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" />);
    await user.click(toggle());
    await finish(motion);
    const popup = calendar()!;
    expect(popup).toHaveAttribute('data-presence', 'entered');
    expect(popup).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(calendar()).toBe(popup);
    expect(popup).toHaveAttribute('data-presence', 'exiting');
    expect(popup).toHaveAttribute('data-state', 'closed');
    expect(popup.closest('[inert]')).toBe(popup);
    expect(getOpenLayers()).toHaveLength(0);
    expect(toggle()).toHaveFocus();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(calendar()).toBeNull();
    expect(toggle()).toHaveFocus();
  });

  it('picking a date closes it with focus back where the calendar was opened from', async () => {
    honourInert();
    const motion = mockAnimations({ animated: isCalendar });
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" />);
    const input = screen.getByRole('textbox', { name: 'Date' });
    input.focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await finish(motion);
    const popup = calendar()!;
    await user.keyboard('{Enter}');
    expect(popup).toHaveAttribute('data-state', 'closed');
    expect(input).toHaveFocus();
    await finish(motion);
    expect(calendar()).toBeNull();
    expect(input).toHaveFocus();
  });

  it('reopened during its exit: the same calendar enters again, not inert', async () => {
    const motion = mockAnimations({ animated: isCalendar });
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" />);
    await user.click(toggle());
    await finish(motion);
    const popup = calendar()!;
    await user.keyboard('{Escape}');
    expect(popup).toHaveAttribute('data-presence', 'exiting');
    await user.click(toggle());
    expect(calendar()).toBe(popup);
    expect(popup).toHaveAttribute('data-presence', 'entering');
    expect(popup).toHaveAttribute('data-state', 'open');
    expect(popup.closest('[inert]')).toBeNull();
    await finish(motion);
    await user.keyboard('{Escape}');
    await finish(motion);
    expect(calendar()).toBeNull();
  });
});

describe('the surface part cannot pretend to be a presence phase', () => {
  const attempt = {
    className: 'mine',
    'data-presence': 'exited',
    'data-state': 'closed',
    inert: true,
  } as const;
  const pickers: Array<[string, React.ReactElement, () => HTMLElement | null]> = [
    [
      'Dropdown',
      <Dropdown key="d" aria-label="Fruit" slotProps={{ surface: attempt }}>
        {options}
      </Dropdown>,
      LIST_SURFACE,
    ],
    [
      'Combobox',
      <Combobox key="c" aria-label="Fruit" slotProps={{ surface: attempt }}>
        {options}
      </Combobox>,
      LIST_SURFACE,
    ],
    [
      'TagPicker',
      <TagPicker key="t" aria-label="Fruit" options={OPTIONS} slotProps={{ surface: attempt }} />,
      LIST_SURFACE,
    ],
    [
      'TimePicker',
      <TimePicker key="tp" aria-label="Time" slotProps={{ surface: attempt }} />,
      () => document.querySelector<HTMLElement>('.' + timePickerClassNames.surface),
    ],
  ];

  it.each(pickers)('%s: the presence attributes are the component’s', async (_, ui, surface) => {
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(ui);
    await user.click(screen.getAllByRole('combobox')[0]);
    const popup = surface()!;
    expect(popup).toHaveClass('mine', ...motionClasses(popupMotion));
    expect(popup).toHaveAttribute('data-presence', 'entering');
    expect(popup).toHaveAttribute('data-state', 'open');
    expect(popup).not.toHaveAttribute('inert');
    await finish(motion);
    expect(popup).toHaveAttribute('data-presence', 'entered');

    // While it exits, `inert` and the closed state are the component's, and a part cannot lift them.
    await user.keyboard('{Escape}');
    expect(popup).toHaveAttribute('data-presence', 'exiting');
    expect(popup).toHaveAttribute('data-state', 'closed');
    expect(popup).toHaveAttribute('inert');
    await finish(motion);
  });
});
