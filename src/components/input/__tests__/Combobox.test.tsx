import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  Combobox,
  ComboboxOption,
  ComboboxOptionGroup,
  Option,
  OptionGroup,
  type ComboboxLabels,
} from '../Combobox';
import {
  asClientReference,
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';
import { Button } from '../../button/Button';

const FRUITS = [
  <Option key="a" value="a">
    Apple
  </Option>,
  <Option key="b" value="b">
    Beta
  </Option>,
  <Option key="c" value="c">
    Cherry
  </Option>,
];

const COUNTRIES = [
  <Option key="us" value="us">
    United States
  </Option>,
  <Option key="uk" value="uk">
    United Kingdom
  </Option>,
];

function combobox(name = 'Fruit') {
  return screen.getByRole('combobox', { name });
}

function option(name: string) {
  return screen.getByRole('option', { name });
}

function visibleOptions() {
  return screen.queryAllByRole('option').map((el) => el.textContent);
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function renderCombobox(props: Partial<React.ComponentProps<typeof Combobox>> = {}) {
  return render(
    <Combobox aria-label="Fruit" {...props}>
      {props.children ?? FRUITS}
    </Combobox>,
  );
}

/** A dismiss layer (e.g. a Dialog) around the Combobox — the stand-in of spec §5.9. */
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

const CONTROLLED_TO_UNCONTROLLED =
  '[WaveUI] A component is changing from controlled to uncontrolled. Components should not ' +
  'switch between controlled and uncontrolled: pass `undefined` only when the component is ' +
  'uncontrolled, and the empty value (for example `[]`, `null` or `""`) to clear a controlled ' +
  'value.';

const DEPRECATED_ON_OPTION_SELECT =
  '[WaveUI] Combobox: `onOptionSelect` is deprecated and will be removed in 1.0. Use ' +
  '`onValueChange` instead.';

const EXPAND_ICON_BUTTON =
  '[WaveUI] Combobox: `expandIcon` received a button element; its children render as the ' +
  'glyph of the built-in expand button and its props were dropped (buttons cannot be nested). ' +
  'Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.';

const EXPAND_ICON_BUTTON_SLOT =
  '[WaveUI] Combobox: `expandIcon` received a slot object that renders a button; its children ' +
  'render as the glyph of the built-in expand button and its props were dropped (buttons cannot ' +
  'be nested). Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Combobox', () => {
  testCompoundExposure(Combobox, ['Option', 'OptionGroup']);

  testSystemProps(Combobox, {
    expectedTag: 'div',
    displayName: 'Combobox',
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
                <Option value="c" disabled>
                  Carrot
                </Option>
              </OptionGroup>
            </>
          ),
        },
      },
      { name: 'disabled', props: { disabled: true } },
      { name: 'with clear and expand buttons', props: { defaultValue: 'b', clearable: true } },
      {
        name: 'open with clear and expand buttons',
        props: { defaultOpen: true, defaultValue: 'b', clearable: true },
      },
      {
        name: 'disabled with clear and expand buttons',
        props: { disabled: true, defaultValue: 'b', clearable: true },
      },
    ],
  });

  testNoImplicitSubmit(Combobox, {
    defaultProps: { 'aria-label': 'Fruit', defaultValue: 'a', clearable: true, children: FRUITS },
  });

  it('exports flat sub-component names equal to the dotted members (repo-level#2)', () => {
    expect(ComboboxOption).toBe(Combobox.Option);
    expect(ComboboxOptionGroup).toBe(Combobox.OptionGroup);
  });

  it('renders an editable combobox input with list autocomplete', () => {
    renderCombobox({ placeholder: 'Search...' });
    expect(combobox().tagName).toBe('INPUT');
    expect(combobox()).toHaveAttribute('aria-autocomplete', 'list');
    expect(combobox()).toHaveAttribute('placeholder', 'Search...');
  });

  it('is disabled', () => {
    renderCombobox({ disabled: true });
    expect(combobox()).toBeDisabled();
  });

  it('opens the listbox on click', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.click(combobox());
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeVisible();
  });

  it('selects an option on click and shows its label', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });
    await user.click(combobox());
    await user.click(option('Apple'));
    expect(onValueChange).toHaveBeenCalledWith('a');
    expect(combobox()).toHaveValue('Apple');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(combobox()).toHaveFocus();
  });

  describe('keyboard (APG editable)', () => {
    it('selects an option via ArrowDown + Enter and shows its label', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ onValueChange, children: COUNTRIES, 'aria-label': 'Country' });
      await user.click(combobox('Country'));
      await user.keyboard('{ArrowDown}{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('us');
      expect(combobox('Country')).toHaveValue('United States');
    });

    it('ArrowDown opens at the selected option and ArrowUp/ArrowDown move the highlight', async () => {
      const user = userEvent.setup();
      renderCombobox({ defaultValue: 'b' });
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toHaveTextContent('Beta');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(activeOption()).toHaveTextContent('Apple');
    });

    it('aria-controls equals the listbox id and aria-activedescendant follows the highlight', async () => {
      const user = userEvent.setup();
      renderCombobox();
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(combobox()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
      expect(combobox()).toHaveAttribute('aria-activedescendant', option('Apple').id);
      await user.keyboard('{Escape}');
      expect(combobox()).not.toHaveAttribute('aria-activedescendant');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('Escape closes the listbox and restores the selected label', async () => {
      const user = userEvent.setup();
      renderCombobox({ defaultValue: 'a' });
      await user.click(combobox());
      await user.clear(combobox());
      await user.type(combobox(), 'ch');
      expect(combobox()).toHaveValue('ch');
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(combobox()).toHaveValue('Apple');
    });

    it('Home and End stay with the text caret', async () => {
      const user = userEvent.setup();
      renderCombobox();
      await user.click(combobox());
      await user.keyboard('{ArrowDown}{ArrowDown}');
      await user.keyboard('{Home}');
      expect(activeOption()).toHaveTextContent('Beta');
    });

    it('Enter in a closed Combobox submits the surrounding form (input-pickers#11)', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <form aria-label="Order" onSubmit={onSubmit}>
          <Combobox aria-label="Fruit">{FRUITS}</Combobox>
          <button type="submit">Send</button>
        </form>,
      );
      combobox().focus();
      await user.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('Enter on a highlighted option selects it without submitting the form', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <form aria-label="Order" onSubmit={onSubmit}>
          <Combobox aria-label="Fruit">{FRUITS}</Combobox>
          <button type="submit">Send</button>
        </form>,
      );
      combobox().focus();
      await user.keyboard('{ArrowDown}{Enter}');
      expect(onSubmit).not.toHaveBeenCalled();
      expect(combobox()).toHaveValue('Apple');
    });
  });

  describe('filtering and the draft (input-pickers#2, #7, #8)', () => {
    it('filters the options while typing without committing the text', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ onValueChange });
      await user.type(combobox(), 'ch');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(visibleOptions()).toEqual(['Cherry']);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("type 'be', ArrowDown, Enter selects the option it highlights", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ onValueChange });
      await user.type(combobox(), 'be');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Beta');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(combobox()).toHaveValue('Beta');
    });

    it('restores the selected label on blur and never commits free text', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <Combobox aria-label="Fruit" defaultValue="c" onValueChange={onValueChange}>
            {FRUITS}
          </Combobox>
          <button type="button">Next</button>
        </>,
      );
      await user.click(combobox());
      await user.clear(combobox());
      await user.type(combobox(), 'zzz');
      await user.tab();
      expect(combobox()).toHaveValue('Cherry');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('hides filtered-out options with the hidden attribute', async () => {
      const user = userEvent.setup();
      renderCombobox();
      await user.type(combobox(), 'ch');
      const filteredOut = screen
        .getAllByRole('option', { hidden: true })
        .filter((element) => element.hidden);
      // base.css's scoped `[hidden]` rule hides them over their `flex`.
      expect(filteredOut.map((element) => element.textContent)).toEqual(['Apple', 'Beta']);
      expect(option('Cherry')).not.toHaveAttribute('hidden');
    });

    it('shows "No matches" when the text matches no option', async () => {
      const user = userEvent.setup();
      renderCombobox();
      await user.type(combobox(), 'zzz');
      expect(screen.getByRole('status')).toHaveTextContent('No matches');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('announces "No matches" through a status region mounted before the text', async () => {
      const user = userEvent.setup();
      const { container } = renderCombobox();
      // A live region added together with its text is not announced by every screen reader.
      const status = within(container).getByRole('status');
      expect(status).toBeEmptyDOMElement();
      await user.type(combobox(), 'zzz');
      expect(within(container).getByRole('status')).toBe(status);
      expect(status).toHaveTextContent('No matches');
      // The visible row in the popup is a copy, hidden from assistive technology.
      const surface = document.querySelector<HTMLElement>('[data-wave-listbox-surface]')!;
      expect(within(surface).getByText('No matches')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getAllByRole('status')).toEqual([status]);
      await user.clear(combobox());
      await user.type(combobox(), 'ch');
      expect(visibleOptions()).toEqual(['Cherry']);
      expect(status).toBeEmptyDOMElement();
      await user.type(combobox(), 'zz');
      expect(status).toHaveTextContent('No matches');
      await user.keyboard('{Escape}');
      expect(status).toBeEmptyDOMElement();
    });

    it('announces and shows labels.noMatches instead of the English text', async () => {
      const user = userEvent.setup();
      const labels: ComboboxLabels = { noMatches: 'Ingen treff' };
      const { container } = renderCombobox({ labels });
      await user.type(combobox(), 'zzz');
      expect(within(container).getByRole('status')).toHaveTextContent('Ingen treff');
      const surface = document.querySelector<HTMLElement>('[data-wave-listbox-surface]')!;
      expect(within(surface).getByText('Ingen treff')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByText('No matches')).toBeNull();
    });

    it('shows no "No matches" surface while a controlled parent keeps the list closed (input-pickers#21)', async () => {
      const user = userEvent.setup();
      renderCombobox({ open: false });
      await user.type(combobox(), 'zzz');
      expect(combobox()).toHaveValue('zzz');
      expect(screen.queryByText('No matches')).toBeNull();
      expect(document.querySelector('[data-wave-listbox-surface]')).toBeNull();
    });

    it('Escape on a closed list clears a typed filter, then reaches the parent layer (onClearDraft)', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <Combobox aria-label="Fruit" defaultValue="a" open={false}>
            {FRUITS}
          </Combobox>
        </ParentLayer>,
      );
      await user.clear(combobox());
      await user.type(combobox(), 'ch');
      expect(combobox()).toHaveValue('ch');
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveValue('Apple');
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
      expect(combobox()).toHaveValue('Apple');
    });

    it('re-syncs the text when a controlled parent rejects the selection', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ value: 'a', onValueChange });
      expect(combobox()).toHaveValue('Apple');
      await user.click(combobox());
      await user.click(option('Beta'));
      expect(onValueChange).toHaveBeenLastCalledWith('b');
      expect(combobox()).toHaveValue('Apple');
      await user.click(combobox());
      await user.click(option('Beta'));
      expect(onValueChange.mock.calls).toEqual([['b'], ['b']]);
      expect(combobox()).toHaveValue('Apple');
    });

    it('shows an empty input when a controlled parent resets to an empty value', async () => {
      const user = userEvent.setup();
      function Resetting() {
        const [value, setValue] = React.useState('');
        return (
          <Combobox aria-label="Fruit" value={value} onValueChange={() => setValue('')}>
            {FRUITS}
          </Combobox>
        );
      }
      render(<Resetting />);
      await user.click(combobox());
      await user.click(option('Cherry'));
      expect(combobox()).toHaveValue('');
    });

    it('hides a group whose options are all filtered out', async () => {
      const user = userEvent.setup();
      renderCombobox({
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
      await user.type(combobox(), 'car');
      expect(screen.getByRole('group', { name: 'Vegetables' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Fruit' })).toBeNull();
    });

    it('hides a group whose options are wrapped in a component when a filter empties it', async () => {
      const user = userEvent.setup();
      function WrappedOption(props: React.ComponentProps<typeof Option>) {
        return <Option {...props} />;
      }
      renderCombobox({
        children: (
          <>
            <OptionGroup label="Fruit">
              <WrappedOption value="a">Apple</WrappedOption>
            </OptionGroup>
            <OptionGroup label="Vegetables">
              <WrappedOption value="c">Carrot</WrappedOption>
            </OptionGroup>
          </>
        ),
      });
      await user.type(combobox(), 'car');
      expect(screen.getByRole('group', { name: 'Vegetables' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Fruit' })).toBeNull();
      await user.clear(combobox());
      expect(screen.getByRole('group', { name: 'Fruit' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Vegetables' })).toBeInTheDocument();
    });

    it('hides an outer group once a filter empties its nested groups', async () => {
      const user = userEvent.setup();
      renderCombobox({
        children: (
          <>
            <OptionGroup label="Produce">
              <OptionGroup label="Fruit">
                <Option value="a">Apple</Option>
              </OptionGroup>
            </OptionGroup>
            <Option value="c">Carrot</Option>
          </>
        ),
      });
      await user.type(combobox(), 'car');
      expect(visibleOptions()).toEqual(['Carrot']);
      expect(screen.queryByRole('group', { name: 'Produce' })).toBeNull();
      expect(screen.queryByRole('group', { name: 'Fruit' })).toBeNull();
    });

    it('makes the first match active while typing, so Enter selects it instead of submitting', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <form aria-label="Order" onSubmit={onSubmit}>
          <Combobox aria-label="Fruit" name="fruit" onValueChange={onValueChange}>
            {FRUITS}
          </Combobox>
          <button type="submit">Send</button>
        </form>,
      );
      await user.type(combobox(), 'e');
      expect(visibleOptions()).toEqual(['Apple', 'Beta', 'Cherry']);
      expect(activeOption()).toHaveTextContent('Apple');
      await user.type(combobox(), 'r');
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.keyboard('{Enter}');
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onValueChange).toHaveBeenCalledWith('c');
      expect(combobox()).toHaveValue('Cherry');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('makes the first match active again after the user moved and typed on', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({
        onValueChange,
        children: ['Apple', 'Banana', 'Blackberry', 'Blueberry'].map((name) => (
          <Option key={name} value={name.toLowerCase()}>
            {name}
          </Option>
        )),
      });
      await user.type(combobox(), 'b');
      expect(activeOption()).toHaveTextContent('Banana');
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Blueberry');
      // Typing returns visual focus to the text (APG); the first match of the new text is active.
      await user.keyboard('e');
      expect(visibleOptions()).toEqual(['Blackberry', 'Blueberry']);
      expect(activeOption()).toHaveTextContent('Blackberry');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('blackberry');
      expect(combobox()).toHaveValue('Blackberry');
    });

    it('activates no option on open or once the typed text is cleared', async () => {
      const user = userEvent.setup();
      renderCombobox();
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toBeNull();
      await user.type(combobox(), 'b');
      expect(activeOption()).toHaveTextContent('Beta');
      await user.clear(combobox());
      expect(visibleOptions()).toEqual(['Apple', 'Beta', 'Cherry']);
      expect(activeOption()).toBeNull();
    });
  });

  describe('freeform', () => {
    it('filters options as the user types and commits the text as the value', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ freeform: true, onValueChange });
      await user.type(combobox(), 'ap');
      expect(visibleOptions()).toEqual(['Apple']);
      expect(onValueChange.mock.calls).toEqual([['a'], ['ap']]);
      expect(combobox()).toHaveValue('ap');
    });

    it('keeps a raw value that matches no option', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Combobox aria-label="Fruit" freeform>
            {FRUITS}
          </Combobox>
          <button type="button">Next</button>
        </>,
      );
      await user.type(combobox(), 'kiwi');
      await user.tab();
      expect(combobox()).toHaveValue('kiwi');
    });

    it('filters, then ArrowDown + Enter commits the highlighted option (input-basic#30)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ freeform: true, onValueChange });
      await user.type(combobox(), 'be');
      expect(visibleOptions()).toEqual(['Beta']);
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Beta');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith('b');
      expect(combobox()).toHaveValue('Beta');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('Escape closes, then Escape on the closed list clears the text (onClearDraft)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ freeform: true, onValueChange });
      await user.type(combobox(), 'kiwi');
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(combobox()).toHaveValue('kiwi');
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveValue('');
      expect(onValueChange).toHaveBeenLastCalledWith('');
    });

    it('fires the value callback exactly once per keystroke in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Combobox aria-label="Fruit" freeform onValueChange={onValueChange}>
            {FRUITS}
          </Combobox>
        </React.StrictMode>,
      );
      await user.type(combobox(), 'k');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('k');
    });

    it('shows the text of a controlled parent that normalizes it while typing', async () => {
      const user = userEvent.setup();
      let data: FormData | null = null;
      function Uppercase() {
        const [value, setValue] = React.useState('');
        return (
          <form
            aria-label="Order"
            onSubmit={(e) => {
              e.preventDefault();
              data = new FormData(e.currentTarget);
            }}
          >
            <Combobox
              aria-label="Fruit"
              name="fruit"
              freeform
              value={value}
              onValueChange={(next) => setValue(next.toUpperCase())}
            >
              {FRUITS}
            </Combobox>
            <button type="submit">Send</button>
          </form>
        );
      }
      render(<Uppercase />);
      await user.type(combobox(), 'ch');
      // Shown while the input still has focus, not only after blur.
      expect(combobox()).toHaveFocus();
      expect(combobox()).toHaveValue('CH');
      expect(visibleOptions()).toEqual(['Cherry']);
      await user.type(combobox(), 'e');
      expect(combobox()).toHaveValue('CHE');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.get('fruit')).toBe('CHE');
      expect(combobox()).toHaveValue('CHE');
    });

    it('keeps the text of a controlled parent that rejects the typing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({ freeform: true, value: 'kiwi', onValueChange });
      await user.type(combobox(), 's');
      expect(onValueChange).toHaveBeenCalledWith('kiwis');
      expect(combobox()).toHaveValue('kiwi');
    });

    it('keeps typed text that equals an option value as typed', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <Combobox aria-label="Fruit" freeform onValueChange={onValueChange}>
            {FRUITS}
          </Combobox>
          <button type="button">Next</button>
        </>,
      );
      await user.type(combobox(), 'a');
      expect(onValueChange).toHaveBeenLastCalledWith('a');
      await user.tab();
      expect(combobox()).toHaveValue('a');
      // Selecting the option with that value shows its label.
      await user.click(combobox());
      await user.click(option('Apple'));
      expect(combobox()).toHaveValue('Apple');
    });

    it('shows the label of an option value that was not typed', () => {
      renderCombobox({ freeform: true, defaultValue: 'us', children: COUNTRIES });
      expect(combobox()).toHaveValue('United States');
    });

    it('activates no option while typing, so Enter submits the typed text', async () => {
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
          <Combobox aria-label="Fruit" name="fruit" freeform>
            {FRUITS}
          </Combobox>
          <button type="submit">Send</button>
        </form>,
      );
      await user.type(combobox(), 'ap');
      expect(visibleOptions()).toEqual(['Apple']);
      expect(activeOption()).toBeNull();
      await user.keyboard('{Enter}');
      expect(data!.get('fruit')).toBe('ap');
      expect(combobox()).toHaveValue('ap');
    });
  });

  describe('display text (input-pickers#6)', () => {
    it('shows the label of a controlled value', () => {
      renderCombobox({ value: 'us', children: COUNTRIES });
      expect(combobox()).toHaveValue('United States');
    });

    it('shows the label of defaultValue', () => {
      renderCombobox({ defaultValue: 'us', children: COUNTRIES });
      expect(combobox()).toHaveValue('United States');
    });

    it('follows a stateful controlled parent', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [value, setValue] = React.useState('uk');
        return (
          <Combobox aria-label="Fruit" value={value} onValueChange={setValue}>
            {COUNTRIES}
          </Combobox>
        );
      }
      render(<Controlled />);
      expect(combobox()).toHaveValue('United Kingdom');
      await user.click(combobox());
      await user.click(option('United States'));
      expect(combobox()).toHaveValue('United States');
    });

    it('renders the selected label on the server (renderToString)', () => {
      const html = renderToString(
        <Combobox aria-label="Country" defaultValue="us">
          {COUNTRIES}
        </Combobox>,
      );
      const host = document.createElement('div');
      host.innerHTML = html;
      expect(host.querySelector('input[role="combobox"]')).toHaveAttribute(
        'value',
        'United States',
      );
    });

    it('hydrates grouped options without mismatches, then hides an emptied group', async () => {
      function WrappedOption(props: React.ComponentProps<typeof Option>) {
        return <Option {...props} />;
      }
      const element = (
        <Combobox aria-label="Fruit" defaultValue="a">
          <OptionGroup label="Fruit">
            <WrappedOption value="a">Apple</WrappedOption>
          </OptionGroup>
          <OptionGroup label="Vegetables">
            <WrappedOption value="c">Carrot</WrappedOption>
          </OptionGroup>
        </Combobox>
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(error).not.toHaveBeenCalled();
        expect(combobox()).toHaveValue('Apple');
        const user = userEvent.setup();
        await user.clear(combobox());
        await user.type(combobox(), 'car');
        expect(screen.getByRole('group', { name: 'Vegetables' })).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Fruit' })).toBeNull();
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('renders the selected label of options written in a Server Component (C-COMPOUND)', () => {
      // React Flight delivers Option/OptionGroup written in a Server Component as lazy types.
      const ClientOption = asClientReference(Option);
      const ClientOptionGroup = asClientReference(OptionGroup);
      const plain = renderToString(
        <Combobox aria-label="Country" defaultValue="uk">
          <Option value="us">United States</Option>
          <OptionGroup label="Europe">
            <Option value="uk">United Kingdom</Option>
          </OptionGroup>
        </Combobox>,
      );
      const client = renderToString(
        <Combobox aria-label="Country" defaultValue="uk">
          <ClientOption value="us">United States</ClientOption>
          <ClientOptionGroup label="Europe">
            <ClientOption value="uk">United Kingdom</ClientOption>
          </ClientOptionGroup>
        </Combobox>,
      );
      expect(client).toBe(plain);
      const host = document.createElement('div');
      host.innerHTML = client;
      expect(host.querySelector('input[role="combobox"]')).toHaveAttribute(
        'value',
        'United Kingdom',
      );
    });

    it('clears when a controlled value becomes undefined (table-core#4)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderCombobox({ value: 'a' });
      expect(combobox()).toHaveValue('Apple');
      rerender(
        <Combobox aria-label="Fruit" value={undefined}>
          {FRUITS}
        </Combobox>,
      );
      expect(combobox()).toHaveValue('');
      expect(warn.mock.calls).toEqual([[CONTROLLED_TO_UNCONTROLLED]]);
    });
  });

  describe('options (input-pickers#1, #28)', () => {
    it('selects grouped options by click and by ArrowDown+Enter', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({
        onValueChange,
        children: (
          <>
            <OptionGroup label="Fruit">
              <Option value="a">Apple</Option>
            </OptionGroup>
            <OptionGroup label="Vegetables">
              <Option value="c">Carrot</Option>
              <Option value="p">Pea</Option>
            </OptionGroup>
          </>
        ),
      });
      await user.click(combobox());
      const group = screen.getByRole('group', { name: 'Vegetables' });
      await user.click(within(group).getByRole('option', { name: 'Carrot' }));
      expect(onValueChange).toHaveBeenLastCalledWith('c');
      expect(combobox()).toHaveValue('Carrot');

      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith('p');
      expect(combobox()).toHaveValue('Pea');
    });

    it('keeps the 0.4 data-value attribute on each option (a consumer value wins)', async () => {
      const user = userEvent.setup();
      renderCombobox({
        children: (
          <>
            <Option value="a">Apple</Option>
            <Option value="b" data-value="custom">
              Beta
            </Option>
          </>
        ),
      });
      await user.click(combobox());
      expect(option('Apple')).toHaveAttribute('data-value', 'a');
      expect(option('Beta')).toHaveAttribute('data-value', 'custom');
    });

    it('ignores clicks on disabled options and skips them with the keyboard', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderCombobox({
        onValueChange,
        children: (
          <>
            <Option value="a" disabled>
              Apple
            </Option>
            <Option value="b">Beta</Option>
          </>
        ),
      });
      await user.click(combobox());
      await user.click(option('Apple'));
      expect(onValueChange).not.toHaveBeenCalled();
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Beta');
    });

    it('re-sorts keyed options that are reordered (outside StrictMode)', async () => {
      const user = userEvent.setup();
      const make = (order: string[]) => (
        <Combobox aria-label="Fruit">
          {order.map((v) => (
            <Option key={v} value={v}>
              {v.toUpperCase()}
            </Option>
          ))}
        </Combobox>
      );
      const { rerender } = render(make(['a', 'b', 'c']));
      rerender(make(['c', 'a', 'b']));
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('C');
    });
  });

  describe('value callbacks (input-basic#29)', () => {
    it('onValueChange fires on change only; the deprecated onOptionSelect on every activation', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOptionSelect = vi.fn();
      renderCombobox({ defaultValue: 'a', onValueChange, onOptionSelect });
      await user.click(combobox());
      await user.click(option('Apple'));
      expect(onOptionSelect).toHaveBeenCalledWith('a');
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(combobox());
      await user.click(option('Beta'));
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(onOptionSelect).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls).toEqual([[DEPRECATED_ON_OPTION_SELECT]]);
    });

    it('warns once that onOptionSelect is deprecated', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderCombobox({ onOptionSelect: () => {} });
      rerender(
        <Combobox aria-label="Fruit" onOptionSelect={() => {}}>
          {FRUITS}
        </Combobox>,
      );
      expect(warn.mock.calls).toEqual([[DEPRECATED_ON_OPTION_SELECT]]);
    });

    it('fires the value callback exactly once per selection in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Combobox aria-label="Fruit" onValueChange={onValueChange}>
            {FRUITS}
          </Combobox>
        </React.StrictMode>,
      );
      await user.click(combobox());
      await user.click(option('Cherry'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('popup (overlays#1, #36, input-pickers#12, input-datetime#2)', () => {
    it('renders the closed list inline and hidden, and the open list in a portal', async () => {
      const user = userEvent.setup();
      const { container } = renderCombobox();
      const inline = container.querySelector('[role="listbox"]');
      expect(inline).not.toBeVisible();
      await user.click(combobox());
      expect(container.querySelector('[role="listbox"]')).toBeNull();
      expect(screen.getByRole('listbox').closest('[data-wave-portal]')).not.toBeNull();
    });

    it.each([
      ['a defaultOpen', { defaultOpen: true }],
      ['an open', { open: true }],
    ])('renders %s list closed on the server, so every referenced id exists', (_label, props) => {
      const serverHtml = renderToString(
        <Combobox aria-label="Fruit" defaultValue="a" {...props}>
          {FRUITS}
        </Combobox>,
      );
      expect(findDanglingIdRefsInHtml(serverHtml)).toEqual([]);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = serverHtml;
      const input = parsed.querySelector('input[role="combobox"]');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(parsed.querySelector('[role="listbox"]')).toHaveAttribute('hidden');
    });

    it.each([
      ['defaultOpen', { defaultOpen: true }],
      ['open', { open: true }],
    ])(
      'opens once hydrated (%s), without a mismatch or an onOpenChange call',
      async (_l, props) => {
        const onOpenChange = vi.fn();
        const element = (
          <Combobox aria-label="Fruit" defaultValue="a" {...props} onOpenChange={onOpenChange}>
            {FRUITS}
          </Combobox>
        );
        const container = document.createElement('div');
        container.innerHTML = renderToString(element);
        document.body.appendChild(container);
        const error = vi.spyOn(console, 'error');
        let root: ReturnType<typeof hydrateRoot> | undefined;
        try {
          await act(async () => {
            root = hydrateRoot(container, element);
          });
          expect(error).not.toHaveBeenCalled();
          const listbox = screen.getByRole('listbox');
          expect(combobox()).toHaveAttribute('aria-expanded', 'true');
          expect(combobox()).toHaveAttribute('aria-controls', listbox.id);
          expect(within(listbox).getAllByRole('option')).toHaveLength(FRUITS.length);
          expect(onOpenChange).not.toHaveBeenCalled();
        } finally {
          act(() => root?.unmount());
          container.remove();
        }
      },
    );

    it('closes on a press outside and when focus leaves', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Combobox aria-label="Fruit">{FRUITS}</Combobox>
          <p>Outside</p>
          <button type="button">Elsewhere</button>
        </>,
      );
      await user.click(combobox());
      await user.click(screen.getByText('Outside'));
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      await user.click(combobox());
      await act(async () => screen.getByRole('button', { name: 'Elsewhere' }).focus());
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('Escape closes only the listbox inside a parent layer; a second Escape reaches the parent', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <Combobox aria-label="Fruit" defaultValue="a">
            {FRUITS}
          </Combobox>
        </ParentLayer>,
      );
      await user.click(combobox());
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
      expect(combobox()).toHaveValue('Apple');
    });

    it('leaves Escape to the parent layer while no list is shown (no options)', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <Combobox aria-label="Fruit" onOpenChange={onOpenChange}>
            {[]}
          </Combobox>
        </ParentLayer>,
      );
      await user.click(combobox());
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('treats an open list without options as closed: Escape clears freeform text', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <Combobox aria-label="Fruit" freeform defaultValue="kiwi">
            {[]}
          </Combobox>
        </ParentLayer>,
      );
      await user.click(combobox());
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveValue('');
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });

    it('scrolls the active option into view', async () => {
      const user = userEvent.setup();
      renderCombobox();
      combobox().focus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      const scroll = vi.mocked(Element.prototype.scrollIntoView);
      expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
      expect(scroll.mock.contexts.at(-1)).toBe(option('Beta'));
    });
  });

  describe('read-only (input-basic#1)', () => {
    it('neither opens nor commits from the mouse or the keyboard', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      renderCombobox({ readOnly: true, defaultValue: 'b', onValueChange, onOpenChange });
      expect(combobox()).toHaveAttribute('readonly');
      await user.click(combobox());
      await user.keyboard('{ArrowDown}{Enter}{ArrowUp}{Alt>}{ArrowDown}{/Alt}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(combobox()).toHaveValue('Beta');
    });

    it('keeps a freeform value on Escape and leaves the key to the parent layer', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      const onValueChange = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <Combobox
            aria-label="Fruit"
            freeform
            readOnly
            defaultValue="kiwi"
            onValueChange={onValueChange}
          >
            {FRUITS}
          </Combobox>
        </ParentLayer>,
      );
      combobox().focus();
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveValue('kiwi');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not show a controlled open list', () => {
      renderCombobox({ readOnly: true, open: true });
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it.each([
      ['readOnly', { readOnly: true }],
      ['disabled', { disabled: true }],
    ] as const)(
      'reports no close for a defaultOpen list that starts %s (it was never shown)',
      (_, lock) => {
        const onOpenChange = vi.fn();
        const { rerender } = renderCombobox({ defaultOpen: true, onOpenChange, ...lock });
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        rerender(
          <Combobox aria-label="Fruit" defaultOpen onOpenChange={onOpenChange}>
            {FRUITS}
          </Combobox>,
        );
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['readOnly', { readOnly: true }],
      ['disabled', { disabled: true }],
    ] as const)(
      'drops the typed text when %s turns on while typing (input-pickers#7)',
      async (_, lock) => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const onOpenChange = vi.fn();
        const props = { defaultValue: 'a', onValueChange, onOpenChange };
        const { rerender } = render(
          <Combobox aria-label="Fruit" {...props}>
            {FRUITS}
          </Combobox>,
        );
        await user.click(combobox());
        await user.clear(combobox());
        await user.type(combobox(), 'be');
        expect(combobox()).toHaveValue('be');
        rerender(
          <Combobox aria-label="Fruit" {...props} {...lock}>
            {FRUITS}
          </Combobox>,
        );
        expect(combobox()).toHaveValue('Apple');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        // Locking closes the list for real (input-pickers#7 review).
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        const openChangeCalls = onOpenChange.mock.calls.length;
        act(() => combobox().blur());
        rerender(
          <Combobox aria-label="Fruit" {...props}>
            {FRUITS}
          </Combobox>,
        );
        // Unlocking again brings back neither the old text (or its filter) nor the open list.
        expect(combobox()).toHaveValue('Apple');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onOpenChange).toHaveBeenCalledTimes(openChangeCalls);
        expect(onValueChange).not.toHaveBeenCalled();
        // The next open request opens it again.
        await user.click(combobox());
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
        expect(onOpenChange).toHaveBeenLastCalledWith(true);
      },
    );

    it('does not block form submission while read-only and required (input-basic#12)', () => {
      render(
        <form aria-label="Order">
          <Combobox aria-label="Fruit" name="fruit" required readOnly>
            {FRUITS}
          </Combobox>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      // A native readonly input is barred from constraint validation; the user could not fix it.
      expect(form.checkValidity()).toBe(true);
      expect(combobox()).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Field and routing (input-basic#1)', () => {
    it('is labelled and described by its Field', () => {
      renderWithFieldContext(<Combobox>{FRUITS}</Combobox>, {
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

    it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
      renderWithFieldContext(
        <form aria-label="Form">
          <Combobox required={false}>{FRUITS}</Combobox>
        </form>,
        { required: true },
      );
      const control = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(control).not.toHaveAttribute('aria-required', 'true');
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });

    it('blocks submission inside a required Field until an option is chosen', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(
        <form aria-label="Form">
          <Combobox>{FRUITS}</Combobox>
        </form>,
        { required: true },
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      // Natively required through the Field alone: no own `required` and no `name`.
      expect(form.checkValidity()).toBe(false);
      await user.click(combobox(FIELD_TEST_TEXT.label));
      await user.click(option('Beta'));
      expect(form.checkValidity()).toBe(true);
    });

    it('names its open listbox after the Field label', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(<Combobox>{FRUITS}</Combobox>);
      await user.click(combobox(FIELD_TEST_TEXT.label));
      expect(screen.getByRole('listbox', { name: FIELD_TEST_TEXT.label })).toBeInTheDocument();
    });

    it('is labelled through aria-labelledby when it carries its own id', () => {
      renderWithFieldContext(<Combobox id="own">{FRUITS}</Combobox>);
      expect(screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label })).toHaveAttribute(
        'id',
        'own',
      );
    });

    it('routes id, aria and input props to the input and keeps data-* and ref on the root', () => {
      const ref = React.createRef<HTMLDivElement>();
      const controlRef = React.createRef<HTMLInputElement>();
      const onFocus = vi.fn();
      render(
        <Combobox
          ref={ref}
          controlRef={controlRef}
          id="fruit"
          aria-label="Fruit"
          aria-describedby="help"
          maxLength={10}
          onFocus={onFocus}
          data-testid="root"
        >
          {FRUITS}
        </Combobox>,
      );
      expect(combobox()).toHaveAttribute('id', 'fruit');
      expect(combobox()).toHaveAttribute('aria-describedby', 'help');
      expect(combobox()).toHaveAttribute('maxlength', '10');
      expect(controlRef.current).toBe(combobox());
      expect(ref.current).toBe(screen.getByTestId('root'));
      act(() => combobox().focus());
      expect(onFocus).toHaveBeenCalled();
    });

    it('routes the text input attributes autoCapitalize and autoCorrect to the input', () => {
      render(
        <Combobox aria-label="Fruit" autoCapitalize="none" autoCorrect="off" data-testid="root">
          {FRUITS}
        </Combobox>,
      );
      expect(combobox()).toHaveAttribute('autocapitalize', 'none');
      expect(combobox()).toHaveAttribute('autocorrect', 'off');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocapitalize');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocorrect');
    });

    it('turns browser autocomplete off unless the consumer sets it', () => {
      const { unmount } = renderCombobox();
      expect(combobox()).toHaveAttribute('autocomplete', 'off');
      unmount();
      renderCombobox({ autoComplete: 'on' });
      expect(combobox()).toHaveAttribute('autocomplete', 'on');
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
          <Combobox aria-label="Fruit" name="fruit" defaultValue="c">
            {FRUITS}
          </Combobox>
          <button type="submit">Send</button>
        </form>,
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.get('fruit')).toBe('c');
    });

    it('resets to its default value with the form (also without name)', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Order">
          <Combobox aria-label="Fruit" defaultValue="a">
            {FRUITS}
          </Combobox>
          <button type="reset">Reset</button>
        </form>,
      );
      await user.click(combobox());
      await user.click(option('Cherry'));
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(combobox()).toHaveValue('Apple');
    });

    it('blocks submission while required and empty', () => {
      render(
        <form aria-label="Order">
          <Combobox aria-label="Fruit" name="fruit" required>
            {FRUITS}
          </Combobox>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
      expect(combobox()).toHaveAttribute('aria-required', 'true');
    });

    it('is neither validated nor submitted while disabled, like a native control', () => {
      render(
        <form aria-label="Order">
          <Combobox aria-label="Fruit" name="fruit" required disabled>
            {FRUITS}
          </Combobox>
          <Combobox aria-label="Snack" name="snack" required disabled defaultValue="a">
            {FRUITS}
          </Combobox>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
      const data = new FormData(form);
      expect(data.get('fruit')).toBeNull();
      expect(data.get('snack')).toBeNull();
    });
  });

  describe('expand button', () => {
    function expandButton(name = 'Show options') {
      return screen.getByRole('button', { name });
    }

    it('wraps the input with its buttons; the root keeps the status region and the hidden input', () => {
      const { container } = render(
        <Combobox aria-label="Fruit" name="fruit" defaultValue="a" clearable data-testid="root">
          {FRUITS}
        </Combobox>,
      );
      const root = screen.getByTestId('root');
      const wrapper = combobox().parentElement as HTMLElement;
      expect(wrapper.parentElement).toBe(root);
      expect(wrapper.tagName).toBe('DIV');
      expect(wrapper).toHaveClass('relative', 'flex', 'items-center');
      expect(
        within(wrapper)
          .getAllByRole('button')
          .map((b) => b.getAttribute('aria-label')),
      ).toEqual(['Clear selection', 'Show options']);
      expect(screen.getByRole('status').parentElement).toBe(root);
      expect(container.querySelector('input[name="fruit"]')?.parentElement).toBe(root);
    });

    it('toggles the list and keeps focus in the input', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderCombobox({ onOpenChange });
      await user.click(expandButton());
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(combobox()).toHaveFocus();
      await user.click(expandButton());
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox()).toHaveFocus();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('follows the list with aria-expanded and aria-controls', async () => {
      const user = userEvent.setup();
      renderCombobox();
      expect(expandButton()).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton()).not.toHaveAttribute('aria-controls');
      await user.click(expandButton());
      expect(expandButton()).toHaveAttribute('aria-expanded', 'true');
      expect(expandButton()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
      // A filter that matches nothing shows no list.
      await user.type(combobox(), 'zz');
      expect(expandButton()).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton()).not.toHaveAttribute('aria-controls');
    });

    it('is not a tab stop (Alt+ArrowDown opens the list from the keyboard)', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Combobox aria-label="Fruit">{FRUITS}</Combobox>
          <button type="button">Next</button>
        </>,
      );
      expect(expandButton()).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(combobox()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(combobox()).toHaveFocus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('is disabled while the combobox is disabled or read-only', () => {
      const { rerender } = renderCombobox({ disabled: true });
      expect(expandButton()).toBeDisabled();
      rerender(
        <Combobox aria-label="Fruit" readOnly>
          {FRUITS}
        </Combobox>,
      );
      expect(expandButton()).toBeDisabled();
    });

    it('turns its glyph while the list is open, without motion when reduced', async () => {
      const user = userEvent.setup();
      renderCombobox();
      const glyph = () => expandButton().firstElementChild;
      expect(glyph()).toHaveAttribute('aria-hidden', 'true');
      expect(glyph()).toHaveClass('transition-transform', 'motion-reduce:transition-none');
      expect(glyph()).not.toHaveClass('rotate-180');
      expect(glyph()?.querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
      await user.click(expandButton());
      expect(glyph()).toHaveClass('rotate-180');
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('keeps the chevron with expandIcon %s', (_label, expandIcon) => {
      renderCombobox({ expandIcon });
      expect(expandButton().querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
    });

    it.each([
      ['false', false],
      ['true', true],
      ['an empty string', ''],
      ['an empty array', []],
      ['an empty Fragment', <></>],
    ])('hides the button with expandIcon %s (renders nothing)', (_label, expandIcon) => {
      renderCombobox({ expandIcon });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(combobox().className).not.toMatch(/\bpe-/);
    });

    it('renders custom content as the decorative glyph of the built-in button', () => {
      renderCombobox({ expandIcon: <svg data-testid="caret" /> });
      const caret = screen.getByTestId('caret');
      expect(caret.closest('button')).toBe(expandButton());
      expect(caret.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(expandButton()).toHaveAccessibleName('Show options');
    });

    it.each([
      [
        'a <button>',
        <button key="native" type="button" aria-label="Open">
          ▾
        </button>,
      ],
      ['a Button', <Button key="wave">▾</Button>],
    ])(
      'does not nest %s passed as expandIcon: its children become the glyph (warns once)',
      async (_label, expandIcon) => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderCombobox({ expandIcon });
        expect(document.querySelectorAll('button')).toHaveLength(1);
        expect(expandButton()).toHaveTextContent('▾');
        expect(expandButton()).toHaveAttribute('tabindex', '-1');
        await user.click(expandButton());
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(warn.mock.calls).toEqual([[EXPAND_ICON_BUTTON]]);
      },
    );

    it.each([
      ["{ as: 'button' }", 'button'],
      ['{ as: Button }', Button],
    ] as const)(
      'does not nest a slot object %s passed as expandIcon: its children become the glyph (warns once)',
      (_label, as) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderCombobox({ expandIcon: { as, children: '▾', className: 'text-error' } });
        expect(document.querySelectorAll('button')).toHaveLength(1);
        expect(expandButton()).toHaveTextContent('▾');
        expect(expandButton().querySelector('.text-error')).toBeNull();
        expect(warn.mock.calls).toEqual([[EXPAND_ICON_BUTTON_SLOT]]);
      },
    );

    it('keeps the chevron for a button element without content (warns once)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderCombobox({ expandIcon: <button type="button" /> });
      expect(document.querySelectorAll('button')).toHaveLength(1);
      expect(expandButton().querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
      expect(warn.mock.calls).toEqual([[EXPAND_ICON_BUTTON]]);
    });
  });

  describe('clear button', () => {
    function clearButton(name = 'Clear selection') {
      return screen.getByRole('button', { name });
    }

    it('shows only while a value is selected', async () => {
      const user = userEvent.setup();
      renderCombobox({ clearable: true });
      expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
      await user.click(combobox());
      await user.click(option('Beta'));
      expect(clearButton()).toBeInTheDocument();
    });

    it('needs clearable, is not shown while read-only and is disabled while disabled', () => {
      const { rerender } = renderCombobox({ defaultValue: 'a' });
      expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
      rerender(
        <Combobox aria-label="Fruit" defaultValue="a" clearable readOnly>
          {FRUITS}
        </Combobox>,
      );
      expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
      rerender(
        <Combobox aria-label="Fruit" defaultValue="a" clearable disabled>
          {FRUITS}
        </Combobox>,
      );
      expect(clearButton()).toBeDisabled();
    });

    it('clears once in StrictMode, closes the list, focuses the input and empties the hidden input', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <form aria-label="Order">
            <Combobox
              aria-label="Fruit"
              name="fruit"
              defaultValue="b"
              clearable
              onValueChange={onValueChange}
              onOpenChange={onOpenChange}
            >
              {FRUITS}
            </Combobox>
          </form>
        </React.StrictMode>,
      );
      await user.click(combobox());
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.click(clearButton());
      expect(onValueChange.mock.calls).toEqual([['']]);
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
      expect(combobox()).toHaveValue('');
      expect(combobox()).toHaveFocus();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(new FormData(form).get('fruit')).toBe('');
    });

    it('drops a typed filter when it clears', async () => {
      const user = userEvent.setup();
      renderCombobox({ defaultValue: 'a', clearable: true });
      await user.clear(combobox());
      await user.type(combobox(), 'ch');
      await user.click(clearButton());
      expect(combobox()).toHaveValue('');
      await user.click(combobox());
      expect(visibleOptions()).toEqual(['Apple', 'Beta', 'Cherry']);
    });

    it('freeform: clears the typed text without calling the deprecated onOptionSelect', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onValueChange = vi.fn();
      const onOptionSelect = vi.fn();
      renderCombobox({ freeform: true, clearable: true, onValueChange, onOptionSelect });
      await user.type(combobox(), 'kiwi');
      onValueChange.mockClear();
      onOptionSelect.mockClear();
      await user.click(clearButton());
      expect(onValueChange.mock.calls).toEqual([['']]);
      expect(onOptionSelect).not.toHaveBeenCalled();
      expect(combobox()).toHaveValue('');
      expect(combobox()).toHaveFocus();
      expect(warn.mock.calls).toEqual([[DEPRECATED_ON_OPTION_SELECT]]);
    });

    it('is a tab stop after the input and clears from the keyboard', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <Combobox aria-label="Fruit" defaultValue="a" clearable onValueChange={onValueChange}>
            {FRUITS}
          </Combobox>
          <button type="button">Next</button>
        </>,
      );
      await user.tab();
      expect(combobox()).toHaveFocus();
      await user.tab();
      expect(clearButton()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(clearButton()).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onValueChange.mock.calls).toEqual([['']]);
      expect(combobox()).toHaveFocus();
    });

    it('localizes the names of both buttons with labels', () => {
      const labels: ComboboxLabels = { clear: 'Auswahl löschen', expand: 'Optionen anzeigen' };
      renderCombobox({ defaultValue: 'a', clearable: true, labels });
      expect(screen.getByRole('button', { name: 'Auswahl löschen' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Optionen anzeigen' })).toBeInTheDocument();
    });

    it.each([
      ['the chevron', {}, 'pe-8'],
      ['the chevron and the clear button', { clearable: true }, 'pe-14'],
      ['only the clear button', { clearable: true, expandIcon: false }, 'pe-8'],
    ])('pads the input for %s', (_label, props, padding) => {
      renderCombobox({ defaultValue: 'a', ...props });
      expect(combobox()).toHaveClass(padding);
    });

    it('places both buttons with logical classes in RTL', () => {
      renderWithProviders(
        <Combobox aria-label="Fruit" defaultValue="a" clearable>
          {FRUITS}
        </Combobox>,
        { dir: 'rtl' },
      );
      expect(clearButton()).toHaveClass('absolute', 'end-7', 'h-6', 'w-6');
      expect(screen.getByRole('button', { name: 'Show options' })).toHaveClass('absolute', 'end-1');
      for (const element of [clearButton(), screen.getByRole('button', { name: 'Show options' })]) {
        expect(element.className).not.toMatch(/\b(left|right)-/);
      }
      expect(combobox().className).not.toMatch(/\bp[lr]-/);
      renderWithProviders(
        <Combobox aria-label="Snack" defaultValue="a" clearable expandIcon={false}>
          {FRUITS}
        </Combobox>,
        { dir: 'rtl' },
      );
      expect(screen.getAllByRole('button', { name: 'Clear selection' })[1]).toHaveClass('end-1');
    });

    it('gives both buttons their own padding, background and focus ring (C-NATIVE, C-FOCUS)', () => {
      renderCombobox({ defaultValue: 'a', clearable: true });
      for (const element of [clearButton(), screen.getByRole('button', { name: 'Show options' })]) {
        expect(element).toHaveClass(
          'p-0',
          'bg-transparent',
          'focus-visible:outline-2',
          'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
        );
      }
    });
  });

  describe('field look', () => {
    it('draws the field boundary with the accessible bottom stroke (WCAG 1.4.11)', () => {
      renderCombobox();
      expect(combobox()).toHaveClass(
        'border',
        'border-input',
        'border-b-stroke-accessible',
        'focus:border-b-primary',
      );
      expect(combobox()).not.toHaveClass('border-destructive');
    });

    it.each([
      ['its own aria-invalid', () => renderCombobox({ 'aria-invalid': true })],
      [
        'a Field error',
        () =>
          renderWithFieldContext(<Combobox>{FRUITS}</Combobox>, {
            errorId: FIELD_TEST_IDS.errorId,
          }),
      ],
    ])('shows the destructive border while invalid through %s', (_, renderInvalid) => {
      renderInvalid();
      const control = screen.getByRole('combobox');
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveClass('border', 'border-destructive', 'focus:border-b-destructive');
      for (const replaced of [
        'border-input',
        'border-b-stroke-accessible',
        'focus:border-b-primary',
      ]) {
        expect(control).not.toHaveClass(replaced);
      }
    });

    it('keeps the valid look when its own aria-invalid={false} overrides an invalid Field', () => {
      renderWithFieldContext(<Combobox aria-invalid={false}>{FRUITS}</Combobox>, {
        errorId: FIELD_TEST_IDS.errorId,
      });
      const control = screen.getByRole('combobox');
      expect(control).toHaveAttribute('aria-invalid', 'false');
      expect(control).toHaveClass('border-input', 'border-b-stroke-accessible');
      expect(control).not.toHaveClass('border-destructive');
    });
  });

  it('keeps a consumer option class next to the state classes (input-pickers#20)', async () => {
    const user = userEvent.setup();
    renderCombobox({
      children: (
        <Option value="a" className="data-[active]:bg-selected">
          Apple
        </Option>
      ),
    });
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(option('Apple')).toHaveAttribute('data-active');
    // The built-in active state only sets `--option-bg`, read by the unconditional
    // `bg-(--option-bg)`; the consumer's variant out-specifies that reader.
    expect(option('Apple')).toHaveClass(
      'bg-(--option-bg)',
      'data-[active]:[--option-bg:var(--wave-subtle-hover)]',
      'data-[active]:bg-selected',
    );
  });

  it('lets a plain consumer option background win while selected and active (input-pickers#20)', async () => {
    const user = userEvent.setup();
    renderCombobox({
      defaultValue: 'a',
      children: (
        <Option value="a" className="bg-primary text-primary-foreground">
          Apple
        </Option>
      ),
    });
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    const apple = option('Apple');
    expect(apple).toHaveAttribute('data-selected');
    expect(apple).toHaveAttribute('data-active');
    // No state variant sets a background, and tailwind-merge dropped the built-in reader: the
    // consumer's plain class is the option's only background.
    const backgrounds = [...apple.classList].filter((c) => /(?:^|:)bg-/.test(c));
    expect(backgrounds).toEqual(['bg-primary']);
  });
});
