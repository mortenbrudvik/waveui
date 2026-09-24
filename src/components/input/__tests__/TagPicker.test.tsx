import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker } from '../TagPicker';
import { renderWithProviders, testNoImplicitSubmit, testSystemProps } from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
];

function combobox(name = 'Fruits') {
  return screen.getByRole('combobox', { name });
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function tags() {
  const list = screen.queryByRole('list', { name: 'Selected' });
  return list
    ? within(list)
        .getAllByRole('listitem')
        .map((el) => el.textContent)
    : [];
}

function renderPicker(props: Partial<React.ComponentProps<typeof TagPicker>> = {}) {
  return render(<TagPicker aria-label="Fruits" options={options} {...props} />);
}

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

describe('TagPicker', () => {
  testSystemProps(TagPicker, {
    expectedTag: 'div',
    displayName: 'TagPicker',
    control: { role: 'combobox' },
    defaultProps: { options, 'aria-label': 'Fruits' },
    conflictingClass: { className: 'static', overrides: 'relative' },
    a11yVariants: [
      { name: 'open', props: { defaultOpen: true } },
      { name: 'with a selected tag', props: { defaultValue: ['apple'] } },
      { name: 'open with a selected tag', props: { defaultOpen: true, defaultValue: ['apple'] } },
      { name: 'disabled with tags', props: { disabled: true, defaultValue: ['apple', 'date'] } },
      { name: 'read-only with tags', props: { readOnly: true, defaultValue: ['apple', 'date'] } },
    ],
  });

  testNoImplicitSubmit(TagPicker, {
    defaultProps: {
      options,
      'aria-label': 'Fruits',
      defaultValue: ['apple', 'banana'],
      defaultOpen: true,
    },
  });

  it('renders placeholder when no values selected', () => {
    renderPicker({ placeholder: 'Pick fruits' });
    expect(combobox()).toHaveAttribute('placeholder', 'Pick fruits');
  });

  it('shows the options when the input is clicked', async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(combobox());
    expect(screen.getByRole('listbox')).toBeVisible();
    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
  });

  it('filters options based on input', async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(combobox(), 'ban');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Banana']);
  });

  it('selects an option on click, clears the text and keeps the list open', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });
    await user.type(combobox(), 'ap');
    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onValueChange).toHaveBeenCalledWith(['apple']);
    expect(combobox()).toHaveValue('');
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    expect(combobox()).toHaveFocus();
  });

  it('renders selected values as tags in a list named "Selected" and describes the input with a summary', () => {
    renderPicker({ value: ['apple', 'banana'], 'aria-describedby': 'help' });
    expect(tags()).toEqual(['Apple', 'Banana']);
    // A summary, not the list itself: the list's text would include every "Remove …" button name.
    expect(combobox()).toHaveAccessibleDescription('Selected: Apple, Banana');
    expect(combobox().getAttribute('aria-describedby')).toMatch(/^help /);
  });

  it('drops the summary from the description when no tag is selected', async () => {
    const user = userEvent.setup();
    renderPicker({ defaultValue: ['apple'] });
    expect(combobox()).toHaveAccessibleDescription('Selected: Apple');
    await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
    expect(combobox()).not.toHaveAttribute('aria-describedby');
  });

  it('removes a tag when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ value: ['apple', 'banana'], onValueChange });
    await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
    expect(onValueChange).toHaveBeenCalledWith(['banana']);
    expect(combobox()).toHaveFocus();
  });

  it('navigates options with arrow keys and adds the highlighted one with Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });
    await user.click(combobox());
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(['apple']);
  });

  it('does not list already-selected options', async () => {
    const user = userEvent.setup();
    renderPicker({ value: ['apple'] });
    await user.click(combobox());
    const labels = screen.getAllByRole('option').map((li) => li.textContent);
    expect(labels).toEqual(['Banana', 'Cherry', 'Date']);
    expect(tags()).toEqual(['Apple']);
  });

  describe('combobox semantics (input-basic#43, input-pickers#3, #21)', () => {
    it('aria-controls equals the listbox id and aria-activedescendant the first option after ArrowDown', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(combobox()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
      await user.keyboard('{ArrowDown}');
      const first = screen.getAllByRole('option')[0];
      expect(combobox()).toHaveAttribute('aria-activedescendant', first.id);
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Banana');
      await user.keyboard('{Escape}');
      expect(combobox()).not.toHaveAttribute('aria-activedescendant');
    });

    it("aria-expanded is 'false' when every option is selected", async () => {
      const user = userEvent.setup();
      renderPicker({ defaultValue: ['apple', 'banana', 'cherry', 'date'] });
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('shows "No matches" with aria-expanded false when nothing matches', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.type(combobox(), 'zzz');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      // (the page-level announcer is a status region too)
      expect(screen.getByText('No matches')).toHaveAttribute('role', 'status');
    });

    it('marks the listbox multi-selectable', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(combobox());
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    });
  });

  describe('keyboard and announcements (input-pickers#14)', () => {
    it('Backspace on an empty query moves focus to the last tag; a second Backspace removes it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderPicker({ defaultValue: ['apple', 'banana'], onValueChange });
      await user.click(combobox());
      await user.keyboard('{Backspace}');
      expect(screen.getByRole('button', { name: 'Remove Banana' })).toHaveFocus();
      expect(onValueChange).not.toHaveBeenCalled();
      await user.keyboard('{Backspace}');
      expect(onValueChange).toHaveBeenCalledWith(['apple']);
      expect(combobox()).toHaveFocus();
    });

    it('Delete on a focused tag removes it; arrows move between tags and back to the input', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderPicker({ defaultValue: ['apple', 'banana', 'cherry'], onValueChange });
      await user.click(combobox());
      await user.keyboard('{Backspace}{ArrowLeft}');
      expect(screen.getByRole('button', { name: 'Remove Banana' })).toHaveFocus();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(combobox()).toHaveFocus();
      await user.keyboard('{Backspace}{ArrowLeft}{Delete}');
      expect(onValueChange).toHaveBeenCalledWith(['apple', 'cherry']);
    });

    it('mirrors the tag arrow keys in RTL', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <TagPicker aria-label="Fruits" options={options} defaultValue={['apple', 'banana']} />,
        { dir: 'rtl' },
      );
      await user.click(combobox());
      await user.keyboard('{Backspace}{ArrowRight}');
      expect(screen.getByRole('button', { name: 'Remove Apple' })).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Remove Apple' })).toHaveClass('ms-0.5');
    });

    it('Escape on a tag returns focus to the input and is not seen by a parent layer', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']} />
        </ParentLayer>,
      );
      await user.click(combobox());
      await user.keyboard('{Backspace}');
      expect(screen.getByRole('button', { name: 'Remove Apple' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveFocus();
      expect(onParentDismiss).not.toHaveBeenCalled();
    });

    it('announces additions and removals', async () => {
      const user = userEvent.setup();
      renderPicker({ defaultValue: ['apple'] });
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Cherry' }));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry added, 2 selected'));
      await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Apple removed, 1 selected'));
    });

    it('Escape closes the list, then clears the typed text', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.type(combobox(), 'ch');
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(combobox()).toHaveValue('ch');
      expect(screen.queryByText('No matches')).toBeNull();
      expect(document.querySelector('[data-wave-listbox-surface]')).toBeNull();
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveValue('');
    });
  });

  describe('disabled (input-pickers#13)', () => {
    it('disables the input and the remove buttons and marks the group aria-disabled', () => {
      renderPicker({ disabled: true, defaultValue: ['apple'] });
      expect(combobox()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Remove Apple' })).toBeDisabled();
      expect(screen.getByRole('group')).toHaveAttribute('aria-disabled', 'true');
    });

    it('keeps the remove buttons out of the tab order', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <TagPicker
            aria-label="Fruits"
            options={options}
            defaultValue={['apple', 'banana']}
            disabled
          />
          <button type="button">After</button>
        </>,
      );
      screen.getByRole('button', { name: 'Before' }).focus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('ignores keyboard removal', () => {
      const onValueChange = vi.fn();
      renderPicker({ disabled: true, defaultValue: ['apple'], onValueChange });
      const remove = screen.getByRole('button', { name: 'Remove Apple' });
      act(() => {
        remove.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }),
        );
      });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(tags()).toEqual(['Apple']);
    });
  });

  describe('read-only (input-basic#1)', () => {
    it('routes readOnly to the input and neither opens nor adds from the mouse or the keyboard', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      renderPicker({ readOnly: true, defaultValue: ['apple'], onValueChange, onOpenChange });
      expect(combobox()).toHaveAttribute('readonly');
      await user.click(combobox());
      await user.keyboard('{ArrowDown}{Enter}{ArrowUp}{Alt>}{ArrowDown}{/Alt}');
      await user.type(combobox(), 'ban');
      expect(combobox()).toHaveValue('');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(tags()).toEqual(['Apple']);
    });

    it('shows the tags without remove buttons and keeps them on Backspace', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderPicker({ readOnly: true, defaultValue: ['apple', 'banana'], onValueChange });
      expect(tags()).toEqual(['Apple', 'Banana']);
      expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
      expect(combobox()).toHaveAccessibleDescription('Selected: Apple, Banana');
      combobox().focus();
      await user.keyboard('{Backspace}{Backspace}{Delete}');
      expect(combobox()).toHaveFocus();
      expect(tags()).toEqual(['Apple', 'Banana']);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not show a controlled open list and leaves Escape to the parent layer', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <TagPicker aria-label="Fruits" options={options} readOnly open />
        </ParentLayer>,
      );
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
      combobox().focus();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['readOnly', { readOnly: true }],
      ['disabled', { disabled: true }],
    ] as const)('drops the typed text when %s turns on while typing', async (_, lock) => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const { rerender } = renderPicker({ onOpenChange });
      await user.type(combobox(), 'ch');
      expect(combobox()).toHaveValue('ch');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      rerender(
        <TagPicker aria-label="Fruits" options={options} onOpenChange={onOpenChange} {...lock} />,
      );
      expect(combobox()).toHaveValue('');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      // Locking closes the list for real, so unlocking does not reopen it (input-pickers#7 review).
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      const openChangeCalls = onOpenChange.mock.calls.length;
      act(() => combobox().blur());
      rerender(<TagPicker aria-label="Fruits" options={options} onOpenChange={onOpenChange} />);
      expect(combobox()).toHaveValue('');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onOpenChange).toHaveBeenCalledTimes(openChangeCalls);
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
    });

    it('moves focus from a remove button to the input when readOnly turns on (C-DISABLED)', async () => {
      const user = userEvent.setup();
      const { rerender } = renderPicker({ defaultValue: ['apple', 'banana'] });
      await user.click(combobox());
      await user.keyboard('{Backspace}');
      expect(screen.getByRole('button', { name: 'Remove Banana' })).toHaveFocus();
      rerender(
        <TagPicker
          aria-label="Fruits"
          options={options}
          defaultValue={['apple', 'banana']}
          readOnly
        />,
      );
      await act(async () => {});
      expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
      expect(combobox()).toHaveFocus();
    });

    it('leaves focus outside the picker alone when readOnly turns on', async () => {
      const { rerender } = render(
        <>
          <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']} />
          <button type="button">Elsewhere</button>
        </>,
      );
      act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
      rerender(
        <>
          <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']} readOnly />
          <button type="button">Elsewhere</button>
        </>,
      );
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    });

    it('moves focus to the input when a controlled value drops the focused tag', async () => {
      const user = userEvent.setup();
      const { rerender } = renderPicker({ value: ['apple', 'banana'] });
      await user.click(combobox());
      await user.keyboard('{Backspace}');
      expect(screen.getByRole('button', { name: 'Remove Banana' })).toHaveFocus();
      rerender(<TagPicker aria-label="Fruits" options={options} value={['apple']} />);
      await act(async () => {});
      expect(combobox()).toHaveFocus();
    });

    it('does not block form submission while read-only and required (input-basic#12)', () => {
      render(
        <form aria-label="Order">
          <TagPicker aria-label="Fruits" options={options} name="fruit" required readOnly />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      // A native readonly input is barred from constraint validation; the user could not fix it.
      expect(form.checkValidity()).toBe(true);
      expect(combobox()).toHaveAttribute('aria-required', 'true');
    });

    it('still submits its values while read-only', async () => {
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
          <TagPicker
            aria-label="Fruits"
            options={options}
            name="fruit"
            required
            readOnly
            defaultValue={['apple']}
          />
          <button type="submit">Send</button>
        </form>,
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.getAll('fruit')).toEqual(['apple']);
    });
  });

  describe('unknown values (input-pickers#22)', () => {
    it('renders a selected value without an option as its raw value and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderPicker({ value: ['apple', 'kiwi'] });
      rerender(<TagPicker aria-label="Fruits" options={options} value={['apple', 'kiwi']} />);
      expect(tags()).toEqual(['Apple', 'kiwi']);
      const calls = warn.mock.calls.filter(([m]) => String(m).includes('kiwi'));
      expect(calls).toHaveLength(1);
      expect(String(calls[0][0])).toContain('[WaveUI] TagPicker');
    });

    it('Backspace targets the last rendered tag', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderPicker({ defaultValue: ['apple', 'kiwi'], onValueChange });
      await user.click(combobox());
      await user.keyboard('{Backspace}');
      expect(screen.getByRole('button', { name: 'Remove kiwi' })).toHaveFocus();
      await user.keyboard('{Backspace}');
      expect(onValueChange).toHaveBeenCalledWith(['apple']);
      expect(tags()).toEqual(['Apple']);
    });
  });

  describe('popup (input-pickers#12, #26, overlays#1, #36)', () => {
    it('keeps the list open while a tag is removed with the mouse', async () => {
      const user = userEvent.setup();
      renderPicker({ defaultValue: ['apple', 'banana'] });
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(combobox()).toHaveFocus();
      expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    });

    it('closes on a press outside and when focus leaves, without timers', async () => {
      const user = userEvent.setup();
      render(
        <>
          <TagPicker aria-label="Fruits" options={options} />
          <p>Outside</p>
          <button type="button">Elsewhere</button>
        </>,
      );
      await user.click(combobox());
      await user.click(screen.getByText('Outside'));
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      await user.click(combobox());
      await user.tab();
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders the open list in a portal', async () => {
      const user = userEvent.setup();
      const { container } = renderPicker();
      await user.click(combobox());
      expect(within(container).queryByRole('listbox')).toBeNull();
      expect(screen.getByRole('listbox').closest('[data-wave-portal]')).not.toBeNull();
    });

    it('leaves no "No matches" surface behind when it closes with typed text (input-pickers#21)', async () => {
      const user = userEvent.setup();
      render(
        <>
          <TagPicker aria-label="Fruits" options={options} />
          <p>Outside</p>
          <button type="button">Next</button>
        </>,
      );
      const noSurface = () => {
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('No matches')).toBeNull();
        expect(document.querySelector('[data-wave-listbox-surface]')).toBeNull();
      };
      await user.type(combobox(), 'ch');
      expect(screen.getByRole('option', { name: 'Cherry' })).toBeInTheDocument();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      noSurface();
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByText('Outside'));
      noSurface();
    });

    it('leaves Escape to the parent layer while every option is selected (overlays#1)', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <TagPicker
            aria-label="Fruits"
            options={options}
            defaultValue={['apple', 'banana', 'cherry', 'date']}
            onOpenChange={onOpenChange}
          />
        </ParentLayer>,
      );
      await user.click(combobox());
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('Escape closes only the list inside a parent layer', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn();
      render(
        <ParentLayer onDismiss={onParentDismiss}>
          <TagPicker aria-label="Fruits" options={options} />
        </ParentLayer>,
      );
      await user.click(combobox());
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });

    it('keeps a valid active option when the options shrink (input-pickers#26)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = renderPicker({ onValueChange });
      await user.click(combobox());
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Cherry');
      rerender(
        <TagPicker
          aria-label="Fruits"
          options={options.slice(0, 2)}
          onValueChange={onValueChange}
        />,
      );
      expect(combobox().getAttribute('aria-activedescendant') ?? '').toBe('');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).not.toBeNull();
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith(['apple']);
    });
  });

  describe('value (input-basic#29, table-core#3, #4)', () => {
    it('the deprecated onChange still fires and warns once', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onChange = vi.fn();
      renderPicker({ onChange });
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Apple' }));
      await user.click(screen.getByRole('option', { name: 'Date' }));
      expect(onChange.mock.calls).toEqual([[['apple']], [['apple', 'date']]]);
      const calls = warn.mock.calls.filter(([m]) => String(m).includes('`onChange`'));
      expect(calls).toHaveLength(1);
      expect(String(calls[0][0])).toContain('[WaveUI] TagPicker: `onChange` is deprecated');
    });

    it('fires the value callback exactly once per addition in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <TagPicker aria-label="Fruits" options={options} onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Banana' }));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('clears to no tags when a controlled value becomes undefined, and adopts a late value', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderPicker({ value: undefined });
      expect(tags()).toEqual([]);
      rerender(<TagPicker aria-label="Fruits" options={options} value={['date']} />);
      expect(tags()).toEqual(['Date']);
      rerender(<TagPicker aria-label="Fruits" options={options} value={undefined} />);
      expect(tags()).toEqual([]);
    });
  });

  describe('Field and forms (input-basic#1, #12)', () => {
    it('is labelled and described by its Field', () => {
      renderWithFieldContext(<TagPicker options={options} />, {
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
          <TagPicker options={options} required={false} />
        </form>,
        { required: true },
      );
      const control = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(control).not.toHaveAttribute('aria-required', 'true');
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });

    it('submits one entry per value', async () => {
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
          <TagPicker
            aria-label="Fruits"
            options={options}
            name="fruit"
            defaultValue={['apple', 'date']}
          />
          <button type="submit">Send</button>
        </form>,
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(data!.getAll('fruit')).toEqual(['apple', 'date']);
    });

    it('resets to its default value with the form (also without name)', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Order">
          <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']} />
          <button type="reset">Reset</button>
        </form>,
      );
      await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
      expect(tags()).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(tags()).toEqual(['Apple']);
    });

    it('blocks submission while required and empty', () => {
      render(
        <form aria-label="Order">
          <TagPicker aria-label="Fruits" options={options} name="fruit" required />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
    });
  });

  it('uses the input focus recipe instead of a ring (input-basic#9)', () => {
    renderPicker();
    expect(combobox()).toHaveClass('focus:outline-hidden');
    const control = screen.getByRole('group');
    expect(control).toHaveClass('focus-within:border-b-2');
    expect(control.className).not.toMatch(/ring/);
  });
});
