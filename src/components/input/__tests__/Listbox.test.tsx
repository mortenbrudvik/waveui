import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import {
  Listbox,
  ListboxOption,
  ListboxOptionGroup,
  type ListboxLabels,
  type ListboxProps,
} from '../Listbox';
import { Option, OptionGroup } from '../Option';
import {
  asClientReference,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  mockRect,
  renderWithProviders,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { __getAnnouncerText, __resetAnnouncer } from '../../../hooks/useAnnounce';
import { focusRing } from '../../../lib/styles';

const OPTIONS = ['Apple', 'Banana', 'Cherry'].map((fruit) => (
  <Option key={fruit} value={fruit.toLowerCase()}>
    {fruit}
  </Option>
));

/** Apple, a disabled Banana, Cherry. */
const WITH_DISABLED = [
  <Option key="apple" value="apple">
    Apple
  </Option>,
  <Option key="banana" value="banana" disabled>
    Banana
  </Option>,
  <Option key="cherry" value="cherry">
    Cherry
  </Option>,
];

const UNNAMED_WARNING =
  '[WaveUI] Listbox: the listbox has no accessible name. Pass `aria-label` or ' +
  '`aria-labelledby`, or render it inside a Field.';

const list = (name = 'Fruits') => screen.getByRole('listbox', { name });
const option = (name: string) => screen.getByRole('option', { name });

/** The option the list's `aria-activedescendant` points at. */
const active = (name?: string) => {
  const id = list(name).getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};

const FOCUS_RING_CLASSES = focusRing.split(' ');

function renderList(props: Partial<ListboxProps> = {}) {
  return render(
    <Listbox aria-label="Fruits" {...props}>
      {props.children ?? OPTIONS}
    </Listbox>,
  );
}

function renderMulti(props: Partial<ListboxProps<true>> = {}) {
  return render(
    <Listbox aria-label="Fruits" multiselect {...props}>
      {props.children ?? OPTIONS}
    </Listbox>,
  );
}

/**
 * `form.checkValidity()` inside `act()`: like a submit, it fires `invalid` at a required, empty
 * Listbox's hidden input, which focuses the list (a state update).
 */
function checkValidity(form: HTMLFormElement): boolean {
  let valid = false;
  act(() => {
    valid = form.checkValidity();
  });
  return valid;
}

/** Flushes the frame the announcer's first write waits for (`src/hooks/useAnnounce.ts`), so a
 * synchronous read right after can be trusted either way. */
async function flushAnnouncerFrame() {
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

afterEach(() => {
  vi.restoreAllMocks();
  __resetAnnouncer();
});

describe('Listbox', () => {
  testSystemProps(Listbox as React.ComponentType<ListboxProps>, {
    expectedTag: 'ul',
    displayName: 'Listbox',
    defaultProps: { 'aria-label': 'Fruits', children: OPTIONS },
    conflictingClass: { className: 'py-2', overrides: 'py-1' },
    a11yVariants: [
      { name: 'with a value', props: { defaultValue: 'banana' } },
      {
        name: 'multiselect',
        props: { multiselect: true, defaultValue: ['apple', 'cherry'] } as never,
      },
      { name: 'disabled', props: { disabled: true, defaultValue: 'apple' } },
      { name: 'required, with a name', props: { name: 'fruit', required: true } },
      {
        name: 'multiselect, required, with a name and values',
        props: {
          multiselect: true,
          name: 'fruit',
          required: true,
          defaultValue: ['apple'],
        } as never,
      },
      {
        name: 'groups',
        props: {
          children: (
            <>
              <OptionGroup label="Fruit">
                <Option value="apple">Apple</Option>
              </OptionGroup>
              <OptionGroup aria-label="Vegetables">
                <Option value="carrot">Carrot</Option>
              </OptionGroup>
            </>
          ),
        },
      },
    ],
  });

  testCompoundExposure(Listbox, ['Option', 'OptionGroup']);

  it('exposes the flat names', () => {
    expect(ListboxOption).toBe(Listbox.Option);
    expect(ListboxOptionGroup).toBe(Listbox.OptionGroup);
    expect(Listbox.Option).toBe(Option);
    expect(Listbox.OptionGroup).toBe(OptionGroup);
  });

  describe('the list element', () => {
    it('is one focusable <ul role="listbox"> that holds the options', () => {
      renderList();
      expect(list().tagName).toBe('UL');
      expect(list()).toHaveAttribute('tabindex', '0');
      expect(within(list()).getAllByRole('option')).toHaveLength(3);
      expect(list()).not.toHaveAttribute('aria-multiselectable');
      expect(list()).not.toHaveAttribute('aria-disabled');
      expect(list()).not.toHaveAttribute('data-disabled');
    });

    it('is aria-multiselectable with multiselect', () => {
      renderMulti();
      expect(list()).toHaveAttribute('aria-multiselectable', 'true');
    });

    it("takes the consumer's id; the option ids stay the list's own", async () => {
      const user = userEvent.setup();
      renderList({ id: 'fruits' });
      expect(list()).toHaveAttribute('id', 'fruits');
      // The option ids keep the list's own `listbox-` prefix, whatever id the consumer gives it.
      for (const fruit of ['Apple', 'Banana', 'Cherry']) {
        expect(option(fruit).id).toMatch(/^listbox-.+-opt-\d+$/);
      }
      await user.tab();
      expect(list()).toHaveAttribute('aria-activedescendant', option('Apple').id);
      await expectNoA11yViolations();
    });

    it('keeps its role, tab stop and active descendant over consumer props', async () => {
      const user = userEvent.setup();
      renderList({
        role: 'list',
        tabIndex: -1,
        'aria-activedescendant': 'nothing',
      } as Partial<ListboxProps>);
      expect(list()).toHaveAttribute('tabindex', '0');
      expect(list()).not.toHaveAttribute('aria-activedescendant');
      await user.tab();
      expect(active()).toHaveTextContent('Apple');
    });

    it('has no built-in height', () => {
      renderList();
      expect(list().className).not.toMatch(/(^|\s)(max-)?h-/);
    });

    it('sets its own margin, padding and list style, so no native list style shows (C-NATIVE)', () => {
      renderList();
      expect(list()).toHaveClass('m-0', 'list-none', 'px-0', 'py-1');
    });
  });

  describe('focus and the active option (D17)', () => {
    it('has an active option only while focused: the selected, else the first', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <>
          <Listbox aria-label="Fruits" defaultValue="banana">
            {OPTIONS}
          </Listbox>
          <button type="button">After</button>
        </>,
      );
      expect(active()).toBeNull();
      await user.tab();
      expect(list()).toHaveFocus();
      expect(active()).toHaveTextContent('Banana');
      expect(option('Banana')).toHaveAttribute('data-active');
      await user.tab();
      expect(active()).toBeNull();
      expect(option('Banana')).not.toHaveAttribute('data-active');
      unmount();

      renderList();
      await user.tab();
      expect(active()).toHaveTextContent('Apple');
    });

    it('tracks its focus after consumer focus handlers, also when they prevent the event', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn((event: React.FocusEvent) => event.preventDefault());
      const onBlur = vi.fn((event: React.FocusEvent) => event.preventDefault());
      render(
        <>
          <Listbox aria-label="Fruits" onFocus={onFocus} onBlur={onBlur}>
            {OPTIONS}
          </Listbox>
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(active()).toHaveTextContent('Apple');
      await user.tab();
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(active()).toBeNull();
    });

    it('keeps the active option through a window switch, which leaves it the active element', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      renderList({ onActiveOptionChange });
      await user.tab();
      await user.keyboard('{End}');
      expect(active()).toHaveTextContent('Cherry');
      // Alt+Tab: the list receives a blur, but stays the document's active element (a native
      // `<select size>` keeps its keyboard position), then a focus when the window returns.
      fireEvent.blur(list());
      expect(list()).toHaveFocus();
      expect(active()).toHaveTextContent('Cherry');
      fireEvent.focus(list());
      expect(active()).toHaveTextContent('Cherry');
      expect(onActiveOptionChange.mock.calls).toEqual([['apple'], ['cherry']]);
    });

    it('keeps its focus through disable and re-enable, and its keys work again', async () => {
      const user = userEvent.setup();
      const { rerender } = renderList();
      await user.tab();
      expect(active()).toHaveTextContent('Apple');
      rerender(
        <Listbox aria-label="Fruits" disabled>
          {OPTIONS}
        </Listbox>,
      );
      expect(list()).not.toHaveAttribute('aria-activedescendant');
      rerender(<Listbox aria-label="Fruits">{OPTIONS}</Listbox>);
      expect(list()).toHaveFocus();
      expect(active()).toHaveTextContent('Apple');
      await user.keyboard('{ArrowDown}');
      expect(active()).toHaveTextContent('Banana');
    });

    it('forgets focus that left it without a blur while it was disabled', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      const ui = (disabled: boolean) => (
        <>
          <Listbox
            aria-label="Fruits"
            disabled={disabled}
            onActiveOptionChange={onActiveOptionChange}
          >
            {OPTIONS}
          </Listbox>
          <button type="button">Other</button>
        </>
      );
      const { rerender } = render(ui(false));
      await user.tab();
      expect(active()).toHaveTextContent('Apple');
      rerender(ui(true));
      // A browser that takes focus off a list whose tab stop went away fires no blur: a window
      // capture listener keeps the focusout from React while focus moves on.
      const swallow = (event: Event) => event.stopPropagation();
      window.addEventListener('focusout', swallow, true);
      try {
        act(() => screen.getByRole('button', { name: 'Other' }).focus());
      } finally {
        window.removeEventListener('focusout', swallow, true);
      }
      onActiveOptionChange.mockClear();
      rerender(ui(false));
      expect(screen.getByRole('button', { name: 'Other' })).toHaveFocus();
      expect(list()).not.toHaveAttribute('aria-activedescendant');
      expect(onActiveOptionChange).not.toHaveBeenCalled();
    });

    it('focuses itself on a client mount with autoFocus', () => {
      renderList({ autoFocus: true });
      expect(list()).toHaveFocus();
      expect(active()).toHaveTextContent('Apple');
    });

    it('takes no focus with autoFocus while disabled, nor when enabled later', () => {
      const { rerender } = render(
        <Listbox aria-label="Fruits" autoFocus disabled>
          {OPTIONS}
        </Listbox>,
      );
      expect(list()).not.toHaveFocus();
      rerender(
        <Listbox aria-label="Fruits" autoFocus>
          {OPTIONS}
        </Listbox>,
      );
      expect(list()).not.toHaveFocus();
    });

    it('starts on the first selected option in list order with multiselect', async () => {
      const user = userEvent.setup();
      renderMulti({ defaultValue: ['cherry', 'banana'] });
      await user.tab();
      expect(active()).toHaveTextContent('Banana');
    });

    it('scrolls the active option into view when focus or a key moves it', async () => {
      const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
      const user = userEvent.setup();
      renderList({ defaultValue: 'cherry' });
      await user.tab();
      expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
      expect(scroll.mock.contexts.at(-1)).toBe(option('Cherry'));
      await user.keyboard('{ArrowUp}');
      expect(scroll.mock.contexts.at(-1)).toBe(option('Banana'));
    });

    it.each([
      ['an empty list', []],
      [
        'a list whose options are all hidden',
        [
          <Option key="a" value="apple" hidden>
            Apple
          </Option>,
        ],
      ],
      [
        'a list whose options are all disabled',
        [
          <Option key="a" value="apple" disabled>
            Apple
          </Option>,
        ],
      ],
    ])(
      'draws its own focus ring on %s, where no option can be active',
      async (_label, children) => {
        const user = userEvent.setup();
        render(<Listbox aria-label="Fruits">{children}</Listbox>);
        await user.tab();
        expect(list()).toHaveFocus();
        expect(list()).not.toHaveAttribute('aria-activedescendant');
        expect(list()).toHaveClass(...FOCUS_RING_CLASSES);
        expect(list()).not.toHaveClass('focus:outline-hidden');
      },
    );

    it("hides its own outline while an option is active: the option's outline shows focus", async () => {
      const user = userEvent.setup();
      renderList();
      await user.tab();
      expect(active()).toHaveTextContent('Apple');
      expect(list()).toHaveClass('focus:outline-hidden');
      for (const cls of FOCUS_RING_CLASSES) expect(list()).not.toHaveClass(cls);
      // C-FOCUS: never a bare outline-hidden, which would hide the forced-colors outline too.
      expect(list()).not.toHaveClass('outline-hidden');
    });

    it('has an active option in an all-disabled list with disabledOptionsFocusable', async () => {
      const user = userEvent.setup();
      render(
        <Listbox aria-label="Fruits" disabledOptionsFocusable>
          <Option value="apple" disabled>
            Apple
          </Option>
        </Listbox>,
      );
      await user.tab();
      expect(active()).toHaveTextContent('Apple');
      expect(list()).toHaveClass('focus:outline-hidden');
    });
  });

  describe('pointer press (D17)', () => {
    it('selects the pressed option of a scrolled list without scrolling first', async () => {
      const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderList({ defaultValue: 'cherry', onValueChange, className: 'max-h-16 overflow-y-auto' });
      // The selected Cherry lies below the list's visible box: focusing the list first would
      // scroll it into view under the pointer before the click.
      mockRect(list(), { top: 0, height: 64, width: 200 });
      mockRect(option('Apple'), { top: 4, height: 32, width: 200 });
      mockRect(option('Cherry'), { top: 68, height: 32, width: 200 });
      await user.click(option('Apple'));
      expect(onValueChange).toHaveBeenCalledWith('apple');
      expect(scroll).not.toHaveBeenCalled();
      expect(list()).toHaveFocus();
      expect(active()).toHaveTextContent('Apple');
    });

    it('toggles the pressed option with multiselect and keeps it active', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderMulti({ defaultValue: ['apple'], onValueChange });
      await user.click(option('Cherry'));
      expect(onValueChange.mock.calls).toEqual([[['apple', 'cherry']]]);
      expect(active()).toHaveTextContent('Cherry');
      await user.click(option('Apple'));
      expect(onValueChange.mock.calls).toEqual([[['apple', 'cherry']], [['cherry']]]);
      expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
    });

    it('a press on a disabled option focuses the list and selects nothing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Listbox aria-label="Fruits" onValueChange={onValueChange}>
          {WITH_DISABLED}
        </Listbox>,
      );
      await user.click(option('Banana'));
      expect(list()).toHaveFocus();
      expect(active()).toHaveTextContent('Apple');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('keys (APG listbox, D17)', () => {
    it('moves without wrapping and selects with Space and Enter', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderList({ onValueChange });
      await user.tab();
      await user.keyboard('{ArrowUp}{ArrowDown}{ }');
      expect(onValueChange.mock.calls).toEqual([['banana']]);
      // The committed option stays active.
      expect(active()).toHaveTextContent('Banana');
      await user.keyboard('{End}{ArrowDown}{Enter}');
      expect(onValueChange.mock.calls).toEqual([['banana'], ['cherry']]);
      await user.keyboard('{Enter}{ }');
      expect(onValueChange).toHaveBeenCalledTimes(2); // re-selecting changes nothing
      expect(option('Cherry')).toHaveAttribute('aria-selected', 'true');
    });

    it('Home, End, PageUp and PageDown move the active option', async () => {
      const user = userEvent.setup();
      renderList({
        children: Array.from({ length: 25 }, (_, i) => (
          <Option key={i} value={`v${i}`}>{`Option ${i}`}</Option>
        )),
      });
      await user.tab();
      await user.keyboard('{PageDown}');
      expect(active()).toHaveTextContent('Option 10');
      await user.keyboard('{PageDown}{PageDown}');
      expect(active()).toHaveTextContent('Option 24');
      await user.keyboard('{PageUp}');
      expect(active()).toHaveTextContent('Option 14');
      await user.keyboard('{Home}');
      expect(active()).toHaveTextContent('Option 0');
      await user.keyboard('{End}');
      expect(active()).toHaveTextContent('Option 24');
    });

    it('moves the active option by typeahead', async () => {
      const user = userEvent.setup();
      renderList();
      await user.tab();
      await user.keyboard('c');
      expect(active()).toHaveTextContent('Cherry');
    });

    it('does not select as the active option moves (selection does not follow focus)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderList({ defaultValue: 'apple', onValueChange });
      await user.tab();
      await user.keyboard('{ArrowDown}{End}c');
      expect(active()).toHaveTextContent('Cherry');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(option('Cherry')).toHaveAttribute('aria-selected', 'false');
    });

    it('leaves Tab and Escape to the page', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Listbox aria-label="Fruits">{OPTIONS}</Listbox>
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      expect(fireEvent.keyDown(list(), { key: 'Escape' })).toBe(true);
      expect(fireEvent.keyDown(list(), { key: 'Tab' })).toBe(true);
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('toggles in multi-select mode and announces', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderMulti({ onValueChange });
      await user.tab();
      await user.keyboard('{ }{ArrowDown}{ }{ArrowUp}{ }');
      expect(onValueChange.mock.calls).toEqual([[['apple']], [['apple', 'banana']], [['banana']]]);
      await waitFor(() => expect(__getAnnouncerText()).toBe('Apple removed, 1 selected'));
    });

    it('toggles with Enter in multi-select mode too, keeping the toggled option active', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderMulti({ onValueChange });
      await user.tab();
      await user.keyboard('{ArrowDown}{Enter}{End}{Enter}');
      expect(onValueChange.mock.calls).toEqual([[['banana']], [['banana', 'cherry']]]);
      await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry added, 2 selected'));
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith(['banana']);
      expect(active()).toHaveTextContent('Cherry');
      expect(option('Cherry')).toHaveAttribute('aria-selected', 'false');
      await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry removed, 1 selected'));
    });

    it('composes a consumer onKeyDown, whose preventDefault() skips the built-in keys', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') event.preventDefault();
      });
      renderList({ onKeyDown });
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(onKeyDown).toHaveBeenCalled();
      expect(active()).toHaveTextContent('Apple');
      await user.keyboard('{End}');
      expect(active()).toHaveTextContent('Cherry');
    });

    it('ignores keys and focus that bubble from a portal rendered inside it (C-COMPOSE)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderList({
        onValueChange,
        children: (
          <>
            {OPTIONS}
            {createPortal(<input aria-label="Note" />, document.body)}
          </>
        ),
      });
      const note = screen.getByRole('textbox', { name: 'Note' });
      await user.click(note);
      await user.keyboard('a b');
      expect(note).toHaveValue('a b');
      expect(fireEvent.keyDown(note, { key: 'ArrowDown' })).toBe(true);
      expect(fireEvent.keyDown(note, { key: 'Enter' })).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
      // Focus inside the portal is not the list's focus: no option is active.
      expect(list()).not.toHaveAttribute('aria-activedescendant');
    });

    it('leaves the horizontal arrows alone in RTL; nothing mirrors', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Listbox aria-label="Fruits">{OPTIONS}</Listbox>, { dir: 'rtl' });
      await user.tab();
      expect(active()).toHaveTextContent('Apple');
      expect(fireEvent.keyDown(list(), { key: 'ArrowLeft' })).toBe(true);
      expect(fireEvent.keyDown(list(), { key: 'ArrowRight' })).toBe(true);
      expect(active()).toHaveTextContent('Apple');
      await user.keyboard('{ArrowDown}');
      expect(active()).toHaveTextContent('Banana');
    });
  });

  describe('value', () => {
    it('follows a stateful controlled parent', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [value, setValue] = React.useState('apple');
        return (
          <>
            <Listbox aria-label="Fruits" value={value} onValueChange={setValue}>
              {OPTIONS}
            </Listbox>
            <output data-testid="value">{value}</output>
          </>
        );
      }
      render(<Controlled />);
      await user.click(option('Cherry'));
      expect(screen.getByTestId('value')).toHaveTextContent('cherry');
      expect(option('Cherry')).toHaveAttribute('aria-selected', 'true');
      expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
    });

    it('selects again when a controlled parent ignores the callback (separate interactions)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderList({ value: 'apple', onValueChange });
      await user.click(option('Banana'));
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      await user.click(option('Banana'));
      expect(onValueChange.mock.calls).toEqual([['banana'], ['banana']]);
    });

    it('toggles again when a controlled multiselect parent ignores the callback (separate interactions)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderMulti({ value: ['apple'], onValueChange });
      await user.click(option('Banana'));
      await user.click(option('Banana'));
      expect(onValueChange.mock.calls).toEqual([[['apple', 'banana']], [['apple', 'banana']]]);
    });

    it.each([
      ['single-select', false],
      ['multiselect', true],
    ])('does not crash on a null value from JavaScript (%s)', async (_label, multiselect) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      if (multiselect) renderMulti({ value: null as never, onValueChange });
      else renderList({ value: null as never, onValueChange });
      expect(within(list()).queryAllByRole('option', { selected: true })).toEqual([]);
      await user.click(option('Banana'));
      expect(onValueChange).toHaveBeenCalledWith(multiselect ? ['banana'] : 'banana');
    });

    it('calls onValueChange once per change in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Listbox aria-label="Fruits" onValueChange={onValueChange}>
            {OPTIONS}
          </Listbox>
        </React.StrictMode>,
      );
      await user.tab();
      await user.keyboard('{ArrowDown}{Enter}');
      expect(onValueChange.mock.calls).toEqual([['banana']]);
      await user.click(option('Cherry'));
      expect(onValueChange.mock.calls).toEqual([['banana'], ['cherry']]);
    });

    it('calls onValueChange once per toggle in StrictMode with multiselect', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Listbox aria-label="Fruits" multiselect onValueChange={onValueChange}>
            {OPTIONS}
          </Listbox>
        </React.StrictMode>,
      );
      await user.click(option('Cherry'));
      await user.keyboard('{Home}{ }');
      expect(onValueChange.mock.calls).toEqual([[['cherry']], [['cherry', 'apple']]]);
    });
  });

  describe('announcements (D41)', () => {
    it('adds no announcer live region for a single-select Listbox', async () => {
      const user = userEvent.setup();
      renderList();
      await user.tab();
      await user.keyboard('{ }');
      await flushAnnouncerFrame();
      expect(document.querySelector('[data-wave-announcer]')).toBeNull();
    });

    it('mounts the announcer live region with multiselect, and removes it on unmount', () => {
      const { unmount } = renderMulti();
      expect(document.querySelector('[data-wave-announcer]')).not.toBeNull();
      unmount();
      expect(document.querySelector('[data-wave-announcer]')).toBeNull();
    });

    it('announces each toggle with the count of selected values', async () => {
      const user = userEvent.setup();
      renderMulti({ defaultValue: ['banana'] });
      await user.click(option('Apple'));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Apple added, 2 selected'));
      await user.click(option('Banana'));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Banana removed, 1 selected'));
    });

    it('localizes the announcements with labels', async () => {
      const user = userEvent.setup();
      const labels: ListboxLabels = {
        added: (label, count) => `${label} lagt til, ${count} valgt`,
        removed: (label, count) => `${label} fjernet, ${count} valgt`,
      };
      renderMulti({ labels });
      await user.click(option('Cherry'));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry lagt til, 1 valgt'));
      await user.click(option('Cherry'));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry fjernet, 0 valgt'));
    });

    it('announces nothing for a controlled change', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Listbox aria-label="Fruits" multiselect value={['apple']}>
          {OPTIONS}
        </Listbox>,
      );
      // Settle the regions on a real toggle first.
      await user.click(option('Banana'));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Banana added, 2 selected'));
      rerender(
        <Listbox aria-label="Fruits" multiselect value={['apple', 'cherry']}>
          {OPTIONS}
        </Listbox>,
      );
      // A variant that announces every value change from an effect would show a different
      // message here once that effect's write lands.
      await flushAnnouncerFrame();
      expect(__getAnnouncerText()).toBe('Banana added, 2 selected');
    });
  });

  describe('disabled (D17)', () => {
    it('is not focusable, selects nothing and submits nothing while disabled', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <form aria-label="Order">
          <Listbox
            aria-label="Fruits"
            disabled
            name="fruit"
            required
            defaultValue="apple"
            onValueChange={onValueChange}
          >
            {OPTIONS}
          </Listbox>
        </form>,
      );
      expect(list()).not.toHaveAttribute('tabindex');
      expect(list()).toHaveAttribute('aria-disabled', 'true');
      expect(list()).toHaveAttribute('data-disabled', '');
      await user.click(option('Banana'));
      expect(list()).not.toHaveFocus();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      await user.tab();
      expect(list()).not.toHaveFocus();
      expect(list()).not.toHaveAttribute('aria-activedescendant');
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(checkValidity(form)).toBe(true);
      expect(new FormData(form).getAll('fruit')).toEqual([]);
    });

    it('handles no keys while disabled', () => {
      const onValueChange = vi.fn();
      renderList({ disabled: true, onValueChange });
      expect(fireEvent.keyDown(list(), { key: 'ArrowDown' })).toBe(true);
      expect(fireEvent.keyDown(list(), { key: 'Enter' })).toBe(true);
      expect(fireEvent.keyDown(list(), { key: ' ' })).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('takes pointer input off its options while disabled, so none hovers and the list cursor shows', () => {
      const { rerender } = renderList();
      expect(list()).not.toHaveClass('*:pointer-events-none');
      rerender(
        <Listbox aria-label="Fruits" disabled>
          {OPTIONS}
        </Listbox>,
      );
      // pointer-events is inherited: the options inside a group follow their group's item.
      expect(list()).toHaveClass('cursor-not-allowed', 'opacity-50', '*:pointer-events-none');
    });

    it('passes a consumer aria-disabled through on an enabled list, which stays interactive (C-DISABLED)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderList({ 'aria-disabled': true, onValueChange });
      expect(list()).toHaveAttribute('aria-disabled', 'true');
      expect(list()).not.toHaveAttribute('data-disabled');
      expect(list()).toHaveAttribute('tabindex', '0');
      await user.click(option('Banana'));
      expect(list()).toHaveFocus();
      expect(onValueChange).toHaveBeenCalledWith('banana');
    });
  });

  describe('disabled options (D6)', () => {
    it('skips disabled options by default', async () => {
      const user = userEvent.setup();
      render(<Listbox aria-label="Fruits">{WITH_DISABLED}</Listbox>);
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(active()).toHaveTextContent('Cherry');
      await user.keyboard('b');
      expect(active()).toHaveTextContent('Cherry');
    });

    it('reaches disabled options with disabledOptionsFocusable and selects nothing on them', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Listbox aria-label="Fruits" disabledOptionsFocusable onValueChange={onValueChange}>
          {WITH_DISABLED}
        </Listbox>,
      );
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(active()).toHaveTextContent('Banana');
      await user.keyboard('{Enter}{ }');
      await user.click(option('Banana'));
      expect(active()).toHaveTextContent('Banana');
      expect(onValueChange).not.toHaveBeenCalled();
      await user.keyboard('{ArrowUp}');
      await user.keyboard('b');
      expect(active()).toHaveTextContent('Banana');
    });
  });

  describe('groups', () => {
    it('moves through labelled and label-less groups and selects inside them', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Listbox aria-label="Food" onValueChange={onValueChange}>
          <Listbox.OptionGroup label="Fruit">
            <Listbox.Option value="apple">Apple</Listbox.Option>
            <Listbox.Option value="banana">Banana</Listbox.Option>
          </Listbox.OptionGroup>
          <Listbox.OptionGroup aria-label="Vegetables">
            <Listbox.Option value="carrot">Carrot</Listbox.Option>
          </Listbox.OptionGroup>
        </Listbox>,
      );
      expect(screen.getByRole('group', { name: 'Fruit' })).toContainElement(option('Banana'));
      expect(screen.getByRole('group', { name: 'Vegetables' })).toContainElement(option('Carrot'));
      await user.tab();
      await user.keyboard('{End}');
      expect(active('Food')).toHaveTextContent('Carrot');
      await user.keyboard('{ArrowUp}{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('banana');
      await expectNoA11yViolations();
    });
  });

  describe('forms (C-FORMS, D17)', () => {
    it('renders its hidden inputs inside the list, which a focused input hands focus back to', () => {
      render(
        <form aria-label="Order">
          <Listbox aria-label="Fruits" name="fruit" required>
            {OPTIONS}
          </Listbox>
        </form>,
      );
      const input = list().querySelector<HTMLInputElement>('input[data-wave-hidden-input]');
      expect(input?.parentElement).toBe(list());
      // The browser focuses the invalid input after the `invalid` event focused the list.
      act(() => list().focus());
      act(() => input?.focus());
      expect(list()).toHaveFocus();
    });

    it('submits the single value under name, as one entry', async () => {
      const user = userEvent.setup();
      let data: FormData | null = null;
      render(
        <form
          aria-label="Order"
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <Listbox aria-label="Fruits" name="fruit" defaultValue="banana">
            {OPTIONS}
          </Listbox>
          <button type="submit">Send</button>
        </form>,
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.getAll('fruit')).toEqual(['banana']);
      await user.click(option('Cherry'));
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.getAll('fruit')).toEqual(['cherry']);
    });

    it('submits one entry per value with multiselect, in selection order', () => {
      render(
        <form aria-label="Order">
          <Listbox aria-label="Fruits" multiselect name="fruit" defaultValue={['cherry', 'apple']}>
            {OPTIONS}
          </Listbox>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(new FormData(form).getAll('fruit')).toEqual(['cherry', 'apple']);
    });

    it.each([
      ['single-select', false],
      ['multiselect', true],
    ])(
      'required blocks an empty submit, and the invalid event focuses the list (%s)',
      async (_label, multiselect) => {
        const user = userEvent.setup();
        render(
          <form aria-label="Order">
            {multiselect ? (
              <Listbox aria-label="Fruits" multiselect name="fruit" required>
                {OPTIONS}
              </Listbox>
            ) : (
              <Listbox aria-label="Fruits" name="fruit" required>
                {OPTIONS}
              </Listbox>
            )}
          </form>,
        );
        const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
        expect(list()).toHaveAttribute('aria-required', 'true');
        expect(list()).not.toHaveFocus();
        let valid = true;
        act(() => {
          valid = form.reportValidity();
        });
        expect(valid).toBe(false);
        expect(list()).toHaveFocus();
        await user.keyboard('{ }');
        expect(checkValidity(form)).toBe(true);
      },
    );

    it('resets to its default value with the form (also without name)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <form aria-label="Order">
          <Listbox aria-label="Fruits" defaultValue="apple" onValueChange={onValueChange}>
            {OPTIONS}
          </Listbox>
          <button type="reset">Reset</button>
        </form>,
      );
      await user.click(option('Cherry'));
      expect(option('Cherry')).toHaveAttribute('aria-selected', 'true');
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(onValueChange.mock.calls).toEqual([['cherry'], ['apple']]);
    });

    it('multiselect: a toggle then a form reset restores defaultValue, unannounced', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <form aria-label="Order">
          <Listbox
            aria-label="Fruits"
            multiselect
            name="fruit"
            defaultValue={['apple', 'banana']}
            onValueChange={onValueChange}
          >
            {OPTIONS}
          </Listbox>
          <button type="reset">Reset</button>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      await user.click(option('Cherry'));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry added, 3 selected'));
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['apple', 'banana']);
      expect(new FormData(form).getAll('fruit')).toEqual(['apple', 'banana']);
      // A variant that announces a reset would show a different message here.
      await flushAnnouncerFrame();
      expect(__getAnnouncerText()).toBe('Cherry added, 3 selected');
    });

    it('multiselect: an unchanged reset with a new inline defaultValue array makes no call', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const make = () => (
        <form aria-label="Order">
          <Listbox
            aria-label="Fruits"
            multiselect
            defaultValue={['apple', 'banana']}
            onValueChange={onValueChange}
          >
            {OPTIONS}
          </Listbox>
          <button type="reset">Reset</button>
        </form>
      );
      const { rerender } = render(make());
      rerender(make());
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('submits into and resets with a form elsewhere through the form prop', async () => {
      const user = userEvent.setup();
      render(
        <>
          <form id="order-form" aria-label="Order" />
          <Listbox aria-label="Fruits" name="fruit" form="order-form" defaultValue="apple">
            {OPTIONS}
          </Listbox>
        </>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      await user.click(option('Cherry'));
      expect(new FormData(form).getAll('fruit')).toEqual(['cherry']);
      act(() => form.reset());
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(new FormData(form).getAll('fruit')).toEqual(['apple']);
    });
  });

  describe('Field (useFieldControl)', () => {
    it('is labelled and described by a Field', () => {
      renderWithFieldContext(<Listbox>{OPTIONS}</Listbox>, {
        hintId: FIELD_TEST_IDS.hintId,
        errorId: FIELD_TEST_IDS.errorId,
        required: true,
      });
      const control = screen.getByRole('listbox', { name: FIELD_TEST_TEXT.label });
      expect(control).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
      expect(control).toHaveAccessibleDescription(
        `${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`,
      );
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAttribute('aria-required', 'true');
    });

    it('is described by a Field warning without becoming invalid', () => {
      renderWithFieldContext(<Listbox>{OPTIONS}</Listbox>, {
        validationState: 'warning',
        validationMessageId: FIELD_TEST_IDS.messageId,
      });
      const control = screen.getByRole('listbox', { name: FIELD_TEST_TEXT.label });
      expect(control).toHaveAccessibleDescription(FIELD_TEST_TEXT.message);
      expect(control).not.toHaveAttribute('aria-invalid');
    });

    it('a required Field blocks an empty submit until an option is chosen', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(
        <form aria-label="Order">
          <Listbox>{OPTIONS}</Listbox>
        </form>,
        { required: true },
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      // Natively required through the Field alone: no own `required` and no `name`.
      expect(checkValidity(form)).toBe(false);
      await user.click(option('Banana'));
      expect(checkValidity(form)).toBe(true);
    });

    it('an explicit required={false} wins over a required Field', () => {
      renderWithFieldContext(
        <form aria-label="Order">
          <Listbox required={false}>{OPTIONS}</Listbox>
        </form>,
        { required: true },
      );
      const control = screen.getByRole('listbox', { name: FIELD_TEST_TEXT.label });
      expect(control).not.toHaveAttribute('aria-required', 'true');
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(checkValidity(form)).toBe(true);
    });
  });

  describe('onActiveOptionChange (D14)', () => {
    it('reports the active option and null on blur, once in StrictMode', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      render(
        <React.StrictMode>
          <Listbox aria-label="Fruits" onActiveOptionChange={onActiveOptionChange}>
            {OPTIONS}
          </Listbox>
          <button type="button">After</button>
        </React.StrictMode>,
      );
      expect(onActiveOptionChange).not.toHaveBeenCalled();
      await user.tab();
      expect(onActiveOptionChange.mock.calls).toEqual([['apple']]);
      await user.keyboard('{ArrowDown}');
      await user.hover(option('Cherry'));
      await user.keyboard('a');
      await user.tab();
      expect(onActiveOptionChange.mock.calls).toEqual([
        ['apple'],
        ['banana'],
        ['cherry'],
        ['apple'],
        [null],
      ]);
    });
  });

  describe('server rendering', () => {
    it('renders on the server without an active descendant and hydrates cleanly', async () => {
      const element = (
        <Listbox aria-label="Fruits" defaultValue="banana">
          {OPTIONS}
        </Listbox>
      );
      const html = renderToString(element);
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = html;
      const serverList = parsed.querySelector('[role="listbox"]');
      expect(serverList).toHaveAttribute('tabindex', '0');
      expect(serverList).not.toHaveAttribute('aria-activedescendant');
      expect(parsed.querySelector('[aria-selected="true"]')).toHaveTextContent('Banana');

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(error).not.toHaveBeenCalled();
        // Hydrated, with the options registered: still no active option before focus.
        expect(within(list()).getAllByRole('option')).toHaveLength(3);
        expect(list()).not.toHaveAttribute('aria-activedescendant');
        const user = userEvent.setup();
        await user.tab();
        expect(active()).toHaveTextContent('Banana');
        await user.keyboard('{ArrowDown}{Enter}');
        expect(option('Cherry')).toHaveAttribute('aria-selected', 'true');
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('takes the focus it got before hydration, so its keys work once hydrated', async () => {
      const element = (
        <Listbox aria-label="Fruits" defaultValue="banana">
          {OPTIONS}
        </Listbox>
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        // The user tabbed into the server-rendered list (or the browser autofocused it) before
        // the page hydrated: no React focus handler saw it.
        container.querySelector<HTMLElement>('[role="listbox"]')?.focus();
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(error).not.toHaveBeenCalled();
        expect(list()).toHaveFocus();
        expect(active()).toHaveTextContent('Banana');
        const user = userEvent.setup();
        await user.keyboard('{ArrowDown}');
        expect(active()).toHaveTextContent('Cherry');
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('renders autofocus for the browser, and takes no focus when it hydrates', async () => {
      const element = (
        <Listbox aria-label="Fruits" autoFocus>
          {OPTIONS}
        </Listbox>
      );
      const html = renderToString(element);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = html;
      expect(parsed.querySelector('[role="listbox"]')).toHaveAttribute('autofocus');

      const other = document.createElement('button');
      other.type = 'button';
      other.textContent = 'Other';
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.append(other, container);
      // Browsers reflect the global `autofocus` attribute on every HTML element, and React's
      // hydration compares the `autoFocus` prop with it; jsdom reflects it on form controls only.
      const reflected = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'autofocus');
      Object.defineProperty(HTMLElement.prototype, 'autofocus', {
        configurable: true,
        get(this: HTMLElement) {
          return this.hasAttribute('autofocus');
        },
        set(this: HTMLElement, value: boolean) {
          this.toggleAttribute('autofocus', value);
        },
      });
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        // The user moved focus on before the page hydrated: hydration must not take it back, as
        // React's own autoFocus leaves a hydrated control alone.
        other.focus();
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(error).not.toHaveBeenCalled();
        expect(other).toHaveFocus();
        expect(list()).not.toHaveAttribute('aria-activedescendant');
      } finally {
        act(() => root?.unmount());
        container.remove();
        other.remove();
        if (reflected) Object.defineProperty(HTMLElement.prototype, 'autofocus', reflected);
        else Reflect.deleteProperty(HTMLElement.prototype, 'autofocus');
      }
    });

    it('renders options written in a Server Component like the plain parts (C-COMPOUND)', () => {
      // React Flight delivers ListboxOption/ListboxOptionGroup written in a Server Component as
      // lazy types.
      const ClientOption = asClientReference(ListboxOption);
      const ClientOptionGroup = asClientReference(ListboxOptionGroup);
      const plain = renderToString(
        <Listbox aria-label="Country" defaultValue="uk">
          <ListboxOption value="us">United States</ListboxOption>
          <ListboxOptionGroup label="Europe">
            <ListboxOption value="uk">United Kingdom</ListboxOption>
          </ListboxOptionGroup>
        </Listbox>,
      );
      const client = renderToString(
        <Listbox aria-label="Country" defaultValue="uk">
          <ClientOption value="us">United States</ClientOption>
          <ClientOptionGroup label="Europe">
            <ClientOption value="uk">United Kingdom</ClientOption>
          </ClientOptionGroup>
        </Listbox>,
      );
      expect(client).toBe(plain);
    });
  });

  describe('naming (C-DEV)', () => {
    it('warns once when unnamed', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(<Listbox>{OPTIONS}</Listbox>);
      rerender(<Listbox defaultValue="apple">{OPTIONS}</Listbox>);
      expect(warn.mock.calls).toEqual([[UNNAMED_WARNING]]);
    });

    it('warns for a blank aria-label, which names nothing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Listbox aria-label=" ">{OPTIONS}</Listbox>);
      expect(warn.mock.calls).toEqual([[UNNAMED_WARNING]]);
    });

    it('warns for a Field without a label', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderWithFieldContext(<Listbox>{OPTIONS}</Listbox>, { labelId: undefined });
      expect(warn.mock.calls).toEqual([[UNNAMED_WARNING]]);
    });

    it('does not warn when aria-label, aria-labelledby or a Field names it', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <>
          <span id="fruits-label">Fruits</span>
          <Listbox aria-label="Fruits">{OPTIONS}</Listbox>
          <Listbox aria-labelledby="fruits-label">{OPTIONS}</Listbox>
        </>,
      );
      renderWithFieldContext(<Listbox>{OPTIONS}</Listbox>);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('types (D9)', () => {
    it('types the value by signature and keeps ComponentProps', () => {
      expectTypeOf<React.ComponentProps<typeof Listbox>>().toEqualTypeOf<ListboxProps>();
      void (
        <Listbox
          aria-label="Fruits"
          multiselect
          onValueChange={(v) => expectTypeOf(v).toEqualTypeOf<string[]>()}
        />
      );
      void (
        <Listbox
          aria-label="Fruits"
          value="a"
          onValueChange={(v) => expectTypeOf(v).toEqualTypeOf<string>()}
        />
      );
      // @ts-expect-error a string value with multiselect
      void (<Listbox aria-label="Fruits" multiselect value="a" />);
      // @ts-expect-error an array value without multiselect
      void (<Listbox aria-label="Fruits" value={['a']} />);
      const flag = Math.random() > 0.5;
      // @ts-expect-error a non-literal multiselect matches neither signature
      void (<Listbox aria-label="Fruits" multiselect={flag} />);
      expectTypeOf<ListboxLabels['added']>().toEqualTypeOf<
        ((label: string, count: number) => string) | undefined
      >();
    });

    it('stays extendable by an interface', () => {
      interface ExtendedListboxProps extends ListboxProps {
        extra?: string;
      }
      expectTypeOf<ExtendedListboxProps['multiselect']>().toEqualTypeOf<false | undefined>();
      expectTypeOf<ExtendedListboxProps['value']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ListboxProps<true>['value']>().toEqualTypeOf<readonly string[] | undefined>();
      expectTypeOf<ListboxProps['ref']>().toEqualTypeOf<React.Ref<HTMLUListElement> | undefined>();
    });
  });
});
