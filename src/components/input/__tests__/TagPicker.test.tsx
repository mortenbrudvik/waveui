import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import {
  TagPicker,
  type TagPickerLabels,
  type TagPickerOption,
  type TagPickerProps,
} from '../TagPicker';
import {
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
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
    const onOpenChange = vi.fn();
    renderPicker({ value: ['apple', 'banana'], onValueChange, onOpenChange });
    await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
    expect(onValueChange).toHaveBeenCalledWith(['banana']);
    expect(combobox()).toHaveFocus();
    // The click does not reach the group's open-on-click.
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
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

  describe('Enter and the surrounding form', () => {
    function renderInForm(onValueChange = vi.fn()) {
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <form aria-label="Order" onSubmit={onSubmit}>
          <TagPicker aria-label="Fruits" options={options} onValueChange={onValueChange} />
          <button type="submit">Save</button>
        </form>,
      );
      return onSubmit;
    }

    it('makes the first match of a typed filter active, so Enter adds it instead of submitting', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onSubmit = renderInForm(onValueChange);
      await user.type(combobox(), 'ban');
      expect(activeOption()).toHaveTextContent('Banana');
      await user.keyboard('{Enter}');
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onValueChange).toHaveBeenCalledWith(['banana']);
      expect(tags()).toEqual(['Banana']);
      // The text is cleared and the list stays open, with nothing active again.
      expect(combobox()).toHaveValue('');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toBeNull();
    });

    it('activates no option on open or once the typed text is cleared', async () => {
      const user = userEvent.setup();
      renderInForm();
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toBeNull();
      await user.type(combobox(), 'e');
      expect(activeOption()).toHaveTextContent('Apple');
      await user.type(combobox(), 'r');
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.clear(combobox());
      expect(activeOption()).toBeNull();
    });

    it('Enter with no typed text and the list closed submits the surrounding form', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onSubmit = renderInForm(onValueChange);
      combobox().focus();
      await user.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('Enter with typed text that matches no option (nothing highlighted) submits the surrounding form', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onSubmit = renderInForm(onValueChange);
      await user.type(combobox(), 'zzz');
      expect(activeOption()).toBeNull();
      await user.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onValueChange).not.toHaveBeenCalled();
    });
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
      const { container } = renderPicker();
      await user.type(combobox(), 'zzz');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      // (the page-level announcer is a status region too)
      expect(within(container).getByRole('status')).toHaveTextContent('No matches');
      const surface = document.querySelector<HTMLElement>('[data-wave-listbox-surface]')!;
      expect(within(surface).getByText('No matches')).toBeVisible();
    });

    it('announces "No matches" through a status region mounted before the text', async () => {
      const user = userEvent.setup();
      const { container } = renderPicker();
      // A live region added together with its text is not announced by every screen reader.
      const status = within(container).getByRole('status');
      expect(status).toBeEmptyDOMElement();
      await user.type(combobox(), 'zzz');
      expect(within(container).getByRole('status')).toBe(status);
      expect(status).toHaveTextContent('No matches');
      // The visible row in the popup is a copy, hidden from assistive technology.
      const surface = document.querySelector<HTMLElement>('[data-wave-listbox-surface]')!;
      expect(within(surface).getByText('No matches')).toHaveAttribute('aria-hidden', 'true');
      expect(within(surface).queryByRole('status')).toBeNull();
      await user.clear(combobox());
      await user.type(combobox(), 'ch');
      expect(screen.getByRole('option', { name: 'Cherry' })).toBeInTheDocument();
      expect(status).toBeEmptyDOMElement();
      await user.type(combobox(), 'zz');
      expect(status).toHaveTextContent('No matches');
      await user.keyboard('{Escape}');
      expect(status).toBeEmptyDOMElement();
    });

    it('marks the listbox multi-selectable', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(combobox());
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    });

    it.each([
      ['a defaultOpen', { defaultOpen: true }],
      ['an open', { open: true }],
    ])('renders %s list closed on the server, so every referenced id exists', (_label, props) => {
      const serverHtml = renderToString(
        <TagPicker aria-label="Fruits" options={options} {...props} />,
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
    ])('opens once hydrated (%s), without a hydration mismatch', async (_label, props) => {
      const element = <TagPicker aria-label="Fruits" options={options} {...props} />;
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
        expect(within(listbox).getAllByRole('option')).toHaveLength(options.length);
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
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

    it('gives the remove buttons their own padding and background (C-NATIVE)', () => {
      renderPicker({ defaultValue: ['apple', 'banana'] });
      for (const remove of screen.getAllByRole('button', { name: /^Remove/ })) {
        expect(remove).toHaveClass('p-0');
        expect(remove).toHaveClass('bg-transparent');
      }
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

    it('localises the remove names, the tag list, the summary, the announcements and "No matches" with labels', async () => {
      const user = userEvent.setup();
      const labels: TagPickerLabels = {
        remove: (label) => `Fjern ${label}`,
        selected: 'Valgt',
        summary: (selectedLabels) => `Valgt: ${selectedLabels.join(' og ')}`,
        added: (label, count) => `${label} lagt til, ${count} valgt`,
        removed: (label, count) => `${label} fjernet, ${count} valgt`,
        noMatches: 'Ingen treff',
      };
      const { container } = renderPicker({ defaultValue: ['apple'], labels });
      expect(screen.getByRole('list', { name: 'Valgt' })).toBeInTheDocument();
      expect(combobox()).toHaveAccessibleDescription('Valgt: Apple');
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Cherry' }));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Cherry lagt til, 2 valgt'));
      expect(combobox()).toHaveAccessibleDescription('Valgt: Apple og Cherry');
      await user.click(screen.getByRole('button', { name: 'Fjern Apple' }));
      await waitFor(() => expect(__getAnnouncerText()).toBe('Apple fjernet, 1 valgt'));
      await user.type(combobox(), 'zzz');
      expect(within(container).getByRole('status')).toHaveTextContent('Ingen treff');
      const surface = document.querySelector<HTMLElement>('[data-wave-listbox-surface]')!;
      expect(within(surface).getByText('Ingen treff')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByText('No matches')).toBeNull();
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

    it.each([
      ['readOnly', { readOnly: true }],
      ['disabled', { disabled: true }],
    ] as const)(
      'reports no close for a defaultOpen list that starts %s (it was never shown)',
      (_, lock) => {
        const onOpenChange = vi.fn();
        const { rerender } = renderPicker({ defaultOpen: true, onOpenChange, ...lock });
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        rerender(
          <TagPicker
            aria-label="Fruits"
            options={options}
            defaultOpen
            onOpenChange={onOpenChange}
          />,
        );
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );

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
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TagPicker: the selected value(s) "kiwi" match no option; the raw value is ' +
            'shown as the tag label.',
        ],
      ]);
    });

    it('Backspace targets the last rendered tag', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderPicker({ defaultValue: ['apple', 'kiwi'], onValueChange });
      await user.click(combobox());
      await user.keyboard('{Backspace}');
      expect(screen.getByRole('button', { name: 'Remove kiwi' })).toHaveFocus();
      await user.keyboard('{Backspace}');
      expect(onValueChange).toHaveBeenCalledWith(['apple']);
      expect(tags()).toEqual(['Apple']);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TagPicker: the selected value(s) "kiwi" match no option; the raw value is ' +
            'shown as the tag label.',
        ],
      ]);
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
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TagPicker: `onChange` is deprecated and will be removed in 1.0. Use ' +
            '`onValueChange` instead.',
        ],
      ]);
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
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = renderPicker({ value: undefined });
      expect(tags()).toEqual([]);
      rerender(<TagPicker aria-label="Fruits" options={options} value={['date']} />);
      expect(tags()).toEqual(['Date']);
      rerender(<TagPicker aria-label="Fruits" options={options} value={undefined} />);
      expect(tags()).toEqual([]);
      const modeSwitch = (from: string, to: string) =>
        `[WaveUI] A component is changing from ${from} to ${to}. Components should not switch ` +
        'between controlled and uncontrolled: pass `undefined` only when the component is ' +
        'uncontrolled, and the empty value (for example `[]`, `null` or `""`) to clear a ' +
        'controlled value.';
      expect(warn.mock.calls).toEqual([
        [modeSwitch('uncontrolled', 'controlled')],
        [modeSwitch('controlled', 'uncontrolled')],
      ]);
    });

    it('accepts readonly arrays and emits mutable copies (C-NAMING)', async () => {
      expectTypeOf<readonly TagPickerOption[]>().toExtend<TagPickerProps['options']>();
      expectTypeOf<readonly string[]>().toExtend<NonNullable<TagPickerProps['value']>>();
      expectTypeOf<readonly string[]>().toExtend<NonNullable<TagPickerProps['defaultValue']>>();
      expectTypeOf<Parameters<NonNullable<TagPickerProps['onValueChange']>>[0]>().toEqualTypeOf<
        string[]
      >();
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const fixedOptions = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
      ] as const;
      const fixedDefault = Object.freeze(['apple'] as const);
      render(
        <form aria-label="Order">
          <TagPicker
            aria-label="Fruits"
            options={fixedOptions}
            defaultValue={fixedDefault}
            onValueChange={onValueChange}
          />
          <button type="reset">Reset</button>
        </form>,
      );
      expect(tags()).toEqual(['Apple']);
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Banana' }));
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange.mock.calls).toEqual([[['apple', 'banana']], [['apple']]]);
      // The reset emits a copy of the (frozen) default, which the consumer may change.
      const emitted: string[] = onValueChange.mock.calls[1][0];
      expect(emitted).not.toBe(fixedDefault);
      expect(Object.isFrozen(emitted)).toBe(false);
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

    it('blocks submission inside a required Field until a tag is added', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(
        <form aria-label="Form">
          <TagPicker options={options} />
        </form>,
        { required: true },
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      // Natively required through the Field alone: no own `required` and no `name`.
      expect(form.checkValidity()).toBe(false);
      await user.click(combobox(FIELD_TEST_TEXT.label));
      await user.click(screen.getByRole('option', { name: 'Cherry' }));
      expect(form.checkValidity()).toBe(true);
    });

    it('names its open listbox after the Field label', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(<TagPicker options={options} />);
      await user.click(combobox(FIELD_TEST_TEXT.label));
      expect(screen.getByRole('listbox', { name: FIELD_TEST_TEXT.label })).toBeInTheDocument();
    });

    it('routes the text input attributes to the input', () => {
      render(
        <TagPicker
          aria-label="Fruits"
          options={options}
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={12}
          data-testid="root"
        />,
      );
      expect(combobox()).toHaveAttribute('autocapitalize', 'none');
      expect(combobox()).toHaveAttribute('autocorrect', 'off');
      expect(combobox()).toHaveAttribute('maxlength', '12');
      expect(combobox()).toHaveAttribute('autocomplete', 'off');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocapitalize');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocorrect');
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

    it('reports a reset only when it changes the tags (C-FORMS)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      function Parent() {
        const [count, setCount] = React.useState(0);
        return (
          <form aria-label="Order">
            {/* An inline default: a new array on every render of the parent. */}
            <TagPicker
              aria-label="Fruits"
              options={options}
              name="fruit"
              defaultValue={['apple', 'banana']}
              onValueChange={onValueChange}
            />
            <button type="button" onClick={() => setCount(count + 1)}>
              Renders {count}
            </button>
            <button type="reset">Reset</button>
          </form>
        );
      }
      render(<Parent />);
      await user.click(screen.getByRole('button', { name: 'Renders 0' }));
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(tags()).toEqual(['Apple', 'Banana']);

      // Same tags in another order: the reset restores the order and reports it.
      await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Apple' }));
      expect(tags()).toEqual(['Banana', 'Apple']);
      onValueChange.mockClear();
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange.mock.calls).toEqual([[['apple', 'banana']]]);
      expect(tags()).toEqual(['Apple', 'Banana']);
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

    it('is neither validated nor submitted while disabled', () => {
      render(
        <form aria-label="Order">
          <TagPicker aria-label="Fruits" options={options} name="fruit" required disabled />
          <TagPicker
            aria-label="Snacks"
            options={options}
            name="snack"
            required
            disabled
            defaultValue={['apple', 'date']}
          />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
      const data = new FormData(form);
      expect(data.getAll('fruit')).toEqual([]);
      expect(data.getAll('snack')).toEqual([]);
    });
  });

  describe('field look', () => {
    it('uses the input focus recipe instead of a ring (input-basic#9)', () => {
      renderPicker();
      expect(combobox()).toHaveClass('focus:outline-hidden');
      const control = screen.getByRole('group');
      expect(control).toHaveClass('focus-within:border-b-2');
      expect(control.className).not.toMatch(/ring/);
    });

    it('draws the field boundary with the accessible bottom stroke (WCAG 1.4.11)', () => {
      renderPicker();
      const control = screen.getByRole('group');
      expect(control).toHaveClass(
        'border',
        'border-input',
        'border-b-stroke-accessible',
        'focus-within:border-b-primary',
      );
      expect(control).not.toHaveClass('border-border');
      expect(control).not.toHaveClass('border-destructive');
    });

    it.each([
      ['its own aria-invalid', () => renderPicker({ 'aria-invalid': true })],
      [
        'a Field error',
        () =>
          renderWithFieldContext(<TagPicker options={options} />, {
            errorId: FIELD_TEST_IDS.errorId,
          }),
      ],
    ])('shows the destructive border while invalid through %s', (_, renderInvalid) => {
      renderInvalid();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
      const control = screen.getByRole('group');
      expect(control).toHaveClass(
        'border',
        'border-destructive',
        'focus-within:border-b-destructive',
      );
      for (const replaced of [
        'border-input',
        'border-b-stroke-accessible',
        'focus-within:border-b-primary',
      ]) {
        expect(control).not.toHaveClass(replaced);
      }
    });

    it('keeps the valid look when its own aria-invalid={false} overrides an invalid Field', () => {
      renderWithFieldContext(<TagPicker options={options} aria-invalid={false} />, {
        errorId: FIELD_TEST_IDS.errorId,
      });
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'false');
      const control = screen.getByRole('group');
      expect(control).toHaveClass('border-input', 'border-b-stroke-accessible');
      expect(control).not.toHaveClass('border-destructive');
    });
  });
});
