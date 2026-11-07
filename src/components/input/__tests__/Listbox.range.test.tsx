import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Listbox, type ListboxLabels, type ListboxProps } from '../Listbox';
import { Option } from '../Option';
import { __getAnnouncerText, __resetAnnouncer } from '../../../hooks/useAnnounce';
import type { ListboxItem } from '../../../hooks/useListbox';
import { expectNoA11yViolations } from '../../../test-utils';

const FRUITS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig'];

function renderRange(props: Partial<ListboxProps<true>> = {}) {
  return render(
    <Listbox aria-label="Fruits" multiselect {...props}>
      {FRUITS.map((fruit) => (
        <Option key={fruit} value={fruit.toLowerCase()} disabled={fruit === 'Cherry'}>
          {fruit}
        </Option>
      ))}
    </Listbox>,
  );
}

const option = (name: string) => screen.getByRole('option', { name });
const selected = () =>
  screen
    .getAllByRole('option')
    .filter((o) => o.getAttribute('aria-selected') === 'true')
    .map((o) => o.textContent);

/** Focuses the list (the first enabled option becomes active) and returns the user. */
async function focusList() {
  const user = userEvent.setup();
  await user.tab();
  return user;
}

afterEach(() => {
  __resetAnnouncer();
});

describe('Listbox range keys (multiselect)', () => {
  it('Shift+ArrowDown moves to the next option and toggles it', async () => {
    const onValueChange = vi.fn();
    renderRange({ onValueChange });
    const user = await focusList();
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(selected()).toEqual(['Banana']);
    // Cherry is disabled: the key skips it, as the plain arrow does.
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(selected()).toEqual(['Banana', 'Date']);
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    // Banana is active again, and toggled off.
    expect(selected()).toEqual(['Date']);
    expect(onValueChange).toHaveBeenLastCalledWith(['date']);
    expect(
      document.getElementById(
        screen.getByRole('listbox').getAttribute('aria-activedescendant') ?? '',
      ),
    ).toBe(option('Banana'));
  });

  it('does nothing at the ends of the list', async () => {
    renderRange();
    const user = await focusList();
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(selected()).toEqual([]);
    await user.keyboard('{End}');
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(selected()).toEqual([]);
  });

  it('Shift+Space selects from the most recently selected option to the active one', async () => {
    const onValueChange = vi.fn();
    renderRange({ onValueChange });
    const user = await focusList();
    await user.keyboard('{ }');
    expect(selected()).toEqual(['Apple']);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.keyboard('{Shift>}{ }{/Shift}');
    // Apple to Date; the disabled Cherry stays out.
    expect(selected()).toEqual(['Apple', 'Banana', 'Date']);
    expect(onValueChange).toHaveBeenLastCalledWith(['apple', 'banana', 'date']);
  });

  it('Shift+Space extends upwards from the anchor too', async () => {
    renderRange();
    const user = await focusList();
    await user.keyboard('{End}{ }');
    expect(selected()).toEqual(['Fig']);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    await user.keyboard('{Shift>}{ }{/Shift}');
    expect(selected()).toEqual(['Date', 'Elderberry', 'Fig']);
  });

  it('Shift+Space with nothing selected selects the active option', async () => {
    renderRange();
    const user = await focusList();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Shift>}{ }{/Shift}');
    expect(selected()).toEqual(['Banana']);
  });

  it('Ctrl+Shift+End and Ctrl+Shift+Home select up to the ends and move there', async () => {
    renderRange();
    const user = await focusList();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Control>}{Shift>}{End}{/Shift}{/Control}');
    expect(selected()).toEqual(['Banana', 'Date', 'Elderberry', 'Fig']);
    expect(
      document.getElementById(
        screen.getByRole('listbox').getAttribute('aria-activedescendant') ?? '',
      ),
    ).toBe(option('Fig'));
    await user.keyboard('{Control>}{Shift>}{Home}{/Shift}{/Control}');
    expect(selected()).toEqual(['Apple', 'Banana', 'Date', 'Elderberry', 'Fig']);
  });

  it('Ctrl+A selects every enabled option, and again deselects them', async () => {
    const onValueChange = vi.fn();
    renderRange({ onValueChange, defaultValue: ['date'] });
    const user = await focusList();
    await user.keyboard('{Control>}a{/Control}');
    expect(selected()).toEqual(['Apple', 'Banana', 'Date', 'Elderberry', 'Fig']);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith([
      'date',
      'apple',
      'banana',
      'elderberry',
      'fig',
    ]);
    await user.keyboard('{Control>}a{/Control}');
    expect(selected()).toEqual([]);
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it('prevents the page from selecting all its text with Ctrl+A', async () => {
    renderRange();
    await focusList();
    const notPrevented = fireEvent.keyDown(screen.getByRole('listbox'), {
      key: 'a',
      ctrlKey: true,
    });
    expect(notPrevented).toBe(false);
  });

  it('works through the Cmd key on the Mac', async () => {
    renderRange();
    const user = await focusList();
    await user.keyboard('{Meta>}a{/Meta}');
    expect(selected()).toHaveLength(5);
  });

  it('leaves the keys alone in a single-select list, and a Ctrl+A there', async () => {
    const user = userEvent.setup();
    render(
      <Listbox aria-label="Fruits">
        {FRUITS.map((fruit) => (
          <Option key={fruit} value={fruit.toLowerCase()}>
            {fruit}
          </Option>
        ))}
      </Listbox>,
    );
    await user.tab();
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(
      screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(0);
    await user.keyboard('{Control>}a{/Control}');
    expect(
      screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(0);
  });

  it('calls onValueChange once per range key in StrictMode', async () => {
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Listbox aria-label="Fruits" multiselect onValueChange={onValueChange}>
          {FRUITS.map((fruit) => (
            <Option key={fruit} value={fruit.toLowerCase()}>
              {fruit}
            </Option>
          ))}
        </Listbox>
      </React.StrictMode>,
    );
    const user = await focusList();
    await user.keyboard('{Control>}a{/Control}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('announces a range with the number of options it selected', async () => {
    renderRange();
    const user = await focusList();
    await user.keyboard('{Control>}a{/Control}');
    await waitFor(() => expect(__getAnnouncerText()).toBe('5 added, 5 selected'));
    await user.keyboard('{Control>}a{/Control}');
    await waitFor(() => expect(__getAnnouncerText()).toBe('5 removed, 0 selected'));
  });

  it('localizes the announcements with labels', async () => {
    const labels: ListboxLabels = {
      rangeAdded: (changed, count) => `${changed} lagt til, ${count} valgt`,
      rangeRemoved: (changed, count) => `${changed} fjernet, ${count} valgt`,
    };
    renderRange({ labels });
    const user = await focusList();
    await user.keyboard('{Control>}a{/Control}');
    await waitFor(() => expect(__getAnnouncerText()).toBe('5 lagt til, 5 valgt'));
    await user.keyboard('{Control>}a{/Control}');
    await waitFor(() => expect(__getAnnouncerText()).toBe('5 fjernet, 0 valgt'));
  });

  it('works over every item of a windowed data-mode list', async () => {
    const items: ListboxItem[] = Array.from({ length: 300 }, (_, i) => ({
      value: `v${i}`,
      label: `Item ${i}`,
    }));
    const onValueChange = vi.fn();
    render(<Listbox aria-label="Items" multiselect items={items} onValueChange={onValueChange} />);
    const user = await focusList();
    await user.keyboard('{Control>}a{/Control}');
    expect(onValueChange).toHaveBeenLastCalledWith(items.map((item) => item.value));
  });

  it('has no axe violations after a range selection', async () => {
    renderRange();
    const user = await focusList();
    await user.keyboard('{Control>}a{/Control}');
    await expectNoA11yViolations();
  });
});
