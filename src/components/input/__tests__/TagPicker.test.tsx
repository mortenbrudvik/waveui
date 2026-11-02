import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import {
  TagPicker,
  type TagPickerLabels,
  type TagPickerOption,
  type TagPickerProps,
  type TagPickerSize,
} from '../TagPicker';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  installResizeObserverMock,
  mockRect,
  openingTags,
  renderWithProviders,
  testNoImplicitSubmit,
  testRootPartRef,
  testSystemProps,
} from '../../../test-utils';
import { Tag } from '../../data-display/Tag';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';
import type { ListboxItem } from '../../../hooks/useListbox';
import { tagClassNames, tagPickerClassNames } from '../../../lib/classNames';

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
    ref: 'control',
    control: { role: 'combobox', tag: 'input' },
    defaultProps: { options, 'aria-label': 'Fruits' },
    conflictingClass: { className: 'static', overrides: 'relative' },
    a11yVariants: [
      { name: 'open', props: { defaultOpen: true } },
      { name: 'with a selected tag', props: { defaultValue: ['apple'] } },
      { name: 'open with a selected tag', props: { defaultOpen: true, defaultValue: ['apple'] } },
      { name: 'disabled with tags', props: { disabled: true, defaultValue: ['apple', 'date'] } },
      { name: 'read-only with tags', props: { readOnly: true, defaultValue: ['apple', 'date'] } },
      { name: 'clearable with tags', props: { clearable: true, defaultValue: ['apple', 'date'] } },
      {
        name: 'single line with tags',
        props: { overflow: 'count', defaultValue: ['apple', 'banana', 'date'] },
      },
      {
        name: 'allowCreate open with typed text',
        props: { allowCreate: true, defaultOpen: true, defaultQuery: 'infra' },
      },
    ],
  });

  testRootPartRef(TagPicker, { props: { options, 'aria-label': 'Fruits' } });

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
    it('has no onChange alias of onValueChange: the 0.4 name is removed in 1.0', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <TagPicker
          aria-label="Fruits"
          options={options}
          // @ts-expect-error -- `onChange(value)` is removed in 1.0: use `onValueChange`
          onChange={onChange}
          onValueChange={onValueChange}
        />,
      );
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Apple' }));
      await user.click(screen.getByRole('option', { name: 'Date' }));
      expect(onValueChange.mock.calls).toEqual([[['apple']], [['apple', 'date']]]);
      // Untyped code that still passes it gets no value: it is never called with the tags.
      expect(onChange).not.toHaveBeenCalledWith(expect.any(Array));
      expect(warn).not.toHaveBeenCalled();
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
      // Keeps the destructive border and shows the focus color on the focused bottom border
      // (Phase 4 D4).
      expect(control).toHaveClass('border', 'border-destructive', 'focus-within:border-b-primary');
      for (const replaced of ['border-input', 'border-b-stroke-accessible']) {
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

  describe('filter and query (P5-02, D12, D13)', () => {
    const PREFIX = (option: ListboxItem, query: string) =>
      option.label.toLowerCase().startsWith(query.toLowerCase());

    function listed() {
      return screen.queryAllByRole('option').map((o) => o.textContent);
    }

    /** A parent that owns the query: every onQueryChange call is recorded, then applied. */
    function ControlledQuery({
      onQueryChange,
      ...props
    }: Partial<TagPickerProps> & { onQueryChange: (query: string) => void }) {
      const [query, setQuery] = React.useState('');
      return (
        <TagPicker
          aria-label="Fruits"
          options={options}
          {...props}
          query={query}
          onQueryChange={(next) => {
            onQueryChange(next);
            setQuery(next);
          }}
        />
      );
    }

    describe('filter', () => {
      it('filters with a custom filter and keeps options that do not contain the text', async () => {
        const user = userEvent.setup();
        const { container } = render(
          <TagPicker
            aria-label="Fruits"
            options={[...options, { value: 'create', label: 'Create …' }]}
            filter={(option, query) =>
              option.value === 'create' ||
              option.label.toLowerCase().startsWith(query.toLowerCase())
            }
          />,
        );
        await user.type(combobox(), 'ba');
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
          'Banana',
          'Create …',
        ]);
        await user.type(combobox(), 'zz');
        expect(listed()).toEqual(['Create …']);
        expect(activeOption()).toHaveTextContent('Create …');
        expect(within(container).getByRole('status')).toBeEmptyDOMElement();
      });

      it('says "No matches" when a custom filter (a prefix match) keeps none', async () => {
        const user = userEvent.setup();
        const { container } = renderPicker({ filter: PREFIX });
        // The default match, a substring, would keep Apple, Cherry and Date for "e".
        await user.type(combobox(), 'e');
        expect(listed()).toEqual([]);
        expect(within(container).getByRole('status')).toHaveTextContent('No matches');
        await user.clear(combobox());
        await user.type(combobox(), 'ch');
        expect(listed()).toEqual(['Cherry']);
      });

      it('lists every option for any text with filter={() => true}; Enter adds the first', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderPicker({ filter: () => true, onValueChange });
        await user.type(combobox(), 'zzz');
        expect(listed()).toEqual(['Apple', 'Banana', 'Cherry', 'Date']);
        expect(activeOption()).toHaveTextContent('Apple');
        await user.keyboard('{Enter}');
        expect(onValueChange.mock.calls).toEqual([[['apple']]]);
      });

      it('is called with each listed option (a ListboxItem) and the typed text', async () => {
        const user = userEvent.setup();
        const filter = vi.fn((_option: ListboxItem, _query: string) => true);
        renderPicker({ filter, defaultValue: ['apple'] });
        await user.click(combobox());
        // Not while the text is empty.
        expect(filter).not.toHaveBeenCalled();
        await user.keyboard('x');
        expect(filter).toHaveBeenCalledWith({ value: 'banana', label: 'Banana' }, 'x');
        // A selected option is not listed, so the filter never sees it.
        expect(new Set(filter.mock.calls.map(([option]) => option.value))).toEqual(
          new Set(['banana', 'cherry', 'date']),
        );
      });

      it('supports async search with filter={() => true}', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
          const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
          const [apple, banana, cherry] = options;
          function Search() {
            const [query, setQuery] = React.useState('');
            const [results, setResults] = React.useState<TagPickerOption[]>([apple, banana]);
            React.useEffect(() => {
              const id = setTimeout(() => setResults(query ? [cherry] : [apple, banana]), 200);
              return () => clearTimeout(id);
            }, [query]);
            return (
              <TagPicker
                aria-label="Fruits"
                options={results}
                filter={() => true}
                query={query}
                onQueryChange={setQuery}
              />
            );
          }
          render(<Search />);
          await user.type(combobox(), 'x');
          // Loading: the previous results stay, the first of them active.
          expect(listed()).toEqual(['Apple', 'Banana']);
          expect(activeOption()).toHaveTextContent('Apple');
          await act(async () => {
            vi.advanceTimersByTime(250);
          });
          expect(listed()).toEqual(['Cherry']);
          expect(activeOption()).toHaveTextContent('Cherry');
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
            <TagPicker
              aria-label="Fruits"
              options={options}
              query={query}
              onQueryChange={setQuery}
              onKeyDown={() => setKeys((count) => count + 1)}
              filter={(option, text) => option.label.toLowerCase().includes(text.toLowerCase())}
            />
          );
        }
        render(<Parent />);
        act(() => combobox().focus());
        // The first ArrowDown opens the list on the first option, the second moves on.
        await user.keyboard('{ArrowDown}{ArrowDown}');
        expect(listed()).toEqual(['Apple', 'Cherry', 'Date']);
        expect(activeOption()).toHaveTextContent('Cherry');
        // Another key renders the parent (and a new filter) again: the highlight stays.
        await user.keyboard('{Shift}');
        expect(activeOption()).toHaveTextContent('Cherry');
      });
    });

    describe('query', () => {
      it('reports the typed text and its resets: a tag added, Escape with text, a form reset', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
          <form aria-label="Order">
            <ControlledQuery onQueryChange={onQueryChange} />
          </form>,
        );
        await user.type(combobox(), 'ch');
        await user.keyboard('{Enter}');
        expect(tags()).toEqual(['Cherry']);
        expect(combobox()).toHaveValue('');
        expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
        onQueryChange.mockClear();
        // The first Escape closes the list and keeps the text; the second clears it.
        await user.keyboard('ba{Escape}');
        expect(combobox()).toHaveValue('ba');
        await user.keyboard('{Escape}');
        expect(combobox()).toHaveValue('');
        expect(onQueryChange.mock.calls).toEqual([['b'], ['ba'], ['']]);
        onQueryChange.mockClear();
        await user.keyboard('da');
        act(() => (screen.getByRole('form', { name: 'Order' }) as HTMLFormElement).reset());
        expect(combobox()).toHaveValue('');
        expect(onQueryChange.mock.calls).toEqual([['d'], ['da'], ['']]);
      });

      it('keeps the query on a blur and a close (0.7)', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
          <>
            <ControlledQuery onQueryChange={onQueryChange} />
            <button type="button">Next</button>
          </>,
        );
        await user.type(combobox(), 'ch');
        await user.tab();
        expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(combobox()).toHaveValue('ch');
        expect(onQueryChange.mock.calls).toEqual([['c'], ['ch']]);
      });

      it('shows a controlled query, filters with it, and keeps one the parent keeps after a tag is added', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        renderPicker({ query: 'an', onQueryChange });
        expect(combobox()).toHaveValue('an');
        await user.click(combobox());
        expect(listed()).toEqual(['Banana']);
        expect(activeOption()).toHaveTextContent('Banana');
        await user.keyboard('{Enter}');
        expect(tags()).toEqual(['Banana']);
        expect(onQueryChange.mock.calls).toEqual([['']]);
        expect(combobox()).toHaveValue('an');
      });

      it('starts from defaultQuery: shown and filtering', async () => {
        const user = userEvent.setup();
        renderPicker({ defaultQuery: 'ch' });
        expect(combobox()).toHaveValue('ch');
        await user.click(combobox());
        expect(listed()).toEqual(['Cherry']);
      });

      it('calls onQueryChange once per change in StrictMode', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
          <React.StrictMode>
            <TagPicker aria-label="Fruits" options={options} onQueryChange={onQueryChange} />
          </React.StrictMode>,
        );
        await user.type(combobox(), 'ch');
        await user.keyboard('{Enter}');
        expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
      });
    });

    describe('locking (D12)', () => {
      it('reports a lock reset from an effect, once, without a render-phase update', () => {
        const error = vi.spyOn(console, 'error');
        const onQueryChange = vi.fn();
        // The parent stores the query, so a call during the render of the TagPicker would update
        // the parent while it renders, which React reports.
        function Parent({ disabled }: { disabled: boolean }) {
          const [query, setQuery] = React.useState('ch');
          return (
            <TagPicker
              aria-label="Fruits"
              options={options}
              query={query}
              onQueryChange={(next) => {
                onQueryChange(next);
                setQuery(next);
              }}
              disabled={disabled}
            />
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
            <TagPicker
              aria-label="Fruits"
              options={options}
              query={query}
              onQueryChange={(next) => {
                onQueryChange(next);
                setQuery(next);
              }}
              disabled={disabled}
            />
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
          const { rerender } = render(<ControlledQuery onQueryChange={onQueryChange} />);
          await user.type(combobox(), 'ch');
          rerender(<ControlledQuery onQueryChange={onQueryChange} {...lock} />);
          expect(combobox()).toHaveValue('');
          expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
          rerender(<ControlledQuery onQueryChange={onQueryChange} {...lock} />);
          rerender(<ControlledQuery onQueryChange={onQueryChange} />);
          expect(combobox()).toHaveValue('');
          expect(onQueryChange).toHaveBeenCalledTimes(3);
          // A render-phase call would make React log an update of the parent during the render of
          // the TagPicker.
          expect(error).not.toHaveBeenCalled();
        },
      );

      it('hides a query the parent keeps while locked, reports its reset once, and shows it unlocked', async () => {
        const onQueryChange = vi.fn();
        const make = (readOnly: boolean) => (
          <TagPicker
            aria-label="Fruits"
            options={options}
            query="ch"
            onQueryChange={onQueryChange}
            readOnly={readOnly}
          />
        );
        const { rerender } = render(make(false));
        expect(combobox()).toHaveValue('ch');
        rerender(make(true));
        expect(combobox()).toHaveValue('');
        // Later renders while locked, in tasks of their own (a parent that renders for another
        // reason), report nothing more.
        await act(async () => {});
        rerender(make(true));
        await act(async () => {});
        expect(combobox()).toHaveValue('');
        expect(onQueryChange.mock.calls).toEqual([['']]);
        rerender(make(false));
        expect(combobox()).toHaveValue('ch');
        expect(onQueryChange.mock.calls).toEqual([['']]);
      });

      it('drops a defaultQuery when it mounts locked and reports nothing (as defaultOpen)', () => {
        const onQueryChange = vi.fn();
        const make = (disabled: boolean) => (
          <TagPicker
            aria-label="Fruits"
            options={options}
            defaultQuery="ch"
            onQueryChange={onQueryChange}
            disabled={disabled}
          />
        );
        const { rerender } = render(make(true));
        expect(combobox()).toHaveValue('');
        rerender(make(false));
        expect(combobox()).toHaveValue('');
        expect(onQueryChange).not.toHaveBeenCalled();
      });
    });

    it('types filter, query, defaultQuery and onQueryChange', () => {
      expectTypeOf<TagPickerProps['filter']>().toEqualTypeOf<
        ((option: ListboxItem, query: string) => boolean) | undefined
      >();
      expectTypeOf<TagPickerProps['query']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TagPickerProps['defaultQuery']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TagPickerProps['onQueryChange']>().toEqualTypeOf<
        ((query: string) => void) | undefined
      >();
    });
  });

  describe('sizes and appearances (Phase 4 D12)', () => {
    const OPTIONS = [
      { value: 'a', label: 'Apple' },
      { value: 'b', label: 'Banana' },
    ];
    const input = () => screen.getByRole('combobox', { name: 'Fruit' });
    const control = () => input().closest('[data-wave-tagpicker-control]') as HTMLElement;
    const tag = () => screen.getByRole('listitem');

    /** A tag is a Tag one size smaller than the picker, filled and rounded (D54, D55). */
    const expectTag = (size: string) => {
      expect(tag()).toHaveClass(tagClassNames.root);
      expect(tag()).toHaveAttribute('data-size', size);
      expect(tag()).toHaveAttribute('data-appearance', 'filled');
      expect(tag()).toHaveAttribute('data-shape', 'rounded');
    };

    it('keeps the 0.7 classes at medium', () => {
      render(<TagPicker aria-label="Fruit" options={OPTIONS} defaultValue={['a']} />);
      expect(control()).toHaveClass('gap-1', 'px-2', 'py-1.5', 'border-input', 'pe-8');
      expectTag('extra-small');
      expect(input()).toHaveClass('py-0.5', 'text-body-1');
      const root = input().closest('[data-size]') as HTMLElement;
      expect(root).toHaveAttribute('data-size', 'medium');
      expect(root).toHaveAttribute('data-appearance', 'outline');
    });

    it('an untyped own size (small, or unknown) and appearance render the medium outline defaults', () => {
      for (const size of ['small', 'huge']) {
        const { unmount } = render(
          <TagPicker
            aria-label="Fruit"
            options={OPTIONS}
            defaultValue={['a']}
            size={size as unknown as TagPickerSize}
            appearance={'glass' as unknown as 'outline'}
          />,
        );
        expect(control()).toHaveClass('gap-1', 'px-2', 'py-1.5', 'border-input');
        expectTag('extra-small');
        const root = input().closest('[data-size]') as HTMLElement;
        expect(root).toHaveAttribute('data-size', 'medium');
        expect(root).toHaveAttribute('data-appearance', 'outline');
        unmount();
      }
    });

    it.each([
      ['large', ['gap-1.5', 'px-2.5', 'py-2'], 'small', ['py-1', 'text-body-1']],
      ['extra-large', ['gap-1.5', 'px-3', 'py-2.5'], 'medium', ['py-1', 'text-body-2']],
    ] as const)('%s', (size, controlClasses, tagSize, inputClasses) => {
      render(<TagPicker aria-label="Fruit" options={OPTIONS} defaultValue={['a']} size={size} />);
      expect(control()).toHaveClass(...controlClasses);
      expectTag(tagSize);
      expect(input()).toHaveClass(...inputClasses);
    });

    it('a Field small falls back to medium; a Field large is large', () => {
      const { unmount } = renderWithFieldContext(<TagPicker options={OPTIONS} />, {
        size: 'small',
      });
      const first = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(first.closest('[data-size]')).toHaveAttribute('data-size', 'medium');
      unmount();
      renderWithFieldContext(<TagPicker options={OPTIONS} />, { size: 'large' });
      const second = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(second.closest('[data-size]')).toHaveAttribute('data-size', 'large');
    });

    it('the control takes the appearance', () => {
      render(<TagPicker aria-label="Fruit" options={OPTIONS} appearance="underline" />);
      expect(control()).toHaveClass('border-0', 'border-b', 'rounded-none');
    });

    it('types: TagPicker has no small size', () => {
      expectTypeOf<TagPickerProps['size']>().toEqualTypeOf<TagPickerSize | undefined>();
      // @ts-expect-error TagPicker has no small size
      render(<TagPicker aria-label="Fruit" options={OPTIONS} size="small" />);
    });

    // Spec cases added beyond the brief (§2.2's Tests paragraph, binding via "as §2.1 for each
    // picker"; §2.1's Tests paragraph at line 334): each appearance with its data-appearance; an
    // own size winning over a Field size; WaveProvider inputDefaults with own props winning (a
    // provider "small" also gives "medium", since TagPicker has no small); invalid (a Field
    // error, and TagPicker's own aria-invalid, its 0.7 invalid state) at underline and
    // filled-darker; the remove buttons' 0.7 box and glyph at every size.

    it.each([
      ['outline', ['border-input', 'bg-background']],
      ['underline', ['rounded-none', 'border-0', 'border-b', 'bg-transparent']],
      ['filled-darker', ['border-input-filled-stroke', 'bg-input-filled-darker']],
      ['filled-lighter', ['border-input-filled-stroke', 'bg-input-filled-lighter']],
    ] as const)(
      'appearance="%s" renders its classes and data-appearance',
      (appearance, classes) => {
        render(<TagPicker aria-label="Fruit" options={OPTIONS} appearance={appearance} />);
        expect(control()).toHaveClass(...classes);
        const root = input().closest('[data-appearance]') as HTMLElement;
        expect(root).toHaveAttribute('data-appearance', appearance);
      },
    );

    it('an own size wins over a Field size', () => {
      const { rerender } = renderWithFieldContext(<TagPicker options={OPTIONS} />, {
        size: 'large',
      });
      const byName = () =>
        screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label }).closest('[data-size]');
      expect(byName()).toHaveAttribute('data-size', 'large');
      rerender(<TagPicker options={OPTIONS} size="extra-large" />);
      expect(byName()).toHaveAttribute('data-size', 'extra-large');
    });

    it('takes WaveProvider inputDefaults; its own props win (a provider "small" gives "medium")', () => {
      const { rerender } = renderWithProviders(<TagPicker aria-label="Fruit" options={OPTIONS} />, {
        inputDefaults: { size: 'small', appearance: 'underline' },
      });
      const root = () =>
        screen.getByRole('combobox', { name: 'Fruit' }).closest('[data-size]') as HTMLElement;
      expect(root()).toHaveAttribute('data-size', 'medium');
      expect(root()).toHaveAttribute('data-appearance', 'underline');
      rerender(
        <TagPicker aria-label="Fruit" options={OPTIONS} size="extra-large" appearance="outline" />,
      );
      expect(root()).toHaveAttribute('data-size', 'extra-large');
      expect(root()).toHaveAttribute('data-appearance', 'outline');
    });

    it.each(['underline', 'filled-darker'] as const)(
      'an invalid %s field keeps the destructive border and the focus color on its bottom (own aria-invalid)',
      (appearance) => {
        render(
          <TagPicker aria-label="Fruit" options={OPTIONS} appearance={appearance} aria-invalid />,
        );
        expect(control()).toHaveClass('border-destructive', 'focus-within:border-b-primary');
      },
    );

    it.each(['underline', 'filled-darker'] as const)(
      'an invalid %s field keeps the destructive border and the focus color on its bottom (Field error)',
      (appearance) => {
        renderWithFieldContext(<TagPicker options={OPTIONS} appearance={appearance} />, {
          errorId: FIELD_TEST_IDS.errorId,
        });
        const fieldControl = screen
          .getByRole('combobox', { name: FIELD_TEST_TEXT.label })
          .closest('[data-wave-tagpicker-control]') as HTMLElement;
        expect(fieldControl).toHaveClass('border-destructive', 'focus-within:border-b-primary');
      },
    );

    it.each([
      ['medium', ['size-4'], '10'],
      ['large', ['size-4'], '12'],
      ['extra-large', ['size-5'], '12'],
    ] as const)(
      'gives the remove button Tag\'s Dismiss box and glyph at size="%s"',
      (size, box, glyph) => {
        render(<TagPicker aria-label="Fruit" options={OPTIONS} defaultValue={['a']} size={size} />);
        const remove = screen.getByRole('button', { name: 'Remove Apple' });
        expect(remove).toHaveClass(
          tagClassNames.dismissButton,
          tagPickerClassNames.removeButton,
          'p-0',
          'bg-transparent',
          ...box,
        );
        expect(remove).not.toHaveClass('ms-0.5');
        expect(remove).not.toHaveClass('rounded-sm');
        expect(remove.querySelector('svg')).toHaveAttribute('width', glyph);
      },
    );
  });
  describe('Phase 6: Tag-based tags, the end buttons and the field (P6-04)', () => {
    const removeButton = (label: string) => screen.getByRole('button', { name: `Remove ${label}` });
    const control = () => combobox().closest<HTMLElement>('[data-wave-tagpicker-control]')!;
    /** After the microtask a focus move runs in, focus never fell to the page. */
    const settle = async () => {
      await act(async () => {});
      expect(document.activeElement).not.toBe(document.body);
    };

    describe('focus after a removal (D56)', () => {
      it("removes a middle tag with Delete and focuses the next tag's remove button; the last tag hands focus to the input", async () => {
        const user = userEvent.setup();
        renderPicker({ defaultValue: ['apple', 'banana', 'cherry'] });
        act(() => removeButton('Banana').focus());
        await user.keyboard('{Delete}');
        await settle();
        expect(tags()).toEqual(['Apple', 'Cherry']);
        expect(removeButton('Cherry')).toHaveFocus();
        await user.keyboard('{Delete}');
        await settle();
        expect(tags()).toEqual(['Apple']);
        expect(combobox()).toHaveFocus();
      });

      it('a pointer click on a remove button focuses the input, also on a middle tag', async () => {
        const user = userEvent.setup();
        renderPicker({ defaultValue: ['apple', 'banana', 'cherry'] });
        await user.click(removeButton('Banana'));
        await settle();
        expect(tags()).toEqual(['Apple', 'Cherry']);
        expect(combobox()).toHaveFocus();
        act(() => removeButton('Apple').focus());
        fireEvent.click(removeButton('Apple'), { detail: 1 });
        await settle();
        expect(combobox()).toHaveFocus();
      });

      it('focuses the next tag when a controlled value drops a focused middle tag', async () => {
        const { rerender } = renderPicker({ value: ['apple', 'banana', 'cherry'] });
        act(() => removeButton('Banana').focus());
        rerender(<TagPicker aria-label="Fruits" options={options} value={['apple', 'cherry']} />);
        await settle();
        expect(removeButton('Cherry')).toHaveFocus();
      });

      it('moves no focus when a controlled parent keeps the tag after a keyboard removal', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderPicker({ value: ['apple', 'banana'], onValueChange });
        act(() => removeButton('Apple').focus());
        await user.keyboard('{Delete}');
        await settle();
        expect(onValueChange).toHaveBeenCalledWith(['banana']);
        expect(tags()).toEqual(['Apple', 'Banana']);
        expect(removeButton('Apple')).toHaveFocus();
      });

      it('keeps focus on a remove button while the picker is disabled under it, then skips it', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const ui = (disabled: boolean) => (
          <>
            <TagPicker
              aria-label="Fruits"
              options={options}
              defaultValue={['apple', 'banana']}
              disabled={disabled}
              onValueChange={onValueChange}
            />
            <button type="button">After</button>
          </>
        );
        const { rerender } = render(ui(false));
        act(() => removeButton('Apple').focus());
        rerender(ui(true));
        await settle();
        const held = removeButton('Apple');
        expect(held).toHaveFocus();
        expect(held).toHaveAttribute('aria-disabled', 'true');
        expect(held).not.toBeDisabled();
        expect(control()).toHaveClass('opacity-50', 'has-focus-visible:opacity-100');
        await user.keyboard('{Enter}{Delete}');
        expect(onValueChange).not.toHaveBeenCalled();
        await user.tab();
        expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
        expect(removeButton('Apple')).toBeDisabled();
        await user.tab({ shift: true });
        expect(screen.getByRole('button', { name: 'After' })).not.toHaveFocus();
        expect(removeButton('Apple')).not.toHaveFocus();
      });

      it('calls onValueChange once per removal and onOptionCreate once per creation in StrictMode', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const onOptionCreate = vi.fn();
        render(
          <React.StrictMode>
            <TagPicker
              aria-label="Fruits"
              options={options}
              defaultValue={['apple', 'banana']}
              allowCreate
              onValueChange={onValueChange}
              onOptionCreate={onOptionCreate}
            />
          </React.StrictMode>,
        );
        await user.click(removeButton('Apple'));
        expect(onValueChange).toHaveBeenCalledTimes(1);
        act(() => removeButton('Banana').focus());
        await user.keyboard('{Backspace}');
        expect(onValueChange).toHaveBeenCalledTimes(2);
        await user.type(combobox(), 'kiwi{Enter}');
        expect(onOptionCreate).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenCalledTimes(3);
        expect(onValueChange).toHaveBeenLastCalledWith(['kiwi']);
      });
    });

    it('dims the disabled field once', () => {
      renderPicker({ disabled: true, clearable: true, defaultValue: ['apple'] });
      expect(control()).toHaveClass('opacity-50');
      expect(screen.getByRole('listitem')).not.toHaveClass('opacity-50');
      expect(screen.getByRole('button', { name: 'Show options' })).not.toHaveClass(
        'disabled:opacity-50',
      );
      const clear = screen.getByRole('button', { name: 'Clear selection' });
      expect(clear.className).not.toMatch(/opacity/);
      expect(combobox().className).not.toMatch(/opacity/);
      expect(removeButton('Apple').className).not.toMatch(/(^|\s)disabled:opacity-50/);
    });

    describe('the previous arrow and the field press (D57, D66)', () => {
      it('the previous arrow at the start of the text focuses the last tag; not with text before the caret, a selection or a modifier', async () => {
        const user = userEvent.setup();
        renderPicker({ defaultValue: ['apple', 'banana'] });
        await user.click(combobox());
        await user.keyboard('{ArrowLeft}');
        expect(removeButton('Banana')).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(combobox()).toHaveFocus();
        await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
        expect(combobox()).toHaveFocus();
        await user.keyboard('ab{ArrowLeft}');
        expect(combobox()).toHaveFocus();
        act(() => (combobox() as HTMLInputElement).setSelectionRange(0, 2));
        await user.keyboard('{ArrowLeft}');
        expect(combobox()).toHaveFocus();
      });

      it('mirrors the previous arrow in RTL', async () => {
        const user = userEvent.setup();
        renderWithProviders(
          <TagPicker aria-label="Fruits" options={options} defaultValue={['apple', 'banana']} />,
          { dir: 'rtl' },
        );
        await user.click(combobox());
        await user.keyboard('{ArrowLeft}');
        expect(combobox()).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(removeButton('Banana')).toHaveFocus();
      });

      it("a press on the control's empty area toggles the list and keeps focus in the input; a press on a tag's text does the same; read-only only focuses; disabled does nothing", async () => {
        const onOpenChange = vi.fn();
        const { unmount } = renderPicker({ defaultValue: ['apple'], onOpenChange });
        const press = (target: Element) => {
          const allowed = fireEvent.mouseDown(target, { button: 0 });
          fireEvent.click(target);
          return allowed;
        };
        expect(press(control())).toBe(false);
        expect(combobox()).toHaveFocus();
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
        expect(press(control())).toBe(false);
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        const text = within(screen.getByRole('listitem')).getByText('Apple');
        expect(press(text)).toBe(false);
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
        expect(combobox()).toHaveFocus();
        unmount();

        const readOnly = renderPicker({ readOnly: true, defaultValue: ['apple'], onOpenChange });
        onOpenChange.mockClear();
        expect(press(control())).toBe(false);
        expect(combobox()).toHaveFocus();
        expect(onOpenChange).not.toHaveBeenCalled();
        readOnly.unmount();

        renderPicker({ disabled: true, defaultValue: ['apple'], onOpenChange });
        expect(press(control())).toBe(true);
        expect(combobox()).not.toHaveFocus();
        expect(onOpenChange).not.toHaveBeenCalled();
      });

      it('a click on the input opens the list and never closes it', async () => {
        const user = userEvent.setup();
        renderPicker();
        await user.click(combobox());
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
        await user.click(combobox());
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      });
    });

    describe('filter and the exact match (D58, D60)', () => {
      it('the default filter matches textValue before label', async () => {
        const user = userEvent.setup();
        render(
          <TagPicker aria-label="Fruits">
            <TagPicker.Control />
            <TagPicker.List>
              <TagPicker.Option value="ny" textValue="Big Apple">
                New York
              </TagPicker.Option>
              <TagPicker.Option value="la">Los Angeles</TagPicker.Option>
            </TagPicker.List>
          </TagPicker>,
        );
        await user.type(combobox(), 'big');
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['New York']);
        await user.clear(combobox());
        await user.type(combobox(), 'york');
        expect(screen.queryAllByRole('option')).toEqual([]);
      });

      const fruits = [
        { value: 'pineapple', label: 'Pineapple' },
        { value: 'apple', label: 'Apple' },
      ];

      it('makes the option whose label equals the typed text active (Pineapple, Apple → apple)', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(<TagPicker aria-label="Fruits" options={fruits} onValueChange={onValueChange} />);
        await user.type(combobox(), 'appl');
        expect(activeOption()).toHaveTextContent('Pineapple');
        await user.type(combobox(), 'e');
        expect(activeOption()).toHaveTextContent(/^Apple$/);
        await user.keyboard('{Enter}');
        expect(onValueChange).toHaveBeenCalledWith(['apple']);
      });

      it('ranks a pasted text too', async () => {
        const user = userEvent.setup();
        render(<TagPicker aria-label="Fruits" options={fruits} />);
        await user.click(combobox());
        await user.paste('APPLE');
        expect(activeOption()).toHaveTextContent(/^Apple$/);
      });

      it('does not re-rank a controlled query set by the parent', () => {
        const { rerender } = render(
          <TagPicker aria-label="Fruits" options={fruits} query="" open />,
        );
        rerender(<TagPicker aria-label="Fruits" options={fruits} query="apple" open />);
        expect(activeOption()).toHaveTextContent('Pineapple');
      });
    });

    describe('the expand button (D61)', () => {
      const expand = () => screen.getByRole('button', { name: 'Show options' });

      it('shows a chevron named Show options, not a Tab stop, with aria-expanded and aria-controls only while expanded', async () => {
        const user = userEvent.setup();
        renderPicker();
        expect(expand()).toHaveAttribute('tabindex', '-1');
        expect(expand()).toHaveAttribute('type', 'button');
        expect(expand()).toHaveAttribute('aria-expanded', 'false');
        expect(expand()).not.toHaveAttribute('aria-controls');
        expect(expand().querySelector('svg')).not.toBeNull();
        await user.click(combobox());
        expect(expand()).toHaveAttribute('aria-expanded', 'true');
        expect(expand()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
      });

      it('toggles the list on click and keeps focus in the input', async () => {
        const user = userEvent.setup();
        renderPicker();
        await user.click(expand());
        expect(combobox()).toHaveAttribute('aria-expanded', 'true');
        expect(combobox()).toHaveFocus();
        await user.click(expand());
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(combobox()).toHaveFocus();
      });

      it('is disabled while disabled or read-only', () => {
        const { unmount } = renderPicker({ disabled: true });
        expect(expand()).toBeDisabled();
        unmount();
        renderPicker({ readOnly: true });
        expect(expand()).toBeDisabled();
      });

      it.each([null, undefined])('keeps the chevron for %s', (expandIcon) => {
        renderPicker({ expandIcon });
        expect(expand().querySelector('svg')).not.toBeNull();
        expect(control()).toHaveClass('pe-8');
      });

      it.each([false, '', [], <></>])('hides the button and its padding for %s', (expandIcon) => {
        renderPicker({ expandIcon });
        expect(screen.queryByRole('button', { name: 'Show options' })).toBeNull();
        expect(control().className).not.toMatch(/(^|\s)pe-/);
      });

      it('renders a custom glyph', () => {
        renderPicker({ expandIcon: <svg data-testid="own-glyph" /> });
        expect(within(expand()).getByTestId('own-glyph').parentElement).toHaveClass(
          tagPickerClassNames.expandIcon,
        );
      });

      it('unwraps a button glyph and warns TagPicker:expandIcon-button', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderPicker({ expandIcon: <button type="button">v</button> });
        expect(expand().querySelector('button')).toBeNull();
        expect(expand()).toHaveTextContent('v');
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] TagPicker: `expandIcon` received a button element; its children render as the glyph of the built-in expand button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.',
          ],
        ]);
      });

      it("unwraps a button glyph of TagPicker.Control's expandIcon and warns TagPicker.Control:expandIcon-button", () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(
          <TagPicker aria-label="Fruits" options={options}>
            <TagPicker.Control expandIcon={<button type="button">v</button>} />
          </TagPicker>,
        );
        expect(expand().querySelector('button')).toBeNull();
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] TagPicker.Control: `expandIcon` received a button element; its children render as the glyph of the built-in expand button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.',
          ],
        ]);
      });

      it("TagPicker.Control's expandIcon wins over the root's", () => {
        const { unmount } = render(
          <TagPicker aria-label="Fruits" options={options} expandIcon={<svg data-testid="root" />}>
            <TagPicker.Control expandIcon={<svg data-testid="control" />} />
          </TagPicker>,
        );
        expect(screen.getByTestId('control')).toBeInTheDocument();
        expect(screen.queryByTestId('root')).toBeNull();
        unmount();
        render(
          <TagPicker aria-label="Fruits" options={options} expandIcon={<svg data-testid="root" />}>
            <TagPicker.Control expandIcon={false} />
          </TagPicker>,
        );
        expect(screen.queryByRole('button', { name: 'Show options' })).toBeNull();
      });

      it.each([
        ['medium', 'top-1.5', ['h-6', 'w-6'], '12', 'pe-8'],
        ['large', 'top-1.5', ['size-8'], '16', 'pe-10'],
        ['extra-large', 'top-2.25', ['size-8'], '16', 'pe-10'],
      ] as const)(
        'places the end buttons on the first row at size=%s',
        (size, top, box, glyph, padding) => {
          renderPicker({ size });
          expect(expand()).toHaveClass('absolute', 'end-1', top, ...box);
          expect(expand().querySelector('svg')).toHaveAttribute('width', glyph);
          expect(control()).toHaveClass('relative', padding);
        },
      );
    });

    describe('the clear button (D61)', () => {
      const clear = () => screen.getByRole('button', { name: 'Clear selection' });
      const queryClear = () => screen.queryByRole('button', { name: 'Clear selection' });

      it('renders no clear button without tags, while read-only, or without clearable', () => {
        const a = renderPicker({ clearable: true });
        expect(queryClear()).toBeNull();
        a.unmount();
        const b = renderPicker({ clearable: true, readOnly: true, defaultValue: ['apple'] });
        expect(queryClear()).toBeNull();
        b.unmount();
        renderPicker({ defaultValue: ['apple'] });
        expect(queryClear()).toBeNull();
      });

      it('is a Tab stop after the input, named Clear selection', async () => {
        const user = userEvent.setup();
        renderPicker({ clearable: true, defaultValue: ['apple'] });
        act(() => combobox().focus());
        await user.tab();
        expect(clear()).toHaveFocus();
        expect(clear()).toHaveAttribute('type', 'button');
        expect(clear()).toHaveClass('end-7', 'top-1.5');
        expect(control()).toHaveClass('pe-14');
      });

      it('clears every tag once, the query, closes the list and focuses the input, announcing nothing', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const onQueryChange = vi.fn();
        renderPicker({
          clearable: true,
          defaultValue: ['apple', 'banana'],
          onValueChange,
          onQueryChange,
        });
        await user.type(combobox(), 'ch');
        await waitFor(() => expect(__getAnnouncerText()).toBe(''));
        onQueryChange.mockClear();
        await user.click(clear());
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenCalledWith([]);
        expect(onQueryChange).toHaveBeenCalledWith('');
        expect(combobox()).toHaveValue('');
        expect(combobox()).toHaveAttribute('aria-expanded', 'false');
        expect(combobox()).toHaveFocus();
        expect(tags()).toEqual([]);
        await act(async () => {});
        expect(__getAnnouncerText()).toBe('');
      });

      it('is natively disabled while disabled', () => {
        renderPicker({ clearable: true, disabled: true, defaultValue: ['apple'] });
        expect(clear()).toBeDisabled();
      });

      it('labels.clear names it', () => {
        renderPicker({ clearable: true, defaultValue: ['apple'], labels: { clear: 'Tøm' } });
        expect(screen.getByRole('button', { name: 'Tøm' })).toBeInTheDocument();
      });

      it('readOnly turning on, or a controlled parent emptying the value, while the clear button has focus moves focus to the input', async () => {
        const ui = (props: Partial<TagPickerProps>) => (
          <TagPicker aria-label="Fruits" options={options} clearable {...props} />
        );
        const { rerender } = render(ui({ value: ['apple'] }));
        act(() => clear().focus());
        rerender(ui({ value: ['apple'], readOnly: true }));
        await settle();
        expect(combobox()).toHaveFocus();
        rerender(ui({ value: ['apple'] }));
        act(() => clear().focus());
        rerender(ui({ value: [] }));
        await settle();
        expect(combobox()).toHaveFocus();
      });

      it('keeps focus on the clear button while the picker is disabled under it: aria-disabled and data-disabled-focusable, Enter and a click do nothing, then Tab leaves it and it is natively disabled', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const ui = (disabled: boolean) => (
          <>
            <TagPicker
              aria-label="Fruits"
              options={options}
              clearable
              defaultValue={['apple']}
              disabled={disabled}
              onValueChange={onValueChange}
            />
            <button type="button">After</button>
          </>
        );
        const { rerender } = render(ui(false));
        act(() => clear().focus());
        rerender(ui(true));
        await settle();
        expect(clear()).toHaveFocus();
        expect(clear()).toHaveAttribute('aria-disabled', 'true');
        expect(clear()).toHaveAttribute('data-disabled-focusable', '');
        expect(control()).toHaveClass('has-focus-visible:opacity-100');
        await user.keyboard('{Enter} ');
        fireEvent.click(clear(), { detail: 1 });
        expect(onValueChange).not.toHaveBeenCalled();
        expect(tags()).toEqual(['Apple']);
        await user.tab();
        expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
        expect(clear()).toBeDisabled();
      });

      it('focuses the TagPicker.Button trigger after a clear', async () => {
        const user = userEvent.setup();
        render(
          <TagPicker aria-label="Fruits" options={options} clearable defaultValue={['apple']}>
            <TagPicker.Control>
              <TagPicker.Group />
              <TagPicker.Button />
            </TagPicker.Control>
          </TagPicker>,
        );
        await user.click(clear());
        expect(combobox()).toHaveFocus();
        expect(combobox().tagName).toBe('BUTTON');
        expect(tags()).toEqual([]);
      });
    });

    it("renders data-overflow='wrap' by default", () => {
      renderPicker();
      expect(control().parentElement).toHaveAttribute('data-overflow', 'wrap');
      expect(control().parentElement).not.toHaveAttribute('data-collapsed');
    });

    it('keeps the default look pinned (D68, Phase 4 rule 14)', () => {
      renderPicker({ defaultValue: ['apple'] });
      expect(control()).toHaveClass(
        'relative',
        'flex',
        'flex-wrap',
        'items-center',
        'gap-1',
        'px-2',
        'py-1.5',
        'pe-8',
        'border-input',
      );
      expect(screen.getByRole('list', { name: 'Selected' })).toHaveClass(
        'flex',
        'flex-wrap',
        'items-center',
        'gap-1',
      );
      expect(screen.getByRole('listitem')).toHaveClass('rounded', 'min-h-5', 'bg-muted');
    });
  });
});

describe('TagPicker — slotProps', () => {
  type TagPickerSlotProps = NonNullable<TagPickerProps['slotProps']>;
  const EVERY_PART: TagPickerSlotProps = {
    root: {},
    tag: {},
    removeButton: {},
    expandButton: {},
    clearButton: {},
    option: {},
    createOption: {},
    overflowCount: {},
    surface: {},
    emptyMessage: {},
  };
  const part = (name: string) => document.querySelector<HTMLElement>(`.${name}`);
  const all = (name: string) => Array.from(document.querySelectorAll<HTMLElement>(`.${name}`));
  const TWO = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
  ];

  it('renders the 0.17.1 parts without slotProps (opening tags, attributes sorted)', async () => {
    // Captured from b8941ef, open client renders: the merged props may put the class before the
    // locked attributes.
    const first = render(
      <TagPicker aria-label="Fruit" options={TWO} defaultValue={['apple']} defaultOpen clearable />,
    );
    await act(async () => {});
    const { tag, removeButton, clearButton, expandButton, surface, option, emptyMessage } =
      tagPickerClassNames;
    expect(
      openingTags(...[tag, removeButton, clearButton, expandButton, surface, option].flatMap(all)),
    ).toBe(
      [
        '<span class="wave-tag inline-flex items-center border min-h-5 gap-0.5 text-caption-1 ps-1.75 pe-px border-transparent bg-muted text-foreground rounded wave-tag-picker__tag" data-appearance="filled" data-shape="rounded" data-size="extra-small" data-wave-tag-item="" role="listitem">',
        '<button aria-label="Remove Apple" class="wave-tag__dismiss-button relative inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-inherit before:absolute disabled:cursor-not-allowed forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight] size-4 before:-inset-1 disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:focus-visible:opacity-100 not-disabled:not-aria-disabled:hover:bg-muted-hover not-disabled:not-aria-disabled:active:bg-muted-pressed focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 wave-tag-picker__remove-button" data-wave-tag-dismiss="" type="button">',
        '<button aria-label="Clear selection" class="wave-tag-picker__clear-button top-1.5 absolute flex h-6 w-6 items-center justify-center rounded bg-transparent p-0 text-muted-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground end-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed aria-disabled:cursor-not-allowed" type="button">',
        '<button aria-controls="tagpicker-listbox-_id0_" aria-expanded="true" aria-label="Show options" class="wave-tag-picker__expand-button top-1.5 absolute flex h-6 w-6 items-center justify-center rounded bg-transparent p-0 text-muted-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground end-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:focus-visible:opacity-100" tabindex="-1" type="button">',
        '<div class="wave-listbox-surface flex flex-col overflow-hidden rounded border border-border bg-background py-1 text-foreground shadow-4 wave-tag-picker__surface" data-align="start" data-side="bottom" data-wave-listbox-surface="" style="position: fixed; left: 0px; top: 0px; width: var(--wave-popup-reference-width); max-width: var(--wave-popup-available-width); max-height: var(--wave-popup-available-height); transform: translate(8px, 4px); --wave-popup-available-width: 0px; --wave-popup-available-height: 0px; --wave-popup-reference-width: 0px;">',
        '<li aria-selected="false" class="wave-option flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-body-1 text-foreground bg-(--option-bg) [--option-bg:transparent] not-disabled:not-aria-disabled:hover:[--option-bg:var(--wave-subtle-hover)] data-[selected]:[--option-bg:var(--wave-subtle-selected)] data-[active]:[--option-bg:var(--wave-subtle-hover)] data-[active]:outline-2 data-[active]:-outline-offset-2 data-[active]:outline-ring aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground wave-tag-picker-option wave-tag-picker__option" data-value="banana" id="tagpicker-listbox-_id0_-opt-0" role="option">',
      ].join('\n'),
    );
    first.unmount();

    const second = render(
      <TagPicker
        aria-label="Fruit"
        options={[{ value: 'apple', label: 'Apple' }]}
        defaultOpen
        defaultQuery="kiwi"
        allowCreate
      />,
    );
    await act(async () => {});
    expect(openingTags(...all(option))).toBe(
      [
        '<li aria-selected="false" class="wave-option flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-body-1 text-foreground bg-(--option-bg) [--option-bg:transparent] not-disabled:not-aria-disabled:hover:[--option-bg:var(--wave-subtle-hover)] data-[selected]:[--option-bg:var(--wave-subtle-selected)] data-[active]:[--option-bg:var(--wave-subtle-hover)] data-[active]:outline-2 data-[active]:-outline-offset-2 data-[active]:outline-ring aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground wave-tag-picker__option wave-tag-picker__create-option" data-active="" data-create="" data-value="tagpicker-create-_id0_" id="tagpicker-listbox-_id1_-opt-0" role="option">',
      ].join('\n'),
    );
    second.unmount();

    render(
      <TagPicker
        aria-label="Fruit"
        options={[{ value: 'apple', label: 'Apple' }]}
        defaultOpen
        defaultQuery="zzz"
      />,
    );
    await act(async () => {});
    expect(openingTags(...[surface, emptyMessage].flatMap(all))).toBe(
      [
        '<div class="wave-listbox-surface flex flex-col overflow-hidden rounded border border-border bg-background py-1 text-foreground shadow-4 wave-tag-picker__surface" data-align="start" data-side="bottom" data-wave-listbox-surface="" style="position: fixed; left: 0px; top: 0px; width: var(--wave-popup-reference-width); max-width: var(--wave-popup-available-width); max-height: var(--wave-popup-available-height); transform: translate(8px, 4px); --wave-popup-available-width: 0px; --wave-popup-available-height: 0px; --wave-popup-reference-width: 0px;">',
        '<div aria-hidden="true" class="wave-tag-picker__empty-message px-3 py-1.5 text-body-1 text-muted-foreground">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: TagPickerProps[] = [
      { defaultValue: ['apple'], defaultOpen: true, clearable: true },
      { defaultValue: ['apple'], defaultOpen: true, defaultQuery: 'kiwi', allowCreate: true },
      { defaultOpen: true, defaultQuery: 'zzz' },
      { defaultValue: ['apple', 'banana'], clearable: true, disabled: true },
      { defaultValue: ['apple'], clearable: true, readOnly: true },
      { defaultValue: ['apple'], expandIcon: false, size: 'large' },
      // The root's own props: the rest, the style and the hidden state.
      {
        className: 'c',
        style: { color: 'red' },
        title: 't',
        hidden: true,
        inert: true,
        'aria-hidden': true,
        onPointerDown: () => {},
      },
      // The single-line layout's data attributes.
      { defaultValue: ['apple', 'banana'], overflow: 'count' },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => (
          <TagPicker aria-label="Fruit" options={options} {...props} slotProps={slotProps} />
        ),
        EVERY_PART,
      );
    }
    // Your own data attributes on the root, the locked ones among them.
    expectInertSlotProps(
      (slotProps) => (
        <TagPicker
          aria-label="Fruit"
          options={options}
          data-size="large"
          data-overflow="count"
          data-x="1"
          slotProps={slotProps}
        />
      ),
      EVERY_PART,
    );
    // The Button trigger.
    expectInertSlotProps(
      (slotProps) => (
        <TagPicker
          aria-label="Fruit"
          options={options}
          defaultValue={['apple']}
          slotProps={slotProps}
        >
          <TagPicker.Control>
            <TagPicker.Group />
            <TagPicker.Button />
          </TagPicker.Control>
        </TagPicker>
      ),
      EVERY_PART,
    );
    expectInertSlotProps(
      (slotProps) => (
        <TagPicker
          aria-label="Fruit"
          defaultValue={['a']}
          defaultOpen
          defaultQuery="kiwi"
          allowCreate
          slotProps={slotProps}
        >
          <TagPicker.Control>
            <TagPicker.Group />
            <TagPicker.Input />
          </TagPicker.Control>
          <TagPicker.List>
            <TagPicker.Option value="a">Apple</TagPicker.Option>
            <TagPicker.Option value="k">Kale</TagPicker.Option>
          </TagPicker.List>
        </TagPicker>
      ),
      EVERY_PART,
    );
  });

  it('puts your className, style, data-* and ref on each part, after its stable class and own classes', async () => {
    const mine = <E extends HTMLElement>(name: string, ref: React.Ref<E>) => ({
      ref,
      className: `my-${name}`,
      style: { opacity: 0.5 },
      'data-part': name,
    });
    const refs = {
      tag: React.createRef<HTMLSpanElement>(),
      removeButton: React.createRef<HTMLButtonElement>(),
      expandButton: React.createRef<HTMLButtonElement>(),
      clearButton: React.createRef<HTMLButtonElement>(),
      option: React.createRef<HTMLLIElement>(),
      surface: React.createRef<HTMLDivElement>(),
    };
    render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        defaultOpen
        clearable
        slotProps={{
          tag: mine('tag', refs.tag),
          removeButton: mine('removeButton', refs.removeButton),
          expandButton: mine('expandButton', refs.expandButton),
          clearButton: mine('clearButton', refs.clearButton),
          option: mine('option', refs.option),
          surface: mine('surface', refs.surface),
        }}
      />,
    );
    await act(async () => {});
    const firstClass: Record<keyof typeof refs, string> = {
      tag: tagClassNames.root,
      removeButton: tagClassNames.dismissButton,
      expandButton: tagPickerClassNames.expandButton,
      clearButton: tagPickerClassNames.clearButton,
      option: 'wave-option',
      surface: 'wave-listbox-surface',
    };
    for (const name of Object.keys(refs) as (keyof typeof refs)[]) {
      const element = part(tagPickerClassNames[name])!;
      expect(refs[name].current).toBe(element);
      expect(element.classList[0]).toBe(firstClass[name]);
      expect(element).toHaveClass(tagPickerClassNames[name]);
      expect(element.classList[element.classList.length - 1]).toBe(`my-${name}`);
      expect(element).toHaveStyle({ opacity: '0.5' });
      expect(element).toHaveAttribute('data-part', name);
    }
    expect(refs.tag.current).toHaveTextContent('Apple');
    expect(refs.removeButton.current).toBe(screen.getByRole('button', { name: 'Remove Apple' }));
    expect(refs.option.current).toBe(screen.getByRole('option', { name: 'Banana' }));
    expect(refs.surface.current).toHaveStyle({ position: 'fixed' });
  });

  it('puts your props on the create option after the option part, and on the empty row', async () => {
    const createOption = React.createRef<HTMLLIElement>();
    const { unmount } = render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultOpen
        defaultQuery="kiwi"
        allowCreate
        slotProps={{
          option: { className: 'my-option', title: 'From option', 'data-from': 'option' },
          createOption: { ref: createOption, className: 'my-create', title: 'From create' },
        }}
      />,
    );
    await act(async () => {});
    const create = screen.getByRole('option', { name: 'Create "kiwi"' });
    expect(createOption.current).toBe(create);
    expect(Array.from(create.classList).slice(-2)).toEqual(['my-option', 'my-create']);
    expect(create).toHaveAttribute('title', 'From create');
    expect(create).toHaveAttribute('data-from', 'option');
    expect(create).toHaveAttribute('data-create', '');
    unmount();

    const emptyMessage = React.createRef<HTMLDivElement>();
    render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultOpen
        defaultQuery="zzz"
        slotProps={{ emptyMessage: { ref: emptyMessage, className: 'my-empty' } }}
      />,
    );
    await act(async () => {});
    expect(emptyMessage.current).toBe(part(tagPickerClassNames.emptyMessage));
    expect(emptyMessage.current).toHaveClass('my-empty');
    expect(emptyMessage.current).toHaveAttribute('aria-hidden', 'true');
  });

  it('runs your removeButton onClick before the removal, once per click in StrictMode; preventDefault() skips it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onClick = vi.fn();
    const { rerender } = render(
      <React.StrictMode>
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          defaultValue={['apple', 'banana']}
          onValueChange={onValueChange}
          slotProps={{ removeButton: { onClick: (event) => event.preventDefault() } }}
        />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(
      <React.StrictMode>
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          defaultValue={['apple', 'banana']}
          onValueChange={onValueChange}
          slotProps={{ removeButton: { onClick } }}
        />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(['banana']);
  });

  it('keeps the locked attributes of the default tags and their remove buttons', () => {
    render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        disabled
        slotProps={{
          tag: { role: 'button', hidden: true, title: 'A fruit' },
          removeButton: {
            type: 'submit',
            disabled: false,
            tabIndex: 0,
            hidden: true,
            'aria-hidden': true,
            'aria-label': 'Other',
            'aria-disabled': true,
          },
        }}
      />,
    );
    const tag = within(screen.getByRole('list', { name: 'Selected' })).getByRole('listitem');
    expect(tag).not.toHaveAttribute('hidden');
    expect(tag).toHaveAttribute('title', 'A fruit');
    const remove = screen.getByRole('button', { name: 'Remove Apple' });
    expect(remove).toHaveAttribute('type', 'button');
    expect(remove).toBeDisabled();
    expect(remove).not.toHaveAttribute('tabindex');
    expect(remove).not.toHaveAttribute('hidden');
    expect(remove).not.toHaveAttribute('aria-hidden');
    expect(remove).not.toHaveAttribute('aria-disabled');
  });

  it('does not call your removeButton or clearButton onClick while they are held focusable after disabling', async () => {
    const user = userEvent.setup();
    const removeClick = vi.fn();
    const clearClick = vi.fn();
    const slotProps: TagPickerSlotProps = {
      removeButton: { onClick: removeClick },
      clearButton: { onClick: clearClick },
    };
    const { rerender } = render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        slotProps={slotProps}
      />,
    );
    const remove = screen.getByRole('button', { name: 'Remove Apple' });
    act(() => remove.focus());
    rerender(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        disabled
        slotProps={slotProps}
      />,
    );
    expect(remove).toHaveFocus();
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    await user.click(remove);
    expect(removeClick).not.toHaveBeenCalled();

    const clear = screen.getByRole('button', { name: 'Clear selection' });
    rerender(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        slotProps={slotProps}
      />,
    );
    act(() => clear.focus());
    rerender(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        disabled
        slotProps={slotProps}
      />,
    );
    expect(clear).toHaveFocus();
    expect(clear).toHaveAttribute('aria-disabled', 'true');
    await user.click(clear);
    expect(clearClick).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole('list', { name: 'Selected' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });

  it('tracks the clear button focus also when your onFocus and onBlur prevent the default', () => {
    const slotProps: TagPickerSlotProps = {
      clearButton: {
        onFocus: (event) => event.preventDefault(),
        onBlur: (event) => event.preventDefault(),
      },
    };
    const { rerender } = render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        slotProps={slotProps}
      />,
    );
    const clear = screen.getByRole('button', { name: 'Clear selection' });
    act(() => clear.focus());
    rerender(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        disabled
        slotProps={slotProps}
      />,
    );
    // Held: the focus was tracked, so the disabled button keeps it.
    expect(clear).toHaveAttribute('aria-disabled', 'true');
    expect(clear).not.toBeDisabled();
  });

  it('keeps the clear button reachable and the empty row out of the tab order', async () => {
    const { unmount } = render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        slotProps={{ clearButton: { inert: true } }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Clear selection' })).not.toHaveAttribute('inert');
    unmount();

    render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultOpen
        defaultQuery="zzz"
        slotProps={{ emptyMessage: { tabIndex: 0 } }}
      />,
    );
    await act(async () => {});
    expect(part(tagPickerClassNames.emptyMessage)).not.toHaveAttribute('tabindex');
  });

  it('runs your clearButton, expandButton and option onClick first; preventDefault() skips their action', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        clearable
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
        slotProps={{
          clearButton: { onClick: (event) => event.preventDefault() },
          expandButton: { onClick: (event) => event.preventDefault() },
          option: { onClick: (event) => event.preventDefault() },
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    await user.click(part(tagPickerClassNames.expandButton)!);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(combobox('Fruit'));
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps the locked attributes of the generated options and the surface', async () => {
    render(
      <TagPicker
        aria-label="Fruit"
        options={options}
        defaultOpen
        slotProps={{
          option: {
            id: 'mine',
            role: 'menuitem',
            hidden: true,
            value: 'other',
            'data-value': 'other',
            'data-active': 'yes',
            'aria-selected': true,
          },
          surface: { role: 'dialog', hidden: true, 'aria-hidden': true, style: { top: 50 } },
        }}
      />,
    );
    await act(async () => {});
    const listed = screen.getAllByRole('option');
    expect(listed).toHaveLength(4);
    for (const [index, element] of listed.entries()) {
      expect(element.id).toMatch(/^tagpicker-listbox-.*-opt-\d+$/);
      expect(element).not.toHaveAttribute('hidden');
      expect(element).not.toHaveAttribute('data-active');
      expect(element).toHaveAttribute('aria-selected', 'false');
      expect(element).toHaveAttribute('data-value', options[index].value);
    }
    const surface = part(tagPickerClassNames.surface)!;
    expect(surface).not.toHaveAttribute('role');
    expect(surface).not.toHaveAttribute('hidden');
    expect(surface).not.toHaveAttribute('aria-hidden');
    expect(surface).toHaveStyle({ top: '0px' });
  });

  it('puts the overflowCount part on the +N chip, which keeps its aria-hidden and its press', () => {
    const ro = installResizeObserverMock();
    try {
      const chip = React.createRef<HTMLSpanElement>();
      const onMouseDown = vi.fn();
      render(
        <TagPicker
          aria-label="Fruit"
          options={options}
          defaultValue={['apple', 'banana', 'cherry']}
          overflow="count"
          slotProps={{
            overflowCount: {
              ref: chip,
              className: 'my-chip',
              onMouseDown,
              'aria-hidden': false,
            },
          }}
        />,
      );
      const control = combobox('Fruit').closest<HTMLElement>('[data-wave-tagpicker-control]')!;
      mockRect(control, { width: 130 });
      for (const tag of Array.from(control.querySelectorAll('[data-wave-tag-item]'))) {
        mockRect(tag, { width: 60 });
      }
      ro.trigger(control);
      const element = part(tagPickerClassNames.overflowCount)!;
      expect(chip.current).toBe(element);
      expect(element).toHaveTextContent('+1');
      expect(element.classList[0]).toBe(tagPickerClassNames.overflowCount);
      expect(element).toHaveClass('my-chip');
      expect(element).toHaveAttribute('aria-hidden', 'true');
      fireEvent.mouseDown(element);
      expect(onMouseDown).toHaveBeenCalledTimes(1);
      expect(combobox('Fruit')).toHaveFocus();
    } finally {
      ro.restore();
    }
  });

  it('keeps the +N chip out of the tab order: a part sets no tabIndex on it', () => {
    const ro = installResizeObserverMock();
    try {
      render(
        <TagPicker
          aria-label="Fruit"
          options={options}
          defaultValue={['apple', 'banana', 'cherry']}
          overflow="count"
          slotProps={{ overflowCount: { tabIndex: 0 } }}
        />,
      );
      const control = combobox('Fruit').closest<HTMLElement>('[data-wave-tagpicker-control]')!;
      mockRect(control, { width: 130 });
      for (const tag of Array.from(control.querySelectorAll('[data-wave-tag-item]'))) {
        mockRect(tag, { width: 60 });
      }
      ro.trigger(control);
      const element = part(tagPickerClassNames.overflowCount)!;
      expect(element).toHaveTextContent('+1');
      expect(element).not.toHaveAttribute('tabindex');
    } finally {
      ro.restore();
    }
  });

  it('renders the same +N chip without slotProps, with {} and with every part empty', () => {
    const ro = installResizeObserverMock();
    try {
      const ui = (slotProps: TagPickerSlotProps | undefined) => (
        <TagPicker
          aria-label="Fruit"
          options={options}
          defaultValue={['apple', 'banana', 'cherry']}
          overflow="count"
          slotProps={slotProps}
        />
      );
      const { baseElement, rerender } = render(ui(undefined));
      const control = combobox('Fruit').closest<HTMLElement>('[data-wave-tagpicker-control]')!;
      mockRect(control, { width: 130 });
      for (const tag of Array.from(control.querySelectorAll('[data-wave-tag-item]'))) {
        mockRect(tag, { width: 60 });
      }
      ro.trigger(control);
      expect(part(tagPickerClassNames.overflowCount)).toHaveTextContent('+1');
      const markup = baseElement.innerHTML;
      for (const slotProps of [{}, EVERY_PART, undefined]) {
        rerender(ui(slotProps));
        expect(baseElement.innerHTML).toBe(markup);
      }
    } finally {
      ro.restore();
    }
  });

  it('reaches only the members TagPicker generates: not your own Tags and options', async () => {
    render(
      <TagPicker
        aria-label="Fruit"
        defaultValue={['a']}
        defaultOpen
        slotProps={{ tag: { className: 'my-tag' }, option: { className: 'my-option' } }}
      >
        <TagPicker.Control>
          <TagPicker.Group>
            <Tag value="a">Apple</Tag>
          </TagPicker.Group>
          <TagPicker.Input />
        </TagPicker.Control>
        <TagPicker.List>
          <TagPicker.Option value="a">Apple</TagPicker.Option>
          <TagPicker.Option value="k">Kale</TagPicker.Option>
        </TagPicker.List>
      </TagPicker>,
    );
    await act(async () => {});
    expect(screen.getByRole('option', { name: 'Kale' })).not.toHaveClass('my-option');
    expect(document.querySelector('.my-tag')).toBeNull();
    expect(document.querySelector('.my-option')).toBeNull();
  });

  it('moves to the last tag with the mirrored arrow in RTL, its remove button carrying your class', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple', 'banana']}
        slotProps={{ removeButton: { className: 'my-remove' } }}
      />,
      { dir: 'rtl' },
    );
    await user.click(combobox('Fruit'));
    await user.keyboard('{ArrowRight}');
    const remove = screen.getByRole('button', { name: 'Remove Banana' });
    expect(remove).toHaveFocus();
    expect(remove).toHaveClass(tagPickerClassNames.removeButton, 'my-remove');
  });

  it('keeps the attributes a generated option renders only while set: a part sets none of them', async () => {
    render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultOpen
        allowCreate
        defaultQuery="kiwi"
        slotProps={{
          option: {
            'aria-posinset': 9,
            'aria-setsize': 9,
            'aria-disabled': true,
            'data-disabled': 'yes',
            'data-selected': 'yes',
          },
        }}
      />,
    );
    await act(async () => {});
    // The create option, and with no text the data-mode options.
    const check = () => {
      for (const option of screen.getAllByRole('option')) {
        expect(option).not.toHaveAttribute('aria-posinset');
        expect(option).not.toHaveAttribute('aria-setsize');
        expect(option).not.toHaveAttribute('aria-disabled');
        expect(option).not.toHaveAttribute('data-disabled');
        expect(option).not.toHaveAttribute('data-selected');
      }
    };
    expect(screen.getByRole('option', { name: 'Create "kiwi"' })).toBeInTheDocument();
    check();
    fireEvent.change(combobox('Fruit'), { target: { value: '' } });
    await act(async () => {});
    expect(screen.getAllByRole('option')).toHaveLength(2);
    check();
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <TagPicker
        aria-label="Fruit"
        options={TWO}
        defaultValue={['apple']}
        defaultOpen
        clearable
        slotProps={{
          tag: { className: 'my-tag' },
          removeButton: { className: 'my-remove' },
          expandButton: { className: 'my-expand' },
          clearButton: { className: 'my-clear' },
          option: { className: 'my-option' },
          surface: { className: 'my-surface' },
        }}
      />,
    );
    await act(async () => {});
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof TagPickerSlotProps>().toEqualTypeOf<
      | 'root'
      | 'tag'
      | 'removeButton'
      | 'expandButton'
      | 'clearButton'
      | 'option'
      | 'createOption'
      | 'overflowCount'
      | 'surface'
      | 'emptyMessage'
    >();
    expectTypeOf<NonNullable<TagPickerSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<TagPickerSlotProps['tag']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<TagPickerSlotProps['removeButton']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<NonNullable<TagPickerSlotProps['option']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<NonNullable<TagPickerSlotProps['surface']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: TagPicker draws its content
    void (<TagPicker slotProps={{ tag: { children: 'Other' } }} />);
    // @ts-expect-error -- a part takes no children: TagPicker draws its content
    void (<TagPicker slotProps={{ root: { children: 'x' } }} />);
  });

  describe('the root part', () => {
    const root = () => part(tagPickerClassNames.root)!;

    it("puts your className, style, data-* and attributes on the root <div>, after TagPicker's className and style", () => {
      render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          className="mine"
          style={{ color: 'red', width: 10 }}
          slotProps={{
            root: { className: 'my-root', style: { width: 20 }, 'data-part': 'root', title: 'R' },
          }}
        />,
      );
      expect(root().classList[0]).toBe(tagPickerClassNames.root);
      expect(root().className).toMatch(/ mine my-root$/);
      expect(root()).toHaveStyle({ color: 'rgb(255, 0, 0)', width: '20px' });
      expect(root()).toHaveAttribute('data-part', 'root');
      expect(root()).toHaveAttribute('title', 'R');
      expect(combobox('Fruit')).not.toHaveAttribute('data-part');
      expect(combobox('Fruit')).not.toHaveAttribute('title');
    });

    it('lets your class replace a conflicting class of the root', () => {
      render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          slotProps={{ root: { className: 'static' } }}
        />,
      );
      expect(root()).toHaveClass('static');
      expect(root()).not.toHaveClass('relative');
    });

    it("keeps the props you give TagPicker over the part's", () => {
      render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          title="Own"
          data-x="own"
          data-size="large"
          slotProps={{ root: { title: 'Part', 'data-x': 'part' } }}
        />,
      );
      expect(root()).toHaveAttribute('title', 'Own');
      expect(root()).toHaveAttribute('data-x', 'own');
      // Your own data-size reaches the root as in 0.18 (after the resolved one).
      expect(root()).toHaveAttribute('data-size', 'large');
    });

    it('keeps its data attributes and its hidden state: a part changes none of them', () => {
      const { rerender } = render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          size="large"
          appearance="underline"
          slotProps={{
            root: {
              'data-size': 'medium',
              'data-appearance': 'outline',
              'data-overflow': 'count',
              'data-collapsed': '',
              hidden: true,
              inert: true,
              'aria-hidden': true,
            },
          }}
        />,
      );
      expect(root()).toHaveAttribute('data-size', 'large');
      expect(root()).toHaveAttribute('data-appearance', 'underline');
      expect(root()).toHaveAttribute('data-overflow', 'wrap');
      expect(root()).not.toHaveAttribute('data-collapsed');
      for (const attribute of ['hidden', 'inert', 'aria-hidden']) {
        expect(root()).not.toHaveAttribute(attribute);
      }
      // TagPicker's own hidden state, and its single-line layout, stay its own.
      rerender(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          defaultValue={['apple']}
          overflow="count"
          hidden
          inert
          aria-hidden
          slotProps={{
            root: { 'data-overflow': 'wrap', hidden: false, inert: false, 'aria-hidden': false },
          }}
        />,
      );
      expect(root()).toHaveAttribute('data-overflow', 'count');
      expect(root()).toHaveAttribute('data-collapsed', '');
      expect(root()).toHaveAttribute('hidden');
      expect(root()).toHaveAttribute('inert');
      expect(root()).toHaveAttribute('aria-hidden', 'true');
    });

    it("runs your root handlers before TagPicker's own; preventDefault() in yours skips its own", () => {
      const order: string[] = [];
      const { rerender } = render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: () => order.push('part') } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
      rerender(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: (event) => event.preventDefault() } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
    });

    it('tracks focus inside the root after your onFocus and onBlur, also when they prevent the default', () => {
      const calls: string[] = [];
      render(
        <>
          <TagPicker
            aria-label="Fruit"
            options={TWO}
            defaultValue={['apple']}
            overflow="count"
            slotProps={{
              root: {
                onFocus: (event) => {
                  calls.push('focus');
                  event.preventDefault();
                },
                onBlur: (event) => {
                  calls.push('blur');
                  event.preventDefault();
                },
              },
            }}
          />
          <button type="button">Outside</button>
        </>,
      );
      expect(root()).toHaveAttribute('data-collapsed', '');
      // Focus inside expands the single-line layout, whatever your handler does.
      act(() => combobox('Fruit').focus());
      expect(root()).not.toHaveAttribute('data-collapsed');
      act(() => screen.getByRole('button', { name: 'Outside' }).focus());
      expect(root()).toHaveAttribute('data-collapsed', '');
      expect(calls).toEqual(['focus', 'blur']);
    });

    it('opens on a click in the input and toggles on a press on the field, whatever your root handlers do', async () => {
      const user = userEvent.setup();
      render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          slotProps={{
            root: {
              onClick: (event) => event.preventDefault(),
              onMouseDown: (event) => event.preventDefault(),
            },
          }}
        />,
      );
      // The input's opening and the field's press run before the event reaches the root.
      await user.click(combobox('Fruit'));
      expect(combobox('Fruit')).toHaveAttribute('aria-expanded', 'true');
      fireEvent.mouseDown(
        part(tagPickerClassNames.root)!.querySelector('[data-wave-tagpicker-control]')!,
      );
      expect(combobox('Fruit')).toHaveAttribute('aria-expanded', 'false');
    });

    it('calls your root onClick in every state, as TagPicker calls its own: the root passes no click to the trigger', () => {
      const onClick = vi.fn();
      const own = vi.fn();
      const { rerender } = render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          onClick={own}
          slotProps={{ root: { onClick } }}
        />,
      );
      fireEvent.click(root());
      rerender(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          disabled
          onClick={own}
          slotProps={{ root: { onClick } }}
        />,
      );
      fireEvent.click(root());
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(own).toHaveBeenCalledTimes(2);
    });

    it('keeps a press inside the root from dismissing the open list and the form reset working, also with an inline part ref', async () => {
      const user = userEvent.setup();
      const nodes: (HTMLDivElement | null)[] = [];
      const ui = (pass: number) => (
        <>
          <form aria-label="Order">
            <TagPicker
              aria-label="Fruit"
              options={TWO}
              defaultValue={['apple']}
              data-pass={pass}
              slotProps={{
                root: {
                  ref: (node) => {
                    nodes.push(node);
                  },
                },
              }}
            />
          </form>
          <p>Outside</p>
        </>
      );
      const { rerender } = render(ui(0));
      await user.click(combobox('Fruit'));
      rerender(ui(1));
      rerender(ui(2));
      expect(nodes.at(-1)).toBe(root());
      // A press on the root itself (no focus move): inside the popup's tree.
      fireEvent.pointerDown(root());
      fireEvent.click(root());
      await act(async () => {});
      expect(combobox('Fruit')).toHaveAttribute('aria-expanded', 'true');
      fireEvent.pointerDown(screen.getByText('Outside'));
      fireEvent.click(screen.getByText('Outside'));
      await act(async () => {});
      expect(combobox('Fruit')).toHaveAttribute('aria-expanded', 'false');
      // The form reset finds its form from the root's own ref.
      await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
      expect(tags()).toEqual([]);
      rerender(ui(3));
      act(() => (screen.getByRole('form', { name: 'Order' }) as HTMLFormElement).reset());
      expect(tags()).toEqual(['Apple']);
    });

    it('has no accessibility violations with the root customised', async () => {
      render(
        <TagPicker
          aria-label="Fruit"
          options={TWO}
          defaultValue={['apple']}
          defaultOpen
          slotProps={{ root: { className: 'my-root', title: 'Pick fruits' } }}
        />,
      );
      await act(async () => {});
      await expectNoA11yViolations();
    });
  });
});

/** React's development error for an unknown prop that reaches a DOM element, as logged. */
const UNKNOWN_PROP = (name: string) => [
  'React does not recognize the `%s` prop on a DOM element. If you intentionally want it to ' +
    'appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you ' +
    'accidentally passed it from a parent component, remove it from the DOM element.',
  name,
  name.toLowerCase(),
];

/** The parts form with `TagPicker.Button` in place of the Input. */
function ButtonPicker(props: Partial<TagPickerProps>) {
  return (
    <TagPicker options={options} {...props}>
      <TagPicker.Control>
        <TagPicker.Group />
        <TagPicker.Button />
      </TagPicker.Control>
    </TagPicker>
  );
}

// 1.0 (Phase 14, R5): `ref` reaches the trigger that renders, TagPicker.Input's
// <input role="combobox"> (the built-in one too) or TagPicker.Button's <button role="combobox">;
// the root <div> is `slotProps.root.ref`, and `controlRef` is gone.
describe('TagPicker — ref reaches the control', () => {
  const TRIGGERS = {
    input: (props: Partial<TagPickerProps>) => <TagPicker options={options} {...props} />,
    button: ButtonPicker,
  };

  it('focuses the built-in input through ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    renderPicker({ ref });
    expect(ref.current).toBe(combobox());
    act(() => ref.current?.focus());
    expect(combobox()).toHaveFocus();
  });

  it("gives ref the parts form's TagPicker.Input beside its own ref, and slotProps.root.ref the root", () => {
    const ref = React.createRef<HTMLInputElement>();
    const own = React.createRef<HTMLInputElement>();
    const root = React.createRef<HTMLDivElement>();
    render(
      <TagPicker
        ref={ref}
        aria-label="Fruits"
        options={options}
        slotProps={{ root: { ref: root } }}
      >
        <TagPicker.Control>
          <TagPicker.Group />
          <TagPicker.Input ref={own} />
        </TagPicker.Control>
      </TagPicker>,
    );
    expect(ref.current).toBe(combobox());
    expect(own.current).toBe(combobox());
    expect(root.current).toHaveClass(tagPickerClassNames.root);
    expect(root.current).toContainElement(combobox());
  });

  it('gives ref TagPicker.Button beside its own ref, and focuses it', () => {
    const ref = React.createRef<HTMLButtonElement>();
    const own = React.createRef<HTMLButtonElement>();
    render(
      <TagPicker ref={ref} aria-label="Fruits" options={options}>
        <TagPicker.Control>
          <TagPicker.Group />
          <TagPicker.Button ref={own} />
        </TagPicker.Control>
      </TagPicker>,
    );
    expect(combobox().tagName).toBe('BUTTON');
    expect(ref.current).toBe(combobox());
    expect(own.current).toBe(combobox());
    act(() => ref.current?.focus());
    expect(combobox()).toHaveFocus();
  });

  it('follows the trigger: swapping the Input for the Button moves ref to the button, and back', () => {
    const ref = vi.fn();
    const ui = (trigger: 'input' | 'button') => (
      <TagPicker ref={ref} aria-label="Fruits" options={options}>
        <TagPicker.Control>
          <TagPicker.Group />
          {trigger === 'input' ? <TagPicker.Input /> : <TagPicker.Button />}
        </TagPicker.Control>
      </TagPicker>
    );
    const { rerender, unmount } = render(ui('input'));
    const input = combobox();
    rerender(ui('button'));
    const button = combobox();
    expect(button.tagName).toBe('BUTTON');
    expect(ref.mock.calls).toEqual([[input], [null], [button]]);
    rerender(ui('input'));
    const next = combobox();
    expect(next.tagName).toBe('INPUT');
    expect(ref.mock.calls).toEqual([[input], [null], [button], [null], [next]]);
    unmount();
    expect(ref.mock.calls).toHaveLength(6);
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it.each(['input', 'button'] as const)(
    'keeps the invalid focus, the clear and the form reset working with an inline ref that changes on every render (%s)',
    async (trigger) => {
      const user = userEvent.setup();
      const Picker = TRIGGERS[trigger];
      const nodes: (HTMLElement | null)[] = [];
      const ui = (pass: number) => (
        <form aria-label="Order">
          <Picker
            aria-label="Fruits"
            ref={(node: HTMLInputElement | HTMLButtonElement | null) => {
              nodes.push(node);
            }}
            name="fruit"
            required
            clearable
            data-pass={pass}
          />
        </form>
      );
      const { rerender } = render(ui(0));
      rerender(ui(1));
      rerender(ui(2));
      const control = combobox();
      expect(nodes.at(-1)).toBe(control);
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      // The hidden input's invalid event focuses the trigger through TagPicker's own ref.
      act(() => {
        form.reportValidity();
      });
      expect(control).toHaveFocus();
      await user.click(control);
      await user.click(screen.getByRole('option', { name: 'Apple' }));
      rerender(ui(3));
      expect(tags()).toEqual(['Apple']);
      expect(form.checkValidity()).toBe(true);
      // The clear button hands focus to the trigger through TagPicker's own ref.
      act(() => control.blur());
      await user.click(screen.getByRole('button', { name: 'Clear selection' }));
      expect(tags()).toEqual([]);
      expect(control).toHaveFocus();
      await user.click(control);
      await user.click(screen.getByRole('option', { name: 'Banana' }));
      rerender(ui(4));
      act(() => form.reset());
      expect(tags()).toEqual([]);
      expect(form.checkValidity()).toBe(false);
      expect(nodes.at(-1)).toBe(control);
    },
  );

  it('keeps the popup placed against the field with an inline ref that changes on every render', async () => {
    const html = document.documentElement;
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
    try {
      const user = userEvent.setup();
      const nodes: (HTMLElement | null)[] = [];
      const ui = (pass: number) => (
        <TagPicker
          aria-label="Fruits"
          options={options}
          ref={(node) => {
            nodes.push(node);
          }}
          data-pass={pass}
        />
      );
      const { rerender } = render(ui(0));
      const field = combobox().closest<HTMLElement>('[data-wave-tagpicker-control]')!;
      mockRect(field, { x: 100, y: 100, width: 240, height: 32 });
      rerender(ui(1));
      await user.click(combobox());
      rerender(ui(2));
      rerender(ui(3));
      const surface = () =>
        screen.getByRole('listbox').closest<HTMLElement>('[data-wave-listbox-surface]')!;
      // As wide as the field, the positioning reference, which `ref` does not reach.
      await waitFor(() =>
        expect(surface().style.getPropertyValue('--wave-popup-reference-width')).toBe('240px'),
      );
      expect(surface()).toHaveAttribute('data-side', 'bottom');
      expect(nodes.at(-1)).toBe(combobox());
    } finally {
      Reflect.deleteProperty(html, 'clientWidth');
      Reflect.deleteProperty(html, 'clientHeight');
    }
  });

  it('attaches a callback ref once, keeps it across renders and detaches it on unmount', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <TagPicker ref={ref} aria-label="Fruits" options={options} />,
    );
    const input = combobox();
    rerender(
      <TagPicker
        ref={ref}
        aria-label="Fruits"
        options={options}
        defaultValue={['apple']}
        disabled
      />,
    );
    expect(ref.mock.calls).toEqual([[input]]);
    unmount();
    expect(ref.mock.calls).toEqual([[input], [null]]);
  });

  it.each(['input', 'button'] as const)(
    'in StrictMode, attaches only the control: React detaches and attaches it again on mount, once (%s)',
    (trigger) => {
      const Picker = TRIGGERS[trigger];
      const ref = vi.fn();
      const { rerender, unmount } = render(
        <React.StrictMode>
          <Picker ref={ref} aria-label="Fruits" />
        </React.StrictMode>,
      );
      const control = combobox();
      rerender(
        <React.StrictMode>
          <Picker ref={ref} aria-label="Fruits" readOnly />
        </React.StrictMode>,
      );
      expect(ref.mock.calls).toEqual([[control], [null], [control]]);
      unmount();
      expect(ref).toHaveBeenLastCalledWith(null);
    },
  );

  it.each(['input', 'button'] as const)(
    'reaches the trigger the Field label points at (%s)',
    (trigger) => {
      const Picker = TRIGGERS[trigger];
      const ref = React.createRef<HTMLInputElement | HTMLButtonElement>();
      renderWithFieldContext(<Picker ref={ref} />);
      const fieldLabel = screen
        .getByText(FIELD_TEST_TEXT.label)
        .closest('label') as HTMLLabelElement;
      expect(ref.current).toBe(combobox(FIELD_TEST_TEXT.label));
      expect(ref.current?.id).toBe(fieldLabel.htmlFor);
    },
  );

  it('declares ref for the input or the button, and no controlRef', () => {
    expectTypeOf<TagPickerProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement | HTMLButtonElement> | undefined
    >();
    expectTypeOf<TagPickerProps>().not.toHaveProperty('controlRef');
    const inputRef = React.createRef<HTMLInputElement>();
    const buttonRef = React.createRef<HTMLButtonElement>();
    void (<TagPicker aria-label="Fruits" ref={inputRef} />);
    void (<TagPicker aria-label="Fruits" ref={buttonRef} />);
    const divRef = React.createRef<HTMLDivElement>();
    // @ts-expect-error -- in 1.0 `ref` reaches the trigger; the root <div> is slotProps.root.ref
    void (<TagPicker aria-label="Fruits" ref={divRef} />);
    // @ts-expect-error -- a callback typed for the root <div> is rejected too: a <button> is no <div>
    void (<TagPicker aria-label="Fruits" ref={(node: HTMLDivElement | null) => void node} />);
    // A state setter takes the trigger when its state takes both triggers (or any element).
    type Setter<T> = React.Dispatch<React.SetStateAction<T | null>>;
    const setTrigger = (() => {}) as Setter<HTMLInputElement | HTMLButtonElement>;
    const setElement = (() => {}) as Setter<HTMLElement>;
    const setInput = (() => {}) as Setter<HTMLInputElement>;
    void (<TagPicker aria-label="Fruits" ref={setTrigger} />);
    void (<TagPicker aria-label="Fruits" ref={setElement} />);
    // @ts-expect-error -- a setter of an input alone could be handed TagPicker.Button
    void (<TagPicker aria-label="Fruits" ref={setInput} />);
  });

  it('has no controlRef: TypeScript rejects it, and untyped code puts an unknown prop on the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <TagPicker
          aria-label="Fruits"
          options={options}
          // @ts-expect-error -- `controlRef` is removed in 1.0: `ref` reaches the trigger
          controlRef={controlRef}
        />,
      );
      expect(controlRef.current).toBeNull();
      expect(document.querySelector(`.${tagPickerClassNames.root}`)).toHaveAttribute(
        'controlref',
        '[object Object]',
      );
      expect(error.mock.calls).toEqual([UNKNOWN_PROP('controlRef')]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
