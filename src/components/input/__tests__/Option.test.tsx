import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Option, OptionGroup } from '../Option';
import { Combobox, Option as ComboboxReexport, OptionGroup as GroupReexport } from '../Combobox';
import { Dropdown } from '../Dropdown';
import { collectOptionLabels } from '../../../hooks/useListbox';
import { asClientReference, testDisplayName } from '../../../test-utils';

function combobox() {
  return screen.getByRole('combobox', { name: 'Fruit' });
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
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
    // (a hidden element has no accessible name: query its text)
    const lemon = screen.getByText('Lemon').closest('li');
    expect(lemon).toHaveAttribute('role', 'option');
    expect(lemon).toHaveClass('grid', '[&[hidden]]:hidden');
    expect(lemon).not.toHaveClass('flex');
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

  it('Option and OptionGroup written in a Server Component (lazy types) render the same server HTML and behave the same', async () => {
    const user = userEvent.setup();
    const LazyOption = asClientReference(Option);
    const LazyGroup = asClientReference(OptionGroup);
    const plain = renderToString(
      <Dropdown aria-label="Fruit" defaultValue="l">
        <OptionGroup label="Citrus">
          <Option value="l">Lemon</Option>
        </OptionGroup>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    expect(plain).toMatch(/role="combobox"[^>]*>(<[^>]*>)*Lemon</); // the trigger shows the label
    const lazy = (
      <Dropdown aria-label="Fruit" defaultValue="l">
        <LazyGroup label="Citrus">
          <LazyOption value="l">Lemon</LazyOption>
        </LazyGroup>
        <LazyOption value="a">Apple</LazyOption>
      </Dropdown>
    );
    expect(renderToString(lazy)).toBe(plain);

    render(lazy);
    expect(combobox()).toHaveTextContent('Lemon');
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(combobox()).toHaveTextContent('Apple');
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

describe('Option / OptionGroup hidden by the consumer (listbox-hook-code-1)', () => {
  it('a hidden option is never highlighted or committed with the keyboard, like a native <option hidden>', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Dropdown aria-label="Fruit" onValueChange={onValueChange}>
        <Option value="placeholder" hidden>
          Choose…
        </Option>
        <Option value="a">Apple</Option>
        <Option value="b" hidden>
          Banana
        </Option>
        <Option value="c">Cherry</Option>
      </Dropdown>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Cherry' }));
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onValueChange.mock.calls).toEqual([['a']]);
    // Typeahead does not find the hidden Banana either.
    await user.keyboard('b');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{Enter}');
    expect(onValueChange.mock.calls).toEqual([['a']]);
    const hidden = screen.getAllByRole('option', { hidden: true }).filter((o) => o.hidden);
    expect(hidden.map((o) => o.textContent)).toEqual(['Choose…', 'Banana']);
  });

  it('a selected hidden option (a placeholder) shows its label; opening starts at the first visible option', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown aria-label="Fruit" defaultValue="placeholder">
        <Option value="placeholder" hidden>
          Choose…
        </Option>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    expect(combobox()).toHaveTextContent('Choose…');
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
  });

  it('the options of a hidden OptionGroup are never highlighted or committed', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Dropdown aria-label="Fruit" onValueChange={onValueChange}>
        <OptionGroup label="Citrus" hidden>
          <Option value="l">Lemon</Option>
          <OptionGroup label="Limes">
            <Option value="k">Key lime</Option>
          </OptionGroup>
        </OptionGroup>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{ArrowUp}{Home}');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('k');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    await user.keyboard('{Enter}');
    expect(onValueChange.mock.calls).toEqual([['a']]);
  });

  it('a group whose options are all hidden is hidden; a listbox with only hidden options does not expand', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown aria-label="Fruit">
        <OptionGroup label="Citrus">
          <Option value="l" hidden>
            Lemon
          </Option>
        </OptionGroup>
        <Option value="a" hidden>
          Apple
        </Option>
      </Dropdown>,
    );
    expect(
      screen.getByRole('group', { name: 'Citrus', hidden: true }).parentElement,
    ).toHaveAttribute('hidden');
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Combobox: a hidden option is not listed or committed, and filtering matches textValue', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox aria-label="Fruit" onValueChange={onValueChange}>
        <Option value="us" label="USA" textValue="United States">
          USA
        </Option>
        <Option value="x" hidden>
          United Kingdom
        </Option>
        <Option value="no">Norway</Option>
      </Combobox>,
    );
    await user.type(combobox(), 'united');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['USA']);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onValueChange.mock.calls).toEqual([['us']]);
  });
});
