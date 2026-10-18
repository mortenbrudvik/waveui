import * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RovingContainerProps } from '../../../hooks/useRovingTabIndex';
import type { Orientation } from '../../../lib/types';
import { renderWithProviders } from '../../../test-utils';
import {
  TOOLBAR_ITEM_SELECTOR,
  useToolbarNavigation,
  type UseToolbarNavigationOptions,
} from '../Toolbar.navigation';

/**
 * A container that is no Toolbar (TagGroup's toolbar mode, NavDrawer.Body's selector): the
 * controls of a filter bar, roving through the shared configuration while `attached`.
 */
function FilterBar({
  orientation = 'horizontal',
  attached = true,
}: {
  orientation?: Orientation;
  attached?: boolean;
}) {
  const { containerProps } = useToolbarNavigation({ orientation });
  return (
    <>
      <button type="button">before</button>
      <div role="group" aria-label="Filters" {...(attached ? containerProps : {})}>
        <button type="button">Red</button>
        <a href="#blue">Blue</a>
        <span role="button">Green</span>
        <input type="hidden" name="filter" value="red" />
        <button type="button" disabled>
          Yellow
        </button>
        <button type="button">Reset</button>
      </div>
      <button type="button">after</button>
    </>
  );
}

const control = (name: string) =>
  name === 'Blue' ? screen.getByRole('link', { name }) : screen.getByRole('button', { name });

describe('Toolbar.navigation (0.11 spec §1.8, §4.4)', () => {
  it('TOOLBAR_ITEM_SELECTOR matches every focusable control a toolbar can hold', () => {
    expect(TOOLBAR_ITEM_SELECTOR).toBe(
      'button, [href], input, select, textarea, [role="button"], [tabindex]',
    );
  });

  it('types the frozen seam: orientation in, containerProps out', () => {
    expectTypeOf<UseToolbarNavigationOptions>().toEqualTypeOf<{ orientation: Orientation }>();
    expectTypeOf(useToolbarNavigation).parameters.toEqualTypeOf<[UseToolbarNavigationOptions]>();
    expectTypeOf(useToolbarNavigation).returns.toEqualTypeOf<{
      containerProps: RovingContainerProps;
    }>();
  });

  it('makes a container that is no Toolbar one Tab stop, with the last focused control', async () => {
    const user = userEvent.setup();
    render(<FilterBar />);
    const group = screen.getByRole('group', { name: 'Filters' });
    expect(group).toHaveAttribute('data-roving-container', '');
    // The first enabled control holds the Tab stop; the hidden input is no item.
    expect(control('Red')).toHaveAttribute('tabindex', '0');
    for (const name of ['Blue', 'Green', 'Reset']) {
      expect(control(name)).toHaveAttribute('tabindex', '-1');
    }
    expect(group.querySelector('input[type="hidden"]')).not.toHaveAttribute('tabindex');

    await user.tab();
    await user.tab();
    expect(control('Red')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(control('Blue')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(control('Green')).toHaveFocus();
    // The disabled control is skipped.
    await user.keyboard('{ArrowRight}');
    expect(control('Reset')).toHaveFocus();
    // The arrows wrap; Home and End reach the ends.
    await user.keyboard('{ArrowRight}');
    expect(control('Red')).toHaveFocus();
    await user.keyboard('{End}');
    expect(control('Reset')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(control('Red')).toHaveFocus();
    // The other axis does nothing.
    await user.keyboard('{ArrowDown}');
    expect(control('Red')).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(control('Reset')).toHaveFocus();
    await user.tab();
    expect(control('after')).toHaveFocus();
    await user.tab({ shift: true });
    expect(control('Reset')).toHaveFocus();
  });

  it('moves with Up and Down when vertical, and ignores Left and Right', async () => {
    const user = userEvent.setup();
    render(<FilterBar orientation="vertical" />);
    act(() => control('Red').focus());
    await user.keyboard('{ArrowDown}');
    expect(control('Blue')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(control('Blue')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(control('Red')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(control('Red')).toHaveFocus();
  });

  it('mirrors Left and Right in RTL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FilterBar />, { dir: 'rtl' });
    act(() => control('Red').focus());
    await user.keyboard('{ArrowLeft}');
    expect(control('Blue')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(control('Red')).toHaveFocus();
  });

  it('hands every control its own tabIndex back when containerProps are no longer spread', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FilterBar />);
    rerender(<FilterBar attached={false} />);
    const group = screen.getByRole('group', { name: 'Filters' });
    expect(group).not.toHaveAttribute('data-roving-container');
    expect(group.querySelectorAll('[tabindex], [data-roving-value]')).toHaveLength(0);

    // Every enabled control is its own Tab stop again (the span has no tabIndex of its own).
    await user.tab();
    await user.tab();
    expect(control('Red')).toHaveFocus();
    await user.tab();
    expect(control('Blue')).toHaveFocus();
    await user.tab();
    expect(control('Reset')).toHaveFocus();
  });
});
