import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Option, OptionGroup } from '../Option';
import { Option as ComboboxReexport, OptionGroup as GroupReexport } from '../Combobox';
import { Dropdown } from '../Dropdown';
import { collectOptionLabels } from '../../../hooks/useListbox';
import { testDisplayName } from '../../../test-utils';

function combobox() {
  return screen.getByRole('combobox', { name: 'Fruit' });
}

describe('Option / OptionGroup (input-pickers#1, #6, #20)', () => {
  testDisplayName(Option, 'Option');
  testDisplayName(OptionGroup, 'OptionGroup');

  it('are re-exported unchanged from Combobox.tsx', () => {
    expect(ComboboxReexport).toBe(Option);
    expect(GroupReexport).toBe(OptionGroup);
  });

  it('are marked for collectOptionLabels (label → textValue → text → value)', () => {
    const labels = collectOptionLabels(
      <>
        <Option value="a" label="Label A">
          <b>ignored</b>
        </Option>
        <OptionGroup label="Group">
          <Option value="b" textValue="Text B">
            Bee
          </Option>
          <Option value="c">
            <span>Cee</span>
          </Option>
        </OptionGroup>
        <Option value="d" />
      </>,
    );
    expect(Object.fromEntries(labels)).toEqual({
      a: 'Label A',
      b: 'Text B',
      c: 'Cee',
      d: 'd',
    });
  });

  it('forwards ref to the option <li>', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLLIElement>();
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <Option ref={ref} value="a">
          Apple
        </Option>
      </Dropdown>,
    );
    expect(ref.current).toBe(screen.getByRole('option', { name: 'Apple' }));
    // Closed: the option moves back into the inline, hidden list.
    await user.click(combobox());
    expect(ref.current?.tagName).toBe('LI');
    expect(ref.current).not.toBeVisible();
    await user.click(combobox());
    expect(ref.current).toBe(screen.getByRole('option', { name: 'Apple' }));
  });

  it('renders a group as presentation > group named by its label', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <OptionGroup label="Citrus">
          <Option value="l">Lemon</Option>
        </OptionGroup>
      </Dropdown>,
    );
    const group = screen.getByRole('group', { name: 'Citrus' });
    expect(group.tagName).toBe('UL');
    expect(group.parentElement).toHaveAttribute('role', 'presentation');
    expect(group.parentElement?.tagName).toBe('LI');
  });

  it('lets the hidden attribute win over a consumer display class (no Preflight)', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <OptionGroup label="Citrus" className="flex" hidden>
          <Option value="l" className="grid">
            Lemon
          </Option>
        </OptionGroup>
        <Option value="a" className="grid" hidden>
          Apple
        </Option>
      </Dropdown>,
    );
    const group = screen.getByRole('group', { name: 'Citrus', hidden: true }).parentElement;
    expect(group).toHaveAttribute('hidden');
    expect(group).toHaveClass('flex', '[&[hidden]]:hidden');
    const lemon = screen.getByRole('option', { name: 'Lemon', hidden: true });
    expect(lemon).toHaveClass('grid', '[&[hidden]]:hidden');
    expect(lemon).not.toHaveClass('flex');
    // (a hidden element has no accessible name: query its text)
    const apple = screen.getByText('Apple').closest('li');
    expect(apple).toHaveAttribute('role', 'option');
    expect(apple).toHaveClass('grid', '[&[hidden]]:hidden');
  });

  it('keeps the 0.4 data-value attribute', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('data-value', 'a');
  });

  it('shows the label prop in the trigger when the children are not plain text', () => {
    render(
      <Dropdown aria-label="Fruit" defaultValue="a">
        <Option value="a" label="Apple">
          <span aria-hidden="true">*</span> Apple (red)
        </Option>
      </Dropdown>,
    );
    expect(combobox()).toHaveTextContent('Apple');
    expect(combobox()).not.toHaveTextContent('red');
  });

  it('composes a consumer onClick: it runs first and preventDefault() cancels the selection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onClick = vi.fn((e: React.MouseEvent) => e.preventDefault());
    render(
      <Dropdown aria-label="Fruit" defaultOpen onValueChange={onValueChange}>
        <Option value="a" onClick={onClick}>
          Apple
        </Option>
        <Option value="b">Banana</Option>
      </Dropdown>,
    );
    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('marks the selected option with a check mark and the container forced-colors recipe', () => {
    render(
      <Dropdown aria-label="Fruit" defaultOpen defaultValue="b">
        <Option value="a">Apple</Option>
        <Option value="b">Banana</Option>
      </Dropdown>,
    );
    const selected = screen.getByRole('option', { name: 'Banana' });
    const other = screen.getByRole('option', { name: 'Apple' });
    expect(selected.querySelector('svg')).not.toHaveClass('invisible');
    expect(other.querySelector('svg')).toHaveClass('invisible');
    expect(selected).toHaveClass('forced-colors:outline-[Highlight]');
    expect(other).not.toHaveClass('forced-colors:outline-[Highlight]');
    expect(selected).not.toHaveClass('forced-colors:forced-color-adjust-none');
  });

  it('throws in development outside a listbox (C-CONTEXT)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <ul>
          <Option value="a">Apple</Option>
        </ul>,
      ),
    ).toThrow('[WaveUI] Option must be used within a listbox');
    error.mockRestore();
  });
});
