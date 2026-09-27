import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  Combobox,
  ComboboxOption,
  ComboboxOptionGroup,
  Option,
  OptionGroup,
  insertedText,
  type ComboboxLabels,
  type ComboboxProps,
} from '../Combobox';
import {
  asClientReference,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';
import { __getAnnouncerText, __resetAnnouncer } from '../../../hooks/useAnnounce';
import type { ListboxItem } from '../../../hooks/useListbox';
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
  return screen.getByRole<HTMLInputElement>('combobox', { name });
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

const FREEFORM_MULTISELECT =
  '[WaveUI] Combobox: `freeform` is not available with `multiselect`: a multi-select Combobox ' +
  'selects options only.';

const QUERY_FREEFORM =
  '[WaveUI] Combobox: `query` and `defaultQuery` are not used with `freeform`: the typed text is ' +
  'the value (`value`, `onValueChange`).';

afterEach(() => {
  vi.restoreAllMocks();
  __resetAnnouncer();
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

    it('calls onValueChange before the deprecated onOptionSelect (0.7 order)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const calls: string[] = [];
      renderCombobox({
        onValueChange: () => calls.push('onValueChange'),
        onOptionSelect: () => calls.push('onOptionSelect'),
      });
      await user.click(combobox());
      await user.click(option('Apple'));
      expect(calls).toEqual(['onValueChange', 'onOptionSelect']);
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

    it.each([
      [
        'erased filter text keeps the value, so Tab reaches the clear button',
        false,
        'Clear selection',
      ],
      ['erased freeform text clears the value as it is erased, so Tab moves on', true, 'Next'],
    ])('Tab from erased text never drops focus to <body>: %s', async (_label, freeform, name) => {
      const user = userEvent.setup();
      render(
        <>
          <Combobox aria-label="Fruit" defaultValue="a" clearable freeform={freeform}>
            {FRUITS}
          </Combobox>
          <button type="button">Next</button>
        </>,
      );
      await user.clear(combobox());
      await user.tab();
      expect(screen.getByRole('button', { name })).toHaveFocus();
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

  it('adds no announcer live region for a single-select Combobox (M2)', () => {
    renderCombobox();
    expect(document.querySelector('[data-wave-announcer]')).toBeNull();
  });

  describe('multiselect', () => {
    // The labels of the spec's examples ("Apple, Banana"); FRUITS above has Beta.
    const BASKET = [
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
    const ALL = ['Apple', 'Banana', 'Cherry', 'Date'];

    function renderMulti(props: Partial<ComboboxProps<true>> = {}) {
      return render(
        <Combobox aria-label="Fruit" multiselect {...props}>
          {BASKET}
        </Combobox>,
      );
    }

    /** Renders a multi-select Combobox after a button and moves focus into it with Tab, which
     * selects its text. */
    async function tabIntoMulti(props: Partial<ComboboxProps<true>> = {}) {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Combobox aria-label="Fruit" multiselect {...props}>
            {BASKET}
          </Combobox>
        </>,
      );
      await user.click(screen.getByRole('button', { name: 'Before' }));
      await user.tab();
      return user;
    }

    /** Leaves the input with Shift+Tab and comes back with Tab: the labels show again, selected. */
    async function reenter(user: ReturnType<typeof userEvent.setup>) {
      await user.tab({ shift: true });
      await user.tab();
    }

    /**
     * An edit the way a browser makes it: `beforeinput` while the selection it replaces is still in
     * place, then the new value and the `input` event that React's `onChange` reads.
     */
    function edit(input: HTMLInputElement, value: string, inputType: string, isComposing = false) {
      fireEvent(
        input,
        new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType, isComposing }),
      );
      fireEvent.input(input, { target: { value }, inputType, isComposing });
    }

    /**
     * Types `text` in place of the input's current selection, as a browser does (see `edit`), and
     * returns the value the browser wrote, so a test can tell whether the component rewrote it.
     */
    function typeAtSelection(
      input: HTMLInputElement,
      text: string,
      inputType: string,
      isComposing = false,
    ) {
      const { value, selectionStart, selectionEnd } = input;
      const written =
        value.slice(0, selectionStart ?? value.length) +
        text +
        value.slice(selectionEnd ?? value.length);
      edit(input, written, inputType, isComposing);
      return written;
    }

    function selection() {
      return [combobox().selectionStart, combobox().selectionEnd];
    }

    /** Flushes the frame the announcer's first write waits for (`src/hooks/useAnnounce.ts`), so a
     * synchronous read right after can be trusted either way. */
    async function flushAnnouncerFrame() {
      await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    }

    describe('the labels in the input (D11)', () => {
      it('shows the labels and no placeholder while values are selected', () => {
        render(
          <Combobox
            aria-label="Fruit"
            multiselect
            placeholder="Pick fruit"
            defaultValue={['a', 'b']}
          >
            {BASKET}
          </Combobox>,
        );
        expect(combobox()).toHaveValue('Apple, Banana');
        expect(combobox()).not.toHaveAttribute('placeholder');
      });

      it('shows the placeholder while no value is selected', () => {
        renderMulti({ placeholder: 'Pick fruit' });
        expect(combobox()).toHaveValue('');
        expect(combobox()).toHaveAttribute('placeholder', 'Pick fruit');
      });

      it('shows the placeholder while no selected value has an option, and submits the values', () => {
        const { container } = render(
          <form>
            <Combobox
              aria-label="Fruit"
              multiselect
              name="fruit"
              placeholder="Pick fruit"
              defaultValue={['zz']}
            >
              {BASKET}
            </Combobox>
          </form>,
        );
        expect(combobox()).toHaveValue('');
        expect(combobox()).toHaveAttribute('placeholder', 'Pick fruit');
        expect(new FormData(container.querySelector('form')!).getAll('fruit')).toEqual(['zz']);
      });

      it('joins the labels in selection order and leaves unknown values out', () => {
        renderMulti({ defaultValue: ['c', 'zz', 'a'] });
        expect(combobox()).toHaveValue('Cherry, Apple');
      });

      it('localizes the joined text with labels.selection', () => {
        renderMulti({ defaultValue: ['a', 'b'], labels: { selection: (l) => l.join('、') } });
        expect(combobox()).toHaveValue('Apple、Banana');
      });

      it('renders the labels and no placeholder on the server', () => {
        const html = renderToString(
          <Combobox
            aria-label="Fruit"
            multiselect
            placeholder="Pick fruit"
            defaultValue={['a', 'b']}
          >
            {BASKET}
          </Combobox>,
        );
        const host = document.createElement('div'); // detached: nothing reaches document.body
        host.innerHTML = html;
        const input = host.querySelector('input[role="combobox"]');
        expect(input).toHaveAttribute('value', 'Apple, Banana');
        expect(input).not.toHaveAttribute('placeholder');
      });

      it('truncates many labels without growing and keeps the whole text as the value', () => {
        const names = Array.from({ length: 30 }, (_, index) => `Fruit ${index + 1}`);
        const options = names.map((name, index) => (
          <Option key={name} value={String(index)}>
            {name}
          </Option>
        ));
        const single = render(
          <Combobox aria-label="Fruit" defaultValue="0">
            {options}
          </Combobox>,
        );
        const singleClasses = combobox().className;
        single.unmount();
        render(
          <Combobox
            aria-label="Fruit"
            multiselect
            defaultValue={names.map((_, index) => `${index}`)}
          >
            {options}
          </Combobox>,
        );
        expect(combobox()).toHaveValue(names.join(', '));
        // The one-line input of a single-select Combobox, full width and one row high: it clips
        // the text instead of growing.
        expect(combobox().className).toBe(singleClasses);
        expect(combobox()).toHaveClass('w-full', 'h-8');
      });
    });

    describe('focus selects the labels (D11 rule 1)', () => {
      it('selects the labels on Tab and on a click, so typing replaces them', async () => {
        const user = userEvent.setup();
        render(
          <>
            <button type="button">Before</button>
            <Combobox aria-label="Fruit" multiselect defaultValue={['a']}>
              {BASKET}
            </Combobox>
          </>,
        );
        await user.click(screen.getByRole('button', { name: 'Before' }));
        await user.tab();
        expect([combobox().selectionStart, combobox().selectionEnd]).toEqual([0, 'Apple'.length]);
        await user.keyboard('ch');
        expect(combobox()).toHaveValue('ch');
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cherry']);

        // A click that focuses the input selects the labels too (user-event puts the caret at the
        // end of the text on mousedown, before the focus).
        await user.click(screen.getByRole('button', { name: 'Before' }));
        expect(combobox()).toHaveValue('Apple');
        await user.click(combobox());
        expect([combobox().selectionStart, combobox().selectionEnd]).toEqual([0, 'Apple'.length]);
        await user.keyboard('d');
        expect(combobox()).toHaveValue('d');
      });

      it('keeps the selection on the mouseup of the press that focused the input, and only then', () => {
        const onMouseUp = vi.fn();
        renderMulti({ defaultValue: ['a'], onMouseUp });
        const input = combobox();
        // The press that focuses the input: a browser would drop the selection on its mouseup.
        fireEvent.mouseDown(input);
        act(() => input.focus());
        expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Apple'.length]);
        expect(fireEvent.mouseUp(input)).toBe(false);
        // A press in the focused input places the caret as usual.
        fireEvent.mouseDown(input);
        expect(fireEvent.mouseUp(input)).toBe(true);
        // The root keeps the consumer's mouse handlers (C-ROUTING): both mouseups reached it.
        expect(onMouseUp).toHaveBeenCalledTimes(2);
      });

      it('tells a press in the focused input apart inside a shadow root', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const container = document.createElement('div');
        host.attachShadow({ mode: 'open' }).appendChild(container);
        const { unmount } = render(
          <Combobox aria-label="Fruit" multiselect defaultValue={['a']}>
            {BASKET}
          </Combobox>,
          { container },
        );
        try {
          const input = container.querySelector('input')!;
          fireEvent.mouseDown(input);
          act(() => input.focus());
          expect(fireEvent.mouseUp(input)).toBe(false);
          // The document reports the shadow host as its focused element, not the input.
          expect(document.activeElement).toBe(host);
          fireEvent.mouseDown(input);
          expect(fireEvent.mouseUp(input)).toBe(true);
        } finally {
          unmount();
          host.remove();
        }
      });

      it('leaves the mouseup alone while no labels show', () => {
        renderMulti();
        const input = combobox();
        fireEvent.mouseDown(input);
        act(() => input.focus());
        expect(fireEvent.mouseUp(input)).toBe(true);
      });

      it('calls the consumer onFocus first; its preventDefault() skips the selection', async () => {
        const user = userEvent.setup();
        const onFocus = vi.fn((event: React.FocusEvent<HTMLInputElement>) =>
          event.preventDefault(),
        );
        renderMulti({ defaultValue: ['a'], onFocus });
        await user.click(combobox());
        expect(onFocus).toHaveBeenCalledTimes(1);
        // Where user-event's mousedown put the caret: the end of the text.
        expect([combobox().selectionStart, combobox().selectionEnd]).toEqual([5, 5]);
      });

      it('selects the labels when a click on the Field label focuses the input', async () => {
        const user = userEvent.setup();
        renderWithFieldContext(
          <Combobox multiselect defaultValue={['a', 'b']}>
            {BASKET}
          </Combobox>,
        );
        await user.click(screen.getByText(FIELD_TEST_TEXT.label));
        expect(combobox(FIELD_TEST_TEXT.label)).toHaveFocus();
        expect([
          combobox(FIELD_TEST_TEXT.label).selectionStart,
          combobox(FIELD_TEST_TEXT.label).selectionEnd,
        ]).toEqual([0, 'Apple, Banana'.length]);
      });

      it('selects the labels again when they return to the focused input: a toggle, Escape, a reset (R18)', async () => {
        const user = userEvent.setup();
        render(
          <form aria-label="Order">
            <Combobox aria-label="Fruit" multiselect defaultValue={['a', 'b']}>
              {BASKET}
            </Combobox>
          </form>,
        );
        await user.click(combobox());
        await user.click(option('Cherry'));
        expect(combobox()).toHaveValue('Apple, Banana, Cherry');
        expect(selection()).toEqual([0, 'Apple, Banana, Cherry'.length]);
        await user.keyboard('ch{Escape}');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(combobox()).toHaveValue('Apple, Banana, Cherry');
        expect(selection()).toEqual([0, 'Apple, Banana, Cherry'.length]);
        // A reset while the input keeps focus (a script, a shortcut) restores the default labels.
        await user.keyboard('x');
        const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
        act(() => form.reset());
        expect(combobox()).toHaveFocus();
        expect(combobox()).toHaveValue('Apple, Banana');
        expect(selection()).toEqual([0, 'Apple, Banana'.length]);
      });

      it('selects the labels again after a controlled change while the input has focus (R18)', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
          <Combobox aria-label="Fruit" multiselect value={['a']}>
            {BASKET}
          </Combobox>,
        );
        await user.click(combobox());
        await user.keyboard('{End}');
        expect(selection()).toEqual([5, 5]);
        rerender(
          <Combobox aria-label="Fruit" multiselect value={['a', 'b']}>
            {BASKET}
          </Combobox>,
        );
        expect(combobox()).toHaveValue('Apple, Banana');
        expect(selection()).toEqual([0, 'Apple, Banana'.length]);
      });

      it('keeps a caret placed in the labels: a press in the focused input selects nothing again', async () => {
        const user = await tabIntoMulti({ defaultValue: ['a', 'b'] });
        // The press opens the list (a render) and puts the caret after "Apple".
        await user.pointer({ keys: '[MouseLeft]', target: combobox(), offset: 5 });
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
        expect(selection()).toEqual([5, 5]);
        // A render that leaves the labels as they are keeps it too.
        await user.keyboard('{ArrowDown}');
        expect(activeOption()).toHaveTextContent('Apple');
        expect(selection()).toEqual([5, 5]);
      });

      it('keeps a composition started right after a toggle (R18)', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderMulti({ defaultValue: ['a'], onValueChange });
        await user.click(combobox());
        await user.click(option('Banana'));
        const input = combobox();
        fireEvent.compositionStart(input, { data: '' });
        // The composition replaces the selected labels, so the browser's text is the query as it
        // is: the component writes nothing into the input during the composition.
        const written = typeAtSelection(input, 'り', 'insertCompositionText', true);
        expect(written).toBe('り');
        expect(input).toHaveValue(written);
        fireEvent.compositionEnd(input, { data: 'り' });
        expect(input).toHaveValue('り');
        expect(onValueChange.mock.calls).toEqual([[['a', 'b']]]);
      });

      it('applies maxLength to the query, not to the labels', async () => {
        const user = userEvent.setup();
        renderMulti({ defaultValue: ['a', 'b'], maxLength: 10 });
        expect(combobox()).not.toHaveAttribute('maxlength');
        await user.click(combobox());
        await user.click(option('Cherry'));
        // After a toggle the labels (21 characters) are selected again: typing replaces them.
        await user.keyboard('ch');
        expect(combobox()).toHaveValue('ch');
        expect(combobox()).toHaveAttribute('maxlength', '10');
        // With the caret moved into the labels, typing inserts there: no limit stops it.
        await user.keyboard('{Escape}');
        act(() => combobox().setSelectionRange(7, 7));
        await user.keyboard('x');
        expect(combobox()).toHaveValue('x');
      });
    });

    describe('editing the labels (D11 rules 2 to 4)', () => {
      it('queries only the text an edit inserted into the labels', () => {
        render(
          <Combobox aria-label="Fruit" multiselect defaultValue={['a', 'b']}>
            {BASKET}
          </Combobox>,
        );
        fireEvent.change(combobox(), { target: { value: 'Apple, Cher Banana' } });
        expect(combobox()).toHaveValue('Cher ');
      });

      it('queries only the text typed where the caret was moved into the labels, or after them', async () => {
        const user = await tabIntoMulti({ defaultValue: ['a', 'b'] });
        act(() => combobox().setSelectionRange(7, 7));
        await user.keyboard('Ch');
        expect(combobox()).toHaveValue('Ch');
        expect(visibleOptions()).toEqual(['Cherry']);
        // A toggle shows the labels again, selected (R18); End puts the caret after them, so
        // typing adds to them.
        await user.click(option('Cherry'));
        expect(combobox()).toHaveValue('Apple, Banana, Cherry');
        await user.keyboard('{End}d');
        expect(combobox()).toHaveValue('d');
        expect(visibleOptions()).toEqual(['Date']);
      });

      it('queries only the text a drop inserts, although focus selected the labels', async () => {
        await tabIntoMulti({ defaultValue: ['a', 'b'] });
        // A drop inserts at the drop point, not in place of the selection.
        edit(combobox(), 'Apple, Cher Banana', 'insertFromDrop');
        expect(combobox()).toHaveValue('Cher ');
      });

      it('shows the labels again for a value equal to them (an undo)', () => {
        render(
          <Combobox aria-label="Fruit" multiselect defaultValue={['a']}>
            {BASKET}
          </Combobox>,
        );
        fireEvent.change(combobox(), { target: { value: 'x' } });
        fireEvent.change(combobox(), { target: { value: 'Apple' } });
        expect(combobox()).toHaveValue('Apple');
        // no query: every option shows
        expect(visibleOptions()).toEqual(ALL);
      });

      it.each(['historyUndo', 'historyRedo'])(
        'shows the labels again for %s back to them (R17)',
        async (inputType) => {
          const user = await tabIntoMulti({ defaultValue: ['a'] });
          await user.keyboard('x');
          expect(combobox()).toHaveValue('x');
          edit(combobox(), 'Apple', inputType);
          expect(combobox()).toHaveValue('Apple');
          expect(visibleOptions()).toEqual(ALL);
        },
      );

      it('keeps typed text equal to the labels as the query: the option stays active and Enter toggles it (R17)', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
        render(
          <form aria-label="Order" onSubmit={onSubmit}>
            <button type="button">Before</button>
            <Combobox
              aria-label="Fruit"
              multiselect
              defaultValue={['a']}
              onValueChange={onValueChange}
            >
              {BASKET}
            </Combobox>
            <button type="submit">Send</button>
          </form>,
        );
        await user.click(screen.getByRole('button', { name: 'Before' }));
        await user.tab();
        await user.keyboard('Appl');
        expect(activeOption()).toHaveTextContent('Apple');
        await user.keyboard('e');
        expect(combobox()).toHaveValue('Apple');
        expect(visibleOptions()).toEqual(['Apple']);
        expect(activeOption()).toHaveTextContent('Apple');
        await user.keyboard('{Enter}');
        expect(onSubmit).not.toHaveBeenCalled();
        expect(onValueChange.mock.calls).toEqual([[[]]]);
      });

      it('uses the selection a beforeinput reported only for the change it announced', async () => {
        await tabIntoMulti({ defaultValue: ['a', 'b'] });
        // An edit announced over the selected labels and then not made (cancelled, blocked)…
        fireEvent(
          combobox(),
          new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
          }),
        );
        // …leaves nothing for a change no beforeinput announced (autofill, an extension): only the
        // inserted text is the query.
        fireEvent.change(combobox(), { target: { value: 'Apple, Cher Banana' } });
        expect(combobox()).toHaveValue('Cher ');
      });

      it('takes no selection from an undo or a redo: it restores text, it does not replace the selection', async () => {
        await tabIntoMulti({ defaultValue: ['a', 'b'] });
        edit(combobox(), 'Apple, Cher Banana', 'historyRedo');
        expect(combobox()).toHaveValue('Cher ');
      });

      it('replaces the selected labels with text that begins or ends like them', async () => {
        const onValueChange = vi.fn();
        const user = await tabIntoMulti({ defaultValue: ['a', 'b'], onValueChange });
        // "a" is the last letter of "Apple, Banana": the edit replaced all of it, so the query is
        // all of the new text.
        await user.keyboard('a');
        expect(combobox()).toHaveValue('a');
        expect(visibleOptions()).toEqual(['Apple', 'Banana', 'Date']);
        await reenter(user);
        await user.paste('Banana');
        expect(combobox()).toHaveValue('Banana');
        expect(visibleOptions()).toEqual(['Banana']);
        await reenter(user);
        const input = combobox();
        fireEvent.compositionStart(input, { data: '' });
        // The composition's text stays as the browser wrote it: rewriting the value would end it.
        edit(input, 'A', 'insertCompositionText', true);
        expect(input).toHaveValue('A');
        edit(input, 'Ap', 'insertCompositionText', true);
        fireEvent.compositionEnd(input, { data: 'Ap' });
        expect(input).toHaveValue('Ap');
        expect(visibleOptions()).toEqual(['Apple']);
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('never removes a value with Backspace, Delete or cut', async () => {
        const onValueChange = vi.fn();
        const user = await tabIntoMulti({ defaultValue: ['a', 'b'], onValueChange });
        // Over the selected labels: the query is empty, and the input shows it.
        await user.keyboard('{Backspace}');
        expect(combobox()).toHaveValue('');
        expect(visibleOptions()).toEqual(ALL);
        // Escape shows the labels again, selected (R18): Backspace erases them into an empty query.
        await user.keyboard('{Escape}');
        expect(combobox()).toHaveValue('Apple, Banana');
        await user.keyboard('{Backspace}');
        expect(combobox()).toHaveValue('');
        // With the caret after the labels or before them, Backspace or Delete empty the query too.
        await user.keyboard('{Escape}{End}{Backspace}');
        expect(combobox()).toHaveValue('');
        await user.keyboard('{Escape}{Home}{Delete}');
        expect(combobox()).toHaveValue('');
        await reenter(user);
        await user.keyboard('{Delete}');
        expect(combobox()).toHaveValue('');
        await reenter(user);
        await user.cut();
        expect(combobox()).toHaveValue('');
        await user.tab({ shift: true });
        expect(combobox()).toHaveValue('Apple, Banana');
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('handles paste and composition over the labels', async () => {
        const onValueChange = vi.fn();
        const user = await tabIntoMulti({ defaultValue: ['a', 'b'], onValueChange });
        await user.paste('Ch');
        expect(combobox()).toHaveValue('Ch');
        expect(visibleOptions()).toEqual(['Cherry']);
        await reenter(user);
        const input = combobox();
        fireEvent.compositionStart(input, { data: '' });
        edit(input, 'd', 'insertCompositionText', true);
        expect(input).toHaveValue('d');
        edit(input, 'da', 'insertCompositionText', true);
        fireEvent.compositionEnd(input, { data: 'da' });
        expect(input).toHaveValue('da');
        expect(visibleOptions()).toEqual(['Date']);
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('shows the labels while read-only and edits nothing', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderMulti({ readOnly: true, defaultValue: ['a', 'b'], onValueChange });
        expect(combobox()).toHaveValue('Apple, Banana');
        await user.click(combobox());
        await user.keyboard('ch{Enter}{Backspace}{ArrowDown}{Enter}');
        expect(combobox()).toHaveValue('Apple, Banana');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(onValueChange).not.toHaveBeenCalled();
      });
    });

    describe('toggles and closing (D10)', () => {
      it('clears the query after a toggle and keeps the list open', async () => {
        const user = userEvent.setup();
        render(
          <Combobox aria-label="Fruit" multiselect>
            {BASKET}
          </Combobox>,
        );
        await user.click(combobox());
        await user.keyboard('ch{Enter}');
        expect(combobox()).toHaveValue('Cherry');
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
        // Every option shows again; the toggled one stays active.
        expect(visibleOptions()).toEqual(ALL);
        expect(activeOption()).toHaveTextContent('Cherry');
        await user.click(option('Apple'));
        expect(combobox()).toHaveValue('Cherry, Apple');
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      });

      it('toggles with Enter and a click, not with Space, in a multiselectable list', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderMulti({ onValueChange });
        await user.click(combobox());
        await user.click(option('Apple'));
        await user.keyboard('{ArrowDown}{Enter}');
        expect(onValueChange.mock.calls).toEqual([[['a']], [['a', 'b']]]);
        expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
        expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
        expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
        expect(option('Cherry')).toHaveAttribute('aria-selected', 'false');
        expect(option('Cherry').querySelector('[data-wave-option-box]')).not.toBeNull();
        // Space is text in an editable combobox: it starts a query, it toggles nothing.
        await user.keyboard(' ');
        expect(onValueChange).toHaveBeenCalledTimes(2);
      });

      it('closes without committing on Tab, Escape and Alt+ArrowUp', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
          <>
            <Combobox aria-label="Fruit" multiselect onValueChange={onValueChange}>
              {BASKET}
            </Combobox>
            <button type="button">Next</button>
          </>,
        );
        await user.click(combobox());
        await user.keyboard('{ArrowDown}{Alt>}{ArrowUp}{/Alt}');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(onValueChange).not.toHaveBeenCalled();

        await user.keyboard('{ArrowDown}{Escape}');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(onValueChange).not.toHaveBeenCalled();

        await user.keyboard('{ArrowDown}');
        expect(activeOption()).toHaveTextContent('Apple');
        await user.tab();
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('shows the labels again on blur and close', async () => {
        const user = userEvent.setup();
        render(
          <>
            <Combobox aria-label="Fruit" multiselect defaultValue={['a', 'b']}>
              {BASKET}
            </Combobox>
            <button type="button">Next</button>
            <p>Outside</p>
          </>,
        );
        await user.click(combobox());
        await user.keyboard('ch');
        await user.keyboard('{Escape}');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(combobox()).toHaveValue('Apple, Banana');
        await user.keyboard('x');
        expect(combobox()).toHaveValue('x');
        await user.click(screen.getByText('Outside'));
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(combobox()).toHaveValue('Apple, Banana');
        await user.click(combobox());
        await user.keyboard('ch');
        await user.tab();
        expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
        expect(combobox()).toHaveValue('Apple, Banana');
      });

      it('shows the labels again on a blur alone (a list the parent keeps closed)', async () => {
        const user = await tabIntoMulti({ defaultValue: ['a', 'b'], open: false });
        await user.keyboard('ch');
        expect(combobox()).toHaveValue('ch');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        await user.tab({ shift: true });
        expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
        expect(combobox()).toHaveValue('Apple, Banana');
        // Labels that return to an input without focus are not selected (the caret where writing
        // the value left it): only a focused input selects them (R18).
        expect(selection()).toEqual([13, 13]);
      });

      it('clears every value, drops the query, closes the list and focuses the input', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderMulti({ defaultValue: ['a', 'b'], clearable: true, onValueChange });
        await user.click(combobox());
        await user.keyboard('ch');
        expect(combobox()).toHaveValue('ch');
        await user.click(screen.getByRole('button', { name: 'Clear selection' }));
        expect(onValueChange.mock.calls).toEqual([[[]]]);
        expect(combobox()).toHaveValue('');
        expect(combobox()).toHaveFocus();
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
        await user.click(combobox());
        expect(visibleOptions()).toEqual(ALL);
      });

      it('toggles again when a controlled parent ignores the callback (separate interactions)', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderMulti({ value: ['a'], onValueChange });
        await user.click(combobox());
        // A multiselect commit keeps the list open, so the second click needs no reopening.
        await user.click(option('Banana'));
        expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b']);
        await user.click(option('Banana'));
        expect(onValueChange.mock.calls).toEqual([[['a', 'b']], [['a', 'b']]]);
        expect(combobox()).toHaveValue('Apple');
      });

      it('calls onValueChange once per toggle in StrictMode', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
          <React.StrictMode>
            <Combobox aria-label="Fruit" multiselect onValueChange={onValueChange}>
              {BASKET}
            </Combobox>
          </React.StrictMode>,
        );
        await user.click(combobox());
        await user.click(option('Cherry'));
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenCalledWith(['c']);
        await user.click(option('Apple'));
        expect(onValueChange).toHaveBeenCalledTimes(2);
        expect(onValueChange).toHaveBeenCalledWith(['c', 'a']);
      });

      it('fires the deprecated onOptionSelect per toggle', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const user = userEvent.setup();
        const onOptionSelect = vi.fn();
        renderMulti({ onOptionSelect });
        await user.click(combobox());
        await user.click(option('Apple'));
        await user.click(option('Apple'));
        expect(onOptionSelect.mock.calls).toEqual([['a'], ['a']]);
        expect(warn.mock.calls).toEqual([[DEPRECATED_ON_OPTION_SELECT]]);
      });

      it('warns once that freeform is not available with multiselect, and ignores it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        // From JavaScript: the multi-select signature has no `freeform`.
        const freeform = { freeform: true } as object;
        const make = () => (
          <Combobox aria-label="Fruit" multiselect onValueChange={onValueChange} {...freeform}>
            {BASKET}
          </Combobox>
        );
        const { rerender } = render(make());
        rerender(make());
        await user.type(combobox(), 'kiwi');
        expect(combobox()).toHaveValue('kiwi');
        expect(onValueChange).not.toHaveBeenCalled();
        expect(warn.mock.calls).toEqual([[FREEFORM_MULTISELECT]]);
      });

      it('passes axe while open with selected values', async () => {
        const user = userEvent.setup();
        renderMulti({ defaultValue: ['a', 'c'], clearable: true });
        await user.click(combobox());
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        await expectNoA11yViolations();
      });
    });

    describe('announcements (D41)', () => {
      it('announces each toggle, by a click or Enter, not a clear', async () => {
        const user = userEvent.setup();
        renderMulti({ clearable: true });
        await user.click(combobox());
        await user.click(option('Apple'));
        await waitFor(() => expect(__getAnnouncerText()).toBe('Apple added, 1 selected'));
        await user.click(option('Apple'));
        await waitFor(() => expect(__getAnnouncerText()).toBe('Apple removed, 0 selected'));
        await user.keyboard('ba{Enter}');
        await waitFor(() => expect(__getAnnouncerText()).toBe('Banana added, 1 selected'));
        await user.click(screen.getByRole('button', { name: 'Clear selection' }));
        // Settled (waitFor above), so this flush proves a clear announces nothing: a variant that
        // announces on clear would show a different message here.
        await flushAnnouncerFrame();
        expect(__getAnnouncerText()).toBe('Banana added, 1 selected');
      });

      it('localizes the announcements with labels.added and labels.removed', async () => {
        const user = userEvent.setup();
        renderMulti({
          labels: {
            added: (label, count) => `${label} lagt til (${count})`,
            removed: (label, count) => `${label} fjernet (${count})`,
          },
        });
        await user.click(combobox());
        await user.click(option('Date'));
        await waitFor(() => expect(__getAnnouncerText()).toBe('Date lagt til (1)'));
        await user.click(option('Date'));
        await waitFor(() => expect(__getAnnouncerText()).toBe('Date fjernet (0)'));
      });

      it('announces nothing for a controlled change', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
          <Combobox aria-label="Fruit" multiselect value={['a']}>
            {BASKET}
          </Combobox>,
        );
        // Settle the regions on a real toggle first (the announcement fires regardless of whether
        // the controlled parent reflects it back).
        await user.click(combobox());
        await user.click(option('Banana'));
        await waitFor(() => expect(__getAnnouncerText()).toBe('Banana added, 2 selected'));
        rerender(
          <Combobox aria-label="Fruit" multiselect value={['a', 'c']}>
            {BASKET}
          </Combobox>,
        );
        // A variant that announces every value change from an effect would show a different
        // message here once that effect's write lands.
        await flushAnnouncerFrame();
        expect(__getAnnouncerText()).toBe('Banana added, 2 selected');
      });

      it('says "No matches" in its own status region, not through the toggle announcer', async () => {
        const user = userEvent.setup();
        const { container } = renderMulti({ defaultValue: ['a'] });
        await user.click(combobox());
        await user.click(option('Banana'));
        await waitFor(() => expect(__getAnnouncerText()).toBe('Banana added, 2 selected'));
        await user.keyboard('zz');
        const status = within(container).getByRole('status');
        expect(status).toHaveTextContent('No matches');
        await user.keyboard('z');
        expect(within(container).getByRole('status')).toBe(status);
        expect(status).toHaveTextContent(/^No matches$/);
        await flushAnnouncerFrame();
        expect(__getAnnouncerText()).toBe('Banana added, 2 selected');
      });

      it('mounts the announcer live region while mounted, and removes it on unmount (M2)', () => {
        const { unmount } = renderMulti();
        expect(document.querySelector('[data-wave-announcer]')).not.toBeNull();
        unmount();
        expect(document.querySelector('[data-wave-announcer]')).toBeNull();
      });

      it('does not crash on a null value from JavaScript', () => {
        renderMulti({ value: null as never, placeholder: 'Pick fruit' });
        expect(combobox()).toHaveValue('');
        expect(combobox()).toHaveAttribute('placeholder', 'Pick fruit');
      });
    });

    describe('forms (D10)', () => {
      it('an empty required multiselect blocks the form; the invalid event focuses the input', async () => {
        const user = userEvent.setup();
        render(
          <form aria-label="Order">
            <Combobox aria-label="Fruit" multiselect name="fruit" required>
              {BASKET}
            </Combobox>
          </form>,
        );
        const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
        expect(form.checkValidity()).toBe(false);
        act(() => {
          form.reportValidity();
        });
        expect(combobox()).toHaveFocus();
        await user.click(combobox());
        await user.click(option('Date'));
        expect(form.checkValidity()).toBe(true);
      });

      it('submits one entry per value, unknown ones included; a toggle then a reset restores defaultValue, unannounced', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const { container } = render(
          <form>
            <Combobox
              aria-label="Fruit"
              multiselect
              name="fruit"
              defaultValue={['a', 'zz', 'b']}
              onValueChange={onValueChange}
            >
              {BASKET}
            </Combobox>
            <button type="reset">Reset</button>
          </form>,
        );
        const form = container.querySelector('form')!;
        expect(new FormData(form).getAll('fruit')).toEqual(['a', 'zz', 'b']);
        await user.click(combobox());
        await user.click(option('Cherry'));
        await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry added, 4 selected'));
        expect(new FormData(form).getAll('fruit')).toEqual(['a', 'zz', 'b', 'c']);
        await user.click(screen.getByRole('button', { name: 'Reset' }));
        expect(onValueChange).toHaveBeenLastCalledWith(['a', 'zz', 'b']);
        expect(combobox()).toHaveValue('Apple, Banana');
        // A variant that announces a reset would show a different message here.
        await flushAnnouncerFrame();
        expect(__getAnnouncerText()).toBe('Cherry added, 4 selected');
      });

      it('rerendering with a new inline defaultValue array, then resetting, makes no call (compared by content)', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const make = () => (
          <form>
            <Combobox
              aria-label="Fruit"
              multiselect
              defaultValue={['a', 'b']}
              onValueChange={onValueChange}
            >
              {BASKET}
            </Combobox>
            <button type="reset">Reset</button>
          </form>
        );
        const { rerender } = render(make());
        rerender(make());
        await user.click(screen.getByRole('button', { name: 'Reset' }));
        expect(onValueChange).not.toHaveBeenCalled();
        expect(combobox()).toHaveValue('Apple, Banana');
      });
    });
  });

  describe('multiselect types', () => {
    it('types the value by signature and keeps ComponentProps', () => {
      expectTypeOf<React.ComponentProps<typeof Combobox>>().toEqualTypeOf<ComboboxProps>();
      void (
        <Combobox multiselect onValueChange={(v) => expectTypeOf(v).toEqualTypeOf<string[]>()} />
      );
      void (<Combobox value="a" onValueChange={(v) => expectTypeOf(v).toEqualTypeOf<string>()} />);
      // @ts-expect-error a string value with multiselect
      void (<Combobox multiselect value="a" />);
      const flag = Math.random() > 0.5;
      // @ts-expect-error a non-literal multiselect matches neither signature
      void (<Combobox multiselect={flag} />);
      expectTypeOf<NonNullable<ComboboxLabels['selection']>>().toEqualTypeOf<
        (labels: string[]) => string
      >();
      expectTypeOf<NonNullable<ComboboxLabels['added']>>().toEqualTypeOf<
        (label: string, count: number) => string
      >();
      expectTypeOf<NonNullable<ComboboxLabels['removed']>>().toEqualTypeOf<
        (label: string, count: number) => string
      >();
    });

    it('rejects freeform with multiselect at the type level', () => {
      // @ts-expect-error freeform is not in the multi-select signature
      void (<Combobox multiselect freeform />);
      // @ts-expect-error not even freeform={false}
      void (<Combobox multiselect freeform={false} />);
      expectTypeOf<ComboboxProps<true>['freeform']>().toEqualTypeOf<undefined>();
      expectTypeOf<ComboboxProps['freeform']>().toEqualTypeOf<boolean | undefined>();
    });

    it('stays extendable by an interface', () => {
      interface ExtendedComboboxProps extends ComboboxProps {
        extra?: string;
      }
      expectTypeOf<ExtendedComboboxProps['multiselect']>().toEqualTypeOf<false | undefined>();
      expectTypeOf<ExtendedComboboxProps['value']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ExtendedComboboxProps['freeform']>().toEqualTypeOf<boolean | undefined>();
    });

    it('stays extendable by a generic interface over both modes', () => {
      interface WrapperProps<M extends boolean = false> extends ComboboxProps<M> {
        extra?: string;
      }
      expectTypeOf<WrapperProps['value']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<WrapperProps<true>['value']>().toEqualTypeOf<readonly string[] | undefined>();
      expectTypeOf<WrapperProps<true>['onValueChange']>().toEqualTypeOf<
        ((value: string[]) => void) | undefined
      >();
      expectTypeOf<WrapperProps<true>['freeform']>().toEqualTypeOf<undefined>();
    });
  });

  describe('filter and query (P5-02, D12, D13)', () => {
    const PREFIX = (option: ListboxItem, query: string) =>
      option.label.toLowerCase().startsWith(query.toLowerCase());

    /** A parent that owns the query: every onQueryChange call is recorded, then applied. */
    function ControlledQuery({
      onQueryChange,
      children,
      ...props
    }: Partial<ComboboxProps> & { onQueryChange: (query: string) => void }) {
      const [query, setQuery] = React.useState('');
      return (
        <Combobox
          aria-label="Fruit"
          {...props}
          query={query}
          onQueryChange={(next) => {
            onQueryChange(next);
            setQuery(next);
          }}
        >
          {children ?? FRUITS}
        </Combobox>
      );
    }

    describe('filter', () => {
      it('filters with a custom filter and keeps options that do not contain the text', async () => {
        const user = userEvent.setup();
        render(
          <Combobox
            aria-label="Fruit"
            filter={(option, query) =>
              option.value === 'create' ||
              option.label.toLowerCase().startsWith(query.toLowerCase())
            }
          >
            {FRUITS}
            <Option value="create">Create …</Option>
          </Combobox>,
        );
        await user.type(combobox(), 'be');
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
          'Beta',
          'Create …',
        ]);
        // The kept option is a match like any other: the first one is active, and "No matches"
        // is not said while the filter keeps it.
        await user.type(combobox(), 'zz');
        expect(visibleOptions()).toEqual(['Create …']);
        expect(activeOption()).toHaveTextContent('Create …');
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
      });

      it('says "No matches" when a custom filter (a prefix match) keeps none', async () => {
        const user = userEvent.setup();
        const { container } = renderCombobox({ filter: PREFIX });
        // The default match, a substring, would keep every option for "e".
        await user.type(combobox(), 'e');
        expect(visibleOptions()).toEqual([]);
        expect(within(container).getByRole('status')).toHaveTextContent('No matches');
        await user.clear(combobox());
        await user.type(combobox(), 'ch');
        expect(visibleOptions()).toEqual(['Cherry']);
        expect(within(container).getByRole('status')).toBeEmptyDOMElement();
      });

      it('shows every option for any text with filter={() => true}; Enter selects the first', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const { container } = renderCombobox({ filter: () => true, onValueChange });
        await user.type(combobox(), 'zzz');
        expect(visibleOptions()).toEqual(['Apple', 'Beta', 'Cherry']);
        expect(within(container).getByRole('status')).toBeEmptyDOMElement();
        expect(activeOption()).toHaveTextContent('Apple');
        await user.keyboard('{Enter}');
        expect(onValueChange.mock.calls).toEqual([['a']]);
      });

      it('is called with each option that is not hidden (a ListboxItem) and the typed text', async () => {
        const user = userEvent.setup();
        const filter = vi.fn((_option: ListboxItem, _query: string) => true);
        renderCombobox({
          filter,
          children: [
            <Option key="a" value="a" label="Apple" textValue="Malus">
              Apple
            </Option>,
            <Option key="h" value="h" hidden>
              Hidden
            </Option>,
            <Option key="b" value="b">
              Beta
            </Option>,
          ],
        });
        await user.click(combobox());
        // Not while the text is empty.
        expect(filter).not.toHaveBeenCalled();
        await user.keyboard('x');
        expect(filter).toHaveBeenCalledWith(
          { value: 'a', label: 'Apple', textValue: 'Malus' },
          'x',
        );
        expect(filter).toHaveBeenCalledWith({ value: 'b', label: 'Beta' }, 'x');
        expect(new Set(filter.mock.calls.map(([option]) => option.value))).toEqual(
          new Set(['a', 'b']),
        );
      });

      it("matches the option's textValue before its label by default", async () => {
        const user = userEvent.setup();
        renderCombobox({
          children: [
            <Option key="a" value="a" label="Apple" textValue="Malus">
              Apple
            </Option>,
            <Option key="b" value="b">
              Beta
            </Option>,
          ],
        });
        await user.type(combobox(), 'mal');
        expect(visibleOptions()).toEqual(['Apple']);
        await user.clear(combobox());
        await user.type(combobox(), 'app');
        expect(visibleOptions()).toEqual([]);
      });

      it('filters freeform text with it', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderCombobox({ freeform: true, filter: PREFIX, onValueChange });
        await user.type(combobox(), 'e');
        expect(visibleOptions()).toEqual([]);
        await user.clear(combobox());
        await user.type(combobox(), 'ap');
        expect(visibleOptions()).toEqual(['Apple']);
        // The text is still the value.
        expect(onValueChange).toHaveBeenLastCalledWith('ap');
      });

      it('supports async search with filter={() => true}', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
          const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
          function Search() {
            const [query, setQuery] = React.useState('');
            const [results, setResults] = React.useState<string[]>(['Apple', 'Banana']);
            React.useEffect(() => {
              const id = setTimeout(
                () => setResults(query ? ['Cherry'] : ['Apple', 'Banana']),
                200,
              );
              return () => clearTimeout(id);
            }, [query]);
            return (
              <Combobox
                aria-label="Fruit"
                filter={() => true}
                query={query}
                onQueryChange={setQuery}
              >
                {results.map((r) => (
                  <Option key={r} value={r}>
                    {r}
                  </Option>
                ))}
              </Combobox>
            );
          }
          render(<Search />);
          await user.type(combobox(), 'x');
          await act(async () => {
            vi.advanceTimersByTime(250);
          });
          expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cherry']);
          expect(activeOption()).toHaveTextContent('Cherry');
        } finally {
          vi.useRealTimers();
        }
      });

      it('keeps the previous results while a search loads, and says "No matches" only for an empty result', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
          const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
          const search = (query: string) =>
            ['Apple', 'Banana', 'Cherry'].filter((name) =>
              name.toLowerCase().startsWith(query.toLowerCase()),
            );
          function Search() {
            const [query, setQuery] = React.useState('');
            const [results, setResults] = React.useState(() => search(''));
            React.useEffect(() => {
              const id = setTimeout(() => setResults(search(query)), 200);
              return () => clearTimeout(id);
            }, [query]);
            return (
              <Combobox
                aria-label="Fruit"
                filter={() => true}
                query={query}
                onQueryChange={setQuery}
              >
                {results.map((r) => (
                  <Option key={r} value={r}>
                    {r}
                  </Option>
                ))}
              </Combobox>
            );
          }
          const { container } = render(<Search />);
          const status = within(container).getByRole('status');
          await user.type(combobox(), 'b');
          // Loading: the previous results stay, the first of them active.
          expect(visibleOptions()).toEqual(['Apple', 'Banana', 'Cherry']);
          expect(activeOption()).toHaveTextContent('Apple');
          await act(async () => {
            vi.advanceTimersByTime(250);
          });
          expect(visibleOptions()).toEqual(['Banana']);
          expect(activeOption()).toHaveTextContent('Banana');
          await user.type(combobox(), 'x');
          expect(visibleOptions()).toEqual(['Banana']);
          expect(status).toBeEmptyDOMElement();
          await act(async () => {
            vi.advanceTimersByTime(250);
          });
          expect(visibleOptions()).toEqual([]);
          expect(status).toHaveTextContent('No matches');
        } finally {
          vi.useRealTimers();
        }
      });

      it('keeps the arrowed-to option active while the parent renders a new inline filter on every key', async () => {
        const user = userEvent.setup();
        function Parent() {
          const [query, setQuery] = React.useState('e');
          const [, setKeys] = React.useState(0);
          return (
            <Combobox
              aria-label="Fruit"
              query={query}
              onQueryChange={setQuery}
              onKeyDown={() => setKeys((count) => count + 1)}
              filter={(option, text) => option.label.toLowerCase().includes(text.toLowerCase())}
            >
              {FRUITS}
            </Combobox>
          );
        }
        render(<Parent />);
        act(() => combobox().focus());
        // The first ArrowDown opens the list on the first option, the second moves on.
        await user.keyboard('{ArrowDown}{ArrowDown}');
        expect(visibleOptions()).toEqual(['Apple', 'Beta', 'Cherry']);
        expect(activeOption()).toHaveTextContent('Beta');
        // Another key renders the parent (and a new filter) again: the highlight stays.
        await user.keyboard('{Shift}');
        expect(activeOption()).toHaveTextContent('Beta');
      });
    });

    describe('query', () => {
      it('reports and resets the query on each path, and follows a controlled query', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        function Controlled() {
          const [query, setQuery] = React.useState('');
          return (
            <Combobox
              aria-label="Fruit"
              query={query}
              onQueryChange={(q) => {
                onQueryChange(q);
                setQuery(q);
              }}
            >
              {FRUITS}
            </Combobox>
          );
        }
        render(<Controlled />);
        await user.type(combobox(), 'ch');
        await user.keyboard('{Escape}');
        expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
      });

      it.each<
        [
          string,
          Partial<ComboboxProps>,
          (user: ReturnType<typeof userEvent.setup>) => Promise<void>,
          string,
        ]
      >([
        ['a commit with Enter', {}, (user) => user.keyboard('{Enter}'), 'Cherry'],
        ['a commit with a click', {}, (user) => user.click(option('Cherry')), 'Cherry'],
        ['a close with Escape', {}, (user) => user.keyboard('{Escape}'), ''],
        ['a press outside', {}, (user) => user.click(screen.getByText('Outside')), ''],
        ['a blur (Tab)', {}, (user) => user.tab(), ''],
        [
          'Escape on a list the parent keeps closed',
          { open: false },
          (user) => user.keyboard('{Escape}'),
          '',
        ],
        [
          'the clear button',
          { defaultValue: 'a', clearable: true },
          (user) => user.click(screen.getByRole('button', { name: 'Clear selection' })),
          '',
        ],
        [
          'a form reset while the input keeps focus',
          { defaultValue: 'a' },
          async () => {
            act(() => (screen.getByRole('form', { name: 'Order' }) as HTMLFormElement).reset());
          },
          'Apple',
        ],
      ])('resets the query to "" on %s', async (_label, props, reset, text) => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
          <form aria-label="Order">
            <ControlledQuery {...props} onQueryChange={onQueryChange} />
            <p>Outside</p>
            <button type="button">Next</button>
          </form>,
        );
        await user.clear(combobox());
        await user.type(combobox(), 'ch');
        expect(combobox()).toHaveValue('ch');
        await reset(user);
        expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
        expect(combobox()).toHaveValue(text);
      });

      it('shows a controlled query, filters with it, and keeps one the parent keeps after a close', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        renderCombobox({ defaultValue: 'a', query: 'ch', onQueryChange });
        // A non-empty query shows in place of the selected label.
        expect(combobox()).toHaveValue('ch');
        await user.click(combobox());
        expect(visibleOptions()).toEqual(['Cherry']);
        expect(activeOption()).toHaveTextContent('Cherry');
        await user.keyboard('{Escape}');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(onQueryChange.mock.calls).toEqual([['']]);
        expect(combobox()).toHaveValue('ch');
      });

      it("shows the selected label for a '' query, and keeps erased text empty while editing", async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
          <>
            <ControlledQuery defaultValue="a" onQueryChange={onQueryChange} />
            <button type="button">Next</button>
          </>,
        );
        expect(combobox()).toHaveValue('Apple');
        await user.clear(combobox());
        // The query stays '' (nothing to report); the input stays empty while the user edits.
        expect(combobox()).toHaveValue('');
        expect(visibleOptions()).toEqual(['Apple', 'Beta', 'Cherry']);
        await user.keyboard('{Escape}');
        expect(combobox()).toHaveValue('Apple');
        await user.clear(combobox());
        await user.tab();
        expect(combobox()).toHaveValue('Apple');
        expect(onQueryChange).not.toHaveBeenCalled();
      });

      it('starts from defaultQuery: shown, filtering, and reset like typed text', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        renderCombobox({ defaultValue: 'a', defaultQuery: 'ch', onQueryChange });
        expect(combobox()).toHaveValue('ch');
        await user.click(combobox());
        expect(visibleOptions()).toEqual(['Cherry']);
        await user.keyboard('{Escape}');
        expect(combobox()).toHaveValue('Apple');
        expect(onQueryChange.mock.calls).toEqual([['']]);
      });

      it('calls onQueryChange once per change in StrictMode', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
          <React.StrictMode>
            <Combobox aria-label="Fruit" onQueryChange={onQueryChange}>
              {FRUITS}
            </Combobox>
          </React.StrictMode>,
        );
        await user.type(combobox(), 'ch');
        await user.keyboard('{Escape}');
        expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
      });

      it('multiselect: reports the text typed over the labels, and its reset on a toggle', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
          <>
            <button type="button">Before</button>
            <Combobox
              aria-label="Fruit"
              multiselect
              defaultValue={['a']}
              onQueryChange={onQueryChange}
            >
              {FRUITS}
            </Combobox>
          </>,
        );
        await user.click(screen.getByRole('button', { name: 'Before' }));
        await user.tab();
        await user.keyboard('ch');
        expect(combobox()).toHaveValue('ch');
        await user.keyboard('{Enter}');
        expect(combobox()).toHaveValue('Apple, Cherry');
        expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
      });

      it('multiselect: shows a controlled query in place of the labels', async () => {
        const user = userEvent.setup();
        render(
          <Combobox aria-label="Fruit" multiselect defaultValue={['a']} query="ch">
            {FRUITS}
          </Combobox>,
        );
        expect(combobox()).toHaveValue('ch');
        await user.click(combobox());
        expect(visibleOptions()).toEqual(['Cherry']);
      });
    });

    describe('locking (D12)', () => {
      it('reports a lock reset from an effect, once, without a render-phase update', () => {
        const error = vi.spyOn(console, 'error');
        const onQueryChange = vi.fn();
        // The parent stores the query, so a call during the render of the Combobox would update the
        // parent while it renders, which React reports.
        function Parent({ disabled }: { disabled: boolean }) {
          const [query, setQuery] = React.useState('ch');
          return (
            <Combobox
              aria-label="Fruit"
              query={query}
              onQueryChange={(next) => {
                onQueryChange(next);
                setQuery(next);
              }}
              disabled={disabled}
            >
              {FRUITS}
            </Combobox>
          );
        }
        const { rerender } = render(<Parent disabled={false} />);
        expect(combobox()).toHaveValue('ch');
        rerender(<Parent disabled />);
        expect(combobox()).toHaveValue('');
        expect(onQueryChange.mock.calls).toEqual([['']]);
        expect(error).not.toHaveBeenCalled();
      });

      it('keeps a controlled query when it mounts locked: hidden, unreported, shown on unlock (R20)', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        // A query the parent restored (from the URL, say) while it loads.
        function Parent({ disabled }: { disabled: boolean }) {
          const [query, setQuery] = React.useState('swe');
          return (
            <Combobox
              aria-label="Fruit"
              query={query}
              onQueryChange={(next) => {
                onQueryChange(next);
                setQuery(next);
              }}
              disabled={disabled}
            >
              {FRUITS}
            </Combobox>
          );
        }
        const { rerender } = render(<Parent disabled />);
        expect(combobox()).toHaveValue('');
        await act(async () => {});
        expect(onQueryChange).not.toHaveBeenCalled();
        rerender(<Parent disabled={false} />);
        await act(async () => {});
        expect(combobox()).toHaveValue('swe');
        expect(onQueryChange).not.toHaveBeenCalled();
        // Locking after typing reports the reset, once.
        await user.type(combobox(), 'x');
        expect(combobox()).toHaveValue('swex');
        rerender(<Parent disabled />);
        await act(async () => {});
        expect(combobox()).toHaveValue('');
        expect(onQueryChange.mock.calls).toEqual([['swex'], ['']]);
      });

      it.each([
        ['disabled', { disabled: true }],
        ['readOnly', { readOnly: true }],
      ] as const)(
        'hides a controlled query typed before %s turns on, and reports its reset once, logging nothing',
        async (_label, lock) => {
          const user = userEvent.setup();
          const error = vi.spyOn(console, 'error');
          const onQueryChange = vi.fn();
          const { rerender } = render(
            <ControlledQuery defaultValue="a" onQueryChange={onQueryChange} />,
          );
          await user.clear(combobox());
          await user.type(combobox(), 'ch');
          rerender(<ControlledQuery defaultValue="a" onQueryChange={onQueryChange} {...lock} />);
          expect(combobox()).toHaveValue('Apple');
          expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
          rerender(<ControlledQuery defaultValue="a" onQueryChange={onQueryChange} {...lock} />);
          act(() => combobox().blur());
          rerender(<ControlledQuery defaultValue="a" onQueryChange={onQueryChange} />);
          // Unlocking brings back neither the text nor its filter.
          expect(combobox()).toHaveValue('Apple');
          expect(onQueryChange).toHaveBeenCalledTimes(3);
          // A render-phase call would make React log an update of the parent during the render of
          // the Combobox.
          expect(error).not.toHaveBeenCalled();
        },
      );

      it('hides a query the parent keeps while locked, reports its reset once, and shows it unlocked', async () => {
        const onQueryChange = vi.fn();
        const make = (readOnly: boolean) => (
          <Combobox
            aria-label="Fruit"
            defaultValue="a"
            query="ch"
            onQueryChange={onQueryChange}
            readOnly={readOnly}
          >
            {FRUITS}
          </Combobox>
        );
        const { rerender } = render(make(false));
        expect(combobox()).toHaveValue('ch');
        rerender(make(true));
        expect(combobox()).toHaveValue('Apple');
        // Later renders while locked, in tasks of their own (a parent that renders for another
        // reason), report nothing more.
        await act(async () => {});
        rerender(make(true));
        await act(async () => {});
        expect(combobox()).toHaveValue('Apple');
        expect(onQueryChange.mock.calls).toEqual([['']]);
        rerender(make(false));
        expect(combobox()).toHaveValue('ch');
        expect(onQueryChange.mock.calls).toEqual([['']]);
      });

      it('drops a defaultQuery when it mounts locked and reports nothing (as defaultOpen)', () => {
        const onQueryChange = vi.fn();
        const make = (disabled: boolean) => (
          <Combobox
            aria-label="Fruit"
            defaultValue="a"
            defaultQuery="ch"
            onQueryChange={onQueryChange}
            disabled={disabled}
          >
            {FRUITS}
          </Combobox>
        );
        const { rerender } = render(make(true));
        expect(combobox()).toHaveValue('Apple');
        rerender(make(false));
        expect(combobox()).toHaveValue('Apple');
        expect(onQueryChange).not.toHaveBeenCalled();
      });
    });

    describe('freeform (D12)', () => {
      it('filters freeform text, never calls onQueryChange, and warns about query props', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onQueryChange = vi.fn();
        const user = userEvent.setup();
        render(
          <Combobox aria-label="Fruit" freeform defaultQuery="x" onQueryChange={onQueryChange}>
            {FRUITS}
          </Combobox>,
        );
        await user.type(combobox(), 'ch');
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cherry']);
        expect(onQueryChange).not.toHaveBeenCalled();
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Combobox: `query` and `defaultQuery` are not used with `freeform`: the typed text is the value (`value`, `onValueChange`).',
          ],
        ]);
      });

      it('ignores a controlled query on every path, the lock included, and warns once', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        const make = (disabled: boolean) => (
          <Combobox
            aria-label="Fruit"
            freeform
            query="x"
            onQueryChange={onQueryChange}
            disabled={disabled}
          >
            {FRUITS}
          </Combobox>
        );
        const { rerender } = render(make(false));
        rerender(make(false));
        expect(combobox()).toHaveValue('');
        await user.type(combobox(), 'ch');
        expect(combobox()).toHaveValue('ch');
        expect(visibleOptions()).toEqual(['Cherry']);
        await user.keyboard('{Escape}{Escape}');
        expect(combobox()).toHaveValue('');
        await user.type(combobox(), 'b');
        rerender(make(true));
        expect(onQueryChange).not.toHaveBeenCalled();
        expect(warn.mock.calls).toEqual([[QUERY_FREEFORM]]);
      });

      it('does not warn for onQueryChange alone with freeform, or for a query without it', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderCombobox({ freeform: true, onQueryChange: () => {} });
        renderCombobox({ 'aria-label': 'Snack', query: 'x', defaultQuery: 'y' });
        expect(warn.mock.calls).toEqual([]);
      });
    });

    it('types filter, query, defaultQuery and onQueryChange', () => {
      expectTypeOf<ComboboxProps['filter']>().toEqualTypeOf<
        ((option: ListboxItem, query: string) => boolean) | undefined
      >();
      expectTypeOf<ComboboxProps<true>['filter']>().toEqualTypeOf<ComboboxProps['filter']>();
      expectTypeOf<ComboboxProps['query']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ComboboxProps['defaultQuery']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ComboboxProps['onQueryChange']>().toEqualTypeOf<
        ((query: string) => void) | undefined
      >();
    });
  });

  describe('onActiveOptionChange (P5-02, D14)', () => {
    it('reports the active option through arrows, hover, and null on close', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      renderCombobox({ onActiveOptionChange });
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.hover(option('Cherry'));
      await user.keyboard('{Escape}');
      expect(onActiveOptionChange.mock.calls).toEqual([['a'], ['b'], ['c'], [null]]);
    });

    it('reports the selected option when ArrowDown opens the list', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      renderCombobox({ defaultValue: 'b', onActiveOptionChange });
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(onActiveOptionChange).toHaveBeenCalledOnce();
      expect(onActiveOptionChange).toHaveBeenCalledWith('b');
    });

    it('reports a filter change that moves the active option', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      renderCombobox({
        onActiveOptionChange,
        children: [
          <Option key="peach" value="peach">
            Peach
          </Option>,
          <Option key="pear" value="pear">
            Pear
          </Option>,
          <Option key="plum" value="plum">
            Plum
          </Option>,
        ],
      });
      await user.type(combobox(), 'p');
      expect(onActiveOptionChange.mock.calls).toEqual([['peach']]);
      await user.type(combobox(), 'l');
      expect(visibleOptions()).toEqual(['Plum']);
      expect(onActiveOptionChange).toHaveBeenLastCalledWith('plum');
    });

    it('reports the active option the same way in multiselect mode', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      render(
        <Combobox aria-label="Fruit" multiselect onActiveOptionChange={onActiveOptionChange}>
          {FRUITS}
        </Combobox>,
      );
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Escape}');
      expect(onActiveOptionChange.mock.calls).toEqual([['a'], ['b'], [null]]);
    });

    it('calls onActiveOptionChange once per change in StrictMode', async () => {
      const user = userEvent.setup();
      const onActiveOptionChange = vi.fn();
      render(
        <React.StrictMode>
          <Combobox aria-label="Fruit" onActiveOptionChange={onActiveOptionChange}>
            {FRUITS}
          </Combobox>
        </React.StrictMode>,
      );
      combobox().focus();
      await user.keyboard('{ArrowDown}');
      expect(onActiveOptionChange).toHaveBeenCalledTimes(1);
      expect(onActiveOptionChange).toHaveBeenLastCalledWith('a');
      await user.keyboard('{ArrowDown}');
      expect(onActiveOptionChange).toHaveBeenCalledTimes(2);
      expect(onActiveOptionChange).toHaveBeenLastCalledWith('b');
    });
  });
});

describe('insertedText', () => {
  it.each([
    ['Apple, Banana', 'Apple, Bananac', 'c'],
    ['Apple, Banana', 'c', 'c'],
    ['Apple, Banana', 'Apple, xBanana', 'x'],
    ['Apple, Banana', 'Apple, Banan', ''],
    ['Apple, Banana', 'Apple, Banana', ''],
    ['ab', 'aab', 'a'],
    // Characters outside the BMP: the shared start or end never splits a surrogate pair.
    ['🍎', '🍌🍎', '🍌'],
    ['🍎', '🍏', '🍏'],
    ['🈀', '😀', '😀'],
  ])('%j → %j inserts %j', (before, after, expected) => {
    expect(insertedText(before, after)).toBe(expected);
  });
});
