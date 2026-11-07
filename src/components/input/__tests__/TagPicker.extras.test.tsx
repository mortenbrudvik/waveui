import * as React from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker, type TagPickerCreateDetails, type TagPickerProps } from '../TagPicker';
import { tagPickerClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';

const OPTIONS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry', disabled: true },
  { value: 'date', label: 'Date' },
];

function renderPicker(props: Partial<TagPickerProps> = {}) {
  return render(<TagPicker aria-label="Fruits" options={OPTIONS} {...props} />);
}

const combobox = () => screen.getByRole('combobox', { name: 'Fruits' });
const textbox = () => screen.getByRole('textbox', { name: 'Fruits' });
const tagNames = () =>
  Array.from(
    screen.queryByRole('list', { name: 'Selected' })?.querySelectorAll('[role="listitem"]') ?? [],
    (el) => el.textContent,
  );

describe('TagPicker disabled option entries', () => {
  it('keeps a disabled entry in the list, aria-disabled, and never adds it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });
    await user.click(combobox());
    const cherry = screen.getByRole('option', { name: 'Cherry' });
    expect(cherry).toHaveAttribute('aria-disabled', 'true');
    expect(cherry).toHaveAttribute('data-disabled');
    await user.click(cherry);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('skips a disabled entry with the arrow keys', async () => {
    const user = userEvent.setup();
    renderPicker();
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    const id = combobox().getAttribute('aria-activedescendant');
    expect(document.getElementById(id ?? '')).toHaveAccessibleName('Date');
  });

  it('does not add a disabled entry whose label is typed with noPopover', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ noPopover: true, onValueChange });
    await user.type(textbox(), 'cherry{Enter}');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('TagPicker noPopover', () => {
  it('renders a plain text field: no combobox role, no popup wiring, no expand button, no list', () => {
    renderPicker({ noPopover: true });
    const input = textbox();
    expect(input.tagName).toBe('INPUT');
    expect(input).not.toHaveAttribute('role');
    for (const name of [
      'aria-expanded',
      'aria-controls',
      'aria-haspopup',
      'aria-activedescendant',
    ]) {
      expect(input).not.toHaveAttribute(name);
    }
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show options' })).toBeNull();
    expect(document.querySelector(`.${tagPickerClassNames.listbox}`)).toBeNull();
  });

  it('never opens: typing, a click and the arrow keys show no list', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPicker({ noPopover: true, onOpenChange });
    await user.click(textbox());
    await user.keyboard('ap{ArrowDown}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('adds the option whose label equals the typed text on Enter, ignoring case', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ noPopover: true, onValueChange });
    await user.type(textbox(), 'bANana{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(['banana']);
    expect(tagNames()).toEqual(['Banana']);
    // The text was consumed.
    expect(textbox()).toHaveValue('');
  });

  it('creates a tag of the typed text with allowCreate, and reports the event', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    const onValueChange = vi.fn();
    renderPicker({ noPopover: true, allowCreate: true, onOptionCreate, onValueChange });
    await user.type(textbox(), '  mango {Enter}');
    expect(onOptionCreate).toHaveBeenCalledTimes(1);
    expect(onOptionCreate).toHaveBeenCalledWith('mango', { event: expect.any(Event) });
    expect((onOptionCreate.mock.calls[0][1] as TagPickerCreateDetails).event.type).toBe('keydown');
    expect(onValueChange).toHaveBeenLastCalledWith(['mango']);
    expect(tagNames()).toEqual(['mango']);
  });

  it('leaves Enter to the page when nothing can be added', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TagPicker aria-label="Fruits" options={OPTIONS} noPopover />
        <button type="submit">Send</button>
      </form>,
    );
    await user.type(textbox(), 'kiwi{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Empty text: the form submits as well.
    await user.clear(textbox());
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('does not submit the form for an Enter that adds a tag', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TagPicker aria-label="Fruits" options={OPTIONS} noPopover allowCreate />
        <button type="submit">Send</button>
      </form>,
    );
    await user.type(textbox(), 'kiwi{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores a duplicate of a selected tag, and an already created text', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    renderPicker({
      noPopover: true,
      allowCreate: true,
      onOptionCreate,
      defaultValue: ['apple'],
    });
    await user.type(textbox(), 'Apple{Enter}');
    expect(onOptionCreate).not.toHaveBeenCalled();
    expect(tagNames()).toEqual(['Apple']);
  });

  it('Escape clears the typed text', async () => {
    const user = userEvent.setup();
    renderPicker({ noPopover: true });
    await user.type(textbox(), 'ban');
    await user.keyboard('{Escape}');
    expect(textbox()).toHaveValue('');
  });

  it('keeps the tag keys: Backspace in the empty field focuses the last tag', async () => {
    const user = userEvent.setup();
    renderPicker({ noPopover: true, defaultValue: ['apple', 'banana'] });
    await user.click(textbox());
    await user.keyboard('{Backspace}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Banana' }));
  });

  it('adds nothing and renders no list when read-only', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ noPopover: true, readOnly: true, onValueChange });
    await user.type(textbox(), 'apple{Enter}');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('ignores a TagPicker.List in the parts form', () => {
    render(
      <TagPicker aria-label="Fruits" noPopover>
        <TagPicker.Control>
          <TagPicker.Group />
          <TagPicker.Input />
        </TagPicker.Control>
        <TagPicker.List>
          <TagPicker.Option value="a">A</TagPicker.Option>
        </TagPicker.List>
      </TagPicker>,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(textbox()).toBeInTheDocument();
  });

  it('keeps the list with TagPicker.Button, with a development warning', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <TagPicker aria-label="Fruits" options={OPTIONS} noPopover>
        <TagPicker.Control>
          <TagPicker.Group />
          <TagPicker.Button />
        </TagPicker.Control>
      </TagPicker>,
    );
    await user.click(combobox());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[WaveUI] TagPicker: `noPopover` needs `TagPicker.Input`: `TagPicker.Button` has no text to add a tag from, so the list is kept.',
    ]);
    warn.mockRestore();
  });

  it('has no axe violations', async () => {
    renderPicker({ noPopover: true, defaultValue: ['apple'] });
    await expectNoA11yViolations();
  });

  it('types noPopover', () => {
    expectTypeOf<TagPickerProps['noPopover']>().toEqualTypeOf<boolean | undefined>();
  });
});

describe('TagPicker secondaryAction', () => {
  it('renders the action after the trigger in a span of its own', () => {
    renderPicker({ secondaryAction: <button type="button">Clear all</button> });
    const action = screen.getByRole('button', { name: 'Clear all' });
    const wrapper = action.parentElement as HTMLElement;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).toHaveClass(tagPickerClassNames.secondaryAction);
    // After the input in DOM order.
    expect(
      combobox().compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders nothing for a value that renders nothing', () => {
    renderPicker({ secondaryAction: false });
    expect(document.querySelector(`.${tagPickerClassNames.secondaryAction}`)).toBeNull();
  });

  it("lets TagPicker.Control's secondaryAction win", () => {
    render(
      <TagPicker aria-label="Fruits" options={OPTIONS} secondaryAction={<i>root</i>}>
        <TagPicker.Control secondaryAction={<b>control</b>} />
      </TagPicker>,
    );
    expect(screen.getByText('control')).toBeInTheDocument();
    expect(screen.queryByText('root')).toBeNull();
  });

  it('a press on its button keeps the list closed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderPicker({ secondaryAction: <button onClick={onClick}>Add all</button> });
    await user.click(screen.getByRole('button', { name: 'Add all' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('is a tab stop after the trigger', async () => {
    const user = userEvent.setup();
    renderPicker({ secondaryAction: <button type="button">Clear all</button> });
    await user.tab();
    expect(document.activeElement).toBe(combobox());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear all' }));
  });

  it('has no axe violations', async () => {
    renderPicker({ secondaryAction: <button type="button">Clear all</button> });
    await expectNoA11yViolations();
  });
});

describe('TagPicker onOptionCreate details', () => {
  it('passes the click or key event of a create option as details', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    renderPicker({ allowCreate: true, onOptionCreate });
    await user.click(combobox());
    await user.type(combobox(), 'zzz');
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Create/ }));
    expect(onOptionCreate).toHaveBeenCalledTimes(1);
    expect(onOptionCreate.mock.calls[0][0]).toBe('zzz');
    expect((onOptionCreate.mock.calls[0][1] as TagPickerCreateDetails).event.type).toBe('click');
    await user.type(combobox(), 'yyy');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onOptionCreate).toHaveBeenCalledTimes(2);
    expect((onOptionCreate.mock.calls[1][1] as TagPickerCreateDetails).event.type).toBe('keydown');
  });

  it('still accepts a callback that takes the text only', () => {
    expectTypeOf<(text: string) => void>().toMatchTypeOf<
      NonNullable<TagPickerProps['onOptionCreate']>
    >();
    expectTypeOf<NonNullable<TagPickerProps['onOptionCreate']>>().parameters.toEqualTypeOf<
      [text: string, details?: TagPickerCreateDetails]
    >();
  });

  it('calls it once per creation in StrictMode', async () => {
    const user = userEvent.setup();
    const onOptionCreate = vi.fn();
    render(
      <React.StrictMode>
        <TagPicker
          aria-label="Fruits"
          options={OPTIONS}
          allowCreate
          onOptionCreate={onOptionCreate}
        />
      </React.StrictMode>,
    );
    await user.click(combobox());
    await user.type(combobox(), 'zzz');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onOptionCreate).toHaveBeenCalledTimes(1);
  });
});
