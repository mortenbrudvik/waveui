import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Combobox, ComboboxOption, ComboboxOptionGroup, Option, OptionGroup } from '../Combobox';
import { testCompoundExposure, testSystemProps } from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';

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
    ],
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

    it('hides filtered-out options over their display utility (no Preflight)', async () => {
      const user = userEvent.setup();
      renderCombobox();
      await user.type(combobox(), 'ch');
      const filteredOut = screen
        .getAllByRole('option', { hidden: true })
        .filter((element) => element.hidden);
      expect(filteredOut.map((element) => element.textContent)).toEqual(['Apple', 'Beta']);
      // `flex` would override the UA `[hidden] { display: none }` rule without Preflight.
      for (const element of filteredOut) expect(element).toHaveClass('[&[hidden]]:hidden');
      expect(option('Cherry')).toHaveClass('flex');
    });

    it('shows "No matches" when the text matches no option', async () => {
      const user = userEvent.setup();
      renderCombobox();
      await user.type(combobox(), 'zzz');
      expect(screen.getByRole('status')).toHaveTextContent('No matches');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
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

    it('clears when a controlled value becomes undefined (table-core#4)', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderCombobox({ value: 'a' });
      expect(combobox()).toHaveValue('Apple');
      rerender(
        <Combobox aria-label="Fruit" value={undefined}>
          {FRUITS}
        </Combobox>,
      );
      expect(combobox()).toHaveValue('');
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
    });

    it('warns once that onOptionSelect is deprecated', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderCombobox({ onOptionSelect: () => {} });
      rerender(
        <Combobox aria-label="Fruit" onOptionSelect={() => {}}>
          {FRUITS}
        </Combobox>,
      );
      const calls = warn.mock.calls.filter(([m]) => String(m).includes('onOptionSelect'));
      expect(calls).toHaveLength(1);
      expect(String(calls[0][0])).toContain('[WaveUI] Combobox: `onOptionSelect` is deprecated');
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
      act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
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
    expect(option('Apple')).toHaveClass('data-[active]:bg-selected');
    expect(option('Apple')).not.toHaveClass('data-[active]:bg-subtle-hover');
  });
});
