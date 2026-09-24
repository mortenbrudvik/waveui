import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { Dropdown, DropdownOption, DropdownOptionGroup } from '../Dropdown';
import { Option, OptionGroup } from '../Combobox';
import {
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';

const FRUITS = [
  <Option key="a" value="a">
    Apple
  </Option>,
  <Option key="b" value="b">
    Banana
  </Option>,
  <Option key="c" value="c">
    Cherry
  </Option>,
  <Option key="d" value="d">
    Date
  </Option>,
];

function combobox(name = 'Fruit') {
  return screen.getByRole('combobox', { name });
}

function listbox() {
  return screen.getByRole('listbox');
}

function option(name: string) {
  return screen.getByRole('option', { name });
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function renderDropdown(props: Partial<React.ComponentProps<typeof Dropdown>> = {}) {
  return render(
    <Dropdown aria-label="Fruit" {...props}>
      {props.children ?? FRUITS}
    </Dropdown>,
  );
}

/** A dismiss layer (e.g. a Dialog) around the Dropdown — the stand-in of spec §5.9. */
function ParentLayer({
  onDismiss,
  children,
}: {
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({ open: true, onDismiss, refs: [ref] });
  return (
    <DismissLayerProvider layerId={layerId}>
      <div ref={ref}>{children}</div>
    </DismissLayerProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Dropdown', () => {
  testCompoundExposure(Dropdown, ['Option', 'OptionGroup']);

  testSystemProps(Dropdown, {
    expectedTag: 'div',
    displayName: 'Dropdown',
    control: { role: 'combobox' },
    defaultProps: { 'aria-label': 'Fruit', children: FRUITS },
    conflictingClass: { className: 'flex-row', overrides: 'flex-col' },
    a11yVariants: [
      { name: 'open', props: { defaultOpen: true } },
      { name: 'with a value', props: { defaultValue: 'b' } },
      { name: 'controlled open with a value', props: { open: true, value: 'c' } },
      {
        name: 'open with groups',
        props: {
          defaultOpen: true,
          children: (
            <>
              <OptionGroup label="Fruit">
                <Option value="a">Apple</Option>
              </OptionGroup>
              <OptionGroup label="Vegetables">
                <Option value="c">Carrot</Option>
              </OptionGroup>
            </>
          ),
        },
      },
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  testNoImplicitSubmit(Dropdown, {
    defaultProps: { 'aria-label': 'Fruit', defaultOpen: true, children: FRUITS },
  });

  it('exports flat sub-component names equal to the dotted members (repo-level#2)', () => {
    expect(DropdownOption).toBe(Dropdown.Option);
    expect(DropdownOptionGroup).toBe(Dropdown.OptionGroup);
  });

  it('renders a button with the combobox role named by aria-label', () => {
    renderDropdown();
    expect(combobox().tagName).toBe('BUTTON');
    expect(combobox()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the placeholder when no value is selected', () => {
    renderDropdown({ placeholder: 'Pick one' });
    expect(combobox()).toHaveTextContent('Pick one');
  });

  it('opens the listbox on click and closes it on a second click', async () => {
    const user = userEvent.setup();
    renderDropdown();
    await user.click(combobox());
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    expect(listbox()).toBeVisible();
    await user.click(combobox());
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selects an option on click, closes and keeps focus on the button', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderDropdown({ onValueChange });
    await user.click(combobox());
    await user.click(option('Banana'));
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(combobox()).toHaveTextContent('Banana');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(combobox()).toHaveFocus();
  });

  it('marks the selected option with aria-selected and data-selected', async () => {
    const user = userEvent.setup();
    renderDropdown({ defaultValue: 'c' });
    await user.click(combobox());
    expect(option('Cherry')).toHaveAttribute('aria-selected', 'true');
    expect(option('Cherry')).toHaveAttribute('data-selected');
    expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
  });

  describe('display text (input-pickers#6)', () => {
    it('shows the label of defaultValue', () => {
      renderDropdown({ defaultValue: 'a' });
      expect(combobox()).toHaveTextContent('Apple');
    });

    it('shows the label of a controlled value', () => {
      renderDropdown({ value: 'd' });
      expect(combobox()).toHaveTextContent('Date');
    });

    it('follows a stateful controlled parent', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [value, setValue] = React.useState('a');
        return (
          <>
            <Dropdown aria-label="Fruit" value={value} onValueChange={setValue}>
              {FRUITS}
            </Dropdown>
            <output data-testid="value">{value}</output>
          </>
        );
      }
      render(<Controlled />);
      await user.click(combobox());
      await user.click(option('Cherry'));
      expect(screen.getByTestId('value')).toHaveTextContent('c');
      expect(combobox()).toHaveTextContent('Cherry');
    });

    it('renders the selected label on the server (renderToString)', () => {
      const html = renderToString(
        <Dropdown aria-label="Country" defaultValue="us">
          <Option value="ca">Canada</Option>
          <Option value="us">United States</Option>
        </Dropdown>,
      );
      const host = document.createElement('div');
      host.innerHTML = html;
      // The closed option list is in the markup too: assert the combobox's own text.
      expect(host.querySelector('[role="combobox"]')).toHaveTextContent('United States');
    });

    it('hydrates without mismatches and then opens with the registered options', async () => {
      const element = (
        <Dropdown aria-label="Country" defaultValue="us">
          <Option value="ca">Canada</Option>
          <Option value="us">United States</Option>
        </Dropdown>
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(error).not.toHaveBeenCalled();
        const control = screen.getByRole('combobox', { name: 'Country' });
        expect(control).toHaveTextContent('United States');
        const user = userEvent.setup();
        await user.click(control);
        expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('shows the label of an option inside a group (input-pickers#1)', () => {
      renderDropdown({
        defaultValue: 'c',
        children: (
          <>
            <OptionGroup label="Fruit">
              <Option value="a">Apple</Option>
            </OptionGroup>
            <OptionGroup label="Vegetables">
              <Option value="c">Carrot</Option>
            </OptionGroup>
          </>
        ),
      });
      expect(combobox()).toHaveTextContent('Carrot');
    });

    it('does not show an unknown value (only freeform Combobox shows raw values)', () => {
      renderDropdown({ value: 'zz', placeholder: 'Pick one' });
      expect(combobox()).toHaveTextContent('Pick one');
    });
  });

  describe('keyboard (APG select-only, input-pickers#11)', () => {
    it('Enter opens and Enter commits without re-opening', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderDropdown({ onValueChange });
      combobox().focus();
      await user.keyboard('{Enter}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toHaveTextContent('Apple');
      await user.keyboard('{ArrowDown}{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(combobox()).toHaveTextContent('Banana');
    });

    it('Space opens and Space commits without re-opening (keyup is prevented)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderDropdown({ onValueChange });
      combobox().focus();
      await user.keyboard(' ');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{ArrowDown} ');
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('prevents the Space keyup, so the button does not click after a keydown commit', async () => {
      // user-event skips the keyup click once the keydown was prevented, so the test above cannot
      // see the onKeyUp wiring; dispatch the keyup directly (false = default prevented).
      const user = userEvent.setup();
      const onKeyUp = vi.fn();
      renderDropdown({ onKeyUp });
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      onKeyUp.mockClear();
      expect(fireEvent.keyUp(combobox(), { key: ' ' })).toBe(false);
      expect(onKeyUp).toHaveBeenCalledTimes(1);
      expect(fireEvent.keyUp(combobox(), { key: 'a' })).toBe(true);
    });

    it('ArrowDown opens at the selected option and moves the highlight', async () => {
      const user = userEvent.setup();
      renderDropdown({ defaultValue: 'b' });
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Banana');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.keyboard('{ArrowUp}');
      expect(activeOption()).toHaveTextContent('Banana');
    });

    it('ArrowUp opens at the last option when nothing is selected', async () => {
      const user = userEvent.setup();
      renderDropdown();
      combobox().focus();
      await user.keyboard('{ArrowUp}');
      expect(activeOption()).toHaveTextContent('Date');
    });

    it('Home and End open and move to the first and last option', async () => {
      const user = userEvent.setup();
      renderDropdown({ defaultValue: 'b' });
      combobox().focus();
      await user.keyboard('{End}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toHaveTextContent('Date');
      await user.keyboard('{Home}');
      expect(activeOption()).toHaveTextContent('Apple');
    });

    it('typing a character opens and highlights the matching option (typeahead)', async () => {
      const user = userEvent.setup();
      renderDropdown();
      combobox().focus();
      await user.keyboard('c');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toHaveTextContent('Cherry');
    });

    it('Escape closes without selecting and clears aria-activedescendant', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderDropdown({ onValueChange });
      combobox().focus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(combobox()).toHaveAttribute('aria-activedescendant');
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(combobox()).not.toHaveAttribute('aria-activedescendant');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(combobox()).toHaveFocus();
    });

    it('Tab commits the highlighted option and closes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <Dropdown aria-label="Fruit" onValueChange={onValueChange}>
            {FRUITS}
          </Dropdown>
          <button type="button">Next</button>
        </>,
      );
      combobox().focus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      await user.tab();
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    });

    it('Alt+ArrowUp commits the highlighted option and closes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderDropdown({ onValueChange });
      combobox().focus();
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
      expect(onValueChange).toHaveBeenCalledWith('c');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('aria-controls equals the listbox id and aria-activedescendant the active option id (input-basic#43)', async () => {
      const user = userEvent.setup();
      renderDropdown();
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(combobox()).toHaveAttribute('aria-controls', listbox().id);
      expect(combobox()).toHaveAttribute('aria-activedescendant', option('Apple').id);
      expect(option('Apple')).toHaveAttribute('data-active');
    });

    it('composes a consumer onKeyDown and lets preventDefault() suppress the built-in keys', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn((e: React.KeyboardEvent) => e.preventDefault());
      renderDropdown({ onKeyDown });
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(onKeyDown).toHaveBeenCalled();
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('one navigable list (input-pickers#1, #2, #26, #28)', () => {
    it('selects a grouped option by click and by ArrowDown+Enter', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderDropdown({
        onValueChange,
        children: (
          <>
            <OptionGroup label="Fruit">
              <Option value="a">Apple</Option>
              <Option value="b">Banana</Option>
            </OptionGroup>
            <OptionGroup label="Vegetables">
              <Option value="c">Carrot</Option>
            </OptionGroup>
          </>
        ),
      });
      await user.click(combobox());
      expect(screen.getByRole('group', { name: 'Vegetables' })).toBeInTheDocument();
      await user.click(option('Carrot'));
      expect(onValueChange).toHaveBeenLastCalledWith('c');

      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Carrot');
      await user.keyboard('{ArrowUp}{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith('b');
    });

    it('keeps highlight and commit in sync around a conditional non-option child', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const showNote = true as boolean;
      renderDropdown({
        onValueChange,
        children: (
          <>
            {showNote && <li role="presentation">Popular</li>}
            <Option value="a">Apple</Option>
            {!showNote && <Option value="x">Hidden</Option>}
            <Option value="b">Banana</Option>
          </>
        ),
      });
      combobox().focus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Banana');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(combobox()).toHaveTextContent('Banana');
    });

    it('skips disabled options with the keyboard and ignores clicks on them', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderDropdown({
        onValueChange,
        children: (
          <>
            <Option value="a">Apple</Option>
            <Option value="b" disabled>
              Banana
            </Option>
            <Option value="c">Cherry</Option>
          </>
        ),
      });
      await user.click(combobox());
      expect(option('Banana')).toHaveAttribute('aria-disabled', 'true');
      await user.click(option('Banana'));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('c');
    });

    it('keeps a valid active option when the options shrink while open (input-pickers#26)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = renderDropdown({ onValueChange });
      combobox().focus();
      await user.keyboard('{End}');
      expect(activeOption()).toHaveTextContent('Date');
      rerender(
        <Dropdown aria-label="Fruit" onValueChange={onValueChange}>
          {FRUITS.slice(0, 2)}
        </Dropdown>,
      );
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
      const active = activeOption();
      expect(active).not.toBeNull();
      expect(active).toHaveTextContent('Apple');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('a');
    });

    it('re-sorts keyed options that are reordered (outside StrictMode)', async () => {
      const user = userEvent.setup();
      const make = (order: string[]) => (
        <Dropdown aria-label="Fruit">
          {order.map((v) => (
            <Option key={v} value={v}>
              {v.toUpperCase()}
            </Option>
          ))}
        </Dropdown>
      );
      const { rerender } = render(make(['a', 'b', 'c']));
      rerender(make(['c', 'b', 'a']));
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('C');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('B');
    });
  });

  describe('value callbacks (input-basic#29, table-core#3)', () => {
    it('onValueChange fires only on change; the deprecated onOptionSelect on every activation', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOptionSelect = vi.fn();
      renderDropdown({ defaultValue: 'a', onValueChange, onOptionSelect });
      await user.click(combobox());
      await user.click(option('Apple'));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOptionSelect).toHaveBeenCalledWith('a');
      await user.click(combobox());
      await user.click(option('Banana'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(onOptionSelect).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain(
        '[WaveUI] Dropdown: `onOptionSelect` is deprecated',
      );
    });

    it('warns once that onOptionSelect is deprecated', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderDropdown({ onOptionSelect: () => {} });
      rerender(
        <Dropdown aria-label="Fruit" onOptionSelect={() => {}}>
          {FRUITS}
        </Dropdown>,
      );
      const calls = warn.mock.calls.filter(([m]) => String(m).includes('onOptionSelect'));
      expect(calls).toHaveLength(1);
      expect(String(calls[0][0])).toContain('[WaveUI] Dropdown: `onOptionSelect` is deprecated');
    });

    it('fires the value callback exactly once per selection in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Dropdown aria-label="Fruit" onValueChange={onValueChange}>
            {FRUITS}
          </Dropdown>
        </React.StrictMode>,
      );
      await user.click(combobox());
      await user.click(option('Cherry'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('c');
    });

    it('fires again when a controlled parent rejected the value (separate interactions)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderDropdown({ value: 'a', onValueChange });
      await user.click(combobox());
      await user.click(option('Banana'));
      expect(combobox()).toHaveTextContent('Apple');
      await user.click(combobox());
      await user.click(option('Banana'));
      expect(onValueChange.mock.calls).toEqual([['b'], ['b']]);
    });

    it('asks to open again when a controlled open is ignored (separate interactions)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderDropdown({ open: false, onOpenChange });
      await user.click(combobox());
      await user.click(combobox());
      expect(onOpenChange.mock.calls).toEqual([[true], [true]]);
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('clears to the placeholder when a controlled value becomes undefined (table-core#4)', () => {
      const { rerender } = renderDropdown({ value: 'a', placeholder: 'Pick' });
      expect(combobox()).toHaveTextContent('Apple');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      rerender(
        <Dropdown aria-label="Fruit" value={undefined} placeholder="Pick">
          {FRUITS}
        </Dropdown>,
      );
      expect(combobox()).toHaveTextContent('Pick');
    });
  });

  describe('popup (overlays#1, #36, #37, input-pickers#12, #18, input-datetime#2)', () => {
    it('renders the closed list inline and hidden, and the open list in a portal', async () => {
      const user = userEvent.setup();
      const { container } = renderDropdown();
      const inline = container.querySelector('[role="listbox"]');
      expect(inline).not.toBeNull();
      expect(inline).not.toBeVisible();
      expect(combobox()).toHaveAttribute('aria-controls', inline!.id);
      await user.click(combobox());
      expect(container.querySelector('[role="listbox"]')).toBeNull();
      expect(listbox().closest('[data-wave-portal]')).not.toBeNull();
      expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(1);
    });

    it('closes on a press outside, without timers', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Dropdown aria-label="Fruit">{FRUITS}</Dropdown>
          <p>Outside</p>
        </>,
      );
      await user.click(combobox());
      await user.click(screen.getByText('Outside'));
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes when focus moves outside', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Dropdown aria-label="Fruit">{FRUITS}</Dropdown>
          <button type="button">Elsewhere</button>
        </>,
      );
      await user.click(combobox());
      act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('Escape closes only the listbox inside a parent layer; a second Escape reaches the parent', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <Dropdown aria-label="Fruit">{FRUITS}</Dropdown>
        </ParentLayer>,
      );
      await user.click(combobox());
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });

    it('leaves Escape to the parent layer while no list is shown (no options, overlays#1)', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <Dropdown aria-label="Fruit" onOpenChange={onOpenChange}>
            {[]}
          </Dropdown>
        </ParentLayer>,
      );
      await user.click(combobox());
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('scrolls the active option into view', async () => {
      const user = userEvent.setup();
      renderDropdown();
      combobox().focus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      const scroll = vi.mocked(Element.prototype.scrollIntoView);
      expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
      expect(scroll.mock.contexts.at(-1)).toBe(option('Banana'));
    });

    it('places the surface below the button and flips above it near the viewport bottom', async () => {
      const html = document.documentElement;
      Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
      Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
      let anchorY = 100;
      const rect = (x: number, y: number, width: number, height: number) =>
        ({
          x,
          y,
          left: x,
          top: y,
          width,
          height,
          right: x + width,
          bottom: y + height,
          toJSON: () => ({}),
        }) as DOMRect;
      const box = (el: Element) => {
        if (el.getAttribute('role') === 'combobox') return rect(100, anchorY, 200, 32);
        if (el.hasAttribute('data-wave-listbox-surface')) return rect(0, 0, 200, 150);
        return rect(0, 0, 0, 0);
      };
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        return box(this);
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return box(this).width;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return box(this).height;
      });
      try {
        const user = userEvent.setup();
        const { unmount } = renderDropdown();
        await user.click(combobox());
        const surface = () => listbox().closest('[data-wave-listbox-surface]');
        await waitFor(() => expect(surface()).toHaveAttribute('data-side', 'bottom'));
        expect(surface()).toHaveAttribute('data-align', 'start');
        // As wide as the button (size middleware writes the variable).
        expect((surface() as HTMLElement).style.width).toBe('var(--wave-popup-reference-width)');
        expect(
          (surface() as HTMLElement).style.getPropertyValue('--wave-popup-reference-width'),
        ).toBe('200px');
        await user.keyboard('{Escape}');
        unmount();

        anchorY = 700;
        renderDropdown();
        await user.click(combobox());
        await waitFor(() => expect(surface()).toHaveAttribute('data-side', 'top'));
      } finally {
        Reflect.deleteProperty(html, 'clientWidth');
        Reflect.deleteProperty(html, 'clientHeight');
      }
    });
  });

  describe('Field and routing (input-basic#1)', () => {
    it('is labelled and described by its Field', () => {
      renderWithFieldContext(<Dropdown>{FRUITS}</Dropdown>, {
        hintId: FIELD_TEST_IDS.hintId,
        errorId: FIELD_TEST_IDS.errorId,
        required: true,
      });
      const control = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(control).toHaveAccessibleDescription(
        `${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`,
      );
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAttribute('aria-required', 'true');
    });

    it('names its open listbox after the Field label', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(<Dropdown>{FRUITS}</Dropdown>);
      await user.click(screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label }));
      expect(screen.getByRole('listbox', { name: FIELD_TEST_TEXT.label })).toBeInTheDocument();
    });

    it('is labelled through aria-labelledby when it carries its own id', () => {
      renderWithFieldContext(<Dropdown id="own-id">{FRUITS}</Dropdown>);
      const control = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(control).toHaveAttribute('id', 'own-id');
    });

    it('routes id and aria props to the button and keeps data-* and ref on the root', () => {
      const ref = React.createRef<HTMLDivElement>();
      const controlRef = React.createRef<HTMLButtonElement>();
      render(
        <Dropdown
          ref={ref}
          controlRef={controlRef}
          id="fruit"
          aria-label="Fruit"
          aria-describedby="help"
          data-testid="root"
        >
          {FRUITS}
        </Dropdown>,
      );
      expect(combobox()).toHaveAttribute('id', 'fruit');
      expect(combobox()).toHaveAttribute('aria-describedby', 'help');
      expect(controlRef.current).toBe(combobox());
      expect(ref.current).toBe(screen.getByTestId('root'));
      expect(screen.getByTestId('root')).not.toHaveAttribute('id');
    });
  });

  describe('forms (input-basic#12)', () => {
    it('submits its value under name', async () => {
      const user = userEvent.setup();
      let data: FormData | null = null;
      render(
        <form
          aria-label="Order"
          onSubmit={(e) => {
            e.preventDefault();
            data = new FormData(e.currentTarget);
          }}
        >
          <Dropdown aria-label="Fruit" name="fruit" defaultValue="b">
            {FRUITS}
          </Dropdown>
          <button type="submit">Send</button>
        </form>,
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.get('fruit')).toBe('b');
    });

    it('resets to its default value with the form (also without name)', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Order">
          <Dropdown aria-label="Fruit" defaultValue="a">
            {FRUITS}
          </Dropdown>
          <button type="reset">Reset</button>
        </form>,
      );
      await user.click(combobox());
      await user.click(option('Cherry'));
      expect(combobox()).toHaveTextContent('Cherry');
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(combobox()).toHaveTextContent('Apple');
    });

    it('blocks submission while required and empty', () => {
      render(
        <form aria-label="Order">
          <Dropdown aria-label="Fruit" name="fruit" required>
            {FRUITS}
          </Dropdown>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
      expect(combobox()).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('styling (input-pickers#20, feedback-navigation#34)', () => {
    /** A class without its variants: `data-[active]:[--x:var(--y)]` → `[--x:var(--y)]`. */
    function utilityOf(className: string): string {
      let depth = 0;
      let start = 0;
      for (let i = 0; i < className.length; i++) {
        const ch = className[i];
        if (ch === '[' || ch === '(') depth += 1;
        else if (ch === ']' || ch === ')') depth -= 1;
        else if (ch === ':' && depth === 0) start = i + 1;
      }
      return className.slice(start);
    }

    /** The classes of `el` that set a background, with their variants, sorted. */
    function backgroundClasses(el: Element): string[] {
      return [...el.classList].filter((c) => utilityOf(c).startsWith('bg-')).sort();
    }

    function renderStyledApple(className: string) {
      renderDropdown({
        defaultValue: 'a',
        children: (
          <>
            <Option value="a" className={className}>
              Apple
            </Option>
            <Option value="b">Banana</Option>
          </>
        ),
      });
    }

    it('paints the state backgrounds through a single unconditional background class', async () => {
      const user = userEvent.setup();
      renderDropdown({ defaultValue: 'a' });
      await user.click(combobox());
      const apple = option('Apple');
      expect(apple).toHaveAttribute('data-selected');
      expect(apple).toHaveAttribute('data-active');
      // The hover/selected/active variants only set `--option-bg`: no state class declares a
      // background of its own that would out-specify (class + attribute) a consumer's plain `bg-*`.
      expect(backgroundClasses(apple)).toEqual(['bg-(--option-bg)']);
      expect(backgroundClasses(option('Banana'))).toEqual(['bg-(--option-bg)']);
      expect(apple).toHaveClass(
        'data-[selected]:[--option-bg:var(--wave-subtle-selected)]',
        'data-[active]:[--option-bg:var(--wave-subtle-hover)]',
      );
    });

    it('lets a plain consumer background replace the state backgrounds while selected and active', async () => {
      const user = userEvent.setup();
      renderStyledApple('bg-primary text-primary-foreground');
      await user.click(combobox());
      const apple = option('Apple');
      expect(apple).toHaveAttribute('data-selected');
      expect(apple).toHaveAttribute('data-active');
      // tailwind-merge replaced the built-in `bg-(--option-bg)`: the consumer's class is the only
      // background left on the option, so it wins the cascade in every state.
      expect(backgroundClasses(apple)).toEqual(['bg-primary']);
      expect(apple).toHaveClass('text-primary-foreground');
      expect(apple).not.toHaveClass('text-foreground');
      expect(backgroundClasses(option('Banana'))).toEqual(['bg-(--option-bg)']);
    });

    it('lets a consumer restyle one state with a data variant', async () => {
      const user = userEvent.setup();
      renderStyledApple('data-[active]:bg-selected');
      await user.click(combobox());
      const apple = option('Apple');
      expect(apple).toHaveAttribute('data-active');
      // The variant (class + attribute) out-specifies the unconditional `bg-(--option-bg)`.
      expect(backgroundClasses(apple)).toEqual(['bg-(--option-bg)', 'data-[active]:bg-selected']);
    });

    it('uses logical classes in RTL', () => {
      renderWithProviders(<Dropdown aria-label="Fruit">{FRUITS}</Dropdown>, { dir: 'rtl' });
      expect(combobox()).toHaveClass('text-start');
      const chevron = combobox().querySelector('svg');
      expect(chevron).toHaveClass('ms-2');
      expect(combobox().closest('[dir]')).toHaveAttribute('dir', 'rtl');
    });
  });

  it('re-renders only the old and new active option on ArrowDown (input-pickers#27)', async () => {
    const user = userEvent.setup();
    const renders = new Map<string, number>();
    const onRender: React.ProfilerOnRenderCallback = (id) =>
      renders.set(id, (renders.get(id) ?? 0) + 1);
    render(
      <Dropdown aria-label="Fruit">
        {['a', 'b', 'c', 'd', 'e'].map((v) => (
          <React.Profiler key={v} id={v} onRender={onRender}>
            <Option value={v}>{v.toUpperCase()}</Option>
          </React.Profiler>
        ))}
      </Dropdown>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('A');
    renders.clear();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('B');
    expect([...renders.keys()].sort()).toEqual(['a', 'b']);
  });

  it('is disabled', () => {
    renderDropdown({ disabled: true });
    expect(combobox()).toBeDisabled();
  });

  it('closes the list when disabled turns on, so enabling it again does not reopen it', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = renderDropdown({ onOpenChange });
    await user.click(combobox());
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    rerender(
      <Dropdown aria-label="Fruit" onOpenChange={onOpenChange} disabled>
        {FRUITS}
      </Dropdown>,
    );
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    const openChangeCalls = onOpenChange.mock.calls.length;
    rerender(
      <Dropdown aria-label="Fruit" onOpenChange={onOpenChange}>
        {FRUITS}
      </Dropdown>,
    );
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(openChangeCalls);
  });

  it('shows the grouped options inside the portal surface', async () => {
    const user = userEvent.setup();
    renderDropdown({
      children: (
        <OptionGroup label="Fruit">
          <Option value="a">Apple</Option>
        </OptionGroup>
      ),
    });
    await user.click(combobox());
    const group = screen.getByRole('group', { name: 'Fruit' });
    expect(group.closest('[data-wave-listbox-surface]')).not.toBeNull();
    expect(within(group).getByRole('option', { name: 'Apple' })).toBeInTheDocument();
  });
});
