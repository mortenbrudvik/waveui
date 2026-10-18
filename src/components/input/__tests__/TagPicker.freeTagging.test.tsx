/**
 * TagPicker free tagging (spec P6-04 D59, D60; GitHub issue #6): the create option of
 * `allowCreate`, `onOptionCreate` and `labels.create`, item by item of the issue's acceptance list.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker } from '../TagPicker';
import type { TagPickerOption } from '../TagPicker';
import { expectNoA11yViolations, findDanglingIdRefs } from '../../../test-utils';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';
import { tagPickerClassNames } from '../../../lib/classNames';

const options: TagPickerOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

function combobox() {
  return screen.getByRole('combobox', { name: 'Topics' });
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function createOption(text = 'infra') {
  return screen.queryByRole('option', { name: `Create "${text}"` });
}

/**
 * The create option for `text` is listed with its text, never selected, and (when `active`) is
 * the option `aria-activedescendant` points at.
 */
function expectCreateOption(text: string, active = true) {
  const option = createOption(text);
  expect(option).toHaveTextContent(`Create "${text}"`);
  expect(option).toHaveAttribute('aria-selected', 'false');
  if (active) expect(activeOption()).toBe(option);
  else expect(activeOption()).not.toBe(option);
}

function tags() {
  const list = screen.queryByRole('list', { name: 'Selected' });
  return list
    ? within(list)
        .getAllByRole('listitem')
        .map((el) => el.textContent)
    : [];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TagPicker free tagging (allowCreate)', () => {
  it('type infra: the list shows only Create "infra", it is active, Enter creates', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const onOptionCreate = vi.fn((text: string) => calls.push(`create:${text}`));
    const onValueChange = vi.fn((value: string[]) => calls.push(`value:${value.join(',')}`));
    const onQueryChange = vi.fn();
    render(
      <React.StrictMode>
        <TagPicker
          aria-label="Topics"
          options={options}
          allowCreate
          onOptionCreate={onOptionCreate}
          onValueChange={onValueChange}
          onQueryChange={onQueryChange}
        />
      </React.StrictMode>,
    );
    await user.type(combobox(), 'infra');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toEqual([createOption()]);
    expect(createOption()).toHaveAttribute('aria-selected', 'false');
    expect(createOption()).toHaveAttribute('data-create', '');
    expect(activeOption()).toBe(createOption());
    onQueryChange.mockClear();
    await user.keyboard('{Enter}');
    expect(calls).toEqual(['create:infra', 'value:infra']);
    expect(onOptionCreate).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(tags()).toEqual(['infra']);
    expect(combobox()).toHaveValue('');
    expect(onQueryChange).toHaveBeenCalledWith('');
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(__getAnnouncerText()).toBe('infra added, 1 selected'));
  });

  it('type a: the create option is last and the first match active; ArrowDown reaches it and Enter creates', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    render(
      <TagPicker
        aria-label="Topics"
        options={options}
        allowCreate
        onOptionCreate={onOptionCreate}
      />,
    );
    await user.type(combobox(), 'a');
    const listed = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(listed.map((o) => o.textContent)).toEqual(['Apple', 'Banana', 'Create "a"']);
    expect(activeOption()).toHaveTextContent('Apple');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOption()).toBe(createOption('a'));
    await user.keyboard('{Enter}');
    expect(onOptionCreate).toHaveBeenCalledWith('a');
    expect(tags()).toEqual(['a']);
  });

  it('a click on the create option creates and keeps focus in the input', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    render(
      <TagPicker
        aria-label="Topics"
        options={options}
        allowCreate
        onOptionCreate={onOptionCreate}
      />,
    );
    await user.type(combobox(), 'infra');
    await user.click(createOption()!);
    expect(onOptionCreate).toHaveBeenCalledWith('infra');
    expect(tags()).toEqual(['infra']);
    expect(combobox()).toHaveFocus();
  });

  describe('duplicates', () => {
    const cases: Array<[string, string, { defaultValue?: string[] }, string | null]> = [
      ['empty text', '', {}, null],
      ['whitespace', '  ', {}, null],
      ['an option label in another case', 'APPLE', {}, 'Apple'],
      ['a selected label', 'banana', { defaultValue: ['banana'] }, null],
      ['a created value in another case', 'INFRA', { defaultValue: ['infra'] }, null],
      ['an option value', 'cherry-1', {}, null],
    ];

    it.each(cases)('shows no create option for %s', async (_name, text, props) => {
      const user = userEvent.setup();
      render(
        <TagPicker
          aria-label="Topics"
          options={[...options, { value: 'cherry-1', label: 'Sour cherry' }]}
          allowCreate
          {...props}
        />,
      );
      await user.click(combobox());
      if (text) await user.type(combobox(), text);
      expect(
        screen.queryByRole('option', { name: /^Create/ }),
        `no create option for "${text}"`,
      ).toBeNull();
    });

    it.each(cases)(
      'Enter picks the listed exact match, or does nothing with the match selected (%s)',
      async (_name, text, props, picked) => {
        const user = userEvent.setup();
        const onOptionCreate = vi.fn();
        const onValueChange = vi.fn();
        render(
          <form aria-label="Form" onSubmit={(event) => event.preventDefault()}>
            <TagPicker
              aria-label="Topics"
              options={[...options, { value: 'cherry-1', label: 'Sour cherry' }]}
              allowCreate
              onOptionCreate={onOptionCreate}
              onValueChange={onValueChange}
              {...props}
            />
          </form>,
        );
        await user.click(combobox());
        if (text) await user.type(combobox(), text);
        await user.keyboard('{Enter}');
        expect(onOptionCreate).not.toHaveBeenCalled();
        if (picked === null) {
          expect(onValueChange).not.toHaveBeenCalled();
        } else {
          expect(tags()).toContain(picked);
        }
      },
    );
  });

  it("trims the text: '  infra  ' creates 'infra'", async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    render(
      <TagPicker
        aria-label="Topics"
        options={options}
        allowCreate
        onOptionCreate={onOptionCreate}
      />,
    );
    await user.type(combobox(), '  infra  ');
    expectCreateOption('infra');
    await user.keyboard('{Enter}');
    expect(onOptionCreate).toHaveBeenCalledWith('infra');
    expect(tags()).toEqual(['infra']);
  });

  it('never says No matches while the create option shows, in any commit (registration mode), and says it again for a selected label’s text', async () => {
    const statuses: string[] = [];
    const { container } = render(
      <TagPicker aria-label="Topics" allowCreate defaultValue={['apple']} defaultOpen>
        <TagPicker.Control />
        <TagPicker.List>
          <TagPicker.Option value="apple">Apple</TagPicker.Option>
          <TagPicker.Option value="banana">Banana</TagPicker.Option>
        </TagPicker.List>
      </TagPicker>,
    );
    const status = within(container).getByRole('status');
    const record = () => statuses.push(status.textContent ?? '');
    const observer = new MutationObserver(record);
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    try {
      act(() => {
        fireEvent.change(combobox(), { target: { value: 'i' } });
      });
      record();
      await act(async () => {});
      record();
      act(() => {
        fireEvent.change(combobox(), { target: { value: 'infra' } });
      });
      record();
      await act(async () => {});
      record();
      expectCreateOption('infra');
      expect(statuses.every((text) => text === '')).toBe(true);
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      // The text of a selected option's label: no create option, nothing listed.
      act(() => {
        fireEvent.change(combobox(), { target: { value: 'apple' } });
      });
      await act(async () => {});
      expect(screen.queryByRole('option', { name: /^Create/ })).toBeNull();
      expect(status).toHaveTextContent('No matches');
    } finally {
      observer.disconnect();
    }
  });

  it('submits a created value and a form reset drops it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <form aria-label="Form">
        <TagPicker
          aria-label="Topics"
          name="topics"
          options={options}
          defaultValue={['apple']}
          allowCreate
          onValueChange={onValueChange}
        />
        <button type="reset">Reset</button>
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    await user.type(combobox(), 'infra{Enter}');
    expect(new FormData(form).getAll('topics')).toEqual(['apple', 'infra']);
    onValueChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(tags()).toEqual(['Apple']);
    expect(new FormData(form).getAll('topics')).toEqual(['apple']);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(['apple']);
  });

  it('labels.create localizes the text and the option’s name', async () => {
    const user = userEvent.setup();
    render(
      <TagPicker
        aria-label="Topics"
        options={options}
        allowCreate
        labels={{ create: (text) => `Opprett «${text}»` }}
      />,
    );
    await user.type(combobox(), 'infra');
    const option = screen.getByRole('option', { name: 'Opprett «infra»' });
    expect(option).toHaveTextContent('Opprett «infra»');
    expect(option).toHaveClass(tagPickerClassNames.createOption);
  });

  it('with filter={() => true} and async results, the create option follows the current options', async () => {
    const user = userEvent.setup();
    function AsyncPicker({ results }: { results: TagPickerOption[] }) {
      const [query, setQuery] = React.useState('');
      return (
        <TagPicker
          aria-label="Topics"
          options={results}
          filter={() => true}
          query={query}
          onQueryChange={setQuery}
          allowCreate
        />
      );
    }
    const { rerender } = render(<AsyncPicker results={[]} />);
    await user.type(combobox(), 'apple');
    // Before the results arrive, the text is new.
    expectCreateOption('apple');
    rerender(<AsyncPicker results={[{ value: 'apple', label: 'Apple' }]} />);
    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    expect(createOption('apple')).toBeNull();
    rerender(<AsyncPicker results={[{ value: 'pineapple', label: 'Pineapple' }]} />);
    expect(screen.getByRole('option', { name: 'Pineapple' })).toBeInTheDocument();
    // The first match stays active; the create option follows it, last.
    expectCreateOption('apple', false);
    expect(activeOption()).toHaveTextContent('Pineapple');
    expect(screen.getAllByRole('option').at(-1)).toBe(createOption('apple'));
  });

  it('offers nothing while disabled or read-only; Tab, blur and close never create', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    const { unmount } = render(
      <>
        <TagPicker
          aria-label="Topics"
          options={options}
          allowCreate
          onOptionCreate={onOptionCreate}
        />
        <button type="button">After</button>
      </>,
    );
    await user.type(combobox(), 'infra');
    expectCreateOption('infra');
    await user.keyboard('{Escape}');
    expect(createOption()).toBeNull();
    await user.click(combobox());
    expectCreateOption('infra');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'After' }));
    expect(onOptionCreate).not.toHaveBeenCalled();
    expect(tags()).toEqual([]);
    unmount();
    for (const lock of [{ disabled: true }, { readOnly: true }]) {
      const locked = render(
        <TagPicker
          aria-label="Topics"
          options={options}
          allowCreate
          onOptionCreate={onOptionCreate}
          defaultQuery="infra"
          defaultOpen
          {...lock}
        />,
      );
      await user.click(combobox());
      await user.keyboard('{Enter}');
      expect(createOption()).toBeNull();
      locked.unmount();
    }
    expect(onOptionCreate).not.toHaveBeenCalled();
  });

  it('does not warn TagPicker:unknown-value with allowCreate; a controlled parent adding the option renames the tag', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    function Controlled() {
      const [value, setValue] = React.useState<string[]>([]);
      const [list, setList] = React.useState(options);
      return (
        <>
          <TagPicker
            aria-label="Topics"
            options={list}
            value={value}
            onValueChange={setValue}
            allowCreate
          />
          <button
            type="button"
            onClick={() => setList([...list, { value: 'infra', label: 'Infra team' }])}
          >
            Name it
          </button>
        </>
      );
    }
    render(<Controlled />);
    await user.type(combobox(), 'infra{Enter}');
    expect(tags()).toEqual(['infra']);
    await user.click(screen.getByRole('button', { name: 'Name it' }));
    expect(tags()).toEqual(['Infra team']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a synthetic create option of a filter still works without allowCreate (Phase 5 D13)', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function Synthetic() {
      const [query, setQuery] = React.useState('');
      const [value, setValue] = React.useState<string[]>([]);
      const list = query
        ? [...options, { value: `new:${query}`, label: `Add "${query}"` }]
        : options;
      return (
        <TagPicker
          aria-label="Topics"
          options={list}
          value={value}
          onValueChange={setValue}
          query={query}
          onQueryChange={setQuery}
          filter={(option, text) =>
            option.value.startsWith('new:') || option.label.toLowerCase().includes(text)
          }
        />
      );
    }
    render(<Synthetic />);
    await user.type(combobox(), 'zz');
    expect(screen.getByRole('option', { name: 'Add "zz"' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Create/ })).toBeNull();
    await user.keyboard('{Enter}');
    expect(tags()).toEqual(['new:zz']);
    // The app keeps no option for the new value: the 0.10 warning, unchanged.
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] TagPicker: the selected value(s) "new:zz" match no option; the raw value is shown as the tag label.',
      ],
    ]);
  });

  it('has no axe violations with the create option active', async () => {
    const user = userEvent.setup();
    render(
      <TagPicker aria-label="Topics" options={options} allowCreate defaultValue={['apple']} />,
    );
    await user.type(combobox(), 'infra');
    expect(activeOption()).toBe(createOption());
    expect(findDanglingIdRefs()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('creates with the deprecated onChange too', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();
    render(<TagPicker aria-label="Topics" options={options} allowCreate onChange={onChange} />);
    await user.type(combobox(), 'infra{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['infra']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^\[WaveUI\] TagPicker: `onChange` is deprecated/);
  });
});
